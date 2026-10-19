// 時間軸：影片縮圖＋剪掉的片段、縮放、變速、註解、字幕、音訊波形
// 以「原始錄影時間」為刻度；拖曳邊緣會吸附到播放頭與其他段落（青色參考線）
import { h, clamp, fmtTime } from './util.js';
import { ic } from './icons.js';
import { t } from './i18n.js';
import { Shortcuts } from './shortcuts.js';

const ROWS = [
  { key: 'video', icon: 'screen', kind: 'trim' },
  { key: 'zoom', icon: 'zoom', kind: 'zoom' },
  { key: 'speed', icon: 'speed', kind: 'speed' },
  { key: 'ann', icon: 'text', kind: 'ann' },
  { key: 'cap', icon: 'captions', kind: 'cap' },
  { key: 'audio', icon: 'audio' },
];
const EXCLUSIVE = new Set(['zoom', 'trim', 'speed']); // 同一列不能重疊

export class Timeline {
  constructor(el, editor) {
    this.el = el;
    this.E = editor;
    this.pps = 0; // 每秒幾像素
    this.thumbs = null;
    this.build();
    this._ro = new ResizeObserver(() => { if (!this.userZoomed) this.fit(); this.render(); });
    this._ro.observe(this.scroll);
    this.loadThumbs();
  }
  get dur() { return this.E.p.duration || 1; }

