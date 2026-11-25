"""before.gif for #171 stage 1c: one recorded rail jump, labelled with where the chat is.

python3 -I before-gif.py <run.json> <out.gif> <fixture:from:to> <offset_s>

Same crop and composer mask as lab/harness/rail-jump-gif.py (x 580, y 88, 1020 by 912; lower 212 px
masked), played at real speed and cut to 9.5 s. The masked band carries a readout of the chat's
scrollTop from the run's own per-frame samples (`changes`), placed on the video's clock by
<offset_s> (video time = probe time + offset; found from when ChatGPT's end-of-chat footer shows).
Writes storyboards (-contact-NN.png) beside <out.gif>: watch every frame, then delete them.
"""
import json, math, subprocess, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageSequence

run_file, out, pick, offset = Path(sys.argv[1]), Path(sys.argv[2]), sys.argv[3], float(sys.argv[4])
case, frm, to = pick.split(':')
run = json.loads(run_file.read_text())
j = next(j for j in run['jumps'] if j['case'] == case and j['from'] == frm and j['to'] == int(to))
src, clip = j['recording'], 9.5
click = next(e['t'] for e in j['events'] if e['type'] == 'rail-jump') / 1000 + offset

def where(y):
    if y < 1000: return f'question {to} (the jump target)'
    if y > j['changes'][0]['y'] - 1500: return "the chat's end"
    return 'moving'

points = sorted([(0.0, j['changes'][0]['y']), (click, j['changes'][0]['y'])] + [(c['t'] / 1000 + offset, c['y']) for c in j['changes']])
segs = []
for k, (t, y) in enumerate(points):
    end = points[k + 1][0] if k + 1 < len(points) else clip
    label = where(y)
    if segs and segs[-1][2] == label and (segs[-1][0] >= click) == (t >= click): segs[-1][1] = end; continue
    segs.append([t, end, label, y])
font = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
bold = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
draw = [f'drawbox=x=0:y=700:w=1020:h=212:color=black:t=fill',
        f"drawtext=fontfile={font}:text='Rail click on question {to}, chat at its end and pinned':x=24:y=716:fontsize=24:fontcolor=white",
        f"drawtext=fontfile={font}:text='Composer hidden for privacy':x=24:y=872:fontsize=18:fontcolor=gray"]
for a, b, label, y in segs:
    since = max(0.0, a - click)
    txt = f'Chat at {label}' if label != 'moving' else 'Chat scrolling'
    txt += f'  ({since:.1f} s after the click)' if a >= click else '  (before the click)'
    color = 'yellow' if "end" in label and a > click else 'white'
    txt = txt.replace("'", "’").replace(':', '\\:')
    draw.append(f"drawtext=fontfile={bold}:text='{txt}':x=24:y=770:fontsize=28:fontcolor={color}:enable='between(t,{a:.3f},{b:.3f})'")
for fps, colors in [(12, 128), (10, 96), (8, 64)]:
    vf = ','.join(draw) + f',trim=0:{clip},setpts=PTS-STARTPTS,fps={fps},scale=800:-1,setsar=1,split[a][b];[a]palettegen=max_colors={colors}:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-filter_complex', vf, '-loop', '0', str(out)], check=True)
    im = Image.open(out)
    total = sum(f.info.get('duration', 0) for f in ImageSequence.Iterator(im))
    if out.stat().st_size < 3_000_000 and total <= 10000: break
else:
    raise RuntimeError('GIF limits could not be met')
frames, elapsed = [], 0
for frame in ImageSequence.Iterator(Image.open(out)):
    frames.append((elapsed, frame.convert('RGB').copy())); elapsed += frame.info.get('duration', 0)
boards = []
for part in range(math.ceil(len(frames) / 16)):
    sheet = Image.new('RGB', (1600, 1520), 'white'); d = ImageDraw.Draw(sheet)
    for k, (stamp, frame) in enumerate(frames[part * 16:(part + 1) * 16]):
        thumb = frame.copy(); thumb.thumbnail((400, 358)); x, y = (k % 4) * 400, (k // 4) * 380
        d.text((x + 4, y + 2), f'Frame {part * 16 + k}, {stamp / 1000:.2f}s', fill='black'); sheet.paste(thumb, (x, y + 20))
    b = out.with_name(f'{out.stem}-contact-{part + 1:02}.png'); sheet.save(b); boards.append(b.name)
print(json.dumps({'witness': [case, frm, int(to), j['class'], j['failureReason']], 'offset': offset, 'clickVideoS': round(click, 3),
                  'segments': [[round(a, 3), round(b, 3), l, round(y)] for a, b, l, y in segs], 'width': im.size[0], 'height': im.size[1],
                  'bytes': out.stat().st_size, 'durationMs': elapsed, 'frames': len(frames), 'fps': fps, 'storyboards': boards}, indent=1))
