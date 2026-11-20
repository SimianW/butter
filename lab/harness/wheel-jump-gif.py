"""Makes a masked GIF of one wheel-jump-live.mjs recording (RECORD=1), and storyboards to watch.

python3 lab/harness/wheel-jump-gif.py <recording.mp4> <out.gif> [caption]

The recording keeps rail-demo.mjs's crop (x 580, y 88, 1020 by 912: the chat column and the rail).
The repo is public, so the chat's own text never shows: the chat column (x 0-960) is pixelated in
20 px blocks and the composer (y 820-912) is black. Left sharp: the harness's yellow scrollTop readout
(the inside of its yellow box, x 26-534, y 66-106, drawn by the harness, not ChatGPT or Butter), the rail and the scrollbar strip
(x 960-1020), so the thumb's jump back to the top stays plain. Plays at most 10 s, 800 px wide, under
3 MB. Storyboards and the media json go beside <out.gif> (-contact-NN.png, -media.json); watch every
frame before keeping the GIF, then delete the storyboards.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageSequence

src, out = Path(sys.argv[1]), Path(sys.argv[2])
caption = sys.argv[3] if len(sys.argv) > 3 else ''
info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                                           'format=duration:stream=width,height', '-of', 'json', str(src)]))
assert info['streams'][0]['width'] == 1020 and info['streams'][0]['height'] == 912
duration = float(info['format']['duration'])
speed = max(1, duration / 9.8)
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
BLOCK, CHAT_W, COMPOSER_Y = 20, 960, 820  # both multiples of BLOCK: no sharp edge rows
assert CHAT_W % BLOCK == 0 and COMPOSER_Y % BLOCK == 0
# x, y, w, h: inside the readout's yellow fill in every frame (measured: x 26-534, y 66-105), so its
# edge never lets chat text through, whatever the readout's width.
READOUT = (26, 66, 508, 40)
text = caption.replace(':', r'\:').replace("'", '').replace(',', '')
for fps, colors in [(12, 128), (10, 96), (8, 64)]:
    graph = (
        f'[0:v]split=3[base][px][ro];'
        f'[px]crop={CHAT_W}:{COMPOSER_Y}:0:0,scale={CHAT_W // BLOCK}:{COMPOSER_Y // BLOCK}:flags=area,'
        f'scale={CHAT_W}:{COMPOSER_Y}:flags=neighbor[pix];'
        f'[ro]crop={READOUT[2]}:{READOUT[3]}:{READOUT[0]}:{READOUT[1]}[read];'
        f'[base][pix]overlay=0:0[m1];[m1][read]overlay={READOUT[0]}:{READOUT[1]},'
        f'drawbox=x=0:y={COMPOSER_Y}:w=1020:h={912 - COMPOSER_Y}:color=black:t=fill,'
        f'drawtext=fontfile={font}:text=Chat text pixelated and composer hidden for privacy. Yellow box = scrollTop drawn by the harness:x=24:y=840:fontsize=18:fontcolor=white'
        + (f',drawtext=fontfile={font}:text={text}:x=24:y=872:fontsize=18:fontcolor=white' if text else '') +
        f',setpts=(PTS-STARTPTS)/{speed:.9f},fps={fps},scale=800:-1,setsar=1,split[a][b];'
        f'[a]palettegen=max_colors={colors}:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a[gif]'
    )
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(src), '-filter_complex', graph,
                    '-map', '[gif]', '-loop', '0', str(out)], check=True)
    im = Image.open(out)
    total = sum(f.info.get('duration', 0) for f in ImageSequence.Iterator(im))
    if out.stat().st_size < 3_000_000 and total <= 10000:
        break
else:
    raise RuntimeError('GIF limits could not be met')
assert im.size[0] == 800
frames, elapsed = [], 0
for frame in ImageSequence.Iterator(Image.open(out)):
    frames.append((elapsed, frame.convert('RGB').copy()))
    elapsed += frame.info.get('duration', 0)
boards = []
for part in range(math.ceil(len(frames) / 16)):
    sheet = Image.new('RGB', (1600, 1520), 'white')
    draw = ImageDraw.Draw(sheet)
    for k, (stamp, frame) in enumerate(frames[part * 16:(part + 1) * 16]):
        thumb = frame.copy()
        thumb.thumbnail((400, 358))
        x, y = (k % 4) * 400, (k // 4) * 380
        draw.text((x + 4, y + 2), f'Frame {part * 16 + k}, {stamp / 1000:.2f}s', fill='black')
        sheet.paste(thumb, (x, y + 20))
    board = out.with_name(f'{out.stem}-contact-{part + 1:02}.png')
    sheet.save(board)
    boards.append(str(board))
meta = {
    'source': src.name, 'crop': {'x': 580, 'y': 88, 'width': 1020, 'height': 912},
    'pixelated': {'x': 0, 'y': 0, 'width': CHAT_W, 'height': COMPOSER_Y, 'block': BLOCK},
    'sharp': {'readout': dict(zip(['x', 'y', 'width', 'height'], READOUT)), 'strip': {'x': CHAT_W, 'width': 1020 - CHAT_W}},
    'composerMask': {'y': COMPOSER_Y, 'height': 912 - COMPOSER_Y},
    'width': im.size[0], 'height': im.size[1], 'bytes': out.stat().st_size, 'durationMs': elapsed,
    'frames': len(frames), 'speed': speed, 'sourceDurationSeconds': duration, 'fps': fps,
}
out.with_name(f'{out.stem}-media.json').write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps({**meta, 'storyboards': boards}, indent=2))
