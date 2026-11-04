> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter tail-layout diagnosis — 2026-11-01

The dominant remaining cost is the first layout of **four freshly remounted tail turns**, forced by ChatGPT's collapsible-text measurement ref reading `clientWidth`. It is not primarily the placement-distance calculation. A new question's measurement forces the entire dirty mounted window to layout, including math answers outside the viewport. React also spends substantial time constructing and replacing the window's DOM.

The unconditional block-skipping experiment removes about 1.17 seconds from the largest layout and 1.21 seconds from the keydown frame in the matched clean comparison, while leaving roughly 0.8 seconds of non-layout work. It also lands about 15,000 pixels short. This experiment sizes an opportunity; it is not a proposed fix.

No repo changes were made. Browser extension and original tab were restored, composer empty. Server snapshots are byte-identical (50 nodes, 12 user IDs, same current node).

## Measurement scope and artifacts

Read `docs/how-it-works.md`, `extension/butter-cv.js`, `extension/butter.css`, `extension/butter-nav.js`, and the existing uncommitted diff. Baseline is `git archive HEAD extension`; prototype is this working tree copied to the snap-readable extension directory and loaded after a browser restart. No version bump or build.

All runs use the existing fail-closed fetch hook, recorded SSE replay delayed by 15 seconds, and a separate browser-context firewall from `(not archived)`. Each completed run has exactly one locally intercepted conversation POST, no escaped write, and `replay.done=false` at measurement completion. Preparation writes are blocked. Final `finalReplay.done=true` is outside the measurement window. Snapshot reads use a fresh hidden iframe fetch so Butter does not mistake the GET for pagination. Tokens remain inside the page.

All runs load 12 rail questions and wait for the earlier control to become hidden. Visible scroller: viewport 912 px; start `scrollTop=1900`. The clean control and both CSS experiments have the exact same initial `scrollHeight=309747`. The first DOM probe has 313020 px, so use it for attribution/identity and the matched clean pair for the effect size. An additional ancestor probe confirms the identity/height findings but has more overhead.

These are new captures, not a numerical decomposition of an unavailable trace for the old 1.894-second script. Current runs are somewhat slower than the supplied earlier measurements. Asset hashes also changed across reloads; equivalent forcing code is present in both versions. The current clean script is 2386.7 ms with 1578.6 ms forced work; the original result was 1894.1/1309.0 ms. Attribution is supported by the current traces and repeated DOM probes.

Timing is `__scrollProbe.start()` immediately before focus/Enter through the last thread scroll event, not driver completion or answer replay. LoAFs must start after trigger minus 1 ms. Profiler startup is excluded: for example, baseline has a 4374.5 ms LoAF beginning 4394.7 ms before trigger; it is not included. Cropped traces begin at `EventDispatch(keydown)` and end after final scroll plus 50 ms. Full traces and profile samples remain available. Native style/layout samples are removed by timestamp before classifying non-layout script samples.

| Run | Trigger→final ms | Max active LoAF ms | Keydown script ms | Forced style/layout ms | New question top px |
|---|---:|---:|---:|---:|---:|
| prototype-clean | 3,081.7 | 2,490.3 | 2,386.7 | 1,578.6 | 292 |
| prototype-dom | 3,187.5 | 2,529.4 | 2,402.7 | 1,504.4 | 272 |
| prototype-ancestor | 3,723.2 | 3,032.8 | 2,850.6 | 1,943.5 | 292 |
| baseline-dom | 11,588.0 | 2,906.4 | 661.9 | 338.4 | 3,517 |
| skip-clean | 1,910.7 | 1,285.9 | 1,156.4 | 370.7 | 15,339 |
| skip-clean-2 | 2,255.1 | 1,571.8 | 1,439.2 | 443.1 | 15,339 |

