> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter native-scrollbar research — 2026-11-01

**Complete.** Both worktrees are unchanged. The original `butter-blank-head` browser and tab are restored, composer empty, lab lock released, and before/after server snapshots are byte-identical.

The native drag reproduces the reported blank content and multi-second pauses. With history fully loaded, the primary cost is repeated creation and first layout of newly mounted math turns. The thumb-height problem has a separate pagination component: the fully loaded drag's height is stable; loading an older page changes it substantially.

## Scope and method

- Unmodified control is the current `t3-54326eed/extension/` (HEAD plus the authorized, uncommitted send pre-jump), frozen at `~/snap/chromium/common/butter-scrollbar-control`. No source checkout edits, commit, package or version change.
- Headed lab Chromium, software compositing, visible scroller 912 px high and 1238 px content width. All complete-history arms assert 12 rail questions and no earlier page remaining. API data is original server content, including captured successful older-history GET responses replayed during setup to avoid 429 responses.
- Scrollbar input is CDP `Input.dispatchMouseEvent`, mouse press on the actual native thumb at the scroller's right edge, 60 move events over a requested 1.2 s or 120 over 12 s, then release. Inputs are scheduled independently of main-thread completion. CDP acknowledgments can be delayed by the stall. `before/after.scrollTop` verifies the drag crossed the chat.
- The first attempted drag clicked the track below the minimum-size thumb. It moved only 11,970 px without remounts and is excluded under `invalid-track-click/`. Corrected drags start at the native minimum-sized thumb center, established from screencast pixels.
- rAF intervals (animation timestamps, not exact callback-entry wall times), Long Animation Frames (LoAF), CDP performance metrics, mutation-based turn identity events, ResizeObserver turn heights, page/virtualizer height writes and math insertions are recorded together. Traces include native style/layout forcing stacks, sampled JS and compositor events. Measurement scripts and probes are entirely under `(not archived)`.
- Frame percentiles have two windows: input start to CDP input completion, and input plus four-second recovery. A long frame that finishes after release can appear only in the latter. LoAF blocking time is summed `blockingDuration`, not total elapsed time. A single frame may overlap release.
- Screencasts use CDP JPEG at native size with each frame timestamp, encoded to 60 fps MP4 by holding each captured image until its next CDP timestamp. Blankness counts low-ink frames in a central content rectangle; clips/contact sheets were visually inspected. Partial-content counts are a heuristic, since ordinary whitespace can resemble incomplete rendering.
- Fake sends use a fail-closed fetch replay and a second browser-context network firewall. Captured SSE is remapped to local IDs; generation is held for 15 seconds during placement tests. No real user message is authorized or sent. Server snapshots compare node IDs, user IDs and current node.

## Part A: native drag diagnosis

### Frame times, LoAF and turn churn

The complete input-window frame, mount, memory and streaming tables are in [tables.md](data/tables.md). Raw per-event records are in the corresponding JSON files. Full-history fast input takes 2.60 s including CDP backlog and recovery after the requested 1.2 s motion; p50/p95/max while input is outstanding are 33.3/1983.3/1983.3 ms, and the maximum through recovery is 2233.2 ms. Slow input p50/p95/max are 16.7/166.7/2599.9 ms. The percentiles reflect sampled rAF intervals; sparse very long intervals can dominate the short active-input window.

### Main-thread attribution

`control-fast-trace-analysis.json` aligns the trace clock using the pointerdown EventTiming `processingStart` and EventDispatch timestamp. Over the capture it measures 16 native Layout events totaling **2842.7 ms** and 41 style recalculations totaling **309.0 ms**. The two largest layouts are **1363.3 ms** and **1182.5 ms**, both forced by ChatGPT's collapsible-text measurement ref (`r:396705...:43:527912`) under React commit refs (`o8`, `sc`, `s_`). This is the same call site established in the prior tail-layout investigation.

The largest LoAF entry paths are the native scroller `DIV.onscroll` and React scheduler `MessagePort.onmessage`. Their combined forced style/layout is **2569.5 ms**, with **1325.8 ms** remaining script duration. These entry paths identify the task that runs the React update; they do not mean all time is in the scroll listener itself.

