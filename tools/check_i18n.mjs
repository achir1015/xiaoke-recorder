// 檢查每個語言檔是否涵蓋程式用到的所有字串
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readdirSync(path.join(root, 'js')).filter(f => f.endsWith('.js')).map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n');
const used = new Set([...src.matchAll(/\bt\('([a-zA-Z0-9_]+)'/g)].map(m => m[1]).filter(k => !k.endsWith('_')));
const zh = (await import(pathToFileURL(path.join(root, 'js/lang/zh-TW.js')).href)).default;
const dyn = Object.keys(zh).filter(k => /^(tab|row|sc|ease|cur|click|shape|ann|anim|font|lang|q|f\d|model)_?/.test(k));
for (const k of dyn) used.add(k);
let bad = 0;
for (const f of fs.readdirSync(path.join(root, 'js/lang'))) {
  const d = (await import(pathToFileURL(path.join(root, 'js/lang', f)).href)).default;
  const miss = [...used].filter(k => !(k in d));
  const extra = Object.keys(d).filter(k => !(k in zh));
  console.log(f.padEnd(10), Object.keys(d).length, miss.length ? 'MISSING: ' + miss.join(' ') : 'ok', extra.length ? ' EXTRA: ' + extra.join(' ') : '');
  if (miss.length) bad++;
}
process.exit(bad ? 1 : 0);
