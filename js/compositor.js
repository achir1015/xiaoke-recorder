// 畫面合成：背景 → 圓角影片（含縮放、動態模糊、裁切）→ 模糊區 → 游標 → 註解 → 攝影機 → 字幕
// 預覽和匯出都呼叫同一個 render()，保證「看到的就是匯出的」。
import { clamp, lerp, ease, roundRectPath } from './util.js';
import { drawCursor, drawClickEffect } from './cursor.js';
import * as LIB from './library.js';

// ---- 素材庫（小柯影音剪輯助手）的快取 ----
const stickerCache = new Map();
export function stickerCanvas(i) {
  if (!stickerCache.has(i)) {
    const def = LIB.STK[i];
    if (!def) return null;
    const [, fn, size] = def, [w, h] = size || [512, 512];
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    try { fn(c.getContext('2d')); } catch { }
    stickerCache.set(i, c);
  }
  return stickerCache.get(i);
}
const fxCanvas = document.createElement('canvas');
// 動態特效（綠幕素材）：直接畫在透明畫布上，不需要去背
function drawEffect(ctx, a, t, x, y, w, h) {
  const fx = LIB.GSCR[a.gs];
  if (!fx || w < 2 || h < 2) return;
  const k = Math.min(1, 1280 / Math.max(w, h)), cw = Math.max(2, Math.round(w * k)), ch = Math.max(2, Math.round(h * k));
  if (fxCanvas.width !== cw || fxCanvas.height !== ch) { fxCanvas.width = cw; fxCanvas.height = ch; }
  const g = fxCanvas.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, cw, ch);
  try { fx.fn({ g, W: cw, H: ch, t: Math.max(0, t - a.start), D: a.end - a.start }); } catch { }
  ctx.drawImage(fxCanvas, x, y, w, h);
}
// 3D 立體文字（影音剪輯助手的 6 種動畫）：以 (cx, cy) 為中心畫多行字
function draw3DText(ctx, lines, cx, cy, fs, d3, lt, font) {
  ctx.save();
  ctx.font = `900 ${fs}px ${font}`;
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const lh = fs * 1.3, total = lines.length * lh, widths = lines.map(l => ctx.measureText(l).width);
  const R = LIB.anim3D(d3, Math.max(0, lt), fs);
  ctx.translate(cx, cy + R.dy); ctx.rotate(R.rot); ctx.transform(R.sx * R.scale, 0, R.skew, R.sy * R.scale, 0, 0);
  let ci = 0;
  lines.forEach((ln, i) => {
    const y = -total / 2 + lh / 2 + i * lh, lx = -widths[i] / 2;
    if (R.perChar) { let x = lx; for (const ch of [...ln]) { const q = R.perChar(ci++); ctx.save(); ctx.globalAlpha *= q.alpha; LIB.glyph3D(ctx, ch, x, y + q.dy, fs, d3, R.ex, R.ey, q.depthK); ctx.restore(); x += ctx.measureText(ch).width; } }
    else LIB.glyph3D(ctx, ln, lx, y, fs, d3, R.ex, R.ey, R.depthK);
  });
  ctx.restore();
  return { w: Math.max(...widths, fs), h: total };
}
// 片頭／片尾畫面
export function renderTemplate(ctx, W, H, clip, lt) {
  const tpl = LIB.TPL[clip.id];
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, W, H);
  if (tpl) LIB.drawTemplate(ctx, W, H, lt, clip.dur, tpl, { title: clip.title, sub: clip.sub, accent: clip.accent });
  ctx.restore();
}

