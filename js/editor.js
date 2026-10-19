// 編輯器：預覽、右側設定面板、時間軸、復原／重做、自動存檔、匯出
import { $, h, uid, clamp, fmtTime, fmtBytes, download, pickFile, roundRectPath, isTouch } from './util.js';
import { ic } from './icons.js';
import { t, getLang } from './i18n.js';
import { Store, defaultEdit, srcToOut, outToSrc } from './project.js';
import { MediaSet, computePeaks } from './media.js';
import { CursorTrack, CURSOR_THEMES } from './cursor.js';
import { VoiceRecorder } from './recorder.js';
import { WALLPAPERS, GRADIENTS, SOLIDS, ASPECTS, FONTS, outputSize, viewAt, stickerCanvas } from './compositor.js';
import * as LIB from './library.js';
import { getMusicBuffer, musicInfo, musicReady } from './assets.js';
import { TRANSITIONS, transitionThumb, defaultTransition } from './transitions.js';
import { Player } from './player.js';
import { Timeline } from './timeline.js';
import { exportVideo, remuxToMp4, exportMp3, audioBufferToMp3 } from './exporter.js';
import { zoomFromCursor, zoomFromMotion, mergeZooms } from './autozoom.js';
import { transcribe, CAPTION_MODELS, CAPTION_LANGS, toSRT, fromSRT } from './captions.js';
import { Shortcuts } from './shortcuts.js';
import { EASINGS } from './util.js';
import { Desktop, desktopSave } from './desktop.js';
import { toast, dialog, confirmBox, showHome, exportProjectFile, showSettings } from './app.js';

let E = null; // 目前開啟的編輯器
const LIBTHUMBS = new Map(); // 素材縮圖快取
// 一般字幕樣式（對應影音剪輯助手的 6 種）
const PRESET_STYLE = {
  tp0: { size: 4, color: '#ffffff', bg: 'rgba(0,0,0,.6)', stroke: '', bold: false, anim: 'fade', pos: 'bottom' },
  tp1: { size: 8, color: '#ffffff', bg: '', stroke: '', bold: true, anim: 'fade', pos: 'middle' },
  tp2: { size: 6.5, color: '#ffffff', bg: '', stroke: '#000000', bold: true, anim: 'none', pos: 'bottom' },
  tp3: { size: 7, color: '#ffd400', bg: '', stroke: '#000000', bold: true, anim: 'pop', pos: 'bottom' },
  tp4: { size: 3.8, color: '#f0a83a', bg: '', stroke: '#000000', bold: true, anim: 'slide', pos: 'top' },
  tp5: { size: 4, color: '#ffffff', bg: 'rgba(0,0,0,.6)', stroke: '', bold: false, anim: 'type', pos: 'bottom' },
};

export function closeEditor() {
  if (!E) return;
  E.save(); // 離開前存檔（例如在編輯中按了開始錄影熱鍵）
  E.dispose();
  E = null;
}

export async function openEditor(p) {
  closeEditor();
  // 舊版專案補上新欄位
  const d = defaultEdit();
  for (const k of Object.keys(d)) if (p.edit[k] === undefined) p.edit[k] = d[k];
  for (const k of ['background', 'camera', 'cursor', 'captionStyle', 'audio']) p.edit[k] = { ...d[k], ...p.edit[k] };
  const media = await MediaSet.open(p);
  E = new Editor(p, media);
  await E.mount();
  return E;
}

const TABS = [
  ['cut', 'scissors'], ['bg', 'bg'], ['frame', 'crop'], ['zoom', 'zoom'], ['cursor', 'cursor'],
  ['camera', 'camera'], ['annotate', 'text'], ['library', 'layers'], ['tracks', 'pip'], ['captions', 'captions'], ['audio', 'audio'],
];

class Editor {
  constructor(p, media) {
    this.p = p;
    this.media = media;
    this.sel = null;          // { kind, id }
    this.tab = 'cut';
    this.history = [JSON.stringify(p.edit)];
    this.hpos = 0;
    this.cropMode = false;
    this.assets = { cursor: p.cursor ? new CursorTrack(p.cursor, p.edit.cursor.smooth) : null, images: new Map(), bgImage: null };
    this._onKey = this.onKey.bind(this);
    this._onLang = () => this.mount(true);
  }

  async mount(again = false) {
    const p = this.p;
    document.title = (p.name || t('untitled')) + ' — ' + t('appName');
    const view = h('div', { class: 'view', id: 'editor' });
    this.view = view;
    this.saveState = h('span', { class: 'small dim hide-sm' }, '');
    const name = h('input', { type: 'text', value: p.name, style: { maxWidth: '260px', background: 'transparent', border: '1px solid transparent' }, 'aria-label': t('projectName'),
      onfocus: e => (e.target.style.borderColor = 'var(--line)'), onblur: e => (e.target.style.borderColor = 'transparent'),
      onchange: e => { p.name = e.target.value; this.save(); } });
    this.undoBtn = h('button', { class: 'btn icon ghost', title: t('undo') + ' ' + Shortcuts.label(Shortcuts.map.undo), onclick: () => this.undo() }, ic('undo'));
    this.redoBtn = h('button', { class: 'btn icon ghost', title: t('redo') + ' ' + Shortcuts.label(Shortcuts.map.redo), onclick: () => this.redo() }, ic('redo'));
    const more = h('button', { class: 'btn icon ghost', title: t('more'), onclick: () => this.moreMenu() }, ic('layers'));
    view.append(h('div', { class: 'topbar' },
      h('button', { class: 'btn icon ghost', title: t('back'), onclick: async () => { await this.save(); showHome(); } }, ic('back')),
      h('img', { src: 'icons/icon-192.png', alt: '', width: 28, height: 28, class: 'hide-sm', style: { borderRadius: '7px' } }),
      name, h('span', { class: 'grow' }), this.saveState, this.undoBtn, this.redoBtn, more,
      h('button', { class: 'btn icon ghost hide-sm', title: t('settings'), onclick: showSettings }, ic('settings')),
      h('button', { class: 'btn pri', onclick: () => this.exportDialog() }, ic('export'), h('span', {}, t('export')))));

    const ed = h('div', { class: 'ed' });
    this.canvas = h('canvas', { 'aria-label': t('preview') });
    this.stage = h('div', { class: 'stage' }, h('div', { class: 'stage-inner' }, this.canvas));
    this.tabsEl = h('div', { class: 'tabs', role: 'tablist' });
    this.panel = h('div', { class: 'panel' });
    const side = h('div', { class: 'side' }, this.tabsEl, this.panel);
    const tlEl = h('div', { class: 'tl' });
    ed.append(this.stage, side, tlEl);
    view.append(ed);
    $('#app').replaceChildren(view);

    if (!again) {
      // 背景圖、註解圖片
      if (p.edit.background.image?.blobKey) this.assets.bgImage = await this.media.image(p.edit.background.image.blobKey);
      for (const a of p.edit.annotations) if (a.blobKey) this.assets.images.set(a.blobKey, await this.media.image(a.blobKey));
      this.player = new Player(p, this.media, this.canvas, this.assets);
      this.player.on('time', () => this.timeline?.updatePlayhead());
      this.player.on('drawn', l => this.drawOverlay(l));
      this.player.on('play', () => this.timeline?.updateTransport());
      this.player.on('pause', () => this.timeline?.updateTransport());
      addEventListener('keydown', this._onKey);
      addEventListener('xkr-lang', this._onLang);
      this.loadAudio();
    } else {
      this.player.canvas = this.canvas; this.player.ctx = this.canvas.getContext('2d'); this.player.invalidate();
    }
    this.timeline = new Timeline(tlEl, this);
    this.setupCanvasPointer();
    this.renderTabs();
    this.renderPanel();
    this.updateUndo();
  }

  async loadAudio() {
    const bufs = [];
    for (const n of ['mic', 'sys']) {
      try { const b = await this.media.decodeAudio(n); if (b) bufs.push(b); } catch (e) { console.warn('audio', n, e); }
    }
    if (!E || E !== this) return;
    this.peaks = computePeaks(bufs, this.p.duration);
    this.timeline.renderWave();
    if (this.player.playing) { this.player.pause(); this.player.play(); }
  }

  dispose() {
    removeEventListener('keydown', this._onKey);
    removeEventListener('xkr-lang', this._onLang);
    this.player?.dispose();
    this.timeline?.dispose();
    this.media.dispose();
  }

  // ---------- 變更／歷史／存檔 ----------
  change({ structural = false, panel = false, timeline = true, history = true } = {}) {
    this.player.invalidate(structural);
    if (timeline) this.timeline.render();
    if (panel) this.renderPanel();
    if (history) {
      clearTimeout(this._ht);
      this._ht = setTimeout(() => this.pushHistory(), 350);
    }
    this.scheduleSave();
  }
  pushHistory() {
    const s = JSON.stringify(this.p.edit);
    if (s === this.history[this.hpos]) return;
    this.history = this.history.slice(0, this.hpos + 1);
    this.history.push(s);
    if (this.history.length > 200) this.history.shift();
    this.hpos = this.history.length - 1;
    this.updateUndo();
  }
  restore(i) {
    this.hpos = i;
    this.p.edit = JSON.parse(this.history[i]);
    if (this.sel && !this.findSel()) this.sel = null;
    this.player.invalidate(true);
    this.timeline.render();
    this.renderPanel();
    this.updateUndo();
    this.scheduleSave();
  }
  undo() { clearTimeout(this._ht); this.pushHistory(); if (this.hpos > 0) this.restore(this.hpos - 1); }
  redo() { if (this.hpos < this.history.length - 1) this.restore(this.hpos + 1); }
  updateUndo() { this.undoBtn.disabled = this.hpos <= 0; this.redoBtn.disabled = this.hpos >= this.history.length - 1; }
  scheduleSave() { this.saveState.textContent = t('unsaved'); clearTimeout(this._st); this._st = setTimeout(() => this.save(), 900); }
  async save() {
    clearTimeout(this._st);
    try { await Store.save(this.p); this.saveState.textContent = t('saved'); }
    catch (e) { this.saveState.textContent = t('saveFailed'); console.error(e); }
  }

  // ---------- 選取 ----------
  listFor(kind) { const e = this.p.edit; e.v2 ||= []; e.musicClips ||= []; e.voice ||= []; return { zoom: e.zooms, trim: e.trims, speed: e.speeds, ann: e.annotations, cap: e.captions, v2: e.v2, mus: e.musicClips, voice: e.voice }[kind]; }
  findSel() { return this.sel ? this.listFor(this.sel.kind)?.find(x => x.id === this.sel.id) : null; }
  select(kind, id, { seek = false, tab = true } = {}) {
    this.sel = kind ? { kind, id } : null;
    this.player.sel = id || null;
    const it = this.findSel();
    if (tab && it) this.tab = { zoom: 'zoom', trim: 'cut', speed: 'cut', ann: 'annotate', cap: 'captions', v2: 'tracks', mus: 'tracks', voice: 'tracks' }[kind];
    if (seek && it && (this.player.t < it.start || this.player.t >= it.end)) this.player.seek(it.start + 0.01);
    this.renderTabs();
    this.renderPanel();
    this.timeline.render();
    this.player.invalidate();
  }
  deleteSel() {
    const it = this.findSel();
    if (!it) return;
    const list = this.listFor(this.sel.kind);
    list.splice(list.indexOf(it), 1);
    const structural = this.sel.kind === 'trim' || this.sel.kind === 'speed';
    this.sel = null; this.player.sel = null;
    this.change({ structural, panel: true });
  }

