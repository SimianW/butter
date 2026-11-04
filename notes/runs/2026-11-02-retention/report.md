> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter: active-chat retention and paint-ahead

**Complete. No tested arm made fast native scrollbar dragging consistently smooth while preserving control streaming responsiveness.** No tracked Butter files changed, no real message was sent, and the original browser/build/chat are restored with an empty composer and no lab lock.

Active-only all reduced the warmed fast-drag median worst frame from 2233 to 100 ms, but left 1133 ms of blank content and increased median streaming blocking from 5532 to 41310 ms (7.47 times). Removing the hidden-copy expansion did not recover streaming speed.

Commands and actual output (not archived) · [Method and limitations](data/methodology.md) · [Raw drag results](data/drag-results.json) · [Raw streaming results](data/stream-results.json) · [Raw expansion/memory/send results](data/cost-results.json)

## Results overview

All timing entries below are milliseconds; bracketed values are observed ranges, not confidence intervals. A dash means the field was deliberately pruned or the arm was an attribution-only probe; it never means zero. The detailed tables carry run counts, blank-frame counts, LoAF, forced-layout and memory values.

| Arm | Cold fast worst frame | Warm fast worst frame | Warm fast blank time | Streaming median blocking / worst key | Send landing median | Decision |
|---|---:|---:|---:|---|---:|---|
| Control | 3666 [1983–5100] | 2233 [2117–3700] | 3883 [1700–5516] | 5532 / 393.1 | 2523 | Control |
| Active overscan 3 | 3133 [2767–3167] | — | — | pruned | — | Fails fast remount goal |
| Active overscan 4 | 3667 [3666–5400] | — | — | pruned | — | Fails fast remount goal |
| Active overscan 6 | 1700 [1650–1833] | 400 [367–433] | 1367 [1233–1467] | 22209 / 618.1 | 2780 | Cold stalls; warm retains all; streaming regresses |
| Active-only all | 333 [267–350] | 100 [83–200] | 1133 [983–1200] | 41310 / 1056.3 | 1455 | Fails streaming |
| All + IO one screen | — | 267 [217–350] | 1417 [917–1467] | 37530 / 1023.7 | — | Fast blanks remain; streaming cost measured |
| All + IO three screens | — | 200 [167–200] | 1383 [1167–1433] | 42539 / 815.3 | — | Fast blanks remain; streaming cost measured |
| All + hold CV visible | 5033 [5000–5183] | 900 [900–917] | 0 [0–50] | 40404 / 824.8 | 1455 | Paint activation/release cost; streaming regresses |

### Coverage and pruning

| Arm group | Drag samples | Streaming | Send landing | Paired expansion/GC | Reason for omissions |
|---|---|---|---|---|---|
| Control; overscan six; active-only all; all + hold | Three per cold/warm and fast/slow state | Three each | Three each | Three each | Full surviving matrix |
| Overscan three and four | Three cold fast each | Pruned | Pruned | One each | Repeated multi-second fast failures |
| Original-budget IO one/three screens and hold | One warmed fast screen each | Pruned | Pruned | Not run | Still five/six remounts and multi-second forced layouts; exploratory screens only |
| Active-only all + IO one/three screens | Three warmed fast each | Three each | Pruned | Not run | Warmed fast blanking persists; streaming cost still quantified |
| Scoping helper at original budget | Attribution only | Three | Not run | Not run | Isolate helper overhead |
| Global overscan with bounded hidden window | Attribution only | Three | Not run | Not run | Not an expanded-hidden perturbation |
| Hidden initializer bypass | Excluded setup | One bounded-hidden replay | Not run | Not run | Did not expand hidden entries |
| Verified expanded hidden copy | Attribution only | Three verified | Not run | Not run | Quantify hidden-copy streaming contribution |
| Strict-six range replacement | No valid timing sample | Pruned | Pruned | Not run | Non-completing unstable setup; original browser restored |

Primary comparisons and every valid timing sample appear below. Fixed-anchor paired heap measurements are not inferred for pruned paint arms from tracing-heavy drag captures.

Streaming blocking medians and individual runs (not archived)

Warmed fast drag frame and blank-time tradeoffs (not archived)

## How much came from hidden copies?

The verified expanded-hidden arm had 12 hidden turns / 207315 elements and 12 active turns / 207410 elements before replay; after replay the document had about 442820 elements. The active-only arm had only three to five hidden turns and the same 207410 active elements before replay, ending near 297900 document elements. Every retained active answer hash matched.

