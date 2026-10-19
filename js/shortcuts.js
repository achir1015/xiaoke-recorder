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
  recordStart: 'Mod+Shift+R',
  recordPause: 'Mod+Shift+P',
  micToggle: 'Mod+Shift+M',
};

const KEY = 'xkr.shortcuts';
let map = { ...DEFAULT_SHORTCUTS };
try { Object.assign(map, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { }

export const Shortcuts = {
  get map() { return map; },
  set(action, combo) { map[action] = combo; this.save(); },
  reset() { map = { ...DEFAULT_SHORTCUTS }; this.save(); },
  save() { try { localStorage.setItem(KEY, JSON.stringify(map)); } catch { } },
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
