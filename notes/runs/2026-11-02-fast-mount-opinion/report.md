> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Can Butter mount a whole long ChatGPT conversation fast?

**Verified — Verdict:** no technique in the inspected experiments makes the entire conversation into real, ready-to-draw ChatGPT DOM quickly, keeps native dragging consistently smooth, and preserves Butter's streaming performance. This is an evidence limit, not a proof that fast mounting is impossible. **Verified:** the approximately 1.2-second staged-mount task is chiefly **forced style recalculation and layout**, not a second of React reconciliation or KaTeX calculation: one representative task is 1166.633 ms, containing 727.721 ms of `UpdateLayoutTree`, 206.756 ms of `Layout`, and 87.222 ms of HTML parsing. [L1, T1]

**Trade-off — One recommendation:** keep ChatGPT's normal virtualization and pursue **F: a bounded Butter-owned stand-in during native-thumb seeking**, followed by one destination recovery, as the next research direction. Do not invest in unrestricted mount-all as the product strategy. **Conditional:** this recommendation applies only if temporarily showing a clearly noninteractive preview is acceptable; if actual interactive DOM must remain visible at every thumb position, **none of the candidates is currently a demonstrated solution**. F is an experiment recommendation, not a shippable fix or a claim that the release freeze has been solved. [L1–L3, V1, V2]

**Conditional — Best remaining challenge to that recommendation:** C, exact block geometry plus containment installed **before the first measurement**, could remove much of the staged-mount bill rather than hide it. The existing warm remount cache proves a substantial reduction in forced layout, but not fast full mounting. A small attribution experiment below can determine whether a carefully combined C+B treatment deserves a new ranking. [L3, T1, T2]

## Reading guide and scope

**Verified:** this is research and trace analysis only. No lab browser was opened or automated, no ChatGPT request or message was sent, no running experiment was executed or modified, and no repository source file was edited. The requested `git fetch origin && git checkout --detach origin/main` put this worktree at `4dc4f1c2d47981edbff127bc76b38aca8d03830a`; the inspected manifest/README are `0.1.0-alpha.9`. Files created for this assessment live only under `(not archived)`. [L0, commands-and-output.md]

**Verified:** labels apply to each paragraph, bullet, or table row unless a more specific label appears: **Verified** means directly inspected local evidence or a cited primary source; **Conditional** means dependent on the stated assumptions; **Trade-off** means an engineering judgment or a cost paid for a benefit; **Unverified** means not established by inspected evidence. Source documents prove their interfaces or their specific implementation, not Butter's future performance. Mutable sources were retrieved on November 2, 2026; version-pinned code is identified separately.

## X, Y, and whether this is an XY problem

**Conditional — One-sentence frame:** X is responsive native-thumb navigation through arbitrary places in a long math conversation without white viewports or streaming regressions; Y is mounting every turn as genuine ChatGPT DOM in advance, under the constraints of an MV3 extension that does not own ChatGPT's renderer, cold/unknown heights, enormous individual turns, and changeable private React/virtualizer seams.

**Trade-off:** this is a partial XY problem. Mount-all directly addresses remounting, so it is a reasonable experiment. But the user-visible goal has three independent gates: the content must exist, its geometry must be usable, and its pixels must be ready. Existing retention removes remounts but fails the pixel/streaming gates. If “all turns as real DOM” is itself a hard requirement, a snapshot is an explicit relaxation, not an answer that satisfies it. [L1–L3]

**Verified — Constraints that change the decision:**

- Butter's current `butter.css` removes one conversation-wide inline-size container and enables seen-gated block/turn content visibility; `butter-cv.js` marks after ResizeObserver delivery and a delayed flush. That deliberately protects true first heights, but does not protect a fresh mount's synchronous ref read. [L0]
- The private virtualizer overscans by **turn count**, and preserves a covering previous range; a slightly larger overscan is not an evicting DOM cap. It also measures turn bounds in layout effects and ResizeObserver callbacks. [L1, saved `if6d` module]
- Active-only full retention still increases median streaming blocking from 5532 to 41310 ms; bounding hidden copies does not remove that regression. [L2]
- The twelve-turn test is a small, sequential, software-composited Chromium workload with profiling overhead. It does not establish universal device thresholds, behavior for arbitrarily many turns, or a supported production extension hook. [L1–L3]

## Where the time actually goes

### Fresh idle mounting: style dominates the observed 1.2-second step

**Verified:** I reprocessed `(not archived)` into [expand-idle-trace-audit.json](data/expand-idle-trace-audit.json), reading only the existing file. The main renderer's CPU profile identifies its process/thread; `RunTask` events bound each large main-thread task. Native rendering event durations are measured separately from sampled JavaScript leaves. The table excludes the startup profiler-interrupt task and the explicit post-measurement GC task. [T1]

| Confidence | Added turn / overscan step | Elements added | Driver step wall ms | Main task ms | Style ms | Layout ms | ParseHTML ms | Task remainder ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| **Verified** | 6th / 5 | 15198 | 807 | 771.082 | 426.040 | 162.172 | 51.223 | 131.647 |
| **Verified** | 7th / 6 | 17786 | 874 | 835.568 | 529.273 | 140.990 | 56.350 | 108.955 |
| **Verified** | 8th / 7 | 18166 | 852 | 815.432 | 498.566 | 146.893 | 58.925 | 111.048 |
| **Verified** | 9th / 8 | 26966 | 1206 | 1166.633 | 727.721 | 206.756 | 87.222 | 144.934 |

**Verified:** these selected style/layout/parser events do not overlap within the displayed tasks; the remainder is the task duration minus their intervals. Driver wall time, a main-thread task, and a long animation frame are different measurements. The largest mount's LoAF is 1224.1 ms, including approximately 57.5 ms beyond that task; its script reports 934.1 ms forced style/layout, agreeing closely with the trace's style-plus-layout duration. The large 1916.7 ms startup LoAF has zero blocking and no script attribution; treating it as a turn mount would be wrong. [T1, local-audit.json]

Verified: measured event time within the largest staged mount task (not archived)

