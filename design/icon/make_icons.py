"""Clean design/icon/butter-source.png and export extension/icons/icon-<size>.png.
Removes faint stray pixels, crops and centres the butter, and adds a thin amber edge so the pale top
stays visible on light toolbars. Usage: python3 design/icon/make_icons.py"""
import os
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'extension', 'icons')
EDGE = (201, 138, 18)                       # amber, darker than the butter's side
src = Image.open(os.path.join(HERE, 'butter-source.png')).convert('RGBA')
a = src.getchannel('A').point(lambda v: 0 if v < 40 else v)
src.putalpha(a)
src = src.crop(a.point(lambda v: 255 if v > 0 else 0).getbbox())
# store icon: art in the middle 96 of 128 (Chrome Web Store guidance); toolbar sizes: fill more
FILL = {16: 1.0, 32: 0.94, 48: 0.9, 128: 0.75}
for size, fill in FILL.items():
    k = 8; S = size * k                         # supersample
    w, h = src.size; r = (S * fill - 2 * k) / max(w, h)
    art = src.resize((round(w * r), round(h * r)), Image.LANCZOS)
    canvas = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    canvas.alpha_composite(art, ((S - art.width) // 2, (S - art.height) // 2))
    edge_px = k * max(1, size / 40)              # about 1 output pixel at 16-48 px, 3 px at 128
    al = canvas.getchannel('A').filter(ImageFilter.MaxFilter(int(edge_px * 2) | 1))
    ring = Image.new('RGBA', (S, S), EDGE + (0,)); ring.putalpha(al)
    ring.alpha_composite(canvas)
    ring.resize((size, size), Image.LANCZOS).save(os.path.join(OUT, f'icon-{size}.png'))
    print(f'icon-{size}.png')