CPU self-time sampled outside native style/layout includes **543.8 ms React JS**, **600.5 ms native DOM/runtime**, **150.4 ms other ChatGPT JS**, **62.3 ms GC**, and **4.0 ms Butter**. Idle and `(program)` samples are listed separately and are not credited as busy JS. React property application `ud` is **421.9 ms** sampled; `removeChild` is **453.5 ms**. Sampling is an attribution estimate, not an additive exact accounting of LoAF time.

The fast drag mounts six turns in two commits, delivered at **2390.0 ms** and **4733.4 ms** relative to trigger, removing seven turn identities. Mutation callbacks run after the synchronous commit; these times are delivery times, not the start of the expensive work. The slow drag mounts eleven and removes twelve in five batches (**4991.2, 6790.9, 9332.7, 11856.2, 14041.1 ms**), repeatedly paying first layout. It also thrashes: turns 9 and 10 are each mounted twice, and two rAF samples move backward by **25,266 px** and **41,279 px** during otherwise monotonic pointer motion. No page-height change accompanies either rollback. This is another way the thumb can appear to jump without changing its size; the data establish main/compositor scroll-position disagreement and delayed window commits, but do not isolate a unique Chromium-internal cause of the rollback. `slow-offsets.json` corroborates the first rollback: compositor thread 9 advances to 158,708.8 px at 5007.3 ms while main thread 1 still writes 102,485 px, then the compositor changes to 133,443.3 px at 5144.3 ms while the main thread still writes 158,709 px. These writes are Chrome trace offsets; they are not inferred from a perceived thumb movement. Wheel traversal does the same, at seven mount batches over 14.5 seconds. Local PageDown scrolling inside an already mounted 33,919 px first turn is smooth by comparison and causes no mount; it is not an equal-distance traversal. A second PageDown run does cross the full chat in **68.5 s**: **seven mounts, six unmounts**, **1483.2 ms** maximum frame and **7137.2 ms** LoAF blocking. Whole-run frame p95 is only **33.4 ms**, showing why a long traversal percentile alone can hide occasional remount freezes. These input schedules intentionally differ in speed; they do not establish a speed-normalized device comparison.

### What blank frames mean

The unmodified fast drag captures **20 blank frames of 48**, held for **4749.8 ms** by screencast timestamps; **4553.6 ms** of that overlaps LoAF intervals. The full-width sidebar/header/composer remain drawn, while the conversation area is white. This is consistent with the compositor scrolling through a virtualized or skipped region while the main thread has not supplied its new content.

The compositor traces expose `LayerTreeHostImpl::CalculateRenderPasses`: every sampled draw reports **zero `missing tiles`** in the control, all-mounted and pause variants. There are tile memory-policy warnings (4 control-fast, 14 warmed all-mounted), but those alone do not establish missing-tile checkerboarding. Calling all white frames “GPU checkerboarding” would be unsupported. The lab uses software compositing; the principal measured control blanking overlaps main-thread remount/layout stalls. The warmed all-mounted case has a separate residual blanking path with no turn mounts and much less LoAF overlap, investigated below.

### Height and thumb corrections

Across full-history fast, slow, wheel, local PageDown, all-mounted and pause drags, `scrollHeight` remains **312,992 px**, with **zero observed height changes**. Page height therefore does not explain those freezes or blank frames.

The intentionally incomplete-history topward drag begins at **91,858 / 92,770 px**, loads an earlier turn, and ends at **29,332 / 121,945 px**. rAF samples record **92,770 → 121,997 → 121,945 px**: **+29,227 px** on older-history insertion, then **−52 px** of measured geometry correction. The loaded answer's wrapper initially measures **29,215 px**, while an existing remounted turn's wrapper changes **34,920 → 34,868 px**. A new page also changes the position of previously visible turns, and ChatGPT's viewport-preserving compensation adjusts scroll position. A second independently instrumented run (`loading-detail.json`) starts with five rail questions, requests `num_turns=2` at **1386.5 ms**, receives the captured successful GET at **1394.5 ms**, then grows the virtualizer entries from five to six. It reproduces the same height sequence and **−52 px** correction. The duplicate/overlapping page contributes one new unique turn. The wrapper/total-height writes are delivered at **2673.9 ms**, after the expensive commit, and the final correction at **2732.1 ms**.

