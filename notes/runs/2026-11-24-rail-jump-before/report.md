# Rail jump to question 0 pulled back to the chat's end: `before.gif`, `math9` once, gesture trial again (issue #171, stage 1c) — 2026-11-24

Measurement and recording only; nothing under `extension/`, `test/` or `lab/harness/` changed. Lab 2. Unfixed dev build
`0.1.0-alpha.22+dev.1` (built from `e37e393`, `main`), unpacked at `~/snap/chromium/common/rail-pin-171a/dev/butter`, rail turned
on through `OPTS='{"rail":true}'` (the script put the stored options back after each run). Send guard on in every connection;
nothing was typed, Enter was never pressed, nothing was sent. Raw captures (MP4s, per-frame JSON, unscrubbed logs) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-before/`.

## Result

- **T1: `before.gif` shows the bug.** On `math12`, a rail click on question 0 with the chat at its end and pinned: the chat
  reaches question 0 0.3 s after the click. It is back at the chat's end at 2.3 s, and again at 4.4 s and 6.5 s after Butter
  retries twice. The run classed both such jumps `failed`, reason `target-unmounted`, both ending at the chat's end
  (347,409). Every pull is ChatGPT's own `scrollTo` to the end from its `ResizeObserver` path (`ah` ← `aj` ←
  `ResizeObserver`), 3 per jump.
- **T2: `math9`, default sequence: 0 failed, 1 detoured, 23 clean** (24 jumps). The one detour is `from=top to=4`
  right after the reload, before earlier history loaded. It shows ChatGPT's write to the end twice; see T2.
- **T3: the gesture trial's numbers match stage 1b's, read by `__pinNow()` only.** ChatGPT served a new build of its scroll
  chunk (`76629.a7c5a52398.js`), which `lp.json` does not map. All 32 logpoints were unresolved (`valid: false`), so
  every logpoint figure in this run is void. By `__pinNow()` and the holds, G1 cleared the pin in **12 of 12** trials
  and held all 12. The plain-write control kept it set in **6 of 6** and was pulled in all 6.

## T1. `before.gif`: the bug on the unfixed build

**Steps the GIF shows** (record the same steps on the fixed build for `after.gif`):

1. The script opens `math12` and loads all earlier history.
2. Step 1: `top→11`, a rail jump from the top to the last question; it ends at the chat's end.
3. Step 2, the recorded one: the harness's one-pixel wheel notch at the chat's end, then the edge write to the end. Stage
   1a found that this sets or keeps ChatGPT's end pin (`ao`, 3 of 3). Then a trusted click on the rail's first tick
   (question 0).
4. The GIF is that click's recording: crop x 580, y 88, 1020×912 (the chat column and the rail), composer band masked, real
   speed. It plays 9.5 s from 0.25 s before the click.

The run repeated steps 1–2 (`ONLY` with four steps); both `bottom→0` jumps failed the same way. The GIF shows the first one
(jump 2 of the run).

**Reproduce the recording** (with an outer lock `rail-pin-171c` on lab 2 held; `adhoc/run.sh` sets `LAB_ID=2
LAB_OWNER=rail-pin-171c OUT=<captures>/<name>.json` and writes the scrubbed log beside itself):

```sh
EXT=~/snap/chromium/common/rail-pin-171a/dev/butter FIXTURES=math12 LABEL=t1-rec OPTS='{"rail":true}' \
  RECORD=1 RECORD_ALL=1 RECORD_PHASE=settled \
  ONLY='[{"from":"top","to":11},{"from":"bottom","to":0},{"from":"top","to":11},{"from":"bottom","to":0}]' \
  notes/runs/2026-11-24-rail-jump-before/adhoc/run.sh t1-rec lab/harness/rail-jump-live.mjs
# the MP4s land in the system temp dir (/tmp/rail-jump-<pid>-<n>.mp4); they were moved to the captures folder and the JSON's
# `recording` paths rewritten to match
```

**Reproduce the GIF:**

```sh
python3 -I notes/runs/2026-11-24-rail-jump-before/adhoc/before-gif.py <captures>/t1-rec.json \
  notes/runs/2026-11-24-rail-jump-before/before.gif math12:bottom:0 0.22
