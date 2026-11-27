# Final veil acceptance, stage D2 and wheel control (#177)

Lab 2 ran eight `ats12` replays under one performance lock from 20:53:52
to 21:22:48 UTC on 2026-11-26. The acquire waited 32 min 49 s behind
stages A2 and C2b. The runs used 28 min 45 s and cleanup took 11 s,
for a total of 28 min 56 s under lock. Restore and release both exited 0.
[Commands and execution output](commands.md).

The frozen builds were main3 (`3b9c3d5`) and veil3 (`aed9523`).
All runs used `OPTS={"rail":true,"bookmark":true}` with Smoother scrolling
off. The two parts are measurements with no acceptance threshold.

## Part 1 · Browser find bar

Three main3 and three veil3 runs were interleaved. Each used `PHASES=stream
UX=u4 U4_FINDBAR=1`. The harness sent Ctrl+F, waited 300 ms, typed at the
default 100 ms per key and pressed Escape after the default 5,000 ms wait.
It used a 19-character string in block 429 for every run. The starting flags
were 12 on main3 and 15 on veil3.

Times are in ms from Ctrl+F unless labeled as durations. First in view can
record a prefix match. Settled in view is the first frame of the last in-view
sequence before Escape. Drawn is the first frame in that settled sequence
with the veil, opacity-zero and skipped-content flags all clear. Flags 8
means held. Flags 11 means held, veiled and at opacity zero. The blocking
and longest LoAF columns count entries by start time from Ctrl+F to Escape.
Blocking to match ends at the settled drawn match.

| Run | First in view (flags) | In view, settled (flags) | Drawn | vs last key | First scroll | Last scroll | LoAF frames | Blocking | Longest LoAF (at) | Blocking to match | Longest sampled frame | After Escape (blocking, longest) | Selection after Escape |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| [main3-ats12-findbar-1](main3-ats12-findbar-1.log) | 1,312.8 (8, unveiled) | 1,882.0 (8, unveiled) | 1,882.0 | −220.5 | 718.1 | 1,882.0 | 17 | 10.1 | 111.5 (+1,219.4) | 10.1 | 117.2 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [veil3-ats12-findbar-1](veil3-ats12-findbar-1.log) | 1,329.8 (11, veiled) | 1,891.9 (8, unveiled) | 1,891.9 | −210.8 | 717.7 | 1,891.9 | 17 | 10.7 | 112.6 (+1,235.9) | 10.7 | 121.0 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [main3-ats12-findbar-2](main3-ats12-findbar-2.log) | 1,323.6 (8, unveiled) | 1,323.6 (8, unveiled) | 1,323.6 | −779.7 | 720.8 | 1,782.9 | 17 | 11.2 | 112.3 (+838.8) | 11.2 | 117.9 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [veil3-ats12-findbar-2](veil3-ats12-findbar-2.log) | 1,343.3 (11, veiled) | 1,343.3 (11, veiled) | 1,438.1 | −664.7 | 729.2 | 1,897.7 | 17 | 14.1 | 113.4 (+851.4) | 14.1 | 118.9 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [main3-ats12-findbar-3](main3-ats12-findbar-3.log) | 1,319.9 (8, unveiled) | 1,319.9 (8, unveiled) | 1,319.9 | −782.6 | 721.1 | 1,795.9 | 17 | 9.8 | 113.4 (+1,224.6) | 9.8 | 119.9 | 0.0, 0.0 | Yes (19 chars, flags 0) |
| [veil3-ats12-findbar-3](veil3-ats12-findbar-3.log) | 1,311.3 (11, veiled) | 1,311.3 (11, veiled) | 1,398.7 | −704.1 | 713.5 | 1,787.5 | 17 | 7.4 | 112.3 (+1,218.3) | 7.4 | 118.2 | 0.0, 245.8 | Yes (19 chars, flags 0) |

### Per build