// ---- 桌布（程式產生，不需要下載圖片）----
export const WALLPAPERS = {
  aurora: { base: '#0b1026', blobs: [['#7f5af0', .2, .3, .7], ['#2cb67d', .8, .7, .7], ['#3da9fc', .6, .1, .5]] },
  sunset: { base: '#2b1055', blobs: [['#ff6b6b', .2, .8, .8], ['#feca57', .8, .9, .6], ['#c56cf0', .7, .2, .6]] },
  ocean: { base: '#03203c', blobs: [['#00b4d8', .3, .2, .7], ['#0077b6', .8, .8, .8], ['#90e0ef', .9, .1, .4]] },
  forest: { base: '#0b2016', blobs: [['#2d6a4f', .2, .3, .8], ['#95d5b2', .8, .2, .5], ['#40916c', .6, .9, .7]] },
  candy: { base: '#ffd6e8', blobs: [['#ff8fab', .2, .2, .6], ['#a2d2ff', .8, .8, .7], ['#cdb4db', .8, .2, .5]] },
  midnight: { base: '#05060a', blobs: [['#1f2a5a', .3, .3, .8], ['#3a0ca3', .8, .8, .6], ['#0b132b', .5, .5, .5]] },
  peach: { base: '#ffe5d9', blobs: [['#ffb5a7', .2, .7, .7], ['#fcd5ce', .8, .3, .6], ['#f8edeb', .5, .5, .4]] },
  mint: { base: '#e9fff7', blobs: [['#80ffdb', .2, .2, .6], ['#72efdd', .8, .8, .7], ['#caffbf', .8, .1, .5]] },
  lava: { base: '#1a0505', blobs: [['#d00000', .3, .8, .8], ['#ff7b00', .8, .3, .6], ['#370617', .1, .1, .6]] },
  grape: { base: '#1b0b2e', blobs: [['#9d4edd', .3, .4, .8], ['#e0aaff', .9, .8, .5], ['#5a189a', .7, .1, .6]] },
  sky: { base: '#cfe8ff', blobs: [['#7ec8ff', .2, .3, .7], ['#ffffff', .8, .2, .5], ['#a0c4ff', .7, .9, .7]] },
  dune: { base: '#3d2c1e', blobs: [['#dda15e', .2, .8, .8], ['#fefae0', .8, .2, .4], ['#bc6c25', .8, .8, .6]] },
  neon: { base: '#020212', blobs: [['#f72585', .2, .2, .6], ['#4cc9f0', .8, .8, .6], ['#7209b7', .5, .6, .5]] },
  rose: { base: '#3b0d1c', blobs: [['#ff4d6d', .3, .3, .7], ['#ffb3c1', .8, .7, .5], ['#800f2f', .6, .1, .6]] },
  steel: { base: '#1c2129', blobs: [['#5c677d', .2, .2, .7], ['#979dac', .8, .8, .5], ['#33415c', .6, .5, .6]] },
  mono: { base: '#d9d9d9', blobs: [['#ffffff', .3, .2, .7], ['#9e9e9e', .8, .9, .7]] },
};
export const GRADIENTS = [
  ['#7f5af0', '#2cb67d'], ['#ff6b6b', '#feca57'], ['#00b4d8', '#7209b7'], ['#f72585', '#4361ee'],
  ['#11998e', '#38ef7d'], ['#fc466b', '#3f5efb'], ['#141e30', '#243b55'], ['#ee9ca7', '#ffdde1'],
  ['#f12711', '#f5af19'], ['#8e2de2', '#4a00e0'], ['#000000', '#434343'], ['#a8edea', '#fed6e3'],
];
export const SOLIDS = ['#111317', '#1e2230', '#ffffff', '#f4f1ea', '#0f3d3e', '#3a0ca3', '#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c', '#8d99ae'];

