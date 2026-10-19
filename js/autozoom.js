// 自動縮放
//  1. 有游標軌跡（桌面版）：依照「點擊」與「游標停留」產生縮放，並跟隨游標移動
//  2. 沒有游標（網頁版／匯入影片）：分析畫面變化的位置，在有東西動的地方放大
import { VideoSampleSink } from '../vendor/mediabunny.min.mjs';
import { uid, clamp } from './util.js';

export function zoomFromCursor(cursor, duration, crop, opts = {}) {
  const depth = opts.depth || 2, gap = 2.2;
  const pts = cursor.clicks.map(c => ({ t: c.t, x: (c.x - crop.x) / crop.w, y: (c.y - crop.y) / crop.h }))
    .filter(p => p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1);
  // 沒有點擊時，用游標停留超過 1.2 秒的位置
  if (pts.length < 2) {
    const tr = cursor.track;
    let still = 0;
    for (let i = 1; i < tr.n; i++) {
      const moved = Math.hypot(tr.xs[i] - tr.xs[i - 1], tr.ys[i] - tr.ys[i - 1]) > 0.002;
      still = moved ? 0 : still + 1 / tr.hz;
      if (still > 1.2 && (!pts.length || i / tr.hz - pts[pts.length - 1].t > 3)) pts.push({ t: i / tr.hz - 1, x: (tr.xs[i] - crop.x) / crop.w, y: (tr.ys[i] - crop.y) / crop.h });
    }
  }
  const groups = [];
  for (const p of pts) {
    const g = groups[groups.length - 1];
    if (g && p.t - g.end < gap) { g.end = p.t; g.pts.push(p); } else groups.push({ start: p.t, end: p.t, pts: [p] });
  }
  return groups.map(g => {
    const x = g.pts.reduce((a, p) => a + p.x, 0) / g.pts.length, y = g.pts.reduce((a, p) => a + p.y, 0) / g.pts.length;
    return {
      id: uid(), start: clamp(g.start - 0.8, 0, duration), end: clamp(g.end + 1.6, 0, duration),
      depth, x, y, follow: true, ease: 'smooth', transition: 0.7, transitionOut: 1.2, auto: true,
    };
  }).filter(z => z.end - z.start > 1);
}

// 畫面變化分析：每 0.25 秒取一張 96 寬的小圖，比較前後差異，找出變化集中的區域
export async function zoomFromMotion(videoTrack, duration, crop, onProgress, opts = {}) {
  const depth = opts.depth || 1.8, step = 0.25;
  const W = 96, H = Math.max(2, Math.round(96 * (await videoTrack.getDisplayHeight()) / (await videoTrack.getDisplayWidth())));
  const c = new OffscreenCanvas(W, H), ctx = c.getContext('2d', { willReadFrequently: true });
  const sink = new VideoSampleSink(videoTrack);
  const times = [];
  for (let t = 0; t < duration; t += step) times.push(t);
  let prev = null;
  const acts = [];
  let i = 0;
  for await (const s of sink.samplesAtTimestamps(times)) {
    const t = times[i++];
    if (!s) continue;
    s.draw(ctx, 0, 0, W, H); s.close();
    const d = ctx.getImageData(0, 0, W, H).data;
    const g = new Uint8Array(W * H);
    for (let k = 0; k < g.length; k++) g[k] = (d[k * 4] * 3 + d[k * 4 + 1] * 6 + d[k * 4 + 2]) / 10;
    if (prev) {
      let n = 0, sx = 0, sy = 0, x0 = W, y0 = H, x1 = 0, y1 = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (Math.abs(g[y * W + x] - prev[y * W + x]) > 24) { n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      }
      const area = n / (W * H);
      if (n > 3 && area < 0.25) {
        const bw = (x1 - x0 + 1) / W, bh = (y1 - y0 + 1) / H;
        acts.push({ t, x: sx / n / W, y: sy / n / H, size: Math.max(bw, bh) });
      }
    }
    prev = g;
    if (i % 20 === 0) { onProgress?.(t / duration); await new Promise(r => setTimeout(r)); }
  }
  // 連續的小範圍變化 → 一段縮放
  const groups = [];
  for (const a of acts) {
    if (a.size > 0.55) continue;
    const g = groups[groups.length - 1];
    if (g && a.t - g.end < 1.2 && Math.hypot(a.x - g.x, a.y - g.y) < 0.3) {
      g.end = a.t; g.n++; g.x += (a.x - g.x) / g.n; g.y += (a.y - g.y) / g.n;
    } else groups.push({ start: a.t, end: a.t, x: a.x, y: a.y, n: 1 });
  }
  const toCrop = (x, y) => ({ x: clamp((x - crop.x) / crop.w, 0, 1), y: clamp((y - crop.y) / crop.h, 0, 1) });
  return groups.filter(g => g.n >= 3 && g.end - g.start >= 0.75).map(g => {
    const p = toCrop(g.x, g.y);
    return { id: uid(), start: clamp(g.start - 0.6, 0, duration), end: clamp(g.end + 1.2, 0, duration), depth, x: p.x, y: p.y, follow: false, ease: 'smooth', transition: 0.7, transitionOut: 1.2, auto: true };
  });
}

// 合併重疊的縮放段落
export function mergeZooms(list) {
  const s = [...list].sort((a, b) => a.start - b.start), out = [];
  for (const z of s) {
    const last = out[out.length - 1];
    if (last && z.start < last.end) { last.end = Math.max(last.end, z.end); }
    else out.push(z);
  }
  return out;
}