KaTeX is observed separately as DOM insertion rather than inferred from any height change: 254 KaTeX roots arrive with the newly mounted older answer in this loading capture. A later ResizeObserver batch accompanies the 52 px correction. This timing does not isolate that correction to math alone. In the fully loaded fast drag **1,075 KaTeX roots** are recreated while height stays exactly constant: remount typesetting is costly even when it causes no height drift. Thus the measured split is **29,227 px from page insertion**, **−52 px from measured-height correction**, and **no separately measurable late-KaTeX height drift**; the last category is not asserted to be universally zero. No independent late-math-only contribution to `scrollHeight` is established by these captures. The primary math-renderer source (`76629.5c22bcbf56.js`, module `rVvC`, copied excerpt in `math-renderer-source.txt`) asynchronously loads KaTeX, then synchronously calls `renderToString` and inserts its output via `dangerouslySetInnerHTML`. A cold module/suspense or font transition can therefore change geometry before final measurements; normal fully loaded remounts insert already rendered math markup. These observations do not justify assigning the 52 px correction solely to KaTeX.

The native thumb has a minimum pixel size on this long page. Proportional height would shrink as page height grows, but at these heights the minimum-size clamp can hide an actual size change. Position still changes because the mapping between pointer position, scrollTop and page range changes during insertion/compensation. Do not claim that all observed thumb-size changes in the user's recording are reproduced after full history has settled.

### Exact virtualizer behavior

Primary source: saved ChatGPT bundle `901075.5cc9ea5885.js`, module `if6d`; current runtime source captured as `runtime-virtualizer-original.js` (`901075.68278ebdf9.js`). The runtime experiment replaces exactly four occurrences of `overscanCount:2`; `patch.log` records this. `runtime-virtualizer-windowing.txt` extracts the current implementation.

- **Layout model:** `h()` builds turn keys, top offsets, bottom offsets, per-turn heights and total height. Height priority is measured height by key, then entry estimate, then **280 px**, constrained by a minimum. Default inter-turn gap is **12 px**. Geometry is rounded to the window zoom/device-pixel scale.
- **Window selection:** `m()` accepts distance from bottom and viewport height, binary-searches the turns intersecting that interval, then adds **two turns** before and after. Overscan is a turn count, so one viewport of math can mount roughly five turns spanning well over 100,000 px. It is not a fixed pixel buffer.
- **Retained window:** `v()` preserves the current range if it already contains the requested range. A slightly larger old window can persist; “always exactly five turns” would be wrong. Initial/restored state can anchor a prior range. Explicit retained-turn keys and programmatic `scrollToKey` targets can add turns outside the window.
- **Scroll signal:** the `lsfk` thread-scroll controller's `addScrollListener` drives `tX`, which calls `v()` and updates React state when the rendered range/key list changes. The controller attaches a passive native `scroll` listener directly to the scroller in `982651...js`; wheel/key handlers track user direction and pagination intent. Programmatic placement and height compensation can also notify this controller.
- **Viewport geometry:** first viewport reading uses scroller `clientHeight`, then caches it. A **ResizeObserver on the scroller** updates the cached viewport height from the observer entry and recomputes the window. Initial fallback is **800 px**; runtime captured state is **912 px**. Faking only `getBoundingClientRect` or `clientHeight` is not a complete or safe viewport override.
- **Turn measurements:** a shared ResizeObserver watches mounted turn elements; synchronous layout-effect reads of turn `getBoundingClientRect().height` also run during mount, with an eight-pass limit before yielding to rAF. These measurements replace estimates, set wrapper/total height and preserve a visible anchor/distance from bottom. Bounds reads of the virtualizer box and scroller's first child correct footer offsets. These callbacks can trigger additional React/layout work even if no native scroll event is delivered.
- **Estimate storage:** measured height records live in React `useState` (`ti`/`tc`) plus the mutable ref `tC.current`, keyed by turn key. Derived layouts live in refs (`tD`, `tK`, `tZ`) and memoized arrays/maps. `initialRestoreState.turnHeightsByKey` seeds the map; cleanup can publish `renderedWindow` and `turnHeightsByKey` via `onRestoreStateChange`. Runtime React-fiber snapshots in `pause-fast.json` and `all-warm-fast.json` confirm twelve measured keys and a 912 px viewport, with start/end indices **0/5** and **0/12** respectively.
- **IntersectionObserver:** this bundle contains it in the response-spacer/collapse helper, not in `if6d`'s turn-window selection. B2's actual ability to stop turn churn during the drag independently confirms the scroll-driven path.