**Verified:** the largest step spends about 62.4% in style, 17.7% in layout, 7.5% in parser events, and 12.4% elsewhere in that task. The style event processes 27301 elements and the layout event records 34818 dirty layout objects; these counts are different units. Both forcing stacks lead to the collapsible-text ref at `396705.cd1656e9ad.js`, line 43, column 527912. A property called `clientWidth` can trigger both pending style and layout; reporting only native `Layout` misses the larger part of this mount. [T1]

**Verified:** outside the explicitly measured rendering/parser intervals in that 1166.633 ms task, samples attribute approximately 45.9 ms to the native `innerHTML` setter, 16.1 ms to React-bundle leaves, 15.8 ms to stacks passing through the KaTeX bundle, and 4.6 ms to GC. These are sample-weight estimates, not an exact partition. React-bundle leaf time is **not** the inclusive cost of React: it excludes browser APIs called by React and other code beneath React's stack. Likewise, parser time plus setter samples is only an indicative DOM-construction cost. [T1]

**Conditional:** even an ideal elimination of the measured style and layout would leave about 232 ms of that same task's other work unchanged. That subtraction is an attribution upper bound, not a forecast: avoidance changes allocation, scheduling, and subsequent rendering. It nevertheless shows why “just add a transition” or “cache KaTeX” does not plausibly make this observed task fit a frame. [T1]

### Remounting: removal and rebuilding remain after geometry becomes cheaper

**Verified:** I separately reprocessed the remount control and guarded cache traces. These are entire **window-change tasks**, potentially adding/removing several turns, not clean single-turn mount microbenchmarks. They should not be combined with the idle-step table as if the workload were identical. [T2, T3]

| Confidence | Representative task | Task ms | Native style ms | Native Layout ms | ParseHTML ms | Sampled removeChild ms | Sampled innerHTML outside parser ms | Sampled React leaves ms | Sampled KaTeX-stack ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
| **Verified** | Control warm fast r2, largest interaction task | 2120.244 | 6.414 | 1308.379 | 160.825 | 262.498 | 54.340 | 54.552 | 54.224 |
| **Verified** | Read-hook warm fast r3, largest interaction task | 1128.683 | 76.100 | 159.509 | 139.153 | 379.807 | 51.296 | 68.419 | 29.159 |

**Verified:** exact/native durations and CPU sample estimates are deliberately separate columns; the samples exclude the named style/layout/parser/prepaint/paint/layer intervals. Do not sum all these columns into a purported exact total. The second task also contains 1.654 ms `Paint`, 1.582 ms `PrePaint`, and 1.586 ms `Layerize`; the control's long task contains no `Paint` event. This establishes that hundreds of milliseconds of first paint are not the explanation for these particular task lengths. It does not measure every raster/compositor cost or prove paint readiness at another scroll position. [T2, T3]

**Verified:** the cached task spends about 380 ms in samples whose leaf is `removeChild`, under React's deletion traversal (`sh > sp > sh > sy ...`). The `innerHTML` path is different (`ud > up > ... > lS > lk > lu ...`), consistent with initial host-property construction. Avoiding fresh layout does not avoid removing a large old tree or parsing a new one. Calling all residual time “DOM creation, style, first paint” misses the specifically observed deletion cost. [T2; R2–R4]

**Verified:** the repeated report-level comparison remains stronger than either illustrative task: median of per-run maximum forced Layout is 1320.842 ms control versus 166.164 ms read-hook; warm worst-frame median is 2233.2 versus 1133.3 ms. Those are different metrics, not an equation allocating the entire frame to layout. A cold cache miss still produces a 1743.566 ms forced layout. [L3]

**Unverified:** the inspected evidence does not isolate an exact percentage for React **render versus commit**, all DOM node allocation, or complete KaTeX execution across every mount. Minified symbol names, samples, and browser event nesting cannot establish those quantities without phase markers or a more targeted recording. No exact per-turn universal “React X%, KaTeX Y%” is justified.

### What the saved renderer says about KaTeX and React

**Verified:** ChatGPT's captured `rVvC` math-renderer module calls `katex.renderToString(text, options)` inside a memoized React function component, then supplies the string through `dangerouslySetInnerHTML` on a span. It caches by the live component's display/error/text inputs. It is **not** shown running KaTeX from a layout effect or ref; nor does the capture show a global cross-unmount result cache. A remount may therefore repeat the computation. The exact installed KaTeX package version is not established by this excerpt. [L1, `math-renderer-source.txt`]

**Verified:** React 19.0.0 creates new host DOM elements in `completeWork`, calls `appendAllChildren`, and finalizes their initial properties **during render completion**, before committing them into the connected tree. `finalizeInitialChildren` calls `setInitialProperties`; `dangerouslySetInnerHTML` reaches an actual native HTML setter there. Thus “React only computes virtual objects in render, all DOM creation happens in commit” is inaccurate. Detached construction can be part of interruptible preparation, while connecting/removing nodes, refs, and layout effects still have synchronous costs. [R2–R4]

**Verified:** React's concurrent work loop checks `shouldYield()` between work units. Its commit implementation performs before-mutation, mutation, and layout-effect passes synchronously, then requests a paint opportunity. React 18.2.0 has the same relevant render-loop/commit distinction. There is no general time-sliced commit guarantee in either inspected version. Yielding between fibers also cannot interrupt one native `innerHTML` assignment, one component's synchronous KaTeX call, or one browser layout already executing. [R1–R4, R5]

**Conditional:** B can improve responsiveness when most work consists of many independently interruptible render units, including multiple formula components and detached DOM construction. It does not reduce total work automatically, and interrupted rendering can restart. It cannot divide the demonstrated 934 ms forced rendering episode during the ref into small tasks. [R1–R5, T1]

### What exists in the ongoing idle experiment

**Verified:** no `../2026-11-02-idle-mount/report.md` existed when inspected. I read its exclusions, rejected-stage note, state adapter, and four existing growth JSON files without running or writing anything there. [L5]

