# -*- coding: utf-8 -*-
"""把「小柯影音剪輯助手」的內建素材庫搬到螢幕錄製工具：產生 js/library.js。
素材全部是程式即時繪製／合成（沒有圖片、音樂檔），所以直接擷取原始程式碼，兩邊的素材完全一樣。

用法：python tools/port_library.py [影音剪輯助手的 index.html 路徑]
預設路徑：E:/小柯影音剪輯助手/xiaoke-video/index.html
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1] if len(sys.argv) > 1 else "E:/小柯影音剪輯助手/xiaoke-video/index.html")

# (開始標記, 結束標記)：擷取 [開始, 結束) 之間的程式
RANGES = [
    ("const FF = ", "// ---------- 圖檔（貼圖）"),          # 共用工具、背景、裝飾、文字動畫、片頭片尾範本
    ("const STK = [", "// ---------- 基本素材：背景畫法"),      # 貼圖 30
    ("const lin = cols", "// 產生內建素材並放進 Media"),          # 基本素材（動態背景）30
    ("const scratchCv = {};", "function drawMasked("),          # 蒙版 30
    ("function chromaKey(", "const GSCR = {};"),               # 綠幕素材 20
    ("const D3_ANIMS", "// ---------- 配樂 110 首"),            # 字幕樣式（一般 6＋3D 6）
    ("const midiF", "// AudioBuffer → WAV 檔"),                 # 配樂 110（合成器）
    ("const easeOut = k =>", "const ANIM_IN = {"),             # 緩動函式
]

HEADER = """// 自動產生，請勿手動修改：python tools/port_library.py
// 來源：小柯影音剪輯助手（achir1015/xiaoke-video）的內建素材庫，全部用程式繪製／合成，沒有外部檔案、沒有版權問題。
/* eslint-disable */
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const document = globalThis.document || { createElement: () => new OffscreenCanvas(1, 1) };
"""

FOOTER = """
// ---------- 對外介面 ----------
const GSCR = {};
GS.forEach(([name, dur, fn], i) => { GSCR['gs' + i] = { name, dur, fn }; });
const MUSIC_LIST = [];
MUSIC_CATS.forEach(([k]) => {
  const n = k === 'weather' ? WEATHER.length : k === 'inst' ? INST.length : MUSIC_NAMES[k].length;
  for (let i = 0; i < n; i++) { const P = musicPlan(k, i); MUSIC_LIST.push({ id: 'mu_' + k + i, cat: k, name: P.name, dur: P.D, plan: P }); }
});
// 產生一首配樂（離線合成，回傳 AudioBuffer；第一次約需數秒）
async function renderMusicBuffer(P) {
  const sr = 44100, len = Math.ceil(sr * P.D), ac = new OfflineAudioContext(2, len, sr);
  const S = new Synth(ac, mulberry(P.seed), P.D);
  makeMusic(S, P);
  const WIN = 1.5; S.step(0, WIN + .1);
  for (let s = WIN; s < P.D - .2; s += WIN) { const at = Math.round(s * sr / 128) * 128 / sr; ac.suspend(at).then(() => { S.step(at, at + WIN + .1); ac.resume(); }); }
  const ab = await ac.startRendering();
  let peak = 0; for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { const x = Math.abs(d[i]); if (x > peak) peak = x; } }
  const k = peak > 0 ? Math.min(6, .89 / peak) : 1, fo = Math.round(sr * (P.cat === 'weather' ? 2 : 1.2)), fi = P.cat === 'weather' ? Math.round(sr * 1.5) : 0;
  for (let c = 0; c < 2; c++) { const d = ab.getChannelData(c); for (let i = 0; i < d.length; i++) { let x = d[i] * k; if (i < fi) x *= i / fi; if (i > len - fo) x *= (len - i) / fo; d[i] = x; } }
  return ab;
}
export {
  FF, TPL, drawTemplate, STK, BASIC, MASKS, MASK, GS, GSCR, TEXT_PRESETS, TPRE, D3_ANIMS, anim3D, glyph3D,
  MUSIC_CATS, MUSIC_LIST, renderMusicBuffer, chromaKey, roundRect, starPath, heartPath,
};
"""


def main():
    src = SRC.read_text(encoding="utf-8")
    parts = [HEADER]
    for a, b in RANGES:
        i = src.index(a)
        j = src.index(b, i)
        parts.append(f"\n// ===== 擷取自影音剪輯助手：{a.strip()[:40]} =====\n")
        parts.append(src[i:j].rstrip() + "\n")
    parts.append(FOOTER)
    out = ROOT / "js" / "library.js"
    out.write_text("".join(parts), encoding="utf-8")
    print(f"寫入 {out}（{out.stat().st_size // 1024} KB）")


if __name__ == "__main__":
    main()