Active-only all blocking: [36635, 52132, 41310] ms, median 41310. Verified expanded hidden: [40937, 42404, 37144] ms, median 40937. The observed median difference is -373 ms. Let $C$ be control, $A$ active-only all, and $G$ expanded-hidden median blocking. As a descriptive point estimate, that is -1.1% of the expanded-hidden excess over control:

$$ f_{\mathrm{hidden}} = \frac{G-A}{G-C}. $$

The ranges overlap; three sequential samples do not resolve a small hidden-copy effect. A signed point estimate is not an exact causal percentage. The decisive result is that the large active-chat regression remains with hidden copies bounded. Hidden DOM expansion is a memory/initialization problem, but it is not the main explanation for the repeated streaming slowdown measured here.

For historical orientation only, the prior B1 median was 43527 ms over a 5675 ms control. The new scoped excess is 35778 ms, versus the prior excess of 37852 ms: about 94.5% remains. That cross-session comparison cannot identify an exact historical fraction; cache state and run-to-run variance changed.

The ordinary global overscan patch did not reliably expand hidden windows in this session. It gave three bounded-hidden runs with essentially the active-only cost. A restored-window initializer bypass also failed to create the intended perturbation. Those attempts are labeled separately, not pooled into the verified hidden-copy comparison. The verified arm forces the final computed render range to all available entries and checks the actual hidden/active DOM before replay. Its third setup uses the original captured GET pages assembled into complete initial history, with equal active geometry/count required before measuring. Failed preconditions never enter the timing sample.

## Budgets and paint readiness

Overscan three and four failed three cold fast drags each: median worst frames 3133 and 3667 ms, with seconds of blank content. Their larger matrix and streaming/send probes were pruned after those failures; no claim about an unmeasured streaming effect is made. The single fixed-anchor expansion/GC probes remain in the cost table.

Overscan six was the best finite option in the cold screen, but still reached 1700 ms median worst frame and 3050 ms blank time. Warming it retained all 12 turns, because a covering rendered range is preserved; its faster warm results are not evidence of an evicting eight-turn cap. Its fresh streaming median was 22209 ms (4.01 times control). A strict-range experiment was unstable: setup did not complete for over three minutes, at seven active turns and high renderer CPU. It was stopped, restored and excluded; see [strict-rejection.md](data/strict-rejection.md).

No additional small pixel-budget arm was run. A few screens are much smaller than a single long answer in this chat, and the measured finite turn windows already fail when the native drag crosses their retained region. This does not rule out a different future geometry/mounting design; it explains why merely changing the nearby retention unit is not a demonstrated fix.

With all turns retained, IO paint-ahead at one and three screens still left warmed fast blank times of 1417 and 1383 ms. Their median streaming blocking was 37530 and 42539 ms. Neither tested margin eliminated fast blanking. Fast input moves about 5200 px per step, while the tested margins are about 912 and 2736 px and callbacks share the main thread.

Actual native hold-time CV removal left 0 ms median blank time in warm fast input, with 900 ms median worst frame. Per-run sample counts and cold/slow results are below. Cold fast input reached 5033 ms median worst frame while removing almost all blanks. It substantially changes paint readiness, but its enable/release cost must be counted; low blank time is not equivalent to smooth input. A representative cold-hold trace has about 4360 ms in one UpdateLayoutTree event and 216 ms total native Layout, with no turn mounts; the activation stall is primarily style work. Its ordinary streaming benchmark (hold inactive, wheel/typing input) still blocked 40404 ms. Streaming while continuously holding was not benchmarked, since the inactive variant already fails the streaming requirement; no favorable held-stream claim is made.

Paint-only variants with original overscan were exploratory screens: they still mounted five or six turns and paid multi-second forced layouts. They were pruned as standalone fixes. Original all+IO screen runs used a more expensive discovery scan; they are archived under `screen-v1-*` and excluded from final IO medians. Final IO tests observe inserted roots, matching Butter’s existing CV observer.

## Detailed drag results

Worst frame includes recovery after release. Blank counts are captured samples held by presentation timestamps, not a count of every display refresh. The forced-layout column counts native Layout events above 100 ms with a recorded JS forcing stack.