## Part B: disposable experiments

### B1: keep turns mounted

The browser interception changes only `overscanCount:2` to `overscanCount:1000` in the current virtualizer bundle. It preserves the actual scroller and composer dimensions and leaves send placement code unchanged. All twelve turns remain mounted; the control retains about five.

The global prototype also expands hidden virtualizer instances: streaming setup contains 24 turns / 415,693 document elements before send, versus control 9 turns / 107,666 elements. The second all-mounted run instead finishes with 18 document turns / 297,893 elements, so hidden-copy retention is a material run-to-run confound. Visible-scroller counts are reported separately. This is a material limit on extrapolating the prototype to a future active-instance-only design.

Initial all-mounted fast sweep: **217 ms** maximum frame, **662.7 ms** LoAF blocking, zero turn mounts/unmounts. After deliberately traversing every viewport once (**19.1 s** setup traversal), the fast sweep has **167 ms** maximum frame, **162.6 ms** blocking, no mounts and stable height. This removes most multi-second work but does not guarantee an always-drawn viewport: the warmed clip still has **54/86 blank screencast samples**, **1283.3 ms** blank hold time, with only **226.5 ms** overlapping LoAFs. A content-visibility diagnostic follows.

The isolated expansion after history is already loaded mounts seven additional turns in one commit. Its LoAF is **4171.7 ms**, blocking **4121.4 ms**, and largest frame **4183.3 ms**. Visible-scroller DOM grows from 112,153 to 207,410 elements without changing height. This is the one-time mount bill moved out of the subsequent drag; it is not free pre-rendering. GC-normalized heap in that paired expansion rises from **187,367,892 to 217,609,100 bytes**, and embedder heap from **216,248,608 to 326,118,120 bytes**. Separate same-protocol reload memory measurements follow in the tables.

Staging overscan from 3 through 12 via `requestIdleCallback`, with 1.1-second gaps, mounts one extra turn in each of seven commits. Maximum LoAF falls to **1224.1 ms**, but the maximum rAF interval remains **1900 ms** and total LoAF blocking rises to **4504.4 ms**. Four long-answer mount steps each cost **807–1206 ms** driver wall time. Idle staging spreads the bill; it does not subdivide an individual React/KaTeX commit into frame-sized work or establish input responsiveness while idle preparation runs.

Far-up simulated send starts at 1900 px and lands the new question **272 px** below the scroller top, versus **292 px** for the control; both are visible within the 912 px viewport. Trigger to last scroll is **1588.1 ms** versus **3311.3 ms**, with maximum forced style/layout **560.7 ms** versus **1699.5 ms**. This is one run per variant and is not a statistically established send speedup. Both locally intercept exactly one conversation POST and complete only the recorded SSE.

### Residual blanking: content visibility control

A further disposable all-mounted arm forces `content-visibility: visible !important` on turns and answer blocks, then traverses the entire chat before the same fast drag. It records **zero blank or partial frames out of 63**, versus warmed all-mounted **54 blank / 86 samples**. Height remains **312,992 px**, mounts remain zero, and maximum frame is **200 ms**, with **213.4 ms** LoAF blocking. This isolates the visible symptom to rendering activation/skipping in this warmed all-mounted setting; eliminating long mounts alone is insufficient. It is not evidence of missing compositor tiles.

This disables an essential Butter optimization and prepaints much more content, so it is a diagnostic control rather than a production recommendation. It was not subjected to another streaming matrix; B1 already fails that matrix with skipping retained. The clip is `all-visible-fast.mp4`.