| Confidence | Existing artifact | Maximum long task ms | Maximum LoAF ms | Maximum frame ms | Scope |
|---|---|---:|---:|---:|---|
| **Verified** | growth-normal-r1 | 1525 | 1608.8 | 1599.8 | One cold growth run |
| **Verified** | growth-transition-r1 | 1351 | 1425.0 | 1416.6 | Cold growth probe |
| **Verified** | growth-transition-r2 | 1366 | 1446.4 | 1433.3 | Cold growth probe |
| **Verified** | growth-transition-r3 | 1353 | 1432.7 | 1416.7 | Cold growth probe |

**Verified:** each ends with 207410 active elements and no logged adapter errors, but initial geometry contains estimates and ends at differing total heights. Key-latency arrays are empty. The transition adapter manipulates captured renderer transition internals (`currentDispatcherRef.T`) around the range-state dispatch; this is not public `startTransition` integration. The files do not prove the precise concurrent lane used or a supported hook, although their maximum tasks show that this attempted treatment did not remove second-scale growth stalls. Do not report these as controlled typing or complete drag/streaming results. [L5, local-audit.json]

**Verified:** the rejected block-staging prefix reports a 276 ms peak task, 1148.2 ms peak LoAF, and 1133.3 ms frame; it stopped with provisional geometry and no full completion/streaming validation. That is evidence that smaller tasks alone can coexist with a long frame and incomplete content, not proof that all block-level mounting must fail. [L5, `screen-rejected.md`, `EXCLUSIONS.md`]

## Candidates: one-sentence mechanisms and what changes the work

| Candidate | Confidence and mechanism | Work removed versus work moved |
|---|---|---|
| A. Slow idle growth, shrink during streaming | **Verified:** request one additional turn after an idle gap; **Conditional:** evict extras before streaming. | Scheduling spreads construction; retention avoids later remounts, but shrink pays deletion and loses that retention. [L1, L5] |
| B. React transition for range growth | **Conditional:** use the same renderer's transition API at the actual state update so React may yield during preparation. | Mostly moves/yields render work; does not slice commit, refs, native parser calls, or forced layout. [R1–R5] |
| C. Exact geometry and pre-measurement containment | **Conditional:** give completed offscreen blocks their known sizes and skipping policy before connection/ref measurement, preserving the outer turn's real geometry. | Can actually avoid forced descendant style/layout and invalidation propagation; leaves allocation, parsing, removal, active blocks, cold misses, and activation. [L3, C1, C2] |
| D1. Keep/reuse detached DOM, clone/template/HTML snapshots | **Conditional:** retain a rendered tree or representation, then reconnect/copy instead of recomputing it. | Reuse may avoid parsing; cloning still allocates; HTML still parses; all connected versions still style/layout. React ownership must be solved. [R6, D1] |
| D2. Cross-remount KaTeX HTML cache | **Conditional:** reuse output for the same expression, options, version, and macro context. | Removes repeated TeX parsing/build/stringification, but the same output still needs DOM parsing, styling, layout, and memory. [K1–K4, T1] |
| E1. `content-visibility:hidden` retained turns | **Verified:** keep a subtree connected and skip rendering until explicitly activated. | Removes repeated hidden rendering work, but not initial DOM construction or React updates; exchanges find/focus/selection availability and visibility for control. [C1, C2] |
| E2. `postTask`, `yield`, idle callbacks, input checks | **Verified:** choose when a job starts or explicitly suspend a cooperative function between bounded pieces. | Reschedules work; cannot preempt a monolithic call or React commit. [S1–S4] |
| E3. Worker/OffscreenCanvas | **Conditional:** compute TeX HTML or draw a preview off-thread, then send a representation to the main thread. | Moves pure computation/drawing off the main thread; connected DOM construction and layout stay there. [K1, K2, D2, D3] |
| F. Bounded Butter-owned stand-in while seeking | **Conditional:** show small cached text/tiles for the current history position while suppressing repeated expensive real-window changes, then recover one destination. | Avoids mounting transient destinations; final target work remains. Requires a workable app-update suppression boundary. [L1, V1, V2] |
| G. Change the real mounting unit below a turn | **Conditional:** stage independent blocks with fixed geometry or use a virtualizer within each enormous answer. | Reduces the maximum indivisible job rather than hoping one 20000-node turn becomes cheap; needs renderer ownership/private integration. [L3, L5, C1] |

### A/B: scheduling is useful only after the job is divisible

**Verified:** `startTransition` runs its callback immediately and marks the state updates scheduled there; wrapping a timer that later changes state is insufficient. The docs explicitly require access to the corresponding state setter. A separately bundled React instance is not evidence that ChatGPT's updates entered its transition context. Butter would need a stable seam in the **same** renderer. [R1]

**Trade-off:** lowering the priority of viewport-critical updates may preserve input but leave the old window or white space at the new native scroll position until commit. That is a latency/visibility trade, even when input is responsive. A may also never finish under continuous activity; this is acceptable for opportunistic prewarming, not a guarantee that any newly opened conversation is ready. [R1, L1]

**Verified:** `scheduler.postTask` assigns priority/delay to a callback; `await scheduler.yield()` pauses at that explicit point and resumes in a later task with priority-aware continuation. `requestIdleCallback` supplies a deadline but does not stop an overrunning callback. Chrome's current guidance says not to yield only when `isInputPending()` is true; rendering and animation also need opportunities, and the API can return false negatives. [S1–S4]

**Conditional:** wrapping a React state update in a background task can schedule the setter, but React's later MessageChannel/render task does not automatically inherit a browser scheduling API's cooperative chunking. Inserting a yield before `mountGiantTurn()` delays the giant turn; it does not yield inside it. [R1, R2, S1, S2]

### C/E1: the highest-value actual work reduction, with two traps

**Verified:** `content-visibility:auto` can skip descendant style/layout/paint for a subtree that is not relevant to the user; `contain-intrinsic-size` supplies a fallback while size containment applies. It does not stop React code or DOM creation. A new DOM element does not inherit the destroyed element's browser-remembered size merely because its logical turn key matches. Butter needs its own numeric cache to transfer that geometry across unmounts. [C1, C2, L3]