```

`adhoc/before-gif.py` keeps `rail-jump-gif.py`'s crop, its composer mask and its storyboards. It differs in three ways:

- It takes one witness `fixture:from:to`, so a jump from the bottom can be the witness.
- It plays at real speed, cut to 9.5 s.
- It writes a readout into the masked band: "Chat at question 0 (the jump target)" or "Chat at the chat's end" (yellow
  after the click), with the seconds since the click. The readout comes from the run's own per-frame `changes`, shifted
  onto the video's clock by 0.22 s. That offset was measured: ChatGPT's footer (shown only at the chat's end) reappears
  in the video at 2.567, 4.700 and 6.767 s. The probe first sampled the end at 2.347, 4.459 and 6.545 s, so video =
  probe + 0.22 s.

`adhoc/rail-jump-gif.py` is the harness script with only the witness selection widened to `fixture:from:to`. It made the
first, unlabelled version; it is kept for comparison.

**The jump's class and reason, from the run's output** (`adhoc/t1-rec.log`):

```
t1-rec math12 from=bottom to=0 phase=settled class=failed positions=[[92,347398],…,[305,20],[1453,385],[2347,347409],[3489,20],[3568,385],[4459,347409],[5580,20],[5663,385],[6545,347409]] targetTop=null reversals=5
```

`failureReason: target-unmounted` in the JSON, for both `bottom→0` jumps; `final` 347,409, the chat's end. Scroll writes in
jump 2 (from the run's scroll probe; times in ms after the measurement start, the click at 30):

| t (ms) | World | Write | Caller |
|---:|---|---|---|
| 32 | Butter | smooth `scrollTo` 346,953 | `trip.depart` |
| 294 | Butter | scrollTop 20 | `jump` |
| 1390, 1393 | Butter | 20, then 385 | `jump`, `readiness.steady` |
| **1486** | **ChatGPT** | **`scrollTo` 347,409 (the end)** | **`ah` ← `aj` ← `ResizeObserver`** |
| 2604 | Butter | 20 | `jump` (retry) |
| 3490, 3491 | Butter | 20, 385 | `jump`, `steady` |
| **3599** | **ChatGPT** | **end** | **same** |
| 4711 | Butter | 20 | `jump` (retry) |
| 5581, 5583 | Butter | 20, 385 | `jump`, `steady` |
| **5706** | **ChatGPT** | **end** | **same** |

Jump 4 has the same 13 writes within 80 ms of these times. The page sampled no frame for 0.86–1.08 s after each write
(`maxFrameGapMs` 1084 and 1009). The chat *showed* each position about 0.9 s after it was written, and the GIF's readout
follows what was shown.

**Storyboards checked.** All 114 frames of the final GIF were viewed on 8 sheets. Three earlier builds of the GIF were
each looked at too, and none was kept. Seen in the frames:

- Fixture text: the end of the fixture's convex-optimization notes (formulas, Chinese and English headings), a user
  bubble "test" and its reply "测试成功，消息已收到" ("test succeeded, message received"). The same kind of fixture text is in
  the committed 11-16 rail GIFs.
- ChatGPT's footer line, the rail, and ChatGPT's grey placeholder bars for unmounted turns. These fill every frame while
  the chat is at question 0, and also while it is at the end between the pulls.
- Chromium's own "Restore pages? Chromium didn't shut down correctly" bubble in the top right corner of every frame.
  This is browser UI, not private.

No account name, chat title, URL, sidebar or composer text appears in any frame. The storyboards and the media JSON were
deleted afterwards; `ls` shows only `before.gif` and `adhoc/` besides the report and logs.

**GIF facts:**

```
$ ffprobe -v error -show_entries format=duration,size:stream=width,height,nb_frames,codec_name -of default=nw=1 before.gif
codec_name=gif
width=800
height=715
nb_frames=114
duration=9.500000
size=1103166
```

PIL: `(800, 715)`, 114 frames, loop 0. 1,103,166 bytes (under 3 MB), 9.5 s (at most 10 s), 800 px wide, 12 fps. No
`before.mp4`: the GIF holds the click, the arrival and all three pulls.

## T2. `math9` once, default sequence

`FIXTURES=math9 LABEL=t2-math9 OPTS='{"rail":true}'`, default steps:

- 2 cold-reload jumps;
- top→0…8;
- bottom→0…8;
- 4 from the previous target.

The fixture had 9 questions, 295,527 px.

| Class | Count | Jumps |
|---|---:|---|
| failed | **0** | – |
| detour | **1** | `from=top to=4`, phase `reload` (right after the reload, before earlier history was loaded) |
| clean | **23** | every other jump |

`SUMMARY {"jumps":24,"failed":0,"visibleDetour":1,…,"anchoringOn":0}`, exit 1 (because of the detour). No jump failed,
so no `target-unmounted` reason occurs.

**The detour, and ChatGPT's write to the end.** `failureReason` null; it landed on question 4 (`targetTop` 64) at 16.6 s.
The scroll probe shows ChatGPT's write to the end twice during the trip:

| t (ms) | World | Write | Where | Caller |
|---:|---|---|---|---|
| 2603 | ChatGPT | `scrollTo` 207,988 | the end (h 208,900) | `ah` ← `aj` ← `ResizeObserver`. Before the click: the "from the top" start was pulled to the end, so the jump started from the end (start 207,988) |
| 4613 | Butter | smooth `scrollTo` 207,532 | | `trip.depart` (click at 4610) |
| 4905 | Butter | scrollTop 132,375 | | `jump` |
| 6066, 6068 | Butter | 127,602, 127,967 | | `jump`, `steady` |
| **6075** | **ChatGPT** | **`scrollTo` 210,475** | **the end** (h 211,387) | **`ah` ← `aj` ← `ResizeObserver`** |
| 8100 | Butter | 134,365 | | `jump` (retry) |
| 9310, 9311 | Butter | 127,602, 127,967 | | `jump`, `steady` |
| 10261 | ChatGPT | `scrollTo` 129,650 | not the end | `ah` ← `compensateScrollToDistanceFromBottomPx` |
| **10388** | **ChatGPT** | **`scrollTo` 212,158** | **the end** (h 213,070) | **`ah` ← `aj` ← `ResizeObserver`** |
| 12426 … 15642 | Butter | 127,602 → 129,285 | | retries, then `trip.arrive` |

So yes: the detour is the same pull as T1, twice. The difference is that the third retry held and the jump ended on its
target, so the class is detour, not failed. Whether the pin was set is not read in this run (no pin probe in
`rail-jump-live.mjs`).

## T3. Gesture trial, second run, next to stage 1b

`EXT=` (no extension; `EXTENSIONS 0`), `PHASES=g1,c1 N=10`, the same `gesture.mjs` and `lp.json` copied from stage 1b.

**Logpoints invalid:**
`LOGPOINTS {"set":32,"resolved":0,"chunks":["76629.a7c5a52398.js"],"known":["77a8c190f1","c55b0947a1"],"valid":false}`.
ChatGPT served chunk build `a7c5a52398`, which `lp.json` does not map, so no logpoint resolved. Every logpoint field in
this run is empty or void (`lpGrowth` 0 hits, `lpPin` empty, no `ROgrow`/`ROtail`/`cE` times). The table below uses only:

- `__pinNow()`, which does not depend on the build;
- the hold's frames (position, scrollHeight);
- the `scrollTo` hook (`chatgptEndScrollTo`).

"Growth" here is the script's fallback: scrollHeight changed in the hold while the target was mounted (`hChange &&
mounted`), not a logpoint hit.

| Phase | Trials | Pin before (`pinNow`) | Pin right after | Pin at hold end | Pulled | Held | Growth in hold (scrollHeight range) | Stage 1b (run 2) |
|---|---:|---|---|---|---:|---:|---|---|
| G1 (q0 ×4, q1 ×3, q2 ×3) | 10 | true 10 | **false 10 of 10** | false 10 | **0** | **10** | 10 of 10 (q0/q2 −136, q1 −272) | pin false 10 of 10, pulled 0, held 10, growth 10 |
| G1, menu open (q0, q1) | 2 | true 2 | false 2 of 2 | false 2 | 0 | 2 | 2 of 2 | false 2 of 2, pulled 0, held 2 |
| C1 plain write (q0, q1, q2 ×2) | 6 | true 6 | **true 6 of 6** | true 6 | **6** | 0 | 6 of 6 | true 6 of 6, **pulled 6 of 6** |

- G1's scrollHeight was the same at the press and at the scroll event in 12 of 12 (`hSame`), as in 1b.
- G1 landings: q0 at 0, q1 at 31,761, q2 at 78,716. These are the same as 1b, and each was still there at hold end.
- C1 pulls: one ChatGPT `scrollTo` to the end per trial (6 of 6). The pull was first sampled at 1.87, 1.86 s (q0); 3.97,
  3.45 s (q1); 3.55, 3.54 s (q2). In 1b these were 1.91, 1.95; 3.53, 3.56; 3.70, 3.71 s.
- C1 ended at 281,722–281,734, the end.
- The fixture measured 282,646 px this time; in 1b it was 316,392 px. The positions of q0–q2 were the same.
- Not available this run, since the logpoints were void:
  - the `cE` hit inside G1's task;
  - the pin value at ChatGPT's growth step;
  - the growth `m` values.

## Runs

Lock `rail-pin-171c` on lab 2. Each run was `adhoc/run.sh <name> <script>` with the env shown. Raw logs and JSON are in
the captures folder; the scrubbed logs are here.

| # | Command (env) | UTC | Exit | Log |
|---:|---|---|---:|---|
| 1 | `EXT=<dev build> FIXTURES=math12 LABEL=t1-rec OPTS='{"rail":true}' RECORD=1 RECORD_ALL=1 RECORD_PHASE=settled ONLY=<4 steps above>` `run.sh t1-rec lab/harness/rail-jump-live.mjs` | 00:21:19–00:22:49 | 1 | [adhoc/t1-rec.log](adhoc/t1-rec.log) |
| 2 | `EXT=<dev build> FIXTURES=math9 LABEL=t2-math9 OPTS='{"rail":true}'` `run.sh t2-math9 lab/harness/rail-jump-live.mjs` | 00:23:04–00:27:05 | 1 | [adhoc/t2-math9.log](adhoc/t2-math9.log) |
| 3 | `EXT= LP=…/adhoc/lp.json LP_URL='/76629\.HASH\.js' PHASES=g1,c1 N=10` `run.sh t3-g1-c1 …/adhoc/gesture.mjs` | started 00:27:12 | – | aborted: this session was cut off right after the start; the raw log holds only `EXTENSIONS 0`; no scrubbed log |
| 4 | same as 3 | 01:41:09–01:45:42 | 0 | [adhoc/t3-g1-c1.log](adhoc/t3-g1-c1.log) |

Exit 1 in runs 1 and 2 is the script's verdict on a failed or detoured jump, not a setup error.

Send guard: run 1 counted `sendAttempts: 2, blockedMutations: 65`, run 2 `0` and `96`. All of these were aborted by the
guard. Every 11-24 `rail-jump-fail` run shows the same 2 blocked conversation-endpoint requests per `math12` open
(`r1`–`r4` 2, the full runs 4). No message was sent, and the composer was never typed into.

## Not established

- **Why the page draws no frame for ~0.9 s after each write in T1** (frame gaps of 863–1084 ms). Stage 1b saw the same
  ~0.85 s gap. The GIF's readout follows the drawn frames; ChatGPT's end writes happened about 0.9 s before each drawn
  pull.
- **T2's pin state** during the detour: `rail-jump-live.mjs` does not read the pin. The pre-click pull at 2603 fits stage
  1a's (a): the pin was set on open and the "from the top" write was pulled. That is inferred, not read here.
- **T3 logpoint data**: void, because of chunk build `a7c5a52398`. Remapping `lp.json` to it was not in this stage's
  scope (stage 1a's report says how).
- `after.gif` is not made here; it needs the fixed build. The steps and commands above are the ones to repeat.
- Only one fixture per task, one session per run.

## Lab time and clean-up

- **First lock:** `rail-pin-171c` on lab 2, taken 00:21:14 UTC after waiting for another task's lock
  (`veil-unmarked-172`). Runs 1–3 used it. This session was then cut off by a rate limit right after run 3 started (about
  00:27). The lab sat idle under the lock until the lead ran `lab-restore` and `lab-lock release` for this owner at
  01:40 UTC.
- **Second lock:** same owner, taken 01:41:05 UTC; run 4 only. Then:
  - `lab-restore --lab 2 --owner rail-pin-171c` exited 0: no extension, home tab, empty composer ([restore.log](restore.log));
  - `lab-lock release` exited 0 at 01:45:53 (`{"lab": 2, "lab_released": true, "perf_released": false}`).
- [lock-status.log](lock-status.log), taken after the release, shows lab 2 `"held": false`.
- Runs: 4 started of the 10 allowed (one aborted). Lock time in use: about 6 min plus 5 min. No perf lock was taken. Lab 1
  was not used.
- Stored options: the script set `opts.rail: true` and put the stored value back in runs 1 and 2. The dev build ran from
  its own unpacked path, as in stage 1a.

## Files

- `report.md` (this file) and `before.gif`.
- `adhoc/before-gif.py`: the labelled GIF maker used for `before.gif`.
- `adhoc/rail-jump-gif.py`: the harness GIF script with the witness selection widened.
- `adhoc/run.sh`: the run wrapper (lock owner `rail-pin-171c`; counts runs; scrubs the log).
- `adhoc/gesture.mjs` and `adhoc/lp.json`: unchanged copies of stage 1b's.
- `adhoc/t1-rec.log`, `adhoc/t2-math9.log`, `adhoc/t3-g1-c1.log`, `restore.log`, `lock-status.log`: scrubbed logs
  (URLs `<url>`, ids `<id>`, home `~`).
