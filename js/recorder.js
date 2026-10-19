// 錄影：螢幕／視窗（getDisplayMedia）、麥克風、系統音訊、網路攝影機
// 所有軌道寫進同一個 MP4（mediabunny），時間完全同步。
// 麥克風經過 Web Audio 混音器：錄影中可以隨時「開／關」或「換一支麥克風」，錄影不中斷。
import {
  Output, Mp4OutputFormat, StreamTarget, MediaStreamVideoTrackSource, MediaStreamAudioTrackSource,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec, canEncodeVideo,
} from '../vendor/mediabunny.min.mjs';
import { Emitter } from './util.js';

export const RecorderSupport = {
  display: !!navigator.mediaDevices?.getDisplayMedia,
  media: !!navigator.mediaDevices?.getUserMedia,
  webcodecs: typeof VideoEncoder !== 'undefined' && typeof AudioEncoder !== 'undefined',
};

export async function listDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      mics: all.filter(d => d.kind === 'audioinput'),
      cams: all.filter(d => d.kind === 'videoinput'),
    };
  } catch { return { mics: [], cams: [] }; }
}

// 第一次列裝置時瀏覽器不給名稱：先要一次權限
export async function unlockDeviceLabels(kind) {
  try {
    const s = await navigator.mediaDevices.getUserMedia(kind === 'video' ? { video: true } : { audio: true });
    s.getTracks().forEach(t => t.stop());
    return true;
  } catch { return false; }
}

// 麥克風混音器：輸出一條固定的音軌給錄影，輸入端可以隨時換裝置或靜音
export class MicMixer extends Emitter {
  constructor() {
    super();
    this.ctx = new AudioContext({ sampleRate: 48000 });
    this.gain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.dest = this.ctx.createMediaStreamDestination();
    this.gain.connect(this.dest);
    this.gain.connect(this.analyser);
    this.src = null;
    this.stream = null;
    this.deviceId = '';
    this.enabled = true;
    this._buf = new Float32Array(512);
  }
  get track() { return this.dest.stream.getAudioTracks()[0]; }
  async setDevice(deviceId) {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { deviceId: deviceId ? { exact: deviceId } : undefined, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    const old = this.stream, oldSrc = this.src;
    this.stream = stream;
    this.src = this.ctx.createMediaStreamSource(stream);
    this.src.connect(this.gain);
    oldSrc?.disconnect();
    old?.getTracks().forEach(t => t.stop());
    this.deviceId = stream.getAudioTracks()[0]?.getSettings().deviceId || deviceId || '';
    this.label = stream.getAudioTracks()[0]?.label || '';
    stream.getAudioTracks()[0]?.addEventListener('ended', () => this.emit('lost'));
    this.emit('change');
  }
  setEnabled(on) {
    this.enabled = on;
    this.gain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.02);
    this.emit('change');
  }
  level() {
    this.analyser.getFloatTimeDomainData(this._buf);
    let m = 0;
    for (const v of this._buf) m = Math.max(m, Math.abs(v));
    return this.enabled ? m : 0;
  }
  close() {
    this.stream?.getTracks().forEach(t => t.stop());
    this.track?.stop();
    this.ctx.close().catch(() => { });
  }
}

function pickBitrate(w, h, fps) {
  return Math.round(Math.min(40e6, Math.max(3e6, w * h * fps * 0.12)));
}

// 一次錄影
export class Recording extends Emitter {
  constructor(opts) {
    super();
    this.opts = opts; // { fps, systemAudio, mic:{on,deviceId}, camera:{on,deviceId}, surface, display? }
    this.state = 'idle';
    this.parts = [];
    this.tracks = {};
    this.elapsed = 0;
    this._t0 = 0;
    this._pausedAt = 0;
  }