**Verified:** a 34000-pixel turn intersecting the viewport is relevant even when nearly all its blocks are far away. Skipping only the outer turn cannot skip those internal blocks. In the remount diagnostic, even an entirely offscreen outer turn with `auto` still forced an 888 ms Layout when a descendant's width was requested. Browser docs explicitly warn that geometry reads can force work in skipped subtrees. [L3, C1]

**Conditional:** a useful C treatment therefore needs a block-scale geometry boundary before **any** forcing read, not just turn height, a late MutationObserver, or another outer wrapper. Exact content-column width, finalized math/fonts, message revision, block identity, media state, and theme/font changes must govern cache validity. A matching viewport width alone misses sidebar/content-column changes. [L3]

**Verified:** `contain:strict` is `size layout paint style`; it is not synonymous with “never style descendants.” The specification's style containment scopes counters/quotes rather than isolating all selector matching. Size containment changes how intrinsic size is obtained; paint containment clips overflow and introduces containing/stacking contexts. Strict containment without the correct size can collapse or distort geometry, and Butter already exempts wide answer blocks because clipping breaks them. [C2 §§2–3, L0]

**Conditional:** `content-visibility:hidden` is stronger operational control than `auto`: it stays skipped even onscreen until changed, and its contents are unavailable to find-in-page, focus, and selection. Script queries can still request otherwise-skipped work; it is not a shield against all layout APIs or React updates. It can retain already-built state, but activating a dirty subtree still has a first-visible bill. [C1, C2 §4]

**Trade-off:** C/E1 can improve a realistic retained-DOM design, but do not call that “fully ready.” In the active-only all-retained experiment, removing skipping during a hold eliminates most blank samples but creates a 5033 ms cold worst-frame median; a representative trace has 4360 ms in one style recalculation without mounts. “Already mounted” and “ready to show” are different states. [L2]

### D: caching a representation is not caching React's mounted identity

**Verified:** `cloneNode(true)` copies nodes and attributes, not `addEventListener` listeners, event-handler properties, arbitrary internal state, or a canvas's painted bitmap. Duplicate IDs are another documented problem. It is not a constant-cost resurrection of a live React component tree. [D1]

**Conditional:** keeping the actual old nodes detached may avoid reallocation if the renderer deliberately preserves them, but externally detaching/replacing React-managed children does not make React associate a fresh fiber with the old tree. Fiber host references, refs, effects, event properties, cleanup, and observers must remain consistent. React docs show that manual removal followed by a normal update can crash; they allow manipulation only of regions React has no reason to update. [R2–R4, R6]

**Conditional:** the opaque math HTML inside a `dangerouslySetInnerHTML` host is a narrower possible seam than an entire turn: an app-owned component could manage an inert cached math subtree there. Butter still cannot freely replace the host span or skip its renderer's writes. Suppressing HTML setters or substituting nodes would require content/options/ownership guards and trace validation; the saved evidence does not establish safe adoption of old nodes. [L1, R4, R6]

**Verified:** KaTeX's public API can produce a string without a live DOM; version-pinned source shows `renderToString` builds a TeX tree then calls `toMarkup`. A cache can avoid that CPU work. Current options include HTML+MathML versus HTML-only output and mutable persistent macro state. The cache key must cover relevant options/version/context; skipping a macro-defining call without reproducing its state mutation can change later formulas. [K1, K2]

**Trade-off:** changing output to HTML-only could reduce nodes, but loses the MathML representation and requires changing ChatGPT's renderer contract. A worker/string cache preserves the output contract more readily, yet measured KaTeX-stack time is a small part of the cited heavy staged task. Neither has evidence of eliminating the hundreds of milliseconds of forced style. [K2, T1]

**Conditional:** a static HTML snapshot in Butter's own isolated surface can skip React and TeX computation, but a full cloned 20000-node answer is not a lightweight stand-in. For F use bounded paragraphs, snippets, or viewport-sized tiles, with unknown/cold regions explicitly treated as previews. Caching every pixel of every tall answer is costly: a single uncompressed image of width 760 and height 34000 uses approximately

$$760 \times 34000 \times 4 = 103360000\ \text{bytes}.$$

**Trade-off:** encoded images can occupy less storage, while decoded display memory, tiles, capture time, invalidation, and fidelity still need budgets. A worker canvas is not a generic HTML/KaTeX screenshot engine. [D2, D3]

### E: APIs that do not solve this mounting problem

**Verified:** workers cannot directly manipulate the page DOM; OffscreenCanvas moves canvas drawing, not ChatGPT's DOM renderer or CSS layout, to another thread. `blocking="render"` on a script delays document rendering until a resource executes; it is unrelated to hiding or cheaply mounting an offscreen conversation subtree. There is no inspected platform API here that asks Chrome to build ChatGPT's real DOM off-thread. [D2–D4]

**Trade-off:** a same-thread iframe can isolate some styling concerns but does not itself parallelize rendering; a separate replica would still need rendering, styling, geometry mapping, and interaction synchronization. No matching primary-source result was found proving this reduces Butter's costs, so it does not outrank C/F. **Unverified:** a deployable extension-only off-main-thread replica preserving ChatGPT's exact behavior.

## Four primary-source cases

**Verified:** these are four independent projects/teams' mechanisms, not a claim of industry consensus. Published numbers are attributed to their authors and are not independent reproductions.