Primary raw evidence: `prototype-clean-trace.json`, `prototype-clean-cropped-trace.json`, `prototype-clean-layout.json`, `prototype-clean-analysis.txt`; DOM/identity evidence: `prototype-dom.json`; baseline evidence: `baseline-dom-trace.json`, `baseline-dom-layout.json`, `baseline-dom.json`; CSS experiment evidence: `skip-clean*.json` and matching traces. JSON artifacts store the full stacks and block lists, not just these summaries.

## 1. What runs inside the keydown?

In the clean capture, keydown `EventDispatch` is 2395.2 ms (slightly wider than the 2386.7 ms LoAF script). It contains nine `UpdateLayoutTree` events totaling 180.5 ms, and seven `Layout` events totaling 1400.5 ms. Their combined 1581.0 ms agrees with the LoAF's 1578.6 ms within instrumentation/timing boundaries. `UpdateLayoutTree.elementCount` sums to 798; this is a sum across events and can count the same element again.

Every keydown style/layout event is listed below. Counts are trace values **at event entry**, not a count of all descendants eventually built or visited. In particular, the large layout starts with 1138 layout objects and 434 dirty objects, and later layouts report about 59479 objects. The small entry count must not be read as evidence that only 434 nodes were laid out.

| Event | ms | Style elements | Dirty objects | Total layout objects at entry | Forcing stack prefix |
|---|---:|---:|---:|---:|---|
| UpdateLayoutTree | 0.283 | 2 | — | — | beforeSend → addEventListener.capture |
| UpdateLayoutTree | 0.251 | 1 | — | — | a → U → callback |
| Layout | 0.551 | — | 26 | 5122 | a → U → callback |
| UpdateLayoutTree | 74.083 | 7 | — | — | setSelection → setSelection → ew |
| Layout | 16.868 | — | 37 | 5120 | setSelection → setSelection → ew |
| UpdateLayoutTree | 23.971 | 492 | — | — | r → o8 → sc |
| Layout | 1,363.285 | — | 434 | 1138 | r → o8 → sc |
| UpdateLayoutTree | 42.645 | 285 | — | — | r → o8 → sc |
| Layout | 2.122 | — | 68 | 59479 | r → o8 → sc |
| UpdateLayoutTree | 0.848 | 2 | — | — | ea → o3 → sc |
| UpdateLayoutTree | 0.295 | 1 | — | — | y → (anonymous) → i_ |
| Layout | 1.535 | — | 28 | 59479 | y → (anonymous) → i_ |
| UpdateLayoutTree | 0.954 | 1 | — | — | y → (anonymous) → o3 |
| Layout | 1.978 | — | 26 | 59479 | y → (anonymous) → o3 |
| UpdateLayoutTree | 37.136 | 7 | — | — | Z → callback → eM |
| Layout | 14.184 | — | 89 | 59475 | Z → callback → eM |

The large forcing stack is `r:396705.*.js:43:527912 → o8:226913.*.js:2:142412 → sc → s_ …`, a React ref callback. The downloaded runtime source around module `oQwr` contains:

```js
r = e => {
  w(e);
  // ref changed, collapsedLineCount or fallback font changed
  x.current = {element:e, collapsedLineCount:p, fallbackFontSizePx:m};
  y(e, e.clientWidth);
};
```

The helper obtains computed font/line-height and, when collapse measurement is enabled, `e.scrollHeight`. The first `clientWidth` read forces the dirty tree. In `prototype-dom`, its measured duration is **1315.2 ms**, on an element in turn `<id>`. It is the collapsible-text measurement ref, not a Butter callback and not `place/getPlacementDistancePx`. Its snapshot immediately after the read shows four fresh tail elements and 1040 entirely unmarked answer blocks. The clean trace's corresponding `Layout` alone is 1363.285 ms.

Other forced work is real but smaller:

- Composer/ProseMirror `setSelection → updateStateInner → dispatchTransaction`: 74.083 ms style for 7 elements and 16.868 ms layout (37 dirty/5120 total).
- ChatGPT virtualizer `Z:901075.*.js:1:62849 → callback:982651.*.js:260:10206 → eM → React`: 37.136 ms style plus 14.184 ms layout. `Z` reads the scroller's first child's and virtualizer box's bounding rectangles to correct distance from bottom.
- `place` calls `compensateScrollToDistanceFromBottomPx → Q → U → a` earlier: 0.251 ms style and 0.551 ms layout here. It is not the dominant force.
- Butter's capture pre-jump has one 0.283 ms style event (2 elements) in `beforeSend` and no large layout under its stack.

