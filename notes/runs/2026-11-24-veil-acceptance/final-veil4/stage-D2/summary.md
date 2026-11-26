# Final veil4 acceptance, stage D2 (#177)

On 2026-11-26, lab 2 ran seven `ats12` trials under one performance lock,
from 22:32:57 to 22:57:47 UTC. Acquisition took 9 min 47 s. The trials
took 24 min 39 s and cleanup took 11 s, for 24 min 50 s under lock.
The driver, all seven harness invocations, restore and release exited 0.
[Commands and execution output](commands.md).

The frozen builds were veil4 (`004851d`), veil3 (`aed9523`) and main3
(`3b9c3d5`). All seven trials used `OPTS={"rail":true,"bookmark":true}`,
`PHASES=stream UX=u4 U4_FINDBAR=1` and the probe defaults. The keys went
to Chromium's real find bar. The probe typed a 19-character string in
block 429, with 100 ms per key and a 5,000 ms wait before Escape. Block
flags before Ctrl+F were 15 on both veil builds and 12 on main3. This was
a measurement stage.

## Frames drawn at opacity zero

- **veil4** — Zero frames counted with the matched block rendered in view
  at opacity zero across three runs and three before-paint samples, with
  flags 11 → 8 in all three.
- **veil3** — Zero frames counted across two runs and two before-paint
  samples, with flags 11 → 11 in both.
- **main3** — Zero frames counted across two runs and two before-paint
  samples, with flags 8 → 8 in both.

The expected nonzero veil3 count did not appear. The probe can identify
the first rendered-in-view frame using its frame-start geometry. For the
opacity-zero count, the **before-paint** sample must show an in-view,
rendered block at opacity zero.
Each veil3 run had one sample with flags 11 and a count of zero, so
the probe's in-view test at that sample was false. Flags 11 still show
that the block was rendered at opacity zero at the before-paint read.
[Find-bar probe](../../../../../lab/harness/stream-findbar-probe.mjs).

The three veil4 samples consistently show the opacity-zero flag
clearing in the first frame at this target. All seven runs gave a
before-paint report on that frame. The seven trials cover one target
in one fixture, with one size-change sample per trial. They give
direct evidence for that frame and limited evidence about frequency
across matches or blocks whose rendered height equals their placeholder.
The earlier headless diagnosis showed a drawn blank frame on veil3.
[Headless report](../../final/find-frame/report.md).

## Per-run measurements

Times are in ms from Ctrl+F, except durations and the offset from the last
key. Flags 11 means held, veiled and at opacity zero, with content
rendered. Flags 8 means held, with the veil, opacity-zero and
skipped-content bits clear. First in view can be a prefix match.
Settled in view starts the final in-view sequence before Escape.
The settled drawn match is the first frame in that sequence whose
frame-start flags clear the veil, opacity-zero and skipped-content bits.
LoAF counts and blocking include entries starting from Ctrl+F to Escape
unless another interval is given.

| Run | First in view (flags) | In view, settled (flags) | First rendered in view | Flags start → before paint | Drawn at opacity 0 | Before-paint samples | Settled drawn match | vs last key | First scroll | Last scroll | LoAF frames | Blocking | Longest LoAF (at) | Blocking to match | Longest sampled frame | After Escape (blocking, longest) | Selection after Escape |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [veil4-ats12-findbar-1](veil4-ats12-findbar-1.log) | 1,321.7 (11) | 1,321.7 (11) | 1,321.7 | 11 → 8 | 0 | 1 | 1,411.2 | -691.0 | 713.7 | 1,792.2 | 17 | 8.6 | 114.7 (+1,228.3) | 8.6 | 119.7 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [veil3-ats12-findbar-1](veil3-ats12-findbar-1.log) | 1,315.7 (11) | 1,315.7 (11) | 1,315.7 | 11 → 11 | 0 | 1 | 1,407.3 | -695.2 | 715.4 | 1,793.5 | 17 | 7.0 | 113.7 (+1,221.8) | 7.0 | 119.5 | 0.0, 231.0 | Yes (19 chars, flags 0) |
| [main3-ats12-findbar-1](main3-ats12-findbar-1.log) | 1,314.6 (8) | 1,314.6 (8) | 1,314.6 | 8 → 8 | 0 | 1 | 1,314.6 | -788.3 | 722.7 | 1,778.3 | 17 | 9.7 | 111.8 (+1,222.5) | 9.7 | 116.0 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [veil4-ats12-findbar-2](veil4-ats12-findbar-2.log) | 1,324.1 (11) | 1,890.5 (8) | 1,324.1 | 11 → 8 | 0 | 1 | 1,890.5 | -212.1 | 716.9 | 1,890.5 | 17 | 10.8 | 113.9 (+1,231.9) | 10.8 | 118.4 | 0.0, 232.4 | Yes (19 chars, flags 0) |
| [veil3-ats12-findbar-2](veil3-ats12-findbar-2.log) | 1,340.4 (11) | 1,340.4 (11) | 1,340.4 | 11 → 11 | 0 | 1 | 1,429.9 | -673.0 | 715.5 | 1,874.9 | 17 | 8.2 | 115.7 (+836.1) | 8.2 | 121.7 | 0.0, 254.0 | Yes (19 chars, flags 0) |
| [main3-ats12-findbar-2](main3-ats12-findbar-2.log) | 1,324.1 (8) | 1,324.1 (8) | 1,324.1 | 8 → 8 | 0 | 1 | 1,324.1 | -779.4 | 719.2 | 1,787.4 | 17 | 7.3 | 122.7 (+836.0) | 7.3 | 132.3 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [veil4-ats12-findbar-3](veil4-ats12-findbar-3.log) | 1,320.8 (11) | 1,879.0 (8) | 1,320.8 | 11 → 8 | 0 | 1 | 1,879.0 | -223.4 | 713.4 | 1,879.0 | 17 | 9.5 | 116.9 (+1,225.1) | 9.5 | 121.1 | 0.0, 0.0 | Yes (19 chars, flags 0) |

