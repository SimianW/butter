#!/usr/bin/env python3
"""Edit the two demo recordings (lab/harness/demo.mjs) into one side-by-side video with captions.
Usage: python3 lab/make-demo.py <zh|en> [demo_dir=dist/demo/<lang>]
Reads <demo_dir>/{stock,butter}.{mp4,json}; writes chatgpt-butter-demo-<lang>.mp4 and a shorter .gif."""
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANG = sys.argv[1] if len(sys.argv) > 1 else 'zh'
DIR = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'dist/demo', LANG)
L = json.load(open(os.path.join(DIR, 'stock.json')))
R = json.load(open(os.path.join(DIR, 'butter.json')))
assert L['answer']['sha'] == R['answer']['sha'], 'the two runs rendered different answers'

TEXT = {
    'zh': {
        'segments': [
            ('同一个问题，同一段回答', '两边播放的是同一段录好的真实 ChatGPT 回答，所以内容和出字速度完全一样。左边不装插件，右边装了 Butter for ChatGPT。'),
            ('回答生成时，接着在输入框里打下一个问题', '最下面一行是键盘实际按下的字（两边完全相同）。左边：字一顿一顿地冒出来，画面时不时整个停住；右边：按下就出现。'),
            ('往上翻看回答，再翻回来', '两边滚轮操作完全相同。左边：画面一顿一顿，停住不动；右边：跟手。'),
            ('回答越长，差距越明显', '继续打字。回答越长，左边的页面要处理的内容越多，卡得越久。'),
            ('回答结束', '两边最终显示的回答逐字相同，插件不改动任何内容。'),
        ],
        'title': 'Butter for ChatGPT 效果演示', 'tagline': '一个让 ChatGPT 长对话保持流畅的 Chrome 扩展',
        'setup': ['场景：一个 9 轮的数学长对话（每轮都有大量公式），再问一个问题，等它回答。',
                  '回答期间像平时一样打字、往上翻看。左右两边的操作完全相同。'],
        'left': '不装插件', 'right': '装了 Butter for ChatGPT', 'clock': '回答开始后 {}', 'count': '页面累计卡住 {:.1f} 秒',
        'frozen': '● 页面卡住', 'keys': '键盘按下：', 'sec': ' 秒', 'end': '这一段回答期间',
        'rows': ['页面累计卡住', '最长一次卡住', '打字：最慢的一个字'],
        'notes': ['回答的内容和出字速度两边一样，区别在于页面能不能及时响应你。',
                  '录制环境：Linux + Chromium，没有独立显卡。普通 Windows / Mac 电脑上两边都会更快，差距类似。'],
        'sub_size': 27,
    },
    'en': {
        'segments': [
            ('Same question, same answer', 'Both sides replay the same recorded ChatGPT answer: same text, same pace. Left: no extension. Right: Butter for ChatGPT.'),
            ('Typing the next question while the answer streams', 'Bottom line: the keys pressed, identical on both sides. Left: letters arrive in bursts. Right: they appear as you type.'),
            ('Scrolling back through the answer, then down again', 'Identical wheel input on both sides. Left: the page stutters and stops. Right: it follows the wheel.'),
            ('The longer the answer, the bigger the gap', 'Typing again. As the answer grows, the left page has more to process and freezes for longer.'),
            ('Answer finished', 'Both sides end with exactly the same answer; the extension changes no content.'),
        ],
        'title': 'Butter for ChatGPT demo', 'tagline': 'A Chrome extension that keeps long ChatGPT conversations smooth',
        'setup': ['Setup: a 9-turn math conversation (every answer is full of formulas), then one more question.',
                  'While the answer streams, we type and scroll as usual. Both sides get exactly the same input.'],
        'left': 'No extension', 'right': 'With Butter for ChatGPT', 'clock': 'Answer time {}', 'count': 'Page frozen in total: {:.1f} s',
        'frozen': '● Page frozen', 'keys': 'Keys pressed: ', 'sec': ' s', 'end': 'During this answer',
        'rows': ['Page frozen in total', 'Longest single freeze', 'Slowest keystroke to appear'],
        'notes': ['The answer and its pace are the same on both sides. The difference is whether the page keeps up with you.',
                  'Recorded on Linux + Chromium without a GPU. On a typical Windows or Mac both sides are faster, with a similar gap.'],
        'sub_size': 25,
    },
}[LANG]

