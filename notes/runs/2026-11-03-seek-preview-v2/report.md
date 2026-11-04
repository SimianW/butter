> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# F seek-preview v2: lab report

**Verdict: the warm path is ready for a Mac trial; never-seen destinations remain approximate and block productizing.** The completed matrix contains 48 runs. Fully loaded warm v2 matrix release-to-readable peaked at 1095 ms; the 1.5 s warm target passes every measured matrix run. Maximum sampled warm text-anchor error was 2 px. Genuinely cold destinations showed up to 28872 px of model landing error. 

**Verified — scope:** all prototype edits, builds, tests and new evidence are under `(not archived)`; the required Snap-readable lab copies are outside it. No tracked Butter files, commits, version sites, or releases were changed. The control is `origin/main` at `afbb1e3ea2eb8505e1b4fcad939c7cc252b439d4` (`0.1.0-alpha.10`): alpha.10 changes extension CSS, so alpha.9 was not reused as the current control. All 16 control files were compared byte for byte with that commit.

**Conditional — macOS:** the implementation accepts the real Mac event contract supplied by the user: direct scroller press in the final 15 px, subsequent held scroll, and page-visible release. Mac geometry is covered by unit fixtures. The measurements below are Linux Chromium with actual zero-gutter overlay mode, not measurements on macOS. The unpacked Mac build is a trial artifact, not a release.

## Results

**Verified — lab:** measurements were collected on 2026-11-02–03 ET / 2026-11-03 UTC, headed Chromium 156 on Linux, device scale 1. The normal lab window is 1600 by 1000 pixels. Overlay mode reserves no gutter; classic mode has a thin scrollbar and stable gutters at both edges.

Cells are the median of per-run values, followed by the minimum and maximum when they differ. Held-frame max is the maximum frame within the physical press/release window; the long frame crossing release is counted separately in raw `crossReleaseFrameMax`. Fast control work often spans release, so a small complete-held-frame maximum does not imply that the drag escaped the longer stall. Mount counts are added virtualized turn elements, not every React operation. Release timing starts at physical release submission, includes main-thread delivery delay, and ends when the real destination is mounted/math-ready and has three quiet frames. Screen latency uses captured binary preview stamps and input-position/time pairing; it is not a physical-display measurement.

| Arm | Bars | State / drag | Runs | Held mounts | Held p95 / max ms | Screen input p95 ms | Release readable ms | Release max task ms | Landing px | Sampled anchor max px |
|---|---|---|---:|---:|---|---|---|---|---|---|
| control | classic | warm / slow | 3 | 7 [5–7] | 83 / 1967 [1966–2433] | — | 1480 [1129–1723] | 1328 [1316–2319] | — | — |
| control | classic | warm / fast | 3 | 0 [0–1] | 100 [83–117] / 100 [83–117] | — | 3349 [2055–5122] | 1770 [1622–2113] | — | — |
| control | classic | cold / slow | 3 | 6 [5–6] | 183 [167–200] / 2150 [2150–2250] | — | 2428 [2211–3489] | 2497 [2399–3257] | — | — |
| control | classic | cold / fast | 3 | 0 [0–1] | 83 [67–100] / 83 [67–100] | — | 3028 [2778–3029] | 2067 [2027–2305] | — | — |
| control | overlay | warm / slow | 3 | 6 | 83 [83–133] / 2100 [1933–2883] | — | 1737 [433–1929] | 1432 [639–1659] | — | — |
| control | overlay | warm / fast | 3 | 1 [0–1] | 83 [83–117] / 83 [83–117] | — | 2467 [2369–4799] | 1971 [1887–2115] | — | — |
| control | overlay | cold / slow | 3 | 6 [6–7] | 200 [183–1117] / 2233 [2217–2666] | — | 2611 [2399–3604] | 2453 [2451–3317] | — | — |
| control | overlay | cold / fast | 3 | 1 [0–1] | 150 [133–150] / 150 [133–150] | — | 2798 [2728–3344] | 2005 [1943–2311] | — | — |
| v2 | classic | warm / slow | 3 | 0 | 17 / 250 [217–300] | 66 | 988 [946–1027] | 720 [704–830] | -2 | 2 |
| v2 | classic | warm / fast | 3 | 0 | 33 [17–33] / 267 [183–317] | 71 [65–71] | 861 [846–882] | 640 [631–647] | -2 | 2 |
| v2 | classic | cold / slow | 3 | 0 | 17 / 183 [167–633] | 66 [64–67] | 3345 [3306–3873] | 2757 [2747–3265] | -28872 | 3339 [2474–3595] |
| v2 | classic | cold / fast | 3 | 0 | 17 / 217 [150–217] | 70 [64–77] | 3103 [3000–3146] | 2519 [2442–2621] | -28872 | 3339 |
| v2 | overlay | warm / slow | 3 | 0 | 17 / 250 [200–383] | 71 [67–76] | 1030 [975–1095] | 715 [698–878] | -2 | 2 |
| v2 | overlay | warm / fast | 3 | 0 | 17 / 200 [183–200] | 65 [65–69] | 1006 [866–1049] | 750 [627–777] | -2 | 2 |
| v2 | overlay | cold / slow | 3 | 0 | 17 / 200 [167–217] | 66 [66–67] | 3383 [3373–3472] | 2795 [2788–2871] | -28872 | 3598 |
| v2 | overlay | cold / fast | 3 | 0 | 17 / 217 [183–217] | 65 [63–66] | 3227 [3068–3235] | 2653 [2522–2672] | -28872 | 3598 [3598–3750] |

