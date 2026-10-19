// 預覽播放器：解碼影片＋Web Audio 播放聲音，套用剪掉／變速，畫到預覽畫布
import { Emitter, clamp } from './util.js';
import { buildTimeline, partAt, srcToOut, clipRange, clipLocal } from './project.js';
import { render, outputSize, renderTemplate, drawOverlays } from './compositor.js';
import { VideoReader } from './media.js';
import { scheduleAudio } from './exporter.js';
import { getMusicBuffer, scheduleMusic, scheduleClip } from './assets.js';
import { transitionPoints, transitionAt, drawTransition } from './transitions.js';
import { VideoSampleSink } from '../vendor/mediabunny.min.mjs';

export class Player extends Emitter {
  constructor(project, media, canvas, assets) {
    super();
    this.project = project;
    this.media = media;
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.assets = assets; // { cursor, images, bgImage }
    this.readers = { screen: media.reader('screen'), camera: media.reader('camera') };
    this.t = 0;
    this.o = 0;           // 輸出影片的時間（含片頭）
    this.playing = false;
    this.sel = null;
    this.layout = null;
    this.actx = null;
    this.audioNodes = [];
    this._dirty = true;
    this.refreshSegments();
    this._loop = this._loop.bind(this);
    this._raf = requestAnimationFrame(this._loop);
    this.seek(0);
  }

  refreshSegments() {
    this.tl = buildTimeline(this.project.edit, this.project.duration);
    this.segs = this.tl.segs;
    this.outDur = this.tl.total;
    this.tpts = transitionPoints(this.project.edit, this.tl);
    this.loadClips();
    this.o = Math.min(this.o, this.outDur);
    this.loadMusic();
  }
  get outTime() { return this.o; }
  // ---- 多軌：影片 2、音樂軌、錄音軌 ----
  clips() {
    const e = this.project.edit;
    return [...(e.v2 || []).map(c => ({ kind: 'v2', c })), ...(e.musicClips || []).map(c => ({ kind: 'music', c })), ...(e.voice || []).map(c => ({ kind: 'voice', c }))];
  }
  // 先把每個片段的聲音解碼好（播放時直接排程）
  loadClips() {
    this.clipBuf ||= new Map();
    for (const { kind, c } of this.clips()) {
      const key = kind === 'music' && c.src === 'lib' ? 'lib:' + c.musicId : c.blobKey;
      if (!key || this.clipBuf.has(key)) continue;
      this.clipBuf.set(key, null);
      const p = key.startsWith('lib:') ? getMusicBuffer(c.musicId) : this.media.clipAudio(key);
      p.then(b => { if (!b) return; this.clipBuf.set(key, b); if (this.playing) { this.pause(); this.play(); } }).catch(() => { });
    }
  }
  clipBuffer(kind, c) { return this.clipBuf?.get(kind === 'music' && c.src === 'lib' ? 'lib:' + c.musicId : c.blobKey) || null; }
  // 影片 2 的解碼器（每個片段一個）
  v2Reader(c) {
    this.v2r ||= new Map();
    if (!this.v2r.has(c.id)) {
      const ent = { reader: null };
      this.v2r.set(c.id, ent);
      this.media.clip(c.blobKey).then(m => { if (m?.v) { ent.reader = new VideoReader(m.v); const l = clipLocal(this.tl, c, this.o); if (l != null) ent.reader.seek(l).then(() => (this._dirty = true)); } }).catch(() => { });
    }
    return this.v2r.get(c.id).reader;
  }
  _overlays() {
    const out = [];
    for (const c of this.project.edit.v2 || []) {
      const r = this.v2Reader(c);
      const local = clipLocal(this.tl, c, this.o);
      if (!r) continue;
      if (local == null) { if (r.iter) r.stop(); continue; }
      let frame;
      if (this.playing) { if (r.needsRestart(local)) r.play(local); frame = r.update(local); }
      else frame = r.cur;
      out.push({ clip: c, frame });
    }
    return out;
  }
  _drawOverlays(pw, ph) {
    const ov = this._overlays();
    const boxes = ov.length ? drawOverlays(this.ctx, pw, ph, ov) : [];
    if (this.layout) this.layout.v2Boxes = boxes;
  }
  get part() { return partAt(this.tl, this.o); }
  // 背景配樂先在背景合成好
  loadMusic() {
    const m = this.project.edit.music;
    if (!m) { this.musicBuf = null; return; }
    if (this._musicId === m.id && this.musicBuf) return;
    this._musicId = m.id; this.musicBuf = null;
    getMusicBuffer(m.id).then(b => { if (this.project.edit.music?.id === m.id) { this.musicBuf = b; if (this.playing) { this.pause(); this.play(); } } }).catch(() => { });
  }