W, H = 1920, 1080
PW, PH = 900, 805            # each pane: the 1020x912 recording scaled down
LX, RX, PY = 40, 980, 170
FREEZE_MS = 300              # long frames at least this long get the red "frozen" badge
end_t = min(L['endS'], R['endS']) - 0.5

# (answer time from, to, show keyboard line). Answer time 0 = Enter pressed.
TIMING = [(-2.5, 9, False), (12, 26, True), (36, 50, False), (76, 89, True), (end_t - 9, end_t, False)]
SEGMENTS = [(a, b, cap, sub, keys) for (a, b, keys), (cap, sub) in zip(TIMING, TEXT['segments'])]
TITLE_S, END_S = 5.0, 9.0


def ass_time(s):
    s = max(0, s)
    return f'{int(s // 3600)}:{int(s % 3600 // 60):02d}:{s % 60:05.2f}'


def esc(text):
    return text.replace('{', '(').replace('}', ')')


def char_latencies(run):
    """Seconds from each key press to the character being on screen."""
    intents = [t for t, what in run['intents'] if what == 'key']
    shown = {}
    for t, n in run['chars']:
        for k in range(1, n + 1):
            shown.setdefault(k, t)
    return [shown[k] - intents[k - 1] for k in range(1, len(intents) + 1) if k in shown]


def blocked_until(run, t):
    return sum(min(block, max(0, (t - start) * 1000 - (dur - block))) for start, dur, block in run['loaf'] if start >= 0 and start < t) / 1000


events = []
def ev(start, end, style, text, layer=0):
    events.append(f'Dialogue: {layer},{ass_time(start)},{ass_time(end)},{style},,0,0,0,,{text}')


# Title card.
ev(0, TITLE_S, 'Big', '{\\pos(960,400)}' + TEXT['title'])
ev(0, TITLE_S, 'Sub', '{\\pos(960,490)}' + TEXT['tagline'])
ev(0.6, TITLE_S, 'Note', '{\\pos(960,600)}' + TEXT['setup'][0])
ev(0.6, TITLE_S, 'Note', '{\\pos(960,650)}' + TEXT['setup'][1])

keys_typed = []   # (answer time, text so far) from the script both runs followed
for step in L['script']:
    if 'type' in step:
        base = ''.join(s['type'] for s in L['script'] if 'type' in s and s['at'] < step['at'])
        for i in range(len(step['type'])):
            keys_typed.append((step['at'] + i * 0.2, base + step['type'][:i + 1]))

trims, t_final = [], TITLE_S
for a, b, cap, sub, show_keys in SEGMENTS:
    dur = b - a
    f0 = t_final
    to_final = lambda t: f0 + (t - a)
    ev(f0, f0 + dur, 'Cap', f'{{\\pos(60,48)}}{esc(cap)}')
    ev(f0, f0 + dur, 'CapSub', f'{{\\pos(60,98)}}{esc(sub)}')
    ev(f0, f0 + dur, 'PaneL', f'{{\\pos({LX + PW // 2},146)}}' + TEXT['left'])
    ev(f0, f0 + dur, 'PaneR', f'{{\\pos({RX + PW // 2},146)}}' + TEXT['right'])
    # Elapsed time and the cumulative frozen time, refreshed 10 times a second.
    steps = int(dur * 10)
    for i in range(steps):
        t = a + i / 10
        s0, s1 = to_final(t), to_final(t + 0.1)
        if t >= 0:
            ev(s0, s1, 'Clock', f'{{\\pos(1860,48)}}' + TEXT['clock'].format(f'{int(t // 60)}:{int(t % 60):02d}'))
        ev(s0, s1, 'Count', f'{{\\pos({LX + PW // 2},1006)}}' + TEXT['count'].format(blocked_until(L, t)))
        ev(s0, s1, 'CountR', f'{{\\pos({RX + PW // 2},1006)}}' + TEXT['count'].format(blocked_until(R, t)))
    # Red badge while a pane is frozen.
    for run, x in ((L, LX), (R, RX)):
        for start, d, _ in run['loaf']:
            if d < FREEZE_MS or start + d / 1000 < a or start > b:
                continue
            s0, s1 = to_final(max(a, start)), to_final(min(b, start + d / 1000))
            ev(s0, s1, 'Frozen', f'{{\\pos({x + 16},{PY + 14})}}' + TEXT['frozen'], layer=2)
    if show_keys:
        for i, (t, text) in enumerate(keys_typed):
            nxt = keys_typed[i + 1][0] if i + 1 < len(keys_typed) else b + 1
            if nxt < a or t > b:
                continue
            ev(to_final(max(a, t)), to_final(min(b, nxt)), 'Keys', f'{{\\pos(960,1052)}}' + TEXT['keys'] + esc(text[-44:]))
    trims.append((a, b, f0))
    t_final += dur