| Project | Problem solved | Mechanism | Costs / constraints | Source with date, version, or code location | What to borrow |
|---|---|---|---|---|---|
| **Verified:** React | Large updates block urgent interactions. | Concurrent render checks for yields between work units; new detached hosts are created during preparation; connected mutation/layout passes remain synchronous. | **Trade-off:** restarts and delayed visibility; one synchronous parser/component/layout call still blocks. | React 18 announcement, 2022-03-29; React 18.2.0/19.0.0 `ReactFiberWorkLoop`; 19.0.0 `ReactFiberCompleteWork` lines 1253–1276 and DOM host config `finalizeInitialChildren`. [R1–R5] | Identify the real work unit and phase; do not promise time-sliced commits or classify every DOM allocation as commit. |
| **Verified:** Chrome/web.dev | Offscreen document rendering consumes time although pixels are unnecessary. | `content-visibility:auto` plus containment skips descendant rendering; intrinsic sizes preserve the external box. | Authors' travel-blog example: 232 to 30 ms rendering; API reads may force work, and activating content still costs. Their example does not contain ChatGPT's private synchronous refs. | Published 2020-08-05, updated 2025-09-23; CSS Containment Level 2 §§3–4. [C1, C2] | Preinstall geometry-aware block skipping, audit geometry reads, distinguish DOM existence from rendering readiness. |
| **Verified:** react-virtuoso / TanStack Virtual | Rapid scrolling outruns expensive item construction and dynamic measurements move content. | Virtuoso renders size-preserving seek placeholders during high velocity; TanStack exposes overscan/size caches/measurement policy. | **Trade-off:** placeholder fidelity and settling; TanStack explicitly says larger overscan increases render time while reducing blank-item likelihood. Neither exposes a magic all-DOM fast mount. | Current Virtuoso “Scroll Seek Placeholders” complete example; TanStack Virtual v3 current `overscan`, `initialMeasurementsCache`, `measureElement`, `useCachedMeasurements` docs, retrieved 2026-11-02. [V1, V2] | Small stand-ins with the measured height; accurate cached geometry; independent policies for seeking versus resting. Butter lacks their app-owned rendering seam. |
| **Verified:** Cognition / Devin | Very large agent chats load slowly and jump while history/streaming change heights. | Fetch a lightweight skeleton map, load detailed islands, choose an anchor, compensate before paint; extend loads to prevent small skeleton islands between visible real rows. | Team reports 70% faster chat load and 86% less layout shift; accepts brief loaders. Owns backend and renderer. These are not native-drag latency or giant-KaTeX benchmarks. | Darragh Burke/Jorge Zreik, “How Devin rebuilt its renderer,” 2026-08-25. [V3] | Separate the navigable map from expensive content; maintain an explicit anchor and address mixed-placeholder cases. Do not infer that Butter can obtain their backend map or renderer control. |

**Verified — Additional KaTeX countercheck:** KaTeX maintainers in issue #2092 (2019, reported v0.10/v0.11) asked for profiling of over 2000 renders, suggested separating `renderToString` from DOM insertion, and later identified layout/style activity around font handling. They did not publish a universal caching cure. The issue supports separating TeX CPU, DOM insertion, and browser rendering, not transferring an old speed figure to ChatGPT. [K3]

**Verified — Virtualizer failure countercheck:** in TanStack issue #659, the reporter used `TanStack package: react-virtual ^3.0.1` on macOS Chrome and proposed reusing old sizes while scrolling backward. Maintainer comments explain that unknown destinations only have estimates, so skipping measurement there can be wrong. Later reporters fixed their own cases by changing JSX/sizes or eliminating a gap between an image placeholder disappearing and the image mounting. These are specific reported outcomes, not reproduced Butter results: preserve the size contract, and do not infer from one stutter report that all measurement should be disabled or all items mounted. [V4]

**Verified — Actual chat caching example:** Open WebUI commit `9fe3a00dbac4f6d7e33d750f5cc459bc0849aefc` (2026-06-17 UTC) moves `renderToString` from a Svelte HTML template into a dependency-driven reactive statement. Its PR reports approximately 0.43 ms saved per streaming frame with ten expressions. The code demonstrates redundant-computation caching; the timing is the PR author's simulation, not a whole-turn remount result. ChatGPT's captured component already memoizes while mounted, so borrow cross-remount reuse only after measuring its missing benefit. [K4, L1]

## Issues as causal chains

### 1. A giant first measurement remains indivisible

- **Verified — Where:** collapsible-text ref `r`, `396705.cd1656e9ad.js:43:527912`; native style/layout stack in the staged trace. [T1]
- **Verified — Trigger:** the next large turn is connected and the ref asks for `clientWidth` while descendants need first style/layout. [L1, T1]
- **Verified — Consequence:** one step spends 934 ms in forced style/layout even though only one turn was added. [T1]
- **Verified — Evidence:** the 1166.633 ms task and its forcing stacks; initial geometry restoration reduces later forced layout in a different remount experiment. [T1, L3]
- **Conditional — Fix:** C must protect relevant blocks before the read, or an app-owned ref must defer measurement safely; prove shorter tasks **and** correct heights. Cost: exact cache invalidation and private integration; cold misses remain native and slow.

### 2. Transition priority does not change the measurement or deletion phase

- **Verified — Where:** B's range update versus React's synchronous mutation/ref/layout-effect passes. [R1–R5]
- **Conditional — Trigger:** preparation yields successfully, then the finished tree enters a large ref or deletion traversal.
- **Conditional — Consequence:** typing can preempt earlier render slices but cannot preempt that synchronous episode; the destination may remain blank beforehand.
- **Verified — Evidence:** current transition growth files still contain 1351–1366 ms tasks; cached remount task samples include 380 ms `removeChild`. [L5, T2]
- **Conditional — Fix:** first reduce the synchronous phase or change the renderer's unit of work; use transitions as supporting scheduling. Cost: renderer access and possible restarts; wrapping another callback is insufficient.

### 3. Whole-DOM retention exchanges navigation costs for stream costs

- **Verified — Where:** connected active-chat DOM and its visibility/style lifecycle. [L2]
- **Verified — Trigger:** expand from five turns / 112153 elements to twelve / 207410, then replay streaming with Butter's skipping retained. [L2]
- **Verified — Consequence:** warm fast worst-frame median becomes 100 ms, but blank time remains 1133 ms and median streaming blocking becomes 41310 instead of 5532 ms. [L2]
- **Verified — Evidence:** active-only retention isolates the regression from expanding hidden copies; one-shot expansion itself has 3566.6 ms median worst frame. [L2]
- **Conditional — Fix:** bound retained DOM or explicitly skip unchanged offscreen blocks, with streaming measurements before acceptance. Shrinking before a send must include synchronous removal/GC in send latency and discards the warm mount benefit. [T2, L5]