**Verified — warm cache coverage:** every admitted warm v2 drag requires an authoritative positive-size record for every row before measurement. The harness aborts an incomplete warm pass. Coverage and per-restore hits are preserved in each raw run; a failed warm-up is not relabeled as a cold or successful warm measurement.

**Trade-off — cold method:** warm slow runs go from near the top to the bottom. A cold run starts at the initially mounted bottom and seeks into an earlier row that has never mounted in that document. Scrolling to the top first would visit rows and defeat this condition. The initial unknown row heights are estimates, so cold starting scroll height is much smaller than the fully measured chat. These cold cases are stricter than v1’s bottom-target “cold” cases, whose destination had already appeared during initial load. `everBefore`, the frozen destination index, and `destinationKnown` make this distinction auditable.

**Verified — final-build provenance:** the original 24 v2 matrix captures are retained under `runs/pre-release-fix/`, including the 90196 px failure. The main table uses fresh repetitions from the final release logic. Streaming ablations precede these release-only changes; those replays contain no seek session and never execute the changed path. Exact build snapshots and hashes are preserved.

### Historical v1 shift reference

These are the archived alpha.9 measurements, not newly measured alpha.10 cells. See [v1 report](../2026-11-02-seek-preview/report.md) for the complete table and raw runs. V1 overlay behavior was unsupported.

| Arm / bars / case | Runs | Held mounts | Held p95 / max ms | Screen preview p95 ms | Release readable ms | Release max task ms | Landing px | Text anchor px |
|---|---:|---:|---|---|---|---|---|---|
| v1 shift / classic / warm slow | 3 | 0 | 17 / 66 [33–217] | 67 | 1474 [1251–2719] | 1264 [1055–2394] | −2 [−2…41] | 432 |
| v1 shift / classic / warm fast | 3 | 0 | 17 [17–50] / 50 [50–267] | 67 [66–104] | 2733 [2643–2864] | 2397 [2339–2569] | −2 | 432 |
| v1 / overlay / any state or speed | 0 | — | — | — | — | — | — | unsupported |

V1’s separate cache-carrying cold-fast arm (3 runs, not the best shift arm) released in 552 / 554 / 2897 ms and had a 2941 px bad landing. It is kept as historical evidence rather than treated as a matched cold control for the stricter v2 cold protocol.

## Streaming attribution

Each arm replays the same 189 captured chunks with the original chunk schedule (121.8 seconds), using a local `Response`. Conversation writes fail closed at both fetch and request routing. The composer input is synthetic replay data; nothing is sent to ChatGPT.

| Arm | Replays | Median LoAF blocking ms [range] | Seen marks | Restored blocks | Final restored-but-unmarked blocks | Answer hashes |
|---|---:|---|---|---|---|---|
| control | 3 | 6143 [5531–6286] | 2048 [2046–2053] | 0 | 0 | 043dc8afaf8d |
| v2preview | 3 | 6099 [5704–6340] | 2046 [2041–2047] | 0 | 0 | 043dc8afaf8d |
| v2 | 3 | 6256 [4600–7304] | 2045 [1318–2049] | 258 [258–983] | 0 [0–725] | 043dc8afaf8d |
| v1cache | 3 | 3531 [3482–4282] | 1319 [1058–1323] | 982 | 725 | 043dc8afaf8d |