The non-layout remainder is 808.1 ms by subtraction from the LoAF script. Filtered CPU sampling yields 814.3 ms, a sampling estimate, classified as:

| Sampled self time outside style/layout | ms |
|---|---:|
| React JS | 334.0 |
| Native DOM/runtime | 239.8 |
| Other ChatGPT JS | 197.3 |
| Garbage collection | 40.5 |
| Butter | 1.4 |
| Existing measurement probe | 1.4 |

React's `ud` property/attribute application alone has 238.3 ms sampled self time; native `removeChild` 129.0 ms, `appendChild` 22.2 ms, timer clearing/scheduling 45.5 ms, and `querySelectorAll` 17.0 ms. DOM parsing may be sampled at its React caller or at native `innerHTML` depending on the build/sample: the DOM probe reports 255.6 ms in `set innerHTML`, and the CSS experiment 230.8 ms. Do not add those alternate-run values to the clean-run 238.3 ms. React creates/removes the long-answer DOM and runs refs/effects; this is the substantial script floor that unconditional skipping does not eliminate.

## 2. Exactly what is mounted at pre-jump?

`prototype-dom`'s main-world capture runs **45.7 ms after trigger**, after Butter's isolated-world capture has already changed `scrollTop` to 311196 and before ChatGPT's submit processing. It still contains the same five oldest element identities as before the jump. The last answers are **unmounted**, not mounted-and-skipped. Those five turns are all marked and eligible for turn-level `content-visibility:auto`.

The height table comes from the clean-history baseline snapshot and is independently confirmed by the later prototype ancestor probe. It measures turn boxes before send without visiting unmounted tail content:

| Mounted key (oldest five) | Height px | Turn seen | Answer blocks seen/total |
|---|---:|---|---:|
| <id> | 33,919.36 | yes | 655/674 |
| <id> | 39,282.34 | yes | 746/769 |
| <id> | 24,731.38 | yes | 450/473 |
| <id> | 32,491.95 | yes | 590/615 |
| <id> | 34,616.94 | yes | 625/653 |

The first slow `clientWidth` read then sees these **freshly remounted** tail elements. All four turns have no `data-butter-seen`; all 1040 answer blocks have no mark. No element identity is shared with the pre-jump five. None of the tail turns is `in_progress` then, so Butter's streaming exception does not apply. Butter's CSS therefore leaves normal answer blocks visible for their first layout. The heights below are measured **after layout/settling on the same remounted element identities**, not invented heights for unmounted elements at capture time.

| Tail key | Laid-out turn height px | Descendant elements | Answer blocks | Blocks seen at first slow read | Blocks seen after settling |
|---|---:|---:|---:|---:|---:|
| <id> | 36,895.08 | 26,958 | 678 | 0 | 644 |
| <id> | 5,494.12 | 3,527 | 86 | 0 | 81 |
| <id> | 14,894.61 | 13,520 | 275 | 0 | 257 |
| <id> | 208.00 | 70 | 1 | 0 | 1 |

Thus the answer is more precise than “one last long answer”: the penultimate answer is about 14.9k px, the last is short (208 px including its question), and overscan also remounts a roughly 36.9k px turn and a roughly 5.5k px turn. The four tail turns have **44075 descendant elements** and **1040 direct answer blocks**, spanning roughly 57.5k px, though only a viewport near the bottom is visible. The new local question is added subsequently as a fifth turn.

