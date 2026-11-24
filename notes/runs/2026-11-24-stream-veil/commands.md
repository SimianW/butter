# Commands — Smoother streaming stage 4 (stream veil), 2026-11-24

Run from the worktree root (`fix/smoother-streaming-audit`, head `b2df865`). `B` is
`~/.local/share/chatgpt-lab/bin`; `C` is `~/.local/share/chatgpt-lab/captures/2026-11-24-stream-veil`;
`H` is `~/snap/chromium/common/stream-audit-1123/butter`; `P` is
`~/snap/chromium/common/stream-proto-1124`.

Each replay ran through a wrapper outside the repo (`/tmp/sv1124/run.sh NAME EXT FIXTURE [VAR=value…]`):
- It refused to start a run after 1560 s of the lock, after 10 runs, or after any
  `FAIL no-escape`/`FAIL server-unchanged` in an earlier log.
- It then ran
  `env LAB_ID=2 LAB_OWNER=stream-veil-1124 EXT=<dir> LABEL=<name> FIXTURE=<f> [PHASES=stream] [TAIL_MS=…] [VEILPROBE=1] [APIPROBE=1] OUT=$C/<name>.json node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log`.

## Before the lock

```sh
diff -rq -x dev extension $H          # only manifest.json differs
python3 -I /tmp/sv1124/gen.py         # copies H to P/{pv,pvh,pe}/butter, applies the veil / hydration / data-cot changes, writes patch trees
cd /tmp/sv1124/trees && for n in pv pvh pe; do diff -ruN a/extension b-$n/extension > $n.patch; node --check $P/$n/butter/stream/offscreen.js; done
git apply --check /tmp/sv1124/trees/{pv,pvh,pe}.patch
node /tmp/sv1124/dry.mjs              # BUILDS=pv,pvh,head, then BUILDS=pe; headless snap Chromium, throwaway profile
node /tmp/sv1124/dry2.mjs             # head,pv: Element Timing of a revealed block (no entries came)
python3 - <<'EOF'                     # module AORd of the stage 3 bundle copy (sha256 27506c49…): selector e, sampler B
EOF
curl -sS -L -A '<generic Chrome UA>' https://chatgpt.com/ -o home.html            # public home page: one stylesheet link
curl -sS -A '<generic Chrome UA>' <public /cdn/assets/869218a823d4.css> -o root.css
grep -c 'data-cot' root.css home.html
node /tmp/sv1124/t/unit.mjs           # splitTail / tailReport / veilReport on fake data; veil probe on a static page
npx eslint lab/harness/stream-replay-live.mjs lab/harness/stream-api-probe.mjs lab/harness/stream-run-opts.mjs lab/harness/stream-laf-probe.mjs lab/harness/stream-laf-report.mjs lab/harness/stream-veil-probe.mjs; echo eslint-exit=$?
wc -l lab/harness/stream-*.mjs
```
```text
pv syntax ok / pvh syntax ok / pe ok; pv applies / pvh applies / pe applies
pv   {"midStream":{"n":151,"seen":21,"unrendered":130,"cv":{"auto":151},"veiled":130,"veiledOp0":130,"veiledNotAuto":0},"walkMidStream":{"ms":2,"visited":556},"reveal":{"rows":[{"fi":1,"veil":true,"op":"0","childRendered":false},{"fi":2,"veil":true,"op":"0","childRendered":false},{"fi":3,"veil":false,"op":"1","childRendered":true},…],"events":[{"fi":2,"skipped":false}]},"cvOffLive":{"veiled":0,"off":"cv layout"},"cvOffStream":{"veiled":0},"butterErrors":0}
pvh  {"midStream":{"veiled":130,"hydrated":"0","pending":"130","measuring":0},…,"afterComplete":[…,{"seen":151,"unrendered":0,"veiled":0,"hydrated":"97","pending":"0","mdH":16520}],"butterErrors":0}
head {"walkMidStream":{"ms":18,"visited":3302},"reveal":{"rows":[{"fi":1,"childRendered":false},{"fi":2,"childRendered":false},{"fi":3,"childRendered":true},…],"events":[{"fi":2,"skipped":false}]},"butterErrors":0}
pe   {"midStream":{"cot":130},"cvOffLive":{"cot":0},"butterErrors":0}
dry2: renderTime null for every block (Element Timing gave no entries); event 21.6–35.1 ms after the write; pv veil off in the same task as the event
200 765893 (home page); 200 2226945 (root.css); data-cot in root.css: 0; in home.html: 0
eslint-exit=0
263 stream-api-probe.mjs, 112 stream-laf-probe.mjs, 74 stream-laf-report.mjs, 500 stream-replay-live.mjs, 83 stream-run-opts.mjs, 151 stream-veil-probe.mjs
```