  // 編輯內容改變時呼叫
  invalidate(structural = false) {
    if (structural) {
      this.refreshSegments();
      if (this.playing) { this.pause(); this.play(); }
    }
    this._dirty = true;
  }

  // 依錄影原始時間定位（時間軸）
  async seek(t) {
    this.t = clamp(t, 0, this.project.duration);
    this.o = this.tl.introD + srcToOut(this.segs, this.t);
    return this._seekFrames();
  }
  // 依輸出時間定位（片頭、片尾預覽）
  async seekOut(o) {
    this.o = clamp(o, 0, Math.max(0, this.outDur - 0.001));
    this.t = this.part.src;
    return this._seekFrames();
  }
  async _seekFrames() {
    if (this.playing) { this.pause(); this.play(); return; }
    const want = this.t;
    const v2 = (this.project.edit.v2 || []).map(c => { const r = this.v2Reader(c), l = clipLocal(this.tl, c, this.o); return r && l != null ? r.seek(l) : null; });
    await Promise.all([...Object.values(this.readers).filter(Boolean).map(r => r.seek(want)), ...v2]);
    this._dirty = true;
    this.emit('time', this.t);
  }

  async _audio() {
    if (!this.actx) this.actx = new AudioContext({ latencyHint: 'interactive' });
    if (this.actx.state === 'suspended') await this.actx.resume();
    return this.actx;
  }

  async play() {
    if (this.playing || !this.outDur) return;
    let o = this.o;
    if (o >= this.outDur - 0.05) o = 0;
    const actx = await this._audio();
    this.playing = true;
    const a = this.project.edit.audio;
    const lead = 0.08;
    this._o0 = o;
    this._c0 = actx.currentTime + lead;
    this.audioNodes = [];
    const { introD, recOut } = this.tl;
    if (o < introD + recOut) {
      const fromRec = Math.max(0, o - introD), when = this._c0 + Math.max(0, introD - o);
      for (const name of ['mic', 'sys']) {
        const buf = this.media.buffers[name];
        if (!buf || a[name + 'Mute']) continue;
        this.audioNodes.push(scheduleAudio(actx, actx.destination, buf, a[name], this.segs, fromRec, when));
      }
    }
    if (this.musicBuf && this.project.edit.music) this.audioNodes.push(scheduleMusic(actx, actx.destination, this.musicBuf, this.project.edit.music, this.outDur, o, this._c0));
    for (const { kind, c } of this.clips()) {
      const buf = this.clipBuffer(kind, c);
      if (!buf) continue;
      const { o0, o1 } = clipRange(this.tl, c);
      this.audioNodes.push(scheduleClip(actx, actx.destination, buf, c, o0, o1, o, this._c0));
    }
    this.o = o;
    const s = partAt(this.tl, o).src;
    this.t = s;
    Object.values(this.readers).forEach(r => r?.play(s));
    this.emit('play');
  }