| Arm | State | Drag | Runs | Worst frame ms | LoAF blocking ms | Blank ms | Blank / captured frames | Forced layouts $>100$ ms | Max forced layout ms | New turn mounts |
|---|---|---|---:|---:|---:|---:|---|---|---:|---|
| a2 | cold | fast | 3 | 3666 [1983–5100] | 4813 [4125–6258] | 5216 [4583–6750] | 18 of 50, 19 of 38, 19 of 53 | 3, 3, 3 | 1375 [1330–2353] | 7, 6, 6 |
| a2 | cold | slow | 3 | 2400 [2333–3800] | 9297 [9183–10257] | 9300 [9200–9600] | 46 of 127, 44 of 120, 47 of 127 | 5, 6, 5 | 1636 [1587–1860] | 9, 9, 9 |
| a2 | warm | fast | 3 | 2233 [2117–3700] | 3360 [3282–4959] | 3883 [1700–5516] | 30 of 65, 27 of 58, 26 of 44 | 3, 2, 2 | 1355 [1326–1433] | 6, 5, 5 |
| a2 | warm | slow | 3 | 3066 [2866–3316] | 9270 [8705–9520] | 7600 [7400–11616] | 62 of 155, 55 of 164, 56 of 154 | 5, 6, 6 | 1596 [1337–1749] | 8, 8, 8 |
| a2-p1 | warm | fast | 1 | 2367 | 3486 | 1433 | 11 of 40 | 2 | 1384 | 5 |
| a2-p3 | warm | fast | 1 | 3416 | 5442 | 4067 | 16 of 47 | 2 | 2249 | 6 |
| a2-phold | warm | fast | 1 | 3050 | 6787 | 2050 | 1 of 42 | 2 | 2574 | 5 |
| a3 | cold | fast | 3 | 3133 [2767–3167] | 5488 [4958–7092] | 5366 [4250–5950] | 15 of 34, 19 of 37, 19 of 46 | 2, 2, 4 | 1936 [1823–1949] | 7, 7, 8 |
| a4 | cold | fast | 3 | 3667 [3666–5400] | 4716 [4615–6390] | 5016 [4916–6750] | 15 of 30, 11 of 29, 17 of 50 | 2, 2, 3 | 2486 [2049–2505] | 6, 6, 6 |
| a6 | cold | fast | 3 | 1700 [1650–1833] | 4097 [3628–4143] | 3050 [2867–4117] | 10 of 28, 16 of 38, 16 of 39 | 3, 3, 2 | 1188 [1141–1292] | 4, 4, 4 |
| a6 | cold | slow | 3 | 1500 [1500–1567] | 4086 [3973–4335] | 8033 [6666–8633] | 87 of 204, 87 of 220, 91 of 212 | 2, 2, 2 | 253 [238–258] | 4, 4, 4 |
| a6 | warm | fast | 3 | 400 [367–433] | 316 [288–372] | 1367 [1233–1467] | 45 of 76, 33 of 43, 55 of 83 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| a6 | warm | slow | 3 | 400 [133–417] | 494 [446–592] | 5917 [5416–6134] | 104 of 291, 108 of 288, 105 of 295 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall | cold | fast | 3 | 333 [267–350] | 627 [587–686] | 1267 [1067–1283] | 32 of 58, 22 of 54, 15 of 42 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall | cold | slow | 3 | 250 [233–867] | 1741 [1686–2743] | 7616 [6866–7716] | 106 of 267, 98 of 252, 109 of 273 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall | warm | fast | 3 | 100 [83–200] | 69 [42–167] | 1133 [983–1200] | 46 of 67, 58 of 70, 47 of 80 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall | warm | slow | 3 | 333 [100–400] | 44 [40–48] | 4933 [4716–5050] | 108 of 290, 105 of 286, 105 of 299 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall-p1 | warm | fast | 3 | 267 [217–350] | 299 [104–420] | 1417 [917–1467] | 31 of 43, 39 of 63, 32 of 61 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall-p3 | warm | fast | 3 | 200 [167–200] | 382 [339–432] | 1383 [1167–1433] | 29 of 50, 32 of 61, 34 of 40 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall-phold | cold | fast | 3 | 5033 [5000–5183] | 5177 [5120–5178] | 0 [0–33] | 0 of 64, 1 of 49, 0 of 64 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall-phold | cold | slow | 3 | 5000 [4933–5133] | 5011 [4940–5117] | 0 [0–0] | 0 of 194, 0 of 195, 0 of 194 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall-phold | warm | fast | 3 | 900 [900–917] | 1042 [999–1058] | 0 [0–50] | 1 of 38, 0 of 56, 0 of 66 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |
| aall-phold | warm | slow | 3 | 916 [900–917] | 916 [903–923] | 0 [0–0] | 0 of 218, 0 of 214, 0 of 182 | 0, 0, 0 | 0 [0–0] | 0, 0, 0 |

### Height corrections in otherwise complete history

These runs still had 12 entries before and after input. Their height changes are retained, not mislabeled as missing pages. Several cold estimates settle by about 3200 px; stable-history controls still reproduce the multi-second remount stalls. One genuinely incomplete six-entry warm-slow capture is archived under `invalid-incomplete-*` and replaced rather than pooled.

