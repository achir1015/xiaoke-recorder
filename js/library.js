// 自動產生，請勿手動修改：python tools/port_library.py
// 來源：小柯影音剪輯助手（achir1015/xiaoke-video）的內建素材庫，全部用程式繪製／合成，沒有外部檔案、沒有版權問題。
/* eslint-disable */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const document = globalThis.document || { createElement: () => new OffscreenCanvas(1, 1) };

// ===== 擷取自影音剪輯助手：const FF = =====
const FF = '"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
const rnd = i => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };   // 固定的亂數，匯出結果每次都一樣
const ease = k => 1 - Math.pow(1 - clamp(k, 0, 1), 3);
const lerp = (a, b, k) => a + (b - a) * k;
function hexA(hex, a) { const n = parseInt(String(hex || '#ffffff').slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }
function fitFont(g, text, maxW, size, weight = 800) {
  let s = size; g.font = `${weight} ${s}px ${FF}`;
  while (s > 8 && g.measureText(text).width > maxW) { s *= .92; g.font = `${weight} ${s}px ${FF}`; }
  return s;
}
// 逐字繪製（字距動畫、彈跳、打字機用）
function drawChars(g, text, cx, cy, spacing, each) {
  const ch = Array.from(text), ws = ch.map(c => g.measureText(c).width);
  const total = ws.reduce((a, b) => a + b, 0) + spacing * Math.max(0, ch.length - 1);
  let x = cx - total / 2;
  ch.forEach((c, i) => { each(c, x + ws[i] / 2, cy, i, ch.length); x += ws[i] + spacing; });
}

// ---------- 背景 ----------
const BG = {
  dark(S) { const { g, W, H, acc } = S; g.fillStyle = '#0c0e11'; g.fillRect(0, 0, W, H); const r = g.createRadialGradient(W / 2, H * .55, 0, W / 2, H * .55, H); r.addColorStop(0, hexA(acc, .16)); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); },
  neon(S) { const { g, W, H, acc, t } = S; g.fillStyle = '#0a0614'; g.fillRect(0, 0, W, H); g.strokeStyle = hexA(acc, .08); g.lineWidth = 1; const s = H / 12;
    for (let x = (t * 10) % s; x < W; x += s) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += s) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } },
  film(S) { const { g, W, H, t } = S; const f = Math.floor(t * 24), fl = .9 + rnd(f) * .1; g.fillStyle = `rgb(${46 * fl | 0},${36 * fl | 0},${26 * fl | 0})`; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,240,210,.06)'; for (let i = 0; i < 260; i++) g.fillRect(rnd(f * 999 + i) * W, rnd(f * 777 + i) * H, 2, 2);
    g.strokeStyle = 'rgba(255,240,210,.18)'; g.lineWidth = 1; for (let i = 0; i < 2; i++) { const x = rnd(f * 31 + i) * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 6, H); g.stroke(); } },
  grad(S) { const { g, W, H, t, acc } = S; const gr = g.createLinearGradient(0, 0, W, H); const h = (t * 30) % 360;
    gr.addColorStop(0, acc); gr.addColorStop(.5, `hsl(${h + 200},70%,45%)`); gr.addColorStop(1, `hsl(${h + 280},65%,30%)`); g.fillStyle = gr; g.fillRect(0, 0, W, H); },
  stars(S) { const { g, W, H, t } = S; g.fillStyle = '#04050a'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (let i = 0; i < 260; i++) { const a = rnd(i) * Math.PI * 2, z = ((rnd(i + 99) + t * .25) % 1), r = Math.pow(z, 2) * Math.hypot(W, H) * .6;
      const x = W / 2 + Math.cos(a) * r, y = H / 2 + Math.sin(a) * r, s = .5 + z * 2.6 * H / 720; g.globalAlpha = z; g.fillRect(x, y, s, s); } g.globalAlpha = 1; },
  tech(S) { const { g, W, H, t, acc } = S; g.fillStyle = '#040d18'; g.fillRect(0, 0, W, H); g.strokeStyle = hexA(acc, .28); g.lineWidth = 1; const hz = H * .62;
    for (let i = -12; i <= 12; i++) { g.beginPath(); g.moveTo(W / 2 + i * W * .02, hz); g.lineTo(W / 2 + i * W * .18, H); g.stroke(); }
    for (let i = 0; i < 12; i++) { const k = ((i + t * 1.5) % 12) / 12, y = hz + Math.pow(k, 2.2) * (H - hz); g.globalAlpha = k; g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } g.globalAlpha = 1; },
  pastel(S) { const { g, W, H, t } = S; const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#fde8ee'); gr.addColorStop(1, '#e3f1fb'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { g.fillStyle = `hsla(${rnd(i) * 360},80%,80%,.35)`; g.beginPath(); g.arc(rnd(i + 3) * W, (rnd(i + 7) * H - t * H * .03 * (1 + rnd(i))) % H + H * .1, H * (.05 + rnd(i + 5) * .12), 0, Math.PI * 2); g.fill(); } },
  paper(S) { const { g, W, H } = S; g.fillStyle = '#f5efe3'; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(120,100,70,.07)'; g.lineWidth = 1; for (let y = H * .04; y < H; y += H / 28) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } },
  sunset(S) { const { g, W, H, t } = S; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2d1b4e'); gr.addColorStop(.55, '#e2635a'); gr.addColorStop(1, '#f7b267'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,230,170,.85)'; g.beginPath(); g.arc(W / 2, H * (.78 - Math.min(t, 3) * .02), H * .2, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(45,27,78,.55)'; for (let i = 0; i < 5; i++) g.fillRect(0, H * (.8 + i * .045), W, H * .012 * (5 - i) / 3); },
  ocean(S) { const { g, W, H, t } = S; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b3d63'); gr.addColorStop(1, '#16a5b8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    for (let j = 0; j < 4; j++) { g.fillStyle = `rgba(255,255,255,${.06 + j * .03})`; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W; x += W / 60) g.lineTo(x, H * (.7 + j * .07) + Math.sin(x / W * 8 + t * (1.2 + j * .4) + j) * H * .02); g.lineTo(W, H); g.fill(); } },
  gold(S) { const { g, W, H } = S; g.fillStyle = '#0b0906'; g.fillRect(0, 0, W, H); const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * .9); r.addColorStop(0, 'rgba(120,90,30,.35)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); },
};
const LIGHT_BG = { pastel: 1, paper: 1 };

// ---------- 裝飾（pre 畫在文字下面，post 畫在文字上面） ----------
const DECOR = {
  glow: { pre(S) { const { g, W, H, t, acc } = S; const p = .5 + .5 * Math.sin(t * 2); const r = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, H * (.35 + p * .08)); r.addColorStop(0, hexA(acc, .3)); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H); } },
  bars: { post(S) { const { g, W, H, t, out, D } = S;   // 上下黑邊：片頭由中間打開，片尾在最後闔上
    const hh = out ? lerp(H * .12, H * .5, ease((t - (D - 1.4)) / 1.2)) : lerp(H * .5, H * .12, ease(t / 1.2));
    g.fillStyle = '#000'; g.fillRect(0, 0, W, hh); g.fillRect(0, H - hh, W, hh); } },
  sweep: { post(S) { const { g, W, H, t } = S; const x = ((t - .8) % 2.4) / 1.6 * (W * 1.6) - W * .3; if (t < .8) return; g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createLinearGradient(x - W * .12, 0, x + W * .12, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,240,200,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.translate(x, H / 2); g.rotate(-.35); g.fillRect(-W * .12, -H, W * .24, H * 2); g.restore(); } },
  rays: { pre(S) { const { g, W, H, t, acc } = S; g.save(); g.translate(W / 2, H / 2); g.rotate(t * .25); g.fillStyle = hexA(acc, .12);
    for (let i = 0; i < 16; i++) { g.rotate(Math.PI / 8); g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -W * .08); g.lineTo(W, W * .08); g.fill(); } g.restore(); } },
  particles: { pre(S) { const { g, W, H, t, acc } = S; const k = ease(t / 1.6); g.fillStyle = acc;
    for (let i = 0; i < 140; i++) { const a = rnd(i) * Math.PI * 2, R0 = Math.hypot(W, H) * (.5 + rnd(i + 5) * .3), R1 = H * (.22 + rnd(i + 9) * .1) + Math.sin(t * 2 + i) * H * .01;
      const r = lerp(R0, R1, k), x = W / 2 + Math.cos(a + t * .2) * r * 1.6, y = H / 2 + Math.sin(a + t * .2) * r * .7; g.globalAlpha = .3 + rnd(i + 2) * .7; const s = (1 + rnd(i + 4) * 3) * H / 720; g.fillRect(x, y, s, s); } g.globalAlpha = 1; } },
  ripples: { pre(S) { const { g, W, H, t, acc } = S; g.lineWidth = H / 300; for (let i = 0; i < 6; i++) { const k = ((t * .5 + i / 6) % 1); g.strokeStyle = hexA(acc, (1 - k) * .5); g.beginPath(); g.arc(W / 2, H / 2, k * H * .9, 0, Math.PI * 2); g.stroke(); } } },
  stripes: { pre(S) { const { g, W, H, t, acc } = S; g.save(); g.translate(W / 2, H / 2); g.rotate(-.5); for (let i = 0; i < 7; i++) { const k = ease((t - i * .08) / .9);
    g.fillStyle = i % 2 ? hexA(acc, .9) : hexA(acc, .45); const y = (i - 3) * H * .16; g.fillRect(lerp(-W * 2, -W, k), y, W * 2 * (1 - ease((t - 1.4 - i * .05) / .8)) + 1, H * .08); } g.restore(); } },
  split: { pre(S) { const { g, W, H, t, acc } = S; const k = ease((t - .2) / 1); g.fillStyle = acc; g.fillRect(0, -H / 2 * k, W, H / 2); g.fillStyle = '#1a1d22'; g.fillRect(0, H / 2 + H / 2 * k, W, H / 2); } },
  underline: { post(S) { const { g, W, H, t, acc } = S; const k = ease((t - .8) / .8); if (k <= 0) return; g.strokeStyle = acc; g.lineCap = 'round'; g.lineWidth = H / 70; const w = S.tw * 1.05;
    g.beginPath(); for (let i = 0; i <= 40 * k; i++) { const x = W / 2 - w / 2 + w * i / 40, y = S.ty + S.ts * .62 + Math.sin(i * .7) * H / 300; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); } },
  tiles: { post(S) { const { g, W, H, t, acc } = S; const n = 8, cw = W / n, rows = Math.ceil(H / cw);
    for (let i = 0; i < n; i++) for (let j = 0; j < rows; j++) { const k = ease((t - .15 - (i + j) * .05) / .5); if (k >= 1) continue; const s = 1 - k;
      g.fillStyle = (i + j) % 2 ? acc : hexA(acc, .7); g.fillRect(i * cw + cw / 2 * (1 - s), j * cw + cw / 2 * (1 - s), cw * s + .5, cw * s + .5); } } },
  ink: { pre(S) { const { g, W, H, t, acc } = S; for (let i = 0; i < 26; i++) { const k = ease((t - rnd(i) * .8) / 1.4); if (k <= 0) continue;
    g.fillStyle = hexA(acc, .1 + rnd(i + 3) * .12); g.beginPath(); g.arc(W * (.2 + rnd(i + 1) * .6), H * (.25 + rnd(i + 2) * .5), k * H * (.08 + rnd(i + 4) * .2), 0, Math.PI * 2); g.fill(); } } },
  lines: { pre(S) { const { g, W, H, t, acc } = S; const k = ease((t - .1) / 1.1); g.strokeStyle = acc; g.lineWidth = H / 360;
    for (const dy of [-1, 1]) { const y = H / 2 + dy * H * .14; g.beginPath(); g.moveTo(W / 2 - k * W * .35, y); g.lineTo(W / 2 + k * W * .35, y); g.stroke(); } } },
  confetti: { post(S) { const { g, W, H, t } = S; for (let i = 0; i < 110; i++) { const x = rnd(i) * W + Math.sin(t * 2 + i) * W * .02, y = ((rnd(i + 50) * 1.2 - .2) * H + t * H * (.18 + rnd(i + 9) * .2)) % (H * 1.1) - H * .05;
    g.save(); g.translate(x, y); g.rotate(t * (2 + rnd(i) * 4) + i); g.fillStyle = `hsl(${rnd(i + 3) * 360},85%,60%)`; g.fillRect(-H / 140, -H / 70, H / 70, H / 35); g.restore(); } } },
  hearts: { post(S) { const { g, W, H, t, acc } = S; for (let i = 0; i < 22; i++) { const k = ((t * .22 + rnd(i)) % 1), x = rnd(i + 7) * W + Math.sin(t * 2 + i) * W * .02, y = H * 1.05 - k * H * 1.2, s = H * (.02 + rnd(i + 4) * .035);
    g.globalAlpha = Math.sin(k * Math.PI) * .9; g.fillStyle = i % 3 ? acc : '#ff9fb8'; heartPath(g, x, y, s); g.fill(); } g.globalAlpha = 1; } },
  scan: { post(S) { const { g, W, H, t } = S; g.fillStyle = 'rgba(0,0,0,.18)'; for (let y = 0; y < H; y += 4 * H / 720) g.fillRect(0, y, W, H / 720 * 1.4);
    const y = (t * .35 % 1) * H; const gr = g.createLinearGradient(0, y - H * .05, 0, y + H * .05); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.5, 'rgba(255,255,255,.06)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, y - H * .05, W, H * .1); } },
  frame: { post(S) { const { g, W, H, acc } = S; g.strokeStyle = hexA(acc, .6); g.lineWidth = H / 240; const m = H * .06; g.strokeRect(m, m, W - m * 2, H - m * 2);
    g.fillStyle = 'rgba(0,0,0,.55)'; const r = H / 70; for (let x = r * 2; x < W; x += r * 4) { g.fillRect(x, H * .012, r * 1.6, r * 1.2); g.fillRect(x, H - H * .012 - r * 1.2, r * 1.6, r * 1.2); } } },
  iris: { post(S) { const { g, W, H, t, D } = S; const k = ease((t - (D - 1.6)) / 1.2); if (k <= 0) return; const R = Math.hypot(W, H) / 2 * (1 - k);
    g.save(); g.fillStyle = '#000'; g.beginPath(); g.rect(0, 0, W, H); g.arc(W / 2, H / 2, Math.max(0, R), 0, Math.PI * 2, true); g.fill('evenodd'); g.restore(); } },
  arrow: { post(S) { const { g, W, H, t, acc } = S; const k = ease((t - .9) / .7); if (k <= 0) return; const x = W / 2 + S.tw / 2 + H * .06 + Math.sin(t * 5) * H * .015, y = S.ty;
    g.globalAlpha = k; g.fillStyle = acc; g.beginPath(); g.moveTo(x, y - H * .05); g.lineTo(x + H * .09, y); g.lineTo(x, y + H * .05); g.closePath(); g.fill(); g.globalAlpha = 1; } },
  subscribe: { post(S) { const { g, W, H, t } = S; const k = ease((t - .8) / .6); if (k <= 0) return; const done = t > 2.4, bw = H * .42, bh = H * .12, x = W / 2 - bw / 2 - H * .06, y = H * .68;
    g.globalAlpha = k; g.fillStyle = done ? '#5b5f66' : '#e0352b'; roundRect(g, x, y, bw, bh, bh / 2); g.fill(); g.fillStyle = '#fff'; g.font = `700 ${bh * .48}px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? '已訂閱' : '訂閱', x + bw / 2, y + bh / 2);
    const bx = x + bw + H * .1, by = y + bh / 2; g.fillStyle = '#fff'; g.save(); g.translate(bx, by); g.rotate(done ? Math.sin(t * 18) * .25 * Math.max(0, 1 - (t - 2.4)) : 0); bellPath(g, 0, 0, bh * .42); g.fill(); g.restore();
    const cx = lerp(W * .8, x + bw * .6, ease((t - 1.3) / .9)), cy = lerp(H * .95, y + bh * .7, ease((t - 1.3) / .9)); if (t > 1.3 && t < 3.2) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = H / 400; cursorPath(g, cx, cy, H * .05); g.fill(); g.stroke(); }
    g.globalAlpha = 1; } },
  socials: { post(S) { const { g, W, H, t, acc } = S; for (let i = 0; i < 3; i++) { const k = ease((t - .9 - i * .15) / .5); if (k <= 0) continue; const x = W / 2 + (i - 1) * H * .2, y = H * .72 + (1 - k) * H * .05, r = H * .055;
    g.globalAlpha = k; g.fillStyle = acc; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.fillStyle = '#0c0e11'; g.strokeStyle = '#0c0e11'; g.lineWidth = r * .14;
    if (i === 0) { g.beginPath(); g.moveTo(x - r * .3, y - r * .4); g.lineTo(x + r * .45, y); g.lineTo(x - r * .3, y + r * .4); g.fill(); }
    else if (i === 1) { roundRect(g, x - r * .5, y - r * .5, r, r, r * .28); g.stroke(); g.beginPath(); g.arc(x, y, r * .22, 0, Math.PI * 2); g.stroke(); }
    else { g.beginPath(); g.arc(x, y, r * .5, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.ellipse(x, y, r * .22, r * .5, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x - r * .5, y); g.lineTo(x + r * .5, y); g.stroke(); } } g.globalAlpha = 1; } },
};
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function heartPath(g, x, y, s) { g.beginPath(); g.moveTo(x, y + s * .9); g.bezierCurveTo(x - s * 1.6, y - s * .1, x - s * .7, y - s * 1.3, x, y - s * .45); g.bezierCurveTo(x + s * .7, y - s * 1.3, x + s * 1.6, y - s * .1, x, y + s * .9); g.closePath(); }
function bellPath(g, x, y, s) { g.beginPath(); g.moveTo(x - s, y + s * .6); g.quadraticCurveTo(x - s * .8, y + s * .3, x - s * .75, y - s * .2); g.quadraticCurveTo(x - s * .7, y - s, x, y - s); g.quadraticCurveTo(x + s * .7, y - s, x + s * .75, y - s * .2); g.quadraticCurveTo(x + s * .8, y + s * .3, x + s, y + s * .6); g.closePath(); g.moveTo(x + s * .25, y + s * .75); g.arc(x, y + s * .75, s * .25, 0, Math.PI); }
function cursorPath(g, x, y, s) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + s); g.lineTo(x + s * .28, y + s * .75); g.lineTo(x + s * .5, y + s * 1.15); g.lineTo(x + s * .62, y + s * 1.08); g.lineTo(x + s * .42, y + s * .7); g.lineTo(x + s * .75, y + s * .7); g.closePath(); }
function starPath(g, x, y, R, r, n = 5) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = -Math.PI / 2 + i * Math.PI / n, rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); }

// ---------- 文字動畫 ----------
function drawTitles(S, anim) {
  const { g, W, H, t, title, sub, fg, acc } = S;
  const a = clamp((t - .35) / .9, 0, 1), e = ease(a);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const ty = sub ? H * .46 : H * .5, ts = fitFont(g, title, W * .82, H * .13);
  S.ty = ty; S.ts = ts; S.tw = g.measureText(title).width;
  const subDraw = (alpha = ease((t - 1) / .8), dy = 0) => {
    if (!sub || anim === 'roll') return; g.save(); g.globalAlpha *= alpha; g.fillStyle = S.subFg; fitFont(g, sub.split('\n')[0], W * .8, H * .045, 500);
    g.fillText(sub.split('\n')[0], W / 2, H * .6 + dy + (1 - alpha) * H * .02); g.restore();
  };
  g.fillStyle = fg;
  switch (anim) {
    case 'fade': g.globalAlpha = e; g.fillText(title, W / 2, ty + (1 - e) * H * .03); g.globalAlpha = 1; subDraw(); break;
    case 'track': g.globalAlpha = e; drawChars(g, title, W / 2, ty, (1 - e) * H * .06 + H * .004, (c, x, y) => g.fillText(c, x, y)); g.globalAlpha = 1; subDraw(); break;
    case 'type': { const n = Math.floor(Array.from(title).length * clamp((t - .3) / 1.4, 0, 1)), shown = Array.from(title).slice(0, n).join('');
      const full = g.measureText(title).width, w = g.measureText(shown).width; g.textAlign = 'left'; g.fillText(shown, W / 2 - full / 2, ty);
      if (Math.floor(t * 2.5) % 2 === 0 || n < Array.from(title).length) { g.fillStyle = acc; g.fillRect(W / 2 - full / 2 + w + H * .01, ty - ts * .45, H * .012, ts * .9); }
      g.textAlign = 'center'; g.fillStyle = fg; subDraw(ease((t - 2) / .8)); break; }
    case 'bounce': drawChars(g, title, W / 2, ty, H * .006, (c, x, y, i) => { const k = clamp((t - .3 - i * .07) / .7, 0, 1); if (k <= 0) return;
      const b = k < 1 ? 1 - Math.abs(Math.cos(k * Math.PI * 2.5)) * (1 - k) : 1; g.save(); g.translate(x, y - (1 - b) * H * .15); g.scale(.6 + .4 * ease(k * 1.5), .6 + .4 * ease(k * 1.5)); g.fillText(c, 0, 0); g.restore(); });
      subDraw(ease((t - 1.3) / .8)); break;
    case 'zoom': { const s = lerp(1.8, 1, e); g.save(); g.globalAlpha = e; g.translate(W / 2, ty); g.scale(s, s); g.fillText(title, 0, 0); g.restore(); subDraw(); break; }
    case 'rise': { g.save(); g.beginPath(); g.rect(0, ty - ts * .75, W, ts * 1.5); g.clip(); g.fillText(title, W / 2, ty + (1 - e) * ts * 1.3); g.restore(); subDraw(); break; }
    case 'neon': { const f = Math.floor(t * 20), on = t > 1.2 || rnd(f) > (1 - t / 1.2) * .7; g.save(); g.shadowColor = acc; g.shadowBlur = on ? H * .04 : 0; g.fillStyle = on ? '#fff' : hexA(acc, .25);
      g.globalAlpha = clamp(t / .3, 0, 1); g.fillText(title, W / 2, ty); if (on) { g.shadowBlur = H * .08; g.globalAlpha *= .6; g.fillText(title, W / 2, ty); } g.restore(); subDraw(); break; }
    case 'glitch': { const f = Math.floor(t * 24), amt = Math.max(0, 1 - t / 1.8) * .8 + (rnd(f) > .93 ? .4 : 0), j = (rnd(f + 1) - .5) * H * .03 * amt;
      g.globalAlpha = clamp(t / .4, 0, 1); g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,0,80,.8)'; g.fillText(title, W / 2 - H * .012 * amt + j, ty); g.fillStyle = 'rgba(0,240,255,.8)'; g.fillText(title, W / 2 + H * .012 * amt - j, ty); g.restore();
      g.fillStyle = fg; g.fillText(title, W / 2 + j * .3, ty);
      if (amt > .2) { for (let i = 0; i < 4; i++) { const y = rnd(f * 7 + i) * H, h = H * .02 * rnd(f + i); g.drawImage(g.canvas, 0, y, W, h, (rnd(f * 3 + i) - .5) * H * .08, y, W, h); } }
      g.globalAlpha = 1; subDraw(); break; }
    case 'roll': { const lines = [title, '', ...String(sub || '').split(/\n|、/)].filter((l, i) => i < 30); const lh = H * .075, total = lines.length * lh, sp = (H + total) / Math.max(1, S.D - .8);
      const y0 = H - t * sp; lines.forEach((l, i) => { if (!l) return; g.font = `${i ? 500 : 800} ${i ? H * .045 : H * .085}px ${FF}`; g.fillStyle = i ? S.subFg : fg; g.fillText(l, W / 2, y0 + i * lh + (i ? lh * .6 : 0)); }); break; }
  }
}

// ---------- 範本清單 ----------
const T_IN = [
  ['經典淡入', 'dark', ['glow'], 'fade', '#f0a83a'],
  ['霓虹燈牌', 'neon', [], 'neon', '#ff4fd8'],
  ['打字機', 'dark', ['scan'], 'type', '#7cffb2'],
  ['電影寬銀幕', 'dark', ['bars', 'sweep'], 'track', '#e8d5a3'],
  ['金色光芒', 'gold', ['rays', 'sweep'], 'zoom', '#f3c75f'],
  ['粒子聚合', 'dark', ['particles'], 'fade', '#5ec8ff'],
  ['斜紋滑入', 'dark', ['stripes'], 'rise', '#ff6b4a'],
  ['漣漪擴散', 'ocean', ['ripples'], 'fade', '#ffffff'],
  ['雙色分割', 'dark', ['split'], 'track', '#3a78ad'],
  ['故障風格', 'tech', ['scan'], 'glitch', '#00f0ff'],
  ['手寫底線', 'paper', ['underline'], 'rise', '#e05a4f'],
  ['方塊拼接', 'dark', ['tiles'], 'zoom', '#8e6cc4'],
  ['流動漸層', 'grad', [], 'zoom', '#6a5cff'],
  ['星際穿越', 'stars', [], 'track', '#ffffff'],
  ['復古膠片', 'film', ['frame'], 'fade', '#f2d8a6'],
  ['極簡線條', 'dark', ['lines'], 'track', '#ffffff'],
  ['彈跳文字', 'pastel', [], 'bounce', '#ff7aa2'],
  ['墨水暈染', 'paper', ['ink'], 'fade', '#1d3557'],
  ['科技網格', 'tech', [], 'rise', '#00f0ff'],
  ['夕陽旅行', 'sunset', [], 'rise', '#fff3d6'],
];
const T_OUT = [
  ['感謝觀看', 'dark', ['glow'], 'fade', '#f0a83a', '感謝觀看', '我們下次見'],
  ['訂閱提醒', 'dark', ['subscribe'], 'rise', '#e0352b', '喜歡就訂閱吧', ''],
  ['片尾名單', 'dark', [], 'roll', '#f0a83a', '感謝觀看', '剪輯　小柯\n攝影　小柯\n音樂　自備配樂\n特別感謝　每一位觀眾'],
  ['下集預告', 'grad', ['arrow'], 'rise', '#ff6b4a', '下集預告', '更多精彩，敬請期待'],
  ['圓形收合', 'dark', ['iris'], 'fade', '#ffffff', '下次見', ''],
  ['霓虹結尾', 'neon', [], 'neon', '#4fd8ff', 'THE END', '感謝收看'],
  ['電影結尾', 'dark', ['bars'], 'track', '#e8d5a3', '劇　終', 'THE END'],
  ['星空結尾', 'stars', [], 'fade', '#ffffff', '感謝觀看', '我們下次見'],
  ['打字機結尾', 'dark', ['scan'], 'type', '#7cffb2', '謝謝收看', '下一支影片見'],
  ['彩帶慶祝', 'pastel', ['confetti'], 'bounce', '#ff7aa2', '完成啦！', '謝謝你看到最後'],
  ['社群追蹤', 'dark', ['socials'], 'rise', '#f0a83a', '追蹤我們', '@你的帳號'],
  ['漸層淡出', 'grad', [], 'fade', '#3a78ad', '感謝觀看', '我們下次見'],
  ['極簡收合', 'dark', ['lines'], 'track', '#ffffff', 'FIN', '感謝觀看'],
  ['故障結束', 'tech', ['scan'], 'glitch', '#00f0ff', 'GAME OVER', '感謝觀看'],
  ['復古膠片', 'film', ['frame'], 'fade', '#f2d8a6', '終', '感謝觀看'],
  ['紙張手寫', 'paper', ['underline'], 'rise', '#e05a4f', '謝謝收看', '下次見'],
  ['愛心飛舞', 'pastel', ['hearts'], 'zoom', '#ff5c8a', '謝謝你', '記得按讚分享'],
  ['光芒放射', 'gold', ['rays'], 'zoom', '#f3c75f', '感謝觀看', '我們下次見'],
  ['海洋浪花', 'ocean', ['ripples'], 'fade', '#ffffff', '感謝觀看', '我們下次見'],
  ['夕陽餘暉', 'sunset', [], 'fade', '#fff3d6', '旅程未完待續', '下一站見'],
];
const TPL = {};
T_IN.forEach(([name, bg, decor, anim, acc], i) => { TPL['intro' + i] = { name, bg, decor, anim, acc, title: '我的影片標題', sub: '副標題・2026 年 10 月', dur: 4, out: false }; });
T_OUT.forEach(([name, bg, decor, anim, acc, title, sub], i) => { TPL['outro' + i] = { name, bg, decor, anim, acc, title, sub, dur: anim === 'roll' ? 8 : 5, out: true }; });

function drawTemplate(g, W, H, t, D, tpl, gen) {
  const S = { g, W, H, t, D, out: tpl.out, acc: gen?.accent || tpl.acc, title: gen?.title ?? tpl.title, sub: gen?.sub ?? tpl.sub };
  const light = LIGHT_BG[tpl.bg];
  S.fg = light ? '#26262e' : '#ffffff'; S.subFg = light ? 'rgba(38,38,46,.7)' : 'rgba(255,255,255,.78)';
  if (tpl.bg === 'paper' && tpl.decor.includes('ink')) S.fg = S.acc;
  g.save();
  (BG[tpl.bg] || BG.dark)(S);
  for (const d of tpl.decor) DECOR[d]?.pre?.(S);
  drawTitles(S, tpl.anim);
  for (const d of tpl.decor) DECOR[d]?.post?.(S);
  if (tpl.out && !tpl.decor.includes('iris')) { const k = clamp((t - (D - .7)) / .7, 0, 1); if (k > 0) { g.fillStyle = `rgba(0,0,0,${k})`; g.fillRect(0, 0, W, H); } }   // 片尾最後淡到黑
  g.restore();
}

// ===== 擷取自影音剪輯助手：const STK = [ =====
const STK = [
  ['右箭頭', g => { g.fillStyle = '#ffcc00'; g.strokeStyle = '#1a1a1a'; g.lineWidth = 14; g.beginPath(); g.moveTo(60, 200); g.lineTo(300, 200); g.lineTo(300, 120); g.lineTo(460, 256); g.lineTo(300, 392); g.lineTo(300, 312); g.lineTo(60, 312); g.closePath(); g.fill(); g.stroke(); }],
  ['曲線箭頭', g => { g.strokeStyle = '#ff3b3b'; g.lineWidth = 30; g.lineCap = 'round'; g.beginPath(); g.moveTo(80, 400); g.quadraticCurveTo(120, 120, 380, 150); g.stroke(); g.fillStyle = '#ff3b3b'; g.beginPath(); g.moveTo(450, 150); g.lineTo(350, 80); g.lineTo(360, 225); g.closePath(); g.fill(); }],
  ['紅色圈選', g => { g.strokeStyle = '#ff2d2d'; g.lineWidth = 20; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i <= 120; i++) { const a = i / 100 * Math.PI * 2 - .4, r = 190 + Math.sin(i * .3) * 8 + i * .3; g.lineTo(256 + Math.cos(a) * r * 1.1, 256 + Math.sin(a) * r * .8); } g.stroke(); }],
  ['手繪底線', g => { g.strokeStyle = '#ffd400'; g.lineWidth = 34; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 280); g.bezierCurveTo(160, 240, 300, 300, 470, 250); g.stroke(); g.lineWidth = 20; g.beginPath(); g.moveTo(90, 330); g.quadraticCurveTo(260, 300, 420, 320); g.stroke(); }],
  ['星星', g => { starPath(g, 256, 270, 220, 95); g.fillStyle = '#ffcf33'; g.fill(); g.lineWidth = 14; g.strokeStyle = '#e09b00'; g.lineJoin = 'round'; g.stroke(); }],
  ['愛心', g => { heartPath(g, 256, 270, 170); const gr = g.createLinearGradient(0, 80, 0, 440); gr.addColorStop(0, '#ff6b8f'); gr.addColorStop(1, '#e8264f'); g.fillStyle = gr; g.fill(); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.ellipse(170, 190, 36, 22, -.6, 0, Math.PI * 2); g.fill(); }],
  ['對話框', g => { g.fillStyle = '#fff'; g.strokeStyle = '#1a1a1a'; g.lineWidth = 12; roundRect(g, 40, 70, 432, 290, 70); g.fill(); g.stroke(); g.beginPath(); g.moveTo(140, 352); g.lineTo(110, 460); g.lineTo(230, 356); g.fill(); g.stroke(); g.fillRect(146, 340, 80, 24); }],
  ['思考泡泡', g => { g.fillStyle = '#fff'; g.strokeStyle = '#1a1a1a'; g.lineWidth = 10; for (const [x, y, r] of [[256, 200, 150], [140, 230, 95], [372, 230, 95], [200, 300, 90], [320, 300, 90]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); }
    for (const [x, y, r] of [[256, 200, 150], [140, 230, 95], [372, 230, 95], [200, 300, 90], [320, 300, 90]]) { g.beginPath(); g.arc(x, y, r - 5, 0, Math.PI * 2); g.fill(); } for (const [x, y, r] of [[120, 410, 30], [70, 470, 18]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); } }],
  ['爆炸框「哇！」', g => { starPath(g, 256, 256, 240, 170, 14); g.fillStyle = '#ffde00'; g.fill(); g.lineWidth = 12; g.strokeStyle = '#e8264f'; g.lineJoin = 'round'; g.stroke(); g.fillStyle = '#e8264f'; g.font = `900 150px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('哇！', 262, 266); }],
  ['驚嘆號', g => { g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; roundRect(g, 222, 90, 68, 220, 30); g.fill(); g.beginPath(); g.arc(256, 380, 40, 0, Math.PI * 2); g.fill(); }],
  ['問號', g => { g.fillStyle = '#3a78ad'; g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = `900 300px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', 256, 270); }],
  ['打勾', g => { g.fillStyle = '#2fb36b'; g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 50; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(150, 262); g.lineTo(225, 340); g.lineTo(370, 175); g.stroke(); }],
  ['打叉', g => { g.fillStyle = '#e0352b'; g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 50; g.lineCap = 'round'; g.beginPath(); g.moveTo(170, 170); g.lineTo(342, 342); g.moveTo(342, 170); g.lineTo(170, 342); g.stroke(); }],
  ['數字 1', g => numBadge(g, '1', '#f0a83a')],
  ['數字 2', g => numBadge(g, '2', '#3a78ad')],
  ['數字 3', g => numBadge(g, '3', '#8e6cc4')],
  ['特價標籤', g => { g.save(); g.translate(256, 256); g.rotate(-.2); g.fillStyle = '#e8264f'; g.beginPath(); g.moveTo(-200, -100); g.lineTo(140, -100); g.lineTo(220, 0); g.lineTo(140, 100); g.lineTo(-200, 100); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(140, 0, 18, 0, Math.PI * 2); g.fill();
    g.font = `900 110px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('特價', -40, 6); g.restore(); }],
  ['NEW 標籤', g => { starPath(g, 256, 256, 230, 195, 18); g.fillStyle = '#2fb36b'; g.fill(); g.fillStyle = '#fff'; g.font = `900 120px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('NEW', 256, 262); }],
  ['訂閱按鈕', g => { g.fillStyle = '#e0352b'; roundRect(g, 26, 180, 380, 150, 75); g.fill(); g.fillStyle = '#fff'; g.font = `800 82px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('訂閱', 216, 258); g.fillStyle = '#ffcc00'; bellPath(g, 452, 250, 46); g.fill(); }],
  ['定位標記', g => { g.fillStyle = '#e8264f'; g.beginPath(); g.moveTo(256, 480); g.bezierCurveTo(120, 320, 90, 250, 90, 200); g.arc(256, 200, 166, Math.PI, 0); g.bezierCurveTo(422, 250, 392, 320, 256, 480); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(256, 200, 66, 0, Math.PI * 2); g.fill(); }],
  ['時鐘', g => { g.fillStyle = '#fff'; g.strokeStyle = '#26262e'; g.lineWidth = 24; g.beginPath(); g.arc(256, 256, 210, 0, Math.PI * 2); g.fill(); g.stroke(); g.lineCap = 'round';
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; g.lineWidth = 10; g.beginPath(); g.moveTo(256 + Math.cos(a) * 170, 256 + Math.sin(a) * 170); g.lineTo(256 + Math.cos(a) * 188, 256 + Math.sin(a) * 188); g.stroke(); }
    g.lineWidth = 20; g.beginPath(); g.moveTo(256, 256); g.lineTo(256, 130); g.moveTo(256, 256); g.lineTo(350, 300); g.stroke(); g.fillStyle = '#e0352b'; g.beginPath(); g.arc(256, 256, 18, 0, Math.PI * 2); g.fill(); }],
  ['太陽', g => { g.fillStyle = '#ffb800'; for (let i = 0; i < 12; i++) { g.save(); g.translate(256, 256); g.rotate(i * Math.PI / 6); g.beginPath(); g.moveTo(-26, -150); g.lineTo(0, -240); g.lineTo(26, -150); g.fill(); g.restore(); } g.fillStyle = '#ffd43b'; g.beginPath(); g.arc(256, 256, 130, 0, Math.PI * 2); g.fill(); }],
  ['月亮', g => { g.fillStyle = '#ffe58a'; g.beginPath(); g.arc(256, 256, 190, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(340, 200, 160, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; g.fillStyle = '#fff6c9'; starPath(g, 380, 330, 30, 12); g.fill(); starPath(g, 430, 230, 18, 7); g.fill(); }],
  ['雲朵', g => { g.fillStyle = '#fff'; g.strokeStyle = '#9fb7c9'; g.lineWidth = 10; const parts = [[160, 290, 90], [250, 230, 120], [350, 280, 95], [420, 320, 60], [90, 330, 55]]; for (const [x, y, r] of parts) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); } for (const [x, y, r] of parts) { g.beginPath(); g.arc(x, y, r - 5, 0, Math.PI * 2); g.fill(); } g.fillRect(90, 300, 330, 80); }],
  ['閃電', g => { g.fillStyle = '#ffd400'; g.strokeStyle = '#26262e'; g.lineWidth = 14; g.lineJoin = 'round'; g.beginPath(); g.moveTo(300, 30); g.lineTo(110, 290); g.lineTo(240, 290); g.lineTo(190, 480); g.lineTo(400, 200); g.lineTo(270, 200); g.closePath(); g.fill(); g.stroke(); }],
  ['音符', g => { g.fillStyle = '#8e6cc4'; g.beginPath(); g.ellipse(170, 390, 80, 58, -.4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(390, 340, 80, 58, -.4, 0, Math.PI * 2); g.fill(); g.fillRect(226, 110, 30, 280); g.fillRect(446, 60, 30, 280); g.beginPath(); g.moveTo(226, 110); g.lineTo(476, 60); g.lineTo(476, 130); g.lineTo(226, 180); g.fill(); }],
  ['皇冠', g => { const gr = g.createLinearGradient(0, 120, 0, 420); gr.addColorStop(0, '#ffe066'); gr.addColorStop(1, '#e0a100'); g.fillStyle = gr; g.beginPath(); g.moveTo(70, 400); g.lineTo(50, 150); g.lineTo(160, 270); g.lineTo(256, 100); g.lineTo(352, 270); g.lineTo(462, 150); g.lineTo(442, 400); g.closePath(); g.fill();
    g.fillStyle = '#e8264f'; for (const x of [150, 256, 362]) { g.beginPath(); g.arc(x, 345, 24, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ffe066'; for (const [x, y] of [[50, 140], [256, 88], [462, 140]]) { g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.fill(); } }],
  ['閃亮光點', g => { g.fillStyle = '#fff'; g.shadowColor = '#ffe9a8'; g.shadowBlur = 40; for (const [x, y, s] of [[256, 256, 200], [110, 120, 70], [400, 400, 80]]) { g.beginPath(); g.moveTo(x, y - s); g.quadraticCurveTo(x, y, x + s * .55, y); g.quadraticCurveTo(x, y, x, y + s); g.quadraticCurveTo(x, y, x - s * .55, y); g.quadraticCurveTo(x, y, x, y - s); g.fill(); } }],
  ['相框邊框', g => { const W = 1280, H = 720; g.strokeStyle = '#fff'; g.lineWidth = 28; g.strokeRect(44, 44, W - 88, H - 88); g.lineWidth = 6; g.strokeStyle = '#f0a83a'; g.strokeRect(78, 78, W - 156, H - 156);
    g.fillStyle = '#f0a83a'; for (const [x, y] of [[78, 78], [W - 78, 78], [78, H - 78], [W - 78, H - 78]]) { g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill(); } }, [1280, 720], 100],
  ['下方標題條', g => { const W = 1280, H = 720; const gr = g.createLinearGradient(60, 0, 820, 0); gr.addColorStop(0, 'rgba(12,14,17,.85)'); gr.addColorStop(1, 'rgba(12,14,17,0)'); g.fillStyle = gr; g.fillRect(60, 560, 760, 100); g.fillStyle = '#f0a83a'; g.fillRect(60, 560, 12, 100); g.fillRect(84, 646, 300, 4); }, [1280, 720], 100],
];
function numBadge(g, n, col) { g.fillStyle = col; g.beginPath(); g.arc(256, 256, 220, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 18; g.beginPath(); g.arc(256, 256, 190, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fff'; g.font = `900 270px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(n, 256, 272); }

// ===== 擷取自影音剪輯助手：const lin = cols =====
const lin = cols => S => { const { g, W, H } = S, gr = g.createLinearGradient(0, 0, W, H); cols.forEach((c, i) => gr.addColorStop(i / (cols.length - 1), c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
const withAcc = (fn, acc) => S => fn(Object.assign(S, { acc }));
let noiseCv = null;
const BASIC = {
  lin1: lin(['#0f2027', '#203a43', '#2c5364']),
  lin2: lin(['#ff7e5f', '#feb47b']),
  lin3: lin(['#fbc2eb', '#a6c1ee']),
  lin4: lin(['#43e97b', '#38f9d7']),
  stars: S => BG.stars(S),
  tech: withAcc(S => BG.tech(S), '#00f0ff'),
  ocean: S => BG.ocean(S),
  sunset: S => BG.sunset(S),
  paper: S => BG.paper(S),
  film: S => BG.film(S),
  neon: withAcc(S => BG.neon(S), '#ff4fd8'),
  gold: withAcc(S => { BG.gold(S); DECOR.rays.pre(S); }, '#f3c75f'),
  pastel: S => BG.pastel(S),
  confetti: S => { BG.pastel(S); DECOR.confetti.post(S); },
  hearts: withAcc(S => { BG.pastel(S); DECOR.hearts.post(S); }, '#ff5c8a'),
  rays: S => { const { g, W, H, t } = S; g.fillStyle = '#1b1035'; g.fillRect(0, 0, W, H); g.save(); g.translate(W / 2, H / 2); g.rotate(t * .3);
    for (let i = 0; i < 18; i++) { g.rotate(Math.PI / 9); g.fillStyle = `hsla(${i * 20 + t * 40},80%,60%,.55)`; g.beginPath(); g.moveTo(0, 0); g.lineTo(W, -W * .09); g.lineTo(W, W * .09); g.fill(); } g.restore(); },
  bokeh: S => { const { g, W, H, t } = S; g.fillStyle = '#0b0d14'; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 34; i++) { const x = (rnd(i) * W + t * W * .02 * (rnd(i + 1) - .5) * 4 + W) % W, y = (rnd(i + 2) * H + Math.sin(t * .6 + i) * H * .03), r = H * (.04 + rnd(i + 3) * .1);
      const gr = g.createRadialGradient(x, y, 0, x, y, r); const col = `hsla(${30 + rnd(i + 4) * 60},90%,${55 + rnd(i + 5) * 20}%,`; gr.addColorStop(0, col + '.5)'); gr.addColorStop(.7, col + '.25)'); gr.addColorStop(1, col + '0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } g.globalCompositeOperation = 'source-over'; },
  rain: S => { const { g, W, H, t } = S; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1c2633'); gr.addColorStop(1, '#3a4a5c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(200,220,255,.45)'; g.lineWidth = Math.max(1, H / 600);
    for (let i = 0; i < 180; i++) { const sp = .9 + rnd(i) * .8, x = rnd(i + 1) * W * 1.1, y = ((rnd(i + 2) + t * sp) % 1) * H * 1.1 - H * .05, l = H * (.03 + rnd(i + 3) * .04); g.beginPath(); g.moveTo(x, y); g.lineTo(x - l * .2, y + l); g.stroke(); } },
  snow: S => { const { g, W, H, t } = S; const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0d1b3e'); gr.addColorStop(1, '#3d5a8a'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff';
    for (let i = 0; i < 170; i++) { const z = .4 + rnd(i) * .6, x = (rnd(i + 1) * W + Math.sin(t * .8 + i) * W * .02 * z), y = ((rnd(i + 2) + t * .08 * z) % 1) * H * 1.05 - H * .02; g.globalAlpha = .5 + z * .5; g.beginPath(); g.arc(x, y, H * .004 * z * 2, 0, Math.PI * 2); g.fill(); } g.globalAlpha = 1; },
  checker: S => { const { g, W, H, t } = S, s = H / 9, o = (t * s * .6) % (s * 2); for (let x = -s * 2; x < W + s * 2; x += s) for (let y = -s * 2; y < H + s * 2; y += s) { const i = Math.round((x + y) / s); g.fillStyle = i % 2 ? '#2e3a59' : '#3f4f78'; g.fillRect(x + o, y + o * .5, s + 1, s + 1); } },
  stripes: S => { const { g, W, H, t } = S, w = H / 10; g.fillStyle = '#f0a83a'; g.fillRect(0, 0, W, H); g.save(); g.translate(W / 2, H / 2); g.rotate(-Math.PI / 4); g.fillStyle = '#1b1306';
    const L = Math.hypot(W, H), o = (t * w) % (w * 2); for (let x = -L; x < L; x += w * 2) g.fillRect(x + o, -L, w, L * 2); g.restore(); },
  noise: S => { const { g, W, H, t } = S; const nw = 200, nh = Math.max(2, Math.round(200 * H / W)); if (!noiseCv) noiseCv = document.createElement('canvas'); noiseCv.width = nw; noiseCv.height = nh;
    const n = noiseCv.getContext('2d'), im = n.createImageData(nw, nh), f = Math.floor(t * 30); for (let i = 0; i < nw * nh; i++) { const v = rnd(f * 7919 + i * 13.7) * 255; im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    n.putImageData(im, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(noiseCv, 0, 0, W, H); g.imageSmoothingEnabled = true; g.fillStyle = 'rgba(0,0,0,.25)'; for (let y = 0; y < H; y += H / 120) g.fillRect(0, y, W, H / 360); },
  timer: S => { const { g, W, H, t, D } = S; g.fillStyle = '#0c0e11'; g.fillRect(0, 0, W, H); const r = H * .34, k = clamp(t / Math.max(.1, D), 0, 1);
    g.lineWidth = H * .025; g.strokeStyle = '#2b3138'; g.beginPath(); g.arc(W / 2, H / 2, r, 0, Math.PI * 2); g.stroke(); g.strokeStyle = '#f0a83a'; g.lineCap = 'round'; g.beginPath(); g.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); g.stroke();
    const left = Math.max(0, D - t), mm = Math.floor(left / 60), ss = Math.floor(left % 60), cs = Math.floor((left % 1) * 100);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `700 ${H * .16}px "JetBrains Mono",ui-monospace,monospace`; g.fillText(`${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`, W / 2, H / 2 - H * .02);
    g.font = `500 ${H * .05}px "JetBrains Mono",ui-monospace,monospace`; g.fillStyle = '#8a939c'; g.fillText('.' + String(cs).padStart(2, '0'), W / 2, H / 2 + H * .12); },
};

// ===== 擷取自影音剪輯助手：const scratchCv = {}; =====
const scratchCv = {};
function scratch(k, w, h) { let c = scratchCv[k]; if (!c) c = scratchCv[k] = document.createElement('canvas'); if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } return c; }
function mixHex(a, b, k) { const p = h => [1, 3, 5].map(i => parseInt(String(h).slice(i, i + 2), 16) || 0), x = p(a), y = p(b); return '#' + x.map((v, i) => Math.round(lerp(v, y[i], k)).toString(16).padStart(2, '0')).join(''); }

// ---------- 蒙版：套在畫面片段上，只露出形狀範圍（形狀外變透明，看得到下層軌道） ----------
// fn(g, w, h, t)：以片段中心為原點，用目前的 fillStyle 畫出「要露出來」的範圍；w×h 是片段在畫面上的大小，t 是片段內秒數（動態蒙版用）
const poly = (g, pts) => { g.beginPath(); pts.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fill(); };
const ngon = (g, n, r, rot) => poly(g, Array.from({ length: n }, (_, i) => [Math.cos(rot + i * 2 * Math.PI / n) * r, Math.sin(rot + i * 2 * Math.PI / n) * r]));
const circ = (g, x, y, r) => { g.beginPath(); g.arc(x, y, Math.max(0, r), 0, Math.PI * 2); g.fill(); };
const MASKS = [
  ['circle', '圓形', (g, w, h) => circ(g, 0, 0, Math.min(w, h) * .45)],
  ['ellipse', '橢圓', (g, w, h) => { g.beginPath(); g.ellipse(0, 0, w * .45, h * .45, 0, 0, Math.PI * 2); g.fill(); }],
  ['round', '圓角矩形', (g, w, h) => { roundRect(g, -w * .42, -h * .42, w * .84, h * .84, Math.min(w, h) * .12); g.fill(); }],
  ['diamond', '菱形', (g, w, h) => poly(g, [[0, -h * .47], [w * .47, 0], [0, h * .47], [-w * .47, 0]])],
  ['triangle', '三角形', (g, w, h) => { const s = Math.min(w, h) * .46; poly(g, [[0, -s], [s * 1.15, s * .8], [-s * 1.15, s * .8]]); }],
  ['star', '五角星', (g, w, h) => { const s = Math.min(w, h) * .48; starPath(g, 0, s * .08, s, s * .42); g.fill(); }],
  ['hexagon', '六角形', (g, w, h) => ngon(g, 6, Math.min(w, h) * .46, 0)],
  ['octagon', '八角形', (g, w, h) => ngon(g, 8, Math.min(w, h) * .46, Math.PI / 8)],
  ['heart', '愛心', (g, w, h) => { const s = Math.min(w, h) * .4; heartPath(g, 0, s * .05, s); g.fill(); }],
  ['cloud', '雲朵', (g, w, h) => { const s = Math.min(w, h) * .2; for (const [x, y, r] of [[-1.5, .4, 1], [-.6, -.3, 1.3], [.6, -.5, 1.5], [1.6, .3, 1.05], [0, .55, 1.1]]) circ(g, x * s, y * s, r * s); g.fillRect(-1.5 * s, .4 * s, 3.1 * s, s); }],
  ['bubble', '對話框', (g, w, h) => { roundRect(g, -w * .42, -h * .4, w * .84, h * .62, Math.min(w, h) * .1); g.fill(); poly(g, [[-w * .2, h * .2], [-w * .05, h * .2], [-w * .26, h * .44]]); }],
  ['arch', '拱門', (g, w, h) => { const a = Math.min(w * .32, h * .42), b = h * .46; g.beginPath(); g.moveTo(-a, b); g.lineTo(-a, -b + a); g.arc(0, -b + a, a, Math.PI, 0); g.lineTo(a, b); g.closePath(); g.fill(); }],
  ['shield', '盾牌', (g, w, h) => { const s = Math.min(w, h) * .46; g.beginPath(); g.moveTo(-s * .8, -s); g.lineTo(s * .8, -s); g.lineTo(s * .8, 0); g.quadraticCurveTo(s * .8, s * .7, 0, s); g.quadraticCurveTo(-s * .8, s * .7, -s * .8, 0); g.closePath(); g.fill(); }],
  ['cross', '十字', (g, w, h) => { const s = Math.min(w, h) * .46; g.fillRect(-s * .3, -s, s * .6, s * 2); g.fillRect(-s, -s * .3, s * 2, s * .6); }],
  ['arrow', '箭頭', (g, w, h) => { const s = Math.min(w, h) * .46; poly(g, [[-s * 1.3, -s * .35], [s * .2, -s * .35], [s * .2, -s * .8], [s * 1.3, 0], [s * .2, s * .8], [s * .2, s * .35], [-s * 1.3, s * .35]]); }],
  ['moon', '月亮', (g, w, h) => { const s = Math.min(w, h) * .45; circ(g, 0, 0, s); g.save(); g.globalCompositeOperation = 'destination-out'; circ(g, s * .45, -s * .25, s * .85); g.restore(); }],
  ['flower', '花朵', (g, w, h) => { const s = Math.min(w, h) * .2; for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; circ(g, Math.cos(a) * s * 1.2, Math.sin(a) * s * 1.2, s); } circ(g, 0, 0, s * 1.2); }],
  ['drop', '水滴', (g, w, h) => { const s = Math.min(w, h) * .46; g.beginPath(); g.moveTo(0, -s); g.bezierCurveTo(s * .3, -s * .55, s * .66, -s * .1, s * .66, s * .3); g.arc(0, s * .3, s * .66, 0, Math.PI); g.bezierCurveTo(-s * .66, -s * .1, -s * .3, -s * .55, 0, -s); g.fill(); }],
  ['pill', '膠囊', (g, w, h) => { roundRect(g, -w * .42, -h * .24, w * .84, h * .48, Math.min(h * .24, w * .42)); g.fill(); }],
  ['keyhole', '鑰匙孔', (g, w, h) => { const s = Math.min(w, h) * .46; circ(g, 0, -s * .35, s * .45); poly(g, [[-s * .2, -s * .1], [s * .2, -s * .1], [s * .45, s], [-s * .45, s]]); }],
  ['slant', '斜切', (g, w, h) => poly(g, [[-w * .32, -h * .45], [w * .48, -h * .45], [w * .32, h * .45], [-w * .48, h * .45]])],
  ['left', '左半畫面', (g, w, h) => g.fillRect(-w / 2, -h / 2, w / 2, h)],
  ['right', '右半畫面', (g, w, h) => g.fillRect(0, -h / 2, w / 2, h)],
  ['cinema', '電影寬銀幕', (g, w, h) => { const bh = Math.min(h, w / 2.39); g.fillRect(-w / 2, -bh / 2, w, bh); }],
  ['portrait', '直式中段', (g, w, h) => { const bw = Math.min(w, h * 9 / 16); g.fillRect(-bw / 2, -h / 2, bw, h); }],
  ['soft', '柔邊暈影', (g, w, h) => { g.beginPath(); g.ellipse(0, 0, w * .4, h * .4, 0, 0, Math.PI * 2); g.fill(); }, 35],
  ['irisOpen', '圓形展開（動態）', (g, w, h, t) => circ(g, 0, 0, ease(t / 1.2) * Math.hypot(w, h) / 2)],
  ['wipe', '由左擦入（動態）', (g, w, h, t) => g.fillRect(-w / 2, -h / 2, w * ease(t), h)],
  ['blinds', '百葉窗（動態）', (g, w, h, t) => { const n = 8, sh = h / n; for (let i = 0; i < n; i++) g.fillRect(-w / 2, -h / 2 + i * sh, w, sh * ease((t - i * .06) / .7)); }],
  ['spot', '聚光燈（動態）', (g, w, h, t) => circ(g, Math.sin(t * .9) * w * .28, Math.sin(t * 1.3 + 1) * h * .18, Math.min(w, h) * .3), 20],
];
const MASK = Object.fromEntries(MASKS.map(([id, name, fn, feather]) => [id, { id, name, fn, feather: feather || 0 }]));
// 先把片段畫到暫存畫布，再用形狀（可柔化、反轉）裁切後疊回去

// ===== 擷取自影音剪輯助手：function chromaKey( =====
function chromaKey(src, sw, sh, key) {
  const sc = Math.min(1, 1280 / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * sc)), h = Math.max(1, Math.round(sh * sc));
  const K = scratch('key', w, h), g = K.getContext('2d', { willReadFrequently: true });
  g.clearRect(0, 0, w, h); g.drawImage(src, 0, 0, w, h);
  let im; try { im = g.getImageData(0, 0, w, h); } catch { return null; }
  const d = im.data, blue = key.color === 'blue', lo = 70 - clamp(key.amt ?? 50, 0, 100) * .6, hi = lo + 45;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], m = blue ? b - Math.max(r, gg) : gg - Math.max(r, b);
    if (m <= 0) continue;
    if (blue) d[i + 2] = Math.max(r, gg); else d[i + 1] = Math.max(r, b);
    if (m > lo) d[i + 3] = m >= hi ? 0 : d[i + 3] * (1 - (m - lo) / (hi - lo));
  }
  g.putImageData(im, 0, 0);
  return K;
}

// ---------- 綠幕素材 20 個：綠色背景＋動態元素（放到疊加軌會自動去背） ----------
const CONF = ['#ff2d55', '#ffd400', '#2d9cff', '#ff8a00', '#b06bff', '#ffffff'];
const GS = [
  ['訂閱按鈕', 4, ({ g, W, H, t }) => { const u = H / 100, k = easeBack(clamp(t / .5, 0, 1)), done = t > 1.6;
    g.save(); g.translate(W / 2 - 6 * u, H / 2); g.scale(k, k);
    g.fillStyle = done ? '#55595f' : '#e0352b'; roundRect(g, -22 * u, -7 * u, 44 * u, 14 * u, 7 * u); g.fill();
    g.fillStyle = '#fff'; g.font = `800 ${7 * u}px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(done ? '已訂閱' : '訂閱', 0, .5 * u);
    g.save(); g.translate(30 * u, 0); g.rotate(done ? Math.sin(t * 20) * .3 * Math.max(0, 1 - (t - 1.6)) : 0); g.fillStyle = '#fff'; bellPath(g, 0, 0, 5 * u); g.fill(); g.restore(); g.restore();
    if (t > .6 && t < 2.6) { const p = ease((t - .6) / .9), s = t > 1.5 && t < 1.7 ? .85 : 1; g.save(); g.translate(lerp(W * .75, W / 2 - 2 * u, p), lerp(H * .85, H / 2 + 3 * u, p)); g.scale(s, s); g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = .4 * u; cursorPath(g, 0, 0, 7 * u); g.fill(); g.stroke(); g.restore(); } }],
  ['按讚', 3, ({ g, W, H, t }) => { const u = H / 100, k = easeBack(clamp(t / .45, 0, 1)), wob = Math.sin(t * 9) * .08 * Math.max(0, 1 - t);
    g.save(); g.translate(W / 2, H / 2); g.rotate(-.15 + wob); g.scale(k, k); g.fillStyle = '#1877f2'; circ(g, 0, 0, 22 * u); g.fillStyle = '#fff';
    roundRect(g, -12 * u, -1 * u, 6 * u, 13 * u, 1.5 * u); g.fill(); roundRect(g, -4 * u, -2 * u, 15 * u, 14 * u, 3.5 * u); g.fill(); roundRect(g, -2 * u, -14 * u, 7 * u, 15 * u, 3.5 * u); g.fill(); g.restore();
    const p = clamp((t - .35) / .6, 0, 1); if (p > 0 && p < 1) { g.strokeStyle = `rgba(255,214,0,${1 - p})`; g.lineWidth = 1.4 * u; for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = (24 + p * 16) * u; g.beginPath(); g.moveTo(W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r); g.lineTo(W / 2 + Math.cos(a) * (r + 5 * u), H / 2 + Math.sin(a) * (r + 5 * u)); g.stroke(); } } }],
  ['愛心飛出', 4, ({ g, W, H, t }) => { const u = H / 100; for (let i = 0; i < 26; i++) { const k = (t - rnd(i) * 2.2) / 1.8; if (k <= 0 || k >= 1) continue;
    const x = W / 2 + (rnd(i + 9) - .5) * 60 * u * k + Math.sin(k * 6 + i) * 3 * u, y = H * .85 - k * 70 * u, s = (3 + rnd(i + 3) * 4) * u * Math.min(1, k / .15);
    g.globalAlpha = k > .7 ? (1 - k) / .3 : 1; g.fillStyle = ['#ff2d55', '#ff6b9a', '#ff9fb8', '#e8264f'][i % 4]; heartPath(g, x, y, s); g.fill(); } g.globalAlpha = 1; }],
  ['爆炸', 3, ({ g, W, H, t }) => { const u = H / 100, cx = W / 2, cy = H / 2, k = ease(t / .5), p = clamp((t - .2) / 2.2, 0, 1);
    if (p > 0) for (let i = 0; i < 9; i++) { g.fillStyle = `rgba(90,90,95,${(1 - p) * .8})`; circ(g, cx + Math.cos(i * .7) * 18 * u * p, cy - 10 * u * p + Math.sin(i * 1.3) * 10 * u * p, (8 + rnd(i) * 6) * u * (.5 + p)); }
    g.globalAlpha = clamp(1.6 - t, 0, 1); const R = 34 * u * k; g.fillStyle = '#ff5a1f'; starPath(g, cx, cy, R, R * .55, 14); g.fill(); g.fillStyle = '#ffc21a'; starPath(g, cx, cy, R * .72, R * .4, 12); g.fill(); g.fillStyle = '#fff6c8'; circ(g, cx, cy, R * .3);
    g.fillStyle = '#ffb000'; for (let i = 0; i < 24; i++) { const a = rnd(i + 40) * Math.PI * 2, r = (10 + 50 * ease(t / 1.2)) * u * (.6 + rnd(i) * .6); circ(g, cx + Math.cos(a) * r, cy + Math.sin(a) * r + t * t * 6 * u, 1.2 * u); } g.globalAlpha = 1; }],
  ['煙火', 4, ({ g, W, H, t }) => { const u = H / 100; [[.3, .3, 0, 0], [.7, .25, .9, 330], [.5, .35, 1.8, 42]].forEach(([fx, fy, st, hue], j) => { const k = t - st; if (k < 0) return; const x = W * fx, y = H * fy;
    if (k < .6) { g.fillStyle = '#ffe9a8'; circ(g, x, H - (H - y) * ease(k / .6), .8 * u); return; }
    const p = (k - .6) / 1.6; if (p >= 1) return; g.globalAlpha = 1 - p; for (let i = 0; i < 40; i++) { const a = i / 40 * Math.PI * 2, r = 22 * u * ease(p) * (.8 + rnd(i + j * 50) * .3); g.fillStyle = `hsl(${hue + (i % 3) * 8},95%,62%)`; circ(g, x + Math.cos(a) * r, y + Math.sin(a) * r + p * p * 8 * u, .9 * u); } g.globalAlpha = 1; }); }],
  ['閃電', 3, ({ g, W, H, t }) => { if (t % 1 > .35) return; const u = H / 100, seed = Math.floor(t) + 1; g.save(); g.globalAlpha = t % 1 < .08 || t % 1 > .2 ? 1 : .4; g.shadowColor = '#bcd7ff'; g.shadowBlur = 6 * u; g.strokeStyle = '#ffffff'; g.lineWidth = 1.6 * u; g.lineJoin = 'round';
    g.beginPath(); let x = W * (.35 + rnd(seed) * .3), y = 0; g.moveTo(x, y); while (y < H * .9) { y += (6 + rnd(seed * 31 + y) * 8) * u; x += (rnd(seed * 17 + y) - .5) * 14 * u; g.lineTo(x, y); } g.stroke(); g.shadowBlur = 0; g.lineWidth = .7 * u; g.strokeStyle = '#fff59d'; g.stroke(); g.restore(); }],
  ['火焰', 4, ({ g, W, H, t }) => { const u = H / 100; for (let L = 0; L < 3; L++) for (let i = 0; i < 14; i++) { const x = W * (.2 + i / 13 * .6), fl = Math.sin(t * (7 + i % 3) + i * 1.7) * .5 + .5, h = (18 + rnd(i + L * 20) * 22) * u * (1 - L * .25) * (.75 + fl * .35), w = 5 * u * (1 - L * .2);
    g.fillStyle = ['#ff3d00', '#ff9100', '#ffd54f'][L]; g.beginPath(); g.moveTo(x - w, H * .9); g.quadraticCurveTo(x - w * 1.1, H * .9 - h * .5, x + Math.sin(t * 5 + i) * 2 * u, H * .9 - h); g.quadraticCurveTo(x + w * 1.1, H * .9 - h * .5, x + w, H * .9); g.closePath(); g.fill(); } }],
  ['彩帶噴發', 4, ({ g, W, H, t }) => { const u = H / 100; for (let i = 0; i < 120; i++) { const k = t - rnd(i) * .3; if (k < 0) continue; const vx = (20 + rnd(i + 5) * 35) * u, vy = (60 + rnd(i + 7) * 40) * u;
    const x = i % 2 ? W - vx * k : vx * k, y = H - vy * k + 34 * u * k * k; if (y > H + 5 * u) continue; g.save(); g.translate(x, y); g.rotate(k * (4 + rnd(i) * 6)); g.fillStyle = CONF[i % 6]; g.fillRect(-u, -.5 * u, 2 * u, 1.2 * u * (1 + Math.sin(k * 10 + i))); g.restore(); } }],
  ['3-2-1 倒數', 4, ({ g, W, H, t }) => { const u = H / 100, i = Math.min(3, Math.floor(t)), k = t - i, s = easeBack(clamp(k / .35, 0, 1));
    g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.globalAlpha = k > .85 && i < 3 ? (1 - k) / .15 : 1; g.fillStyle = '#1b1d22'; circ(g, 0, 0, 24 * u); g.lineWidth = 2.5 * u; g.strokeStyle = '#ffd400'; g.beginPath(); g.arc(0, 0, 24 * u, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, k)); g.stroke();
    g.fillStyle = '#fff'; g.font = `900 ${i < 3 ? 30 * u : 17 * u}px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['3', '2', '1', 'GO!'][i], 0, 1.5 * u); g.restore(); }],
  ['新聞快訊條', 5, ({ g, W, H, t }) => { const u = H / 100, x0 = lerp(-30 * u, 6 * u, ease(t / .6)), y = H * .74, k2 = ease((t - .3) / .6);
    g.fillStyle = '#d7191c'; g.fillRect(x0, y, 22 * u, 11 * u); g.fillStyle = '#fff'; g.font = `800 ${6 * u}px ${FF}`; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText('快訊', x0 + 11 * u, y + 5.7 * u);
    g.fillStyle = '#ffffff'; g.fillRect(28 * u, y, (W - 34 * u) * k2, 11 * u); g.fillStyle = '#1b1d22'; g.fillRect(28 * u, y + 11 * u, (W - 34 * u) * k2, 6 * u);
    if (k2 > .9) { g.save(); g.beginPath(); g.rect(28 * u, y, W - 34 * u, 17 * u); g.clip(); g.textAlign = 'left'; g.fillStyle = '#1b1d22'; g.font = `700 ${5.4 * u}px ${FF}`; g.fillText('重大消息：在這裡放上你的標題', 31 * u, y + 5.7 * u);
      g.fillStyle = '#fff'; g.font = `500 ${3.4 * u}px ${FF}`; g.fillText('最新動態持續更新中・歡迎訂閱追蹤・'.repeat(6), 31 * u - (t * 14 * u) % (80 * u), y + 14 * u); g.restore(); } }],
  ['對話泡泡', 3, ({ g, W, H, t }) => { const u = H / 100, s = easeBack(clamp(t / .4, 0, 1));
    g.save(); g.translate(W / 2, H / 2); g.rotate(Math.sin(t * 6) * .03); g.scale(s, s); g.fillStyle = '#fff'; g.strokeStyle = '#1b1d22'; g.lineWidth = 1.2 * u;
    roundRect(g, -28 * u, -18 * u, 56 * u, 30 * u, 10 * u); g.fill(); g.stroke(); g.beginPath(); g.moveTo(-10 * u, 11 * u); g.lineTo(-18 * u, 24 * u); g.lineTo(-2 * u, 11 * u); g.fill(); g.stroke(); g.fillRect(-9.3 * u, 9 * u, 6.6 * u, 2.6 * u);
    g.fillStyle = '#e8264f'; g.font = `900 ${15 * u}px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('哇！', 0, -3 * u); g.restore(); }],
  ['箭頭指示', 3, ({ g, W, H, t }) => { const u = H / 100, s = easeBack(clamp(t / .4, 0, 1)); g.save(); g.translate(W / 2, H * .42 + Math.abs(Math.sin(t * 5)) * 8 * u); g.scale(s, s);
    g.fillStyle = '#ff2d2d'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * u; g.lineJoin = 'round'; g.beginPath(); for (const [x, y] of [[-7, -22], [7, -22], [7, -2], [16, -2], [0, 18], [-16, -2], [-7, -2]]) g.lineTo(x * u, y * u); g.closePath(); g.fill(); g.stroke(); g.restore(); }],
  ['星星閃爍', 4, ({ g, W, H, t }) => { const u = H / 100; for (let i = 0; i < 16; i++) { const p = (t * .8 + rnd(i)) % 1, s = Math.sin(p * Math.PI) * (3 + rnd(i + 2) * 5) * u; if (s <= .1) continue;
    g.fillStyle = i % 3 ? '#fff59d' : '#ffffff'; g.save(); g.translate(W * (.15 + rnd(i + 5) * .7), H * (.15 + rnd(i + 8) * .7)); g.rotate(t + i); starPath(g, 0, 0, s, s * .35, 4); g.fill(); g.restore(); } }],
  ['金幣掉落', 4, ({ g, W, H, t }) => { const u = H / 100; for (let i = 0; i < 24; i++) { const y = ((t * (.5 + rnd(i) * .5) + rnd(i + 3)) % 1.2) * H * 1.1 - 8 * u, x = W * (.08 + rnd(i + 7) * .84), sx = Math.cos(t * (3 + rnd(i) * 3) + i), r = 4 * u;
    g.save(); g.translate(x, y); g.scale(Math.max(.08, Math.abs(sx)), 1); g.fillStyle = '#c98a00'; circ(g, .6 * u, 0, r); g.fillStyle = '#ffcf33'; circ(g, 0, 0, r); g.fillStyle = '#e6a800'; g.font = `900 ${4.6 * u}px ${FF}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('$', 0, .3 * u); g.restore(); } }],
  ['下雨雲朵', 4, ({ g, W, H, t }) => { const u = H / 100, cx = W / 2 + Math.sin(t) * 3 * u, cy = H * .32;
    g.strokeStyle = '#4fa3ff'; g.lineWidth = .8 * u; g.lineCap = 'round'; for (let i = 0; i < 26; i++) { const x = cx + (rnd(i) - .5) * 40 * u, y = cy + 8 * u + ((t * 1.4 + rnd(i + 4)) % 1) * 45 * u; g.beginPath(); g.moveTo(x, y); g.lineTo(x - u, y + 4 * u); g.stroke(); }
    g.fillStyle = '#e9edf2'; for (const [x, y, r] of [[-15, 3, 9], [-5, -4, 12], [9, -2, 11], [18, 4, 8], [0, 5, 10]]) circ(g, cx + x * u, cy + y * u, r * u); g.fillRect(cx - 15 * u, cy + 2 * u, 33 * u, 10 * u); }],
  ['雪花飄落', 5, ({ g, W, H, t }) => { const u = H / 100; g.strokeStyle = '#fff'; g.lineCap = 'round'; for (let i = 0; i < 30; i++) { const z = .5 + rnd(i) * .5, x = W * rnd(i + 2) + Math.sin(t + i) * 4 * u, y = ((t * .12 * z + rnd(i + 5)) % 1) * H * 1.1 - 5 * u, s = 3.5 * u * z;
    g.lineWidth = .45 * u * z; g.save(); g.translate(x, y); g.rotate(t * .5 + i); for (let k = 0; k < 6; k++) { g.rotate(Math.PI / 3); g.beginPath(); g.moveTo(0, 0); g.lineTo(0, s); g.moveTo(0, s * .6); g.lineTo(s * .25, s * .8); g.moveTo(0, s * .6); g.lineTo(-s * .25, s * .8); g.stroke(); } g.restore(); } }],
  ['泡泡上升', 5, ({ g, W, H, t }) => { const u = H / 100; for (let i = 0; i < 22; i++) { const y = H * 1.1 - ((t * (.12 + rnd(i) * .12) + rnd(i + 3)) % 1) * H * 1.25, x = W * (.1 + rnd(i + 6) * .8) + Math.sin(t * 2 + i) * 2 * u, r = (2 + rnd(i + 9) * 5) * u;
    g.fillStyle = 'rgba(175,218,255,.8)'; circ(g, x, y, r); g.strokeStyle = '#eaf6ff'; g.lineWidth = .35 * u; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#fff'; circ(g, x - r * .35, y - r * .35, r * .22); } }],
  ['音符跳動', 4, ({ g, W, H, t }) => { const u = H / 100, cols = ['#b06bff', '#ff4f7b', '#2d9cff', '#ffc400', '#ff8a00']; for (let i = 0; i < 5; i++) { const s = easeBack(clamp((t - i * .12) / .4, 0, 1)); if (s <= 0) continue;
    g.save(); g.translate(W * (.25 + i * .125), H * .55 - Math.abs(Math.sin(t * 3 + i * .9)) * 14 * u); g.scale(s, s); g.rotate(Math.sin(t * 3 + i) * .15); g.fillStyle = cols[i];
    g.beginPath(); g.ellipse(-2 * u, 6 * u, 4 * u, 3 * u, -.4, 0, Math.PI * 2); g.fill(); g.fillRect(1.2 * u, -12 * u, 1.4 * u, 18 * u);
    if (i % 2) g.fillRect(1.2 * u, -12 * u, 7 * u, 2.2 * u); else { g.beginPath(); g.moveTo(2.6 * u, -12 * u); g.quadraticCurveTo(9 * u, -8 * u, 6 * u, -1 * u); g.lineTo(5 * u, -2 * u); g.quadraticCurveTo(6 * u, -7 * u, 2.6 * u, -8 * u); g.fill(); } g.restore(); } }],
  ['打勾完成', 3, ({ g, W, H, t }) => { const u = H / 100, s = easeBack(clamp(t / .4, 0, 1)), k = ease((t - .35) / .5); g.save(); g.translate(W / 2, H / 2); g.scale(s, s); g.fillStyle = '#2d7dff'; circ(g, 0, 0, 22 * u);
    if (k > 0) { const p = [[-10, 1], [-3, 8], [11, -8]], L1 = 9.9, L2 = 21.3, d = k * (L1 + L2); g.strokeStyle = '#fff'; g.lineWidth = 4.5 * u; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(p[0][0] * u, p[0][1] * u);
      if (d <= L1) g.lineTo(lerp(p[0][0], p[1][0], d / L1) * u, lerp(p[0][1], p[1][1], d / L1) * u); else { g.lineTo(p[1][0] * u, p[1][1] * u); g.lineTo(lerp(p[1][0], p[2][0], (d - L1) / L2) * u, lerp(p[1][1], p[2][1], (d - L1) / L2) * u); } g.stroke(); } g.restore(); }],
  ['驚嘆號警示', 3, ({ g, W, H, t }) => { const u = H / 100, s = easeBack(clamp(t / .4, 0, 1)); g.save(); g.translate(W / 2, H / 2); g.rotate(t > .5 && t < 1.3 ? Math.sin(t * 40) * .06 : 0); g.scale(s, s);
    g.fillStyle = '#ffcc00'; g.strokeStyle = '#1b1d22'; g.lineWidth = 2.2 * u; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, -24 * u); g.lineTo(26 * u, 20 * u); g.lineTo(-26 * u, 20 * u); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1b1d22'; roundRect(g, -2.6 * u, -11 * u, 5.2 * u, 19 * u, 2.6 * u); g.fill(); circ(g, 0, 13.5 * u, 3 * u); g.restore(); }],
];

// ===== 擷取自影音剪輯助手：const D3_ANIMS =====
const D3_ANIMS = { flip: '立體翻轉', spin: 'Y 軸旋轉', float: '立體浮動', pop: '彈跳放大', rise: '逐字升起', zoom: '透視推進' };
const TEXT_PRESETS = [
  { id: 'tp0', name: '一般字幕', text: { style: 'subtitle', size: 5.2, color: '#ffffff', y: 88, bg: true, bold: false } },
  { id: 'tp1', name: '大標題', text: { style: 'title', size: 9, color: '#ffffff', y: 50, bg: false, bold: true }, anim: { in: 'fade', out: 'fade', inDur: .6, outDur: .6 } },
  { id: 'tp2', name: '描邊粗字', text: { style: 'title', size: 7, color: '#ffffff', y: 80, bg: false, bold: true } },
  { id: 'tp3', name: '綜藝黃字', text: { style: 'title', size: 8, color: '#ffd400', y: 78, bg: false, bold: true }, anim: { in: 'pop', out: 'shrink', inDur: .5, outDur: .4 } },
  { id: 'tp4', name: '上方標註', text: { style: 'subtitle', size: 4.2, color: '#f0a83a', y: 12, bg: false, bold: true }, anim: { in: 'fromLeft', out: 'toLeft', inDur: .5, outDur: .4 } },
  { id: 'tp5', name: '打字機字幕', text: { style: 'subtitle', size: 5.2, color: '#ffffff', y: 88, bg: true, bold: false }, anim: { in: 'typewriter', out: 'fade', inDur: 1.2, outDur: .5 } },
  { id: 'td0', name: '立體翻轉', d3: { anim: 'flip', face: ['#fff6c2', '#f3b33d'], side: '#6b3f0a', depth: 20 } },
  { id: 'td1', name: 'Y 軸旋轉', d3: { anim: 'spin', face: ['#e6f6ff', '#4fb3ff'], side: '#0d3a66', depth: 20 } },
  { id: 'td2', name: '立體浮動', d3: { anim: 'float', face: ['#ffe3ef', '#ff5c9a'], side: '#7a1640', depth: 20 } },
  { id: 'td3', name: '彈跳放大', d3: { anim: 'pop', face: ['#fff1c9', '#ff7a1a'], side: '#6e2600', depth: 22 } },
  { id: 'td4', name: '逐字升起', d3: { anim: 'rise', face: ['#e8fff6', '#2fd3a0'], side: '#0b5a43', depth: 20 } },
  { id: 'td5', name: '透視推進', d3: { anim: 'zoom', face: ['#f1e6ff', '#9b6bff'], side: '#35136e', depth: 22 } },
];
const TPRE = Object.fromEntries(TEXT_PRESETS.map(p => [p.id, p]));
const TEXT3D_BASE = { style: 'title', size: 15, color: '#ffffff', x: 50, y: 50, bg: false, bold: true };
// 3D 動畫：回傳整句的變形（左右／上下縮放模擬旋轉、斜切模擬透視）與擠出方向；rise 是逐字
function anim3D(d3, lt, size) {
  const r = { sx: 1, sy: 1, rot: 0, skew: 0, dy: 0, scale: 1, ex: .45, ey: .9, depthK: 1, perChar: null };
  switch (d3.anim) {
    case 'flip': { const k = clamp(lt / .9, 0, 1), a = (1 - easeBack(k)) * Math.PI / 2; r.sy = Math.max(.02, Math.abs(Math.cos(a))); r.ey = .9 - Math.sin(a) * 2; r.depthK = .4 + .6 * k; break; }
    case 'spin': { const a = lt < .8 ? (1 - ease(lt / .8)) * Math.PI / 2 : Math.sin((lt - .8) * 1.4) * .5; r.sx = Math.max(.02, Math.cos(a)); r.ex = .45 + Math.sin(a) * 1.4; break; }
    case 'float': r.dy = Math.sin(lt * 2.2) * size * .12; r.rot = Math.sin(lt * 1.4) * .05; r.ex = .45 + Math.sin(lt * 1.4) * .5; r.ey = .9 + Math.cos(lt * 2.2) * .2; break;
    case 'pop': { const k = clamp(lt / .6, 0, 1); r.scale = Math.max(.01, easeBack(k)) * (k >= 1 ? 1 + Math.sin((lt - .6) * 5) * .03 : 1); r.depthK = ease(k); break; }
    case 'rise': r.perChar = i => { const k = clamp((lt - i * .07) / .5, 0, 1); return { dy: (1 - easeBack(k)) * size * 1.3, alpha: clamp(k * 2, 0, 1), depthK: k }; }; break;
    case 'zoom': { const k = clamp(lt / 1.2, 0, 1), e = ease(k); r.scale = lerp(.15, 1, e); r.skew = -(1 - e) * .6 + (k >= 1 ? Math.sin((lt - 1.2) * 1.5) * .06 : 0); r.depthK = e * 1.3; r.ex = .45 - r.skew; break; }
  }
  return r;
}
// 畫一段立體字：先由後往前疊出側面（越後面越暗），再畫漸層正面
function glyph3D(g, s, x, y, size, d3, ex, ey, depthK) {
  const depth = size * (d3.depth ?? 14) / 100 * depthK, n = Math.min(36, Math.max(0, Math.round(depth / Math.max(1, size / 60))));
  const len = Math.hypot(ex, ey) || 1, ux = ex / len, uy = ey / len, side = d3.side || '#333333', dark = mixHex(side, '#000000', .55);
  if (n > 0) {
    g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = size * .25; g.shadowOffsetY = size * .08; g.fillStyle = dark; g.fillText(s, x + ux * depth, y + uy * depth); g.restore();
    for (let i = n; i >= 1; i--) { g.fillStyle = mixHex(dark, side, 1 - i / n); g.fillText(s, x + ux * depth * i / n, y + uy * depth * i / n); }
  }
  const f = d3.face || ['#ffffff', '#cccccc'], gr = g.createLinearGradient(0, y - size * .5, 0, y + size * .5); gr.addColorStop(0, f[0]); gr.addColorStop(1, f[1]);
  g.lineJoin = 'round'; g.lineWidth = Math.max(1, size * .04); g.strokeStyle = side; g.strokeText(s, x, y); g.fillStyle = gr; g.fillText(s, x, y);
}

// ===== 擷取自影音剪輯助手：const midiF =====
const midiF = m => 440 * Math.pow(2, (m - 69) / 12);
function mulberry(seed) { let a = seed >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10], pent: [0, 2, 4, 7, 9], mpent: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10] };
const PROGS = { major: [[0, 4, 5, 3], [0, 3, 4, 0], [0, 5, 3, 4], [0, 3, 0, 4], [5, 3, 0, 4], [0, 4, 3, 4]], minor: [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 4], [0, 2, 5, 4], [0, 5, 3, 4], [5, 6, 0, 0]] };
const PATS = {
  fast: [[1, 1, 1, 1], [.5, .5, 1, .5, .5, 1], [1, .5, .5, 1, 1], [.5, .5, .5, .5, 2], [1.5, .5, 1, 1], [1, 1, 2]],
  mid: [[1, 1, 2], [2, 1, 1], [1.5, .5, 2], [1, 1, 1, 1], [1, .5, .5, 2]],
  slow: [[2, 2], [1, 1, 2], [3, 1], [1.5, .5, 2], [4], [2, 1, 1]],
  waltz: [[1, 1, 1], [2, 1], [1.5, .5, 1], [3]],
};
// 音色：parts = [波形, 頻率倍數, 音量, 微調(cent), 這個泛音自己的衰減秒數]
const VOICE = {
  piano: { parts: [['triangle', 1, 1], ['sine', 2, .35], ['sine', 3, .1]], a: .004, dec: 1.3, s: 0, r: .4, lp: 3500, gain: .5 },
  epiano: { parts: [['sine', 1, 1], ['sine', 2, .3, 0, .5], ['sine', 7, .08, 0, .15]], a: .004, dec: 1.8, s: .05, r: .5, gain: .5 },
  bell: { parts: [['sine', 1, 1, 0, 1.4], ['sine', 2.4, .35, 0, .5], ['sine', 5.95, .12, 0, .2]], a: .002, dec: 1.6, s: 0, r: .6, gain: .4 },
  glock: { parts: [['sine', 1, 1, 0, 1], ['sine', 2.76, .35, 0, .3], ['sine', 5.4, .15, 0, .1]], a: .001, dec: 1.2, s: 0, r: .5, gain: .32 },
  musicbox: { parts: [['sine', 1, 1, 0, .9], ['sine', 3, .2, 0, .25], ['sine', 4.2, .1, 0, .15]], a: .001, dec: 1, s: 0, r: .4, gain: .35 },
  marimba: { parts: [['sine', 1, 1, 0, .45], ['sine', 4, .3, 0, .08], ['sine', 10, .06, 0, .03]], a: .002, dec: .5, s: 0, r: .2, gain: .55 },
  steeldrum: { parts: [['sine', 1, 1, 0, .8], ['sine', 2, .5, 0, .4], ['sine', 3, .25, 0, .25], ['sine', 4.1, .12, 0, .15]], a: .003, dec: .9, s: 0, r: .3, gain: .38 },
  whistle: { parts: [['sine', 1, 1]], a: .03, r: .08, vib: [6, .008], gain: .3 },
  strings: { parts: [['sawtooth', 1, .5, -8], ['sawtooth', 1, .5, 8]], a: .35, r: .7, lp: 2400, vib: [5.5, .004], gain: .17 },
  violin: { parts: [['sawtooth', 1, 1]], a: .07, r: .25, lp: 3600, q: 1.2, vib: [6, .007], vibD: .25, gain: .24 },
  cello: { parts: [['sawtooth', 1, 1]], a: .09, r: .3, lp: 1700, q: 1.1, vib: [5, .006], vibD: .3, gain: .3 },
  pad: { parts: [['sawtooth', 1, .35, -12], ['sawtooth', 1, .35, 12], ['triangle', .5, .4]], a: .6, r: 1.2, lp: 1300, gain: .13 },
  softpad: { parts: [['triangle', 1, .7], ['sine', 2, .2]], a: .5, r: 1.1, lp: 1800, gain: .16 },
  bass: { parts: [['sawtooth', 1, .7], ['square', .5, .3]], a: .005, dec: .5, s: .5, r: .08, lp: 480, q: 2, gain: .42, wet: 0 },
  bassSoft: { parts: [['triangle', 1, 1], ['sine', 2, .2]], a: .01, dec: .8, s: .4, r: .1, gain: .5, wet: 0 },
  chipTri: { parts: [['triangle', 1, 1]], a: .002, r: .02, gain: .45, wet: 0 },
  chip: { parts: [['pulse', 1, 1]], a: .002, r: .03, gain: .16 },
  lead: { parts: [['sawtooth', 1, .5, -7], ['square', 1, .35, 7]], a: .01, dec: .3, s: .7, r: .15, lp: 1600, lpEnv: 4200, lpT: .08, q: 3, gain: .16 },
  flute: { parts: [['sine', 1, 1], ['triangle', 2, .07]], a: .06, r: .15, vib: [5, .005], vibD: .25, breath: .08, gain: .38 },
  dizi: { parts: [['sine', 1, 1], ['sine', 2, .22], ['sine', 3, .08]], a: .04, r: .12, vib: [5.5, .009], vibD: .2, breath: .16, gain: .34 },
  clarinet: { parts: [['square', 1, .6], ['sine', 1, .5]], a: .04, r: .12, lp: 1900, vib: [5, .003], gain: .22 },
  sax: { parts: [['sawtooth', 1, 1]], a: .03, dec: .4, s: .8, r: .12, lp: 1300, lpEnv: 2800, lpT: .07, q: 1.4, vib: [5.5, .006], vibD: .2, gain: .22 },
  trumpet: { parts: [['sawtooth', 1, 1]], a: .02, dec: .3, s: .8, r: .1, lp: 1000, lpEnv: 3800, lpT: .05, vib: [6, .004], vibD: .35, gain: .2 },
  brass: { parts: [['sawtooth', 1, .6, -5], ['sawtooth', 1, .6, 5]], a: .05, dec: .4, s: .85, r: .25, lp: 900, lpEnv: 2600, lpT: .12, gain: .17 },
  horn: { parts: [['sawtooth', 1, .7], ['triangle', 1, .5]], a: .08, dec: .5, s: .9, r: .3, lp: 700, lpEnv: 1500, lpT: .15, gain: .26 },
  organ: { parts: [['sine', 1, 1], ['sine', 2, .6], ['sine', 3, .4], ['sine', 4, .25], ['sine', 8, .1]], a: .01, r: .1, gain: .13 },
  accordion: { parts: [['sawtooth', 1, .5, -14], ['sawtooth', 1, .5, 14], ['square', 2, .12]], a: .03, r: .08, lp: 2300, gain: .14 },
  harmonica: { parts: [['square', 1, .5], ['sawtooth', 1, .4]], a: .05, r: .1, ft: 'bandpass', lp: 1500, q: .7, vib: [6, .006], vibD: .3, gain: .42 },
  erhu: { parts: [['sawtooth', 1, 1]], a: .08, r: .2, ft: 'bandpass', lp: 1300, q: .9, vib: [6, .012], vibD: .15, gain: .5 },
};
// 撥弦樂器（Karplus-Strong 撥弦合成）：bright 越大越亮（0.5～0.95）
const PLUCK = {
  guitar: { id: 'g', bright: .55, damp: .996, len: 2.2, gain: .55, lp: 4000 },
  uke: { id: 'u', bright: .75, damp: .992, len: 1.4, gain: .5 },
  harp: { id: 'h', bright: .5, damp: .998, len: 3, gain: .55 },
  guzheng: { id: 'z', bright: .7, damp: .997, len: 2.8, gain: .55, bend: true },
  pipa: { id: 'p', bright: .8, damp: .994, len: 1.2, gain: .5 },
  bassg: { id: 'b', bright: .5, damp: .997, len: 1.6, gain: .75, lp: 1200, wet: 0 },
};
class Synth {
  constructor(ac, rng, D) {
    this.ac = ac; this.rng = rng; this.D = D; this.sr = ac.sampleRate; this.ks = new Map();
    const comp = ac.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = .005; comp.release.value = .25; comp.connect(ac.destination);
    this.bus = ac.createGain(); this.bus.connect(comp);
    this.revIn = ac.createGain(); this.revIn.gain.value = .22; const cv = ac.createConvolver(); cv.buffer = this.impulse(2.4); this.revIn.connect(cv); cv.connect(comp);
    this.noise = this.noiseBuf(4);
  }
  impulse(s) { const n = Math.round(this.sr * s), b = this.ac.createBuffer(2, n, this.sr); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (this.rng() * 2 - 1) * Math.pow(1 - i / n, 3); } return b; }
  noiseBuf(s) { const n = Math.round(this.sr * s), b = this.ac.createBuffer(1, n, this.sr), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = this.rng() * 2 - 1; return b; }
  pulseWave() { if (!this.pw) { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) re[i] = 2 / (i * Math.PI) * Math.sin(i * Math.PI * .25); this.pw = this.ac.createPeriodicWave(re, im); } return this.pw; }
  // 左右聲道位置相同的音共用一個 panner（節點越少算得越快）
  outChain(pan, wet) {
    const pv = Math.round(clamp(pan || 0, -1, 1) * 10) / 10, key = pv + (wet === 0 ? 'd' : 'w');
    this.pans = this.pans || new Map(); let p = this.pans.get(key);
    if (!p) { p = this.ac.createStereoPanner(); p.pan.value = pv; p.connect(this.bus); if (wet !== 0) p.connect(this.revIn); this.pans.set(key, p); }
    return p;
  }
  // 每個音先不接上混音器：算繪途中每隔一小段才接上「快要開始」的音、拔掉「已經結束」的音。
  // 不這樣做的話，幾千個還沒開始或早已結束的節點每一格都會被運算，一首歌要算好幾秒。
  track(node, dest, start, end) { (this.pending = this.pending || []).push({ node, dest, start, end }); }
  step(now, next) {
    this.live = (this.live || []).filter(x => { if (x.end > now) return true; try { x.node.disconnect(); } catch { } return false; });
    this.pending = (this.pending || []).filter(x => { if (x.start < next) { x.node.connect(x.dest); this.live.push(x); return false; } return true; });
  }
  filt(type, f, q = .7) { const x = this.ac.createBiquadFilter(); x.type = type; x.frequency.value = f; x.Q.value = q; return x; }
  loopNoise(t0, t1) { const s = this.ac.createBufferSource(); s.buffer = this.noise; s.loop = true; s.start(t0, this.rng() * 3); s.stop(t1); return s; }
  curve(n, lo, hi, smooth = .25) { const a = new Float32Array(n); let v = this.rng(); for (let i = 0; i < n; i++) { v += (this.rng() - v) * smooth; a[i] = lo + (hi - lo) * v; } return a; }
  note(v, t, m, d, vel, o = {}) {
    if (t >= this.D) return;
    const f = midiF(m), P = PLUCK[v];
    if (P) { if (v === 'pipa' && d > .35) { for (let x = 0; x < d - .05; x += .075) this.pluck(t + x, f, .1, vel * (x ? .6 : 1), P, o.pan); return; } this.pluck(t, f, d, vel, P, o.pan); return; }
    if (VOICE[v]) this.tone(t, d, f, vel, VOICE[v], o.pan || 0, o.slideFrom);
  }
  tone(t, d, f, vel, V, pan, slideFrom) {
    const ac = this.ac, a = V.a ?? .01, r = V.r ?? .3, end = t + d + r * 2.5 + .05, pk = vel * (V.gain ?? .3);
    const g = ac.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(pk, t + a);
    if (V.dec) g.gain.setTargetAtTime(pk * (V.s ?? 0), t + a, V.dec / 3);
    g.gain.setTargetAtTime(0, Math.max(t + a, t + d), r / 3);
    this.track(g, this.outChain(pan, V.wet), t, end);
    let head = g;
    if (V.lp) { const fl = this.filt(V.ft || 'lowpass', V.lp, V.q ?? .7); if (V.lpEnv) { fl.frequency.setValueAtTime(V.lp, t); fl.frequency.linearRampToValueAtTime(V.lpEnv, t + (V.lpT || .1)); fl.frequency.setTargetAtTime(V.lp * 1.3, t + (V.lpT || .1), .25); } fl.connect(g); head = fl; }
    let vg = null;
    if (V.vib) { const lfo = ac.createOscillator(); lfo.frequency.value = V.vib[0]; vg = ac.createGain(); vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * V.vib[1], t + (V.vibD ?? .3)); lfo.connect(vg); lfo.start(t); lfo.stop(end); }
    for (const [type, ratio, amp, det, pdec] of V.parts) {
      const o = ac.createOscillator(); if (type === 'pulse') o.setPeriodicWave(this.pulseWave()); else o.type = type;
      if (slideFrom) { o.frequency.setValueAtTime(slideFrom * ratio, t); o.frequency.exponentialRampToValueAtTime(f * ratio, t + .09); } else o.frequency.setValueAtTime(f * ratio, t);
      if (det) o.detune.value = det; if (vg) vg.connect(o.frequency);
      const og = ac.createGain(); og.gain.setValueAtTime(amp, t); if (pdec) og.gain.setTargetAtTime(0, t, pdec / 3);
      o.connect(og); og.connect(head); o.start(t); o.stop(end);
    }
    if (V.breath) { const s = this.loopNoise(t, end), bp = this.filt('bandpass', f * 2, 2), bg = ac.createGain(); bg.gain.value = V.breath; s.connect(bp); bp.connect(bg); bg.connect(head); }
  }
  pluck(t, f, d, vel, P, pan = 0) {
    const key = P.id + Math.round(f);
    let b = this.ks.get(key);
    if (!b) {
      const sr = this.sr, len = Math.round(sr * P.len), N = Math.max(2, Math.round(sr / f)), buf = new Float32Array(N); b = this.ac.createBuffer(1, len, sr); const out = b.getChannelData(0);
      let last = 0, mean = 0; for (let i = 0; i < N; i++) { last += (this.rng() * 2 - 1 - last) * (.3 + P.bright * .7); buf[i] = last; mean += last; } mean /= N; for (let i = 0; i < N; i++) buf[i] -= mean;
      for (let i = 0; i < len; i++) { const j = i % N, y = buf[j]; out[i] = y; buf[j] = P.damp * (y * P.bright + buf[(j + 1) % N] * (1 - P.bright)); }
      this.ks.set(key, b);
    }
    const s = this.ac.createBufferSource(); s.buffer = b;
    if (P.bend) { s.playbackRate.setValueAtTime(.97, t); s.playbackRate.linearRampToValueAtTime(1, t + .12); }
    const g = this.ac.createGain(), pk = vel * P.gain, rel = t + Math.max(.06, d); g.gain.setValueAtTime(pk, t); g.gain.setTargetAtTime(0, rel, .07);
    let head = s; if (P.lp) { const fl = this.filt('lowpass', P.lp); s.connect(fl); head = fl; }
    head.connect(g);
    const stop = Math.min(t + P.len, rel + .5); s.start(t); s.stop(stop); this.track(g, this.outChain(pan, P.wet), t, stop);
  }
  // 打擊樂：濾波雜訊與滑音
  nz(t, dur, vel, type, f, q = .7, decay = dur, pan = 0, wet = 0) { if (t >= this.D) return; const s = this.loopNoise(t, t + dur + .02), fl = this.filt(type, f, q), g = this.ac.createGain(); g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, t + .001, Math.max(.003, decay / 4)); s.connect(fl); fl.connect(g); this.track(g, this.outChain(pan, wet), t, t + dur + .05); }
  sweep(t, f0, f1, st, decay, vel, type = 'sine', pan = 0, wet = 0) { if (t >= this.D) return; const o = this.ac.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + st); const g = this.ac.createGain(); g.gain.setValueAtTime(vel, t); g.gain.setTargetAtTime(0, t + .002, decay / 4); o.connect(g); o.start(t); o.stop(t + decay * 1.6 + .05); this.track(g, this.outChain(pan, wet), t, t + decay * 1.6 + .1); }
  kick(t, v = 1) { this.sweep(t, 150, 42, .12, .45, v * .9); this.nz(t, .02, v * .15, 'lowpass', 3000); }
  snare(t, v = 1) { this.nz(t, .25, v * .45, 'highpass', 1500, .7, .18, 0, 1); this.sweep(t, 220, 160, .05, .12, v * .3, 'triangle'); }
  hat(t, v = 1, open = false) { this.nz(t, open ? .35 : .08, v * .22, 'highpass', 7500, .7, open ? .3 : .05, .25); }
  clap(t, v = 1) { [0, .012, .024].forEach((dt, i) => this.nz(t + dt, .2, v * .3, 'bandpass', 1400, 1.2, i === 2 ? .15 : .02, 0, 1)); }
  tom(t, f, v = 1) { this.sweep(t, f, f * .65, .2, .45, v * .6, 'sine', 0, 1); }
  crash(t, v = 1) { this.nz(t, 2.2, v * .25, 'highpass', 4500, .5, 1.8, 0, 1); }
  ride(t, v = 1) { this.nz(t, .5, v * .12, 'bandpass', 8000, 1.5, .4, .2); }
  shaker(t, v = 1) { this.nz(t, .06, v * .12, 'highpass', 5000, .8, .05, -.2); }
  kane(t, v = 1) { this.sweep(t, 2600, 2550, .05, .15, v * .12, 'sine', .3, 1); this.sweep(t, 3700, 3650, .05, .1, v * .08, 'sine', .3, 1); }
  djembe(t, k, v = 1, pan = 0) { if (k === 0) this.sweep(t, 110, 60, .08, .35, v * .8, 'sine', pan); else if (k === 1) { this.sweep(t, 260, 220, .03, .18, v * .5, 'sine', pan); this.nz(t, .08, v * .15, 'bandpass', 900, 1.5, .06, pan); } else { this.nz(t, .1, v * .45, 'bandpass', 2600, 1.2, .07, pan, 1); this.sweep(t, 400, 330, .02, .08, v * .2, 'triangle', pan); } }
  taiko(t, v = 1) { this.sweep(t, 80, 48, .25, 1.4, v, 'sine', 0, 1); this.nz(t, .3, v * .4, 'lowpass', 500, .7, .25, 0, 1); }
}
// ---------- 天氣音效 ----------
function wxRain(S, amt, o = {}) {
  const D = S.D, shape = x => o.shape === 'out' ? clamp((.85 - x) / .35, 0, 1) : o.shape === 'in' ? .35 + .65 * clamp(x / .6, 0, 1) : 1;
  for (const pan of [-.6, .6]) {
    const s = S.loopNoise(0, D), hp = S.filt('highpass', 450), lp = S.filt('lowpass', o.muffle ? 1600 : 7000), g = S.ac.createGain(), cv = S.curve(60, .8, 1.15);
    for (let i = 0; i < 60; i++) cv[i] *= amt * .4 * shape(i / 59);
    g.gain.setValueCurveAtTime(cv, 0, D); s.connect(hp); hp.connect(lp); lp.connect(g); g.connect(S.outChain(pan, 0));
  }
  const n = Math.round(D * amt * (o.drops ?? 22));
  for (let i = 0; i < n; i++) { const t = S.rng() * D; if (S.rng() > shape(t / D)) continue; S.nz(t, .04, amt * (.12 + S.rng() * .3) * (o.dropV ?? 1), 'bandpass', 1500 + S.rng() * 4500, 2.5, .025, S.rng() * 1.6 - .8); }
}
function wxWind(S, amt, o = {}) {
  const D = S.D;
  for (const pan of [-.55, .55]) {
    const s = S.loopNoise(0, D), bp = S.filt('bandpass', 500, o.q ?? .7), g = S.ac.createGain(), cv = S.curve(50, o.gust ? .15 : .55, 1, o.gust ? .35 : .15);
    bp.frequency.setValueCurveAtTime(S.curve(50, 220, o.hi ?? 900, .2), 0, D);
    for (let i = 0; i < 50; i++) cv[i] *= amt * 1.3;
    g.gain.setValueCurveAtTime(cv, 0, D); s.connect(bp); bp.connect(g); g.connect(S.outChain(pan, 0));
  }
  if (o.whistle) { const s = S.loopNoise(0, D), bp = S.filt('bandpass', 1000, 18), g = S.ac.createGain(); bp.frequency.setValueCurveAtTime(S.curve(40, 650, 1500, .15), 0, D); g.gain.setValueCurveAtTime(S.curve(40, 0, amt * 2.2, .2), 0, D); s.connect(bp); bp.connect(g); g.connect(S.outChain(0, 1)); }
}
function wxThunder(S, t, near) {
  if (t >= S.D - 1) return;
  const len = Math.min(S.D - t, 4 + near * 3), n = 90, cv = new Float32Array(n), atk = near > .6 ? .06 : .5;
  let w = .7; for (let i = 0; i < n; i++) { const x = i / (n - 1) * len; w += (S.rng() - w) * .3; cv[i] = (.4 + near) * Math.min(1, x / atk) * Math.exp(-x * (1.1 - near * .4)) * (.5 + w); }
  cv[n - 1] = 0;
  const s = S.loopNoise(t, t + len), l1 = S.filt('lowpass', 150 + near * 900), l2 = S.filt('lowpass', 200 + near * 1100), g = S.ac.createGain();
  g.gain.setValueAtTime(0, 0); g.gain.setValueCurveAtTime(cv, t, len); s.connect(l1); l1.connect(l2); l2.connect(g); g.connect(S.outChain((S.rng() - .5) * .6, 1));
  S.sweep(t, 60, 32, 1.2, 2.5 + near * 2, .5 + near * .4);
  if (near > .6) { S.nz(t, .3, near * .9, 'highpass', 1800, .7, .18, 0, 1); S.nz(t + .02, .5, near * .6, 'bandpass', 700, .8, .35, 0, 1); }
}
function wxOcean(S, amt) {
  const D = S.D, n = 240, cv = new Float32Array(n), per = 6.5 + S.rng() * 2.5;
  for (let i = 0; i < n; i++) { const ph = (i / (n - 1) * D / per) % 1; cv[i] = amt * (.12 + .88 * Math.pow(ph < .72 ? Math.sin(Math.PI * Math.min(1, ph * 1.4)) : 0, 2)); }
  for (const [type, f, k, pan] of [['lowpass', 700, 1, -.3], ['highpass', 2200, .45, .3]]) { const s = S.loopNoise(0, D), fl = S.filt(type, f), g = S.ac.createGain(); g.gain.setValueCurveAtTime(cv.map(v => v * k), 0, D); s.connect(fl); fl.connect(g); g.connect(S.outChain(pan, 0)); }
}
function wxDrips(S, amt) { for (let i = 0, n = Math.round(S.D * amt * 1.4); i < n; i++) { const r = S.rng(); S.sweep(S.rng() * S.D, 600 + r * 500, 1500 + r * 1800, .05, .14, amt * (.25 + S.rng() * .3), 'sine', S.rng() * 1.4 - .7, 1); } }
function wxHail(S, amt) { for (let i = 0, n = Math.round(S.D * 35 * amt); i < n; i++) { const t = S.rng() * S.D, pan = S.rng() * 1.6 - .8; S.nz(t, .012, amt * (.2 + S.rng() * .45), 'highpass', 3000, .7, .01, pan); if (i % 4 === 0) S.sweep(t, 3500 + S.rng() * 2000, 3000, .02, .05, .08, 'sine', pan); } }
function wxCrickets(S) { for (let c = 0; c < 3; c++) { const f = 4200 + c * 350, pan = [-.6, .1, .7][c]; let t = S.rng(); while (t < S.D - .5) { for (let k = 0; k < 3; k++) S.sweep(t + k * .06, f, f * .98, .03, .045, .07, 'sine', pan, 1); t += .55 + S.rng() * .7; } } }
function wxBirds(S, amt, from = 0) { for (let i = 0, n = Math.round(S.D * (1 - from) * amt * .5); i < n; i++) { const t = S.D * from + S.rng() * (S.D * (1 - from) - 1.5), r = S.rng(), pan = S.rng() * 1.4 - .7; for (let k = 0, m = 2 + Math.floor(S.rng() * 3); k < m; k++) S.sweep(t + k * .14, 2300 + r * 900, 3900 + r * 1500, .07, .1, .12, 'sine', pan, 1); } }
const WEATHER = [
  ['小雨', S => { wxRain(S, .35); wxDrips(S, .25); }],
  ['大雨', S => wxRain(S, 1)],
  ['雷雨', S => { wxRain(S, .8); [3, 13, 22].forEach((t, i) => wxThunder(S, t, [.5, .8, .4][i])); }],
  ['遠方雷聲', S => { wxRain(S, .2); [2, 11, 20].forEach(t => wxThunder(S, t, .2)); }],
  ['近距離雷擊', S => { wxRain(S, .5); [3, 16].forEach(t => wxThunder(S, t, 1)); }],
  ['毛毛雨', S => wxRain(S, .18, { drops: 10 })],
  ['雨打屋簷', S => { wxRain(S, .4); wxDrips(S, 1); }],
  ['雨打窗戶', S => wxRain(S, .55, { muffle: true, drops: 30, dropV: 1.4 })],
  ['微風', S => wxWind(S, .3)],
  ['強風', S => wxWind(S, .8, { gust: true, hi: 1400 })],
  ['暴風雪', S => wxWind(S, 1, { gust: true, hi: 1600, whistle: true })],
  ['颱風', S => { wxWind(S, 1, { gust: true, hi: 1500 }); wxRain(S, 1); }],
  ['山谷風聲', S => wxWind(S, .5, { whistle: true, q: 1.5 })],
  ['海邊風浪', S => { wxOcean(S, .9); wxWind(S, .3); }],
  ['冰雹', S => { wxRain(S, .4); wxHail(S, 1); }],
  ['雷陣雨轉晴', S => { wxRain(S, .8, { shape: 'out' }); wxThunder(S, 3, .6); wxBirds(S, .8, .65); }],
  ['夜雨蟲鳴', S => { wxRain(S, .25); wxCrickets(S); }],
  ['午後雷陣雨', S => { wxRain(S, .9, { shape: 'in' }); [10, 19, 25].forEach((t, i) => wxThunder(S, t, [.4, .7, .9][i])); }],
  ['狂風暴雨', S => { wxRain(S, 1); wxWind(S, .8, { gust: true }); [6, 18].forEach(t => wxThunder(S, t, .8)); }],
  ['雨後滴水', S => { wxDrips(S, .7); wxBirds(S, .6, 0); }],
];
// 樂器 30：[名稱, 主奏音色, 和弦調式, 旋律音階, 速度, 八度, 編曲風格]
const INST = [
  ['鋼琴', 'piano', 'major', 'major', 92, 0, 'solo'], ['電鋼琴', 'epiano', 'major', 'major', 86, 0, 'solo'], ['吉他', 'guitar', 'major', 'major', 100, -1, 'strum'],
  ['烏克麗麗', 'uke', 'major', 'major', 120, 0, 'strum'], ['豎琴', 'harp', 'major', 'major', 80, 0, 'arp'], ['小提琴', 'violin', 'minor', 'minor', 84, 0, 'solo'],
  ['大提琴', 'cello', 'minor', 'minor', 70, -1, 'solo'], ['長笛', 'flute', 'major', 'major', 96, 1, 'solo'], ['單簧管', 'clarinet', 'minor', 'minor', 92, 0, 'solo'],
  ['薩克斯風', 'sax', 'minor', 'blues', 96, 0, 'jazzy'], ['小號', 'trumpet', 'major', 'major', 108, 0, 'solo'], ['法國號', 'horn', 'major', 'major', 76, -1, 'solo'],
  ['管風琴', 'organ', 'major', 'major', 72, 0, 'chorale'], ['手風琴', 'accordion', 'major', 'major', 116, 0, 'waltz'], ['口琴', 'harmonica', 'major', 'major', 100, 0, 'strum'],
  ['鐘琴', 'glock', 'major', 'major', 110, 1, 'solo'], ['木琴', 'marimba', 'major', 'pent', 116, 0, 'solo'], ['音樂盒', 'musicbox', 'major', 'major', 84, 1, 'box'],
  ['鋼鼓', 'steeldrum', 'major', 'major', 112, 0, 'island'], ['古箏', 'guzheng', 'major', 'pent', 80, 0, 'chinese'], ['二胡', 'erhu', 'minor', 'mpent', 66, 0, 'chinese'],
  ['竹笛', 'dizi', 'major', 'pent', 92, 1, 'chinese'], ['琵琶', 'pipa', 'minor', 'mpent', 100, 0, 'chinese'], ['合成器主音', 'lead', 'minor', 'minor', 120, 0, 'synth'],
  ['8-bit 電玩', 'chip', 'major', 'major', 140, 0, 'chip'], ['電貝斯', 'bassg', 'minor', 'mpent', 100, -2, 'funk'], ['爵士鼓', 'drums', 'major', 'major', 120, 0, 'jazzdrums'],
  ['非洲鼓', 'djembe', 'minor', 'mpent', 104, 0, 'djembe'], ['太鼓', 'taiko', 'minor', 'mpent', 90, 0, 'taiko'], ['弦樂合奏', 'strings', 'major', 'major', 72, 0, 'ensemble'],
];
const MUSIC_CATS = [['happy', '快樂'], ['epic', '激勵'], ['sad', '悲傷'], ['weather', '天氣'], ['inst', '樂器']];
const MUSIC_NAMES = {
  happy: '陽光早晨 快樂野餐 週末出遊 跳跳糖 彩虹氣球 輕快步伐 微笑時光 夏日海灘 生日派對 小狗散步 甜甜圈 遊樂園 輕鬆小品 晴天口哨 泡泡派對 好心情 可愛日常 午後咖啡 騎單車 開心拍手'.split(' '),
  epic: '勇往直前 夢想啟航 衝破極限 黎明曙光 英雄之路 永不放棄 飛越巔峰 熱血奔跑 勝利時刻 新的開始 光芒萬丈 挑戰自我 破浪前行 未來在望 團隊力量 站上舞台 燃燒鬥志 向陽而生 決戰時刻 榮耀之光'.split(' '),
  sad: '雨中回憶 離別車站 思念 落葉 空房間 舊照片 月光獨白 未寄出的信 黃昏長廊 夜深人靜 遠方 淚光 冬日窗邊 斷線風箏 無聲告白 灰色天空 回不去的夏天 背影 孤燈 最後一頁'.split(' '),
};
// 每首歌的「樂譜設定」：用固定種子產生，所以同一首歌每次聽起來都一樣
function musicPlan(cat, i) {
  const rng = mulberry(7919 * (MUSIC_CATS.findIndex(x => x[0] === cat) + 1) + i * 104729), pick = a => a[Math.floor(rng() * a.length)];
  const P = { cat, i, seed: Math.floor(rng() * 4294967295) };
  if (cat === 'weather') return Object.assign(P, { name: WEATHER[i][0], D: 30 });
  if (cat === 'inst') { const [name, lead, mode, mscale, bpm, oct, style] = INST[i]; Object.assign(P, { name, lead, mode, mscale, bpm, oct, style }); }
  else if (cat === 'happy') Object.assign(P, { name: MUSIC_NAMES.happy[i], mode: 'major', mscale: rng() < .4 ? 'pent' : 'major', bpm: 112 + Math.round(rng() * 24), oct: 0, style: 'pop', lead: pick(['piano', 'marimba', 'uke', 'bell', 'whistle', 'chip', 'glock', 'guitar', 'epiano']) });
  else if (cat === 'epic') Object.assign(P, { name: MUSIC_NAMES.epic[i], mode: rng() < .55 ? 'minor' : 'major', bpm: 92 + Math.round(rng() * 30), oct: 0, style: 'epic', lead: pick(['brass', 'strings', 'horn']) });
  else Object.assign(P, { name: MUSIC_NAMES.sad[i], mode: 'minor', mscale: 'minor', bpm: 62 + Math.round(rng() * 16), oct: 0, style: 'ballad', lead: pick(['piano', 'strings', 'cello', 'flute', 'epiano', 'violin']) });
  P.mscale = P.mscale || P.mode;
  P.root = 57 + Math.floor(rng() * 8);
  P.prog = pick(PROGS[P.mode]);
  P.bpb = P.style === 'waltz' ? 3 : 4;
  const barSec = P.bpb * 60 / P.bpm;
  P.bars = Math.max(8, 4 * Math.round(30 / barSec / 4));
  P.pats = P.bpb === 3 ? PATS.waltz : P.bpm >= 105 ? PATS.fast : P.bpm >= 84 ? PATS.mid : PATS.slow;
  P.D = .2 + P.bars * barSec + 2.6;
  return P;
}
// 旋律：三個動機依 A B A C 排列，每小節開頭落在和弦音上，最後一小節停在主音
function genMelody(rng, P, pool, chordPcs, rootPc) {
  const bpb = P.bpb, motifs = [0, 1, 2].map(() => { const r = P.pats[Math.floor(rng() * P.pats.length)]; return { r, st: r.map(() => [-2, -1, -1, 1, 1, 2, -3, 3, 0][Math.floor(rng() * 9)]) }; });
  const form = [0, 1, 0, 2], out = []; let idx = Math.floor(pool.length / 2);
  const nearest = pcs => { let best = idx, bd = 1e9; pool.forEach((m, i) => { const d = Math.abs(i - idx); if (pcs.includes(m % 12) && d < bd) { bd = d; best = i; } }); return best; };
  for (let bar = 0; bar < P.bars; bar++) {
    const b0 = bar * bpb;
    if (bar === P.bars - 1) { idx = nearest([rootPc]); out.push({ b: b0, d: bpb, m: pool[idx] }); break; }
    const M = motifs[form[bar % 4]]; idx = nearest(chordPcs(bar)); let b = b0;
    M.r.forEach((d, i) => { if (i) idx = clamp(idx + M.st[i], 0, pool.length - 1); if (!(i && rng() < .1)) out.push({ b, d, m: pool[idx] }); b += d; });
  }
  return out;
}
function makeMusic(S, P) {
  if (P.cat === 'weather') { WEATHER[P.i][1](S); return; }
  const rng = S.rng, bpb = P.bpb, spb = 60 / P.bpm, t0 = .2, B = P.bars, H = SCALES[P.mode], MS = SCALES[P.mscale] || H, root = P.root;
  const T = (bar, beat = 0) => t0 + (bar * bpb + beat) * spb;
  const deg = bar => bar >= B - 1 ? 0 : P.prog[bar % P.prog.length];
  const chord = (d, base = 0) => [0, 2, 4].map(k => root + base + H[(d + k) % 7] + 12 * Math.floor((d + k) / 7));
  const center = root + 12 + 12 * P.oct, pool = [];
  for (let m = center - 7; m <= center + 12; m++) if (MS.includes(((m - root) % 12 + 12) % 12)) pool.push(m);
  const mel = genMelody(rng, P, pool, bar => chord(deg(bar)).map(m => m % 12), root % 12);
  const N = (v, t, m, d, vel, o) => S.note(v, t, m, d, vel, o);
  const lead = (v, vel, from = 1, oct = 0, o = {}) => { let prev = null; for (const n of mel) { if (Math.floor(n.b / bpb) < from) continue; let t = t0 + n.b * spb; if (o.swing && n.b % 1 === .5) t += spb * .16;
    N(v, t, n.m + 12 * oct, n.d * spb * (o.legato ?? .92), vel * (.85 + rng() * .15), v === 'erhu' && prev != null && Math.abs(prev - n.m) <= 5 ? { slideFrom: midiF(prev + 12 * oct) } : undefined); prev = n.m; } };
  const pad = (v, vel, from = 0, to = B, base = -12) => { for (let bar = from; bar < to; bar++) for (const m of chord(deg(bar), base)) N(v, T(bar), m, bpb * spb * (bar === B - 1 ? 1.6 : 1.02), vel); };
  const fifth = rng() < .4;
  const bass = (v, beats, vel, from = 0, base = -24) => { for (let bar = from; bar < B; bar++) { const r = chord(deg(bar), base)[0]; if (bar === B - 1) { N(v, T(bar), r, bpb * spb * 1.5, vel); continue; }
    beats.forEach((b, j) => N(v, T(bar, b), fifth && b === 2 ? r + 7 : r, spb * Math.min(.95, ((beats[j + 1] ?? bpb) - b) * .95), vel)); } };
  const arp = (v, vel, from = 0, to = B, base = -12, step = .5, pat = [0, 1, 2, 3, 2, 1]) => { for (let bar = from; bar < to; bar++) { const c = chord(deg(bar), base), notes = [...c, c[0] + 12, c[1] + 12]; let i = 0;
    for (let b = 0; b < bpb - 1e-6; b += step) N(v, T(bar, b), notes[pat[i++ % pat.length]], step * spb * 1.8, vel * (b % 1 === 0 ? 1 : .8)); } };
  const strum = (v, beats, vel, from = 0, base = -12) => { for (let bar = from; bar < B; bar++) { const c = chord(deg(bar), base), notes = [c[0], c[1], c[2], c[0] + 12, c[1] + 12];
    (bar === B - 1 ? [0] : beats).forEach((b, j) => { const up = j % 2 === 1; (up ? [...notes].reverse().slice(0, 4) : notes).forEach((m, k) => N(v, T(bar, b) + k * .016, m, (bar === B - 1 ? bpb : .9) * spb, vel * (up ? .7 : 1))); }); } };
  const drums = (kind, from = 1, to = B - 1, vel = 1) => {
    const extraKick = rng() < .5;
    for (let bar = from; bar < to; bar++) {
      const fill = bar % 4 === 3;
      if (bar % 8 === 0 && bar > 0 && kind !== 'light' && kind !== 'swing') S.crash(T(bar), .5 * vel);
      if (kind === 'pop') { for (let b = 0; b < bpb; b++) { if (b % 2 === 0) S.kick(T(bar, b), vel); else S.snare(T(bar, b), .8 * vel); S.hat(T(bar, b), .7 * vel); S.hat(T(bar, b + .5), .45 * vel); } if (extraKick) S.kick(T(bar, 2.5), .7 * vel); if (fill) S.snare(T(bar, 3.5), .6 * vel); }
      else if (kind === 'four') { for (let b = 0; b < bpb; b++) { S.kick(T(bar, b), vel); S.hat(T(bar, b + .5), .6 * vel, true); if (b % 2) S.clap(T(bar, b), .8 * vel); } }
      else if (kind === 'epic') { S.kick(T(bar, 0), vel); S.kick(T(bar, .75), .7 * vel); S.kick(T(bar, 2), .9 * vel); S.snare(T(bar, 1), .8 * vel); for (let b = 0; b < bpb; b += .5) S.hat(T(bar, b), .3 * vel);
        if (fill) [[2.5, 220], [3, 180], [3.25, 150], [3.5, 120], [3.75, 100]].forEach(([b, f]) => S.tom(T(bar, b), f, .9 * vel)); else S.snare(T(bar, 3), .8 * vel); }
      else if (kind === 'light') { S.kick(T(bar, 0), .7 * vel); S.kick(T(bar, 2), .5 * vel); for (let b = 0; b < bpb; b += .5) S.shaker(T(bar, b), b % 1 ? .5 : .8); S.clap(T(bar, 1), .4 * vel); S.clap(T(bar, 3), .4 * vel); }
      else if (kind === 'swing') { for (const b of [0, 1, 1.66, 2, 3, 3.66]) S.ride(T(bar, b), (b % 1 ? .6 : .9) * vel); S.hat(T(bar, 1), .5 * vel); S.hat(T(bar, 3), .5 * vel); S.kick(T(bar, 0), .35 * vel); S.kick(T(bar, 2), .25 * vel); if (rng() < .5) S.snare(T(bar, 2.66), .25 * vel); }
    }
    if (kind !== 'swing') { S.kick(T(to), vel); S.crash(T(to), .6 * vel); }
  };
  switch (P.style) {
    case 'pop':
      if (['uke', 'guitar'].includes(P.lead) || rng() < .5) { for (let bar = 0; bar < B - 1; bar++) for (const b of [.5, 1.5, 2.5, 3.5]) for (const m of chord(deg(bar), -12)) N('piano', T(bar, b), m, spb * .4, .35); pad('softpad', .3, B - 1); }
      else strum('uke', [0, 1, 1.5, 2.5, 3, 3.5], .45);
      bass('bass', [0, 2, 3.5], .7); drums('pop', 1, B - 1, .9); lead(P.lead, .75, 1); break;
    case 'epic':
      pad('strings', .45); arp('piano', .35, 0, B - 1, -12, .5, [0, 1, 2, 3]); bass('bass', [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], .55, 2); drums('epic', 4, B - 1);
      lead(P.lead === 'strings' ? 'violin' : P.lead, .7, 4); lead('strings', .35, 8, 1); S.taiko(T(B - 1), 1); break;
    case 'ballad':
      arp('piano', .32, 0, B - 1, -12, .5, [0, 1, 2, 3, 2, 1]); bass('piano', [0], .38); pad('softpad', .3, 2);
      lead(P.lead, .55, 2, ['piano', 'epiano'].includes(P.lead) ? 1 : P.lead === 'cello' ? -1 : 0); break;
    case 'solo': pad('softpad', .28); bass('bassSoft', [0, 2], .45); lead(P.lead, .75, 1); break;
    case 'strum': strum('guitar', [0, 1, 1.5, 2.5, 3, 3.5], .4); bass('bassSoft', [0, 2], .45, 1); if (P.lead === 'guitar') lead('guitar', .75, 2, 1); else lead(P.lead, .7, 1); if (P.bpm >= 110) drums('light', 2); break;
    case 'arp': arp('harp', .38, 0, B - 1, -12, .5, [0, 1, 2, 3, 4, 3, 2, 1]); pad('softpad', .2, 1); lead('harp', .75, 2, 1); break;
    case 'jazzy':
      for (let bar = 0; bar < B; bar++) { const c = chord(deg(bar), -24); if (bar === B - 1) { N('bassg', T(bar), c[0], 3 * spb, .7); break; } [c[0], c[1], c[2], chord(deg(bar + 1), -24)[0] + (rng() < .5 ? 1 : -1)].forEach((m, j) => N('bassg', T(bar, j), m, spb * .9, .7));
        for (const b of [1, 2.66]) chord(deg(bar), -12).forEach(m => N('epiano', T(bar, b), m, spb * .5, .3)); }
      drums('swing', 0, B - 1, .8); lead(P.lead, .75, 1, 0, { swing: true }); break;
    case 'chorale': pad('organ', .4); bass('organ', [0], .4); lead('organ', .55, 1); break;
    case 'waltz': for (let bar = 0; bar < B; bar++) { const c = chord(deg(bar), -12); N('accordion', T(bar), c[0] - 12, spb * .9, .55); if (bar === B - 1) break; for (const b of [1, 2]) c.forEach(m => N('accordion', T(bar, b), m, spb * .5, .3)); } lead('accordion', .7, 1); break;
    case 'box': arp('musicbox', .35, 0, B - 1, 0, .5, [0, 2, 1, 2]); lead('musicbox', .7, 1); break;
    case 'island': strum('guitar', [.5, 1.5, 2.5, 3.5], .3); bass('bass', [0, 1.5, 2], .6); drums('light', 1); lead('steeldrum', .8, 1); break;
    case 'chinese': arp('guzheng', P.lead === 'guzheng' ? .32 : .28, 0, B - 1, -12, P.lead === 'guzheng' ? .5 : 1, P.lead === 'guzheng' ? [0, 1, 2, 3, 4, 3, 2, 1] : [0, 1, 2, 3]); pad('softpad', .18);
      lead(P.lead, .75, 1, 0, P.lead === 'erhu' ? { legato: 1 } : {}); break;
    case 'synth': pad('pad', .35); bass('bass', [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], .55); drums('four', 1); lead('lead', .7, 2); break;
    case 'chip': bass('chipTri', [0, .5, 1, 1.5, 2, 2.5, 3, 3.5], .6, 0, -12); arp('chip', .18, 0, B - 1, 0, .25, [0, 1, 2, 3]); drums('pop', 1, B - 1, .6); lead('chip', .45, 1, 1); break;
    case 'funk':
      for (let bar = 0; bar < B; bar++) { const r = chord(deg(bar), -24)[0]; if (bar === B - 1) { N('bassg', T(bar), r, bpb * spb, .9); break; } [[0, 0], [.75, 0], [1.5, 12], [2, 0], [2.75, 7], [3.5, 12]].forEach(([b, iv]) => N('bassg', T(bar, b), r + iv, spb * .35, .85)); }
      for (let bar = 1; bar < B - 1; bar++) for (const b of [.5, 2.5]) chord(deg(bar)).forEach(m => N('epiano', T(bar, b), m, spb * .3, .28));
      drums('pop', 1, B - 1, .85); break;
    case 'jazzdrums':
      drums('swing', 0, B - 1, 1);
      for (let bar = 0; bar < B; bar++) { const c = chord(deg(bar), -24); if (bar === B - 1) { N('bassg', T(bar), c[0], bpb * spb, .5); S.crash(T(bar), .7); S.kick(T(bar), .8); break; }
        [c[0], c[1], c[2], c[1]].forEach((m, j) => N('bassg', T(bar, j), m, spb * .9, .5)); if (bar % 4 === 3) [2, 2.33, 2.66, 3, 3.33, 3.66].forEach((b, j) => S.snare(T(bar, b), .35 + j * .08)); }
      break;
    case 'djembe': {
      const pats = [[0, 0, 2, 1, 2, 1, 0, 1], [0, 1, 1, 2, 0, 1, 2, 2], [0, -1, 2, 1, 0, 2, 1, 1]];
      for (let bar = 0; bar < B; bar++) { if (bar === B - 1) { S.djembe(T(bar), 0, 1); break; }
        pats[bar % 4 === 3 ? 2 : bar % 2].forEach((k, j) => { if (k >= 0) S.djembe(T(bar, j * .5), k, .8 + rng() * .2, -.3); });
        if (bar >= 2) for (let j = 0; j < 16; j++) { if (j % 2) { const k = rng() < .25 ? 2 : rng() < .5 ? 1 : -1; if (k >= 0) S.djembe(T(bar, j * .25), k, .45, .35); } S.shaker(T(bar, j * .25), j % 2 ? .4 : .7); } }
      break; }
    case 'taiko':
      for (let bar = 0; bar < B; bar++) { if (bar === B - 1) { S.taiko(T(bar), 1.2); S.crash(T(bar), .6); break; }
        const p = bar % 4 === 3 ? [0, .5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75] : [0, 1.5, 2, 3];
        p.forEach((b, j) => S.taiko(T(bar, b), bar % 4 === 3 ? .5 + j / p.length * .6 : (b === 0 ? 1 : .7))); if (bar % 4 !== 3) for (const b of [.5, 1, 2.5, 3.5]) S.kane(T(bar, b), .35); }
      lead('dizi', .4, 4, 1); break;
    case 'ensemble': pad('strings', .45); bass('cello', [0], .45); lead('violin', .65, 1); break;
  }
}

// ===== 擷取自影音剪輯助手：const easeOut = k => =====
const easeOut = k => 1 - Math.pow(1 - k, 3);
const easeBack = k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };
const easeBounce = k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; };

// ---------- 對外介面 ----------
const GSCR = {};
GS.forEach(([name, dur, fn], i) => { GSCR['gs' + i] = { name, dur, fn }; });
const MUSIC_LIST = [];
MUSIC_CATS.forEach(([k]) => {
  const n = k === 'weather' ? WEATHER.length : k === 'inst' ? INST.length : MUSIC_NAMES[k].length;
  for (let i = 0; i < n; i++) { const P = musicPlan(k, i); MUSIC_LIST.push({ id: 'mu_' + k + i, cat: k, name: P.name, dur: P.D, plan: P }); }
});
// 產生一首配樂（離線合成，回傳 AudioBuffer；第一次約需數秒）
async function renderMusicBuffer(P) {
  const sr = 44100, len = Math.ceil(sr * P.D), ac = new OfflineAudioContext(2, len, sr);
  const S = new Synth(ac, mulberry(P.seed), P.D);
  makeMusic(S, P);
  const WIN = 1.5; S.step(0, WIN + .1);
  for (let s = WIN; s < P.D - .2; s += WIN) { const at = Math.round(s * sr / 128) * 128 / sr; ac.suspend(at).then(() => { S.step(at, at + WIN + .1); ac.resume(); }); }
  const ab = await ac.startRendering();
  let peak = 0; for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { const x = Math.abs(d[i]); if (x > peak) peak = x; } }
  const k = peak > 0 ? Math.min(6, .89 / peak) : 1, fo = Math.round(sr * (P.cat === 'weather' ? 2 : 1.2)), fi = P.cat === 'weather' ? Math.round(sr * 1.5) : 0;
  for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { let x = d[i] * k; if (i < fi) x *= i / fi; if (i > len - fo) x *= (len - i) / fo; d[i] = x; } }
  return ab;
}
export {
  FF, TPL, drawTemplate, STK, BASIC, MASKS, MASK, GS, GSCR, TEXT_PRESETS, TPRE, D3_ANIMS, anim3D, glyph3D,
  MUSIC_CATS, MUSIC_LIST, renderMusicBuffer, chromaKey, roundRect, starPath, heartPath,
};
