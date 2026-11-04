> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter remount-height experiment

Throwaway experiment; no tracked repository edits or real ChatGPT messages. The base was copied from `~/.t3/worktrees/butter/t3-f65a473d/extension`. Measured artifacts, source variants and exact deployed phase builds remain under this directory.

**Complete. Recommendation: do not ship these prototypes as the native-scrollbar fix.** A guarded block-height cache can act before React's forced layout and keeps streaming near control, but it still leaves roughly-second warm frames, multi-second cold misses, and blank content. No tracked source files changed and no real message was sent.

The best tested mechanism restores exact remembered turn/block fallback heights in a narrowly filtered page-world `clientWidth` getter **before calling the native getter**, without retaining more turns or generating per-block selectors. Warm fast worst-frame median falls from **2233 to 1133 ms**, and the median of each run's maximum forced Layout falls from **1321 to 166 ms**. Streaming blocking is **5459 vs 5647 ms** (observed 3.4% increase), with worst keys **402.6 vs 387.6 ms**. This answers “can the forced layout be made cheaper?” with yes; it does not achieve consistently responsive native dragging.

The exact best diagnostic build is extension-best/ (not archived), explicitly marked as rejected as a complete fix. The prototype getter source SHA-256 is `76708ea7377e852ef9f5aeab004e176be7883223e2770a73a1735733045e8727` in its drag, streaming and landing/memory phases. The source variants and phase build copies are retained for review.

## Results overview

Timing values are milliseconds; bracketed values are observed ranges, not confidence intervals. “Pruned” means deliberately unmeasured after a failure or attribution-only scope, never zero.

| Arm | Cold fast worst ms | Warm fast worst ms | Warm fast blank ms | Streaming blocking ms / worst key ms | Send / rail / memory | Decision |
|---|---:|---:|---:|---|---|---|
| control | 2417 [2300–4033] | 2233 [2217–3716] | 4950 [4000–5550] | 5459 [5187–5724] / 402.6 | three each | Control |
| turn | 2283 [2283–2283] | 2317 [2317–2317] | 3933 [3933–3933] | 5878 [5777–5973] / 370.2 | pruned | Multi-second remount stalls remain |
| generic | 1650 [1650–1650] | 867 [867–867] | 2150 [2150–2150] | pruned / pruned | pruned | Reject: severe height distortion |
| generic-inert | pruned | pruned | pruned | 6212 [6105–6557] / 428.3 | pruned | 22-rule selector-cost ablation only |
| hook | 983 [983–983] | 1433 [1433–1433] | 2800 [2800–2800] | pruned / pruned | pruned | Reject: stale cold heights; warm stall |
| hook-ready | 2267 [2267–2267] | 1100 [1100–1100] | 2600 [2600–2600] | pruned / pruned | pruned | Reject: cold stalls and blanks |
| read-hook | 1566 [1150–2450] | 1133 [1000–1283] | 2567 [1217–2700] | 5647 [3246–6325] / 387.6 | three each | Best diagnostic; residual second-scale stalls/blanking |
| defer-hook | 900 [900–900] | 1100 [1100–1100] | 1400 [1400–1400] | pruned / pruned | pruned | Reject: width forcing removed, ~second frames/blanking remain |

## Native scrollbar results