| Run | Height before px | Height after px | Observed minimum px | Observed maximum px |
|---|---:|---:|---:|---:|
| a2-cold-fast-r2 | 309747 | 312981 | 309747 | 312981 |
| a3-cold-fast-r2 | 309747 | 312992 | 309747 | 312992 |
| a3-cold-fast-r3 | 309747 | 312992 | 309747 | 312992 |
| a6-cold-fast-r1 | 309765 | 312999 | 309765 | 312999 |
| aall-cold-slow-r2 | 309765 | 312977 | 309756 | 312977 |

## Streaming results

Every valid streaming sample replays all 189 chunks and matches `043dc8afaf8d`. The scoping-helper overscan-two control measures its overhead separately. Failed hidden-expansion setups are diagnostic rows, not the expanded-hidden causal arm.

| Arm | Runs | Blocking per replay ms | Median blocking ms | Worst keypress ms | Document elements before / after | Hash |
|---|---:|---|---:|---:|---|---|
| Active-only overscan 6 | 3 | 21933, 22655, 22209 | 22209 | 618.1 | 183955 / 210994, 183955 / 210994, 183955 / 210994 | 043dc8afaf8d |
| Active-only all + IO 1 screen | 3 | 42856, 37105, 37530 | 37530 | 1023.7 | 270855 / 297894, 270858 / 297897, 270858 / 297897 | 043dc8afaf8d |
| Active-only all + IO 3 screens | 3 | 41413, 42620, 42539 | 42539 | 815.3 | 270854 / 297893, 270854 / 297893, 270854 / 297893 | 043dc8afaf8d |
| Active-only all + hold | 3 | 40404, 36660, 42436 | 40404 | 824.8 | 270855 / 297894, 270858 / 297897, 270855 / 297894 | 043dc8afaf8d |
| Active-only all | 3 | 36635, 52132, 41310 | 41310 | 1056.3 | 270857 / 297896, 274994 / 302033, 270853 / 297892 | 043dc8afaf8d |
| Control | 3 | 5693, 5532, 5427 | 5532 | 393.1 | 107665 / 134704, 107665 / 134704, 107664 / 134703 | 043dc8afaf8d |
| Initializer bypass (failed hidden expansion) | 1 | 40685 | 40685 | 922 | 270853 / 297892 | 043dc8afaf8d |
| Global overscan (hidden window bounded) | 3 | 41246, 41480, 38442 | 41246 | 1081.5 | 270853 / 297892, 270854 / 297893, 270857 / 297896 | 043dc8afaf8d |
| Verified expanded hidden copy | 3 | 40937, 42404, 37144 | 40937 | 857.3 | 415781 / 442820, 415781 / 442820, 415781 / 442820 | 043dc8afaf8d |
| Scoping helper, overscan 2 | 3 | 5580, 7418, 5503 | 5580 | 422.9 | 107668 / 134707, 107580 / 134619, 107664 / 134703 | 043dc8afaf8d |

## Expansion, retained memory and replayed send landing

Three paired expansion/GC probes per surviving arm use the same near-top anchor without an active trace. The measurements are after history load; a “cold drag” does not include this one-time preparation. GC DOM counters include React-retained detached nodes, so they need not grow exactly with connected elements. Visible element counts and heap values are reported alongside them. The fixed-anchor overscan-six memory result is not a warm global cap.

