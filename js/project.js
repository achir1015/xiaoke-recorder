// 專案資料模型與本機儲存（IndexedDB）
// 一個專案 = 錄到的媒體檔（Blob）＋ 編輯設定（JSON）。所有時間都以「原始錄影的秒數」記錄。
import { uid } from './util.js';

export const PROJECT_FORMAT = 1;

export function defaultEdit() {
  return {
    trims: [],          // 剪掉的片段 {id,start,end}
    speeds: [],         // 變速片段 {id,start,end,rate}
    zooms: [],          // 縮放 {id,start,end,depth,x,y,follow,ease,transition,auto}
    annotations: [],    // 註解 {id,type,start,end,x,y,w,h,...}
    captions: [],       // 字幕 {id,start,end,text}
    crop: { x: 0, y: 0, w: 1, h: 1 },
    aspect: 'auto',
    background: { type: 'wallpaper', wallpaper: 'aurora', color: '#1e2230', gradient: ['#7f5af0', '#2cb67d'], angle: 135, image: null, imageBlur: 0, padding: 8, radius: 14, shadow: 60, inset: 0 },
    motionBlur: 40,
    camera: { show: true, shape: 'circle', size: 22, x: 0.92, y: 0.88, mirror: true, border: 3, borderColor: '#ffffff', shadow: 50, shrinkOnZoom: true },
    cursor: { show: true, theme: 'mac', size: 1.4, smooth: 60, click: 'ripple', clickColor: '#ffd23f', hideIdle: false, highlight: false },
    captionStyle: { show: true, size: 4.2, color: '#ffffff', bg: 'rgba(0,0,0,.55)', pos: 'bottom', font: 'sans' },
    audio: { mic: 1, sys: 1, micMute: false, sysMute: false },
    // 素材庫（來自小柯影音剪輯助手）
    intro: null,        // 片頭 {id:'intro3', dur, title, sub, accent}
    outro: null,        // 片尾 {id:'outro0', dur, title, sub, accent}
    music: null,        // 背景配樂 {id:'mu_happy0', volume, fadeIn, fadeOut}
  };
}

export function newProject(name, sources, meta = {}) {
  return {
    id: uid() + uid(),
    format: PROJECT_FORMAT,
    name: name || '',
    created: Date.now(),
    updated: Date.now(),
    // sources: { screen:{blobKey,track}, camera?, mic?, sys? }；cursor：游標軌跡（桌面版才有）
    sources,
    cursor: meta.cursor || null,
    duration: meta.duration || 0,
    width: meta.width || 1920,
    height: meta.height || 1080,
    thumb: null,
    edit: defaultEdit(),
  };
}

// ---- IndexedDB ----
const DB_NAME = 'xiaoke-recorder';
let _db;
function db() {
  if (_db) return _db;
  _db = new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('projects', { keyPath: 'id' });
      d.createObjectStore('blobs');
    };
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
  return _db;
}
async function tx(store, mode, fn) {
  const d = await db();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const s = t.objectStore(store);
    let out;
    Promise.resolve(fn(s)).then(v => { out = v; });
    t.oncomplete = () => res(out);
    t.onerror = () => rej(t.error);
    t.onabort = () => rej(t.error);
  });
}
const req2p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

export const Store = {
  async putBlob(key, blob) { await tx('blobs', 'readwrite', s => s.put(blob, key)); return key; },
  async getBlob(key) { return tx('blobs', 'readonly', s => req2p(s.get(key))); },
  async delBlob(key) { return tx('blobs', 'readwrite', s => s.delete(key)); },
  async save(p) { p.updated = Date.now(); const copy = JSON.parse(JSON.stringify(p)); await tx('projects', 'readwrite', s => s.put(copy)); },
  async get(id) { return tx('projects', 'readonly', s => req2p(s.get(id))); },
  async list() {
    const all = await tx('projects', 'readonly', s => req2p(s.getAll()));
    return (all || []).sort((a, b) => b.updated - a.updated);
  },
  async remove(id) {
    const p = await this.get(id);
    if (!p) return;
    for (const k of blobKeys(p)) await this.delBlob(k);
    await tx('projects', 'readwrite', s => s.delete(id));
  },
  async estimate() { try { return await navigator.storage.estimate(); } catch { return null; } },
};

export function blobKeys(p) {
  const keys = new Set();
  for (const s of Object.values(p.sources || {})) if (s?.blobKey) keys.add(s.blobKey);
  if (p.edit?.background?.image?.blobKey) keys.add(p.edit.background.image.blobKey);
  for (const a of p.edit?.annotations || []) if (a.blobKey) keys.add(a.blobKey);
  return [...keys];
}