## Lock

```sh
$B/lab-lock acquire --lab 2 --owner stream-veil-1124 --wait 1800 --perf
```
```text
2
exit=0          # taken 2026-11-24T07:27:10Z, no queue
```

## Runs

| # | Name | EXT | FIXTURE | Options | UTC | Exit |
|---|---|---|---|---|---|---:|
| 1 | `head-ats12` | H | `ats12` | `PHASES=stream` | 07:27:12–07:30:30 | 0 |
| 2 | `pv-ats12` | P/pv (as written = pv0) | `ats12` | `PHASES=stream` | 07:30:32–07:33:46 | 0 |
| — | leak fix: `cp -r P/pv P/pv0`; gen.py with the scoped veil rule and the completion unveil; rebuilt pv, pvh, pe | | | | 07:33:46–07:34:45 | |
| 3 | `pvh-ats12` | P/pvh | `ats12` | `PHASES=stream TAIL_MS=20000` | 07:34:45–07:38:16 | 0 |
| 4 | `pvh-math9` | P/pvh | `math9` | `PHASES=stream TAIL_MS=20000` | 07:38:21–07:41:52 | 0 |
| 5 | `head-math9` | H | `math9` | `PHASES=stream` | 07:41:54–07:45:09 | 0 |
| 6 | `pvh-ats12-all` | P/pvh | `ats12` | `VEILPROBE=1` (all phases) | 07:45:11–07:48:51 | 0 |
| 7 | `pv-ats12-all` | P/pv | `ats12` | `VEILPROBE=1` (all phases) | 07:48:59–07:52:45 | 0 |
| 8 | `pv-ats12-apiprobe` | P/pv | `ats12` | `PHASES=stream APIPROBE=1` | 07:52:57–07:56:08 | 0 |

Key lines per run:

```text
# 1 head-ats12
REPORT long animation frames, Enter to 5 s after stream complete (112753.3 ms): LoAF 340, total 26633.6 ms, blocking 6626.4 ms, longest 1844.5 ms; …
REPORT completion frame: start 105025.6 ms, duration 1844.5, blocking 1792.3, script part 589.3, rAF part 1244.5, render part 10.7; scripts 1233.7/1181.2 forced chatgpt:299268.5b3cdf27e2.js user-callback "FrameRequestCallback"; 586.9/182.1 forced other user-callback "TimerHandler:setTimeout"
REPORT blocks after the window: 612 in the last turn, content-visibility auto 592, data-butter-seen 26, data-butter-unrendered 566, data-butter-settle left 0
SUMMARY head-ats12: 0 FAILs

# 2 pv-ats12 (pv0)
REPORT long animation frames, … (112677.9 ms): LoAF 86, total 7714.2 ms, blocking 1686.5 ms, longest 659.8 ms; …
REPORT completion frame: start 105022.7 ms, duration 659.8, blocking 608.8, script part 626.1, rAF part 23.2, render part 10.5; scripts 625.2/175.9 forced other …; 14.7/6.6 forced chatgpt:299268.5b3cdf27e2.js …
REPORT veil counts (last turn): mid-stream 270 at 52877 ms (max 585 at 104161.7); just before the completion frame 585 at 104161.7 ms; after the window 586; veiled but not content-visibility auto: max 19 in samples, 19 after the window
SUMMARY pv-ats12: 0 FAILs

# 3 pvh-ats12
REPORT long animation frames, … (112666.8 ms): LoAF 91, total 7856.3 ms, blocking 1574.5 ms, longest 674.1 ms; …
REPORT completion frame: start 105021.7 ms, duration 674.1, …; scripts 636.4/179.8 forced other …; 15/6.5 forced chatgpt:299268.5b3cdf27e2.js …
REPORT blocks after the window: 612 in the last turn, content-visibility auto 592, data-butter-seen 592, data-butter-unrendered 0, data-butter-settle left 0
REPORT tail (112665.5-127775.6 ms after Enter): LoAF 0, total 0 ms, blocking 0 ms, longest -, >=100/200/500/1000 ms 0/0/0/0, forced 0 ms
REPORT hydration marks: 95 batches (567 blocks) from 106032 to 115899.5 ms, last measure off 116914.8 ms, most measuring at once 66; veils removed in these callbacks 589
REPORT last turn height: final 36503 px, exactly final from 116089.6 ms
SUMMARY pvh-ats12: 0 FAILs

# 4 pvh-math9
REPORT long animation frames, … (112527.6 ms): LoAF 275, total 21189.8 ms, blocking 3512.5 ms, longest 675 ms; …
REPORT completion frame: start 105046.7 ms, duration 675, …; scripts 626.7/194.3 forced other …; 15.8/7 forced chatgpt:299268.5b3cdf27e2.js …
REPORT tail (112526.2-127700.1 ms after Enter): LoAF 2, total 118.6 ms, blocking 11.5 ms, longest 61.8 ms at 112541.3, >=100/200/500/1000 ms 0/0/0/0, forced 0 ms
REPORT hydration marks: 95 batches (567 blocks) from 105818.9 to 116080.5 ms, last measure off 117009.2 ms, most measuring at once 66; veils removed in these callbacks 589
REPORT last turn height: final 36503 px, exactly final from 116969 ms
SUMMARY pvh-math9: 0 FAILs

# 5 head-math9
REPORT long animation frames, … (112718.1 ms): LoAF 493, total 40155.5 ms, blocking 10712.6 ms, longest 1960.2 ms; …
REPORT completion frame: start 105039.6 ms, duration 1960.2, …; scripts 1257.2/1202.8 forced chatgpt:299268.5b3cdf27e2.js …; 670/194.8 forced other …
SUMMARY head-math9: 0 FAILs

# 6 pvh-ats12-all
REPORT completion frame: start 105075.6 ms, duration 651.9, …; scripts 611.2/177.8 forced other …; 15.2/6.4 forced chatgpt:299268.5b3cdf27e2.js …
REPORT wheel phase: last turn 36503 px high, 55 steps up
REPORT veil probe, wheel phase (55 wheel events up, 55 down): frames sampled 1248 (point hits on an answer block 6410), frames with a tested point on a veiled or opacity-0 block 0, longest consecutive run 0, by step {}, veiled/op0 hits 0/0
REPORT veil probe, scrollTop write to the streamed answer's middle (45929 → 27976): frames sampled 30 (point hits on an answer block 120), frames with a tested point on a veiled or opacity-0 block 0, …
REPORT view shift up (55 steps): 0/55 over 4px, median 0, max 0 (lost 0, none 0, clamped 0); in the streamed answer: 0/53 over 4px, …
REPORT view shift down (55 steps, ended fromEnd 0): 0/55 over 4px, …; in the streamed answer: 0/52 over 4px, …
PASS wheel-no-jump
SUMMARY pvh-ats12-all: 0 FAILs

# 7 pv-ats12-all
REPORT completion frame: start 105040.1 ms, duration 641.2, …; scripts 606.5/175.6 forced other …; 14.9/6.4 forced chatgpt:299268.5b3cdf27e2.js …
REPORT veil counts (last turn): mid-stream 270 at 52698 ms (max 586 at 105002.4); just before the completion frame 586 at 105002.4 ms; after the window 567; veiled but not content-visibility auto: max 0 in samples, 0 after the window
REPORT wheel phase: last turn 81566 px high, 60 steps up
REPORT veil probe, wheel phase (60 wheel events up, 60 down): frames sampled 1275 (point hits on an answer block 6543), frames with a tested point on a veiled or opacity-0 block 2, longest consecutive run 2, by step {"end":2}, veiled/op0 hits 8/8
REPORT veil probe, scrollTop write to the streamed answer's middle (46026 → 28073): frames sampled 30 (point hits on an answer block 120), frames with a tested point on a veiled or opacity-0 block 0, …
REPORT view shift up (60 steps): 9/60 over 4px (842, 1013, 578, 973, 635, 951, 896, 950, 1047 px), median 0.3, max 1047 (…)
REPORT view shift down (60 steps, ended fromEnd 0): 0/60 over 4px, …
PASS wheel-no-jump
SUMMARY pv-ats12-all: 0 FAILs

# 8 pv-ats12-apiprobe
REPORT completion frame: start 105022.3 ms, duration 679.7, …; scripts 643.4/188.7 forced other …; 16.1/6.6 forced chatgpt:299268.5b3cdf27e2.js …
REPORT api probe sums of kept calls per API: {"clientHeight":{"n":1,"ms":189.7}}; all armed calls per API (top 12 by time): {"clientHeight":{"n":1482,"ms":196.6},"Range.getBoundingClientRect":{"n":8863,"ms":71.2},"Element.checkVisibility":{"n":7815,"ms":36.5},"scrollLeft":{"n":2280,"ms":36.4},"getComputedStyle":{"n":63376,"ms":30.2},…}
REPORT api probe, all calls starting in the completion frame (105022.3-105702 ms, 50 ms bins): {"clientHeight":{"n":55,"ms":190.1},"scrollLeft":{"n":77,"ms":6.4},…}; in its rAF part: {"scrollLeft":{"n":75,"ms":6.1},"Range.getBoundingClientRect":{"n":211,"ms":1.8},"getComputedStyle":{"n":776,"ms":0.6},…}
SUMMARY pv-ats12-apiprobe: 0 FAILs
```