Full-v2 run detail makes the cache-dependent variation visible:

| Replay | LoAF blocking ms | Seen marks | Restored blocks | Restored but unmarked | Final marked blocks |
|---|---:|---:|---:|---:|---:|
| 1 | 7304 | 2049 | 258 | 0 | 2671 |
| 2 | 6256 | 2045 | 258 | 0 | 2671 |
| 3 | 4600 | 1318 | 983 | 725 | 1946 |

**Verified — accounting:** in the full-v2 hit run, 725 restored blocks remain unmarked, and the final marked-block count is exactly 725 lower than in the two miss runs. All three have the same 3405 final blocks and identical answer hashes. This accounts for the mark-count change without losing answer text. The old-cache-only arm independently reproduces the speedup. Its second replay ends with a different mounted window (8 turns versus the usual 10); therefore the observed cache benefit includes changes in skipped/rendered work and window geometry, not an isolated cost per mark write.

**Verified — measured ablation:** preview-only changes median blocking by -0.7% versus control. Full v2 changes it by +1.8%; the old cache alone changes it by -42.5%. There are no seek sessions during these ordinary streaming replays. The preview’s own cost and the cache’s effects are therefore measured separately.

**Conditional — explanation of v1’s seen-mark reduction:** the old cache explicitly applies inline `content-visibility:auto` and remembered intrinsic sizes before the normal `data-butter-seen` gate. An offscreen restored block can remain skipped without a new positive ResizeObserver report, so Butter does not write a second seen mark for every such remounted block. Fewer seen marks therefore do not mean missing streamed content. The cache-only arm, restored/unmarked counts, unchanged chunk count, final DOM/answer checks, and preview-only arm distinguish this mechanism from a speedup caused by the preview. The exact fraction of the time reduction attributable to mark writes rather than avoided style/layout remains unmeasured.

## Causal issue list

### 1. Overlay thumb detection

- **Where:** `src/seek-core.js` press classifier and activation machine; `src/seek-preview.js` capture listeners.
- **Trigger:** zero scrollbar gutter on macOS or lab overlay mode.
- **Consequence:** v1 returned early and never previewed.
- **Evidence:** user’s Mac direct-target press and release probe; Mac fixture tests; valid lab overlay runs require equal client/offset widths and a native scroller press.
- **Fix:** a trusted primary mouse press on the scroller within 15 px of the inline-end edge becomes a candidate; only a moving scroll while held activates it. Wheel/key input or changed selection rejects it. Classic native-thumb classification stays separate, including stable gutters on both edges. **Verified** for unit fixtures and lab; **Unverified** on the real Mac build until the user tries it.

### 2. Height cache misses after late block insertion

- **Where:** `src/height-cache.js` observer registration and recording.
- **Trigger:** a turn arrives before its answer blocks, or math changes those blocks later.
- **Consequence:** v1 retained zero/missing sizes; the partial v2 also registered too late, after an idle callback, and missed a turn’s first layout. Legitimate zero-content-height `<hr>` elements also vetoed otherwise usable snapshots.
- **Evidence:** resumed smoke coverage 1/12 with zero-block rejections; real-module regression tests fail against `src-resumed/`; current warm coverage is checked before every admitted drag.
- **Fix:** register blocks at insertion, refresh after resize/math/visibility changes, coalesce recording by frame, keep the last positive authoritative record, exclude decorative rules from size restoration while retaining their preview offsets, unobserve detached blocks, and retry restore until its checks pass. **Verified.**

### 3. Reading width before restoring forces the expensive layout first

- **Where:** the `clientWidth` restore hook in `src/height-cache.js`.
- **Trigger:** checking live scroller width while the remounted destination tree is dirty.
- **Consequence:** the supposedly protective hook forced the unprotected layout, producing 2.12–2.26 s warm releases despite 12/12 cache coverage.
- **Evidence:** `logs/restore-before-fix.txt` proves an extra native geometry read; the kept pre-fix run has a 1983 ms release task. The corrected smoke releases in 891 ms with 2 px text anchors.
- **Fix:** use the remembered scroller width in the hook and install all cached sizes before the original native getter runs. The real-module test asserts that ordering. **Verified.**

