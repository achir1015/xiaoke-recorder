// 小柯機器人螢幕錄製工具：離線快取（手機、iPad「加入主畫面」後沒有網路也能開）
// 網頁與 version.json 網路優先（有新版就拿新版），其他檔案快取優先。
const CACHE = 'xiaoke-recorder-v4';
const CORE = ['./', './index.html', './version.json', './manifest.webmanifest', './css/app.css', './favicon.svg', './favicon-32.png', './favicon-16.png', './apple-touch-icon.png',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './vendor/mediabunny.min.mjs', './vendor/gifenc.esm.js', './vendor/mediabunny-mp3-encoder.min.mjs',
  ...['app', 'assets', 'library', 'transitions', 'autozoom', 'captions', 'captions-worker', 'compositor', 'cursor', 'desktop', 'editor', 'exporter', 'i18n', 'icons', 'media', 'player', 'project', 'recorder', 'shortcuts', 'timeline', 'updater', 'util'].map(f => `./js/${f}.js`),
  './js/lang/zh-TW.js', './js/lang/en.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k.startsWith('xiaoke-recorder')).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // 字幕模型由瀏覽器自己的快取處理
  const fresh = req.mode === 'navigate' || /\/(index\.html|version\.json)?$/.test(url.pathname) || url.pathname.endsWith('.js') || url.pathname.endsWith('.css');
  const save = res => { if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(url.pathname, copy)); } return res; };
  if (fresh) e.respondWith(fetch(req).then(save).catch(() => caches.match(url.pathname).then(r => r || caches.match('./index.html'))));
  else e.respondWith(caches.match(url.pathname).then(r => r || fetch(req).then(save)));
});
