// 自動字幕：把麥克風（或影片原音）轉成 16kHz 單聲道交給 Whisper，產生有時間碼的字幕
import { uid } from './util.js';

export const CAPTION_MODELS = [
  { id: 'onnx-community/whisper-tiny', size: '≈ 40 MB', key: 'modelFast' },
  { id: 'onnx-community/whisper-base', size: '≈ 80 MB', key: 'modelBalanced' },
  { id: 'onnx-community/whisper-small', size: '≈ 250 MB', key: 'modelAccurate' },
];
export const CAPTION_LANGS = ['auto', 'zh', 'en', 'ja', 'ko', 'es', 'fr', 'it', 'pt', 'ru', 'tr', 'vi', 'ar'];

async function to16kMono(buf) {
  const len = Math.ceil(buf.duration * 16000);
  const off = new OfflineAudioContext(1, len, 16000);
  const src = off.createBufferSource();
  src.buffer = buf; src.connect(off.destination); src.start();
  const r = await off.startRendering();
  return r.getChannelData(0);
}

let worker = null;
export async function transcribe(buffer, { model, language }, onStatus) {
  const audio = await to16kMono(buffer);
  worker ||= new Worker(new URL('./captions-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      if (data.type === 'download') onStatus?.({ phase: 'download', pct: data.pct, file: data.file });
      else if (data.type === 'status') onStatus?.({ phase: data.status });
      else if (data.type === 'error') reject(new Error(data.message));
      else if (data.type === 'done') {
        const caps = [];
        for (const c of data.chunks) {
          const [s, e] = c.timestamp || [];
          const text = (c.text || '').trim();
          if (!text || s == null) continue;
          caps.push({ id: uid(), start: s, end: e ?? s + Math.max(1.5, text.length * 0.18), text });
        }
        resolve(splitLong(caps));
      }
    };
    worker.onerror = e => reject(new Error(e.message || 'worker'));
    worker.postMessage({ audio, model, language }, [audio.buffer]);
  });
}

// 太長的字幕拆成兩行內
function splitLong(caps, max = 32) {
  const out = [];
  for (const c of caps) {
    const chars = [...c.text];
    if (chars.length <= max) { out.push(c); continue; }
    const parts = Math.ceil(chars.length / max), d = (c.end - c.start) / parts;
    for (let i = 0; i < parts; i++) out.push({ id: uid(), start: c.start + d * i, end: c.start + d * (i + 1), text: chars.slice(i * max, (i + 1) * max).join('') });
  }
  return out;
}

export function toSRT(caps) {
  const f = s => { const ms = Math.round(s * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  return caps.map((c, i) => `${i + 1}\n${f(c.start)} --> ${f(c.end)}\n${c.text}\n`).join('\n');
}

export function fromSRT(text) {
  const t = s => { const m = s.trim().match(/(\d+):(\d+):(\d+)[,.](\d+)/); return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4] / 1000 : 0; };
  return text.replace(/\r/g, '').split(/\n\n+/).map(b => {
    const lines = b.trim().split('\n');
    const i = lines.findIndex(l => l.includes('-->'));
    if (i < 0) return null;
    const [a, z] = lines[i].split('-->');
    return { id: uid(), start: t(a), end: t(z), text: lines.slice(i + 1).join('\n') };
  }).filter(Boolean);
}