  // 第 1 步：要求畫面分享與裝置權限（必須在使用者點擊之後呼叫）
  async acquire() {
    const o = this.opts;
    if (o.noScreen) {
      this.display = null; // 桌面版原生錄製：螢幕與系統音訊由 Python 錄，這裡只錄麥克風／攝影機
    } else if (o.display) {
      this.display = o.display;
    } else if (o.cameraOnly) {
      // 手機／平板：瀏覽器不能錄螢幕，改成以攝影機為主畫面錄影（可切換前後鏡頭）
      this.display = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: o.camera?.deviceId ? { exact: o.camera.deviceId } : undefined, facingMode: o.camera?.deviceId ? undefined : (o.facing || 'user'), width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: o.fps } },
      });
      o.camera = { on: false };
    } else {
      this.display = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: o.fps, max: o.fps }, width: { ideal: 3840 }, height: { ideal: 2160 }, displaySurface: o.surface || 'monitor', cursor: 'always' },
        audio: o.systemAudio ? { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false } : false,
        systemAudio: o.systemAudio ? 'include' : 'exclude',
        selfBrowserSurface: 'exclude',
        surfaceSwitching: 'include',
        monitorTypeSurfaces: 'include',
      });
    }
    const vt = this.display?.getVideoTracks()[0];
    if (vt) {
      vt.addEventListener('ended', () => { if (this.state === 'recording' || this.state === 'paused') this.stop(); });
      this.tracks.screen = vt;
      const st = vt.getSettings();
      this.width = st.width; this.height = st.height;
      this.surface = st.displaySurface || o.surface;
    }
    const sys = this.display?.getAudioTracks()[0];
    if (sys) this.tracks.sys = sys;
    // 麥克風一律建立混音器，就算一開始關閉，錄影中也能隨時打開
    if (o.mic?.on !== undefined && RecorderSupport.media) {
      this.mic = new MicMixer();
      try { await this.mic.setDevice(o.mic.deviceId); this.mic.setEnabled(!!o.mic.on); }
      catch (e) { this.micError = e; this.mic.setEnabled(false); }
      this.tracks.mic = this.mic.track;
    }
    if (o.camera?.on) {
      this.camStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: o.camera.deviceId ? { exact: o.camera.deviceId } : undefined, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
      });
      this.tracks.camera = this.camStream.getVideoTracks()[0];
    }
    return this;
  }

  // 第 2 步：開始寫入 MP4
  async start() {
    const fmt = new Mp4OutputFormat({ fastStart: 'fragmented', minimumFragmentDuration: 1 });
    const parts = this.parts;
    const writable = new WritableStream({ write: chunk => { parts.push(chunk.data.slice()); } });
    this.output = new Output({ format: fmt, target: new StreamTarget(writable) });
    this.layout = {}; // 每個來源在 MP4 裡是第幾條影片/音訊軌
    let vi = 0, ai = 0;
    this.sources = [];
    const fps = this.opts.fps || 30;
    if (this.tracks.screen) {
      const w = this.width || 1920, h = this.height || 1080;
      const codec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1', 'vp8'], { width: w, height: h }) || 'avc';
      const src = new MediaStreamVideoTrackSource(this.tracks.screen, { codec, bitrate: pickBitrate(w, h, fps), keyFrameInterval: 1, sizeChangeBehavior: 'contain' }, { frameRate: fps });
      this.output.addVideoTrack(src, { name: 'screen', frameRate: fps });
      this.sources.push(src); this.layout.screen = vi++;
    }
    if (this.tracks.camera) {
      const codec = (await canEncodeVideo('avc', { width: 1280, height: 720 })) ? 'avc' : 'vp9';
      const src = new MediaStreamVideoTrackSource(this.tracks.camera, { codec, bitrate: 3e6, keyFrameInterval: 1, sizeChangeBehavior: 'contain' }, { frameRate: 30 });
      this.output.addVideoTrack(src, { name: 'camera', frameRate: 30 });
      this.sources.push(src); this.layout.camera = vi++;
    }
    const acodec = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000 }) || 'opus';
    for (const name of ['mic', 'sys']) {
      if (!this.tracks[name]) continue;
      const src = new MediaStreamAudioTrackSource(this.tracks[name], { codec: acodec, bitrate: 160e3 });
      this.output.addAudioTrack(src, { name });
      this.sources.push(src); this.layout[name] = ai++;
    }
    if (!this.sources.length) throw new Error('nothing-to-record');
    this.sources.forEach(s => s.errorPromise?.catch(e => { this.error = e; this.emit('error', e); this.stop(); }));
    await this.output.start();
    this.state = 'recording';
    this._t0 = performance.now();
    this.emit('state', this.state);
  }

  get time() {
    if (this.state === 'recording') return this.elapsed + (performance.now() - this._t0) / 1000;
    return this.elapsed;
  }

  pause() {
    if (this.state !== 'recording') return;
    this.elapsed += (performance.now() - this._t0) / 1000;
    this.sources.forEach(s => s.pause());
    this.state = 'paused';
    this.emit('state', this.state);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.sources.forEach(s => s.resume());
    this._t0 = performance.now();
    this.state = 'recording';
    this.emit('state', this.state);
  }

  async stop() {
    if (this.state !== 'recording' && this.state !== 'paused') return this.result;
    if (this.state === 'recording') this.elapsed += (performance.now() - this._t0) / 1000;
    this.state = 'stopping';
    this.emit('state', this.state);
    try { await this.output.finalize(); } catch (e) { console.error(e); this.error ||= e; }
    this._release();
    const blob = new Blob(this.parts, { type: 'video/mp4' });
    this.parts.length = 0;
    this.result = { blob, layout: this.layout || {}, width: this.width, height: this.height, duration: this.elapsed, surface: this.surface };
    this.state = 'done';
    this.emit('state', this.state);
    this.emit('done', this.result);
    return this.result;
  }

  async cancel() {
    this.state = 'canceled';
    try { await this.output?.cancel(); } catch { }
    this._release();
    this.emit('state', this.state);
  }

  _release() {
    this.display?.getTracks().forEach(t => t.stop());
    this.camStream?.getTracks().forEach(t => t.stop());
    this.mic?.close();
  }
}
