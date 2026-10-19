// 游標軌跡：平滑處理、主題外觀、點擊特效
// 軌跡格式（桌面版錄影時由 Python 記錄）：
//   { w, h, samples:[[t,x,y],...], clicks:[[t,x,y,button],...] }，x/y 為錄影畫面像素
import { clamp } from './util.js';

export class CursorTrack {
  constructor(raw, smooth = 60) {
    this.raw = raw;
    this.w = raw.w; this.h = raw.h;
    this.clicks = (raw.clicks || []).map(([t, x, y, b]) => ({ t, x: x / raw.w, y: y / raw.h, b }));
    this.setSmooth(smooth);
  }
  // 錄影後路徑平滑：以 120Hz 重新取樣，再用彈簧（臨界阻尼）跟隨，消除抖動
  setSmooth(smooth) {
    if (this._smooth === smooth && this.track) return;
    this._smooth = smooth;
    const s = this.raw.samples || [];
    const hz = 120, dt = 1 / hz;
    const end = s.length ? s[s.length - 1][0] : 0;
    const n = Math.ceil(end * hz) + 2;
    const xs = new Float32Array(n), ys = new Float32Array(n), mv = new Float32Array(n);
    const k = smooth <= 0 ? 0 : 6 + (100 - smooth) * 0.9; // 越平滑彈簧越軟
    let j = 0, px = s[0]?.[1] ?? this.w / 2, py = s[0]?.[2] ?? this.h / 2, vx = 0, vy = 0;
    let lastMove = 0, prevRx = px, prevRy = py;
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      while (j < s.length - 1 && s[j + 1][0] <= t) j++;
      let rx = s[j]?.[1] ?? px, ry = s[j]?.[2] ?? py;
      if (j < s.length - 1) {
        const a = s[j], b = s[j + 1], u = clamp((t - a[0]) / Math.max(1e-6, b[0] - a[0]), 0, 1);
        rx = a[1] + (b[1] - a[1]) * u; ry = a[2] + (b[2] - a[2]) * u;
      }
      if (Math.abs(rx - prevRx) + Math.abs(ry - prevRy) > 1.5) lastMove = t;
      prevRx = rx; prevRy = ry;
      if (k === 0) { px = rx; py = ry; }
      else {
        const w = k, ax = w * w * (rx - px) - 2 * w * vx, ay = w * w * (ry - py) - 2 * w * vy;
        vx += ax * dt; vy += ay * dt; px += vx * dt; py += vy * dt;
      }
      xs[i] = px / this.w; ys[i] = py / this.h; mv[i] = t - lastMove;
    }
    this.track = { hz, xs, ys, mv, n };
  }
  at(t) {
    const tr = this.track;
    if (!tr.n) return { x: .5, y: .5, idle: 99 };
    const f = clamp(t * tr.hz, 0, tr.n - 1), i = Math.floor(f), u = f - i, i2 = Math.min(i + 1, tr.n - 1);
    return { x: tr.xs[i] + (tr.xs[i2] - tr.xs[i]) * u, y: tr.ys[i] + (tr.ys[i2] - tr.ys[i]) * u, idle: tr.mv[i] };
  }
  clicksNear(t, before = 0.6) { return this.clicks.filter(c => c.t <= t && c.t > t - before); }
}

// ---- 游標主題 ----
const ARROW = new Path2D('M0 0 L0 17 L4.2 13.2 L7 19.5 L9.6 18.4 L6.9 12.3 L12.3 12.3 Z');
const HAND = new Path2D('M6 0c1 0 1.8.8 1.8 1.8V8l.6-.1c.9 0 1.6.6 1.7 1.4.4-.3.9-.5 1.4-.4.8.1 1.4.7 1.5 1.5.4-.2.8-.3 1.3-.2 1 .2 1.6 1 1.6 2v3.6c0 3-2.4 5.4-5.4 5.4H8.7c-1.7 0-3.3-.8-4.3-2.2L.7 13.8c-.6-.8-.4-1.9.4-2.5.7-.5 1.7-.4 2.3.2l.8.9V1.8C4.2.8 5 0 6 0z');

export const CURSOR_THEMES = ['mac', 'win', 'white', 'hand', 'dot', 'ring'];

export function drawCursor(ctx, x, y, scale, theme, pressed) {
  ctx.save();
  ctx.translate(x, y);
  const s = scale * (pressed ? 0.88 : 1);
  ctx.scale(s, s);
  ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 4 / s; ctx.shadowOffsetY = 1.5 / s;
  ctx.lineJoin = 'round';
  switch (theme) {
    case 'win':
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.2;
      ctx.fill(ARROW); ctx.shadowColor = 'transparent'; ctx.stroke(ARROW); break;
    case 'white':
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
      ctx.fill(ARROW); ctx.stroke(ARROW); break;
    case 'hand':
      ctx.translate(-6, 0);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#000'; ctx.lineWidth = 1.1;
      ctx.fill(HAND); ctx.shadowColor = 'transparent'; ctx.stroke(HAND); break;
    case 'dot':
      ctx.fillStyle = 'rgba(20,20,20,.85)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); break;
    case 'ring':
      ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fill(); break;
    default: // mac
      ctx.fillStyle = '#000'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.6;
      ctx.stroke(ARROW); ctx.shadowColor = 'transparent'; ctx.fill(ARROW);
  }
  ctx.restore();
}

export function drawClickEffect(ctx, x, y, age, scale, kind, color) {
  if (kind === 'none') return;
  const p = clamp(age / 0.5, 0, 1);
  ctx.save();
  ctx.globalAlpha = 1 - p;
  ctx.strokeStyle = color; ctx.fillStyle = color;
  if (kind === 'ripple') {
    ctx.lineWidth = 3 * scale;
    ctx.beginPath(); ctx.arc(x, y, (6 + 26 * p) * scale, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = (1 - p) * 0.25;
    ctx.beginPath(); ctx.arc(x, y, (4 + 18 * p) * scale, 0, Math.PI * 2); ctx.fill();
  } else if (kind === 'ring') {
    ctx.lineWidth = 2.5 * scale;
    ctx.beginPath(); ctx.arc(x, y, 18 * scale * (0.6 + 0.4 * p), 0, Math.PI * 2); ctx.stroke();
  } else if (kind === 'spark') {
    ctx.lineWidth = 2.5 * scale;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, r0 = (8 + 10 * p) * scale, r1 = r0 + 8 * scale * (1 - p);
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke();
    }
  }
  ctx.restore();
}
