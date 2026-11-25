"""Makes a masked GIF of two recorded rail jumps, and storyboards to watch before keeping it.

python3 lab/harness/rail-jump-gif.py <run.json> <out.gif> [fixture:tick ...]

<run.json> is a rail-jump-live.mjs result recorded with RECORD=1 RECORD_ALL=1; the witnesses are
its jumps from the top to those ticks (default math9:1 math12:5, the bug GIFs' two jumps). The GIF
keeps the recording's crop (x 580, y 88, 1020 by 912: the chat column and the rail), masks the lower
212 px (the composer), and plays at most 10 s, 800 px wide, under 3 MB. Storyboards and the media
json go beside <out.gif> with -contact-NN.png and -media.json suffixes; watch every frame before
keeping the GIF, then delete the storyboards.
"""
import json
import math
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageSequence

run_file, out = Path(sys.argv[1]), Path(sys.argv[2])
picks = [(a, int(b)) for a, b in (x.split(':') for x in (sys.argv[3:] or ['math9:1', 'math12:5']))]
run = json.loads(run_file.read_text())
witnesses = [
    next(j for j in run['jumps'] if j['case'] == case and j['from'] in ('top', 'top-unpinned') and j['to'] == to)
    for case, to in picks
]
assert all(j.get('recording') for j in witnesses), 'record with RECORD=1 RECORD_ALL=1'
files = [j['recording'] for j in witnesses]
durations = []
for file in files:
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries',
                                               'format=duration:stream=width,height', '-of', 'json', file]))
    assert info['streams'][0]['width'] == 1020 and info['streams'][0]['height'] == 912
    durations.append(float(info['format']['duration']))
speed = max(1, sum(durations) / 9.4)
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
for fps, colors in [(12, 128), (10, 96), (8, 64)]:
    filters = [
        f'[{i}:v]drawbox=x=0:y=700:w=1020:h=212:color=black:t=fill,'
        f'drawtext=fontfile={font}:text=Composer hidden for privacy:x=24:y=790:fontsize=20:fontcolor=white,'
        f'setpts=(PTS-STARTPTS)/{speed:.9f},fps={fps},scale=800:-1,setsar=1[v{i}]'
        for i in range(len(files))
    ]
    filters.append(''.join(f'[v{i}]' for i in range(len(files))) +
                   f'concat=n={len(files)}:v=1:a=0,split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];'
                   '[b][p]paletteuse=dither=sierra2_4a[gif]')
    inputs = [x for f in files for x in ('-i', f)]
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', *inputs, '-filter_complex',
                    ';'.join(filters), '-map', '[gif]', '-loop', '0', str(out)], check=True)
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
    'sourceRun': run_file.stem,
    'build': run.get('build'),
    'witnesses': [{'fixture': j['case'], 'from': j['from'], 'to': j['to'], 'class': j['class']} for j in witnesses],
    'crop': {'x': 580, 'y': 88, 'width': 1020, 'height': 912},
    'mask': {'y': 700, 'height': 212},
    'width': im.size[0], 'height': im.size[1], 'bytes': out.stat().st_size, 'durationMs': elapsed,
    'frames': len(frames), 'speed': speed, 'sourceDurationsSeconds': durations, 'fps': fps,
}
out.with_name(f'{out.stem}-media.json').write_text(json.dumps(meta, indent=2) + '\n')
print(json.dumps({**meta, 'storyboards': boards}, indent=2))
