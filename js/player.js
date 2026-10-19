// 預覽播放器：解碼影片＋Web Audio 播放聲音，套用剪掉／變速，畫到預覽畫布
import { Emitter, clamp } from './util.js';
import { buildTimeline, partAt, srcToOut } from './project.js';
import { render, outputSize, renderTemplate } from './compositor.js';
import { scheduleAudio } from './exporter.js';
import { getMusicBuffer, scheduleMusic } from './assets.js';

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
    this.o = Math.min(this.o, this.outDur);
    this.loadMusic();
  }
  get outTime() { return this.o; }
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
    await Promise.all(Object.values(this.readers).filter(Boolean).map(r => r.seek(want)));
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
    if (pt.kind !== 'rec') {
      // 片頭／片尾
      renderTemplate(this.ctx, pw, ph, pt.kind === 'intro' ? ed.intro : ed.outro, pt.lt);
      this.layout = null;
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
    this.emit('drawn', this.layout);
  }

  // 等目前畫面解碼好再畫（播放時解碼器會稍慢於時鐘）
  dispose() {
    cancelAnimationFrame(this._raf);
    this.pause();
    Object.values(this.readers).forEach(r => r?.dispose());
    this.actx?.close().catch(() => { });
  }
}