### 4. Strict containment can produce a fast but wrong scroll map

- **Verified — Where:** per-turn/per-block fallback sizes, cache validity, wide blocks. [L0, L3]
- **Conditional — Trigger:** unvisited content gets a generic height, or a completed answer changes width/font/content/media.
- **Verified — Consequence:** the tested generic fallback nearly doubles total chat height; cold guarded misses instead preserve correctness by taking the slow native path. [L3]
- **Verified — Evidence:** generic warm height grows from roughly 313000 to roughly 600000 pixels; before-read guards still fail cold coverage. [L3]
- **Conditional — Fix:** known finalized block sizes only; preserve gaps, box sizing, margins and wide-block overflow; invalidate on exact content width/revision changes. Cost: incomplete cold coverage and substantially more bookkeeping.

### 5. Reusing nodes outside React breaks ownership assumptions

- **Verified — Where:** React-managed host children, refs/effects, and cached detached subtrees. [R2–R4, R6]
- **Conditional — Trigger:** the extension replaces children with old/clone nodes while the current fiber still references other hosts or receives a subsequent update.
- **Conditional — Consequence:** mismatched cleanup/events, replacement on update, stale content, or exceptions; clones also lose listeners and state. [R6, D1]
- **Verified — Evidence:** React's DOM-ref documentation demonstrates manual-removal crashes; clone semantics do not transfer framework identity. [R6, D1]
- **Conditional — Fix:** use an explicitly unmanaged Butter surface, or an app-owned opaque renderer seam; do not counterfeit React stateNode ownership. Cost: F's temporary fidelity loss or a maintained private renderer intervention.

### 6. A preview can hide a blank without removing the freeze

- **Verified — Where:** F's distinction between covering the viewport and preventing ChatGPT's expensive window updates. [L1]
- **Conditional — Trigger:** an overlay is displayed but native scroll/observer-driven range updates still construct real turns underneath, or several deferred destinations are flushed on release.
- **Conditional — Consequence:** the preview and input handler stall too, or the release pays the original bill.
- **Verified — Evidence:** earlier scroll-event suppression had a 100 ms active-input maximum frame but a 2383.3 ms recovery frame; the unmounted middle was white. Adding a picture would not alone remove that recovery task. [L1]
- **Conditional — Fix:** verify suppression at the actual virtualizer/controller boundary, keep preview nodes bounded, coalesce to the final destination, measure release-to-readable-content and typing. A scroll-event hook alone does not stop ResizeObserver or all programmatic measurements. Cost: private seam, invalidation, and changed seeking fidelity. [L1, L0]

## Scores

**Trade-off:** scores run from 1 (poor) to 10 (good), including implementation cost where 10 means cheap. These are explicit decision judgments, not measured speeds. “Max task” means ability to keep work responsive **including preparation/recovery**; “Total” means time to useful navigation, including cold preparation. Streaming, robustness to ChatGPT changes, and maximum synchronous task carry the most weight; overall is not an arithmetic average. Untested mechanisms are conditional, and no high score certifies a production build.

| Candidate | Max task | Total | Stream safety | Robustness | Correctness / fidelity | Implementation cost | Overall | Evidence/confidence |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| A. Idle grow + shrink | 2 | 2 | 5 | 2 | 9 | 4 | 3 | **Trade-off:** second-scale steps verified; shrink-stream end-to-end outcome unverified here. [L1, L5] |
| B. Transition alone | 3 | 3 | 4 | 2 | 9 | 3 | 3 | **Trade-off:** phase limits verified; extension seam conditional. [R1–R5, L5] |
| C. Exact pre-measurement block containment | 5 | 5 | 7 | 3 | 8 | 3 | 6 | **Trade-off:** strongest work-reduction evidence, still second-scale warm frames; combined mount-all treatment conditional. [L3, T1, T2] |
| D1. Reattach/clone real turn DOM | 4 | 4 | 3 | 1 | 4 | 2 | 2 | **Trade-off:** saved work conditional, ownership failure is central. [R6, D1] |
| D2. KaTeX HTML cache | 4 | 5 | 8 | 3 | 8 | 5 | 4 | **Trade-off:** bounded CPU saving conditional; dominant style/removal remains. [K1–K4, T1, T2] |
| E1. Explicit hidden retention | 4 | 4 | 6 | 4 | 5 | 4 | 4 | **Trade-off:** browser skipping verified, streaming gain/activation latency conditional; hidden text loses user-agent access. [C1, C2] |
| E2. Browser scheduling alone | 2 | 2 | 5 | 7 | 9 | 7 | 3 | **Trade-off:** good supporting API, does not divide the actual job. [S1–S4] |
| E3. Worker/OffscreenCanvas | 3 | 4 | 7 | 3 | 7 | 2 | 3 | **Trade-off:** pure CPU/drawing moves; real DOM cost remains. [D2, D3, T1] |
| F. Bounded stand-in + one recovery | 7 | 8 | 8 | 5 | 4 | 5 | 7 | **Trade-off:** best avoidance strategy for relaxed X; suppression/release performance unverified, full-DOM fidelity explicitly fails while held. [L1, V1–V3] |
| G. Real block-level mounting/virtualization | 7 | 5 | 7 | 1 | 8 | 1 | 4 | **Trade-off:** plausible with renderer ownership; extension integration and unfinished staged geometry dominate. [L5, C1] |

**Conditional:** if complete real DOM throughout the gesture is a hard gate, F is ineligible and C is the highest-ranked remaining investigation, **not a passing solution**. B/D2 can support C but do not independently address its forcing reads, cold geometry, or streaming invalidation. A larger score for F should not be read as evidence that a snapshot has already beaten control in this lab.

## Recommendation, reconsideration conditions, and one decisive experiment