### Settled drawn match by the old definition

Medians and observed ranges in ms.

| Build | Settled drawn match, current | Settled drawn match, prior D2 |
| --- | --- | --- |
| veil4 | 1,879.0 (1,411.2–1,890.5) | — |
| veil3 | 1,418.6 (1,407.3–1,429.9) | 1,438.1 (1,398.7–1,891.9) |
| main3 | 1,319.35 (1,314.6–1,324.1) | 1,323.6 (1,319.9–1,882.0) |

On veil4, the frame-start read sees flags 11 before the observer clears
them, so the old first-drawn read comes one frame later, by 89.5, 92.6 and
90.1 ms in these runs. The settled drawn time in veil4 runs 2 and 3 also
includes a later return to view. Their settled sequences started at
1,890.5 and 1,879.0 ms with flags 8 already clear of the veil. The prior
D2 columns use the same old definition. [Prior D2](../../final/stage-D2/summary.md).

## Harness verdicts and storage

| Run | PASS | FAIL | Exit | veil-none-rendered | veil-effective | Blocks veiled before completion | Stored opts before | Storage restored |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [veil4-ats12-findbar-1](veil4-ats12-findbar-1.log) | 13 | 0 | 0 | PASS | PASS (judged, 6.7 ms forced) | 567 | `null` | Yes |
| [veil3-ats12-findbar-1](veil3-ats12-findbar-1.log) | 13 | 0 | 0 | PASS | PASS (judged, 6.7 ms forced) | 567 | `null` | Yes |
| [main3-ats12-findbar-1](main3-ats12-findbar-1.log) | 12 | 0 | 0 | PASS | Not judged | 0 | `null` | Yes |
| [veil4-ats12-findbar-2](veil4-ats12-findbar-2.log) | 13 | 0 | 0 | PASS | PASS (judged, 6.3 ms forced) | 567 | `null` | Yes |
| [veil3-ats12-findbar-2](veil3-ats12-findbar-2.log) | 13 | 0 | 0 | PASS | PASS (judged, 7.2 ms forced) | 567 | `null` | Yes |
| [main3-ats12-findbar-2](main3-ats12-findbar-2.log) | 12 | 0 | 0 | PASS | Not judged | 0 | `null` | Yes |
| [veil4-ats12-findbar-3](veil4-ats12-findbar-3.log) | 13 | 0 | 0 | PASS | PASS (judged, 7.1 ms forced) | 567 | `null` | Yes |

There were 89 PASS lines and zero FAIL lines. No hydration row reported
a nonzero `leaks` count. The `storage before the run` lines all recorded
stored opts `null` and the supplied two-key opts. All seven runs reported
restoration with matching storage fingerprints. Each veil4 run reported
567 blocks veiled before completion, within the prior 565–567 range
and equal to the count in all prior D2 veil3 runs.

## Completion and pre-find observation

Medians and observed ranges in ms. Window LoAF blocking covers Enter
through the standard stream observation window, which ends 5 s after
completion.