  // 在播放頭位置新增一段，避開同一列已有的段落
  addRegion(kind, len, extra) {
    const list = this.listFor(kind);
    const dur = this.p.duration;
    let start = clamp(this.player.t, 0, Math.max(0, dur - 0.2));
    if (kind !== 'ann' && kind !== 'cap') {
      const hit = list.find(r => start >= r.start && start < r.end);
      if (hit) start = hit.end;
      const next = list.filter(r => r.start >= start).sort((a, b) => a.start - b.start)[0];
      const max = next ? next.start : dur;
      if (max - start < 0.2) { toast(t('noRoomHere'), true); return null; }
      len = Math.min(len, max - start);
    } else len = Math.min(len, dur - start);
    const r = { id: uid(), start, end: start + len, ...extra };
    list.push(r);
    list.sort((a, b) => a.start - b.start);
    this.sel = { kind, id: r.id };
    this.player.sel = r.id;
    this.tab = { zoom: 'zoom', trim: 'cut', speed: 'cut', ann: 'annotate', cap: 'captions' }[kind];
    this.renderTabs();
    this.change({ structural: kind === 'trim' || kind === 'speed', panel: true });
    return r;
  }
  addZoom() {
    const c = this.assets.cursor;
    let x = .5, y = .5;
    if (c) { const cr = this.p.edit.crop, pos = c.at(this.player.t); x = clamp((pos.x - cr.x) / cr.w, 0, 1); y = clamp((pos.y - cr.y) / cr.h, 0, 1); }
    return this.addRegion('zoom', 3, { depth: 2, x, y, follow: !!c, ease: 'smooth', transition: 0.6 });
  }
  addAnnotation(type, extra = {}) {
    const base = {
      text: { text: t('defaultText'), x: .3, y: .4, w: .4, h: .1, size: 4, color: '#ffffff', bg: 'rgba(0,0,0,.6)', bold: true, font: 'sans', anim: 'pop', align: 'left', stroke: '' },
      arrow: { x: .35, y: .35, x2: .55, y2: .55, color: '#ff3b30', width: 1.2, anim: 'grow' },
      rect: { x: .35, y: .35, w: .3, h: .2, color: '#ffd23f', width: 1, fill: '', anim: 'fade' },
      blur: { x: .35, y: .35, w: .3, h: .15, mode: 'blur', strength: 60, anim: 'none' },
      image: { x: .4, y: .35, w: .2, h: .2, anim: 'fade' },
    }[type];
    return this.addRegion('ann', 3, { type, ...base, ...extra });
  }

  // ---------- 鍵盤 ----------
  onKey(e) {
    if (e.target.closest?.('input,textarea,select,[contenteditable]') || document.querySelector('dialog[open]')) return;
    const a = Shortcuts.match(e);
    if (!a) return;
    const pl = this.player;
    const fr = 1 / 30;
    const acts = {
      playPause: () => pl.toggle(), addZoom: () => this.addZoom(),
      addTrim: () => this.addRegion('trim', 2), addSpeed: () => this.addRegion('speed', 3, { rate: 2 }),
      addText: () => this.addAnnotation('text'), addArrow: () => this.addAnnotation('arrow'), addBlur: () => this.addAnnotation('blur'),
      deleteSel: () => this.deleteSel(), undo: () => this.undo(), redo: () => this.redo(), save: () => this.save(), exportVideo: () => this.exportDialog(),
      frameBack: () => pl.seek(pl.t - fr), frameFwd: () => pl.seek(pl.t + fr), secBack: () => pl.seek(pl.t - 1), secFwd: () => pl.seek(pl.t + 1),
      goStart: () => pl.seek(0), goEnd: () => pl.seek(this.p.duration), timelineIn: () => this.timeline.zoomBy(1.4), timelineOut: () => this.timeline.zoomBy(1 / 1.4),
    };
    if (acts[a]) { e.preventDefault(); acts[a](); }
  }

