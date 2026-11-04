> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Drag + release: typing and readable after release — diagnosis

Branch `t3/drag-release` (from origin/main 37a2b45, alpha.11) was created in
`~/.t3/worktrees/butter/t3-6cf413cf`. It has **no commits**: every fix found changes visible
behaviour, so per the brief these are reported as options instead of implemented.

## Cause (traces: `traces/typing-a11diag-r2.json` CPU-profiled, `traces/typing-a11inv-r1.json` invalidation tracking)

After release, alpha.11 runs one main-thread task of about 5.2 s (traced). Inside it:

| Part | Time | Owner (stack) |
|---|---|---|
| Style recalc of 23,476 elements + layout of 30.8k objects, no JS on the stack | ~0.9 s | Blink lifecycle. Invalidation reason `DisplayLock`: removing the hold's `translateX(-100000px)` makes destination turn `…<id>` relevant again. 284 of its 653 answer blocks had never been rendered (no `data-butter-seen`), so they are styled, attached ("Added to layout") and laid out in full. |
| React commit, 4.06 s, of which a forced layout takes 3.1 s (34.0k → 124.0k layout objects) | ~4.1 s | ChatGPT `callback` (487481.js, scheduler) → `r:731863.js:43` reads `clientWidth` on a user-bubble text element. The read passes through Butter's hook `seek/layout-cache-main.js:1131` to the native getter. The virtualizer mounts 3 never-rendered neighbour turns (`<id>`, `<id>`, `<id>`, 66.5k DOM nodes), all off screen. |

CPU samples in the task: native `clientWidth` getter 3,135 ms, `(program)` 1,146 ms, ChatGPT JS 615 ms,
all Butter scripts about 25 ms self time (about 70 ms including the hook's `querySelectorAll`).

I found none of the following in the release task: restore/unrestore/measure batches, anchor or
correction loops (0 retargets, landing error 0 px), observer storms, or forced layouts by Butter in skipped turns.
History is not involved: the fixture serves the whole chat, and no older-page request occurs after release.

**In short**, the seek preview moves ChatGPT's first render of the destination area from the hold to
the moment of release, by design ("zero held mounts"), and ChatGPT does that render in one long
synchronous task. alpha9 pays the same kind of cost during the drag: the user's held frames reach a
p95 of 1.2–1.8 s.

### Harness caveat

The original harness awaits each CDP `mouseMoved`. On native/alpha9 those acks wait for the main
thread, so the "drag" took 8.3–14.6 s, and release happened only after most mounting had finished. That produced
alpha9's 0.3 s first-key figure. With wall-clock moves (`DRAG_NOWAIT=1`, release 2.1 s after press as
a user would), alpha9 also blocks the first key after release for about 2 s, and release → readable is 5.6 s.

## Results (lab2, n=3 per arm, arms interleaved, perf lock per run; median [range])

`ack` = original harness pacing; `nw` = wall-clock drag. alpha9 = `builds/alpha9`, a11 = `dist/butter-0.1.0-alpha.11.zip`.
No fixed build exists: see options.

| Metric | alpha9-ack | a11-ack | alpha9-nw | a11-nw |
|---|---|---|---|---|
| First key after drag release (ms) | 1201 [912–1228] n=3 | 5267 [5014–5335] n=3 | 2039 [1012–2074] n=3 | 5069 [5024–5273] n=3 |
| Dispatch delay p95, typing after release (ms) | 810 [596–833] n=3 | 4214 [4050–4267] n=3 | 962 [622–993] n=3 | 4088 [4046–4249] n=3 |
| Keydown → next frame p95, typing after release (ms) | 1041 [750–1067] n=3 | 5107 [4854–5172] n=3 | 1878 [852–1914] n=3 | 4909 [4864–5113] n=3 |
| Release → readable (ms) | 2119 [1268–2140] n=3 | 5904 [5655–5981] n=3 | 5621 [3381–5675] n=3 | 5706 [5668–5919] n=3 |
| Held-frame p95 (ms) | 1455 [1236–1839] n=3 | 30 [30–30] n=3 | 120 [31–121] n=3 | 30 [30–30] n=3 |
| Held-frame max (ms) | 2142 [1508–2156] n=3 | 332 [298–339] n=3 | 567 [112–574] n=3 | 334 [331–341] n=3 |
| Turns mounted while held | 4.0 [4.0–4.0] n=3 | 0.0 [0.0–0.0] n=3 | 1.0 [1.0–4.0] n=3 | 0.0 [0.0–0.0] n=3 |
| Empty preview frames while held | n/a | 0 [0–0] n=3 | n/a | 0 [0–0] n=3 |
| Landing error at destination (px) | n/a | 0 [0–0] n=3 | n/a | 0 [0–0] n=3 |
| First key, typing 4 s after the drag (ms) | 296 [294–306] n=3 | 294 [294–306] n=3 | 290 [272–309] n=3 | 296 [294–304] n=3 |
| Dispatch delay p95, typing 4 s after (ms) | 101 [92–125] n=3 | 48 [36–109] n=3 | 67 [51–107] n=3 | 105 [46–109] n=3 |
| Press → release, wall clock (ms) | 8933 [8348–10091] n=3 | 2457 [2439–2472] n=3 | 2097 [2095–2097] n=3 | 2103 [2103–2105] n=3 |

Readable: alpha.11 uses the extension's own reveal time (`__seekDump`), converted to wall-clock time from
the release. Native arms use a per-frame probe: real thread text painted between header and composer for 2 frames.
On alpha9-ack the native readable is low because the mounting had already happened during the slow drag.

## Options (each changes visible behaviour, so none is implemented)

1. **Skip never-rendered off-screen turns mounted after release.** Give them `content-visibility: auto`
   with an estimated `contain-intrinsic-size`, so the 3.1 s layout is skipped. Expected first key ≈ 1.5–2 s
   (A + React JS). Cost: those turns report placeholder heights to ChatGPT's virtualizer, so the thumb
   size and position, and content above the viewport, can shift when they later render. This breaks the documented
   "never skip before first render" rule (`stream/containment.css`).
2. **Reveal before ChatGPT mounts the neighbours** when the destination turn is already mounted: restore
   the real turns, reveal, then dispatch the destination scroll. Readable could drop to about 1 s in this
   scenario. First key is unchanged, because the mount still follows. Cost: drift from rows mounting above the destination
   happens after the reveal, so the post-release correction becomes visible.
3. **Mount during pauses in the hold** (thumb still for ~300 ms). Spreads the cost like native and leaves
   less after release. Cost: breaks "zero held mounts" and adds held-frame hitches.
4. **Accept** the cost and document it as a known trade-off. Fair comparison (wall-clock drag): alpha.11
   blocks typing after release for about 5 s against about 2 s on alpha9, and readable is about the same (5.7 s against 5.6 s). In
   exchange, the held drag is smooth (p95 30 ms against 120–1455 ms) and has no mounts.

A small non-behavioural change, trimming the `clientWidth` hook's per-read `querySelectorAll` loop,
would save at most about 70 ms. It was not worth a commit on its own.

## Files

- Harness: `harness/run2.mjs`, which adds a held-frame/mount/readable probe, `DRAG_NOWAIT`, `TRACE_LATE_MODE=cpu`
  and wall-clock release timing. Also `harness/probe-unlock.mjs`, `phase.sh` (perf), `phase-func.sh` (functional), `matrix.sh`.
- Analysis: `analysis/{tasks,inside,events,inval,cpu}.py`, `summarize.py`. Raw runs in `raw/`, traces in `traces/`.