### Memory

After the same reload/full-history/forced-GC procedure, visible DOM is **112,153 → 207,410 elements** (five → twelve turns). JS heap is **182.4 → 209.1 MiB**, embedder heap **190.3 → 283.7 MiB**, and the same main renderer PID RSS **997,404 → 1,093,836 KiB**. RSS is observed process memory, not a per-feature allocator measurement; it includes renderer caches and prior high-water effects.

`Memory.getDOMCounters` reports control **4 documents / 373,412 nodes / 3,194 listeners**, all-mounted **4 / 366,700 / 3,072**. The global node count going down despite visible DOM increasing shows hidden/detached-history variation; it must not be presented as a memory saving. The within-document expansion above is the cleaner causal memory comparison and independently shows retained heap growth. These numbers are not promises for substantially longer chats.

### Streaming regression of B1

Three runs per arm replay the original 189-chunk, 122-second schedule using the adapted repository harness in the same browser session. All six complete every chunk and produce **21,448 characters, 420 KaTeX elements, SHA prefix `043dc8afaf8d`**.

Control blocking is **5.440–5.748 s**, median **5.675 s**. All-mounted blocking is **40.431–54.095 s**, median **43.527 s**, approximately **7.7 times** the control median. Frame p95 rises from **33.3 ms** in all controls to **133.3–183.3 ms**; slowest keys rise from **367.3–390.1 ms** to **793.7–971.7 ms**. Style time rises from **13.0–13.2%** to **36.8–46.1%**. This is a clear measured regression, not an acceptable trade for the drag improvement.

These are batched, non-randomized runs. The first all-mounted run retains twelve hidden turns while later runs retain five; even the smaller-DOM later runs regress severely. The experiment changes overscan globally, so it does not prove the same cost for a carefully scoped, bounded active-chat design.

### B2: defer scroll handling until pause

A page capture-phase listener calls `stopImmediatePropagation()` for native scroller `scroll` events while a fast drag is active. It does not cancel native scrolling. It releases one synthetic scroll after a 180 ms quiet period or mouse release. This suppresses the controller's direct native listener, so no turn-window updates run during active movement; ResizeObservers remain active.

The actual drag suppresses **37** scroll events and releases at **1296.0 ms**. One React window commit then mounts four tail turns and removes five old ones. Longest frame including recovery is **2383.3 ms**; total blocking is **2487.7 ms**. The active input window has a **100 ms** maximum frame, but the large release frame straddles the end of that window. The viewport is white over the unmounted middle. This exchanges repeated drag work for delayed content and a release freeze; it is not a satisfactory standalone fix.

## Optional display-math cache comparison

The extension from `t3-ae2c1476` was copied to a disposable snap-readable directory and tested after a browser restart. A full traversal warms the cache before the native fast drag. It records **2149.9 ms** maximum frame, **3094.3 ms** LoAF blocking, **five mounts / seven unmounts**, and constant **312,992 px** page height. The control capture has **2233.2 ms**, **4251.5 ms** blocking and **six / seven** mounts. This is one non-matched run after a restart with a different virtualizer path; it does not establish a 27% improvement or a statistically meaningful worst-frame gain. It does show that the display-math cache does **not** solve worst-case native drags alone. `cache-warm-fast.mp4` and its trace preserve the result. No new streaming claim for that build is made here.

## Recommendations