# End card with this recording's numbers.
lat_l, lat_r = char_latencies(L), char_latencies(R)
e0 = t_final
rows = [
    (TEXT['rows'][0], f"{L['blockedS']:.1f}" + TEXT['sec'], f"{R['blockedS']:.1f}" + TEXT['sec']),
    (TEXT['rows'][1], f"{L['longestFreezeMs'] / 1000:.1f}" + TEXT['sec'], f"{R['longestFreezeMs'] / 1000:.1f}" + TEXT['sec']),
    (TEXT['rows'][2], f'{max(lat_l):.1f}' + TEXT['sec'] if lat_l else '—', f'{max(lat_r):.1f}' + TEXT['sec'] if lat_r else '—'),
]
ev(e0, e0 + END_S, 'Big', '{\\pos(960,170)}' + TEXT['end'])
ev(e0, e0 + END_S, 'Head', '{\\pos(1010,290)}' + TEXT['left'])
ev(e0, e0 + END_S, 'HeadR', '{\\pos(1400,290)}' + TEXT['right'])
for i, (name, l, r) in enumerate(rows):
    y = 380 + i * 90
    ev(e0, e0 + END_S, 'RowName', f'{{\\pos(760,{y})}}{name}')
    ev(e0, e0 + END_S, 'RowL', f'{{\\pos(1010,{y})}}{l}')
    ev(e0, e0 + END_S, 'RowR', f'{{\\pos(1400,{y})}}{r}')
ev(e0 + 0.5, e0 + END_S, 'Note', '{\\pos(960,720)}' + TEXT['notes'][0])
ev(e0 + 0.5, e0 + END_S, 'Note', '{\\pos(960,770)}' + TEXT['notes'][1])
ev(e0 + 0.5, e0 + END_S, 'Url', '{\\pos(960,880)}github.com/SimianW/butter')
total = e0 + END_S

FONT = 'Noto Sans CJK SC'
def style(name, size, color, bold=0, align=5):
    return f'Style: {name},{FONT},{size},{color},&H000000FF,&H00000000,&H64000000,{bold},0,0,0,100,100,0,0,1,0,0,{align},0,0,0,1'

