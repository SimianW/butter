# Veil acceptance (#177, spec #170)

**Question.** Does the veil, as built for spec #170, cut the freeze at the end of a long streamed
answer on live ChatGPT without ever drawing a rendered block invisible, and what does it cost?

**Answer.** Yes on the first; one leak was found and fixed during the round; one cost remains.

- The completion frame's median falls from 1938 ms to 670 ms (`ats12`) and from 1864 ms to 637 ms
  (`math9`). Blocking over the stream falls by 78% and 65% in those two stages, and by 72–74% in
  the three other `ats12` stages of the round.
- The first final build (veil3) drew a block blank for one frame after a find in page. The fix is
  in the acceptance build (veil4), and the real find bar on live ChatGPT shows it works.
- The code that ships (veil5) is veil4 plus the review's fixes, which run only when a veiled block
  comes back into the page or is hidden in it. Stage A was run again on it: 676 ms
  against 1935 ms, blocking 75% lower, 567 blocks veiled in each run.
- A jump into the answer's middle in the first seconds after completion still shows the text about
  125 ms later than on `main` (3 blank frames on both builds). Once pre-layout has run, the
  difference is 4.5 ms.

Every stage was run by its own delegate under the lab lock (lab 2, `--perf`), with the control and
the veil build interleaved in one lock sequence. Each stage folder has `commands.md`, the stripped
logs and a `summary.md`. Raw captures stay in `~/.local/share/chatgpt-lab/captures/veil-accept/`.

## Builds and settings

| Build | Commit | What it is |
|---|---|---|
| main3 | `3b9c3d5` | The control: `main` at the point it was merged into the branch |
| veil3 | `aed9523` | The branch after the code-review fixes |
| veil4 | `004851d` | veil3 plus the find-frame fix; differs from veil3 only in `stream/offscreen.js`. The acceptance build: every gating stage ran on it |
| veil5 | `ece7cb4` | veil4 plus the review loop's fixes; differs from veil4 only in `stream/offscreen.js` (13 lines added, 4 removed). **This is what ships**; only stage A ran on it ([below](#after-the-round-the-reviews-fixes-and-the-confirmation-run)) |

main3 and veil4 differ only in `stream/offscreen.js`, `stream/containment.css`, `dev/allowlist.js`
and the manifest's `version_name`.

The control is not the spec's `547fa0a`: `main`'s #181 changed the defaults (Smoother scrolling is
now on only when stored as true), so the old control would have differed from the veil build in
that setting too. Every run sets its options in full:

- **default:** `OPTS={"rail":true,"bookmark":true}`, Smoother scrolling off, as shipped. All rules
  were judged here.
- **scroll:** the same plus `"older":true,"seek":true`, the state rounds 1 and 2 ran in.

## Results that gate: veil4 against main3

Medians of 3 runs per build unless said otherwise. A rule is about the veil build.

| Stage | What | main3 | veil4 | Rule | |
|---|---|---:|---:|---|---|
| [A](final-veil4/stage-A/summary.md) | `ats12` completion frame | 1937.9 ms | 670.1 ms | under 800 ms, none of 1 s or more (longest 683.4) | PASS |
| | `ats12` blocking over the stream | 7526.4 ms | 1651.5 ms | at least 50% below (78.1%) | PASS |
| [B](final-veil4/stage-B/summary.md) | `math9` completion frame | 1863.5 ms | 637.4 ms | under 800 ms, none of 1 s or more (longest 691.8) | PASS |
| | `math9` blocking over the stream | 9730.3 ms | 3442.6 ms | at least 50% below (64.6%) | PASS |
| | `math9` verdicts | | 2 of 3 runs all PASS | every veil run passes every verdict | see below |
| [C2](final-veil4/stage-C2/summary.md) | jump to the middle 2 s after completion: blank frames | 3 | 3 | no more than the control | PASS |
| | the same: blank time | 142.6 ms | 265.2 ms | not a rule | |
| [C3](final-veil4/stage-C3/summary.md) | jump to the end at completion: blank frames | 2 | 2 | no more than the control | PASS |
| | the same: jumps over 4 px after drawing, 16 s | 0, 0, 0 | 0, 0, 0 | 0 | PASS |
| [D](final-veil4/stage-D/summary.md) | `window.find`, 9 calls | 87.2 ms | 84.8 ms | within twice the control or + 150 ms | PASS |
| | first call of each run | 97.3 ms | 90.7 ms | not a rule | |
| | select-all | 35,863 chars | 35,863 chars | same length | PASS |
| [E](final-veil4/stage-E/summary.md) | wheel through the answer, 2 runs default + 2 scroll: wheel-step frames on a veiled block | | 0 of 480 steps | 0 | PASS |
| | the same: verdicts | | 14 PASS, 0 FAIL in each run | every verdict | PASS |