  build() {
    const E = this.E, pl = E.player;
    this.playBtn = h('button', { class: 'btn icon pri', title: t('playPause') + ' ' + Shortcuts.label(Shortcuts.map.playPause), onclick: () => pl.toggle() }, ic('play'));
    this.timeEl = h('span', { class: 'time' });
    const q = (icon, title, fn) => h('button', { class: 'btn icon ghost', title, onclick: fn }, ic(icon));
    this.transport = h('div', { class: 'transport' },
      h('button', { class: 'btn icon ghost', title: t('sc_goStart'), onclick: () => pl.seek(0) }, ic('back')),
      this.playBtn, this.timeEl, h('span', { class: 'grow' }),
      q('scissors', t('addTrim') + ' (' + Shortcuts.label(Shortcuts.map.addTrim) + ')', () => E.addRegion('trim', 2)),
      q('zoom', t('addZoom') + ' (' + Shortcuts.label(Shortcuts.map.addZoom) + ')', () => E.addZoom()),
      q('speed', t('addSpeed') + ' (' + Shortcuts.label(Shortcuts.map.addSpeed) + ')', () => E.addRegion('speed', 3, { rate: 2 })),
      q('text', t('ann_text') + ' (' + Shortcuts.label(Shortcuts.map.addText) + ')', () => E.addAnnotation('text')),
      q('trash', t('delete'), () => E.deleteSel()),
      h('span', { style: { width: '8px' } }),
      q('plus', t('sc_timelineIn'), () => this.zoomBy(1.5)),
      h('button', { class: 'btn icon ghost', title: t('sc_timelineOut'), onclick: () => this.zoomBy(1 / 1.5) }, h('span', { style: { fontSize: '20px', lineHeight: 1 } }, '−')),
      h('button', { class: 'btn sm ghost', onclick: () => { this.userZoomed = false; this.fit(); this.render(); } }, t('fit')));
    this.heads = h('div', { class: 'tl-heads tracks' }, ROWS.map(r => h('div', { class: 'tl-head', title: t('row_' + r.key) }, ic(r.icon), h('span', {}, t('row_' + r.key)))));
    this.content = h('div', { class: 'tl-content tracks' });
    this.scroll = h('div', { class: 'tl-scroll' }, this.content);
    this.el.replaceChildren(this.transport, h('div', { class: 'tl-body' }, this.heads, this.scroll));
    this.scroll.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); this.zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15, e.clientX); }
      else if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { this.scroll.scrollLeft += e.deltaY; e.preventDefault(); }
    }, { passive: false });
    this.updateTransport();
  }

  fit() {
    const w = this.scroll.clientWidth - 16;
    if (w > 0) this.pps = Math.max(2, w / this.dur);
  }
  zoomBy(k, clientX) {
    const r = this.scroll.getBoundingClientRect();
    const anchorX = clientX != null ? clientX - r.left : (this.E.player.t * this.pps - this.scroll.scrollLeft);
    const tAt = (this.scroll.scrollLeft + anchorX) / this.pps;
    this.pps = clamp(this.pps * k, 2, 800);
    this.userZoomed = true;
    this.render();
    this.scroll.scrollLeft = tAt * this.pps - anchorX;
  }
  x(tm) { return tm * this.pps; }

  async loadThumbs() {
    try {
      const n = clamp(Math.round(this.dur / 2), 8, 60);
      this.thumbs = await this.E.media.thumbnails(n, 44);
      this.render();
    } catch (e) { console.warn('thumbs', e); }
  }

  render() {
    if (!this.pps) this.fit();
    const E = this.E, ed = E.p.edit, W = Math.max(this.x(this.dur) + 16, this.scroll.clientWidth);
    this.content.style.width = W + 'px';
    const frag = document.createDocumentFragment();
    frag.append(this.ruler(W));
    for (const r of ROWS) {
      const row = h('div', { class: 'track ' + r.key, 'data-row': r.key });
      row.addEventListener('pointerdown', e => { if (e.target === row || e.target.classList.contains('thumbs') || e.target.classList.contains('wave')) this.scrubStart(e); });
      if (r.key === 'video') {
        if (this.thumbs) {
          const th = h('div', { class: 'thumbs', style: { width: this.x(this.dur) + 'px' } });
          const tw = this.x(this.dur) / this.thumbs.length;
          for (const c of this.thumbs) { c.style.width = tw + 'px'; c.style.objectFit = 'cover'; th.append(c); }
          row.append(th);
        }
        for (const g of ed.trims) row.append(this.region(g, 'trim', '✂ ' + t('cut')));
      } else if (r.key === 'zoom') {
        for (const z of ed.zooms) row.append(this.region(z, 'zoom', `${z.depth.toFixed(1)}×${z.follow ? ' ↝' : ''}`, z.auto ? 'auto' : ''));
      } else if (r.key === 'speed') {
        for (const s of ed.speeds) row.append(this.region(s, 'speed', `${s.rate}×`));
      } else if (r.key === 'ann') {
        const lanes = assignLanes(ed.annotations);
        const n = Math.max(1, ...[...lanes.values()].map(v => v + 1));
        for (const a of ed.annotations) {
          const el = this.region(a, 'ann', annLabel(a), a.type === 'blur' ? 'blur' : '');
          const ln = lanes.get(a.id) || 0;
          el.style.top = `calc(${(ln / n) * 100}% + 2px)`; el.style.bottom = 'auto'; el.style.height = `calc(${100 / n}% - 4px)`;
          row.append(el);
        }
      } else if (r.key === 'cap') {
        for (const c of ed.captions) row.append(this.region(c, 'cap', c.text));
      } else if (r.key === 'audio') {
        this.waveCanvas = h('canvas', { class: 'wave' });
        row.append(this.waveCanvas);
      }
      frag.append(row);
    }
    // 剪掉的段落在所有列都打上暗色
    for (const g of ed.trims) frag.append(h('div', { class: 'trim-shade', style: { left: this.x(g.start) + 'px', width: this.x(g.end - g.start) + 'px', top: '24px' } }));
    this.playhead = h('div', { class: 'playhead' });
    this.snapEl = h('div', { class: 'snapline hidden' });
    frag.append(this.playhead, this.snapEl);
    this.content.replaceChildren(frag);
    this.renderWave();
    this.updatePlayhead();
  }

  ruler(W) {
    const r = h('div', { class: 'ruler' });
    const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600];
    const major = steps.find(s => s * this.pps >= 80) || 600;
    const minor = steps.filter(s => s < major).reverse().find(s => major / s >= 4 && s * this.pps >= 8) || major;
    for (let tm = 0; tm <= this.dur + 1e-6; tm += minor) {
      const isMajor = Math.abs(tm / major - Math.round(tm / major)) < 1e-6;
      r.append(h('i', { class: isMajor ? 'major' : '', style: { left: this.x(tm) + 'px' } }));
      if (isMajor) r.append(h('span', { style: { left: this.x(tm) + 'px' } }, fmtTime(tm, major < 1)));
    }
    r.addEventListener('pointerdown', e => this.scrubStart(e));
    return r;
  }

  renderWave() {
    const c = this.waveCanvas, pk = this.E.peaks;
    if (!c) return;
    const w = Math.min(16384, Math.round(this.x(this.dur))), hgt = c.parentElement?.clientHeight || 30;
    c.style.width = w + 'px'; c.style.right = 'auto';
    c.width = w; c.height = hgt;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, w, hgt);
    if (!pk) { ctx.fillStyle = '#556'; ctx.font = '11px sans-serif'; ctx.fillText(this.E.media.audio.mic || this.E.media.audio.sys ? t('loadingAudio') : t('noAudio'), 8, hgt / 2 + 4); return; }
    ctx.fillStyle = '#38bdf8';
    const ed = this.E.p.edit;
    for (let x = 0; x < w; x++) {
      const tm = x / w * this.dur;
      const i0 = Math.floor(x / w * pk.length), i1 = Math.max(i0 + 1, Math.floor((x + 1) / w * pk.length));
      let m = 0;
      for (let i = i0; i < i1 && i < pk.length; i++) if (pk[i] > m) m = pk[i];
      const trimmed = ed.trims.some(g => tm >= g.start && tm < g.end);
      ctx.globalAlpha = trimmed ? 0.25 : 0.9;
      const bh = Math.max(1, m * (hgt - 4));
      ctx.fillRect(x, (hgt - bh) / 2, 1, bh);
    }
  }

  updateTransport() {
    const pl = this.E.player;
    this.playBtn?.replaceChildren(ic(pl.playing ? 'pause' : 'play'));
    this.updatePlayhead();
  }
  updatePlayhead() {
    const pl = this.E.player;
    if (!this.playhead) return;
    const x = this.x(pl.t);
    this.playhead.style.left = x + 'px';
    this.timeEl.replaceChildren(h('b', {}, fmtTime(pl.outTime)), ' / ' + fmtTime(pl.outDur));
    if (pl.playing) {
      const sl = this.scroll.scrollLeft, w = this.scroll.clientWidth;
      if (x > sl + w - 40 || x < sl) this.scroll.scrollLeft = x - 40;
    }
  }

  timeAt(clientX) {
    const r = this.scroll.getBoundingClientRect();
    return clamp((clientX - r.left + this.scroll.scrollLeft) / this.pps, 0, this.dur);
  }
  scrubStart(e) {
    const pl = this.E.player;
    const wasPlaying = pl.playing;
    if (wasPlaying) pl.pause();
    const move = ev => pl.seek(this.timeAt(ev.clientX));
    move(e);
    if (this.E.sel) this.E.select(null, null, { tab: false });
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); };
    addEventListener('pointermove', move);
    addEventListener('pointerup', up);
  }

  // 段落元件：中間拖曳＝移動，左右把手＝改長度
  region(r, kind, label, extra = '') {
    const E = this.E;
    const el = h('div', { class: `rg ${kind} ${extra}${E.sel?.id === r.id ? ' sel' : ''}`, style: { left: this.x(r.start) + 'px', width: Math.max(6, this.x(r.end - r.start)) + 'px' }, title: label },
      h('div', { class: 'hd l' }), h('span', { style: { pointerEvents: 'none', overflow: 'hidden', textOverflow: 'ellipsis' } }, label), h('div', { class: 'hd r' }));
    el.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const mode = e.target.classList.contains('l') ? 'l' : e.target.classList.contains('r') ? 'r' : 'move';
      const list = E.listFor(kind);
      const s0 = r.start, e0 = r.end, t0 = this.timeAt(e.clientX);
      const others = EXCLUSIVE.has(kind) ? list.filter(o => o !== r) : [];
      const minL = 0.1;
      let moved = false;
      if (E.sel?.id !== r.id) E.select(kind, r.id, { tab: true });
      el.setPointerCapture(e.pointerId);
      const snaps = this.snapPoints(r);
      const onMove = ev => {
        const dt = this.timeAt(ev.clientX) - t0;
        if (!moved && Math.abs(dt * this.pps) < 3) return;
        moved = true;
        let ns = s0, ne = e0, snapAt = null;
        const snap = v => { const th = 8 / this.pps; let best = null; for (const p of snaps) if (Math.abs(p - v) < th && (best == null || Math.abs(p - v) < Math.abs(best - v))) best = p; return best; };
        if (mode === 'move') {
          ns = s0 + dt; ne = e0 + dt;
          const a = snap(ns), b = snap(ne);
          if (a != null && (b == null || Math.abs(a - ns) <= Math.abs(b - ne))) { ne += a - ns; ns = a; snapAt = a; }
          else if (b != null) { ns += b - ne; ne = b; snapAt = b; }
          const len = e0 - s0;
          if (ns < 0) { ns = 0; ne = len; } if (ne > this.dur) { ne = this.dur; ns = ne - len; }
          // 不能和同列其他段落重疊
          for (const o of others) {
            if (ns < o.end && ne > o.start) {
              if (s0 >= o.end - 1e-6) { ns = o.end; ne = ns + len; } else { ne = o.start; ns = ne - len; }
            }
          }
        } else if (mode === 'l') {
          ns = clamp(s0 + dt, 0, e0 - minL);
          const a = snap(ns); if (a != null && a < e0 - minL) { ns = a; snapAt = a; }
          for (const o of others) if (o.end <= s0 + 1e-6 && ns < o.end) ns = o.end;
        } else {
          ne = clamp(e0 + dt, s0 + minL, this.dur);
          const b = snap(ne); if (b != null && b > s0 + minL) { ne = b; snapAt = b; }
          for (const o of others) if (o.start >= e0 - 1e-6 && ne > o.start) ne = o.start;
        }
        r.start = ns; r.end = ne;
        el.style.left = this.x(ns) + 'px'; el.style.width = Math.max(6, this.x(ne - ns)) + 'px';
        this.snapEl.classList.toggle('hidden', snapAt == null);
        if (snapAt != null) this.snapEl.style.left = this.x(snapAt) + 'px';
        E.player.invalidate(kind === 'trim' || kind === 'speed');
        if (kind !== 'trim' && kind !== 'speed') E.player.seek(mode === 'r' ? Math.max(ns, ne - 0.05) : ns + 0.01);
      };
      const onUp = () => {
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        this.snapEl.classList.add('hidden');
        if (moved) {
          if (EXCLUSIVE.has(kind)) list.sort((a, b) => a.start - b.start);
          E.change({ structural: kind === 'trim' || kind === 'speed', panel: true });
        } else if (r.start > E.player.t || r.end <= E.player.t) E.player.seek(r.start + 0.01);
      };
      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    });
    el.addEventListener('dblclick', () => { E.player.seek(r.start + 0.01); });
    return el;
  }

  snapPoints(self) {
    const ed = this.E.p.edit, pts = [0, this.dur, this.E.player.t];
    for (const list of [ed.trims, ed.zooms, ed.speeds, ed.annotations, ed.captions]) for (const r of list) if (r !== self) pts.push(r.start, r.end);
    return pts;
  }

  dispose() { this._ro.disconnect(); }
}

function assignLanes(list) {
  const lanes = new Map(), ends = [];
  for (const a of [...list].sort((x, y) => x.start - y.start)) {
    let i = ends.findIndex(e => e <= a.start + 1e-6);
    if (i < 0) { i = ends.length; ends.push(0); }
    ends[i] = a.end;
    lanes.set(a.id, i);
  }
  return lanes;
}
function annLabel(a) {
  return { text: (a.d3 ? '3D ' : 'T ') + (a.text || ''), arrow: '➚ ' + t('ann_arrow'), rect: '▭ ' + t('ann_rect'), blur: '◌ ' + t('ann_blur'), image: '🖼 ' + t('ann_image'), sticker: '★ ' + t('ann_sticker'), effect: '✦ ' + t('ann_effect') }[a.type] || a.type;
}
