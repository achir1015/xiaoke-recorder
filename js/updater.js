// 版本更新
//  網頁版／iPad／手機：比對伺服器上的 version.json，有新版就提示「重新載入」（離線快取也一起更新）
//  桌面版：問 Python 去 GitHub Releases 查最新版，一鍵下載安裝並自動重開
import { Desktop } from './desktop.js';

export const APP_VERSION = '1.2.0';

export async function checkWebUpdate() {
  try {
    const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return null;
    const j = await r.json();
    return { latest: j.version, notes: j.notes || [], date: j.date, newer: cmp(j.version, APP_VERSION) > 0 };
  } catch { return null; }
}

export async function checkDesktopUpdate() {
  if (!Desktop.available) return null;
  try {
    const r = await Desktop.api.check_update();
    if (r.status !== 'ok') return { error: r.message };
    return { ...r, newer: !!r.latest && cmp(r.latest, r.current) > 0 };
  } catch (e) { return { error: String(e) }; }
}

export async function applyWebUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('xiaoke-recorder')).map(k => caches.delete(k)));
  } catch { }
  location.reload();
}

export function cmp(a, b) {
  const pa = String(a).split('.').map(Number), pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d; }
  return 0;
}

export function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:' || Desktop.available) return;
  if (location.hostname === '127.0.0.1' && location.port && !location.search.includes('sw=1')) return; // 桌面版本機伺服器不需要
  navigator.serviceWorker.register('sw.js').catch(() => { });
}
