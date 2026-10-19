// 媒體讀取：用 mediabunny 打開錄影檔，提供逐格解碼、整段音訊、縮圖、波形
import { Input, BlobSource, ALL_FORMATS, VideoSampleSink, AudioBufferSink } from '../vendor/mediabunny.min.mjs';
import { Store } from './project.js';

// 一個可以邊播邊解碼的影片軌
export class VideoReader {
  constructor(track) {
    this.track = track;
    this.sink = new VideoSampleSink(track);
    this.cur = null;
    this.queue = [];
    this.iter = null;
    this.gen = 0;
    this.pumping = false;
    this.ended = false;
  }
  _setCur(s) { if (this.cur && this.cur !== s) this.cur.close(); this.cur = s; }
  // 停在某個時間點（拖曳時間軸用）
  async seek(t) {
    this.stop();
    const g = this.gen;
    const s = await this.sink.getSample(Math.max(0, t));
    if (g !== this.gen) { s?.close(); return this.cur; }
    if (s) this._setCur(s);
    return this.cur;
  }
  // 從 t 開始連續解碼（播放用）
  play(t) {
    this.stop();
    this.iter = this.sink.samples(Math.max(0, t));
    this.ended = false;
    this._pump();
  }
  stop() {
    this.gen++;
    if (this.iter) { this.iter.return?.(); this.iter = null; }
    for (const s of this.queue) s.close();
    this.queue = [];
  }
  async _pump() {
    if (this.pumping || !this.iter) return;
    this.pumping = true;
    const g = this.gen, it = this.iter;
    try {
      while (g === this.gen && this.queue.length < 4) {
        const r = await it.next();
        if (g !== this.gen) { r.value?.close(); break; }
        if (r.done) { this.ended = true; break; }
        this.queue.push(r.value);
      }
    } catch (e) { console.warn('decode', e); }
    this.pumping = false;
  }
  // 每一格畫面呼叫：把時間 ≤ t 的畫面取出來當作目前畫面
  update(t) {
    while (this.queue.length && this.queue[0].timestamp <= t + 0.001) this._setCur(this.queue.shift());
    if (this.queue.length < 4 && !this.ended) this._pump();
    return this.cur;
  }
  // 播放時判斷是否落後太多（跳過剪掉的段落時需要重新定位）
  needsRestart(t) {
    const tail = this.queue.length ? this.queue[this.queue.length - 1] : this.cur;
    if (!this.iter) return true;
    if (!tail) return false;
    return t < (this.cur?.timestamp ?? 0) - 0.05 || t > tail.timestamp + 1.0;
  }
  dispose() { this.stop(); this._setCur(null); }
}

// 一個專案用到的所有媒體
export class MediaSet {
  constructor() { this.inputs = new Map(); this.video = {}; this.audio = {}; this.buffers = {}; this.images = new Map(); }

  static async open(project) {
    const m = new MediaSet();
    await m._open(project);
    return m;
  }

  async _input(key) {
    if (!this.inputs.has(key)) {
      const blob = await Store.getBlob(key);
      if (!blob) throw new Error('media-missing');
      this.inputs.set(key, new Input({ source: new BlobSource(blob), formats: ALL_FORMATS }));
    }
    return this.inputs.get(key);
  }

  async _open(p) {
    const vSrc = { screen: p.sources.screen, camera: p.sources.camera };
    for (const [name, s] of Object.entries(vSrc)) {
      if (!s?.blobKey) continue;
      const inp = await this._input(s.blobKey);
      const tracks = await inp.getVideoTracks();
      const tr = tracks[s.track || 0];
      if (tr) this.video[name] = tr;
    }
    if (!this.video.screen) throw new Error('no-video');
    const tr = this.video.screen;
    this.width = await tr.getDisplayWidth();
    this.height = await tr.getDisplayHeight();
    this.duration = await tr.computeDuration();
    for (const name of ['mic', 'sys']) {
      const s = p.sources[name];
      if (!s?.blobKey) continue;
      const inp = await this._input(s.blobKey);
      const tracks = await inp.getAudioTracks();
      const at = tracks[s.track || 0];
      if (at) this.audio[name] = at;
    }
  }

  reader(name) { return this.video[name] ? new VideoReader(this.video[name]) : null; }