| Build | n | First in view | Settled in view | Drawn match | Last scroll | Blocking to Escape | Blocking to match | Longest LoAF | Longest LoAF start | Longest sampled frame | Match selected |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main3 | 3 | 1,319.9 (1,312.8–1,323.6) | 1,323.6 (1,319.9–1,882.0) | 1,323.6 (1,319.9–1,882.0) | 1,795.9 (1,782.9–1,882.0) | 10.1 (9.8–11.2) | 10.1 (9.8–11.2) | 112.3 (111.5–113.4) | +1,219.4 (+838.8–+1,224.6) | 117.9 (117.2–119.9) | 3/3 |
| veil3 | 3 | 1,329.8 (1,311.3–1,343.3) | 1,343.3 (1,311.3–1,891.9) | 1,438.1 (1,398.7–1,891.9) | 1,891.9 (1,787.5–1,897.7) | 10.7 (7.4–14.1) | 10.7 (7.4–14.1) | 112.6 (112.3–113.4) | +1,218.3 (+851.4–+1,235.9) | 118.9 (118.2–121.0) | 3/3 |

| Build | Drawn vs last key | First scroll | LoAF frames | After Escape blocking | After Escape longest |
|---|---:|---:|---:|---:|---:|
| main3 | −779.7 (−782.6–−220.5) | 720.8 (718.1–721.1) | 17 (17–17) | 0.0 (0.0–0.0) | 0.0 (0.0–0.0) |
| veil3 | −664.7 (−704.1–−210.8) | 717.7 (713.5–729.2) | 17 (17–17) | 0.0 (0.0–0.0) | 0.0 (0.0–245.8) |

### Round 1 and final round

| Round | Control drawn, median (range) | Veil drawn, median (range) | Veil − control drawn | Control longest LoAF, median (range) | Veil longest LoAF, median (range) | Veil − control longest |
| --- | --- | --- | --- | --- | --- | --- |
| Round 1 (head / veil) | 1,678.0 (1,361.9–1,881.0) | 3,069.5 (2,872.2–3,078.5) | +1,391.5 | 111.7 (111.1–125.2) | 896.3 (871.6–925.3) | +784.6 |
| Final (main3 / veil3) | 1,323.6 (1,319.9–1,882.0) | 1,438.1 (1,398.7–1,891.9) | +114.5 | 112.3 (111.5–113.4) | 112.6 (112.3–113.4) | +0.3 |

The long-frame gap closed in these runs and a 114.5 ms median drawn-match
gap remained, with three runs per build and overlapping draw ranges giving
limited confidence that the residual gap will repeat. Round 1 used earlier
builds and Smoother scrolling on. [Round 1 report](../../stage-D2/summary.md).

The block was veiled at first view in all three veil3 runs. It was still
veiled at the settled sample on runs 2 and 3. All six runs left the match
selected inside the block after Escape. One veil3 run recorded a 245.8 ms
LoAF starting 7,692.4 ms after Ctrl+F, after Escape, with 0 ms blocking.

## Part 2 · Wheel control

Both main3 runs used all phases and `VEILPROBE=1`. Counts cover shifts
whose absolute value exceeded 4 px, using the same extraction as Stage E.
The largest shift columns show absolute peaks. Each run had 60 wheel events
in each direction. One clamped down step per run is excluded from the
tracked denominator. `wheel-no-jump` checks whether scrollTop dropped by
more than a viewport while wheeling down.

| Run | Up shifts >4 px | Up signed range (px) | Largest up shift (px) | Down shifts >4 px | Down signed range (px) | Largest down shift (px) | wheel-no-jump |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [main3-ats12-all-default-1](main3-ats12-all-default-1.log) | 15/60 | −510 to +1,121 | 1,121 | 0/59 | — | 0 | PASS |
| [main3-ats12-all-default-2](main3-ats12-all-default-2.log) | 12/60 | −510 to +1,041 | 1,041 | 0/59 | — | 0 | PASS |
| [veil3-ats12-all-default-1](../stage-E/veil3-ats12-all-default-1.log) | 12/60 | −510 to +1,041 | 1,041 | 0/59 | — | 0 | PASS |
| [veil3-ats12-all-default-2](../stage-E/veil3-ats12-all-default-2.log) | 12/60 | −510 to +1,041 | 1,041 | 0/59 | — | 0 | PASS |

