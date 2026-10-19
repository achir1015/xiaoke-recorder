// 桌面版（Windows／Mac／Linux 的 Python 程式）提供的功能：原生錄影、真實游標、直接存檔、版本更新
// 網頁版沒有 window.pywebview，這些功能會自動隱藏。

export const Desktop = {
  get available() { return !!(window.pywebview && window.pywebview.api); },
  get api() { return window.pywebview.api; },
  info: null,
};

export function whenDesktopReady(timeout = 2500) {
  return new Promise(res => {
    if (Desktop.available) return res(true);
    const t = setTimeout(() => res(false), timeout);
    window.addEventListener('pywebviewready', () => { clearTimeout(t); res(true); }, { once: true });
  });
}

export async function desktopInfo() {
  if (!Desktop.available) return null;
  try { Desktop.info = await Desktop.api.app_info(); } catch { Desktop.info = null; }
  return Desktop.info;
}

// 把 Blob 分段（每段 4MB，base64）傳給 Python 寫進使用者選的檔案
export async function desktopSave(filename, blob, onProgress) {
  const api = Desktop.api;
  const r = await api.begin_save(filename);
  if (r.status === 'declined') return null;
  if (r.status !== 'ok') throw new Error(r.message || 'save failed');
  const CH = 4 * 1024 * 1024;
  for (let off = 0; off < blob.size; off += CH) {
    const buf = new Uint8Array(await blob.slice(off, off + CH).arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
    const w = await api.write_chunk(r.token, btoa(bin));
    if (w.status !== 'ok') throw new Error(w.message);
    onProgress?.(Math.min(1, (off + CH) / blob.size));
  }
  const e = await api.end_save(r.token);
  if (e.status !== 'ok') throw new Error(e.message);
  return e.path;
}

// 原生錄影（Python 用 ffmpeg 錄螢幕、記錄游標與點擊、錄系統聲音）
export const NativeRec = {
  async capabilities() { try { return await Desktop.api.native_capabilities(); } catch { return { ok: false }; } },
  async targets() { return Desktop.api.list_targets(); },
  async start(opts) { return Desktop.api.native_start(opts); },
  async pause() { return Desktop.api.native_pause(); },
  async resume() { return Desktop.api.native_resume(); },
  async stop() { return Desktop.api.native_stop(); },
  async cancel() { return Desktop.api.native_cancel(); },
  async status() { return Desktop.api.native_status(); },
  // Python 在本機 http 伺服器提供錄好的檔案
  async fetch(url) { const r = await fetch(url); if (!r.ok) throw new Error('fetch ' + url); return r.blob(); },
};
