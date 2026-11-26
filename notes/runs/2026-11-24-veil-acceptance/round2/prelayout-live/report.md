# Pre-layout on live ChatGPT: why the first find stayed slow, and the fix (#170, #177), 2026-11-26

**Question.** Round 2 stage D ([summary](../stage-D/summary.md)) found that pre-layout (`552b8db`,
"veil2") did not make the first `window.find` on a held block fast on live ChatGPT: 812–939 ms,
against head's 98.5–103.1 ms. Headless, the same find lays out 52 objects against 23,284 without
pre-layout. Why, and can Butter fix it?

**Answer.** Pre-layout started on time and on every held block, but **it got no idle time**. Its
idle callbacks did not run while the page drew a long frame every frame, which on the lab is the
whole time the u4 probe's frame sampler runs (completion to +16 s). When the first find came at
+16.5 s, it had laid out 28 of 565 blocks. Butter can fix this. The fix gives each idle callback a
50 ms timeout. A callback that runs on that timeout still lays out 8 ms of blocks. With the fix,
the first find took **166.7 and 156.8 ms** live, against veil2's 812–981 ms. All 13 verdicts
passed in both runs.

## The cause, measured

The build was veil2 with dev-only counters (`veil2dbg`, a private copy outside the repo). The
counters record:

- the turn-state mutations;
- the start and why a block is not due;
- each pass (start or font), with its reads and idle callbacks;
- the font loads;
- mutations inside laid-out blocks.

The u4 probe reads them on request, before and after the first find. Per-run numbers are in
[runs.jsonl](runs.jsonl), made by [plive-extract.mjs](plive-extract.mjs).

**The hypotheses, tested:**

| Hypothesis | Result | Measurement (run `veil2dbg-2`, the stage D condition) |
|---|---|---|
| Pre-layout never starts, or covers few blocks (the `in_progress` gate, `waiting`, `data-butter-unrendered`) | **Ruled out** | ChatGPT changes the attribute on the same element: `oldValue` `in_progress`, value `complete`, with no busy turn. The start ran at +926 ms after completion. 565 blocks were in the turn, all `data-butter-unrendered` and all in `waiting`, and 0 were not due for any reason (connected, waiting, attribute, busy). |
| The read lays out too little live (nested containment, KaTeX structure) | **Ruled out** | In run 3, with idle time available, the reads covered all 567 blocks by +5.2 s. The first find then took 155 ms. |
| Something dirtied the layout again before the find | **Ruled out** | 0 mutations inside laid-out blocks. The only ancestor writes were two `style` writes on wrappers (height). The font passes re-laid the blocks after each KaTeX font arrived. |
| `window.find` does other work that is not layout | **Ruled out** | Later calls are 83–95 ms on every build, as on head. Run 3's first call, with the blocks laid out, is 155 ms. |
| **Pre-layout runs, but its idle callbacks do not** | **Confirmed** | The start pass queued 565 blocks at +926 ms. Its **first idle callback ran at +16,436 ms**, after the sampler stopped at +16 s. By the find at +16,554 ms, 6 callbacks had laid out 28 blocks, and 537 were still pending. KaTeX_Size1/2/3 were first requested by those late reads and loaded at +17.7 s, after the find. |