### Wheel control and Stage E

| Metric | main3 control (median and range) | veil3 Stage E default (median and range) |
| --- | --- | --- |
| Wheel up, steps over 4 px | 13.5 (12–15) | 12 (12–12) |
| Wheel up, largest absolute shift (px) | 1,081 (1,041–1,121) | 1,041 (1,041–1,041) |
| Wheel down, steps over 4 px | 0 (0–0) | 0 (0–0) |
| Wheel down, largest absolute shift (px) | 0 (0–0) | 0 (0–0) |

### Veil probe output

[main3-ats12-all-default-1](main3-ats12-all-default-1.log)

```text
REPORT veil probe, wheel phase (60 wheel events up, 60 down): frames sampled 1295 (point hits on an answer block 6241), frames with a tested point on a veiled or opacity-0 block 0, longest consecutive run 0, by step {}, veiled/op0 hits 0/0; frames with a rendered block at opacity 0 under a point 0 at the frame's start, 0 after drawing
REPORT veil probe, scrollTop write to the streamed answer's middle (46457 → 28306): frames sampled 30 (point hits on an answer block 150), frames with a tested point on a veiled or opacity-0 block 0, longest consecutive run 0, by step {}, veiled/op0 hits 0/0; frames with a rendered block at opacity 0 under a point 0 at the frame's start, 0 after drawing
```

[main3-ats12-all-default-2](main3-ats12-all-default-2.log)

```text
REPORT veil probe, wheel phase (60 wheel events up, 60 down): frames sampled 1284 (point hits on an answer block 6229), frames with a tested point on a veiled or opacity-0 block 0, longest consecutive run 0, by step {}, veiled/op0 hits 0/0; frames with a rendered block at opacity 0 under a point 0 at the frame's start, 0 after drawing
REPORT veil probe, scrollTop write to the streamed answer's middle (46457 → 28306): frames sampled 30 (point hits on an answer block 150), frames with a tested point on a veiled or opacity-0 block 0, longest consecutive run 0, by step {}, veiled/op0 hits 0/0; frames with a rendered block at opacity 0 under a point 0 at the frame's start, 0 after drawing
```

Both veil3 default runs matched the second control's wheel-up count and
peak, and the first control recorded three more shifts and an 80 px
higher peak. The wheel-down results matched across all four runs.
[Final Stage E report](../stage-E/summary.md).

Both main3 runs had zero veiled or opacity-zero frames anywhere in the wheel
phase. Stage E's two veil3 default runs had zero such frames on wheel steps
and two at the end jump before wheeling. Both builds reported zero rendered
opacity-zero point hits at frame start and after drawing.

## Harness verdicts and storage

| Run | PASS | FAIL | Exit | veil-none-rendered | veil-effective | Stored opts before | Storage restored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [main3-ats12-findbar-1](main3-ats12-findbar-1.log) | 12 | 0 | 0 | PASS | Not judged | `null` | Yes |
| [veil3-ats12-findbar-1](veil3-ats12-findbar-1.log) | 13 | 0 | 0 | PASS | PASS (judged) (7.5 ms forced) | `null` | Yes |
| [main3-ats12-findbar-2](main3-ats12-findbar-2.log) | 12 | 0 | 0 | PASS | Not judged | `null` | Yes |
| [veil3-ats12-findbar-2](veil3-ats12-findbar-2.log) | 13 | 0 | 0 | PASS | PASS (judged) (6.7 ms forced) | `null` | Yes |
| [main3-ats12-findbar-3](main3-ats12-findbar-3.log) | 12 | 0 | 0 | PASS | Not judged | `null` | Yes |
| [veil3-ats12-findbar-3](veil3-ats12-findbar-3.log) | 13 | 0 | 0 | PASS | PASS (judged) (6.4 ms forced) | `null` | Yes |
| [main3-ats12-all-default-1](main3-ats12-all-default-1.log) | 13 | 0 | 0 | PASS | Not judged | `null` | Yes |
| [main3-ats12-all-default-2](main3-ats12-all-default-2.log) | 13 | 0 | 0 | PASS | Not judged | `null` | Yes |