function paintWallpaper(ctx, W, H, wp) {
  ctx.fillStyle = wp.base; ctx.fillRect(0, 0, W, H);
  const R = Math.max(W, H);
  for (const [c, x, y, r] of wp.blobs) {
    const g = ctx.createRadialGradient(x * W, y * H, 0, x * W, y * H, r * R);
    g.addColorStop(0, c); g.addColorStop(1, c + '00');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  // 細微雜訊，避免漸層色帶
  const n = ctx.createImageData(64, 64);
  for (let i = 0; i < n.data.length; i += 4) { const v = Math.random() * 255; n.data[i] = n.data[i + 1] = n.data[i + 2] = v; n.data[i + 3] = 8; }
  const nc = new OffscreenCanvas(64, 64); nc.getContext('2d').putImageData(n, 0, 0);
  ctx.fillStyle = ctx.createPattern(nc, 'repeat'); ctx.fillRect(0, 0, W, H);
}

const bgCache = { key: '', canvas: null };
function backgroundCanvas(W, H, bg, img) {
  const key = JSON.stringify([W, H, bg.type, bg.wallpaper, bg.color, bg.gradient, bg.angle, bg.image?.blobKey, bg.imageBlur, !!img]);
  if (bgCache.key === key) return bgCache.canvas;
  const c = new OffscreenCanvas(W, H), x = c.getContext('2d');
  if (bg.type === 'solid') { x.fillStyle = bg.color; x.fillRect(0, 0, W, H); }
  else if (bg.type === 'gradient') {
    const a = (bg.angle || 0) * Math.PI / 180, r = Math.hypot(W, H) / 2;
    const g = x.createLinearGradient(W / 2 - Math.sin(a) * r, H / 2 + Math.cos(a) * r, W / 2 + Math.sin(a) * r, H / 2 - Math.cos(a) * r);
    g.addColorStop(0, bg.gradient[0]); g.addColorStop(1, bg.gradient[1]);
    x.fillStyle = g; x.fillRect(0, 0, W, H);
  } else if (bg.type === 'image' && img) {
    const s = Math.max(W / img.width, H / img.height), b = (bg.imageBlur || 0) * Math.min(W, H) / 1000;
    if (b > 0) x.filter = `blur(${b}px)`;
    const m = b * 2;
    x.drawImage(img, (W - img.width * s) / 2 - m, (H - img.height * s) / 2 - m, img.width * s + 2 * m, img.height * s + 2 * m);
    x.filter = 'none';
  } else paintWallpaper(x, W, H, WALLPAPERS[bg.wallpaper] || WALLPAPERS.aurora);
  bgCache.key = key; bgCache.canvas = c;
  return c;
}

// ---- 輸出尺寸 ----
export const ASPECTS = { auto: null, '16:9': 16 / 9, '9:16': 9 / 16, '1:1': 1, '4:3': 4 / 3, '3:4': 3 / 4, '4:5': 4 / 5, '21:9': 21 / 9 };
export function outputSize(project, height) {
  const e = project.edit;
  const vw = project.width * e.crop.w, vh = project.height * e.crop.h;
  const ar = ASPECTS[e.aspect] || vw / vh;
  let W, H;
  if (ar >= 1) { H = height; W = Math.round(H * ar); } else { W = height; H = Math.round(W / ar); }
  return { W: W & ~1, H: H & ~1 };
}

// 內容（影片）在畫布中的位置
export function contentRect(project, W, H) {
  const e = project.edit, bg = e.background;
  const pad = (bg.padding / 100) * Math.min(W, H);
  const vw = project.width * e.crop.w, vh = project.height * e.crop.h, ar = vw / vh;
  let w = W - pad * 2, h = H - pad * 2;
  if (w / h > ar) w = h * ar; else h = w / ar;
  return { x: (W - w) / 2, y: (H - h) / 2, w, h };
}

// ---- 縮放（鏡頭）----
const IDENT = { z: 1, cx: .5, cy: .5 };
function zoomTarget(zm, t, cursor, crop) {
  let cx = zm.x, cy = zm.y;
  if (zm.follow && cursor) {
    const c = cursor.at(t);
    cx = (c.x - crop.x) / crop.w; cy = (c.y - crop.y) / crop.h;
  }
  return { z: zm.depth, cx, cy };
}
function lerpView(a, b, u) { return { z: lerp(a.z, b.z, u), cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u) }; }

export function viewAt(edit, t, cursor) {
  const zs = edit.zooms;
  if (!zs.length) return IDENT;
  const i = zs.findIndex(z => t >= z.start && t < z.end);
  let v = IDENT;
  if (i >= 0) {
    const R = zs[i], T = Math.max(0.05, R.transition ?? 0.6);
    const target = zoomTarget(R, t, cursor, edit.crop);
    const prev = zs.find(z => z !== R && z.end <= R.start + 1e-3 && z.end > R.start - 0.08);
    const next = zs.find(z => z !== R && z.start >= R.end - 1e-3 && z.start < R.end + 0.08);
    const pin = (t - R.start) / T, pout = (R.end - t) / T;
    if (prev && pin < 1) v = lerpView(zoomTarget(prev, prev.end - 1e-3, cursor, edit.crop), target, ease(R.ease, pin));
    else if (!next && pout < 1) v = lerpView(IDENT, target, ease(R.ease, Math.min(pout, pin)));
    else v = lerpView(IDENT, target, ease(R.ease, Math.min(pin, 1)));
  }
  return v;
}
// 視窗（被放大後看到的範圍）以內容座標 0..1 表示
export function viewWindow(v) {
  const w = 1 / Math.max(1, v.z), h = w;
  return { x: clamp(v.cx - w / 2, 0, 1 - w), y: clamp(v.cy - h / 2, 0, 1 - h), w, h };
}

