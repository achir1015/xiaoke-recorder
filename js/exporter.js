// 匯出：MP4（WebCodecs 編碼，比即時快很多）或 GIF
import {
  Output, Mp4OutputFormat, BufferTarget, CanvasSource, AudioBufferSource, VideoSampleSink,
  getFirstEncodableVideoCodec, getFirstEncodableAudioCodec,
} from '../vendor/mediabunny.min.mjs';
import { GIFEncoder, quantize, applyPalette } from '../vendor/gifenc.esm.js';
import { buildSegments, outputDuration, outToSrc, buildTimeline, partAt } from './project.js';
import { render, outputSize, renderTemplate } from './compositor.js';
import { getMusicBuffer, scheduleMusic } from './assets.js';

// 把一個 AudioBuffer 依照剪輯片段排進 AudioContext（預覽與匯出共用）
export function scheduleAudio(ctx, dest, buffer, gain, segs, fromOut = 0, when = 0) {
  const g = ctx.createGain();
  g.gain.value = gain;
  g.connect(dest);
  const nodes = [];
  for (const s of segs) {
    if (s.o1 <= fromOut) continue;
    const skip = Math.max(0, fromOut - s.o0);
    const off = s.s0 + skip * s.rate;
    const len = s.s1 - off;
    if (len <= 0.001 || off >= buffer.duration) continue;
    const n = ctx.createBufferSource();
    n.buffer = buffer;
    n.playbackRate.value = s.rate;
    n.connect(g);
    n.start(when + Math.max(0, s.o0 - fromOut), off, Math.min(len, buffer.duration - off));
    nodes.push(n);
  }
  return { gain: g, nodes, stop() { nodes.forEach(n => { try { n.stop(); } catch { } }); g.disconnect(); } };
}

// 混音：錄影聲音（套用剪掉、變速、音量，接在片頭之後）＋背景配樂（整支影片循環）
export async function mixAudio(project, media, tl) {
  const a = project.edit.audio, dur = tl.total;
  const list = [];
  for (const name of ['mic', 'sys']) {
    if (a[name + 'Mute'] || !media.audio[name]) continue;
    const buf = await media.decodeAudio(name);
    if (buf) list.push([buf, a[name]]);
  }
  const music = project.edit.music ? await getMusicBuffer(project.edit.music.id).catch(() => null) : null;
  if ((!list.length && !music) || dur <= 0) return null;
  const sr = 48000;
  const off = new OfflineAudioContext(2, Math.ceil(dur * sr) + 1, sr);
  for (const [buf, gain] of list) scheduleAudio(off, off.destination, buf, gain, tl.segs, 0, tl.introD);
  if (music) scheduleMusic(off, off.destination, music, project.edit.music, dur, 0, 0);
  return off.startRendering();
}

function sliceBuffer(buf, start, len) {
  const out = new AudioBuffer({ length: len, numberOfChannels: buf.numberOfChannels, sampleRate: buf.sampleRate });
  for (let c = 0; c < buf.numberOfChannels; c++) out.copyToChannel(buf.getChannelData(c).subarray(start, start + len), c);
  return out;
}

const QUALITY_BPP = { low: 0.05, medium: 0.09, high: 0.15, max: 0.25 };

