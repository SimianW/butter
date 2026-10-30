#!/usr/bin/env python3
"""Turn the harness's raw results (screenshots, traces, per-rep JSON) into the CSV tables under
results/. The raw files stay local: they hold screenshots of the account and chat/project ids.
Usage: python3 lab/summarize.py [raw_dir=lab/harness/results] [out_dir=results]"""
import csv
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'lab/harness/results')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(ROOT, 'results')
HOME = re.compile(r'/home/[^/]+/')
UUID = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|g-p-[0-9a-f]{32}')


def write(name, rows):
    if not rows:
        return
    os.makedirs(OUT, exist_ok=True)
    cols = list(dict.fromkeys(k for r in rows for k in r))
    with open(os.path.join(OUT, name), 'w', newline='') as f:
        w = csv.DictWriter(f, cols)
        w.writeheader()
        w.writerows(rows)
    print(f'{name}: {len(rows)} rows')


def g(d, *keys):
    for k in keys:
        d = d.get(k) if isinstance(d, dict) else None
    return d


def r1(x):
    return None if x is None else round(x, 1)


def bench():
    rows = []
    for f in sorted(glob.glob(f'{RAW}/bench/*/rep-*.json')):
        d = json.load(open(f))
        a = d.get('attr') or {}
        rows.append({
            'variant': d['variant'], 'rep': d['rep'],
            'fps': g(d, 'fps'), 'frame_p50_ms': r1(g(d, 'p50')), 'frame_p95_ms': r1(g(d, 'p95')),
            'frame_max_ms': r1(g(d, 'maxFrame')), 'jank_pct': g(d, 'jankPct'),
            'blocked_s': r1(g(d, 'loafBlockMs') / 1000), 'longest_freeze_ms': g(d, 'loafMaxMs'),
            'key_p50_ms': r1(g(d, 'keyP50')), 'key_p95_ms': r1(g(d, 'keyP95')), 'key_max_ms': r1(g(d, 'keyMax')),
            'wheel_p95_ms': g(d, 'wheelP95'), 'busy_pct': g(d, 'busyPct'), 'style_pct': g(d, 'stylePct'),
            'loaf_render_style_layout_s': a.get('renderSLs'), 'loaf_forced_style_layout_s': a.get('forcedSLs'),
            'loaf_script_s': a.get('scripts'),
            'turns_before': g(d, 'before', 'turns'), 'nodes_before': g(d, 'before', 'nodes'),
            'answer_chars': g(d, 'answer', 'chars'), 'answer_sha': g(d, 'answer', 'sha'),
            'chunks': g(d, 'chunksSent'), 'wall_s': r1(g(d, 'wallMs') / 1000),
        })
    write('bench.csv', rows)


def scenarios():
    rows = []
    for f in sorted(glob.glob(f'{RAW}/scenarios/*/rep-*.json')):
        d = json.load(open(f))
        rl, sc, ty = d['reload'], d['scroll'], d['typing']
        rows.append({
            'variant': d['variant'], 'rep': d['rep'],
            'reload_ready_ms': rl['readyMs'], 'reload_blocked_ms': rl['blockedMs'], 'reload_longest_frame_ms': rl['maxFrame'],
            'reload_nodes': rl['nodes'],
            'scroll_fps': sc['fps'], 'scroll_frame_p95_ms': r1(sc['p95']), 'scroll_longest_frame_ms': sc['maxFrame'],
            'scroll_blocked_ms': sc['blockedMs'],
            'typing_fps': ty['fps'], 'typing_key_p95_ms': r1(ty['keyP95']), 'typing_key_max_ms': r1(ty['keyMax']),
            'typing_blocked_ms': ty['blockedMs'],
        })
    write('scenarios.csv', rows)


def qa():
    rows = []
    for f in sorted(glob.glob(f'{RAW}/qa/*/qa.json')):
        d = json.load(open(f))
        widest = max((w[1] for w in d.get('wide', [])), default=None)
        sj = d.get('scrollJumps') or {}
        rows.append({
            'variant': d['variant'], 'anchors': d.get('anchors'), 'widest_block_px': widest,
            'find_in_page': (d.get('find') or {}).get('found'),
            'selection_chars': (d.get('selection') or {}).get('selectionChars'),
            'text_chars': (d.get('selection') or {}).get('textContentChars'),
            'scroll_steps': sj.get('steps'), 'scroll_jumps_over_20px': sj.get('over20px'), 'worst_jump_px': sj.get('worst'),
        })
    write('qa.csv', rows)


def live_baseline():
    rows = []
    for f in sorted(glob.glob(f'{RAW}/baseline-*/turn-*.json')):
        d = json.load(open(f))
        if 'stream' not in d:   # turn 6 timed out before the answer finished; nothing was measured
            continue
        s, dom, rl = d['stream'], d['dom'], d.get('reload') or {}
        rows.append({
            'turn': d['turn'], 'ttft_ms': d['ttftMs'], 'answer_s': round(d['totalMs'] / 1000, 1),
            'fps': s['fps'], 'frame_p95_ms': r1(s['p95']), 'frame_max_ms': r1(s['max']), 'jank_pct': s['jankPct'],
            'blocked_s': round(s['loafBlockMs'] / 1000, 1), 'longest_freeze_ms': s['loafMaxMs'],
            'key_max_ms': s['keyMax'], 'busy_pct': s['mainThreadBusyPct'],
            'style_s': round(s['cdp']['RecalcStyleDuration'], 1), 'script_s': round(s['cdp']['ScriptDuration'], 1),
            'layout_s': round(s['cdp']['LayoutDuration'], 1),
            'nodes': dom['nodes'], 'katex': dom['katex'], 'heap_mb': d['heapMB'],
            'reload_dcl_ms': rl.get('dcl'), 'reload_blocked_ms': rl.get('loafBlockMs'), 'reload_longest_frame_ms': rl.get('loafMaxMs'),
        })
    write('live-baseline.csv', rows)


def logs():
    out = os.path.join(OUT, 'logs')
    os.makedirs(out, exist_ok=True)
    for f in sorted(glob.glob(f'{RAW}/../logs/*.log')):
        with open(f) as src, open(os.path.join(out, os.path.basename(f)), 'w') as dst:
            dst.write(HOME.sub('~/', UUID.sub('<id>', src.read())))


if __name__ == '__main__':
    bench(); scenarios(); qa(); live_baseline(); logs()
