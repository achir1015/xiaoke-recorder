// 多國語言：繁中、簡中、英、日、韓、西、法、義、葡（巴西）、俄、土、越、阿拉伯
// 每個語言一個檔案（js/lang/xx.js），切換時才載入；缺少的字串依序退回英文、繁中。
import zhTW from './lang/zh-TW.js';

export const LANGS = [
  { code: 'zh-TW', name: '繁體中文' }, { code: 'zh-CN', name: '简体中文' }, { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' }, { code: 'ko', name: '한국어' }, { code: 'es', name: 'Español' },
  { code: 'fr', name: 'Français' }, { code: 'it', name: 'Italiano' }, { code: 'pt-BR', name: 'Português (Brasil)' },
  { code: 'ru', name: 'Русский' }, { code: 'tr', name: 'Türkçe' }, { code: 'vi', name: 'Tiếng Việt' }, { code: 'ar', name: 'العربية' },
];

const dicts = { 'zh-TW': zhTW };
let cur = 'zh-TW';
const listeners = new Set();

function detect() {
  try { const s = localStorage.getItem('xkr.lang'); if (s && LANGS.some(l => l.code === s)) return s; } catch { }
  const nav = (navigator.languages || [navigator.language || 'zh-TW']).map(x => x.toLowerCase());
  for (const n of nav) {
    if (n.startsWith('zh')) return /cn|sg|hans/.test(n) ? 'zh-CN' : 'zh-TW';
    if (n.startsWith('pt')) return 'pt-BR';
    const hit = LANGS.find(l => l.code === n.slice(0, 2));
    if (hit) return hit.code;
  }
  return 'zh-TW';
}

async function load(code) {
  if (!dicts[code]) {
    try { dicts[code] = (await import(`./lang/${code}.js`)).default; } catch (e) { console.warn('lang', code, e); dicts[code] = {}; }
  }
  if (code !== 'en' && !dicts.en) { try { dicts.en = (await import('./lang/en.js')).default; } catch { dicts.en = {}; } }
}

function apply() {
  document.documentElement.lang = cur;
  document.documentElement.dir = cur === 'ar' ? 'rtl' : 'ltr';
}

export function t(key, vars) {
  let s = dicts[cur]?.[key] ?? dicts.en?.[key] ?? zhTW[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
  return s;
}
export const getLang = () => cur;
export async function setLang(code) {
  await load(code);
  cur = code;
  try { localStorage.setItem('xkr.lang', code); } catch { }
  apply();
  listeners.forEach(f => f(code));
}
export const onLangChange = fn => (listeners.add(fn), () => listeners.delete(fn));

cur = detect();
await load(cur);
apply();
