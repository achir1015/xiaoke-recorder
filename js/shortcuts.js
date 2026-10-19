// 可自訂的鍵盤快速鍵（存在這台裝置的瀏覽器裡）
import { isApple } from './util.js';

export const DEFAULT_SHORTCUTS = {
  playPause: 'Space',
  addZoom: 'Z',
  addTrim: 'T',
  addSpeed: 'S',
  addText: 'A',
  addArrow: 'R',
  addBlur: 'B',
  deleteSel: 'Delete',
  undo: 'Mod+Z',
  redo: 'Mod+Shift+Z',
  save: 'Mod+S',
  exportVideo: 'Mod+E',
  frameBack: 'ArrowLeft',
  frameFwd: 'ArrowRight',
  secBack: 'Shift+ArrowLeft',
  secFwd: 'Shift+ArrowRight',
  goStart: 'Home',
  goEnd: 'End',
  timelineIn: '=',
  timelineOut: '-',
  // 錄影用：桌面版是「全域熱鍵」，在其他程式裡也能用（主視窗縮小時照樣有效）
  recordStart: 'Mod+Alt+R',
  recordPause: 'Mod+Alt+P',
  recordStop: 'Mod+Alt+S',
  micToggle: 'Mod+Alt+M',
};
export const RECORD_ACTIONS = ['recordStart', 'recordPause', 'recordStop', 'micToggle'];

const KEY = 'xkr.shortcuts';
let map = { ...DEFAULT_SHORTCUTS };
const listeners = new Set();
try { Object.assign(map, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { }

export const Shortcuts = {
  get map() { return map; },
  set(action, combo) { map[action] = combo; this.save(); },
  reset() { map = { ...DEFAULT_SHORTCUTS }; this.save(); },
  save() { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { } listeners.forEach(f => f(map)); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  label(combo) {
    if (!combo) return '—';
    const mac = isApple();
    return combo.split('+').map(k => ({ Mod: mac ? '⌘' : 'Ctrl', Shift: mac ? '⇧' : 'Shift', Alt: mac ? '⌥' : 'Alt', Space: '␣', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓', Delete: 'Del' }[k] || k)).join(mac ? '' : '+');
  },
  // 鍵盤事件 → "Mod+Shift+Z" 這樣的字串
  fromEvent(e) {
    const parts = [];
    if (e.ctrlKey || e.metaKey) parts.push('Mod');
    if (e.shiftKey) parts.push('Shift');
    if (e.altKey) parts.push('Alt');
    let k = e.key;
    // 字母、數字用實體按鍵（Mac 按 Option 時 e.key 會變成特殊符號）
    if (/^Key[A-Z]$/.test(e.code)) k = e.code.slice(3);
    else if (/^Digit\d$/.test(e.code)) k = e.code.slice(5);
    if (k === ' ') k = 'Space';
    else if (k === 'Backspace') k = 'Delete';
    else if (k.length === 1) k = k.toUpperCase();
    if (['Control', 'Meta', 'Shift', 'Alt'].includes(k)) return null;
    if (k === '+') k = '=';
    parts.push(k);
    return parts.join('+');
  },
  match(e) {
    const c = this.fromEvent(e);
    if (!c) return null;
    return Object.keys(map).find(a => map[a] === c) || null;
  },
};