| Build and round | Completion frame | Completion frame blocking | Window LoAF blocking |
| --- | --- | --- | --- |
| veil4 | 653.8 (636.9–667.0) | 603.1 (586.4–616.2) | 1,799.3 (1,688.5–2,000.4) |
| veil3 | 654.55 (623.6–685.5) | 603.85 (572.8–634.9) | 1,905.25 (1,682.2–2,128.3) |
| main3 | 2,004.85 (1,948.2–2,061.5) | 1,946.45 (1,896.9–1,996.0) | 6,894.4 (6,881.6–6,907.2) |
| veil3, prior D2 | 704.5 (643.9–729.7) | 644.6 (593.1–678.8) | 1,793.9 (1,736.3–1,830.6) |
| main3, prior D2 | 1,998.7 (1,920.4–2,163.3) | 1,947.6 (1,869.7–2,112.6) | 7,272.9 (7,082.5–7,516.0) |

Veil4's completion-frame duration, completion-frame blocking and window
blocking ranges overlap the veil3 ranges from both rounds. The current
veil3 spread contains each veil4 median, so these trials show no difference
beyond the observed spread. Each run held scrollTop at 9754 px on the
sampled pre-find series while scrollHeight changed once. The pre-layout
pass end time was unavailable from these captures. The frame list below
covers the standard stream observation window from `in_progress` gone
plus 1 s.

| Run | ScrollTop / scrollHeight after completion before Ctrl+F (px) | LoAF at least 50 ms from completion +1 s (start / duration / blocking, ms) |
| --- | --- | --- |
| [veil4-ats12-findbar-1](veil4-ats12-findbar-1.log) | 9754 / 95686 → 9754 / 95638 | +1,480.7 / 55.3 / 0.0, +1,874.5 / 64.6 / 7.0, +2,270.6 / 52.5 / 1.5, +2,506.2 / 51.4 / 0.5, +3,908.7 / 58.3 / 0.0, +4,163.4 / 55.4 / 0.0, +5,497.1 / 75.0 / 1.5, +5,726.8 / 61.7 / 0.0, +6,460.1 / 52.1 / 0.0 |
| [veil3-ats12-findbar-1](veil3-ats12-findbar-1.log) | 9754 / 95686 → 9754 / 95476 | +1,216.1 / 50.7 / 0.0, +1,860.6 / 61.6 / 4.7, +2,269.0 / 50.4 / 0.0, +2,515.3 / 50.8 / 0.0, +3,866.8 / 50.5 / 0.0, +4,359.4 / 54.1 / 0.0, +4,853.8 / 53.0 / 0.0, +5,522.7 / 51.3 / 0.3 |
| [main3-ats12-findbar-1](main3-ats12-findbar-1.log) | 9754 / 95686 → 9754 / 95638 | +1,463.9 / 330.5 / 17.4, +1,800.5 / 116.6 / 14.0, +6,349.1 / 67.9 / 15.1, +6,417.6 / 53.1 / 0.0, +6,956.5 / 59.3 / 0.0 |
| [veil4-ats12-findbar-2](veil4-ats12-findbar-2.log) | 9754 / 95686 → 9754 / 95570 | +1,839.8 / 60.5 / 3.7, +2,305.2 / 50.8 / 0.0, +2,553.3 / 51.5 / 0.8, +3,735.9 / 50.8 / 0.0, +3,830.0 / 51.2 / 0.0, +5,575.0 / 53.5 / 2.5 |
| [veil3-ats12-findbar-2](veil3-ats12-findbar-2.log) | 9754 / 95686 → 9754 / 95570 | +1,505.4 / 50.9 / 0.0, +1,898.0 / 69.6 / 12.9, +2,075.5 / 53.4 / 0.0, +2,281.6 / 55.7 / 4.6, +2,529.9 / 51.5 / 0.6, +5,510.5 / 75.3 / 0.0 |
| [main3-ats12-findbar-2](main3-ats12-findbar-2.log) | 9754 / 95686 → 9754 / 95476 | +1,390.5 / 327.2 / 15.6, +1,723.7 / 122.0 / 31.8, +1,950.8 / 55.4 / 0.0 |
| [veil4-ats12-findbar-3](veil4-ats12-findbar-3.log) | 9754 / 95686 → 9754 / 95476 | +1,466.6 / 51.5 / 0.0, +1,858.9 / 65.4 / 8.5, +2,332.3 / 53.2 / 0.0, +2,407.7 / 50.5 / 0.0, +2,593.6 / 52.4 / 1.4, +2,646.7 / 52.3 / 0.0, +2,899.9 / 52.8 / 0.0, +3,144.1 / 54.1 / 0.0, +6,455.4 / 50.7 / 0.0 |