| Arm | State | Input | Runs | Worst frame ms | LoAF blocking ms | Blank ms | Forced layouts $>100$ ms: durations per run | Height range px | Backward steps $>100$ px |
|---|---|---|---:|---:|---:|---:|---|---|---|
| control | cold | fast | 3 | 2417 [2300–4033] | 3544 [3378–6162] | 1600 [650–3817] | 595, 1343; 1300, 1500, 1366; 609, 1411 | 309765–312999, 312992–312992, 312992–312992 | 0, 0, 1 |
| control | cold | slow | 3 | 2383 [2317–3966] | 10082 [9234–12874] | 8716 [8225–9250] | 662, 938, 1608, 1226, 1361, 2266, 1094; 687, 1058, 1658, 1173, 1314; 624, 1042, 756, 1473, 1862, 1212 | 312992–312992, 312992–312992, 309747–312992 | 2, 2, 1 |
| control | warm | fast | 3 | 2233 [2217–3716] | 4339 [3451–4995] | 4950 [4000–5550] | 1237, 1321; 639, 1308; 660, 1045, 1372 | 312992–312992, 312992–312992, 312992–312992 | 1, 4, 1 |
| control | warm | slow | 3 | 1817 [1750–2717] | 7788 [7664–10517] | 8483 [7650–9233] | 750, 1078, 969, 865, 1154; 748, 1100, 976, 1177, 2208, 1105; 778, 1120, 993, 861, 1179 | 312992–312992, 312992–312992, 312992–312992 | 0, 2, 0 |
| defer-hook | cold | fast | 1 | 900 | 1480 | 967 | 120 | 312992–312992 | 1 |
| defer-hook | warm | fast | 1 | 1100 | 1952 | 1400 | 112, 151 | 312992–312992 | 0 |
| generic | cold | fast | 1 | 1650 | 2520 | 3033 | 214, 240, 151 | 309747–332116 | 4 |
| generic | warm | fast | 1 | 867 | 2046 | 2150 | 129, 155 | 576486–616154 | 2 |
| hook | cold | fast | 1 | 983 | 1710 | 2150 | 185, 146 | 307392–307392 | 1 |
| hook | warm | fast | 1 | 1433 | 2208 | 2800 | 170, 132, 149 | 312992–312992 | 0 |
| hook-ready | cold | fast | 1 | 2267 | 4135 | 4716 | 821, 948, 107 | 309747–312992 | 1 |
| hook-ready | warm | fast | 1 | 1100 | 1916 | 2600 | 173, 156 | 312992–312992 | 1 |
| read-hook | cold | fast | 3 | 1566 [1150–2450] | 2219 [1938–5266] | 2633 [2483–3450] | 125, 158; 160, 1059, 1744; 173, 137, 190 | 312992–312992, 309765–312992, 312992–312992 | 0, 4, 1 |
| read-hook | cold | slow | 3 | 850 [800–867] | 5686 [4952–6577] | 9300 [8816–10333] | 183, 179, 152, 166, 124, 243, 241, 130, 170, 134, 183; 184, 215, 240, 183, 187; 187, 220, 263, 158, 141, 187, 140, 184 | 312992–312992, 312992–312992, 312992–312992 | 4, 3, 3 |
| read-hook | warm | fast | 3 | 1133 [1000–1283] | 1794 [1764–2109] | 2567 [1217–2700] | 166, 154; 209, 154; 163, 148 | 312949–312992, 312992–312992, 312992–312992 | 0, 3, 1 |
| read-hook | warm | slow | 3 | 833 [783–850] | 4262 [4178–5353] | 7883 [7600–9050] | 169, 163, 267, 132, 132, 129, 141, 177, 139, 198; 172, 163, 257, 133, 187; 166, 157, 230, 101, 230, 180 | 312992–312992, 312992–312992, 312992–312992 | 3, 2, 2 |
| turn | cold | fast | 1 | 2283 | 3318 | 3750 | 587, 832, 102 | 309765–309785 | 2 |
| turn | warm | fast | 1 | 2317 | 3484 | 3933 | 644, 888, 104 | 312992–312992 | 0 |

## Streaming

| Arm | Runs | Median LoAF blocking ms [range] | Worst keypress ms | Answer/chunks |
|---|---:|---:|---:|---|
| control | 3 | 5459 [5187–5724] | 402.6 | 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d |
| defer-hook | 0 | pruned | pruned | unmeasured |
| generic | 0 | pruned | pruned | unmeasured |
| generic-inert | 3 | 6212 [6105–6557] | 428.3 | 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d |
| hook | 0 | pruned | pruned | unmeasured |
| hook-ready | 0 | pruned | pruned | unmeasured |
| read-hook | 3 | 5647 [3246–6325] | 387.6 | 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d |
| turn | 3 | 5878 [5777–5973] | 370.2 | 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d, 189/189, 043dc8afaf8d |

Fresh control blocking is 5459 ms; guarded read-hook 5647 ms (3.4% higher observed median), turn-only 5878 ms (7.7% higher), and the 22-rule generic inert ablation 6212 ms (13.8% higher). The hook worst key is 387.6 ms versus control 402.6 ms. Batched three-run ranges do not establish a general speedup or precise small overhead; they do rule out the tested multi-fold retention-style regression in this replay.