  // 把整條音訊軌解碼成一個 AudioBuffer（播放、匯出、字幕、波形都用它）
  async decodeAudio(name, onProgress) {
    if (this.buffers[name]) return this.buffers[name];
    const tr = this.audio[name];
    if (!tr) return null;
    const out = await decodeTrack(tr, onProgress);
    if (out) this.buffers[name] = out;
    return out;
  }

  // ---- 多軌片段的媒體（影片 2、匯入的音樂、錄音）----
  async clip(key) {
    this.clips ||= new Map();
    if (!this.clips.has(key)) this.clips.set(key, (async () => {
      const inp = await this._input(key);
      const v = await inp.getPrimaryVideoTrack().catch(() => null), a = await inp.getPrimaryAudioTrack().catch(() => null);
      return { v, a, dur: await inp.computeDuration(), w: v ? await v.getDisplayWidth() : 0, h: v ? await v.getDisplayHeight() : 0 };
    })());
    return this.clips.get(key);
  }
  async clipAudio(key) {
    this.clipBufs ||= new Map();
    if (!this.clipBufs.has(key)) this.clipBufs.set(key, (async () => { const c = await this.clip(key); return c.a ? decodeTrack(c.a) : null; })().catch(() => null));
    return this.clipBufs.get(key);
  }

  // 時間軸縮圖
  async thumbnails(count, height = 48) {
    const tr = this.video.screen;
    const sink = new VideoSampleSink(tr);
    const w = Math.round(height * this.width / this.height);
    const times = Array.from({ length: count }, (_, i) => (i + 0.5) * this.duration / count);
    const out = [];
    for await (const s of sink.samplesAtTimestamps(times)) {
      const c = document.createElement('canvas');
      c.width = w; c.height = height;
      if (s) { s.draw(c.getContext('2d'), 0, 0, w, height); s.close(); }
      out.push(c);
    }
    return out;
  }

  async image(key) {
    if (!key) return null;
    if (!this.images.has(key)) {
      this.images.set(key, Store.getBlob(key).then(b => (b ? createImageBitmap(b) : null)).catch(() => null));
    }
    return this.images.get(key);
  }

  dispose() {
    for (const i of this.inputs.values()) try { i.dispose?.(); } catch { }
    this.inputs.clear();
  }
}

// 把一條音訊軌解碼成一個 AudioBuffer
export async function decodeTrack(tr, onProgress) {
  const sink = new AudioBufferSink(tr);
  const parts = [];
  let sr = 48000, ch = 1, end = 0;
  for await (const w of sink.buffers()) {
    parts.push(w);
    sr = w.buffer.sampleRate; ch = Math.max(ch, w.buffer.numberOfChannels);
    end = Math.max(end, w.timestamp + w.duration);
    if (onProgress && parts.length % 50 === 0) onProgress(end);
  }
  if (!parts.length) return null;
  const len = Math.ceil(end * sr) + 1;
  const out = new AudioBuffer({ length: len, numberOfChannels: Math.min(ch, 2), sampleRate: sr });
  for (const w of parts) {
    const off = Math.max(0, Math.round(w.timestamp * sr));
    for (let c = 0; c < out.numberOfChannels; c++) {
      const src = w.buffer.getChannelData(Math.min(c, w.buffer.numberOfChannels - 1));
      const n = Math.min(src.length, len - off);
      if (n > 0) out.getChannelData(c).set(n === src.length ? src : src.subarray(0, n), off);
    }
  }
  return out;
}

// 波形：每 binSec 秒取最大振幅（0..1）
export function computePeaks(buffers, duration, binSec = 0.02) {
  const bins = Math.max(1, Math.ceil(duration / binSec));
  const peaks = new Float32Array(bins);
  for (const buf of buffers) {
    if (!buf) continue;
    const sr = buf.sampleRate, per = Math.max(1, Math.floor(sr * binSec));
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      for (let b = 0; b < bins; b++) {
        let m = 0;
        const s0 = b * per, s1 = Math.min(d.length, s0 + per);
        for (let i = s0; i < s1; i += 4) { const v = Math.abs(d[i]); if (v > m) m = v; }
        if (m > peaks[b]) peaks[b] = m;
      }
    }
  }
  let mx = 0.0001;
  for (const v of peaks) if (v > mx) mx = v;
  const k = Math.min(1 / mx, 6);
  for (let i = 0; i < bins; i++) peaks[i] = Math.min(1, peaks[i] * k);
  return peaks;
}