### 4. Preview-to-real alignment

- **Where:** measured-turn model and flattened preview items in `src/seek-core.js`, rendering and swap audit in `src/seek-preview.js`.
- **Trigger:** long mathematical answers make source-character fractions diverge from rendered layout.
- **Consequence:** v1’s known-position preview shifted by about 430 px at release.
- **Evidence:** warm text-anchor and block-top errors in the table and raw `swap` records; up to three sampled anchors where exact visible text runs exist.
- **Fix:** record real item offsets, heights, column positions and typography inside each measured row. Reuse those coordinates, gated by width and matching measured row height; correct known-row drift before revealing real content. **Verified** at measured anchors. **Trade-off:** formula source and rendered math naturally differ in appearance; sparse anchor samples do not prove every glyph or nested line is identical.

### 5. Never-seen geometry has no universal landing bound

- **Where:** estimated turns in `buildModel`, ChatGPT’s native virtualizer remeasurement, and release anchoring.
- **Trigger:** seek from the initially mounted last five rows into an earlier row that has never mounted.
- **Consequence:** real row heights replace small estimates; total scroll height and ChatGPT’s scroll anchoring change dramatically. Numeric model error can reach tens of thousands of pixels, and approximate source-text anchors can shift thousands.
- **Evidence:** `runs/check-cold-overlay.json`: height 94654 → 183628 px, frozen target row 6 never seen, landing error −28872 px, estimated text-anchor error 3598 px. Final repeated cold cases are in the results table.
- **Fix / bound:** known-row height drift can be corrected from real row geometry (tested for the v1 2936 px drift), but this is not a general bound for an unmeasured row or its within-row text. A strict bound would require prior measurement or a semantic text-anchor retarget after mount; the latter changes the native landing promise and can trigger an extra virtualizer commit. This prototype labels unseen preview regions `approximate` and does not pretend those trade-offs are solved. **Verified** failure; **Unverified** universal bound.

### 6. Cold release can coalesce a late application adjustment as if it were native thumb movement

- **Where:** the pending release coalescer in `src/seek-preview.js`.
- **Trigger:** an initially still-settling cold page grows and ChatGPT adjusts its scroll position before Butter dispatches its release commit.
- **Consequence:** the frozen destination is overwritten by an already-seen last row; this is a correctness failure, not an invalid benchmark sample.
- **Evidence:** `runs/pre-release-fix/v2-classic-cold-fast-r3.json`: held target was unseen row 6; after release the coalescer accepted a jump to 179550 px, chose row 11, and reported 90196 px landing error with no usable text anchors. The commit returned after about 3.35 seconds.
- **Fix:** shared release-state logic accepts final native motion within the frozen range and observed direction, freezes on an explicit history response, and rejects opposite/out-of-range application adjustments. The regression fixture replays the bad 3464 → 2038 → 179550 sequence and preserves 2038; it also proves that valid late native movement survives a sizing change. All 24 v2 matrix cases were remeasured after the release-state fix. A remaining cold case preserved its row but committed at the application-adjusted position; the final correction maps that row/offset into current geometry before dispatch. That case was retained as `cold-wait-before-commit-retarget.json` and repeated, and a real-browser injected late-scroll test verifies the new commit retarget and completed readiness. The other 23 matrix cases never entered this conditional path. **Verified** for the shared logic and measured cases; **Conditional** as an event-source heuristic, not a universal proof. A late reversal can favor the last accepted preview position, and unseen layout remains unbounded.

### 7. Harness false evidence

- **Where:** native scrollbar setup and warm/cold preparation.
- **Trigger:** the old one-pixel wheel nudge; pressing a Linux native endpoint area; allowing a cold setup scroll to auto-adjust while rows measure.
- **Consequence:** a script can appear to “drag” while the thumb never moved, or accidentally warm the target.
- **Evidence:** factorial capture/wheel probe in `runs/calibrate-overlay-warm.json`; excluded setup and pre-layout-width runs under `runs/invalid-*`; fail-closed logs.
- **Fix:** no wheel nudge, calibrated native press positions, assert native press and v2 session, stable warm starting position, and explicit never-mounted cold IDs. **Verified.** Continuous capture itself did not cause the overlay miss.

### 8. Loaded-history prefix changes can move every block inside the same measured row

