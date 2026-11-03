# 앱 아이콘 원본(1024px) 만들기: 어두운 바탕 + 빨강·파랑 캔들 + 상승 선
from PIL import Image, ImageDraw
import sys

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle([40, 40, S - 40, S - 40], radius=200, fill=(18, 21, 26, 255), outline=(44, 51, 61, 255), width=16)
UP, DOWN = (255, 77, 79, 255), (61, 139, 255, 255)
candles = [(250, 640, 760, 560, 700, DOWN), (420, 470, 690, 520, 640, UP), (590, 360, 560, 400, 520, UP), (760, 220, 470, 260, 420, UP)]
for x, hi, lo, top, bot, col in candles:
    d.line([x, hi, x, lo], fill=col, width=22)
    d.rounded_rectangle([x - 55, top, x + 55, bot], radius=14, fill=col)
d.line([(180, 820), (420, 700), (600, 560), (850, 300)], fill=(255, 176, 32, 255), width=26, joint="curve")
img.save(sys.argv[1])