All completed replays deliver the original 189 chunks and exactly 21,448 answer characters, 420 KaTeX elements, SHA prefix `043dc8afaf8d`. The width-timing wrapper is disabled for streaming. Turn-only and generic rules are deliberately bounded; the inert generic arm preserves identical selectors with `outline-offset:0px`, isolating matching/invalidation cost from fallback geometry.

Warm drag tradeoffs (not archived)

Streaming cost (not archived)

## Send, history rail and memory

| Arm | Metric | Runs | Actual values |
|---|---|---:|---|
| control | usedSize MiB | 3 | 176.2, 177.41, 179.46 |
| control | embedderHeapUsedSize MiB | 3 | 187.45, 193.37, 196.24 |
| control | backingStorageSize MiB | 3 | 35.08, 35.1, 35.06 |
| read-hook | usedSize MiB | 3 | 189.2, 188.63, 181.79 |
| read-hook | embedderHeapUsedSize MiB | 3 | 195.05, 202.78, 194.93 |
| read-hook | backingStorageSize MiB | 3 | 35.12, 35.14, 35.07 |
| control | Send question top px | 3 | 315, 315, 272 |
| read-hook | Send question top px | 3 | 292, 292, 272 |
| control | First-question rail | 3 | [{'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}] |
| read-hook | First-question rail | 3 | [{'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}, {'turnTop': 64, 'questionTop': 116, 'pass': True}] |
| read-hook minus control | Median usedSize delta MiB | 3 each | +11.22 |
| read-hook minus control | Median embedderHeapUsedSize delta MiB | 3 each | +1.68 |
| read-hook minus control | Median backingStorageSize delta MiB | 3 each | +0.04 |

All six fail-closed sends completed the local replay and landed the new question visibly: control 272–315 px, guarded hook 272–292 px. Exactly one conversation response was intercepted per send; preparatory write attempts were blocked. All six rail clicks selected the actual first turn and aligned its wrapper to 64 px, with the question at 116 px and no busy state. The initial bubble-at-64 assertion was a harness error; it is archived separately and excluded.

GC-normalized median memory rises by **11.22 MiB JS heap**, **1.68 MiB embedder heap**, and **0.04 MiB backing storage**. Active DOM is the same 112,153 elements/five turns in all six memory probes; hidden instances remain five turns. Renderer-wide DOM counters are roughly 3.8k nodes higher in the prototype. This is a measured whole-renderer delta under the common protocol, not an allocator-only estimate for numeric cache entries, and no memory saving is claimed. The numeric cache itself serializes to about 42.5 kB (12 turns/5938 block slots); these captures do not isolate which allocations account for the larger renderer delta.

Before/after server snapshots are structurally identical, including node IDs, user IDs and current node (50 nodes/12 user messages). The original build/chat are restored with an empty composer after every phase; final restoration is independently verified.

## What can act before the forced layout

See [mechanism analysis](data/mechanisms.md), primary source excerpt (not archived), and extracted trace evidence (not archived).

- CSS matched synchronously on a fresh unseen turn: the turn-only capture records computed `content-visibility:auto` and cached intrinsic height while `data-butter-seen` is absent. The same ref still forces layout on offscreen descendants. In its warm screen, a 36,895 px turn far above the viewport forces an 888 ms native Layout, despite the rule. Turn-level skipping alone is insufficient.
- The insertion hook records restoration with `connected:false`, proving that inline heights were set before insertion and therefore before the subsequent React ref. MutationObserver alone cannot supply that timing. Its warm geometry is correct, but stale cold block heights and residual work prevent acceptance.
- The before-read hook restores the entire mounted window's cached blocks before invoking the native `clientWidth` getter. This retains original return values. Its native Layout events are substantially shorter, but DOM creation/removal, style, paint activation and uncached first layout remain.
- The deferred-ref arm is pinned to the exact current source call. The source attaches its ResizeObserver before reading width, and a nonpositive width short-circuits initial measurement. This is a diagnostic way to test deferral without delaying streaming measurements generally; it is not a supported extension API.

The final remount diagnostic returned to scrollTop 15000 inside the 33,919 px first turn with all 655 restored nonzero-height block styles still present; total chat height stayed 312,992 px. React did not overwrite those styles in this measured case.

A later observer callback cannot protect the initial in-commit measurement. Even a cache hit must restore block fallbacks before that read. An active 30k px turn cannot be cheaply handled by skipping only its outer turn.

## Pruning and coverage

Control and guarded read-hook have three runs for each cold/warm and fast/slow drag condition, three streaming replays, and three send/rail/memory probes. Turn-only CSS, generic-block CSS, insertion-v1, readiness-guarded insertion, and deferred-ref have cold/warm fast screens; remaining drag/landing/memory tests are pruned after the documented failures. Turn-only streaming still gets three replays because selector cost was explicitly requested. The rejected generic geometry arm is evaluated through three identical-selector inert replays for matching cost; its geometry-changing streaming is pruned. Exploratory read-hook screens are excluded from final three-run medians.

## Failure modes and limits

See [prototype limitations](data/prototype-limitations.md) and [measurement definitions](data/metric-definitions.md). Cold means fresh navigation/full pagination without full traversal, not no prior layout during setup. Cache readiness cannot turn unvisited block heights into known heights. Math typesetting and fonts can invalidate first measurements. Missing or mismatched message identity, block count or viewport width declines hook restoration. Same-window content-column changes still need stronger synchronous width protection; these prototypes are not production-ready.

Raw browser data and videos include account/chat UI and remain local. Shared software-composited lab, batched run order, small repeated samples, and hidden-copy variation limit generalization. Blank time is the existing screencast low-ink heuristic, not a compositor missing-tile count.

## Recommendation

**Do not build this into Butter as the complete drag fix.** The warm height-cache hit is real and streaming stays near control in this replay, but even full traversal leaves 1000–1283 ms frames and 1217–2700 ms blank content in fast dragging. Cold misses still force 1059/1744 ms layouts in one run. One of three warm fast runs made a 43 px height correction; the other warmed drag heights stayed fixed. Backward native scroll steps still occur in both arms and are tabulated rather than attributed solely to height changes. Cold fast blank median is worse (2633 vs 1600 ms); warm fast blank median improves (2567 vs 4950 ms), so no blanket blanking improvement is claimed. Slow blank medians remain 7883–9300 ms.

If revisiting the partial optimization, the promising seam is exact block-size restoration immediately before the first native measurement, using conversation + turn + assistant message + stable block identity, a synchronous exact content-width guard, completed/typeset samples and independent ordinary seen marking. Preserve native measurement on every unknown/mismatch. Improve the sparse cold collector and observer cleanup before treating it as a product candidate. The tested outer-turn-only sheet is insufficient, generic default block sizes corrupt geometry, and the source-pinned zero-width deferral still leaves about-second remount work while adding private-source risk.

A different mounting/painting strategy is still needed for the residual DOM commit/activation cost and cache misses. This experiment does not establish that every possible height cache is ineffective; it establishes that these tested mechanisms do not meet the complete goal.

## Media

- Aligned side-by-side MP4 (not archived): control warm fast repetition 2 versus guarded read-hook warm fast repetition 3, each the median worst-frame run of its arm. The actual native press is aligned with 300 ms pre-roll; captured frames are held by presentation timestamps at 60 fps.
- Control MP4 (not archived) and best diagnostic MP4 (not archived).
- Control contact sheet (not archived) and prototype contact sheet (not archived), visually inspected; both show the conversation blanking while surrounding UI stays drawn.

## Reproduction and artifacts

README (not archived) · commands and actual output (not archived) · [raw drag results](data/drag-results.json) · [raw streaming results](data/stream-results.json) · [cost results](data/cost-results.json).

`phase.sh` owns/restores the shared lab lock for every phase. `matrix.sh`, `stream.sh` and `extras.sh` run the copied schedules. Exact builds used are archived under `builds-used/`. The initial pathname-scoped turn screen and incomplete first streaming attempt are excluded. Exploratory read-hook captures are separate from the final guarded three-run matrix.