  pause() {
    if (!this.playing) return;
    this.playing = false;
    this.audioNodes.forEach(n => n.stop());
    this.audioNodes = [];
    Object.values(this.readers).forEach(r => r?.stop());
    for (const e of this.v2r?.values() || []) e.reader?.stop();
    this.emit('pause');
    this.seekOut(this.o);
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  setVolume(name, v) {
    // 音量即時生效（播放中重新排程即可）
    if (this.playing) { this.pause(); this.play(); }
  }

  _size() {
    const box = this.canvas.parentElement.getBoundingClientRect();
    const { W, H } = outputSize(this.project, 1080);
    const dpr = Math.min(2, devicePixelRatio || 1);
    const k = Math.min(box.width / W, box.height / H);
    const cw = Math.max(2, Math.round(W * k)), ch = Math.max(2, Math.round(H * k));
    if (this.canvas.style.width !== cw + 'px') { this.canvas.style.width = cw + 'px'; this.canvas.style.height = ch + 'px'; }
    const pw = Math.round(cw * dpr), ph = Math.round(ch * dpr);
    if (this.canvas.width !== pw || this.canvas.height !== ph) { this.canvas.width = pw; this.canvas.height = ph; this._dirty = true; }
    return { pw, ph, cssScale: dpr };
  }

  _loop() {
    this._raf = requestAnimationFrame(this._loop);
    const { pw, ph } = this._size();
    if (this.playing) {
      const o = this._o0 + Math.max(0, this.actx.currentTime - this._c0);
      if (o >= this.outDur) { this.o = Math.max(0, this.outDur - 0.001); this.t = this.part.src; this.pause(); this.emit('ended'); return; }
      this.o = o;
      const pt = this.part, s = pt.src;
      if (pt.kind === 'rec') for (const r of Object.values(this.readers)) if (r?.needsRestart(s)) r.play(s);
      this.t = s;
      this._dirty = true;
      this.emit('time', s);
    }
    if (!this._dirty) return;
    this._dirty = false;
    const pt = this.part, ed = this.project.edit;
    const tr = transitionAt(this.tpts, this.o);
    if (tr) { this._drawTransition(tr, pw, ph); return; }
    if (pt.kind !== 'rec') {
      // 片頭／片尾
      renderTemplate(this.ctx, pw, ph, pt.kind === 'intro' ? ed.intro : ed.outro, pt.lt);
      this.layout = null;
      this._drawOverlays(pw, ph);
      this.emit('drawn', null);
      return;
    }
    const fr = {};
    for (const [k, r] of Object.entries(this.readers)) fr[k] = r ? (this.playing ? r.update(this.t) : r.cur) : null;
    this.layout = render(this.ctx, pw, ph, this.t, {
      project: this.project, screen: fr.screen, camera: fr.camera,
      cursor: this.assets.cursor, images: this.assets.images, bgImage: this.assets.bgImage,
      preview: true, sel: this.sel, ot: this.o,
    });
    this.layout.pw = pw; this.layout.ph = ph;
    this._drawOverlays(pw, ph);
    this.emit('drawn', this.layout);
  }

  // 轉場：A（接點前）與 B（接點後）各畫一張，再依效果混合
  _drawTransition(tr, pw, ph) {
    const ed = this.project.edit, live = this.part;
    const A = partAt(this.tl, Math.min(this.o, tr.T - 1e-3)), B = partAt(this.tl, Math.max(this.o, tr.T + 1e-3));
    this._la = layerCanvas(this._la, pw, ph); this._lb = layerCanvas(this._lb, pw, ph);
    const draw = (cv, part) => {
      const g = cv.getContext('2d');
      if (part.kind !== 'rec') { renderTemplate(g, pw, ph, part.kind === 'intro' ? ed.intro : ed.outro, part.lt); return; }
      const isLive = live.kind === 'rec' && Math.abs(part.src - live.src) < 1e-3;
      const fr = {};
      for (const [k, r] of Object.entries(this.readers)) fr[k] = !r ? null : isLive ? (this.playing ? r.update(this.t) : r.cur) : this._frozen(k, part.src);
      render(g, pw, ph, part.src, { project: this.project, screen: fr.screen, camera: fr.camera, cursor: this.assets.cursor, images: this.assets.images, bgImage: this.assets.bgImage, preview: false, ot: this.o });
    };
    draw(this._la, A); draw(this._lb, B);
    drawTransition(this.ctx, this._la, this._lb, tr.type, tr.p, pw, ph);
    this.layout = null;
    this._drawOverlays(pw, ph);
    this.emit('drawn', null);
  }
  // 轉場時「停住」的那一格（接點前最後一格／接點後第一格）：隨機讀取並快取
  _frozen(name, src) {
    this._fz ||= new Map();
    const key = name + ':' + src.toFixed(3);
    const hit = this._fz.get(key);
    if (hit && hit !== 'loading') return hit;
    if (!hit && this.media.video[name]) {
      this._fz.set(key, 'loading');
      this._fzSink ||= {};
      this._fzSink[name] ||= new VideoSampleSink(this.media.video[name]);
      this._fzSink[name].getSample(src).then(s => {
        if (!s) { this._fz.delete(key); return; }
        this._fz.set(key, s);
        if (this._fz.size > 12) { const [k0, v0] = this._fz.entries().next().value; if (v0 !== 'loading') v0.close?.(); this._fz.delete(k0); }
        this._dirty = true;
      }).catch(() => this._fz.delete(key));
    }
    return null;
  }

  // 等目前畫面解碼好再畫（播放時解碼器會稍慢於時鐘）
  dispose() {
    cancelAnimationFrame(this._raf);
    this.pause();
    Object.values(this.readers).forEach(r => r?.dispose());
    for (const e of this.v2r?.values() || []) e.reader?.dispose();
    for (const v of this._fz?.values() || []) if (v !== 'loading') v.close?.();
    this.actx?.close().catch(() => { });
  }
}

function layerCanvas(c, w, h) {
  if (!c) c = document.createElement('canvas');
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  return c;
}
