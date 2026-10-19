// 素材庫的共用小工具：配樂快取、配樂排程
import { MUSIC_LIST, renderMusicBuffer } from './library.js';

const musicCache = new Map();
export const musicInfo = id => MUSIC_LIST.find(m => m.id === id) || null;

// 取得配樂的 AudioBuffer（第一次需要數秒合成，之後用快取）
export function getMusicBuffer(id) {
  if (!musicCache.has(id)) {
    const m = musicInfo(id);
    if (!m) return Promise.resolve(null);
    musicCache.set(id, renderMusicBuffer(m.plan).catch(e => { musicCache.delete(id); throw e; }));
  }
  return musicCache.get(id);
}
export const musicReady = id => musicCache.has(id);

// 多軌片段（影片 2 的聲音、音樂軌、錄音軌）：在輸出時間 [o0, o1) 播放，從片段的 offset 開始；可循環、淡入淡出
export function scheduleClip(ctx, dest, buffer, c, o0, o1, fromOut = 0, when = 0) {
  if (!buffer || fromOut >= o1 || o1 - o0 < 0.02) return { stop() { } };
  const start = Math.max(fromOut, o0), at = when + (start - fromOut), dur = o1 - start;
  const offset = (c.offset || 0) + (start - o0);
  if (!c.loop && offset >= buffer.duration) return { stop() { } };
  const vol = c.mute ? 0 : (c.volume ?? 1), fi = c.fadeIn || 0, fo = c.fadeOut || 0;
  const base = when - fromOut;   // 輸出時間 0 的 AudioContext 時間
  const g = ctx.createGain();
  const valueAt = o => vol * Math.min(1, fi > 0 ? (o - o0) / fi : 1, fo > 0 ? (o1 - o) / fo : 1);
  g.gain.setValueAtTime(Math.max(0, valueAt(start)), at);
  if (fi > 0 && start < o0 + fi) g.gain.linearRampToValueAtTime(vol, base + o0 + fi);
  if (fo > 0) { if (base + o1 - fo > at) g.gain.setValueAtTime(vol, base + o1 - fo); g.gain.linearRampToValueAtTime(0, base + o1); }
  g.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(g);
  if (c.loop) { src.loop = true; src.start(at, offset % buffer.duration); src.stop(at + dur); }
  else src.start(at, offset, Math.min(dur, buffer.duration - offset));
  return { stop() { try { src.stop(); } catch { } g.disconnect(); } };
}

// 背景配樂：從輸出時間 fromOut 開始，循環播放到影片結尾，開頭淡入、結尾淡出
// when：fromOut 這一刻在 AudioContext 裡的時間
export function scheduleMusic(ctx, dest, buffer, cfg, total, fromOut = 0, when = 0) {
  if (!buffer || fromOut >= total) return { stop() { } };
  const vol = cfg.volume ?? 0.35, fi = Math.max(0, cfg.fadeIn ?? 1), fo = Math.max(0, cfg.fadeOut ?? 2);
  const base = when - fromOut;   // 輸出時間 0 對應的 AudioContext 時間
  const g = ctx.createGain();
  const valueAt = o => vol * Math.min(1, fi > 0 ? o / fi : 1, fo > 0 ? (total - o) / fo : 1);
  g.gain.setValueAtTime(Math.max(0, valueAt(fromOut)), when);
  if (fromOut < fi) g.gain.linearRampToValueAtTime(vol, base + fi);
  if (fo > 0 && base + total - fo > when) g.gain.setValueAtTime(vol, base + total - fo);
  g.gain.linearRampToValueAtTime(0, base + total);
  g.connect(dest);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  src.connect(g);
  src.start(when, fromOut % buffer.duration);
  src.stop(base + total + 0.05);
  return { stop() { try { src.stop(); } catch { } g.disconnect(); } };
}