  // ---------- 預覽畫面上的拖曳 ----------
  toCanvas(e) {
    const r = this.canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * this.canvas.width / r.width, y: (e.clientY - r.top) * this.canvas.height / r.height, k: this.canvas.width / r.width };
  }
  toContent(pt) {
    const L = this.player.layout;
    return { u: L.win.x + (pt.x - L.R.x) / L.R.w * L.win.w, v: L.win.y + (pt.y - L.R.y) / L.R.h * L.win.h };
  }
  setupCanvasPointer() {
    const cv = this.canvas;
    let drag = null;
    cv.onpointerdown = e => {
      const L = this.player.layout;
      if (!L) return;
      const pt = this.toCanvas(e), hs = 14 * pt.k * (isTouch() ? 1.6 : 1);
      const e2 = this.p.edit;
      cv.setPointerCapture(e.pointerId);
      // 裁切模式
      if (this.cropMode) {
        const c = this.toContentFull(pt);
        drag = { type: 'crop', u0: c.u, v0: c.v };
        return;
      }
      // 影片 2 的子母畫面：拖曳移動
      const vb = (L.v2Boxes || []).slice().reverse().find(b => pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h);
      if (vb) {
        if (this.sel?.id !== vb.clip.id) this.select('v2', vb.clip.id);
        drag = { type: 'v2', c: vb.clip, dx: pt.x - (vb.x + vb.w / 2), dy: pt.y - (vb.y + vb.h / 2) };
        return;
      }
      // 選取中的註解：控制點
      const sel = this.findSel();
      if (sel && this.sel.kind === 'ann') {
        const b = L.boxes.find(b => b.a.id === sel.id);
        if (b) {
          if (sel.type === 'arrow') {
            if (Math.hypot(pt.x - b.x1, pt.y - b.y1) < hs) { drag = { type: 'arrow1', a: sel }; return; }
            if (Math.hypot(pt.x - b.x2, pt.y - b.y2) < hs) { drag = { type: 'arrow2', a: sel }; return; }
          } else if (Math.abs(pt.x - (b.x + b.w)) < hs && Math.abs(pt.y - (b.y + b.h)) < hs) { drag = { type: 'resize', a: sel, start: { ...sel }, pt }; return; }
        }
      }
      // 註解本體（由上而下）
      for (let i = L.boxes.length - 1; i >= 0; i--) {
        const b = L.boxes[i];
        if (!b.active && b.a.id !== sel?.id) continue;
        const pad = 6 * pt.k;
        if (pt.x >= b.x - pad && pt.x <= b.x + b.w + pad && pt.y >= b.y - pad && pt.y <= b.y + b.h + pad) {
          if (this.sel?.id !== b.a.id) this.select('ann', b.a.id);
          drag = { type: 'move', a: b.a, start: { ...b.a }, c0: this.toContent(pt) };
          return;
        }
      }
      // 攝影機
      if (L.camBox) {
        const c = L.camBox;
        if (pt.x >= c.x && pt.x <= c.x + c.w && pt.y >= c.y && pt.y <= c.y + c.h) {
          drag = { type: 'camera', dx: pt.x - (c.x + c.w / 2), dy: pt.y - (c.y + c.h / 2) };
          if (this.tab !== 'camera') { this.tab = 'camera'; this.renderTabs(); this.renderPanel(); }
          return;
        }
      }
      // 縮放焦點（選了縮放段落時點畫面設定放大位置）
      if (sel && this.sel.kind === 'zoom') {
        drag = { type: 'zoomfocus', z: sel };
        this.setZoomFocus(sel, pt);
        return;
      }
      drag = null;
      if (this.sel) this.select(null);
    };
    cv.onpointermove = e => {
      if (!drag) { this.hoverCursor(e); return; }
      const pt = this.toCanvas(e), L = this.player.layout, ed = this.p.edit;
      if (drag.type === 'move') {
        const c = this.toContent(pt), du = c.u - drag.c0.u, dv = c.v - drag.c0.v, a = drag.a;
        a.x = drag.start.x + du; a.y = drag.start.y + dv;
        if (a.type === 'arrow') { a.x2 = drag.start.x2 + du; a.y2 = drag.start.y2 + dv; }
      } else if (drag.type === 'resize') {
        const a = drag.a, c = this.toContent(pt);
        if (a.type === 'text') {
          const k = Math.max(0.2, (c.u - a.x) / Math.max(0.02, drag.start.w));
          a.w = Math.max(0.05, c.u - a.x);
          void k;
        } else { a.w = Math.max(0.02, c.u - a.x); a.h = Math.max(0.02, c.v - a.y); }
        if (a.type === 'image' && e.shiftKey === false && drag.start.ratio) a.h = a.w / drag.start.ratio * (this.p.width * ed.crop.w) / (this.p.height * ed.crop.h);
      } else if (drag.type === 'arrow1' || drag.type === 'arrow2') {
        const c = this.toContent(pt);
        if (drag.type === 'arrow1') { drag.a.x = c.u; drag.a.y = c.v; } else { drag.a.x2 = c.u; drag.a.y2 = c.v; }
      } else if (drag.type === 'camera') {
        ed.camera.x = clamp((pt.x - drag.dx) / L.pw, 0, 1); ed.camera.y = clamp((pt.y - drag.dy) / L.ph, 0, 1);
      } else if (drag.type === 'v2') {
        drag.c.x = clamp((pt.x - drag.dx) / L.pw, 0, 1); drag.c.y = clamp((pt.y - drag.dy) / L.ph, 0, 1);
      } else if (drag.type === 'zoomfocus') {
        this.setZoomFocus(drag.z, pt);
      } else if (drag.type === 'crop') {
        const c = this.toContentFull(pt);
        const x0 = clamp(Math.min(drag.u0, c.u), 0, 1), y0 = clamp(Math.min(drag.v0, c.v), 0, 1);
        const x1 = clamp(Math.max(drag.u0, c.u), 0, 1), y1 = clamp(Math.max(drag.v0, c.v), 0, 1);
        if (x1 - x0 > 0.05 && y1 - y0 > 0.05) this.cropDraft = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
      }
      this.player.invalidate();
      drag.moved = true;
    };
    cv.onpointerup = () => {
      if (drag?.type === 'crop' && this.cropDraft) { this.p.edit.crop = this.cropDraft; this.cropDraft = null; this.cropMode = false; this.change({ panel: true }); }
      else if (drag?.moved) this.change({ timeline: false, panel: drag.type === 'zoomfocus' || drag.type === 'camera' });
      drag = null;
    };
    cv.onwheel = e => {
      // 選了文字註解時滾輪調整字級
      const s = this.findSel();
      if (s?.type === 'text' && e.ctrlKey) { e.preventDefault(); s.size = clamp(s.size * (e.deltaY < 0 ? 1.08 : 0.93), 1, 30); this.change({ timeline: false }); }
    };
  }
  // 裁切模式下以「完整影片」為座標
  toContentFull(pt) {
    const L = this.player.layout, cr = this.p.edit.crop;
    const c = this.toContent(pt);
    return { u: cr.x + c.u * cr.w, v: cr.y + c.v * cr.h };
  }
  setZoomFocus(z, pt) {
    const L = this.player.layout;
    // 依照「沒有縮放時」的畫面換算
    z.x = clamp((pt.x - L.R.x) / L.R.w, 0, 1); z.y = clamp((pt.y - L.R.y) / L.R.h, 0, 1);
    z.follow = false;
    this.player.invalidate();
  }
  hoverCursor(e) {
    const L = this.player.layout;
    if (!L) return;
    const pt = this.toCanvas(e);
    let c = 'default';
    if (this.cropMode || (this.sel?.kind === 'zoom')) c = 'crosshair';
    else if (L.boxes.some(b => (b.active || b.a.id === this.sel?.id) && pt.x >= b.x && pt.x <= b.x + b.w && pt.y >= b.y && pt.y <= b.y + b.h)) c = 'move';
    else if (L.camBox && pt.x >= L.camBox.x && pt.x <= L.camBox.x + L.camBox.w && pt.y >= L.camBox.y && pt.y <= L.camBox.y + L.camBox.h) c = 'grab';
    this.canvas.style.cursor = c;
  }

  // 選取框、控制點、縮放焦點、裁切框
  drawOverlay(L) {
    if (!L) return; // 片頭／片尾畫面沒有可編輯的東西
    const ctx = this.player.ctx, k = this.canvas.width / this.canvas.getBoundingClientRect().width || 1;
    ctx.save();
    const s = this.findSel();
    if (s && this.sel.kind === 'ann') {
      const b = L.boxes.find(b => b.a.id === s.id);
      if (b) {
        ctx.strokeStyle = '#22d3ee'; ctx.lineWidth = 1.5 * k; ctx.setLineDash([5 * k, 4 * k]);
        if (s.type === 'arrow') {
          ctx.setLineDash([]); ctx.fillStyle = '#fff';
          for (const [x, y] of [[b.x1, b.y1], [b.x2, b.y2]]) { ctx.beginPath(); ctx.arc(x, y, 6 * k, 0, 7); ctx.fill(); ctx.stroke(); }
        } else {
          ctx.strokeRect(b.x, b.y, b.w, b.h);
          ctx.setLineDash([]); ctx.fillStyle = '#fff';
          ctx.fillRect(b.x + b.w - 6 * k, b.y + b.h - 6 * k, 12 * k, 12 * k); ctx.strokeRect(b.x + b.w - 6 * k, b.y + b.h - 6 * k, 12 * k, 12 * k);
        }
      }
    }
    // 模糊區在不作用時也畫出虛線框，方便找
    for (const b of L.boxes) if (b.a.type === 'blur' && (b.a.id === s?.id || b.active)) { ctx.strokeStyle = '#94a3b8'; ctx.setLineDash([4 * k, 4 * k]); ctx.lineWidth = k; ctx.strokeRect(b.x, b.y, b.w, b.h); }
    if (s && this.sel.kind === 'zoom') {
      const x = L.R.x + s.x * L.R.w, y = L.R.y + s.y * L.R.h;
      ctx.setLineDash([]); ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2 * k;
      // 放大後看到的範圍（以未縮放畫面表示）
      const w = L.R.w / s.depth, hh = L.R.h / s.depth;
      const rx = clamp(x - w / 2, L.R.x, L.R.x + L.R.w - w), ry = clamp(y - hh / 2, L.R.y, L.R.y + L.R.h - hh);
      if (L.view.z < 1.02) { ctx.setLineDash([6 * k, 4 * k]); ctx.strokeRect(rx, ry, w, hh); ctx.setLineDash([]); }
      ctx.beginPath(); ctx.arc(x, y, 9 * k, 0, 7); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x - 14 * k, y); ctx.lineTo(x + 14 * k, y); ctx.moveTo(x, y - 14 * k); ctx.lineTo(x, y + 14 * k); ctx.stroke();
    }
    if (this.cropMode) {
      const cr = this.cropDraft || this.p.edit.crop, full = this.p.edit.crop;
      // 裁切模式下以目前裁切範圍為基準畫出新框
      const toX = u => L.R.x + (u - full.x) / full.w * L.R.w, toY = v => L.R.y + (v - full.y) / full.h * L.R.h;
      ctx.fillStyle = 'rgba(0,0,0,.45)';
      ctx.fillRect(L.R.x, L.R.y, L.R.w, L.R.h);
      ctx.clearRect(toX(cr.x), toY(cr.y), cr.w / full.w * L.R.w, cr.h / full.h * L.R.h);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * k; ctx.setLineDash([6 * k, 4 * k]);
      ctx.strokeRect(toX(cr.x), toY(cr.y), cr.w / full.w * L.R.w, cr.h / full.h * L.R.h);
    }
    ctx.restore();
  }

  // ---------- 右側面板 ----------
  renderTabs() {
    this.tabsEl.replaceChildren(...TABS.map(([k, icon]) => h('button', { class: this.tab === k ? 'on' : '', role: 'tab', 'aria-selected': this.tab === k, onclick: () => { this.tab = k; this.renderTabs(); this.renderPanel(); } }, ic(icon), t('tab_' + k))));
  }
  renderPanel() {
    const fn = this['panel_' + this.tab];
    const el = h('div');
    fn.call(this, el);
    this.panel.replaceChildren(el);
  }

  // 面板小元件
  slider(label, obj, key, min, max, step, opts = {}) {
    const fmt = opts.fmt || (v => v);
    const val = h('span', { class: 'val' }, fmt(obj[key]));
    const inp = h('input', { type: 'range', min, max, step, value: obj[key] });
    inp.oninput = () => { obj[key] = +inp.value; val.textContent = fmt(obj[key]); opts.onchange?.(obj[key]); this.change({ structural: !!opts.structural, timeline: !!opts.timeline, history: true }); };
    return h('div', { class: 'field' }, h('label', {}, h('span', {}, label), val), inp);
  }
  toggleRow(label, obj, key, opts = {}) {
    return h('div', { class: 'opt', style: { minHeight: '40px' } }, h('span', { class: 'grow' }, label), h('label', { class: 'toggle' },
      h('input', { type: 'checkbox', checked: !!obj[key], onchange: e => { obj[key] = e.target.checked; opts.onchange?.(obj[key]); this.change({ panel: !!opts.panel, structural: !!opts.structural }); } }), h('span')));
  }
  segRow(label, obj, key, options, opts = {}) {
    const wrap = h('div', { class: 'seg' }, options.map(([v, l]) => h('button', { class: obj[key] === v ? 'on' : '', onclick: () => { obj[key] = v; opts.onchange?.(v); this.change({ panel: true, structural: !!opts.structural }); } }, l)));
    return h('div', { class: 'field' }, label ? h('div', { class: 'lbl' }, label) : null, wrap);
  }
  colorRow(label, obj, key) {
    return h('div', { class: 'opt', style: { minHeight: '40px' } }, h('span', { class: 'grow' }, label),
      h('input', { type: 'color', value: toHex(obj[key]), oninput: e => { obj[key] = e.target.value; this.change({ timeline: false }); } }));
  }
  selectRow(label, obj, key, options, opts = {}) {
    return h('div', { class: 'field' }, h('div', { class: 'lbl' }, label),
      h('select', { onchange: e => { obj[key] = isNaN(+e.target.value) || e.target.value === '' ? e.target.value : +e.target.value; opts.onchange?.(obj[key]); this.change({ panel: !!opts.panel, structural: !!opts.structural }); } },
        options.map(([v, l]) => h('option', { value: v, selected: obj[key] === v }, l))));
  }
  timeFields(it, structural) {
    const mk = (key) => h('input', { type: 'number', step: 0.1, min: 0, max: this.p.duration, value: it[key].toFixed(2), onchange: e => {
      const v = clamp(+e.target.value, 0, this.p.duration);
      it[key] = v;
      if (it.end - it.start < 0.1) it.end = Math.min(this.p.duration, it.start + 0.1);
      this.change({ structural, panel: true });
    } });
    return h('div', { class: 'row' }, h('div', { class: 'field grow' }, h('div', { class: 'lbl' }, t('start')), mk('start')), h('div', { class: 'field grow' }, h('div', { class: 'lbl' }, t('end')), mk('end')));
  }
  delBtn() { return h('button', { class: 'btn danger', style: { marginTop: '8px' }, onclick: () => this.deleteSel() }, ic('trash'), t('delete')); }

  panel_cut(el) {
    el.append(h('p', { class: 'small dim' }, t('cutHelp')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => this.addRegion('trim', 2) }, ic('scissors'), t('addTrim')),
        h('button', { class: 'btn', onclick: () => this.addRegion('speed', 3, { rate: 2 }) }, ic('speed'), t('addSpeed'))));
    const s = this.findSel();
    if (s && this.sel.kind === 'trim') {
      el.append(h('h3', {}, t('trimSegment')), this.timeFields(s, true), h('p', { class: 'small dim' }, t('trimHelp')),
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('transThisCut')), this.transGrid(s.trans || 'auto', k => { s.trans = k; this.change({ structural: true, panel: true }); }, true)),
        this.delBtn());
    } else if (s && this.sel.kind === 'speed') {
      el.append(h('h3', {}, t('speedSegment')), this.timeFields(s, true),
        this.segRow(t('speed'), s, 'rate', [[0.25, '0.25×'], [0.5, '0.5×'], [0.75, '0.75×'], [1.5, '1.5×'], [2, '2×'], [3, '3×'], [4, '4×'], [8, '8×']], { structural: true }),
        this.delBtn());
    }
    const e = this.p.edit;
    const outDur = this.player.outDur;
    this.transitionSection(el);
    el.append(h('h3', {}, t('summary')), h('div', { class: 'small dim' }, t('summaryText', { orig: fmtTime(this.p.duration), out: fmtTime(outDur), trims: e.trims.length, speeds: e.speeds.length })));
  }

  panel_bg(el) {
    const bg = this.p.edit.background;
    el.append(this.segRow('', bg, 'type', [['wallpaper', t('wallpaper')], ['animated', t('lib_bg')], ['gradient', t('gradient')], ['solid', t('solid')], ['image', t('image')]], { onchange: v => { if (v === 'animated' && !bg.animated) bg.animated = 'bokeh'; } }));
    if (bg.type === 'animated') this.lib_bg(el);
    const sw = h('div', { class: 'swatches' });
    if (bg.type === 'wallpaper') {
      for (const [k, w] of Object.entries(WALLPAPERS)) {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const x = c.getContext('2d'); x.fillStyle = w.base; x.fillRect(0, 0, 64, 64);
        for (const [col, bx, by, r] of w.blobs) { const g = x.createRadialGradient(bx * 64, by * 64, 0, bx * 64, by * 64, r * 64); g.addColorStop(0, col); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
        sw.append(h('div', { class: 'swatch' + (bg.wallpaper === k ? ' on' : ''), title: k, style: { backgroundImage: `url(${c.toDataURL()})` }, onclick: () => { bg.wallpaper = k; this.change({ panel: true, timeline: false }); } }));
      }
    } else if (bg.type === 'gradient') {
      for (const g of GRADIENTS) sw.append(h('div', { class: 'swatch' + (bg.gradient.join() === g.join() ? ' on' : ''), style: { background: `linear-gradient(135deg,${g[0]},${g[1]})` }, onclick: () => { bg.gradient = [...g]; this.change({ panel: true, timeline: false }); } }));
    } else if (bg.type === 'solid') {
      for (const c of SOLIDS) sw.append(h('div', { class: 'swatch' + (bg.color === c ? ' on' : ''), style: { background: c, border: '1px solid #333' }, onclick: () => { bg.color = c; this.change({ panel: true, timeline: false }); } }));
    }
    el.append(sw);
    if (bg.type === 'gradient') {
      el.append(h('div', { class: 'opt' }, h('span', { class: 'grow' }, t('colors')),
        h('input', { type: 'color', value: bg.gradient[0], oninput: e => { bg.gradient = [e.target.value, bg.gradient[1]]; this.change({ timeline: false }); } }),
        h('input', { type: 'color', value: bg.gradient[1], oninput: e => { bg.gradient = [bg.gradient[0], e.target.value]; this.change({ timeline: false }); } })),
        this.slider(t('angle'), bg, 'angle', 0, 360, 5, { fmt: v => v + '°' }));
    }
    if (bg.type === 'solid') el.append(this.colorRow(t('customColor'), bg, 'color'));
    if (bg.type === 'image') {
      el.append(h('button', { class: 'btn', onclick: async () => {
        const f = await pickFile('image/*');
        if (!f) return;
        const key = 'b_' + uid() + uid();
        await Store.putBlob(key, f);
        bg.image = { blobKey: key };
        this.assets.bgImage = await this.media.image(key);
        this.change({ panel: true, timeline: false });
      } }, ic('upload'), t('chooseImage')));
      if (bg.image) el.append(this.slider(t('blurBackground'), bg, 'imageBlur', 0, 40, 1));
    }
    el.append(h('h3', {}, t('frameStyle')),
      this.slider(t('padding'), bg, 'padding', 0, 25, 0.5, { fmt: v => v + '%' }),
      this.slider(t('cornerRadius'), bg, 'radius', 0, 50, 1, { fmt: v => v + '%' }),
      this.slider(t('shadow'), bg, 'shadow', 0, 100, 1));
  }

  panel_frame(el) {
    const e = this.p.edit;
    el.append(h('h3', {}, t('aspectRatio')),
      this.segRow('', e, 'aspect', Object.keys(ASPECTS).map(k => [k, k === 'auto' ? t('original') : k]), { onchange: () => this.player.invalidate() }));
    const { W, H } = outputSize(this.p, 1080);
    el.append(h('div', { class: 'small dim' }, t('outputSizeAt1080', { w: W, h: H })));
    el.append(h('h3', {}, t('crop')),
      h('p', { class: 'small dim' }, t('cropHelp')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn' + (this.cropMode ? ' on' : ''), onclick: () => { this.cropMode = !this.cropMode; this.cropDraft = null; this.player.invalidate(); this.renderPanel(); } }, ic('crop'), this.cropMode ? t('cropDrawing') : t('cropStart')),
        h('button', { class: 'btn', onclick: () => { e.crop = { x: 0, y: 0, w: 1, h: 1 }; this.cropMode = false; this.change({ panel: true }); } }, t('reset'))),
      h('div', { class: 'small dim' }, t('cropNow', { w: Math.round(this.p.width * e.crop.w), h: Math.round(this.p.height * e.crop.h) })));
    el.append(h('h3', {}, t('motionBlur')), this.slider(t('motionBlurAmount'), e, 'motionBlur', 0, 100, 1), h('p', { class: 'small dim' }, t('motionBlurHelp')));
  }

  panel_zoom(el) {
    const e = this.p.edit, cur = this.assets.cursor;
    el.append(h('p', { class: 'small dim' }, cur ? t('zoomHelpCursor') : t('zoomHelpMotion')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn pri', onclick: () => this.autoZoom() }, ic('wand'), t('autoZoom')),
        h('button', { class: 'btn', onclick: () => this.addZoom() }, ic('plus'), t('addZoom'))));
    const s = this.findSel();
    if (s && this.sel.kind === 'zoom') {
      const px = v => Math.round(v);
      el.append(h('h3', {}, t('zoomSegment')), this.timeFields(s, false),
        this.slider(t('zoomDepth'), s, 'depth', 1.1, 5, 0.05, { fmt: v => v.toFixed(2) + '×' }),
        this.slider(t('zoomTransition'), s, 'transition', 0.1, 2, 0.05, { fmt: v => v.toFixed(2) + 's' }),
        (s.transitionOut ??= Math.max(1.2, s.transition ?? .6), this.slider(t('zoomOutTime'), s, 'transitionOut', 0.2, 4, 0.05, { fmt: v => v.toFixed(2) + 's' })),
        this.selectRow(t('easing'), s, 'ease', Object.keys(EASINGS).map(k => [k, t('ease_' + k)])));
      if (cur) el.append(this.toggleRow(t('followCursor'), s, 'follow', { panel: true }));
      if (!s.follow) {
        const vw = this.p.width * e.crop.w, vh = this.p.height * e.crop.h;
        const xi = h('input', { type: 'number', value: px(s.x * vw), min: 0, max: Math.round(vw), onchange: ev => { s.x = clamp(+ev.target.value / vw, 0, 1); this.change({ timeline: false }); } });
        const yi = h('input', { type: 'number', value: px(s.y * vh), min: 0, max: Math.round(vh), onchange: ev => { s.y = clamp(+ev.target.value / vh, 0, 1); this.change({ timeline: false }); } });
        el.append(h('div', { class: 'small dim' }, t('zoomFocusHelp')), h('div', { class: 'row' }, h('div', { class: 'field grow' }, h('div', { class: 'lbl' }, 'X (px)'), xi), h('div', { class: 'field grow' }, h('div', { class: 'lbl' }, 'Y (px)'), yi)));
      }
      el.append(h('div', { class: 'row wrap' }, h('button', { class: 'btn sm', onclick: () => { for (const z of e.zooms) { z.depth = s.depth; z.transition = s.transition; z.transitionOut = s.transitionOut; z.ease = s.ease; } this.change({}); toast(t('appliedToAll')); } }, t('applyToAllZooms')), this.delBtn()));
    }
    if (e.zooms.length) {
      el.append(h('h3', {}, t('zoomList') + ` (${e.zooms.length})`),
        h('div', { class: 'list' }, e.zooms.map((z, i) => h('div', { class: 'item' + (this.sel?.id === z.id ? ' on' : ''), onclick: () => this.select('zoom', z.id, { seek: true }) },
          ic('zoom'), h('span', { class: 'grow' }, `#${i + 1} ${z.depth.toFixed(1)}×${z.follow ? ' · ' + t('follow') : ''}${z.auto ? ' · ' + t('auto') : ''}`), h('span', { class: 't' }, fmtTime(z.start) + '–' + fmtTime(z.end))))),
        h('button', { class: 'btn sm danger', style: { marginTop: '8px' }, onclick: async () => { if (await confirmBox(t('clearZoomsConfirm'), t('delete'), true)) { e.zooms = []; this.sel = null; this.change({ panel: true }); } } }, t('clearZooms')));
    }
  }
  async autoZoom() {
    const e = this.p.edit;
    let list;
    if (this.assets.cursor) list = zoomFromCursor(this.assets.cursor, this.p.duration, e.crop);
    else {
      const bar = h('i');
      const d = dialog(t('autoZoom'), h('div', {}, h('p', {}, t('analyzing')), h('div', { class: 'progress' }, bar)));
      try { list = await zoomFromMotion(this.media.video.screen, this.p.duration, e.crop, p => (bar.style.width = (p * 100) + '%')); }
      finally { d.close(); }
    }
    if (!list.length) { toast(t('autoZoomNone')); return; }
    e.zooms = mergeZooms([...e.zooms.filter(z => !z.auto), ...list]);
    this.change({ panel: true });
    toast(t('autoZoomDone', { n: list.length }));
  }

  panel_cursor(el) {
    const c = this.p.edit.cursor;
    if (!this.assets.cursor) { el.append(h('div', { class: 'note', style: { marginTop: '12px' } }, t('cursorNoData'))); return; }
    el.append(this.toggleRow(t('showCustomCursor'), c, 'show'),
      h('h3', {}, t('cursorTheme')),
      this.segRow('', c, 'theme', CURSOR_THEMES.map(k => [k, t('cur_' + k)])),
      this.slider(t('cursorSize'), c, 'size', 0.5, 4, 0.05, { fmt: v => v.toFixed(2) + '×' }),
      this.slider(t('cursorSmooth'), c, 'smooth', 0, 100, 1, { onchange: v => this.assets.cursor.setSmooth(v) }),
      h('h3', {}, t('clickEffect')),
      this.segRow('', c, 'click', [['ripple', t('click_ripple')], ['ring', t('click_ring')], ['spark', t('click_spark')], ['none', t('none')]]),
      this.colorRow(t('clickColor'), c, 'clickColor'),
      this.toggleRow(t('cursorHighlight'), c, 'highlight'),
      this.toggleRow(t('hideIdleCursor'), c, 'hideIdle'));
  }

  panel_camera(el) {
    const c = this.p.edit.camera;
    if (!this.media.video.camera) { el.append(h('div', { class: 'note', style: { marginTop: '12px' } }, t('cameraNoData'))); return; }
    el.append(this.toggleRow(t('showCamera'), c, 'show'),
      this.segRow(t('shape'), c, 'shape', [['circle', t('shape_circle')], ['rounded', t('shape_rounded')], ['square', t('shape_square')], ['wide', t('shape_wide')], ['tall', t('shape_tall')]]),
      this.slider(t('size'), c, 'size', 8, 50, 0.5, { fmt: v => v + '%' }),
      h('details', { open: String(c.shape).startsWith('mask:') }, h('summary', { class: 'small', style: { cursor: 'pointer', margin: '6px 0' } }, t('moreShapes')),
        this.libGrid(LIB.MASKS.map(([k, name, fn]) => ({ name, on: c.shape === 'mask:' + k, thumb: this.thumb('mask_' + k, 96, 96, (g, w, hh) => { const gr = g.createLinearGradient(0, 0, w, hh); gr.addColorStop(0, '#f0a83a'); gr.addColorStop(1, '#3a78ad'); g.fillStyle = gr; g.translate(w / 2, hh / 2); fn(g, w * .9, hh * .9, .6); }), onclick: () => { c.shape = 'mask:' + k; this.change({ panel: true, timeline: false }); } })), '1/1')),
      this.toggleRow(t('mirror'), c, 'mirror'),
      this.slider(t('borderWidth'), c, 'border', 0, 10, 0.5),
      this.colorRow(t('borderColor'), c, 'borderColor'),
      this.slider(t('shadow'), c, 'shadow', 0, 100, 1),
      this.toggleRow(t('shrinkOnZoom'), c, 'shrinkOnZoom'),
      h('h3', {}, t('position')), h('p', { class: 'small dim' }, t('cameraDragHelp')),
      h('div', { class: 'row wrap' }, [['↖', .08, .12], ['↗', .92, .12], ['↙', .08, .88], ['↘', .92, .88]].map(([l, x, y]) => h('button', { class: 'btn icon', onclick: () => { c.x = x; c.y = y; this.change({ timeline: false }); } }, l))));
  }

  panel_annotate(el) {
    el.append(h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onclick: () => this.addAnnotation('text') }, ic('text'), t('ann_text')),
      h('button', { class: 'btn', onclick: () => this.addAnnotation('arrow') }, ic('arrow'), t('ann_arrow')),
      h('button', { class: 'btn', onclick: () => this.addAnnotation('rect') }, ic('rect'), t('ann_rect')),
      h('button', { class: 'btn', onclick: () => this.addAnnotation('blur') }, ic('blur'), t('ann_blur')),
      h('button', { class: 'btn', onclick: () => { this.tab = 'library'; this._libCat = 'sticker'; this.renderTabs(); this.renderPanel(); } }, '★ ', t('ann_sticker')),
      h('button', { class: 'btn', onclick: () => { this.tab = 'library'; this._libCat = 'effect'; this.renderTabs(); this.renderPanel(); } }, '✦ ', t('ann_effect')),
      h('button', { class: 'btn', onclick: async () => {
        const f = await pickFile('image/*');
        if (!f) return;
        const key = 'b_' + uid() + uid();
        await Store.putBlob(key, f);
        const img = await this.media.image(key);
        this.assets.images.set(key, img);
        const vw = this.p.width * this.p.edit.crop.w, vh = this.p.height * this.p.edit.crop.h;
        const w = .25, hh = img ? w * (img.height / img.width) * vw / vh : .2;
        this.addAnnotation('image', { blobKey: key, w, h: hh, ratio: img ? img.width / img.height : 1 });
      } }, ic('image'), t('ann_image'))));
    const a = this.findSel();
    if (a && this.sel.kind === 'ann') {
      el.append(h('h3', {}, t('ann_' + a.type)), this.timeFields(a, false));
      if (a.type === 'text') {
        el.append(h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('text')), h('textarea', { value: a.text, oninput: e => { a.text = e.target.value; this.change({}); } })),
          h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('textStyle')), this.libGrid(LIB.TEXT_PRESETS.map(p => ({ name: t('tp_' + p.id), thumb: this.presetThumb(p), on: a.preset === p.id, onclick: () => { this.applyPreset(p, a, false); this.change({ panel: true }); } })))),
          a.d3 ? h('button', { class: 'btn sm', onclick: () => { delete a.d3; a.preset = null; this.change({ panel: true }); } }, t('remove3d')) : null,
          this.slider(t('fontSize'), a, 'size', 1, 20, 0.1),
          this.selectRow(t('font'), a, 'font', Object.keys(FONTS).map(k => [k, t('font_' + k)])),
          this.toggleRow(t('bold'), a, 'bold'),
          this.colorRow(t('textColor'), a, 'color'),
          this.segRow(t('textBg'), a, 'bg', [['rgba(0,0,0,.6)', t('dark')], ['rgba(255,255,255,.85)', t('light')], ['#ff6a5c', t('accent')], ['transparent', t('none')]]),
          this.segRow(t('outline'), a, 'stroke', [['', t('none')], ['#000000', t('dark')], ['#ffffff', t('light')]]),
          this.segRow(t('align'), a, 'align', [['left', t('alignLeft')], ['center', t('alignCenter')]]),
          this.segRow(t('animation'), a, 'anim', [['none', t('none')], ['fade', t('anim_fade')], ['pop', t('anim_pop')], ['slide', t('anim_slide')], ['type', t('anim_type')], ['bounce', t('anim_bounce')]]));
      } else if (a.type === 'arrow') {
        el.append(this.colorRow(t('color'), a, 'color'), this.slider(t('lineWidth'), a, 'width', 0.3, 4, 0.05), this.segRow(t('animation'), a, 'anim', [['grow', t('anim_grow')], ['fade', t('anim_fade')], ['none', t('none')]]));
      } else if (a.type === 'rect') {
        el.append(this.colorRow(t('color'), a, 'color'), this.slider(t('lineWidth'), a, 'width', 0.2, 4, 0.05),
          this.segRow(t('fill'), a, 'fill', [['', t('none')], ['rgba(255,210,63,.18)', t('light')], ['rgba(0,0,0,.35)', t('dark')]]),
          this.segRow(t('animation'), a, 'anim', [['none', t('none')], ['fade', t('anim_fade')], ['pop', t('anim_pop')]]));
      } else if (a.type === 'blur') {
        el.append(this.segRow(t('blurMode'), a, 'mode', [['blur', t('blurGaussian')], ['pixelate', t('blurPixelate')]]), this.slider(t('strength'), a, 'strength', 5, 100, 1));
      } else if (a.type === 'sticker') {
        el.append(this.segRow(t('animation'), a, 'anim', [['none', t('none')], ['fade', t('anim_fade')], ['pop', t('anim_pop')], ['slide', t('anim_slide')], ['bounce', t('anim_bounce')]]));
      } else if (a.type === 'effect') {
        el.append(h('p', { class: 'small dim' }, (LIB.GSCR[a.gs]?.name || '') + ' · ' + t('effectHint')));
      } else if (a.type === 'image') {
        el.append(this.segRow(t('animation'), a, 'anim', [['none', t('none')], ['fade', t('anim_fade')], ['pop', t('anim_pop')], ['slide', t('anim_slide')]]));
      }
      el.append(h('p', { class: 'small dim' }, t('annDragHelp')), this.delBtn());
    } else el.append(h('p', { class: 'small dim', style: { marginTop: '12px' } }, t('annHelp')));
  }

  panel_captions(el) {
    const e = this.p.edit, cs = e.captionStyle;
    this._capOpts ||= { model: CAPTION_MODELS[1].id, language: getLang().startsWith('zh') ? 'zh' : getLang().slice(0, 2) };
    const o = this._capOpts;
    const hasAudio = this.media.audio.mic || this.media.audio.sys;
    el.append(h('p', { class: 'small dim' }, t('captionsHelp')));
    el.append(this.selectRow(t('captionModel'), o, 'model', CAPTION_MODELS.map(m => [m.id, t(m.key) + ' ' + m.size])),
      this.selectRow(t('spokenLanguage'), o, 'language', CAPTION_LANGS.map(l => [l, t('lang_' + l)])),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn pri', disabled: !hasAudio, onclick: () => this.genCaptions() }, ic('wand'), t('generateCaptions')),
        h('button', { class: 'btn', onclick: () => this.addRegion('cap', 2.5, { text: t('newCaption') }) }, ic('plus'), t('addCaption'))));
    if (!hasAudio) el.append(h('div', { class: 'note small' }, t('noAudioForCaptions')));
    el.append(h('h3', {}, t('captionStyle')), this.toggleRow(t('showCaptions'), cs, 'show'),
      this.libGrid(LIB.TEXT_PRESETS.map(p => ({ name: t('tp_' + p.id), thumb: this.presetThumb(p), on: cs.preset === p.id, onclick: () => { this.applyPreset(p, cs, true); this.change({ panel: true, timeline: false }); } }))),
      cs.d3 ? h('button', { class: 'btn sm', style: { marginTop: '6px' }, onclick: () => { delete cs.d3; cs.preset = null; this.change({ panel: true, timeline: false }); } }, t('remove3d')) : null,
      this.slider(t('fontSize'), cs, 'size', 2, 9, 0.1),
      this.colorRow(t('textColor'), cs, 'color'),
      this.segRow(t('textBg'), cs, 'bg', [['rgba(0,0,0,.55)', t('dark')], ['rgba(255,255,255,.85)', t('light')], ['transparent', t('none')]]),
      this.segRow(t('position'), cs, 'pos', [['top', t('top')], ['middle', t('middle')], ['bottom', t('bottom')]]),
      this.selectRow(t('font'), cs, 'font', Object.keys(FONTS).map(k => [k, t('font_' + k)])));
    el.append(h('div', { class: 'row wrap', style: { marginTop: '10px' } },
      h('button', { class: 'btn sm', disabled: !e.captions.length, onclick: () => download(new Blob([toSRT(e.captions)], { type: 'text/plain' }), (this.p.name || 'captions') + '.srt') }, ic('download'), t('exportSRT')),
      h('button', { class: 'btn sm', onclick: async () => { const f = await pickFile('.srt,.vtt,text/plain'); if (!f) return; const c = fromSRT(await f.text()); if (c.length) { e.captions = c; this.change({ panel: true }); } } }, ic('upload'), t('importSRT')),
      e.captions.length ? h('button', { class: 'btn sm danger', onclick: async () => { if (await confirmBox(t('clearCaptionsConfirm'), t('delete'), true)) { e.captions = []; this.change({ panel: true }); } } }, t('clearCaptions')) : null));
    if (e.captions.length) {
      el.append(h('h3', {}, t('captionList') + ` (${e.captions.length})`));
      const list = h('div', { class: 'list' });
      for (const c of e.captions) {
        list.append(h('div', { class: 'cap-item' + (this.sel?.id === c.id ? ' on' : '') },
          h('button', { class: 'btn sm ghost', style: { fontVariantNumeric: 'tabular-nums' }, onclick: () => this.select('cap', c.id, { seek: true }) }, fmtTime(c.start)),
          h('textarea', { value: c.text, rows: 1, onfocus: () => { if (this.sel?.id !== c.id) { this.sel = { kind: 'cap', id: c.id }; this.player.seek(c.start + 0.01); this.timeline.render(); } }, oninput: ev => { c.text = ev.target.value; this.change({}); } }),
          h('button', { class: 'btn icon sm ghost', title: t('delete'), onclick: () => { e.captions.splice(e.captions.indexOf(c), 1); this.change({ panel: true }); } }, ic('x'))));
      }
      el.append(list);
    }
  }
  async genCaptions() {
    const o = this._capOpts;
    const bar = h('i'), msg = h('p', {}, t('decodingAudio'));
    const d = dialog(t('generateCaptions'), h('div', {}, msg, h('div', { class: 'progress' }, bar), h('p', { class: 'small dim' }, t('captionsPrivacy'))));
    try {
      const src = this.media.audio.mic ? 'mic' : 'sys';
      let buf = await this.media.decodeAudio(src);
      if (this.media.audio.mic && this.media.audio.sys && this.p.edit.audio.micMute) buf = await this.media.decodeAudio('sys');
      const caps = await transcribe(buf, o, s => {
        if (s.phase === 'download') { msg.textContent = t('downloadingModel') + ' ' + (s.file || ''); bar.style.width = (s.pct || 0) + '%'; }
        else if (s.phase === 'transcribing') { msg.textContent = t('transcribing'); bar.style.width = '100%'; bar.style.opacity = .5; }
      });
      d.close();
      if (!caps.length) { toast(t('noSpeech')); return; }
      this.p.edit.captions = caps;
      this.p.edit.captionStyle.show = true;
      this.change({ panel: true });
      toast(t('captionsDone', { n: caps.length }));
    } catch (e) {
      d.close();
      console.error(e);
      toast(t('captionsFailed') + ' ' + (e.message || e), true, 8000);
    }
  }

  panel_audio(el) {
    const a = this.p.edit.audio;
    el.append(h('div', { class: 'row wrap', style: { margin: '10px 0' } },
      h('button', { class: 'btn', onclick: () => { this.tab = 'library'; this._libCat = 'music'; this.renderTabs(); this.renderPanel(); } }, ic('speaker'), t('lib_music')),
      h('button', { class: 'btn', onclick: () => { this.tab = 'tracks'; this.renderTabs(); this.renderPanel(); } }, ic('mic'), t('voiceRecord'))));
    const any = this.media.audio.mic || this.media.audio.sys;
    if (!any) { el.append(h('div', { class: 'note', style: { marginTop: '12px' } }, t('noAudio'))); return; }
    const restart = () => { if (this.player.playing) { this.player.pause(); this.player.play(); } };
    if (this.media.audio.mic) el.append(h('h3', {}, t('micTrack')), this.toggleRow(t('mute'), a, 'micMute', { onchange: restart }), this.slider(t('volume'), a, 'mic', 0, 2, 0.01, { fmt: v => Math.round(v * 100) + '%', onchange: () => { clearTimeout(this._vt); this._vt = setTimeout(restart, 200); } }));
    if (this.media.audio.sys) el.append(h('h3', {}, this.p.sources.mic || this.p.cursor ? t('sysTrack') : t('originalAudio')), this.toggleRow(t('mute'), a, 'sysMute', { onchange: restart }), this.slider(t('volume'), a, 'sys', 0, 2, 0.01, { fmt: v => Math.round(v * 100) + '%', onchange: () => { clearTimeout(this._vt); this._vt = setTimeout(restart, 200); } }));
  }


  // ================= 素材庫（來自小柯影音剪輯助手）=================
  panel_library(el) {
    this._libCat ||= 'music';
    const cats = [['music', 'lib_music'], ['text', 'lib_text'], ['sticker', 'lib_sticker'], ['effect', 'lib_effect'], ['transition', 'transitions'], ['intro', 'lib_intro'], ['outro', 'lib_outro'], ['bg', 'lib_bg']];
    el.append(h('p', { class: 'small dim' }, t('libHelp')),
      h('div', { class: 'seg', style: { marginBottom: '8px' } }, cats.map(([k, key]) => h('button', { class: this._libCat === k ? 'on' : '', onclick: () => { this._libCat = k; this.renderPanel(); } }, t(key)))));
    this['lib_' + this._libCat](el);
  }
  libGrid(items, ratio = '16/9') {
    return h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(96px,1fr))', gap: '8px' } }, items.map(it =>
      h('button', { class: 'item', title: it.name, style: { flexDirection: 'column', padding: '4px', gap: '4px', alignItems: 'stretch', ...(it.on ? { borderColor: 'var(--acc)' } : {}) }, onclick: it.onclick },
        h('div', { style: { aspectRatio: ratio, borderRadius: '6px', background: `#222 url(${it.thumb}) center/contain no-repeat` } }),
        h('span', { class: 'small', style: { textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, it.name))));
  }
  thumb(key, w, hgt, draw, bg = '#1c2028') {
    LIBTHUMBS.has(key) || LIBTHUMBS.set(key, (() => {
      const c = document.createElement('canvas'); c.width = w; c.height = hgt; const g = c.getContext('2d');
      if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, hgt); }
      try { draw(g, w, hgt); } catch { }
      return c.toDataURL('image/png');
    })());
    return LIBTHUMBS.get(key);
  }
  presetThumb(p) {
    return this.thumb('tp_' + p.id, 192, 108, (g, w, hh) => {
      const gr = g.createLinearGradient(0, 0, w, hh); gr.addColorStop(0, '#2b3a55'); gr.addColorStop(1, '#5a4a6a'); g.fillStyle = gr; g.fillRect(0, 0, w, hh);
      g.textBaseline = 'middle'; g.textAlign = 'left';
      if (p.d3) {
        const fs = 40; g.font = `900 ${fs}px ${FONTS.sans}`;
        const s = '3D', R = LIB.anim3D(p.d3, 2.5, fs), tw = g.measureText(s).width;
        g.save(); g.translate(w / 2, hh / 2); g.transform(R.sx * R.scale, 0, R.skew, R.sy * R.scale, 0, 0); LIB.glyph3D(g, s, -tw / 2, 0, fs, p.d3, R.ex, R.ey, R.depthK); g.restore();
      } else {
        const st = PRESET_STYLE[p.id], fs = Math.min(34, st.size * 6), s = t('lib_sample');
        g.font = `${st.bold ? 800 : 600} ${fs}px ${FONTS.sans}`; const tw = g.measureText(s).width, x = (w - tw) / 2, y = st.pos === 'top' ? hh * .25 : st.pos === 'middle' ? hh / 2 : hh * .72;
        if (st.bg) { g.fillStyle = st.bg; roundRectPath(g, x - 8, y - fs * .7, tw + 16, fs * 1.4, 6); g.fill(); }
        if (st.stroke) { g.lineWidth = fs * .16; g.strokeStyle = st.stroke; g.lineJoin = 'round'; g.strokeText(s, x, y); }
        g.fillStyle = st.color; g.fillText(s, x, y);
      }
    });
  }
  applyPreset(p, target, isCaption) {
    if (p.d3) { target.d3 = { ...p.d3 }; target.preset = p.id; if (!isCaption) { target.size = Math.max(target.size || 0, 7); target.bg = 'transparent'; target.anim = 'none'; } return; }
    const st = PRESET_STYLE[p.id];
    delete target.d3; target.preset = p.id;
    if (isCaption) Object.assign(target, { color: st.color, bg: st.bg || 'transparent', pos: st.pos, size: Math.min(7, Math.max(3.4, st.size * .85)) });
    else Object.assign(target, { color: st.color, bg: st.bg || 'transparent', stroke: st.stroke || '', bold: st.bold, size: st.size, anim: st.anim, align: 'center' });
  }
  lib_text(el) {
    const sel = this.findSel(), selText = sel && this.sel.kind === 'ann' && sel.type === 'text' ? sel : null;
    el.append(h('p', { class: 'small dim' }, selText ? t('presetForSelected') : t('presetHint')));
    const pick = p => {
      if (selText) this.applyPreset(p, selText, false);
      else { const a = this.addAnnotation('text', { text: p.d3 ? t('lib_sample3d') : t('defaultText') }); if (a) this.applyPreset(p, a, false); }
      this.change({ panel: true });
    };
    el.append(h('h3', {}, t('presetNormal')), this.libGrid(LIB.TEXT_PRESETS.filter(p => !p.d3).map(p => ({ name: t('tp_' + p.id), thumb: this.presetThumb(p), on: selText?.preset === p.id, onclick: () => pick(p) }))),
      h('h3', {}, t('preset3d')), this.libGrid(LIB.TEXT_PRESETS.filter(p => p.d3).map(p => ({ name: t('tp_' + p.id), thumb: this.presetThumb(p), on: selText?.preset === p.id, onclick: () => pick(p) }))),
      h('h3', {}, t('captionStyle')), h('p', { class: 'small dim' }, t('presetCaptionHint')),
      this.libGrid(LIB.TEXT_PRESETS.map(p => ({ name: t('tp_' + p.id), thumb: this.presetThumb(p), on: this.p.edit.captionStyle.preset === p.id, onclick: () => { this.applyPreset(p, this.p.edit.captionStyle, true); this.p.edit.captionStyle.show = true; this.change({ panel: true, timeline: false }); toast(t('presetApplied')); } }))));
  }
  lib_sticker(el) {
    el.append(this.libGrid(LIB.STK.map(([name, , size], i) => ({
      name, thumb: this.thumb('stk' + i, 128, 128, (g, w, hh) => { const c = stickerCanvas(i); const k = Math.min(w / c.width, hh / c.height); g.drawImage(c, (w - c.width * k) / 2, (hh - c.height * k) / 2, c.width * k, c.height * k); }, size ? '#3a4152' : null),
      onclick: () => {
        const c = stickerCanvas(i), vw = this.p.width * this.p.edit.crop.w, vh = this.p.height * this.p.edit.crop.h;
        if (size) this.addAnnotation('sticker', { stk: i, x: 0, y: 0, w: 1, h: 1, anim: 'fade' });   // 相框、標題條：整個畫面
        else { const w = .18, hh = w * (c.height / c.width) * vw / vh; this.addAnnotation('sticker', { stk: i, x: .41, y: .5 - hh / 2, w, h: hh, anim: 'pop' }); }
      },
    })), '1/1'));
  }
  lib_effect(el) {
    el.append(h('p', { class: 'small dim' }, t('effectHint')), this.libGrid(LIB.GS.map(([name, dur, fn], i) => ({
      name, thumb: this.thumb('gs' + i, 192, 108, (g, w, hh) => fn({ g, W: w, H: hh, t: Math.min(1.4, dur / 2), D: dur })),
      onclick: () => this.addRegion('ann', dur, { type: 'effect', gs: 'gs' + i, x: 0, y: 0, w: 1, h: 1, anim: 'none' }),
    }))));
  }
  lib_transition(el) { this.transitionSection(el); }
  lib_intro(el) { this.libTemplates(el, 'intro'); }
  lib_outro(el) { this.libTemplates(el, 'outro'); }
  libTemplates(el, kind) {
    const e = this.p.edit, cur = e[kind];
    if (cur) {
      const tpl = LIB.TPL[cur.id];
      el.append(h('h3', {}, t(kind === 'intro' ? 'lib_intro' : 'lib_outro') + '：' + (tpl?.name || '')),
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('introTitle')), h('input', { type: 'text', value: cur.title, oninput: ev => { cur.title = ev.target.value; this.player.invalidate(); this.scheduleSave(); } })),
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('introSub')), h('textarea', { value: cur.sub, rows: 2, oninput: ev => { cur.sub = ev.target.value; this.player.invalidate(); this.scheduleSave(); } })),
        this.slider(t('duration'), cur, 'dur', 2, 12, 0.5, { fmt: v => v + 's', structural: true, timeline: true }),
        this.colorRow(t('accentColor'), cur, 'accent'),
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, t(kind === 'intro' ? 'transAtIntro' : 'transAtOutro')), this.transGrid(cur.trans || 'auto', k => { cur.trans = k; this.change({ structural: true, panel: true }); }, true)),
        h('div', { class: 'row wrap' },
          h('button', { class: 'btn pri', onclick: async () => { await this.player.seekOut(kind === 'intro' ? 0 : this.player.tl.introD + this.player.tl.recOut); this.player.play(); } }, ic('play'), t('previewIt')),
          h('button', { class: 'btn danger', onclick: () => { e[kind] = null; this.change({ structural: true, panel: true }); } }, ic('trash'), t('removeIt'))));
    } else el.append(h('p', { class: 'small dim' }, t(kind === 'intro' ? 'introNone' : 'outroNone')));
    const ids = Object.keys(LIB.TPL).filter(k => k.startsWith(kind));
    el.append(h('h3', {}, t('chooseTemplate')), this.libGrid(ids.map(id => ({
      name: LIB.TPL[id].name, on: cur?.id === id,
      thumb: this.thumb('tpl_' + id, 192, 108, (g, w, hh) => LIB.drawTemplate(g, w, hh, LIB.TPL[id].anim === 'roll' ? 3.2 : 2.6, LIB.TPL[id].dur, LIB.TPL[id], null), null),
      onclick: async () => {
        const tp = LIB.TPL[id];
        e[kind] = { id, dur: tp.dur, title: cur?.title ?? tp.title, sub: cur?.sub ?? tp.sub, accent: tp.acc };
        this.change({ structural: true, panel: true });
        await this.player.seekOut(kind === 'intro' ? 0 : this.player.tl.introD + this.player.tl.recOut);
      },
    }))));
  }
  lib_music(el) {
    const e = this.p.edit, m = e.music;
    if (m) {
      const info = musicInfo(m.id);
      el.append(h('h3', {}, t('lib_music') + '：' + (info?.name || '')),
        h('div', { class: 'small dim' }, musicReady(m.id) && this.player.musicBuf ? '' : t('musicRendering')),
        this.slider(t('volume'), m, 'volume', 0, 1.5, 0.01, { fmt: v => Math.round(v * 100) + '%', onchange: () => { clearTimeout(this._mt); this._mt = setTimeout(() => { if (this.player.playing) { this.player.pause(); this.player.play(); } }, 250); } }),
        this.slider(t('fadeIn'), m, 'fadeIn', 0, 6, 0.1, { fmt: v => v + 's' }),
        this.slider(t('fadeOut'), m, 'fadeOut', 0, 8, 0.1, { fmt: v => v + 's' }),
        h('button', { class: 'btn danger', onclick: () => { e.music = null; this.stopMusicPreview(); this.change({ structural: true, panel: true }); } }, ic('trash'), t('removeIt')));
    } else el.append(h('p', { class: 'small dim' }, t('musicNone')));
    this._musicCat ||= 'happy';
    el.append(h('button', { class: 'btn sm', style: { marginTop: '8px' }, onclick: () => this.addClipFromFile('music') }, ic('upload'), t('addMusicFile')));
    el.append(h('h3', {}, t('chooseMusic')), h('div', { class: 'seg', style: { marginBottom: '6px' } }, LIB.MUSIC_CATS.map(([k]) => h('button', { class: this._musicCat === k ? 'on' : '', onclick: () => { this._musicCat = k; this.renderPanel(); } }, t('music_' + k)))));
    el.append(h('div', { class: 'list' }, LIB.MUSIC_LIST.filter(x => x.cat === this._musicCat).map(x => h('div', { class: 'item' + (m?.id === x.id ? ' on' : '') },
      h('button', { class: 'btn icon sm ghost', title: t('previewIt'), onclick: ev => this.previewMusic(x.id, ev.currentTarget) }, this._pvId === x.id ? '■' : '▶'),
      h('span', { class: 'grow' }, '♪ ' + x.name), h('span', { class: 't' }, fmtTime(x.dur, false)),
      h('button', { class: 'btn sm', title: t('wholeVideoMusic'), onclick: () => { e.music = { id: x.id, volume: m?.volume ?? 0.35, fadeIn: m?.fadeIn ?? 1, fadeOut: m?.fadeOut ?? 2 }; this.stopMusicPreview(); this.change({ structural: true, panel: true }); toast(t('musicRendering')); getMusicBuffer(x.id).then(() => this.tab === 'library' && this.renderPanel()); } }, t('musicUse')),
      h('button', { class: 'btn sm', title: t('addToMusicTrack'), onclick: () => { this.stopMusicPreview(); this.addMusicClip(x.id); } }, '＋' + t('row_music'))))));
  }
  async previewMusic(id, btn) {
    if (this._pvId === id) { this.stopMusicPreview(); this.renderPanel(); return; }
    this.stopMusicPreview();
    this._pvId = id; btn.textContent = '…';
    try {
      const buf = await getMusicBuffer(id);
      if (this._pvId !== id) return;
      this._pvCtx = new AudioContext();
      const s = this._pvCtx.createBufferSource(); s.buffer = buf; s.connect(this._pvCtx.destination); s.start();
      s.onended = () => { if (this._pvId === id) { this.stopMusicPreview(); this.renderPanel(); } };
      this.renderPanel();
    } catch (err) { this._pvId = null; toast(String(err.message || err), true); }
  }
  stopMusicPreview() { this._pvId = null; try { this._pvCtx?.close(); } catch { } this._pvCtx = null; }
  lib_bg(el) {
    const bg = this.p.edit.background;
    el.append(h('p', { class: 'small dim' }, t('animatedBgHint')), this.libGrid(Object.keys(LIB.BASIC).map(k => ({
      name: t('bg_' + k), on: bg.type === 'animated' && bg.animated === k,
      thumb: this.thumb('bg_' + k, 192, 108, (g, w, hh) => LIB.BASIC[k]({ g, W: w, H: hh, t: 1.3, D: 5, acc: '#f0a83a', tw: 0, ty: hh / 2, ts: 0 }), null),
      onclick: () => { bg.type = 'animated'; bg.animated = k; this.change({ panel: true, timeline: false }); },
    }))));
  }


  // ---------- 轉場 ----------
  transGrid(cur, onPick, withAuto = false) {
    const items = [];
    if (withAuto) items.push({ name: t('transFollowGlobal'), on: !cur || cur === 'auto', thumb: '', onclick: () => onPick('auto') });
    items.push({ name: t('none'), on: cur === 'none', thumb: '', onclick: () => onPick('none') });
    for (const k of TRANSITIONS) items.push({ name: t('trans_' + k), on: cur === k, thumb: (LIBTHUMBS.has('tr_' + k) || LIBTHUMBS.set('tr_' + k, transitionThumb(k, 160, 90)), LIBTHUMBS.get('tr_' + k)), onclick: () => onPick(k) });
    return this.libGrid(items);
  }
  transitionSection(el) {
    const tr = this.p.edit.transition ||= defaultTransition();
    el.append(h('h3', {}, t('transitions')), h('p', { class: 'small dim' }, t('transHelp')),
      this.transGrid(tr.type, k => { tr.type = k === 'auto' ? 'none' : k; this.change({ structural: true, panel: true }); }),
      this.slider(t('transDur'), tr, 'dur', 0.2, 2, 0.05, { fmt: v => v.toFixed(2) + 's', structural: true }),
      this.toggleRow(t('transAtCuts'), tr, 'cuts', { structural: true }),
      this.toggleRow(t('transAtIntro'), tr, 'intro', { structural: true }),
      this.toggleRow(t('transAtOutro'), tr, 'outro', { structural: true }));
  }


  // ================= 多軌：影片 2、背景音樂軌、錄音（旁白）軌 =================
  panel_tracks(el) {
    const e = this.p.edit, s = this.findSel(), k = this.sel?.kind;
    el.append(h('p', { class: 'small dim' }, t('tracksHelp')));
    const clipList = (list, kind, icon) => list.length ? h('div', { class: 'list', style: { marginTop: '6px' } }, list.map(c => h('div', { class: 'item' + (this.sel?.id === c.id ? ' on' : ''), onclick: () => this.select(kind, c.id, { seek: true }) },
      h('span', {}, icon), h('span', { class: 'grow', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, c.name || ''), h('span', { class: 't' }, fmtTime(c.start) + '–' + fmtTime(c.end))))) : null;
    const volume = c => this.slider(t('clipVolume'), c, 'volume', 0, 2, 0.01, { fmt: v => Math.round(v * 100) + '%', onchange: () => this.restartAudio() });
    const offset = c => h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('clipStartAt')), h('input', { type: 'number', min: 0, step: 0.1, value: (c.offset || 0).toFixed(1), onchange: ev => { c.offset = Math.max(0, +ev.target.value || 0); this.change({}); this.restartAudio(); } }));

    // ---- 影片 2 ----
    el.append(h('h3', {}, '◳ ' + t('row_v2')), h('p', { class: 'small dim' }, t('v2Help')),
      h('button', { class: 'btn', onclick: () => this.addClipFromFile('v2') }, ic('upload'), t('addVideo2')), clipList(e.v2, 'v2', '◳'));
    if (s && k === 'v2') {
      el.append(h('div', { class: 'card', style: { padding: '10px', marginTop: '8px' } },
        this.timeFields(s, false),
        this.segRow(t('v2Mode'), s, 'mode', [['pip', t('v2Pip')], ['full', t('v2Full')]]),
        s.mode === 'full' ? null : this.slider(t('v2Size'), s, 'size', 10, 80, 1, { fmt: v => v + '%' }),
        s.mode === 'full' ? null : h('div', { class: 'row wrap' }, [['↖', .2, .22], ['↗', .8, .22], ['↙', .2, .78], ['↘', .8, .78], ['⊙', .5, .5]].map(([l, x, y]) => h('button', { class: 'btn icon', onclick: () => { s.x = x; s.y = y; this.change({ timeline: false }); } }, l))),
        volume(s), this.toggleRow(t('mute'), s, 'mute', { onchange: () => this.restartAudio() }), offset(s), this.delBtn()));
    }
    // ---- 背景音樂軌 ----
    el.append(h('h3', {}, '♪ ' + t('row_music')), h('p', { class: 'small dim' }, t('musicTrackHelp')),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn', onclick: () => { this.tab = 'library'; this._libCat = 'music'; this.renderTabs(); this.renderPanel(); } }, ic('layers'), t('fromLibrary')),
        h('button', { class: 'btn', onclick: () => this.addClipFromFile('music') }, ic('upload'), t('addMusicFile'))),
      clipList(e.musicClips, 'mus', '♪'));
    if (s && k === 'mus') {
      el.append(h('div', { class: 'card', style: { padding: '10px', marginTop: '8px' } },
        this.timeFields(s, false), volume(s),
        this.slider(t('fadeIn'), s, 'fadeIn', 0, 6, 0.1, { fmt: v => v + 's', onchange: () => this.restartAudio() }),
        this.slider(t('fadeOut'), s, 'fadeOut', 0, 8, 0.1, { fmt: v => v + 's', onchange: () => this.restartAudio() }),
        this.toggleRow(t('musicLoop'), s, 'loop', { onchange: () => this.restartAudio() }), offset(s), this.delBtn()));
    }
    // ---- 錄音（旁白）軌 ----
    el.append(h('h3', {}, '🎙 ' + t('row_voice')), h('p', { class: 'small dim' }, t('voiceHelp')));
    const micSel = h('select', { onchange: ev => { this._voiceMic = ev.target.value; } }, h('option', { value: '' }, t('defaultMic')));
    navigator.mediaDevices?.enumerateDevices?.().then(ds => { for (const d of ds.filter(d => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default')) micSel.append(h('option', { value: d.deviceId, selected: d.deviceId === this._voiceMic }, d.label || t('mic'))); }).catch(() => { });
    el.append(h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('chooseMic')), micSel),
      h('div', { class: 'row wrap' },
        h('button', { class: 'btn ' + (this._vrec ? 'rec' : 'pri'), onclick: () => this.toggleVoiceRec() }, ic(this._vrec ? 'stop' : 'mic'), this._vrec ? t('voiceStop') : t('voiceRecord')),
        h('button', { class: 'btn', onclick: () => this.addClipFromFile('voice') }, ic('upload'), t('addVoiceFile'))),
      h('div', { class: 'note small', style: { marginTop: '6px' } }, t('headphonesTip')),
      clipList(e.voice, 'voice', '🎙'));
    if (s && k === 'voice') el.append(h('div', { class: 'card', style: { padding: '10px', marginTop: '8px' } }, this.timeFields(s, false), volume(s), offset(s), this.delBtn()));
  }
  restartAudio() { clearTimeout(this._ra); this._ra = setTimeout(() => { if (this.player.playing) { this.player.pause(); this.player.play(); } }, 200); }
  // 片段長度（輸出秒數）換成時間軸上的結束點
  endFor(start, dur) {
    const segs = this.player.segs;
    return Math.min(this.p.duration, outToSrc(segs, srcToOut(segs, start) + dur));
  }
  async addClipFromFile(kind) {
    const f = await pickFile(kind === 'v2' ? 'video/*,.mp4,.mov,.webm,.mkv' : 'audio/*,.mp3,.wav,.m4a,.aac,.ogg,.flac,video/*');
    if (!f) return;
    const key = 'b_' + uid() + uid();
    await Store.putBlob(key, f);
    let m;
    try { m = await this.media.clip(key); } catch (err) { toast(t('openFailed') + ' ' + (err.message || err), true); return; }
    if (kind === 'v2' && !m.v) { toast(t('openFailed'), true); return; }
    const start = clamp(this.player.t, 0, Math.max(0, this.p.duration - 0.2));
    const name = f.name.replace(/\.[^.]+$/, '');
    const base = { id: uid(), start, end: this.endFor(start, m.dur || 3), blobKey: key, name, offset: 0 };
    if (kind === 'v2') this.pushClip('v2', { ...base, mode: 'pip', x: .78, y: .26, size: 34, volume: 1, mute: false });
    else if (kind === 'music') this.pushClip('mus', { ...base, src: 'file', volume: .4, fadeIn: .5, fadeOut: 1.5, loop: false });
    else this.pushClip('voice', { ...base, volume: 1 });
  }
  addMusicClip(musicId) {
    const info = musicInfo(musicId), start = clamp(this.player.t, 0, Math.max(0, this.p.duration - 0.2));
    this.pushClip('mus', { id: uid(), start, end: this.p.duration, src: 'lib', musicId, name: info?.name || '', offset: 0, volume: .35, fadeIn: 1, fadeOut: 2, loop: true });
    toast(t('musicRendering'));
  }
  pushClip(kind, c) {
    this.listFor(kind).push(c);
    this.sel = { kind, id: c.id }; this.player.sel = c.id;
    this.tab = 'tracks'; this.renderTabs();
    this.change({ structural: true, panel: true });
  }
  // 錄旁白：從播放頭開始播放影片並同時錄音，再按一次停止，錄音放進錄音軌
  async toggleVoiceRec() {
    if (this._vrec) {
      const vr = this._vrec; this._vrec = null;
      clearInterval(this._vrecTick);
      this.player.pause();
      const { blob, dur } = await vr.stop();
      this.updateVoiceBtn();
      if (dur < 0.3 || !blob.size) { this.renderPanel(); return; }
      const key = 'b_' + uid() + uid();
      await Store.putBlob(key, blob);
      const start = this._vrecStart, n = (this.p.edit.voice || []).length + 1;
      this.pushClip('voice', { id: uid(), start, end: this.endFor(start, dur), blobKey: key, name: t('row_voice') + ' ' + n, offset: 0, volume: 1 });
      toast(t('voiceSaved'));
      return;
    }
    const vr = new VoiceRecorder();
    try { await vr.start(this._voiceMic); }
    catch (err) { toast(t('noMicForVoice') + ' ' + (err.message || ''), true, 5000); return; }
    this._vrec = vr;
    this._vrecStart = this.player.t;
    this.player.play();
    this._vrecTick = setInterval(() => this.updateVoiceBtn(), 250);
    this._vrecEnded ||= this.player.on('ended', () => { if (this._vrec) this.toggleVoiceRec(); });
    this.updateVoiceBtn();
    if (this.tab === 'tracks') this.renderPanel();
  }
  updateVoiceBtn() {
    const b = this.timeline?.voiceBtn;
    if (!b) return;
    const sp = b.querySelector('.vrec-t');
    b.classList.toggle('rec', !!this._vrec);
    sp.classList.toggle('hidden', !this._vrec);
    if (this._vrec) sp.textContent = ' ' + fmtTime(this._vrec.time, false);
  }

  // ---------- 其他選單 ----------
  moreMenu() {
    const p = this.p;
    const body = h('div', { class: 'list' },
      h('button', { class: 'btn', onclick: async () => { d.close(); await this.saveRaw(); } }, ic('download'), t('saveRawMp4')),
      ...['mic', 'sys'].filter(n => this.media.audio[n]).map(n => h('button', { class: 'btn', onclick: () => { d.close(); this.saveTrackMp3(n); } }, ic('audio'), t(n === 'mic' ? 'saveMicMp3' : 'saveSysMp3'))),
      h('button', { class: 'btn', onclick: () => { d.close(); exportProjectFile(p); } }, ic('folder'), t('exportProjectFile')),
      h('button', { class: 'btn', onclick: async () => { d.close(); if (await confirmBox(t('resetEditsConfirm'), t('reset'), true)) { const keep = p.edit.captions; p.edit = defaultEdit(); p.edit.captions = keep; this.sel = null; this.change({ structural: true, panel: true }); } } }, ic('refresh'), t('resetEdits')),
      h('div', { class: 'small dim', style: { marginTop: '6px' } }, t('projectInfo', { w: p.width, h: p.height, d: fmtTime(p.duration) })));
    const d = dialog(t('more'), body);
  }
  async saveTrackMp3(name) {
    const bar = h('i');
    const d = dialog(t('preparing'), h('div', {}, h('p', {}, t('encodingMp3')), h('div', { class: 'progress' }, bar)));
    try {
      const buf = await this.media.decodeAudio(name);
      const blob = await audioBufferToMp3(buf, p => (bar.style.width = p * 100 + '%'));
      d.close();
      await this.deliver(blob, `${this.p.name || 'recording'}-${name === 'mic' ? 'mic' : 'system'}.mp3`);
    } catch (e) { d.close(); toast(String(e.message || e), true); }
  }
  async saveRaw() {
    const d = dialog(t('preparing'), h('p', {}, t('preparingMp4')));
    try {
      const blob = await Store.getBlob(this.p.sources.screen.blobKey);
      const mp4 = await remuxToMp4(blob).catch(() => blob);
      d.close();
      await this.deliver(mp4, (this.p.name || 'recording') + '-raw.mp4');
    } catch (e) { d.close(); toast(String(e.message || e), true); }
  }

  // 下載／存檔／分享
  async deliver(blob, filename) {
    if (Desktop.available) {
      const path = await desktopSave(filename, blob);
      if (path) toast(t('savedTo', { path }), false, 6000);
      return;
    }
    download(blob, filename);
  }

  exportDialog() {
    this.player.pause();
    const o = this._exp ||= { format: 'mp4', height: 1080, fps: 30, quality: 'high', gifWidth: 640, gifFps: 15 };
    const body = h('div');
    const paint = () => {
      const { W, H } = outputSize(this.p, o.height);
      body.replaceChildren(
        h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('format')), h('div', { class: 'seg' }, [['mp4', 'MP4'], ['gif', 'GIF'], ['mp3', t('mp3Audio')]].filter(([v]) => v !== 'mp3' || this.media.audio.mic || this.media.audio.sys).map(([v, l]) => h('button', { class: o.format === v ? 'on' : '', onclick: () => { o.format = v; paint(); } }, l)))),
        o.format === 'mp3' ? null : h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('aspectRatio')), h('div', { class: 'seg' }, Object.keys(ASPECTS).map(k => h('button', { class: this.p.edit.aspect === k ? 'on' : '', onclick: () => { this.p.edit.aspect = k; this.change({}); paint(); } }, k === 'auto' ? t('original') : k)))),
        o.format === 'mp3' ? h('div', { class: 'small dim' }, t('mp3Info', { d: fmtTime(this.player.outDur) }))
        : o.format === 'mp4'
          ? h('div', {},
            h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('resolution')), h('div', { class: 'seg' }, [[720, '720p'], [1080, '1080p'], [1440, '1440p'], [2160, '4K']].map(([v, l]) => h('button', { class: o.height === v ? 'on' : '', onclick: () => { o.height = v; paint(); } }, l)))),
            h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('frameRate')), h('div', { class: 'seg' }, [24, 30, 60].map(v => h('button', { class: o.fps === v ? 'on' : '', onclick: () => { o.fps = v; paint(); } }, v + ' fps')))),
            h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('quality')), h('div', { class: 'seg' }, ['low', 'medium', 'high', 'max'].map(v => h('button', { class: o.quality === v ? 'on' : '', onclick: () => { o.quality = v; paint(); } }, t('q_' + v))))),
            h('div', { class: 'small dim' }, t('outputInfo', { w: W, h: H, d: fmtTime(this.player.outDur) })))
          : h('div', {},
            h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('gifWidth')), h('div', { class: 'seg' }, [320, 480, 640, 800].map(v => h('button', { class: o.gifWidth === v ? 'on' : '', onclick: () => { o.gifWidth = v; paint(); } }, v + 'px')))),
            h('div', { class: 'field' }, h('div', { class: 'lbl' }, t('frameRate')), h('div', { class: 'seg' }, [10, 15, 20].map(v => h('button', { class: o.gifFps === v ? 'on' : '', onclick: () => { o.gifFps = v; paint(); } }, v + ' fps')))),
            this.player.outDur > 30 ? h('div', { class: 'note warn small' }, t('gifLongWarn')) : null),
      );
    };
    paint();
    dialog(t('exportVideo'), body, [{ label: t('cancel'), value: null }, { label: t('startExport'), cls: 'pri', onclick: close => { close(); this.runExport(o); } }]);
  }

  async runExport(o) {
    await this.save();
    const bar = h('i'), msg = h('p', {}, t('exporting')), info = h('div', { class: 'small dim' });
    const ac = new AbortController();
    const t0 = performance.now();
    const d = dialog(t('exportVideo'), h('div', {}, msg, h('div', { class: 'progress' }, bar), info), [{ label: t('cancel'), onclick: close => { ac.abort(); close(); } }]);
    try {
      const opts = o.format === 'gif' ? { format: 'gif', height: 1080, fps: o.gifFps, gifWidth: o.gifWidth } : { format: 'mp4', height: o.height, fps: o.fps, quality: o.quality };
      const prog = (pct, phase) => {
        if (phase === 'audio') { msg.textContent = t('mixingAudio'); return; }
        msg.textContent = t('exporting');
        bar.style.width = (pct * 100).toFixed(1) + '%';
        const el = (performance.now() - t0) / 1000, left = pct > 0.02 ? el / pct - el : 0;
        info.textContent = `${Math.round(pct * 100)}% · ${t('remaining')} ${fmtTime(left, false)}`;
      };
      const res = o.format === 'mp3' ? await exportMp3(this.p, this.media, prog, ac.signal) : await exportVideo(this.p, this.media, this.assets, opts, prog, ac.signal);
      d.close();
      const name = (this.p.name || 'xiaoke') + '.' + res.ext;
      const url = URL.createObjectURL(res.blob);
      const preview = res.ext === 'mp3' ? h('audio', { src: url, controls: true, style: { width: '100%' } }) : res.ext === 'gif' ? h('img', { src: url, style: { maxWidth: '100%', borderRadius: '8px' } }) : h('video', { src: url, controls: true, playsInline: true, style: { maxWidth: '100%', borderRadius: '8px', background: '#000' } });
      const btns = [{ label: t('close'), value: null }];
      if (!Desktop.available && navigator.canShare?.({ files: [new File([res.blob], name, { type: res.blob.type })] })) {
        btns.push({ label: t('share'), onclick: async () => { try { await navigator.share({ files: [new File([res.blob], name, { type: res.blob.type })], title: name }); } catch { } } });
      }
      btns.push({ label: Desktop.available ? t('saveAs') : t('download'), cls: 'pri', onclick: async () => { await this.deliver(res.blob, name); } });
      dialog(t('exportDone'), h('div', {}, preview, h('p', { class: 'small dim' }, `${res.W ? res.W + '×' + res.H + ' · ' : ''}${fmtTime(res.dur)} · ${fmtBytes(res.blob.size)}`)), btns)
        .then(() => URL.revokeObjectURL(url));
    } catch (e) {
      d.close();
      if (e?.name === 'AbortError') return;
      console.error(e);
      toast(t('exportFailed') + ' ' + (e.message || e), true, 8000);
    }
  }
}

function toHex(c) {
  if (!c) return '#000000';
  if (c.startsWith('#')) return c.length === 4 ? '#' + [...c.slice(1)].map(x => x + x).join('') : c.slice(0, 7);
  const m = c.match(/\d+/g);
  return m ? '#' + m.slice(0, 3).map(v => (+v).toString(16).padStart(2, '0')).join('') : '#000000';
}

export function currentEditor() { return E; }