- **Where:** release readiness and the measured-block swap audit in `src/seek-preview.js`.
- **Trigger:** older history is prepended, changing the formerly first row’s date/prefix.
- **Consequence:** correcting row-top drift alone still leaves a 99 px text jump.
- **Evidence:** the original overlay unloaded-history capture fails the 4 px anchor assertion with errors 99 / 99 / 99. Three corrected overlay captures reach 0 / 0 / 0; final classic repetitions are listed below.
- **Fix:** for a measured destination in a session that began with unloaded history, detect a shared visible-block offset and scroll the real page behind the preview once before revealing it. Require at least two matching block positions and no more than 2 px spread. **Verified** at the measured text anchors. **Trade-off:** preserving text can leave about 100 px of error against the old row-top coordinate because that row’s prefix changed.

### 9. Release lifecycle and private interfaces

- **Where:** capture-phase scroll suppression, native-event coalescing, offscreen shift, React-fiber geometry reader, and global `clientWidth` hook.
- **Trigger:** lost release/cancellation, navigation, rapid repeated drag, viewport change, or a ChatGPT DOM/fiber update.
- **Consequence:** stale preview ownership, stale geometry, or fallback behavior if private shapes change.
- **Evidence:** real-module state tests, lifecycle cases listed below, current exact-build snapshots and per-run timing dumps.
- **Fix:** one coalesced release commit, final-scroll update ownership, readiness checks, prior-session reveal invalidation, pointerup/mouseup/lost-button/cancel/blur/visibility/resize/path-change handling. **Verified** paths are identified in the edge evidence; real OS cancellation and Mac behavior remain **Unverified**. These hooks remain a productization risk.

## Edge cases and limits

### overlay

| Case | New sessions | End reason | Active / pending after |
|---|---:|---|---|
| no-motion-thumb-click | 0 | — | False / False |
| short-drag | 1 | pointerup | False / False |
| synthetic-pointercancel | 1 | pointercancel | False / False |
| synthetic-lost-up | 1 | lost-up | False / False |
| real-tab-focus-loss | 1 | pointerup | False / False |
| SPA-project-path-invalidation | 1 | chat-switch | False / False |
| native-track-click | 0 | — | False / False |
| wheel-keyboard | 0 | — | False / False |
| wheel-while-edge-button-down | 0 | — | False / False |
| edge-selection-drag | 0 | — | False / False |
### classic

| Case | New sessions | End reason | Active / pending after |
|---|---:|---|---|
| no-motion-thumb-click | 0 | — | False / False |
| short-drag | 1 | pointerup | False / False |
| synthetic-pointercancel | 1 | pointercancel | False / False |
| synthetic-lost-up | 1 | lost-up | False / False |
| real-tab-focus-loss | 1 | pointerup | False / False |
| SPA-project-path-invalidation | 1 | chat-switch | False / False |
| native-track-click | 0 | — | False / False |
| wheel-keyboard | 0 | — | False / False |
| wheel-while-edge-button-down | 0 | — | False / False |
| edge-selection-drag | 0 | — | False / False |

### Additional drag cases

| Case | Held mounts | Release readable ms | Landing px | Text-anchor max px |
|---|---:|---:|---:|---:|
| v2-classic-cold-fast-extra | 0 | 3072 | -28872 | 3339 |
| v2-classic-history-align-r1 | 0 | 1552 | 99 | 0 |
| v2-classic-history-align-r2 | 0 | 1780 | 66 | 0 |
| v2-classic-history-align-r3 | 0 | 1741 | 99 | 0 |
| v2-classic-injected-late-adjust | 0 | 3245 | -28872 | 3339 |
| v2-classic-unloaded-history | 0 | 1704 | 100 | 0 |
| v2-classic-warm-same | 0 | 100 | 0 | 0 |
| v2-classic-warm-short | 0 | 447 | 0 | 0 |
| v2-overlay-history-align-r1 | 0 | 1646 | 99 | 0 |
| v2-overlay-history-align-r2 | 0 | 1489 | 100 | 0 |
| v2-overlay-history-align-r3 | 0 | 1604 | 100 | 0 |
| v2-overlay-unloaded-history | 0 | 1454 | 0 | 99 |
| v2-overlay-warm-middle-r1 | 0 | 1141 | -1 | 1 |
| v2-overlay-warm-middle-r2 | 0 | 1126 | -1 | 1 |
| v2-overlay-warm-middle-r3 | 0 | 901 | -1 | 1 |
| v2-overlay-warm-same | 0 | 121 | 0 | 0 |
| v2-overlay-warm-short | 0 | 283 | 0 | 0 |