ass = '\n'.join([
    '[Script Info]', 'ScriptType: v4.00+', f'PlayResX: {W}', f'PlayResY: {H}', 'WrapStyle: 2', '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    style('Big', 64, '&H00FFFFFF', 1), style('Sub', 36, '&H00D8D8D8'), style('Note', 30, '&H00B0B0B0'),
    style('Url', 34, '&H00F5A05A', 1),
    style('Cap', 40, '&H00FFFFFF', 1, 4), style('CapSub', TEXT['sub_size'], '&H00C8C8C8', 0, 4), style('Clock', 30, '&H00C8C8C8', 0, 6),
    style('PaneL', 32, '&H00B4B4B4', 1), style('PaneR', 32, '&H00F5A05A', 1),
    style('Count', 30, '&H006E6EF0', 1), style('CountR', 30, '&H006ED26E', 1),
    style('Keys', 28, '&H00E0E0E0'),
    'Style: Frozen,' + FONT + ',30,&H00FFFFFF,&H000000FF,&H002828D0,&H002828D0,1,0,0,0,100,100,0,0,3,8,0,7,0,0,0,1',
    style('Head', 32, '&H00B4B4B4', 1), style('HeadR', 32, '&H00F5A05A', 1),
    style('RowName', 34, '&H00D8D8D8', 0, 6), style('RowL', 44, '&H006E6EF0', 1), style('RowR', 44, '&H006ED26E', 1),
    '', '[Events]', 'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    *events, ''])
ass_path = os.path.join(DIR, 'demo.ass')
open(ass_path, 'w').write(ass)

# Video: title card, the side-by-side segments, end card, then captions on top.
BG = '0x17181b'
parts, chains = [], []
chains.append(f'color=c={BG}:s={W}x{H}:r=30:d={TITLE_S}[c0]')
parts.append('[c0]')
for i, (a, b, _) in enumerate(trims):
    la, ra = a + L['enterVideoS'], a + R['enterVideoS']
    d = b - a
    chains.append(f'[0:v]trim=start={la:.3f}:duration={d:.3f},setpts=PTS-STARTPTS,scale={PW}:{PH},fps=30[l{i}]')
    chains.append(f'[1:v]trim=start={ra:.3f}:duration={d:.3f},setpts=PTS-STARTPTS,scale={PW}:{PH},fps=30[r{i}]')
    chains.append(f'color=c={BG}:s={W}x{H}:r=30:d={d:.3f}[bg{i}]')
    chains.append(f'[bg{i}][l{i}]overlay={LX}:{PY}:shortest=1[m{i}]')
    chains.append(f'[m{i}][r{i}]overlay={RX}:{PY}:shortest=1,'
                  f'drawbox=x={LX - 2}:y={PY - 2}:w={PW + 4}:h={PH + 4}:color=0x505050:t=2,'
                  f'drawbox=x={RX - 2}:y={PY - 2}:w={PW + 4}:h={PH + 4}:color=0x5aa0f5:t=2[s{i}]')
    parts.append(f'[s{i}]')
chains.append(f'color=c={BG}:s={W}x{H}:r=30:d={END_S}[c1]')
parts.append('[c1]')
chains.append(f"{''.join(parts)}concat=n={len(parts)}:v=1:a=0,format=yuv420p,subtitles='{ass_path}'[out]")
mp4 = os.path.join(DIR, f'chatgpt-butter-demo-{LANG}.mp4')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', os.path.join(DIR, 'stock.mp4'), '-i', os.path.join(DIR, 'butter.mp4'),
                '-filter_complex', ';'.join(chains), '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22',
                '-movflags', '+faststart', '-r', '30', mp4], check=True)

# GIF for the README: the typing and scrolling segments, smaller and at 15 fps.
g0 = TITLE_S + (SEGMENTS[0][1] - SEGMENTS[0][0])
g1 = g0 + (SEGMENTS[1][1] - SEGMENTS[1][0]) + (SEGMENTS[2][1] - SEGMENTS[2][0])
gif = os.path.join(DIR, f'chatgpt-butter-demo-{LANG}.gif')
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-ss', f'{g0}', '-to', f'{g1}', '-i', mp4,
                '-filter_complex', 'fps=12,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle',
                gif], check=True)
print(json.dumps({'mp4': mp4, 'gif': gif, 'seconds': round(total, 1),
                  'stock': {'blockedS': L['blockedS'], 'longestFreezeMs': L['longestFreezeMs'], 'slowestCharS': round(max(lat_l), 2) if lat_l else None},
                  'butter': {'blockedS': R['blockedS'], 'longestFreezeMs': R['longestFreezeMs'], 'slowestCharS': round(max(lat_r), 2) if lat_r else None}}, indent=1))