// ---- 註解動畫 ----
const ANIM_IN = 0.35, ANIM_OUT = 0.25;
const camMaskCv = { c: null };
function camMaskCanvas(w, h) { let c = camMaskCv.c; if (!c) c = camMaskCv.c = document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = Math.max(2, w); c.height = Math.max(2, h); } return c; }
function animState(a, t) {
  const pin = clamp((t - a.start) / ANIM_IN, 0, 1), pout = clamp((a.end - t) / ANIM_OUT, 0, 1);
  const k = Math.min(pin, pout);
  switch (a.anim) {
    case 'fade': return { alpha: ease('smooth', k), dy: 0, s: 1, chars: 1 };
    case 'pop': return { alpha: ease('smooth', k), dy: 0, s: pin < 1 ? ease('spring', pin) : lerp(.85, 1, ease('smooth', pout)), chars: 1 };
    case 'slide': return { alpha: ease('smooth', k), dy: (1 - ease('easeOut', pin)) * 0.04 + (1 - ease('smooth', pout)) * -0.02, s: 1, chars: 1 };
    case 'type': return { alpha: pout, dy: 0, s: 1, chars: clamp((t - a.start) / Math.max(0.3, Math.min(2, (a.end - a.start) * 0.5)), 0, 1) };
    case 'bounce': return { alpha: ease('smooth', k), dy: pin < 1 ? -Math.abs(Math.sin(pin * Math.PI * 2)) * 0.03 * (1 - pin) : 0, s: 1, chars: 1 };
    default: return { alpha: 1, dy: 0, s: 1, chars: 1 };
  }
}