| Arm | Expansion runs | Expansion worst frame ms | Expansion LoAF blocking ms | Max expansion LoAF ms | Visible elements | GC DOM nodes | JS heap MiB | Embedder heap MiB | Send runs | Landing ms | User top px |
|---|---:|---:|---:|---:|---|---|---:|---:|---:|---:|---|
| a2 | 3 | 16.8 [16.8–16.8] | 0.0 [0.0–0.0] | 0.0 [0.0–0.0] | 112153.0 [112153.0–112153.0] | 366025.0 [366019.0–366028.0] | 178.1 [178.0–180.7] | 187.2 [187.0–188.0] | 3 | 2523.3 [2503.8–2882.0] | 272, 272, 272 |
| a3 | 1 | 16.8 (n=1) | 0.0 (n=1) | 0.0 (n=1) | 112153.0 (n=1) | 366025.0 (n=1) | 176.3 (n=1) | 187.7 (n=1) | 0 | — | — |
| a4 | 1 | 16.8 (n=1) | 0.0 (n=1) | 0.0 (n=1) | 112153.0 (n=1) | 366025.0 (n=1) | 176.6 (n=1) | 187.5 (n=1) | 0 | — | — |
| a6 | 3 | 1383.3 [1350.0–1399.9] | 1347.5 [1305.9–1351.0] | 1397.7 [1356.2–1401.2] | 145137.0 [145137.0–145137.0] | 366267.0 [366262.0–366270.0] | 186.9 [186.5–189.4] | 219.4 [215.9–221.1] | 3 | 2780.2 [2765.9–2818.6] | 272, 272, 272 |
| aall | 3 | 3566.6 [3516.5–3583.2] | 3620.6 [3560.7–3655.8] | 3562.1 [3506.8–3570.1] | 207410.0 [207410.0–207410.0] | 449336.0 [449336.0–456758.0] | 204.8 [204.7–206.5] | 294.3 [293.9–296.8] | 3 | 1454.7 [1444.0–1490.7] | 272, 272, 272 |
| aall-p1 | 0 | — | — | — | — | — | — | — | 0 | — | — |
| aall-p3 | 0 | — | — | — | — | — | — | — | 0 | — | — |
| aall-phold | 3 | 3600.0 [3499.8–3616.5] | 3639.9 [3549.3–3659.2] | 3587.1 [3495.3–3603.5] | 207410.0 [207410.0–207410.0] | 449338.0 [449333.0–449341.0] | 204.7 [204.7–206.8] | 294.5 [294.2–294.7] | 3 | 1455.1 [1417.7–1620.6] | 272, 272, 272 |

Send landing is trigger to last observed scroll before held generation; the new question must be in the viewport. Every valid probe intercepted exactly one local send and completed the replay. The page guard blocked auxiliary prepare POSTs, while a context firewall provided a second fail-closed boundary.

## Recommendation and patch mechanism

**Do not build or ship a scrollbar fix by raising overscan, keeping the active chat fully mounted, or lifting CV in a nearby band based on these results.** No tested arm satisfies both fast-drag smoothness and control-like streaming. Keep Butter’s streaming CV protection. Hold-time painting can reduce blanks, but it is not a complete smooth-scrollbar solution and should not be presented as one.

The next performance work should target the observed remount measurement path: ChatGPT’s collapsible-text commit ref forces layout by reading clientWidth. Stable content/width-scoped geometry or an upstream measurement/virtualizer seam is a more specific target than retaining the entire active DOM. This is a recommended next experiment, not a performance claim for unbuilt code; the earlier display-math cache alone already failed the worst-frame requirement.

If retention is pursued further, the prototype establishes the required boundary: controller-owned instances, a scroller captured only after commit, a WeakMap keyed by controller, fallback to two when missing/hidden, explicit eviction before a previously expanded instance becomes cached, and shape-checked fail-closed hooks into the private virtualizer. A global URL/constant is insufficient. Merely changing overscan does not enforce eviction, and naively removing its covering-range rule is unstable. The current CDP response interception is throwaway research code; Butter’s present MV3 content scripts do not provide a robust production response-rewriting mechanism.

For a future hold-only paint experiment, derive the actual native gutter from clientWidth/clientLeft and the scroller rectangle rather than shipping the probe’s fixed right-edge test. Restore on release, blur/cancellation and navigation; include newly mounted blocks while held. Preserve real intrinsic heights and verify streaming, send landing and release frames again.

## Videos and reproducibility

- Control, warmed fast: (not archived) (not archived).
- Active-only all, warmed fast: (not archived) (not archived).
- All with hold, warmed fast: (not archived) (not archived).
- All with hold, cold fast: (not archived) (not archived).

Clips are selected near the median worst frame for each matched warmed fast arm, not by maximum visual drama. Native timestamp reconstruction holds each captured JPEG until the next CDP presentation time. Raw frames and traces remain local.

Run the indexed per-arm commands only through the phase lock wrapper. `phase-fair.sh` restores the original build/chat on exit and yields the lock between phases. `patch.mjs`, `measure.mjs`, `expand-scoped.mjs`, `send.mjs`, `harness/bench.mjs`, `analyze.py`, `trace-analysis.py` and `film.py` are all throwaway code. `commands-and-output.md` links exact argv/environment, exit codes and original stdout/stderr; deliberate cancellations and excluded setups remain visible.

Final verification: 236 workspace files retain their original hashes; git status is empty. Before/after server snapshots have identical node IDs, user IDs and current node. Restored browser (not archived), server snapshot (not archived), workspace verification (not archived).

Limits: one software-composited Chromium lab, small sequential samples, capture/profiling overhead, heuristic blank classification, private-source hooks, and this 12-question math-heavy chat. No hardware-wide, statistical-significance, or production-extension compatibility claim is made.