**Trade-off — Adopt one direction:** retain native virtualization, keep Butter's streaming protections, and investigate F with a small bounded preview and exactly one committed destination after seeking. Do not implement unrestricted full retention, global CV removal, DOM reparenting, or broad measurement spoofing as a claimed complete fix. This recommendation minimizes work for places the user passes transiently; it does not make the final destination's real content free. A native-thumb preview is distinct from replacing the scrollbar or switching the user to the history rail.

**Conditional — Product acceptance for F:** require demonstrably fewer real window changes while held, a preview that stays useful for known and unknown regions, control-like streaming, correct final offset inside long answers, native recovery on cancellation/navigation, and release-to-readable-content measured separately from thumb movement. If suppression requires an excessively brittle invasive hook, or the release still freezes typing for seconds, reject it rather than declare a smooth drag win. [L0–L3]

**Conditional — Re-evaluate when:**

- C can make one representative complete offscreen turn cheap without moving the bill to activation/removal or corrupting its true height.
- A stable ChatGPT renderer/virtualizer seam permits app-owned block staging, genuine same-renderer transitions, or reusable hidden state with correct measurement policy.
- A broader measured hardware/chat matrix shows that retained DOM with explicit hidden-block policy preserves streaming and input latency.
- The interaction requirement becomes “continuous actual text, selection, find and controls at every native thumb position,” making F unacceptable regardless of speed.

**Conditional — Small experiment that could reverse the ranking:** run this later in an isolated copied fixture or an explicitly acquired lab session; it was **not** run for this report. Use one already-typeset representative long turn, the same width/fonts/styles, and at least three alternating repetitions per arm:

1. **Conditional:** compare baseline one-turn growth against exact cached geometry applied to direct blocks before insertion/ref measurement, with both `auto` and explicitly `hidden` offscreen policies. Preserve the real outer height; keep the user-text width read native. Record whether a geometry read activates skipped content.
2. **Conditional:** compare normal scheduling and the actual renderer's public transition around the same setter, adding render-start/end and mutation/ref/layout-effect marks. Mark/cost `renderToString` and HTML setter calls separately. Do not time only the dispatch call.
3. **Conditional:** after mounting, activate the same destination once, then evict once; measure worst main task, whole-frame duration, elapsed preparation, activation, deletion, layout shift, and exact DOM/text/math fidelity. Exclude initial profiler handshake and explicit GC from interaction maxima; report retained memory separately.
4. **Conditional:** only if the per-turn screen succeeds, expand to all twelve turns and run the existing recorded streaming/send workload with offscreen retention still present. The streaming test must cover the send-to-shrink or send-to-hide transition as well as steady streaming.

**Trade-off — Suggested decision thresholds:** prefer tasks below 50 ms as a minimum long-task screen, then inspect frame/blank behavior against a roughly 16.7 ms 60 Hz budget; the first threshold alone is not smoothness. Require stable complete-turn geometry and a measured streaming budget agreed before the run (for example, no more than a 10% increase in median blocking, with overlapping-run uncertainty explicitly reported). These are proposed acceptance criteria, not established product guarantees.

**Conditional — Interpretation:** if pre-measurement containment removes the 728 ms style episode but leaves a greater-than-100 ms native parser/removal floor, more idle delays and transition priority will not solve that floor. If geometry forces activation even under the hidden policy, the native measurement seam needs redesign. If C+B achieves short tasks, correct geometry, cheap activation, and safe streaming at twelve turns, reverse this recommendation and investigate that bounded full-DOM treatment. Otherwise stop retuning schedules and evaluate the stand-in contract directly.

## Sources and reproduction

**Verified — Local inputs:**

- **L0:** inspected checkout `4dc4f1c2d47981edbff127bc76b38aca8d03830a`, `README.md`, `docs/how-it-works.md`, and relevant `extension/` sources: `butter.css`, `butter-cv.js`, `butter-main.js`, `butter-nav-main.js`, `butter-nav.js`, configuration/manifest/status/settings/popup code. Final tracked-file status is recorded in the command log.
- **L1:** `../2026-11-02-scrollbar/report.md`, `expand-idle.json`, `expand-idle-trace.json`, `runtime-virtualizer-original.js`/windowing excerpt, `controller-source.txt`, `math-renderer-source.txt`; original experiment Nov 1, 2026.
- **L2:** `../2026-11-02-retention/report.md`, active-chat retention and paint-ahead experiment, Nov 1–2, 2026.
- **L3:** `../2026-11-02-remount/report.md`, `mechanisms.md`, `collapsible-text-source.txt`, `trace-analysis.py`, existing per-run trace-analysis JSON and original representative traces, Nov 2, 2026.
- **L4:** `../2026-11-02-second-opinion/report.md`, prior independent review, read for historical framing; this report's main timing attribution was re-derived rather than copied from its verdict.
- **L5:** read-only snapshot of `../2026-11-02-idle-mount/data/EXCLUSIONS.md`, `screen-rejected.md`, `growth.mjs`, `extension-state-only/idle-mount.js`, existing growth JSON and related factory source. Snapshot hashes/time are in local-audit.json (not archived); no completed report existed when inspected. Later outcomes are deliberately not inferred.
- **T1:** new [expand-idle-trace-audit.json](data/expand-idle-trace-audit.json), derived from L1's original trace by analyze-traces.py (not archived).
- **T2:** new [read-hook-warm-fast-r3-trace-audit.json](data/read-hook-warm-fast-r3-trace-audit.json), derived from L3's original trace by the same script.
- **T3:** new [control-warm-fast-r2-trace-audit.json](data/control-warm-fast-r2-trace-audit.json), derived likewise. Whole-trace task listings include clearly identifiable startup and forced-GC tasks; report tables select interaction tasks, not simply the numerically largest entry.

**Verified — External primary sources and version-specific implementation:**