Every run printed `PASS no-escape` and `PASS server-unchanged`.

## Clean-up

```sh
$B/lab-restore --lab 2 --owner stream-veil-1124          # 07:56:12
$B/lab-lock release --lab 2 --owner stream-veil-1124
$B/lab-lock status
```
```text
restored {"lab":2,"restarted":true,"url":"<url>","composer":"","pages":["<url>"],"browser":{"pid":3517716,"extensions":[],"flags":[]},"at":"2026-11-24T07:56:22.395Z","ok":true}
restore exit=0
{"lab": 2, "lab_released": true, "perf_released": true}
release exit=0
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Analysis (no lab)

- **`/tmp/sv1124/build.py`** built `data.json` from `$C/*.json` and wrote the sanitized logs: home →
  `~`, URLs → `<url>`, extension and chat ids → `<id>`. The patches were written with their timestamps
  stripped; `pv0.patch` was rebuilt from `P/pv0` after `gen.py` cleared its trees.
- **`node /tmp/sv1124/dry3.mjs`** (BUILDS=pv0,pv,pvh): fixed builds on a page with `<hr>` blocks;
  0 veiled blocks that render; the leak did not reproduce synthetically.
- **The tail-less hydration line fix** in `stream-veil-probe.mjs`, checked with
  `node /tmp/sv1124/t/unit2.mjs` on run 6's capture:
  `hydration marks in the window: {"batches":64,"first":106068,"lastOn":112566.5,…,"mostMeasuringFromMarks":66,"measureOn":384,"veilOff":407}`.

```sh
grep -lE "https?://|/home/simon|[0-9a-f]{8}-[0-9a-f]{4}-|g-p-[0-9a-f]|chrome-extension://[a-p]{32}" notes/runs/2026-11-24-stream-veil/*; echo $?   # 1: no match
for f in notes/runs/2026-11-24-stream-veil/*.log; do tail -n 1 $f; done   # 8 × "SUMMARY <label>: 0 FAILs", plus the release log's last status line
git status --short extension/    # (empty)
for n in pv0 pv pvh pe; do git apply --check notes/runs/2026-11-24-stream-veil/$n.patch; done   # all apply
```