Every stripped run log had zero lines beginning with `FAIL`.

Each `storage before the run` line reported stored opts `null` and the
supplied two-key options. The stored snapshots were restored with matching
fingerprints. The three judged veil3 runs each counted 567 blocks veiled
before completion. There were 101 PASS lines and zero FAIL lines in total.

## Post-completion observation

The frozen harness recorded geometry and long frames. The pre-layout pass
end time is unavailable from these captures. The geometry column shows
distinct sampled states, from the find-bar mode's pre-find series or the
all-phases stream window. The LoAF column lists all entries of at least
50 ms starting at or after `in_progress` gone plus 1 s in the standard
stream observation window.

| Run | scrollTop / scrollHeight after completion before any interaction (px) | LoAF after in_progress gone +1 s (start / duration / blocking, ms) |
| --- | --- | --- |
| [main3-ats12-findbar-1](main3-ats12-findbar-1.log) | 9754 / 95686 → 9754 / 95638 | +1488.4 / 321.5 / 11.9, +1815.6 / 114.4 / 26.3, +4277.5 / 59.6 / 0.0, +4535.4 / 58.2 / 0.0 |
| [veil3-ats12-findbar-1](veil3-ats12-findbar-1.log) | 9754 / 95686 → 9754 / 95570 | +1788.6 / 66.1 / 9.2, +1854.9 / 52.1 / 0.0, +1968.2 / 58.3 / 0.0, +2213.5 / 90.7 / 0.0, +2537.4 / 54.8 / 4.0, +3939.9 / 56.6 / 0.0, +5451.2 / 52.3 / 1.5, +5774.3 / 50.5 / 0.0, +6021.8 / 53.8 / 0.0, +6272.1 / 50.4 / 0.0 |
| [main3-ats12-findbar-2](main3-ats12-findbar-2.log) | 9754 / 95686 → 9754 / 95638 | +1372.0 / 315.9 / 10.0, +1693.7 / 72.2 / 0.0, +1837.4 / 62.8 / 4.8, +2019.2 / 52.5 / 0.0 |
| [veil3-ats12-findbar-2](veil3-ats12-findbar-2.log) | 9754 / 95686 → 9754 / 95570 | +1493.6 / 53.6 / 0.0, +1770.5 / 50.7 / 0.0, +1826.1 / 74.6 / 3.6, +2269.3 / 51.6 / 0.7, +2505.0 / 55.3 / 3.6, +2651.4 / 59.0 / 0.0, +2907.7 / 51.4 / 0.0, +5500.7 / 76.2 / 1.5, +5739.4 / 52.2 / 0.0, +6461.0 / 51.2 / 0.0 |
| [main3-ats12-findbar-3](main3-ats12-findbar-3.log) | 9754 / 95686 → 9754 / 95570 | +1424.3 / 331.3 / 17.7, +1761.5 / 123.3 / 27.3, +2002.0 / 55.2 / 0.0 |
| [veil3-ats12-findbar-3](veil3-ats12-findbar-3.log) | 9754 / 95686 → 9754 / 95476 | +1859.0 / 93.1 / 12.5, +2245.4 / 73.6 / 0.0, +2511.5 / 73.4 / 0.0, +5013.0 / 53.9 / 0.0, +5278.7 / 50.7 / 0.0, +5538.3 / 76.0 / 0.0 |
| [main3-ats12-all-default-1](main3-ats12-all-default-1.log) | 9754 / 95638 | +1423.9 / 319.4 / 4.0 |
| [main3-ats12-all-default-2](main3-ats12-all-default-2.log) | 9754 / 95638 | +1340.7 / 310.7 / 0.0 |