**Verified — streaming drag (one classic-bar replay):** 0 turn mounts while held; held-frame p95 16.8 ms, max 166.6 ms; physical release to readable 902 ms; landing -1.4 px. Final replay answer hash matches the other arms. **Unverified — live-answer preview text:** this destination had no recorded block layout or usable text anchors, so its visual/text swap is not proven. The current streamed answer can be an empty approximate preview because this prototype captures completed history, not every live token.

## Server integrity and fixture provenance

**Verified — qualified audit:** the old v1 server snapshot had 12 user messages; the later server has 13. Read-only inspection identifies one added two-character user node at `2026-11-03T02:23:38.018Z`, before the first resumed streaming replay at `02:35:12Z`. It matches none of the scripted replay prompts. The client that created it is unattributed; this report does not claim unchanged server state across that older baseline. The fresh baseline and final check both have 13 user IDs and the same current node. See `runs/server-extra-audit.json` and `runs/server-integrity.json`.

**Conditional — frozen fixture:** the measured active virtualizer is checked to contain the captured 12-row history, while the live server head has the extra message. All main arms use the same frozen API history. A rail count of 13 with 12 actual rows was observed; actual virtualizer entries are the readiness authority. An effect of this head/fixture mismatch on startup settling is possible but unverified. Cold/startup findings should not be generalized into an OS-level guarantee.

Additional same-position, short, middle, unloaded-history, and streaming-drag raw records live in `runs/`; the exact commands are in commands-and-output.md (not archived). Synthetic cancellation/lost-up tests establish handler behavior, not real OS delivery. The tab-switch harness may deliver pointerup rather than blur; its recorded reason is the evidence. Overlay native track clicks are not distinguishable from thumb movement solely by the required edge-plus-scroll activation contract and may briefly preview.

**Verified — memory lower bound:** the warm cache in `v2-classic-warm-slow-r3` contains 12 records, 5964 preview items and 129457 text code units (about 259 kB of UTF-16 payload). This excludes object overhead, stored source markdown, retained telemetry sessions and the live ChatGPT DOM; it is not a heap-size claim.

**Trade-off — activation:** zero turn mounts does not make setup free. Final warm runs still have an initial complete held frame of roughly 0.2–0.4 seconds in the worst samples; first-preview/style work needs further optimization. Fast control work can cross release and is excluded from the complete-held-frame column, so use the crossing-frame data when interpreting that comparison.

## Figures

Bars are medians and dots are individual runs. The held-frame figure includes only complete frames inside the physical hold interval.

Warm held-frame and release comparison (not archived)

Streaming cache/preview ablation (not archived)

## What still blocks productizing

- **Conditional:** actual Mac overlay drag/release validation, dark theme, project-chat URLs, and high-refresh/trackpad behavior. The supplied Mac event contract is implemented; it is not a substitute for running this build on that Mac.
- **Verified:** unseen-row estimates cannot support a general no-jump guarantee. Warm alignment and cold approximation must remain distinct.
- **Trade-off:** the release still has a synchronous ChatGPT mount task; the prototype hides the visual swap until real content settles, but cannot split ChatGPT’s task.
- **Conditional:** private selectors, row-container ancestry, React hooks and the page-world native getter hook need failure detection and a supported lifecycle before production.
- **Unverified:** other chats, media/tables, regenerated/branched messages, all viewport widths, actual OS cancellation, and exact glyph/line alignment inside every complex block.
- **Trade-off:** this is an in-memory, bounded turn cache and plain text preview; no persistent cache or product UI was added.

## Artifacts and reproduction

- Mac test zip (not archived)
- Unpacked extension (not archived)
- Chinese Mac instructions (not archived)
- [Per-run results](data/results.json)
- Commands and actual output (not archived)
- Unit tests (not archived) — run `node --test` from that directory.
- Control overlay slow MP4 (not archived)
- v2 overlay slow MP4 (not archived)

Every lab phase restores the original extension set (`butter-blank-head`), normal flags and original tab before releasing the shared lock. Final restoration and tracked-file integrity are recorded in the command log.