1. **Reduce fresh-remount geometry work while preserving true heights.** Use stable conversation/message/width-scoped geometry and keep ordinary seen marking independent. The optional display-math cache is a safe component to investigate, but its 2.15 s worst-frame result shows that caching display math alone is insufficient. The measured opportunity is the control's 2.84 s of native layout, dominated by two ref-forced remount layouts. React/DOM work remains, so a layout cache cannot promise completely smooth drags. Invalid widths, regenerated messages and unknown heights must retain the accurate first-render path; the earlier unconditional 120 px fallback experiment landed incorrectly.
2. **Explore a bounded active-chat retention budget**, rather than global keep-all. Limit it by DOM/height or memory, release hidden copies, and preserve only a useful nearby region. This is an unbuilt design direction: the all-mounted prototype demonstrates a 2.23 s to 0.17 s worst-frame opportunity after warm-up, but regresses streaming blocking about 7.7 times and needs a 4.17 s up-front mount. Idle staging still has 1.22 s LoAFs. Shipping it requires repeating both streaming and send-placement checks, not just a drag demo.
3. **Treat paint readiness separately from mount readiness.** A pre-rendered or retained nearby band may reduce the remaining content-visibility blanking; the all-visible diagnostic proves that mechanism in this chat. Avoid turning content visibility off globally: that removes Butter's streaming protection. Budget activation by real viewport distance and validate blank-frame hold time alongside frame metrics.
4. **Handle history loading as a distinct scrollbar-geometry problem.** A two-turn page request adds one unique 29k px answer here, changing the scroll range while the thumb is held. Preserve an explicit anchor and consider deferring/coalescing geometry compensation until the drag pauses. This would address thumb jumps, not eliminate the measured remount cost, and must retain a way to reach unloaded history.

**Reject B2 as a standalone user-facing fix:** it makes the thumb movement cheaper by presenting unloaded white space, then pays a 2.38 s release frame. **Reject unconditional B1 for production:** it is a useful upper-bound experiment with a clear streaming regression. Bundle interception is also tied to ChatGPT's private implementation and asset/module changes.

## Verification and restoration

`verification.json` confirms **478 recorded files across both worktrees have identical hashes**, no file changed, the tracked diff is byte-identical, and the lab lock is absent. The original browser runs `~/snap/chromium/common/butter-blank-head`; original tab is `<chat>`. Composer is empty; diagnostic probes, replay hooks, overscan override and fetch guard are absent. Server snapshots retain the same **50 node IDs, 12 user IDs, and current node**. No real message was sent.

Full source hashes and commit **9d6cad4fe890a8c523731ed20f261e754d966832** are in `source-sha256.json`. Frozen control/cache extension copies, sanitized replay data and older-history responses are included locally, so reproduction need not depend on a changing checkout. Run `bash (not archived)`; it obtains the mandatory shared lock and restores the browser on exit. It needs the installed Playwright under `(not archived)`, ffmpeg, the existing logged-in lab profile, and the repo lab launcher. The combined script is syntax-checked; its constituent commands were executed rather than rerunning the complete benchmark matrix.

## Artifacts and reproduction

- `control-fast.mp4`: native fast drag with the frozen checkout build.
- `all-fast.mp4` and `all-warm-fast.mp4`: all-mounted first sweep and fully traversed sweep.
- `pause-fast.mp4`: suppressed-scroll fast drag and release.
- `*-contact.jpg`: timestamped samples from each clip.
- `*-trace.json`, `*-trace-analysis.json`: original Chrome traces and attribution.
- `*.json`: raw frame, LoAF, turn, scroll, geometry, input and screencast metadata.
- `reproduce.sh`: full lock-safe replay sequence, with browser restoration on exit.
- `commands-and-output.md`: commands actually executed and their original output files.

Known limits: one browser/session, software rendering, small non-randomized samples, instrumentation overhead, and browser-specific native thumb behavior. None of the experiments is production code. No GPU-device generalization is claimed.

## Complete measurement tables

### Input-window frames and recovery