// ---- 專案檔（.xkrec）：把專案和所有媒體打包成一個檔案，可帶到別台電腦 ----
// 格式：'XKREC1' + 4 位元組 JSON 長度 + JSON（含每個 blob 的長度）+ 依序排列的 blob 內容
export async function packProject(p) {
  const keys = blobKeys(p);
  const blobs = [];
  const index = [];
  for (const k of keys) {
    const b = await Store.getBlob(k);
    if (!b) continue;
    blobs.push(b);
    index.push({ key: k, size: b.size, type: b.type });
  }
  const json = new TextEncoder().encode(JSON.stringify({ project: p, blobs: index }));
  const head = new Uint8Array(10);
  head.set(new TextEncoder().encode('XKREC1'), 0);
  new DataView(head.buffer).setUint32(6, json.length, true);
  return new Blob([head, json, ...blobs], { type: 'application/octet-stream' });
}

export async function unpackProject(file) {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (new TextDecoder().decode(head.slice(0, 6)) !== 'XKREC1') throw new Error('bad-project-file');
  const len = new DataView(head.buffer).getUint32(6, true);
  const meta = JSON.parse(new TextDecoder().decode(await file.slice(10, 10 + len).arrayBuffer()));
  let off = 10 + len;
  const remap = {};
  for (const b of meta.blobs) {
    const nk = 'b_' + uid() + uid();
    remap[b.key] = nk;
    await Store.putBlob(nk, file.slice(off, off + b.size, b.type));
    off += b.size;
  }
  const p = meta.project;
  p.id = uid() + uid();
  for (const s of Object.values(p.sources || {})) if (s?.blobKey) s.blobKey = remap[s.blobKey];
  if (p.edit?.background?.image?.blobKey) p.edit.background.image.blobKey = remap[p.edit.background.image.blobKey];
  for (const a of p.edit?.annotations || []) if (a.blobKey) a.blobKey = remap[a.blobKey];
  await Store.save(p);
  return p;
}

// ---- 時間對應：原始時間（含剪掉/變速）⇄ 輸出時間 ----
// 回傳依序排列的片段 [{s0,s1,rate,o0,o1}]，s 是原始秒數，o 是輸出影片的秒數
export function buildSegments(edit, duration) {
  const cuts = [...edit.trims].filter(r => r.end > r.start).sort((a, b) => a.start - b.start);
  const keep = [];
  let cur = 0;
  for (const c of cuts) {
    if (c.start > cur) keep.push([cur, Math.min(c.start, duration)]);
    cur = Math.max(cur, c.end);
  }
  if (cur < duration) keep.push([cur, duration]);
  const pts = new Set();
  for (const [a, b] of keep) { pts.add(a); pts.add(b); }
  for (const s of edit.speeds) { pts.add(s.start); pts.add(s.end); }
  const sorted = [...pts].filter(v => v >= 0 && v <= duration).sort((a, b) => a - b);
  const segs = [];
  let o = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const s0 = sorted[i], s1 = sorted[i + 1];
    if (s1 - s0 < 1e-4) continue;
    const mid = (s0 + s1) / 2;
    if (!keep.some(([a, b]) => mid >= a && mid < b)) continue;
    const sp = edit.speeds.find(r => mid >= r.start && mid < r.end);
    const rate = sp ? sp.rate : 1;
    const d = (s1 - s0) / rate;
    segs.push({ s0, s1, rate, o0: o, o1: o + d });
    o += d;
  }
  return segs;
}
export const outputDuration = segs => (segs.length ? segs[segs.length - 1].o1 : 0);
export function outToSrc(segs, o) {
  for (const g of segs) if (o < g.o1) return g.s0 + (Math.max(o, g.o0) - g.o0) * g.rate;
  return segs.length ? segs[segs.length - 1].s1 : 0;
}
export function srcToOut(segs, s) {
  for (const g of segs) {
    if (s < g.s0) return g.o0;
    if (s < g.s1) return g.o0 + (s - g.s0) / g.rate;
  }
  return outputDuration(segs);
}
// 完整輸出時間軸：片頭 → 錄影（剪掉、變速後）→ 片尾
export function buildTimeline(edit, duration) {
  const segs = buildSegments(edit, duration);
  const introD = edit.intro ? edit.intro.dur : 0, recOut = outputDuration(segs), outroD = edit.outro ? edit.outro.dur : 0;
  return { segs, introD, recOut, outroD, total: introD + recOut + outroD };
}
// 輸出時間 o 對應到哪個部分：{kind:'intro'|'rec'|'outro', lt(該段內秒數), src(錄影原始秒數)}
export function partAt(tl, o) {
  if (o < tl.introD) return { kind: 'intro', lt: o, src: 0 };
  const r = o - tl.introD;
  if (r < tl.recOut || !tl.outroD) return { kind: 'rec', lt: r, src: outToSrc(tl.segs, Math.min(r, tl.recOut)) };
  return { kind: 'outro', lt: r - tl.recOut, src: tl.segs.length ? tl.segs[tl.segs.length - 1].s1 - 0.001 : 0 };
}
export function isTrimmed(edit, s) { return edit.trims.some(r => s >= r.start && s < r.end); }