- **R1:** React, [startTransition](https://react.dev/reference/react/startTransition), complete API page retrieved Nov 2, 2026; [React v18.0](https://react.dev/blog/2022/03/29/react-v18), March 29, 2022, concurrent-rendering sections.
- **R2:** React v19.0.0, [`ReactFiberWorkLoop.js`](https://github.com/facebook/react/blob/v19.0.0/packages/react-reconciler/src/ReactFiberWorkLoop.js), `workLoopConcurrent` around line 2509 and `commitRootImpl` around lines 3185–3246.
- **R3:** React v19.0.0, [`ReactFiberCompleteWork.js`](https://github.com/facebook/react/blob/v19.0.0/packages/react-reconciler/src/ReactFiberCompleteWork.js#L1253), host creation/finalization around lines 1253–1276.
- **R4:** React v19.0.0, [`ReactFiberConfigDOM.js`](https://github.com/facebook/react/blob/v19.0.0/packages/react-dom-bindings/src/client/ReactFiberConfigDOM.js#L531), `createInstance`, `appendInitialChild`, `finalizeInitialChildren`; [`ReactDOMComponent.js`](https://github.com/facebook/react/blob/v19.0.0/packages/react-dom-bindings/src/client/ReactDOMComponent.js#L566), HTML setter handling.
- **R5:** React v18.2.0, [`ReactFiberWorkLoop.new.js`](https://github.com/facebook/react/blob/v18.2.0/packages/react-reconciler/src/ReactFiberWorkLoop.new.js), concurrent loop and commit passes. These pinned versions establish their implementations, not ChatGPT's exact installed fork/version.
- **R6:** React, [Manipulating the DOM with Refs](https://react.dev/learn/manipulating-the-dom-with-refs), “Best practices for DOM manipulation with refs,” including the manual-removal example and explicitly unmanaged-child exception.
- **C1:** Chrome/web.dev, [content-visibility: the new CSS property that boosts your rendering performance](https://web.dev/articles/content-visibility), published Aug 5, 2020, updated Sept 23, 2025. The report relies on its rendering/measurement explanations; interaction semantics are checked against the specification.
- **C2:** W3C, [CSS Containment Level 2](https://www.w3.org/TR/css-contain-2/), §§2, 3.1–3.4, 4 and restrictions in §4.4; particularly [content-visibility](https://www.w3.org/TR/css-contain-2/#content-visibility). Recommendations for optimizations are distinguished from normative interaction rules.
- **K1:** KaTeX, [API](https://katex.org/docs/api), `renderToString`, persistent macros; current docs retrieved Nov 2, 2026.
- **K2:** KaTeX, [Options](https://katex.org/docs/options); pinned [v0.16.11 katex.js](https://github.com/KaTeX/KaTeX/blob/v0.16.11/katex.js), `renderToString`, `renderToDomTree`, `render`. This is not a claim that ChatGPT uses v0.16.11.
- **K3:** KaTeX, [issue #2092](https://github.com/KaTeX/KaTeX/issues/2092), maintainer comments Sept 4 and Oct 19, 2019; complete fetched discussion/API comments saved locally.
- **K4:** Open WebUI, [PR #25847](https://github.com/open-webui/open-webui/pull/25847), June 2026; [merged implementation](https://github.com/open-webui/open-webui/commit/9fe3a00dbac4f6d7e33d750f5cc459bc0849aefc), `src/lib/components/chat/Messages/Markdown/KatexRenderer.svelte`. Authored benchmark claims are separate from the verified patch.
- **S1:** Chrome, [Use scheduler.yield() to break up long tasks](https://developer.chrome.com/blog/use-scheduler-yield), March 6, 2025; explicit continuation/priority behavior.
- **S2:** MDN, [Scheduler.postTask](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/postTask), priority/delay/callback contract, retrieved Nov 2, 2026.
- **S3:** Chrome, [Using requestIdleCallback](https://developer.chrome.com/blog/using-requestidlecallback), deadline/overrun FAQ; no forced interruption when the deadline runs out.
- **S4:** web.dev, [Optimize long tasks](https://web.dev/articles/optimize-long-tasks), “Don't use isInputPending”; Chrome, [Better JS scheduling with isInputPending](https://developer.chrome.com/docs/capabilities/web-apis/isinputpending), current notice superseding earlier conditional-yield advice.
- **V1:** react-virtuoso, [Scroll Seek Placeholders](https://virtuoso.dev/react-virtuoso/virtuoso/scroll-seek-placeholders/), complete current example and size-preserving placeholder contract.
- **V2:** TanStack Virtual v3, [Virtualizer API](https://tanstack.com/virtual/latest/docs/api/virtualizer), especially `overscan`, `measureElement`, `initialMeasurementsCache`, and `useCachedMeasurements`; current mutable docs retrieved Nov 2, 2026.
- **V3:** Cognition/Devin, [How Devin rebuilt its renderer](https://devin.ai/blog/rebuilding-devins-chat-renderer), Darragh Burke and Jorge Zreik, Aug 25, 2026, complete engineering post.
- **V4:** TanStack Virtual, [issue #659](https://github.com/TanStack/virtual/issues/659), February 1, 2024 report; inspected maintainer comments February 2/6 and reporter follow-ups July 17/August 1, 2024. The saved extraction includes these complete comments but is truncated later in the long discussion; no claims rely on the omitted remainder.
- **D1:** MDN, [Node.cloneNode](https://developer.mozilla.org/en-US/docs/Web/API/Node/cloneNode), cloning semantics/listener/canvas caveats.
- **D2:** MDN, [OffscreenCanvas](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas), drawing/worker scope.
- **D3:** MDN, [Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers), DOM restriction and messaging.
- **D4:** MDN, [script element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script), `blocking="render"` resource/rendering contract.

**Verified — Reproduction and command record:** commands-and-output.md (not archived) lists executed inspection/fetch/analysis commands, exit statuses, and their actual stdout/stderr, including failed fetches and an initial missing optional parser dependency. setup-and-tool-calls.md (not archived) records setup, source-search tool calls, and truncation limits. Raw/extracted source snapshots and URL manifests are under sources/ (not archived). `python3 (not archived)` and `python3 (not archived)` regenerate this assessment's derived JSON from existing artifacts without accessing a browser. No experiment scripts from another directory were executed.