| Variant / input | Input wall ms | p50 ms | p95 ms | max ms | max incl. recovery ms | LoAF count / blocking ms | Mount / unmount |
|---|---:|---:|---:|---:|---:|---:|---:|
| control-fast | 2605 | 33.3 | 1983.3 | 1983.3 | 2233.2 | 9 / 4251.5 | 6/7 |
| control-slow | 14219 | 16.7 | 166.7 | 2599.9 | 2599.9 | 31 / 10348.0 | 11/12 |
| control-wheel | 14513 | 16.7 | 133.3 | 2099.8 | 2099.8 | 50 / 9179.1 | 7/7 |
| control-pagedown | 4869 | 16.7 | 33.4 | 100.0 | 100.0 | 1 / 33.5 | 0/0 |
| control-pagefull | 68517 | 16.7 | 33.4 | 1483.2 | 1483.2 | 21 / 7137.2 | 7/6 |
| control-loading | 1351 | 50.0 | 116.7 | 183.3 | 1500.0 | 14 / 1908.9 | 1/1 |
| all-fast | 1657 | 50.0 | 200.0 | 216.7 | 216.7 | 14 / 662.7 | 0/0 |
| all-warm-fast | 1552 | 33.3 | 66.6 | 166.7 | 166.7 | 3 / 162.6 | 0/0 |
| pause-fast | 1297 | 16.7 | 83.3 | 100.0 | 2383.3 | 9 / 2487.7 | 4/5 |
| all-visible-fast | 1652 | 50.0 | 133.4 | 200.0 | 200.0 | 3 / 213.4 | 0/0 |
| cache-warm-fast | 1551 | 33.3 | 50.0 | 883.3 | 2149.9 | 5 / 3094.3 | 5/7 |

### One-time expansion after history is loaded

| Expansion | New mounted turns | Mount commits | Max LoAF ms | LoAF blocking ms | Max rAF interval ms | Height before / after px |
|---|---:|---:|---:|---:|---:|---:|
| once | 7 | 1 | 4171.7 | 4121.4 | 4183.3 | 312992 / 312992 |
| idle | 7 | 7 | 1224.1 | 4504.4 | 1900.0 | 312992 / 312992 |

### Streaming replay

| Variant | Run | Blocked ms | Frame p95 ms | Max frame ms | Max LoAF ms | Max key ms | Style % | SHA |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| control | 1 | 5748 | 33.3 | 599.9 | 614 | 390.1 | 13.1 | 043dc8afaf8d |
| control | 2 | 5440 | 33.3 | 566.6 | 581 | 384.5 | 13 | 043dc8afaf8d |
| control | 3 | 5675 | 33.3 | 566.6 | 587 | 367.3 | 13.2 | 043dc8afaf8d |
| all | 1 | 54095 | 183.3 | 1366.6 | 1365 | 971.7 | 46.1 | 043dc8afaf8d |
| all | 2 | 43527 | 150 | 1200 | 1202 | 837.5 | 38.6 | 043dc8afaf8d |
| all | 3 | 40431 | 133.3 | 1099.9 | 1111 | 793.7 | 36.8 | 043dc8afaf8d |

control: median blocking 5675 ms; range 5440–5748 ms.


all: median blocking 43527 ms; range 40431–54095 ms.


### Retained memory after forced GC

| Variant | Visible mounted elements | CDP documents / nodes / listeners | JS used MiB | Embedder used MiB | Largest renderer RSS KiB |
|---|---:|---:|---:|---:|---:|
| control | 112153 | 4 / 373412 / 3194 | 182.4 | 190.3 | 997404 |
| all | 207410 | 4 / 366700 / 3072 | 209.1 | 283.7 | 1093836 |

### Simulated far-up send placement

| Variant | Start top px | Trigger to last scroll ms | New question top px | Max forced style/layout ms | Local conversation POSTs |
|---|---:|---:|---:|---:|---:|
| control | 1900 | 3311.3 | 292 | 1699.5 | 1 |
| all | 1900 | 1588.1 | 272 | 560.7 | 1 |

### Content drawn in fast-drag screencasts

| Variant | Captured samples | Blank / partial samples | Blank hold ms | Partial hold ms | Blank overlap with LoAF ms |
|---|---:|---:|---:|---:|---:|
| control-fast | 48 | 20 / 0 | 4749.8 | 0.0 | 4553.6 |
| all-fast | 53 | 33 / 1 | 1333.3 | 266.7 | 1042.2 |
| all-warm-fast | 86 | 54 / 4 | 1283.3 | 83.3 | 226.5 |
| pause-fast | 79 | 48 / 2 | 3516.5 | 83.3 | 2712.8 |
| all-visible-fast | 63 | 0 / 0 | 0.0 | 0.0 | 0.0 |
| cache-warm-fast | 61 | 25 / 3 | 1333.3 | 2183.2 | 875.4 |