After settling, 983 of the 1040 blocks are marked. Of the remaining 57, eight are wide blocks and 49 are `HR` elements (1 px border box but zero content height, so Butter's ResizeObserver test does not mark them). These exceptions do not weaken the first-read finding: all 1040 blocks, including the normal non-wide blocks, were unmarked when the expensive layout occurred.

This supports the first-layout hypothesis at the granularity available in Chrome's trace: an entire newly mounted window must establish geometry. The trace does not provide a per-block allocation of native layout time, so it cannot honestly assign a particular fraction of the 1363 ms to each answer or to KaTeX alone. The CSS intervention below isolates the block-layout component.

## 3. Why does baseline pay repeatedly?

`baseline-dom` takes 11588.0 ms from trigger to final scroll. The same ref function repeatedly reads `clientWidth` as the spring moves the virtualizer window. The probe records these new arrivals in order:

- Turn 6 `<id>`: 500 blocks, all unmarked; 724.8 ms slow read.
- Turns 7–8 `<id>`, `<id>`: 570/670 blocks, all unmarked; 1560.7 ms read on turn 7.
- Turns 9–10 `<id>`, `<id>`: 678/86 blocks, all unmarked; 2257.5 ms read on turn 9.
- Turn 11 `<id>`: 275 unmarked blocks; 2143.2 ms read.
- Turn 12 `<id>`: one unmarked block; 526.4 ms read.
- New local question: another 394.1 ms read while older tail material is still unmarked.

Their matching trace pairs follow. Relative times start at keydown, whereas the DOM probe's times use trigger; don't subtract values from those two clocks without aligning them.

| Relative ms | Preceding style ms / elements | Layout ms | Dirty objects | Total objects at entry |
|---|---:|---:|---:|---:|
| 1,277.5 | 21.7 / 7 | 703.0 | 27 | 4,359 |
| 2,814.4 | 20.3 / 7 | 1,540.3 | 27 | 24,623 |
| 5,015.2 | 16.9 / 7 | 2,240.5 | 27 | 71,261 |
| 7,645.0 | 17.3 / 7 | 2,125.8 | 27 | 90,423 |
| 10,133.7 | 14.6 / 7 | 511.8 | 27 | 27,899 |
| 10,835.9 | 13.3 / 7 | 380.7 | 27 | 21,182 |

All six layouts have stack `probe.fn → r:396705.*:43:527912 → o8 → sc → s_ …`. For example, the 2906.4 ms scheduler LoAF includes a `MessagePort.onmessage` script with 2260.4 ms forced work; the following 2541.5 ms LoAF includes 2146.1 ms forced work. One earlier 2270.7 ms LoAF is attributed to `TimerHandler:setTimeout`, with 1563.0 ms forced work. “Every frame is scheduler-only” would therefore overstate this capture; the mechanism is the same under those different task entry points.

The cost is **repeated window layout as new regions mount**, not an independently measured identical cost once per answer. Previous unmarked answers remain in the window, and long tasks delay Butter's one-second marking batch, so some content remains unskippable across several regions. Later snapshots show turns 8–10 marked while turn 11 is still unmarked. Baseline totals over the cropped animation: 70 style events / 643.5 ms and 43 layouts / 7652.2 ms.

## 4. Throwaway counterfactual (not a fix)

Only this extra page CSS is applied after scrolling up and before triggering send:

```css
[data-markdown-text-style="assistant-message"] > :not([data-wide-block]) {
  content-visibility: auto !important;
}
```

It applies to all answer blocks, so newly remounted tail blocks become eligible before Butter marks them. Existing `contain-intrinsic-size:auto 120px` remains in place. The visible history is already marked; the main changed population is newly mounted content. This is a disposable page injection, removed by reload, with no repository edit.

Matched clean control → first CSS run:

- Largest ref-forced `Layout`: **1363.3 → 194.9 ms**, reduction 1168.4 ms (85.7%). Both enter with 434 dirty objects / 1138 total, making the changed descendant-layout work especially clear.
- Keydown forced style/layout: **1578.6 → 370.7 ms**; keydown script **2386.7 → 1156.4 ms**.
- Keydown LoAF: **2490.3 → 1285.9 ms**; trigger→final **3081.7 → 1910.7 ms**.
- Non-layout remainder: **808.1 → 785.7 ms**, effectively unchanged at this sample size.

The repeat has trigger→final **2255.1 ms**, keydown script **1439.2 ms**, forced work **443.1 ms**, and LoAF **1571.8 ms**. These are individual runs, not a confidence interval or a robust performance guarantee. Both show the same geometry failure.

**Wrong landing / height jumps:** both CSS runs finish with `scrollTop=376432`, `scrollHeight=392596`, and new question top **15339 px** relative to the scroller. The matched control ends at `312595`, `313712`, and **292 px**. The CSS run has large scroll/height corrections and does not display the new question in its 912 px viewport. Its final height is 78884 px larger than control. This matches the reason Butter delays skipping: fresh blocks have no remembered true size and use placeholder geometry. “Final” here means last observed scroll during the pre-replay window, not a promise of a correct or permanently settled destination. No visual screenshot claim is needed to establish that geometric failure.

## 5. Anything else / broad ancestor invalidation?

The additional ancestor probe observes `class`/`style` changes both inside the scroller and on its containing ancestors. It finds normal virtualizer changes: mounted-window `margin-top:0px → 255211px`, total-height writes, per-turn height corrections, a 546.667 px placement spacer, composer focus/placeholder changes, animation play-state changes, and scroll-to-bottom button classes. It finds **no class change on the whole-thread ancestor, html, or body that explains a thread-wide restyle**. Mutation timestamps are callback-delivery times, not the exact original write time.

The clean trace directly limits the unexplained style cost: the largest style population is 492 elements (23.971 ms), not all history nodes; the 1.363-second event is a layout. The 74 ms selection style recalc with only seven elements and the 37 ms virtualizer recalc with seven elements are measurable additional costs; element count alone is not a time predictor. These coexist with the dominant first layout and the React/DOM/GC work above.

No huge `UpdateLayoutTree` under Butter, a blanket ancestor toggle, or `getPlacementDistancePx` appears as an alternative explanation in these captures. That is a finding about this reproduction, not proof that every ChatGPT layout is local. Native layout does not expose a per-KaTeX-block timing breakdown.

Two initial enhanced-probe attempts (extra ResizeObserver and later descendant computed-style reads/invalidation tracking) stalled and were aborted/restarted. They have no completed usable measurement and are excluded. The ordinary probe itself adds some work: its first DOM run has two 40-ish ms geometry reads in the mutation callback after keydown. Hence effect sizes use `NO_TAIL=1` captures; DOM/ancestor captures are attribution evidence. Capturing computed styles of descendants inside skipped turns can defeat the very behavior under examination; avoid adding such reads to the measured path.

## Re-run and verification

```bash
cd ~/.t3/worktrees/butter/t3-54326eed
bash (not archived)
```

This rebuilds snap-readable baseline/prototype copies, restarts the lab as needed, loads all history, captures clean prototype/DOM/CSS/baseline runs, compares read-only snapshots, and restores `butter-blank-head` plus the original tab in an EXIT trap. The combined script is syntax-checked; its constituent capture commands were executed individually in this session. It uses installed Playwright at `(not archived)` and the existing `lab/harness/recordings/t09.json`.

For analysis alone (no browser changes):

```bash
python3 (not archived)
python3 (not archived) prototype-clean
python3 (not archived) baseline-dom
python3 (not archived) prototype-clean
python3 (not archived) (not archived)
```

The last command intentionally returns 1 with `REPRODUCED: DIV.onkeydown forced style/layout 1578.6 ms (threshold 1000 ms)`; the CSS result returns 0 with `NOT REPRODUCED … 370.7 ms`. This threshold checks the layout symptom only, not landing correctness.

See `commands-and-output.md` for actual command outputs. `repo-before.diff` and `repo-after.diff` are byte-identical. `before-server.json`, `after-prototype-server.json`, `after-baseline-server.json`, and `after-server.json` agree byte-for-byte. `final-state.json` confirms the restored original URL, empty composer, original extension, and absence of diagnostic probes/replay hooks.
