# -*- coding: utf-8 -*-
"""產生小柯機器人螢幕錄製工具的所有圖示：網址列小圖示、主畫面捷徑、Windows .ico、Mac/Linux 用 PNG。
造型：小柯機器人的頭就是一台螢幕（天線、耳朵、笑臉），下面有螢幕腳架，右上角紅色錄影燈。
執行：python tools/make_icons.py（需要 Pillow）
"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
S = 1024           # 設計尺寸
SS = 4             # 超取樣倍數，縮小後邊緣平滑


def grad(size, top, bottom):
    g = Image.new("RGB", (1, 256))
    for y in range(256):
        t = y / 255
        g.putpixel((0, y), tuple(round(a + (b - a) * t) for a, b in zip(top, bottom)))
    return g.resize((size, size))


def draw_robot(d, k, cx=512, cy=470, scale=1.0, rec=True):
    """在畫布上畫小柯螢幕。k=超取樣倍數，scale 讓 maskable 版縮小留安全邊。"""
    def P(*v):
        return [round((cx + (x - 512) * scale) * k) if i % 2 == 0 else round((cy + (x - 470) * scale) * k) for i, x in enumerate(v)]
    R = lambda r: round(r * scale * k)
    white = (255, 255, 255)
    # 天線
    d.rounded_rectangle(P(498, 130, 526, 230), radius=R(10), fill=white)
    d.ellipse(P(462, 70, 562, 170), fill=(255, 213, 10))
    # 耳朵
    d.rounded_rectangle(P(96, 360, 186, 600), radius=R(36), fill=white)
    d.rounded_rectangle(P(838, 360, 928, 600), radius=R(36), fill=white)
    # 腳架
    d.polygon(P(452, 760, 572, 760, 600, 870, 424, 870), fill=white)
    d.rounded_rectangle(P(330, 852, 694, 900), radius=R(24), fill=white)
    # 螢幕外框（頭）
    d.rounded_rectangle(P(160, 220, 864, 770), radius=R(110), fill=white)
    # 螢幕
    d.rounded_rectangle(P(222, 282, 802, 708), radius=R(64), fill=(16, 24, 40))
    # 眼睛
    cyan = (34, 211, 238)
    d.ellipse(P(332, 400, 448, 516), fill=cyan)
    d.ellipse(P(576, 400, 692, 516), fill=cyan)
    # 笑臉
    d.arc(P(392, 470, 632, 616), start=25, end=155, fill=cyan, width=R(26))
    # 錄影燈
    if rec:
        d.ellipse(P(690, 196, 846, 352), fill=white)
        d.ellipse(P(714, 220, 822, 328), fill=(255, 59, 48))


def make(size_px, maskable=False, rounded=True, bg=True):
    k = SS
    img = Image.new("RGBA", (S * k, S * k), (0, 0, 0, 0))
    if bg:
        g = grad(S * k, (255, 106, 92), (124, 77, 255)).convert("RGBA")
        mask = Image.new("L", (S * k, S * k), 0)
        md = ImageDraw.Draw(mask)
        if maskable or not rounded:
            md.rectangle([0, 0, S * k, S * k], fill=255)
        else:
            md.rounded_rectangle([40 * k, 40 * k, (S - 40) * k, (S - 40) * k], radius=230 * k, fill=255)
        img.paste(g, (0, 0), mask)
    d = ImageDraw.Draw(img)
    draw_robot(d, k, scale=0.78 if maskable else 1.0, cy=490 if maskable else 470)
    return img.resize((size_px, size_px), Image.LANCZOS)


def main():
    (ROOT / "icons").mkdir(exist_ok=True)
    make(512).save(ROOT / "icons" / "icon-512.png")
    make(192).save(ROOT / "icons" / "icon-192.png")
    make(512, maskable=True).save(ROOT / "icons" / "icon-maskable-512.png")
    make(1024).save(ROOT / "icons" / "icon-1024.png")
    # iOS 主畫面圖示：不透明、方形（系統自己加圓角）
    make(180, rounded=False).convert("RGB").save(ROOT / "apple-touch-icon.png")
    make(32).save(ROOT / "favicon-32.png")
    make(16).save(ROOT / "favicon-16.png")
    # Windows 圖示（多尺寸）
    big = make(256)
    big.save(ROOT / "desktop" / "app.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
    print("icons ok")


if __name__ == "__main__":
    main()
