// 轉場：剪掉片段的接點、片頭→錄影、錄影→片尾
// 20 種效果與小柯影音剪輯助手相同。轉場不改變影片長度：接點前播 A、接點後播 B，
// 轉場期間 A 在接點後停在最後一格、B 在接點前停在第一格，兩者依效果混合。
import { clamp } from './util.js';

export const TRANSITIONS = ['crossfade', 'dipBlack', 'dipWhite', 'flash', 'blur', 'wipeLeft', 'wipeRight', 'wipeUp', 'wipeDiag',
  'pushLeft', 'pushRight', 'pushUp', 'barnDoor', 'iris', 'clock', 'blinds', 'checker', 'zoom', 'spin', 'slideIn'];

const easeIO = k => (k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function defaultTransition() {
  return { type: 'none', dur: 0.6, cuts: true, intro: true, outro: true };
}

// 所有接點（輸出時間）：[{T, key, kind, type, dur}]
export function transitionPoints(edit, tl) {
  const g = edit.transition || defaultTransition(), out = [];
  const typeFor = own => (own && own !== 'auto' ? own : g.type);
  if (edit.intro && tl.recOut > 0) {
    const type = typeFor(edit.intro.trans);
    if (g.intro || (edit.intro.trans && edit.intro.trans !== 'auto')) out.push({ T: tl.introD, key: 'intro', kind: 'intro', type });
  }
  // 錄影中的剪掉接點：片段之間原始時間不連續的地方
  const segs = tl.segs;
  for (let i = 0; i < segs.length - 1; i++) {
    if (Math.abs(segs[i].s1 - segs[i + 1].s0) < 1e-3) continue;
    const trim = edit.trims.find(r => Math.abs(r.end - segs[i + 1].s0) < 1e-3 || (r.start <= segs[i].s1 + 1e-3 && r.end >= segs[i + 1].s0 - 1e-3));
    const own = trim?.trans;
    if (!g.cuts && !(own && own !== 'auto')) continue;
    out.push({ T: tl.introD + segs[i].o1, key: 'cut:' + (trim?.id || i), kind: 'cut', trim, type: typeFor(own) });
  }
  if (edit.outro && tl.recOut > 0) {
    const type = typeFor(edit.outro.trans);
    if (g.outro || (edit.outro.trans && edit.outro.trans !== 'auto')) out.push({ T: tl.introD + tl.recOut, key: 'outro', kind: 'outro', type });
  }
  return out.filter(p => p.type && p.type !== 'none').map(p => ({ ...p, dur: g.dur || 0.6 }));
}

// 輸出時間 o 是否在某個轉場裡：回傳 {T, type, dur, p(0..1)}
export function transitionAt(points, o) {
  for (const pt of points) {
    const h = pt.dur / 2;
    if (o >= pt.T - h && o < pt.T + h) return { ...pt, p: clamp((o - (pt.T - h)) / pt.dur, 0, 1) };
  }
  return null;
}

// 把 A、B 兩張畫面依轉場效果畫到 g
export function drawTransition(g, LA, LB, type, p, W, H) {
  const e = easeIO(clamp(p, 0, 1));
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, H);
  const put = (L, o = {}) => {
    g.save(); g.globalAlpha = o.alpha ?? 1; if (o.op) g.globalCompositeOperation = o.op; if (o.filter) g.filter = o.filter;
    g.translate(W / 2 + (o.tx || 0), H / 2 + (o.ty || 0)); if (o.r) g.rotate(o.r); if (o.s != null) g.scale(o.s, o.s);
    g.drawImage(L, -W / 2, -H / 2, W, H); g.restore();
  };
  const reveal = path => { put(LA); g.save(); g.beginPath(); path(g); g.clip(); put(LB); g.restore(); };
  const fillAll = (col, a) => { g.save(); g.globalAlpha = a; g.fillStyle = col; g.fillRect(0, 0, W, H); g.restore(); };
  switch (type) {
    case 'crossfade': put(LA); put(LB, { alpha: e }); break;
    case 'dipBlack': case 'dipWhite': {
      const col = type === 'dipBlack' ? '#000' : '#fff';
      if (p < .5) { put(LA); fillAll(col, easeIO(p * 2)); } else { put(LB); fillAll(col, easeIO((1 - p) * 2)); }
      break;
    }
    case 'flash': (p < .5 ? put(LA) : put(LB)); fillAll('#fff', Math.max(0, 1 - Math.abs(p - .5) * 3.2)); break;
    case 'blur': put(LA, { filter: `blur(${(e * H / 36).toFixed(1)}px)` }); put(LB, { alpha: e, filter: `blur(${((1 - e) * H / 36).toFixed(1)}px)` }); break;
    case 'wipeLeft': reveal(c => c.rect(W * (1 - e), 0, W * e, H)); break;
    case 'wipeRight': reveal(c => c.rect(0, 0, W * e, H)); break;
    case 'wipeUp': reveal(c => c.rect(0, H * (1 - e), W, H * e)); break;
    case 'wipeDiag': { const k = e * (W + H) * 1.02; reveal(c => { c.moveTo(0, 0); c.lineTo(k, 0); c.lineTo(0, k); c.closePath(); }); break; }
    case 'barnDoor': reveal(c => c.rect(W / 2 - e * W / 2, 0, e * W, H)); break;
    case 'iris': reveal(c => c.arc(W / 2, H / 2, e * Math.hypot(W, H) / 2, 0, Math.PI * 2)); break;
    case 'clock': reveal(c => { const r = Math.hypot(W, H); c.moveTo(W / 2, H / 2); c.arc(W / 2, H / 2, r, -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); c.closePath(); }); break;
    case 'blinds': { const n = 10, sh = H / n; reveal(c => { for (let i = 0; i < n; i++) c.rect(0, i * sh, W, sh * e); }); break; }
    case 'checker': {
      const cols = 8, cw = W / cols, ch = cw, rows = Math.ceil(H / ch);
      reveal(c => { for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) { const ph = (i + j) % 2 ? .5 : 0, k = clamp((p - ph) * 2, 0, 1); if (k > 0) c.rect(i * cw, j * ch, cw, ch * easeIO(k)); } });
      break;
    }
    case 'pushLeft': put(LA, { tx: -e * W }); put(LB, { tx: (1 - e) * W }); break;
    case 'pushRight': put(LA, { tx: e * W }); put(LB, { tx: -(1 - e) * W }); break;
    case 'pushUp': put(LA, { ty: -e * H }); put(LB, { ty: (1 - e) * H }); break;
    case 'slideIn': put(LA, { alpha: 1 - e * .35 }); put(LB, { tx: (1 - e) * W }); break;
    case 'zoom': put(LA, { alpha: 1 - e, s: 1 + e * .9 }); put(LB, { alpha: e, s: 1.6 - e * .6 }); break;
    case 'spin':
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      if (p < .5) { const k = easeIO(p * 2); put(LA, { r: k * Math.PI, s: Math.max(.01, 1 - k) }); }
      else { const k = easeIO((p - .5) * 2); put(LB, { r: -(1 - k) * Math.PI, s: Math.max(.01, k) }); }
      break;
    default: put(p < .5 ? LA : LB);
  }
  g.restore();
}

// 轉場縮圖（設定面板用）：A 為深藍、B 為橘色
export function transitionThumb(type, w = 160, h = 90) {
  const mk = (c1, c2, label) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.font = `800 ${h * .42}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, h / 2); return c; };
  const A = mk('#1f3b73', '#3a78ad', 'A'), B = mk('#f0a83a', '#e8264f', 'B');
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  drawTransition(c.getContext('2d'), A, B, type, type === 'spin' ? .3 : type.startsWith('dip') || type === 'flash' ? .35 : .5, w, h);
  return c.toDataURL('image/png');
}