export const FONTS = {
  sans: '"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif',
  serif: '"Noto Serif TC","Songti TC",serif',
  round: '"Zen Maru Gothic","Arial Rounded MT Bold",system-ui,sans-serif',
  mono: 'ui-monospace,"Cascadia Code",Menlo,monospace',
  hand: '"Comic Sans MS","Chalkboard SE",cursive',
};

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const ch of [...para]) {
      if (ctx.measureText(line + ch).width > maxW && line) {
        const sp = line.lastIndexOf(' ');
        if (sp > 0 && /[A-Za-z0-9]/.test(ch)) { out.push(line.slice(0, sp)); line = line.slice(sp + 1) + ch; }
        else { out.push(line); line = ch; }
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}

// 主要繪圖
// st = { project, screen(VideoSample), camera(VideoSample), cursor(CursorTrack), images(Map key→ImageBitmap), bgImage, preview, sel }
export function render(ctx, W, H, t, st) {
  const p = st.project, e = p.edit, bg = e.background;
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  if (bg.type === 'animated' && LIB.BASIC[bg.animated]) {
    ctx.save();
    try { LIB.BASIC[bg.animated]({ g: ctx, W, H, t: st.ot ?? t, D: 60, acc: '#f0a83a', tw: 0, ty: H / 2, ts: 0 }); } catch { }
    ctx.restore();
  } else ctx.drawImage(backgroundCanvas(W, H, bg, st.bgImage), 0, 0);

  const R = contentRect(p, W, H);
  const rad = (bg.radius / 100) * Math.min(R.w, R.h) * 0.5;
  // 陰影
  if (bg.shadow > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0,0,0,${0.25 + bg.shadow / 200})`;
    ctx.shadowBlur = bg.shadow / 100 * Math.min(W, H) * 0.06;
    ctx.shadowOffsetY = bg.shadow / 100 * Math.min(W, H) * 0.015;
    ctx.fillStyle = '#000';
    roundRectPath(ctx, R.x, R.y, R.w, R.h, rad); ctx.fill();
    ctx.restore();
  }
  const view = viewAt(e, t, st.cursor);
  const win = viewWindow(view);
  const crop = e.crop, VW = p.width, VH = p.height;
  ctx.save();
  roundRectPath(ctx, R.x, R.y, R.w, R.h, rad); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fillRect(R.x, R.y, R.w, R.h);
  const frame = st.screen;
  const drawFrame = (w2, alpha) => {
    if (!frame) return;
    const fw = frame.displayWidth || VW, fh = frame.displayHeight || VH;
    const sx = (crop.x + w2.x * crop.w) * fw, sy = (crop.y + w2.y * crop.h) * fh;
    const sw = w2.w * crop.w * fw, sh = w2.h * crop.h * fh;
    ctx.globalAlpha = alpha;
    frame.draw(ctx, sx, sy, sw, sh, R.x, R.y, R.w, R.h);
  };
  // 動態模糊：鏡頭移動時，把前幾個瞬間的畫面疊在一起
  const mb = e.motionBlur / 100;
  let samples = 1;
  if (mb > 0) {
    const v0 = viewWindow(viewAt(e, t - 0.05 * mb, st.cursor));
    const move = (Math.abs(v0.x - win.x) + Math.abs(v0.y - win.y) + Math.abs(v0.w - win.w)) / win.w;
    samples = clamp(Math.ceil(move * 40), 1, 8);
    if (samples > 1) {
      for (let k = samples - 1; k >= 0; k--) {
        const tk = t - (k / (samples - 1)) * 0.05 * mb;
        drawFrame(viewWindow(viewAt(e, tk, st.cursor)), k === samples - 1 ? 1 : 1 / (samples - k));
      }
    }
  }
  if (samples === 1) drawFrame(win, 1);
  ctx.globalAlpha = 1;

  // 內容座標 → 畫布座標
  const toX = u => R.x + (u - win.x) / win.w * R.w;
  const toY = v => R.y + (v - win.y) / win.h * R.h;
  const scl = R.w / win.w; // 內容寬度 1 的長度（像素）

  // 模糊／馬賽克區（跟著影片內容走）
  for (const a of e.annotations) {
    if (a.type !== 'blur' || t < a.start || t >= a.end || !frame) continue;
    const x = toX(a.x), y = toY(a.y), w = a.w * scl, h = a.h * scl;
    ctx.save();
    roundRectPath(ctx, x, y, w, h, Math.min(w, h) * 0.08); ctx.clip();
    const fw = frame.displayWidth || VW, fh = frame.displayHeight || VH;
    const sx = (crop.x + a.x * crop.w) * fw, sy = (crop.y + a.y * crop.h) * fh, sw = a.w * crop.w * fw, sh = a.h * crop.h * fh;
    if (a.mode === 'pixelate') {
      const n = Math.max(2, Math.round(40 - a.strength * 0.36));
      const tmp = new OffscreenCanvas(Math.max(1, Math.round(n * w / Math.max(w, h))), Math.max(1, Math.round(n * h / Math.max(w, h))));
      frame.draw(tmp.getContext('2d'), sx, sy, sw, sh, 0, 0, tmp.width, tmp.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmp, x, y, w, h);
      ctx.imageSmoothingEnabled = true;
    } else {
      ctx.filter = `blur(${(a.strength || 50) / 100 * Math.min(w, h) * 0.25}px)`;
      frame.draw(ctx, sx, sy, sw, sh, x, y, w, h);
      ctx.filter = 'none';
    }
    ctx.restore();
  }
  ctx.restore(); // 結束影片圓角裁切

  // 游標（桌面版有真實游標軌跡時）
  const cs = e.cursor;
  if (st.cursor && cs.show) {
    const c = st.cursor.at(t);
    const u = (c.x - crop.x) / crop.w, v = (c.y - crop.y) / crop.h;
    const hidden = cs.hideIdle && c.idle > 2.5;
    if (!hidden && u >= -0.02 && u <= 1.02 && v >= -0.02 && v <= 1.02) {
      const X = toX(u), Y = toY(v);
      const base = (R.w / win.w) / Math.max(800, VW * crop.w) * cs.size * 1.2 * Math.max(1, VW * crop.w / 1600);
      const scale = clamp(base, 0.3, 12);
      ctx.save();
      roundRectPath(ctx, R.x, R.y, R.w, R.h, rad); ctx.clip();
      if (cs.highlight) {
        const g = ctx.createRadialGradient(X, Y, 0, X, Y, 34 * scale);
        g.addColorStop(0, 'rgba(255,230,80,.45)'); g.addColorStop(1, 'rgba(255,230,80,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, Y, 34 * scale, 0, Math.PI * 2); ctx.fill();
      }
      let pressed = false;
      for (const k of st.cursor.clicksNear(t, 0.5)) {
        const age = t - k.t;
        if (age < 0.12) pressed = true;
        drawClickEffect(ctx, toX((k.x - crop.x) / crop.w), toY((k.y - crop.y) / crop.h), age, scale, cs.click, cs.clickColor);
      }
      drawCursor(ctx, X, Y, scale, cs.theme, pressed);
      ctx.restore();
    }
  }

  // 註解
  const boxes = [];
  for (const a of e.annotations) {
    if (a.type === 'blur') { if (st.preview) boxes.push({ a, x: toX(a.x), y: toY(a.y), w: a.w * scl, h: a.h * scl, active: t >= a.start && t < a.end }); continue; }
    const active = t >= a.start && t < a.end;
    if (!active && !(st.preview && st.sel === a.id)) continue;
    const an = active ? animState(a, t) : { alpha: .35, dy: 0, s: 1, chars: 1 };
    ctx.save();
    ctx.globalAlpha = an.alpha;
    if (a.type === 'text' && a.d3) {
      const fs = (a.size / 100) * scl, font = FONTS[a.font] || FONTS.sans;
      ctx.font = `900 ${fs}px ${font}`;
      const lines = wrapLines(ctx, a.text || ' ', Math.max(fs * 2, a.w * scl));
      const pout = clamp((a.end - t) / ANIM_OUT, 0, 1);
      ctx.globalAlpha = active ? pout : .35;
      const est = { w: Math.max(...lines.map(l => ctx.measureText(l).width), fs), h: lines.length * fs * 1.3 };
      const x = toX(a.x), y = toY(a.y);
      draw3DText(ctx, lines, x + est.w / 2, y + est.h / 2, fs, a.d3, active ? t - a.start : 2, font);
      boxes.push({ a, x, y, w: est.w, h: est.h, active });
    } else if (a.type === 'text') {
      const fs = (a.size / 100) * scl;
      ctx.font = `${a.bold ? 700 : 500} ${fs}px ${FONTS[a.font] || FONTS.sans}`;
      const maxW = Math.max(fs * 2, a.w * scl);
      const full = [...String(a.text || '')];
      const shown = full.slice(0, Math.ceil(full.length * an.chars)).join('');
      const lines = wrapLines(ctx, shown, maxW);
      const allLines = wrapLines(ctx, a.text || ' ', maxW);
      const lh = fs * 1.3, pad = a.bg && a.bg !== 'transparent' ? fs * 0.4 : 0;
      const bw = Math.max(...allLines.map(l => ctx.measureText(l).width), fs) + pad * 2, bh = allLines.length * lh + pad * 2;
      let x = toX(a.x), y = toY(a.y) + an.dy * R.h;
      ctx.translate(x + bw / 2, y + bh / 2); ctx.scale(an.s, an.s); ctx.translate(-bw / 2, -bh / 2);
      if (pad) { ctx.fillStyle = a.bg; roundRectPath(ctx, 0, 0, bw, bh, fs * 0.35); ctx.fill(); }
      ctx.fillStyle = a.color || '#fff';
      ctx.textBaseline = 'top';
      if (a.stroke) { ctx.lineWidth = fs * 0.12; ctx.strokeStyle = a.stroke; ctx.lineJoin = 'round'; }
      lines.forEach((l, i) => {
        const lx = a.align === 'center' ? pad + (bw - pad * 2 - ctx.measureText(l).width) / 2 : pad;
        if (a.stroke) ctx.strokeText(l, lx, pad + i * lh + fs * 0.12);
        ctx.fillText(l, lx, pad + i * lh + fs * 0.12);
      });
      boxes.push({ a, x, y, w: bw, h: bh, active });
    } else if (a.type === 'arrow') {
      const x1 = toX(a.x), y1 = toY(a.y), x2 = toX(a.x2), y2 = toY(a.y2);
      const lw = (a.width || 1) / 100 * scl * 0.6, ang = Math.atan2(y2 - y1, x2 - x1), hl = lw * 4.2;
      const len = Math.hypot(x2 - x1, y2 - y1) * (a.anim === 'none' || !active ? 1 : ease('easeOut', clamp((t - a.start) / 0.4, 0, 1)));
      const ex = x1 + Math.cos(ang) * len, ey = y1 + Math.sin(ang) * len;
      ctx.strokeStyle = ctx.fillStyle = a.color || '#ff3b30';
      ctx.lineWidth = lw; ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = lw;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(ex - Math.cos(ang) * hl * .6, ey - Math.sin(ang) * hl * .6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex, ey);
      ctx.lineTo(ex - Math.cos(ang - .45) * hl, ey - Math.sin(ang - .45) * hl);
      ctx.lineTo(ex - Math.cos(ang + .45) * hl, ey - Math.sin(ang + .45) * hl); ctx.closePath(); ctx.fill();
      boxes.push({ a, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), x1, y1, x2, y2, active });
    } else if (a.type === 'rect') {
      const x = toX(a.x), y = toY(a.y), w = a.w * scl, h = a.h * scl;
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(an.s, an.s); ctx.translate(-w / 2, -h / 2);
      if (a.fill) { ctx.fillStyle = a.fill; roundRectPath(ctx, 0, 0, w, h, Math.min(w, h) * .12); ctx.fill(); }
      ctx.strokeStyle = a.color || '#ffd23f'; ctx.lineWidth = (a.width || 1) / 100 * scl * 0.5;
      roundRectPath(ctx, 0, 0, w, h, Math.min(w, h) * .12); ctx.stroke();
      boxes.push({ a, x, y, w, h, active });
    } else if (a.type === 'sticker') {
      const img = stickerCanvas(a.stk);
      const x = toX(a.x), y = toY(a.y), w = a.w * scl, h = a.h * scl;
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(an.s, an.s); ctx.translate(-w / 2, -h / 2);
      if (img) ctx.drawImage(img, 0, 0, w, h);
      boxes.push({ a, x, y, w, h, active });
    } else if (a.type === 'effect') {
      const x = toX(a.x), y = toY(a.y), w = a.w * scl, h = a.h * scl;
      if (active) drawEffect(ctx, a, t, x, y, w, h);
      else { ctx.strokeStyle = '#22d3ee'; ctx.setLineDash([6, 4]); ctx.strokeRect(x, y, w, h); }
      boxes.push({ a, x, y, w, h, active });
    } else if (a.type === 'image') {
      const img = st.images?.get(a.blobKey);
      const x = toX(a.x), y = toY(a.y), w = a.w * scl, h = a.h * scl;
      ctx.translate(x + w / 2, y + h / 2); ctx.scale(an.s, an.s); ctx.translate(-w / 2, -h / 2);
      if (img) ctx.drawImage(img, 0, 0, w, h); else { ctx.fillStyle = 'rgba(255,255,255,.2)'; ctx.fillRect(0, 0, w, h); }
      boxes.push({ a, x, y, w, h, active });
    }
    ctx.restore();
  }

  // 網路攝影機（畫中畫）
  const cam = e.camera;
  let camBox = null;
  if (st.camera && cam.show) {
    const fw = st.camera.displayWidth, fh = st.camera.displayHeight;
    let size = cam.size / 100 * Math.min(W, H) * 1.2;
    if (cam.shrinkOnZoom && view.z > 1.05) size *= lerp(1, 0.72, clamp((view.z - 1) / 0.6, 0, 1));
    const ar = cam.shape === 'wide' ? 16 / 9 : cam.shape === 'tall' ? 3 / 4 : 1;
    const cw = cam.shape === 'wide' ? size * 1.3 : size * ar, ch = cam.shape === 'wide' ? cw / ar : size;
    const cx = clamp(cam.x * W, cw / 2 + 4, W - cw / 2 - 4), cy = clamp(cam.y * H, ch / 2 + 4, H - ch / 2 - 4);
    const x = cx - cw / 2, y = cy - ch / 2;
    const r = cam.shape === 'circle' ? Math.min(cw, ch) / 2 : cam.shape === 'square' ? Math.min(cw, ch) * 0.04 : Math.min(cw, ch) * 0.18;
    const mk = String(cam.shape).startsWith('mask:') && LIB.MASK[cam.shape.slice(5)];
    if (mk) {
      // 蒙版形狀（影音剪輯助手的 30 種）：先畫攝影機，再用形狀裁切
      const off = camMaskCanvas(Math.round(cw), Math.round(ch)), g = off.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, off.width, off.height);
      const s2 = Math.max(cw / fw, ch / fh), sw2 = cw / s2, sh2 = ch / s2;
      if (cam.mirror) { g.translate(off.width, 0); g.scale(-1, 1); }
      st.camera.draw(g, (fw - sw2) / 2, (fh - sh2) / 2, sw2, sh2, 0, 0, off.width, off.height);
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'destination-in'; g.fillStyle = '#000';
      g.translate(off.width / 2, off.height / 2); try { mk.fn(g, off.width / .9, off.height / .9, st.ot ?? t); } catch { }
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over';
      ctx.save();
      if (cam.shadow > 0) { ctx.shadowColor = `rgba(0,0,0,${cam.shadow / 150})`; ctx.shadowBlur = size * 0.12 * cam.shadow / 100; ctx.shadowOffsetY = size * 0.03; }
      ctx.drawImage(off, x, y, cw, ch);
      ctx.restore();
      camBox = { x, y, w: cw, h: ch };
    } else {
    ctx.save();
    if (cam.shadow > 0) { ctx.shadowColor = `rgba(0,0,0,${cam.shadow / 150})`; ctx.shadowBlur = size * 0.12 * cam.shadow / 100; ctx.shadowOffsetY = size * 0.03; }
    ctx.fillStyle = cam.borderColor; roundRectPath(ctx, x, y, cw, ch, r); ctx.fill();
    ctx.restore();
    ctx.save();
    const bw = cam.border / 100 * size;
    roundRectPath(ctx, x + bw, y + bw, cw - bw * 2, ch - bw * 2, Math.max(0, r - bw)); ctx.clip();
    // 攝影機畫面以 cover 方式填滿
    const s = Math.max(cw / fw, ch / fh), sw = cw / s, sh = ch / s;
    if (cam.mirror) { ctx.translate(x + cw, y); ctx.scale(-1, 1); st.camera.draw(ctx, (fw - sw) / 2, (fh - sh) / 2, sw, sh, 0, 0, cw, ch); }
    else st.camera.draw(ctx, (fw - sw) / 2, (fh - sh) / 2, sw, sh, x, y, cw, ch);
    ctx.restore();
    camBox = { x, y, w: cw, h: ch };
    }
  }

  // 字幕
  const cst = e.captionStyle;
  if (cst.show) {
    const cap = e.captions.find(c => t >= c.start && t < c.end);
    if (cap && cap.text.trim() && cst.d3) {
      const fs = cst.size / 100 * Math.min(W, H) * 1.25, font = FONTS[cst.font] || FONTS.sans;
      ctx.save();
      ctx.font = `900 ${fs}px ${font}`;
      const lines = wrapLines(ctx, cap.text.trim(), W * 0.84), hh = lines.length * fs * 1.3;
      const cy = cst.pos === 'top' ? H * 0.08 + hh / 2 : cst.pos === 'middle' ? H / 2 : H - H * 0.08 - hh / 2;
      ctx.globalAlpha = clamp((cap.end - t) / 0.2, 0, 1);
      draw3DText(ctx, lines, W / 2, cy, fs, cst.d3, t - cap.start, font);
      ctx.restore();
    } else if (cap && cap.text.trim()) {
      const fs = cst.size / 100 * Math.min(W, H);
      ctx.save();
      ctx.font = `600 ${fs}px ${FONTS[cst.font] || FONTS.sans}`;
      const lines = wrapLines(ctx, cap.text.trim(), W * 0.84);
      const lh = fs * 1.32, pad = fs * 0.45;
      const bw = Math.max(...lines.map(l => ctx.measureText(l).width)) + pad * 2, bh = lines.length * lh + pad * 1.2;
      const y = cst.pos === 'top' ? H * 0.06 : cst.pos === 'middle' ? (H - bh) / 2 : H - bh - H * 0.06;
      if (cst.bg && cst.bg !== 'transparent') { ctx.fillStyle = cst.bg; roundRectPath(ctx, (W - bw) / 2, y, bw, bh, fs * 0.3); ctx.fill(); }
      else { ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = fs * 0.25; }
      ctx.fillStyle = cst.color; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      lines.forEach((l, i) => ctx.fillText(l, W / 2, y + pad * 0.6 + i * lh + fs * 0.1));
      ctx.restore();
    }
  }
  ctx.restore();
  return { R, win, view, boxes, camBox, toX, toY, scl };
}