ChatGPT's completion `requestAnimationFrame` callback forces 6.8 ms of style and layout with veil4
against 1212.6 ms on main3 (stage A). 565 to 567 blocks are veiled just before completion in every
veil4 run, so `veil-effective` was judged, and passed, on all 22 veil4 runs of the round.

**The one failed verdict.** `veil4-math9-default-2` failed `veil-none-rendered` on one sample of
123, 4906 ms after Enter (`leaks` 1, `veiled` 1, `veiledNotAuto` 0, `unrendered` 0, `seen` 1,
`turnH` 460). A control run in [final stage B](final/stage-B/summary.md) failed on the same sample
with the same values at 4909 ms; that build has no veil and no opacity rule. At that moment the
turn is 460 px tall, so no block is below the fold to be skipped and veiled. The capture does not
record whether the flagged block carried the veil's attribute, so this is not proven: the verdict
cannot tell Butter's veil from ChatGPT's own opacity 0 ([#187](https://github.com/SimianW/butter/issues/187)).
The user accepted the stage on this evidence. Both cases are on `math9`; about 60 `ats12` runs
showed none.

## Measured, without a rule

| Stage | What | main3 | veil build |
|---|---|---:|---:|
| [A2](final/stage-A2/summary.md) (veil3) | `ats12` with Smoother scrolling on: completion frame | 1908.4 ms | 651.5 ms |
| | the same: blocking | 6392.5 ms | 1480.7 ms (76.8% below) |
| [C2b](final/stage-C2b/summary.md) (veil3) | jump to the middle 14 s after completion: blank time | 120.5 ms (2 runs) | 125.0 ms |
| [D2](final-veil4/stage-D2/summary.md) (veil4) | real find bar: longest frame, Ctrl+F to Escape | 111.8, 122.7 ms | 113.9–116.9 ms |
| | the same: blocking | 7.3, 9.7 ms | 8.6–10.8 ms |
| [L](final/stage-L/summary.md) (veil3) | reopened chat with a restored layout: answer blocks at opacity 0 | | 0 in 525 samples, 3 loads |

- **Smoother scrolling on or off** makes no difference that 3 runs can show: every difference
  between stage A and A2 is inside the runs' spread, on both builds.
- **The find bar in round 1** drew the match 1.39 s later with the veil and had one 896 ms frame.
  Both are gone: pre-layout does the held blocks' first layout before the find.
- **Stage L** needs `TRIGGER=1`: Butter's restore never runs by itself on today's ChatGPT, on
  `main` too ([#183](https://github.com/SimianW/butter/issues/183)). A2, C2b and L were not run
  again on veil4: A2 and C2b carry no rule, and an opened chat has no veiled block.

## The leak found in this round, and its fix

[final/find-frame/report.md](final/find-frame/report.md).

Final stage D2 on veil3 showed the matched block in view, no longer skipped and still veiled at a
frame's start. A headless reproduction confirmed that on veil3 a find, a selection, a focus or a
`scrollIntoView` in a held block can draw one frame with that block's text blank: the block
renders on the spot, the state-change event that unveils it is a queued task, and on a busy page a
frame runs first. The lab's verdict goes by that event and the probes sampled frame starts, so
neither could see it; the headless checks had no find, selection or focus step.

The fix: a veiled block is also watched for its height and unveiled in the frame its height leaves
the placeholder, after layout and before paint. On the real find bar, sampled before paint
([veil4 D2](final-veil4/stage-D2/summary.md)):

| Build | Runs | Matched block before paint |
|---|---:|---|
| veil4 | 3 | unveiled (flags 8) in all 3 |
| veil3 | 2 | still veiled, opacity 0, content rendered (flags 11) in both |
| main3 | 2 | no veil (flags 8) |

What this does not show: the probe's count of drawn blank frames was 0 on every build, veil3
included, because its in-view test before paint was false in those frames. So that the reader saw
a blank match on veil3 on live ChatGPT is shown only in the headless screenshots.

The fix did not cost the gain. veil4 against veil3, medians, each from its own lock sequence:

| Stage | Completion frame veil3 / veil4 | Blocking veil3 / veil4 |
|---|---:|---:|
| A | 664.4 / 670.1 ms | 1660.1 / 1651.5 ms |
| B | 641.6 / 637.4 ms | 3241.1 / 3442.6 ms |
| C2 | 676.4 / 679.9 ms | 1896.0 / 1759.8 ms |
| C3 | 671.1 / 682.3 ms | 1778.3 / 1842.5 ms |
| D | 642.1 / 639.1 ms | 1749.9 / 1970.1 ms |

Blocking is higher in three stages and lower in two, with no one direction. Only stage D's ranges
do not overlap (1709–1768 against 1777–2065 ms). A veil3 run inside veil4's stage A and stage E
sequences gave 1464.1 and 1808.8 ms, on either side of veil4's medians there (1651.5 and 1616.7).

## After the round: the review's fixes and the confirmation run

The review loop on the PR found three more paths on which a veiled block lost its height watch, one
after the other on the same code: a held block that leaves the page and comes back (also one
hidden with `display: none`, or re-attached in view), a veiled block that is not held yet and does
the same, and a block that does it before the watch's first report. The first two are fixed, each
with a test that fails without the fix (`test/stream-veil-activation-chromium.test.mjs`). The third
is limit 7 below. The fixes also made pre-layout's `Range` local, so its last block can be
collected.

No acceptance replay reaches this code: no block of a replayed answer leaves the page or is hidden.
So the user chose to confirm the shipping code with stage A alone and to keep veil4's results for
the other stages.

[Stage A on veil5](final-veil5/stage-A/summary.md): 3 main3 and 3 veil5 runs interleaved, then one
veil4 run, in one lock sequence. Every rule is met.

| | main3 | veil5 | Rule | |
|---|---:|---:|---|---|
| `ats12` completion frame, median | 1934.8 ms | 675.6 ms | under 800 ms, none of 1 s or more (longest 678.7) | PASS |
| `ats12` blocking over the stream, median | 6860.1 ms | 1683.2 ms | at least 50% below (75.5%) | PASS |
| Verdicts | | 13 PASS, 0 FAIL in each run | every verdict, `veil-effective` judged | PASS |
| Blocks veiled just before completion | 0 | 567, 567, 567 | | |
| Forced style and layout in ChatGPT's completion callback | 1213.4 ms | 6.8 ms | | |

veil5 against veil4's own stage A: completion frame 675.6 against 670.1 ms, blocking 1683.2 against
1651.5 ms. Both differences are smaller than either build's spread over 3 runs (completion frame 17
and 58 ms, blocking 110 and 780 ms).

**The veil4 run in this sequence was slow:** completion frame 867.9 ms, blocking 2156.8 ms. The
56 other veil-build runs of the final rounds range from 601.4 to 766.1 ms. It was the last of the 7
runs, and every part of its frame was longer by about the same share (the timer callback 805
against 626–641 ms, ChatGPT's callback 21.3 against 15.4–15.9 ms), with the same 567 blocks veiled
and all 13 verdicts passed. One run cannot say whether the lab was slower at that moment or
whether a veil build sometimes takes this long; the three veil5 runs before it do not show it. No
rule is about a single run under 1 s.

## Named limits

1. **A jump or a find in the first seconds after completion pays the deferred layout.** Stage C2:
   blank time 265.2 against 142.6 ms at 2 s; the KaTeX size fonts load 0.4 to 0.75 s after the
   jump. Pre-layout ends about 4 to 5 s after completion on an idle page and about 10 s on a page
   that draws every frame ([final C3](final/stage-C3/summary.md)'s traced run: 11.1 s). A find
   that early was not measured in the final round; without pre-layout the first `window.find` took
   931–948 ms against 96–104 ([round 1 stage D](stage-D/summary.md)), which bounds it.
2. **A tab hidden at completion.** Pre-layout waits until the tab shows, so limit 1 then counts
   from that moment. Covered by tests only.
3. **A block that renders at exactly its placeholder height** (120 px) gets no height report and
   falls back to the state-change event: the one blank frame after a find is still possible for
   it. How often ChatGPT has such a block is not known.
4. **A stale veil attribute turns the block's transitions off** until the next frame clears it.
   Deliberate (#176): it never changes opacity.
5. **The gain rests on one check in ChatGPT's telemetry.** If it goes, `veil-effective` fails and
   the completion frame is back near 1.9 s; nothing breaks.
6. **Placeholder heights are unchanged** (#131): 12 of 60 wheel-up steps shift the view by more
   than 4 px on veil4, 15 and 12 of 60 on main3 ([final D2](final/stage-D2/summary.md), part 2).
7. **A block that comes back rendered in its first frame as a veiled block** is drawn blank for one
   frame. The height watch takes the first height reported for a block as its placeholder. When a
   block leaves the page (or gets `display: none`) in the frame after it is veiled, before that
   first report, and comes back rendered and in view, its rendered height is taken for the
   placeholder, and the veil stays until the state-change event. Traced in synthetic pages only; no
   live run reached a remount of a veiled block, so how often ChatGPT does this is not known. The
   review's one open finding, shipped by the user's decision; cause and candidate fixes in
   [#188](https://github.com/SimianW/butter/issues/188).

## Open, not established

- **The find bar's "settled" time is about 1.3 s or about 1.9 s** after Ctrl+F on every build: in
  some runs the matched block leaves the view while the string is typed and returns with the last
  scroll. main3 1 of 5 runs late, veil3 1 of 5, veil4 2 of 3. Three runs cannot say whether veil4
  differs. Both times are before the last key (2.1 s).
- **One slow first find on veil3** (158.7 ms; the others 91.6 and 92.8) did not repeat on veil4
  (90.1–93.7).
- **main3's jump after a jump to the end:** a 162–188 px move at a frame's start in 5 of 6 control
  runs, drawn in 2 of them; the veil builds show none. Cause not looked for.
- **A ~300 ms frame with 0 ms blocking** after completion, with no script named, on both builds:
  about 0.1 s after it on veil3 and 1.3 to 1.5 s after it on main3 (final stages A, A2 and B).
- **The per-frame cost of the height watch** on a long live answer was not measured by itself;
  the table above is the evidence that it is small.
- **Lab state:** final stage L left the key `butterLayoutMigrated` in the veil3 build's storage
  (its put-back compares `butter` and `butterLayoutCleared` only). It shows in the later veil3
  anchor runs' `storage before the run` line; `opts` was `null` there as everywhere.

## How the round got here

| Round | Build | Outcome | Notes |
|---|---|---|---|
| 1 | `e5f480e`, the veil alone | A, B, C, C2, C3, E pass; **D fails** (`window.find` 245 against 85 ms) | [stage-A](stage-A/summary.md) [B](stage-B/summary.md) [C](stage-C/summary.md) [C2](stage-C2/summary.md) [C3](stage-C3/summary.md) [D](stage-D/summary.md) [D2](stage-D2/summary.md) [D3](stage-D3/summary.md) [E](stage-E/summary.md); cause in [u2-trace](u2-trace/report.md); the `isolation` fix that was not merged in [u2-reveal](u2-reveal/report.md) |
| 2 | `552b8db`, with pre-layout | D passes by its median, the first find still slow | [round2/stage-A](round2/stage-A/summary.md) [C2](round2/stage-C2/summary.md) [D](round2/stage-D/summary.md); the probe's frame sampler left pre-layout no idle time: [prelayout-live](round2/prelayout-live/report.md) |
| Final | veil3 `aed9523`, after the code review | every rule met; D2's data leads to the leak | [final/stage-A](final/stage-A/summary.md) [A2](final/stage-A2/summary.md) [B](final/stage-B/summary.md) [C2](final/stage-C2/summary.md) [C2b](final/stage-C2b/summary.md) [C3](final/stage-C3/summary.md) [D](final/stage-D/summary.md) [D2](final/stage-D2/summary.md) [E](final/stage-E/summary.md) [L](final/stage-L/summary.md) |
| Final, second build | veil4 `004851d` | the table at the top | [final-veil4/stage-A](final-veil4/stage-A/summary.md) [B](final-veil4/stage-B/summary.md) [C2](final-veil4/stage-C2/summary.md) [C3](final-veil4/stage-C3/summary.md) [D](final-veil4/stage-D/summary.md) [D2](final-veil4/stage-D2/summary.md) [E](final-veil4/stage-E/summary.md) |
| Confirmation | veil5 `ece7cb4`, after the review loop | stage A only: every rule met | [final-veil5/stage-A](final-veil5/stage-A/summary.md) |

The blocks the marker never queued (the first prototype's 19 blocks left at opacity 0) are
ChatGPT's height-0 `<hr>` elements: [2026-11-24-veil-unmarked](../2026-11-24-veil-unmarked/report.md) (#172).
The state paths the lab cannot run (Stop, Regenerate, Edit, version switch) are read through in
[2026-11-24-veil-state-paths](../2026-11-24-veil-state-paths/read-through.md) (#175).

## Caveats

- Three runs per build and stage. Medians are stable for the completion frame (spread under 100
  ms) and noisy for blocking: in veil4's stage A one pair of runs was high on both builds (11037
  and 2357 ms).
- Lab 2 renders in software. The times are for comparing builds in one sequence, not for a
  reader's machine.
- `veil-none-rendered` goes by the state-change event and by computed opacity alone: it cannot see
  a frame drawn before the event, and it cannot tell whose opacity it found (#187).
- The lab never sends a message: the answer is a recording replayed into a real chat.
- Stages B, C2, C3, D, D2 and E were not run on veil5. Their results are veil4's; the two builds
  differ in code those replays do not reach.
