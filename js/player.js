// 預覽播放器：解碼影片＋Web Audio 播放聲音，套用剪掉／變速，畫到預覽畫布
import { Emitter, clamp } from './util.js';
import { buildSegments, outputDuration, outToSrc, srcToOut } from './project.js';
import { render, outputSize } from './compositor.js';
import { scheduleAudio } from './exporter.js';

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
    this.segs = buildSegments(this.project.edit, this.project.duration);
    this.outDur = outputDuration(this.segs);
  }
  get outTime() { return srcToOut(this.segs, this.t); }

  // 編輯內容改變時呼叫
  invalidate(structural = false) {
    if (structural) {
      this.refreshSegments();
      if (this.playing) { this.pause(); this.play(); }
    }
    this._dirty = true;
  }

  async seek(t) {
    this.t = clamp(t, 0, this.project.duration);
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
    let o = srcToOut(this.segs, this.t);
    if (o >= this.outDur - 0.05) o = 0;
    const actx = await this._audio();
    this.playing = true;
    const a = this.project.edit.audio;
    const lead = 0.08;
    this._o0 = o;
    this._c0 = actx.currentTime + lead;
    this.audioNodes = [];
    for (const name of ['mic', 'sys']) {
      const buf = this.media.buffers[name];
      if (!buf || a[name + 'Mute']) continue;
      this.audioNodes.push(scheduleAudio(actx, actx.destination, buf, a[name], this.segs, o, this._c0));
    }
    const s = outToSrc(this.segs, o);
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
    this.seek(this.t);
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
      if (o >= this.outDur) { this.t = this.segs.length ? this.segs[this.segs.length - 1].s1 - 0.001 : 0; this.pause(); this.emit('ended'); return; }
      const s = outToSrc(this.segs, o);
      for (const r of Object.values(this.readers)) if (r?.needsRestart(s)) r.play(s);
      this.t = s;
      this._dirty = true;
      this.emit('time', s);
    }
    if (!this._dirty) return;
    this._dirty = false;
    const fr = {};
    for (const [k, r] of Object.entries(this.readers)) fr[k] = r ? (this.playing ? r.update(this.t) : r.cur) : null;
    this.layout = render(this.ctx, pw, ph, this.t, {
      project: this.project, screen: fr.screen, camera: fr.camera,
      cursor: this.assets.cursor, images: this.assets.images, bgImage: this.assets.bgImage,
      preview: true, sel: this.sel,
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