**The differential (one change: the sampler's length):**

| Run | Sampler after completion | First idle callback | Blocks laid out before the first find | First find (ms) |
|---|---|---|---|---:|
| `veil2dbg-2` | 16 s (as stage D) | +16.4 s | 28 of 565 | **980.8** |
| `veil2dbg-short-3` | 2 s (`UX_SAMPLE_MS=2000`; find still at +16.6 s via `U4_DELAY_MS=14500`) | +2.07 s | 567 of 567, by +5.2 s, after three font passes | **155.2** |

**Why no idle time.** Every frame, the sampler calls `elementFromPoint` 7 times and reads rects and
computed styles. Each read forces style and layout. With the lab's software rendering, each frame's
main-thread work outlasts the frame. Chromium then grants no idle period at all, not even a short
one. The same happens headless: a `requestAnimationFrame` loop that busy-waits a set time each
frame gives these idle callbacks over 2 s:

| Busy-wait per frame | 0, 2, 6 or 12 ms | 15 ms | 17 ms | 25 ms | 40 ms |
|---|---|---|---|---|---|
| Idle callbacks | 120 / 120 frames | 120 / 121 | **0** / 117 | **0** / 80 | **0** / 50 |

So pre-layout relied on the page going idle, and a page that is busy every frame never does. The
probe's sampler did this here. For a user, the same could come from any steady per-frame work on a
slow machine, such as scrolling or animations.

**About the stage D numbers.** Stage D's first finds (812–939 ms) were measured in this condition.
A user who leaves the page alone after completion would have had the blocks laid out about 1–5 s
after completion, even before the fix. Stage C2's u2 jump at +12 s also falls inside the sampler's
16 s, which fits the lead's C2 evidence: no KaTeX size font was requested before the write.

## The fix

`extension/stream/offscreen.js`: each idle callback is requested with `{ timeout: WAIT_MS }`
(50 ms). A callback that runs on its timeout (`deadline.didTimeout`, `timeRemaining()` 0) lays out
up to `CHUNK_MS` (8 ms) of blocks, at least one. Without the budget it would lay out exactly one.
On an idle page nothing changes: callbacks run in idle periods, up to `min(8 ms, timeRemaining())`.
On a page that never goes idle, pre-layout now takes at most one short task per 50 ms. It still
writes nothing, stops for cv off and a hidden document, and leaves every block held, veiled and
skipped.

**Tests (red without the fix, green with it):**

- **Fake DOM** (`test/stream-prelayout.test.js`, new case "on a page that is never idle"). The
  fixture now records each callback's timeout, and `idle({ timedOut: true })` runs callbacks on
  their timeout with no idle time left. The case checks that 40 blocks (4 ms each) are laid out,
  with every callback requested with a timeout of at most 100 ms, in at most 20 callbacks, each at
  most 20 ms.
  - Without the fix it fails on `requested with timeouts ,,,…` (no timeout).
  - With the timeout but without the `didTimeout` budget, it fails on
    `40 callbacks for 40 blocks: one block each`.
- **Headless Chromium** (`test/stream-prelayout-chromium.test.mjs`, new case "on a page that is
  never idle"). The answer completes, a `requestAnimationFrame` loop busy-waits 20 ms every frame,
  and 4 s later, still busy, a `window.find` runs on a held block near the end.
  - With the fix, the find lays out 11 objects against 32,691 without pre-layout, in 16 pre-layout
    callbacks, the longest 8.4 ms.
  - Without the fix it lays out **32,691 against 32,691**, the live symptom, in 2 callbacks.
  - With the timeout but without the budget: 27,014, in 51 one-block callbacks.
- All existing veil and pre-layout tests stay green: `npm run check`, 987 tests, 0 failed. The hard
  requirement holds: no rendered block is veiled, and pre-layout writes nothing (fake DOM "it
  writes nothing"; headless "held blocks stay skipped, held and veiled").

## Live confirmation (veil2 + the fix, "veil2fix")

The build was veil2 with this branch's `stream/offscreen.js`. It ran in stage D's condition
(16 s sampler, u4 at +16.5 s, `U4_FINDS=3`).

| Run | First find, block 429 (ms) | Later 1, block 440 | Later 2, block 450 | Select-all (chars, ms) | Flags before each call | Verdicts |
|---|---:|---:|---:|---|---|---|
| `veil2fix-4` | **166.7** | 86.3 | 83.3 | 35,863, 111.5 | 15 (veil, opacity 0, skipped, held) | 13 PASS, exit 0 |
| `veil2fix-5` | **156.8** | 87.5 | 83.1 | 35,863, 113.7 | 15 | 13 PASS, exit 0 |
| stage D veil2 (3 runs) | 812.0–939.0 | 82.2–84.6 | 85.5–87.1 | 35,863, 113.6–116.5 | 15 | 13 PASS |
| stage D head (3 runs) | 98.5–103.1 | 83.1–86.9 | 83.3–84.7 | 35,863, 112.3–115.0 | 12 | 12 PASS |

- **First find:** about 60 ms above head, not about head's. Run 3 (all blocks laid out by +5.2 s)
  also gave 155 ms, so the remaining gap is not blocks left out. It is **not established** what it
  is (no trace of these calls, see below). Both runs are within the spec's bounds for head: twice
  head is about 200 ms, and head + 150 is about 250 ms.
- **Unchanged:**
  - `veil-none-rendered`: 0 leaks in 144–145 samples and every ux frame.
  - `veil-effective`: 584 veiled before completion, with 6.9–7.4 ms forced in the completion
    frame.
  - The completion frame: 626.2 and 686.0 ms. Stage D's veil2 was 679.0–754.2 ms.
  - Select-all unveiled nothing: 504/504 and 502/502 veiled before and after.
- **Long frames from +1 s to the LoAF window's end (+7.2–7.3 s):**
  - Frames of 50 ms or more: 5 and 4, against stage D veil2's 1–3.
  - Blocking: 23.0 and 22.8 ms, against stage D veil2's 6.5–32.2 ms and head's 36.8–43.7 ms.
  - Longest frame: 69.9 and 98.0 ms, against veil2's 64.0–76.5 ms.
  - Three of these frames (+2.3, +2.5 and +5.6 s) carry 31–33 ms of forced layout in the sampler's
    after-paint read (`MessagePort.onmessage`, attributed `other`). That is most likely the
    sampler's read meeting blocks that pre-layout or a font change left dirty. It is not
    established, because Butter's isolated-world scripts never appear in the LoAF attribution.
  - No frame reaches 100 ms.

## Not established, and caveats

- **The traced run failed its purpose.** `veil2dbg-trace-1` traced 104.5–124.5 s after Enter, with
  invalidation tracking. Tracing during the completion task stretched it to 27.7 s, so completion
  came at 132.8 s and the trace ended before it. The trace has no pre-layout or find events, and it
  was not used. Its counters agree with run 2's: 74 of 565 blocks laid out before the find, and a
  first find of 895 ms. So view (b), the trace of the first find's layout with the fix, was not
  taken. The ~60 ms left above head is not split.
- **Two fixed runs and one short-sampler run.** Head was not re-run here. Its numbers are stage D's,
  from the same lab, fixture and probe, a day earlier.
- **50 ms is a choice, not a measurement.** On a page busy every frame, the whole pass (about 160
  chunks live, including the font passes) takes about 8–10 s at one chunk per 50 ms. A longer
  timeout spreads the work thinner but finishes later.

Raw run JSON, logs and the unused trace stay local in
`~/.local/share/chatgpt-lab/captures/veil-accept/round2/prelayout-live/`. The dev-counter build is
`~/snap/chromium/common/veil-accept/veil2dbg` and the fixed build `.../veil2fix` (neither is in the
repo).

## Commands

Run from the worktree of `veil/prelayout-live`, based on `feat/implement-spec-170` at `5ca438f`.

- `B` is `~/.local/share/chatgpt-lab/bin`.
- `C` is `~/.local/share/chatgpt-lab/captures/veil-accept/round2/prelayout-live`.
- `D` is `~/snap/chromium/common/veil-accept`.

Times are UTC.

```sh
git merge-base --is-ancestor feat/implement-spec-170 HEAD && echo ANCESTOR-OK   # ANCESTOR-OK
git switch -c veil/prelayout-live
# builds: veil2dbg = $D/veil2 + dev counters in stream/offscreen.js (version_name +veilaccept.veil2dbg);
#         veil2fix = $D/veil2 + this branch's stream/offscreen.js (+veilaccept.veil2fix);
#         against `git archive HEAD extension`, veil2fix differs only in manifest.json and stream/offscreen.js
$B/lab-lock acquire --lab auto --needs-fixture ats12 --owner veil-prelayout-live --wait 3600 --perf
#   exit=0 lab=2 at 2026-11-26T01:01:28Z (queued behind veil-accept-r2-C2)
# each run (/tmp/plive/run.sh <build> <name> [env], kept local):
env LAB_ID=2 LAB_OWNER=veil-prelayout-live EXT=$D/<build>/butter LABEL=<name> FIXTURE=ats12 OUT=$C/<name>.json \
  PHASES=stream UX=u4 U4_FINDS=3 'OPTS={"rail":true,"bookmark":true}' TAIL_MS=30000 [env] \
  node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log 2>&1
#   1 veil2dbg-trace-1  TRACE_AT=114500 TRACE_SPAN=20000 TRACE_CATS=...invalidationTracking,...frame
#   2 veil2dbg-2
#   3 veil2dbg-short-3  UX_SAMPLE_MS=2000 U4_DELAY_MS=14500
#   4 veil2fix-4
#   5 veil2fix-5
$B/lab-restore --lab 2 --owner veil-prelayout-live
$B/lab-lock release --lab 2 --owner veil-prelayout-live
$B/lab-lock status
node plive-extract.mjs $C/{veil2dbg-trace-1,veil2dbg-2,veil2dbg-short-3,veil2fix-4,veil2fix-5}.json > runs.jsonl
npm run check   # exit 0; tests 987, pass 987, fail 0
```

```text
veil2dbg-trace-1 exit=0 255 s at 2026-11-26T01:05:48Z
veil2dbg-2 exit=0 220 s at 2026-11-26T01:10:54Z
veil2dbg-short-3 exit=0 223 s at 2026-11-26T01:14:37Z
veil2fix-4 exit=0 215 s at 2026-11-26T01:19:08Z
veil2fix-5 exit=0 215 s at 2026-11-26T01:22:43Z
restore exit=0 at 2026-11-26T01:23:00Z (browser restarted without extensions, "ok":true)
{"lab": 2, "lab_released": true, "perf_released": true}
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

There were 5 harness runs, and 21 min 32 s passed from lock to release. Each run printed 13 PASS
and 0 FAIL. The `*.log` files hold each run's verdict lines and its selected `REPORT` lines.

**Harness changes** (`lab/harness/stream-ux-probe.mjs`):

- `UX_SAMPLE_MS` sets the sampler's length, and `U4_DELAY_MS` the wait before u4.
- `out.enter` records Enter on the page clock.
- `dbgBefore` and `dbgAfterFirst` hold a dev build's counters, which the build writes to
  `<html data-butter-dbg>` only on a `butter-dbg-req` event. They are `null` on a release build.