// opts: { format:'mp4'|'gif', height, fps, quality, gifWidth }
export async function exportVideo(project, media, assets, opts, onProgress, signal) {
  const tl = buildTimeline(project.edit, project.duration);
  const dur = tl.total;
  if (dur <= 0) throw new Error('empty');
  const fps = opts.fps;
  let { W, H } = outputSize(project, opts.height);
  if (opts.format === 'gif') { const k = opts.gifWidth / Math.max(W, H); W = Math.round(W * k) & ~1; H = Math.round(H * k) & ~1; }
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { alpha: false });
  const N = Math.max(1, Math.ceil(dur * fps));
  // 每一格屬於片頭、錄影或片尾；只有錄影的格子需要解碼影片
  const parts = Array.from({ length: N }, (_, i) => partAt(tl, i / fps));
  const times = parts.filter(p => p.kind === 'rec').map(p => p.src);
  const iters = {};
  for (const name of ['screen', 'camera']) {
    if (!media.video[name]) continue;
    if (name === 'camera' && !project.edit.camera.show) continue;
    iters[name] = new VideoSampleSink(media.video[name]).samplesAtTimestamps(times);
  }
  const st = { project, cursor: assets.cursor, images: assets.images, bgImage: assets.bgImage, preview: false };
  const ed = project.edit;
  // 畫第 i 格：片頭／片尾用範本，錄影用合成器
  const frame = async i => {
    const p = parts[i];
    if (p.kind !== 'rec') { renderTemplate(ctx, W, H, p.kind === 'intro' ? ed.intro : ed.outro, p.lt); return; }
    await nextFrames();
    render(ctx, W, H, p.src, { ...st, screen: cur.screen, camera: cur.camera, ot: i / fps });
  };
  const cur = {};
  const nextFrames = async () => {
    for (const [name, it] of Object.entries(iters)) {
      const r = await it.next();
      if (r.value) { cur[name]?.close(); cur[name] = r.value; }
    }
  };
  const cleanup = () => { for (const it of Object.values(iters)) it.return?.(); for (const s of Object.values(cur)) s?.close(); };

  try {
    if (opts.format === 'gif') {
      const gif = GIFEncoder();
      const delay = Math.round(1000 / fps);
      for (let i = 0; i < N; i++) {
        if (signal?.aborted) throw new DOMException('abort', 'AbortError');
        await frame(i);
        const { data } = ctx.getImageData(0, 0, W, H);
        const palette = quantize(data, 256, { format: 'rgb565' });
        gif.writeFrame(applyPalette(data, palette, 'rgb565'), W, H, { palette, delay });
        onProgress?.((i + 1) / N);
        if (i % 4 === 0) await new Promise(r => setTimeout(r));
      }
      gif.finish();
      return { blob: new Blob([gif.bytes()], { type: 'image/gif' }), ext: 'gif', W, H, dur };
    }

    const vcodec = await getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
    if (!vcodec) throw new Error('no-encoder');
    const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const vsrc = new CanvasSource(canvas, { codec: vcodec, bitrate: Math.round(W * H * fps * (QUALITY_BPP[opts.quality] || 0.12)), keyFrameInterval: 2 });
    output.addVideoTrack(vsrc, { frameRate: fps });
    onProgress?.(0, 'audio');
    const mixed = await mixAudio(project, media, tl);
    let asrc = null;
    if (mixed) {
      const acodec = await getFirstEncodableAudioCodec(['aac', 'opus'], { numberOfChannels: 2, sampleRate: 48000 });
      if (acodec) { asrc = new AudioBufferSource({ codec: acodec, bitrate: 192e3 }); output.addAudioTrack(asrc); }
    }
    await output.start();
    if (asrc) {
      const step = mixed.sampleRate * 5;
      for (let s = 0; s < mixed.length; s += step) await asrc.add(sliceBuffer(mixed, s, Math.min(step, mixed.length - s)));
      asrc.close();
    }
    for (let i = 0; i < N; i++) {
      if (signal?.aborted) { await output.cancel(); throw new DOMException('abort', 'AbortError'); }
      await frame(i);
      await vsrc.add(i / fps, 1 / fps);
      onProgress?.((i + 1) / N);
    }
    vsrc.close();
    await output.finalize();
    return { blob: new Blob([output.target.buffer], { type: 'video/mp4' }), ext: 'mp4', W, H, dur, codec: vcodec };
  } finally { cleanup(); }
}

// ---- MP3：聲音檔一律用 MP3（瀏覽器不能直接編 MP3，用 LAME 編碼器的 WebAssembly 版本）----
let mp3Ready = null;
async function ensureMp3() {
  mp3Ready ||= (async () => {
    const mb = await import('../vendor/mediabunny.min.mjs');
    if (!(await mb.canEncodeAudio('mp3'))) {
      const { registerMp3Encoder } = await import('../vendor/mediabunny-mp3-encoder.min.mjs');
      registerMp3Encoder();
    }
    return mb;
  })();
  return mp3Ready;
}

export async function audioBufferToMp3(buf, onProgress, signal) {
  const mb = await ensureMp3();
  const output = new Output({ format: new mb.Mp3OutputFormat(), target: new BufferTarget() });
  const src = new AudioBufferSource({ codec: 'mp3', bitrate: 192e3 });
  output.addAudioTrack(src);
  await output.start();
  const step = buf.sampleRate * 5;
  for (let s = 0; s < buf.length; s += step) {
    if (signal?.aborted) { await output.cancel(); throw new DOMException('abort', 'AbortError'); }
    await src.add(sliceBuffer(buf, s, Math.min(step, buf.length - s)));
    onProgress?.(Math.min(1, (s + step) / buf.length));
  }
  src.close();
  await output.finalize();
  return new Blob([output.target.buffer], { type: 'audio/mpeg' });
}

// 匯出剪輯後（套用剪掉、變速、音量）的混音成 MP3
export async function exportMp3(project, media, onProgress, signal) {
  const tl = buildTimeline(project.edit, project.duration);
  const dur = tl.total;
  onProgress?.(0, 'audio');
  const mixed = await mixAudio(project, media, tl);
  if (!mixed) throw new Error('no-audio');
  const blob = await audioBufferToMp3(mixed, onProgress, signal);
  return { blob, ext: 'mp3', dur, W: 0, H: 0 };
}

// 原始錄影另存成一般 MP4（錄影時是分段式 MP4，這裡重新封裝成相容性最好的格式）
export async function remuxToMp4(blob) {
  const { Input, BlobSource, ALL_FORMATS, Conversion } = await import('../vendor/mediabunny.min.mjs');
  const input = new Input({ source: new BlobSource(blob), formats: ALL_FORMATS });
  const output = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
  const conv = await Conversion.init({ input, output });
  await conv.execute();
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}
