"""after.gif for #171 stage 3a: stage 1c's before-gif.py (run as it is, chat text pixelated), with
`top`/`bottom` mapped to the harness's new start names (`top-unpinned`/`end-pinned`), which the run
JSON stores. Nothing else changed.

python3 -I after-gif.py <run.json> <out.gif> <fixture:from:to> <offset_s>
"""
import runpy, sys
from pathlib import Path

case, frm, to = sys.argv[3].split(':')
frm = {'top': 'top-unpinned', 'bottom': 'end-pinned'}.get(frm, frm)  # the harness stores the new start names
sys.argv[3] = ':'.join([case, frm, to])
runpy.run_path(str(Path(__file__).resolve().parents[2] / '2026-11-24-rail-jump-before/adhoc/before-gif.py'), run_name='__main__')
