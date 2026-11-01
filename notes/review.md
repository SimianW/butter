# Butter for ChatGPT: adversarial correctness and robustness review

Reviewed 2026-10-30. Scope: `manifest.json`, `butter.css`, `config.js`, and `butter-main.js`; all four were read before investigating. Only this report was changed in the project. No browser, login, or authenticated request was used.

**Recommendation:** keep the smoother throttle as an experiment, harden its wrapper contract, and reconsider the unconditional CSS changes before wider use. The strongest counterexample is the claim that the two removed size containers have no consumers: the supplied JS and fetched public CSS contain real responsive and container-unit dependencies. The 9-turn textContent SHA result is useful evidence for that replay's text, but cannot detect clipping, incorrect layout, generated equation numbers, scrolling, or other scheduler users.

Severity: **High** = material layout/navigation failure in an ordinary supported feature; **Medium** = narrower visible failure or conditional interference with other code; **Low** = uncommon API edge case, configuration error, or policy/performance limitation. No critical data-loss defect was established. CSS outcomes below are source/spec deductions and explicit test scenarios, not claimed browser reproductions.

## Evidence and validation boundaries

- Extension references are one-based file lines. Bundle/CSS `@offset` references are zero-based UTF-16 character offsets, matching JavaScript `String.slice`, not byte offsets. All bundle basenames below refer to `/tmp/cgjs/`.
- Inspected all seven numbered JS files in that directory, including `731863.626bb34a55.js` and the virtualizer in `77693.a20de07237.js`. Read section 4 and supporting evidence in `notes/bundle-hooks.md`. This is a partial deployment corpus, not an exhaustive application audit.
- Fetched only public assets/specifications. Public stylesheet: [0d26df3bbf50.css](https://chatgpt.com/cdn/assets/0d26df3bbf50.css), 1,826,344 bytes, SHA-256 `cc4f3bfc402d38d38b029f7070db1a44809038f5a60040c70188314b3f4a8620`; temporary local copy `/tmp/chatgpt-butter-review-live.css`. A successful fetch does not establish that every live account loads this asset or every rule's target; the direct JS consumer cited below provides additional evidence.
- Primary behavior references: [CSS Containment 2, layout/style/paint containment and content visibility](https://www.w3.org/TR/css-contain-2/), [CSS Containment 3, container queries and units](https://www.w3.org/TR/css-contain-3/), [HTML animation frames](https://html.spec.whatwg.org/multipage/imagebitmap-and-animations.html#animation-frames), and [Web IDL callback invocation](https://webidl.spec.whatwg.org/#invoke-a-callback-function).
- Ran the existing `/tmp/cgjs/check-smoother.cjs`: all three actual-class checks passed (ordinary completion, completion with pending throttled work, stream replacement). Additional inline Node/VM checks extracted the actual smoother class and exercised cancellation after the throttle timer had fired, plus paused rAF with timers clamped to at least one second. Both passed with no pending work after destruction/completion.
- Deterministic scheduler fixtures reproduced negative-ID wrapper collisions, the native-ID-zero cancellation edge case, false-positive callback matching, and multiple deliveries in one frame. These fixtures establish JavaScript bookkeeping behavior, not Chrome's rendering/visibility behavior.

## Ranked findings

### 1. High — Removing size containers changes real responsive layout and wide-block sizing

**Location:** `butter.css:16–23`; especially the assertion at line 18.

**Scenario:** open a conversation with a floating side panel at a main-content width of at least 900px. The thread should reserve right padding for the panel; removing the named query container can prevent that rule from applying, leaving text beneath the panel. At narrow main-content widths, an expanded thread can also miss its compact maximum-width rule. Separately, display a wide table, diagram, or visualization in a conversation with a sidebar or split panel: removing the inner size container changes what `cqi`/`cqw` resolve against, potentially choosing a wider ancestor or the small viewport and producing over-wide content/clipping.

**Likelihood:** high when the relevant panel/wide-block feature is used and the removed element is the nearest eligible container; conditional on actual ancestor structure. This is stronger evidence than merely finding unrelated `@container` rules somewhere in the CSS.

**Evidence:**

- CSS @468005–468434 defines `.MainContentFrame-sss8BP` with `container:app-shell-main-content/inline-size`.
- CSS @1502219 queries `app-shell-main-content not (width>=53.5rem)` and sets `--thread-content-responsive-max-width` to the compact width.
- CSS @1512511 queries `app-shell-main-content (width>=900px)` and sets `padding-right:calc(var(--thread-floating-panel-width) + var(--spacing) * 5)`.
- `514085.0edfbdf4ee.js` @1513785 actually emits `@[900px]/app-shell-main-content:pr-[calc(var(--thread-floating-panel-width)+var(--spacing)*5)]` when the floating-panel width exists. It is not just an unused stylesheet utility.
- That bundle @1567441 emits the second targeted wrapper with both `[container-type:inline-size]` and `[container-name:thread-content]`, enclosing `[data-thread-user-message-navigation-content]`.
- No explicit `@container thread-content ...` rule was found in the fetched stylesheet. **That does not make the inner container unused:** wide-block rules at CSS @512600–514300 use `100cqi`/`50cqi`; the wide table at @522644 uses `50cqi`; `.InlineCodePane-EYx4bd` at @548450–548550 uses `max-height:56.25cqw`. Container units do not require a named `@container` rule.
- Removing `container-type` leaves `container-name` in place, but the element is no longer eligible for size queries/units. Named size queries can resolve to another matching ancestor or become unknown; unnamed size queries/units may resolve farther out. Normal containers can still support style queries: this is not a claim that all `@container style(...)` rules stop working.

**Concrete fix:** remove these two overrides by default. If retaining an opt-in performance experiment, scope it to the audited conversation layout and restore it whenever panels/expanded layouts/wide content are present. Audit container units as well as query names. Preserving the same named `inline-size` containers and their sizing semantics preserves their layout cost; there is no equivalent safe one-line `normal` replacement. An advanced alternative is to move each necessary container onto a smaller wrapper and migrate every dependent rule, which requires control of the site's layout and is unsuitable as an unverified global CSS override.

### 2. High — Placeholder heights can become virtualizer measurements and destabilize navigation

**Location:** `butter.css:3–13`.

**Scenario:** reload a long chat at the bottom, then jump to a never-rendered older message. A turn's outer box can initially represent 1500px while its unrendered answer blocks represent 120px each. A long equation/table could really be 700px; a short paragraph might be 24px. The app measures those boxes, positions rows and anchors from that geometry, then gets different heights when the content becomes relevant. Result: an incorrectly aligned jump, a blank band, scrollbar changes, or a viewport correction while reading. Resizing/zooming while older turns are skipped can likewise leave remembered heights obsolete until their content is laid out again.

**Likelihood:** medium to high on cold history loads and large jumps; lower during the measured linear stream when each block has actually rendered at the current width. The virtualizer may reconcile successfully; a permanent navigation failure has not been demonstrated.

**Evidence:**

- `contain-intrinsic-size:auto ...` remembers a rendered size; it does not predict a never-rendered block's true height or continuously remeasure skipped descendants after width/content changes. The two comments overstate stability for those cases.
- `77693.a20de07237.js` @60524 places `data-turn-key` on the observed row. The extension therefore contains the very element whose box the app measures.
- The same bundle @50058 measures tracked rows with `getBoundingClientRect().height`, then invokes height reconciliation. Reconciliation around @45900–47600 updates height maps, total layout, parent wrapper heights, and distance from bottom. A positive placeholder height passes the `e>0` check.
- Jump handling @54204 first measures tracked rows, then obtains a turn/target element and computes a scroll destination. The CSS Containment specification explicitly warns that `scrollIntoView()` uses the size-contained box of a skipped `auto` element and the final alignment can differ after rendering.
- Reading the skipped **container's** own rect need not return its children's true laid-out height. Conversely, reading a **descendant's** geometry can force skipped layout, preserving geometry at the cost of the intended optimization. Neither outcome justifies assuming these reads are free and accurate simultaneously.

**Concrete fix:** stop applying turn-level `auto` to rows already managed by the app's height virtualizer. If block containment remains, initially keep blocks visible until their real height at the current width is known; cache by block and width, invalidate on content/font/width changes, and render a jump target before asking the app to position it. Disable the optimization during a jump/reconciliation and settle geometry before re-enabling it. Prefer one owner of row geometry. Do not fix this by falsifying rects or suppressing the app's ResizeObserver; setting `overflow-anchor:none` globally also does not repair incorrect virtualizer heights.

### 3. Medium — Paint containment clips deliberate overflow and introduces new stacking boundaries

**Location:** both selectors in `butter.css:3–13`.

**Scenario:** an answer contains a centered wide visualization/table, an unscrolled long equation, or a non-portaled control that draws beyond the turn's border box. Even while visible, the new paint containment can clip that content at the turn or block boundary. A high-z-index answer toolbar can also lose to an adjacent stacking context. An identical `textContent` hash will not reveal either problem.

**Likelihood:** medium for rich/wide answers; lower for plain paragraphs and correctly contained math scrollers. This is not a claim that every KaTeX display or every sticky header breaks.

**Evidence:** `content-visibility:auto` enables layout, style, and paint containment **even when the content is rendered**, not just while skipped (CSS Containment 2 §4). Paint containment clips descendant ink/scrollable overflow to the containment box's overflow clip edge and creates a stacking context. The fetched CSS deliberately permits wide blocks and negative centering shifts around @512600–514300; the turn-level boundary can clip these even if the wide child has a generous own width. KaTeX uses nonwrapping display content at @1782050 onward. However, CSS @1810859 gives `[data-math-display=true] .katex-display` `overflow:auto hidden`, so normal display math already has a horizontal scroll mechanism and is partly protected.

**Concrete fix:** opt in only ordinary text blocks whose overflow is known to stay inside their box; exclude math, wide blocks, code, tables, interactive widgets, and blocks with overlay/sticky controls. An exclusion must cover both the block **and every extension-contained ancestor**, including the turn; excluding only the equation child does not remove its turn's clipping. Portaled overlays outside these ancestors are unaffected. `overflow:visible` or a larger z-index does not undo paint containment; use `content-visibility:visible` for exceptions.

**Sticky qualification:** paint containment is not equivalent to adding an `overflow:auto` scroll container, and does not by itself make ordinary `position:sticky` stop working. Code receives a `stickyHeader` option (`731863.626bb34a55.js` @31365, @33807), and table headers are actually sticky (CSS @524442–524620). The concrete risks are clipped protrusion/stacking, changed geometry during activation, and unusual positioning ancestors—not an established blanket sticky regression. Accept ordinary sticky behavior pending the manual check below; exempt the entire relevant boundary if it fails.

### 4. Medium — Style containment can restart CSS-generated equation numbering

**Location:** `butter.css:3–13`.

**Scenario:** two separately rendered display-math blocks use KaTeX automatic equation numbering. The original document-scoped counter advances across them; with each answer block style-contained, a counter increment in one block no longer propagates out to the next. The second equation can repeat a number. Turn-level style containment also prevents progression between turns. This can change visible math references while leaving `textContent` unchanged because the number is generated by CSS.

**Likelihood:** low overall, high if those automatic-numbering environments are rendered in separate matched blocks. Explicit `\tag{...}` labels do not depend on these counters. Browser confirmation is required for the exact KaTeX inputs and renderer structure in this deployment.

**Evidence:** CSS @1781607 and @1781699 uses `counter-increment:katexEqnNo` / `mmlEqnNo` with generated `content`; @1782442 resets them on `body`. CSS Containment 2 §3.3 scopes counter increments to the style-contained subtree. The renderer calls KaTeX and inserts its HTML (`731863.626bb34a55.js` @8772–9500); display spans carry `data-math-display` and `data-math-source`.

**Concrete fix:** exempt answers/turns containing automatic-numbered math from extension containment, including all relevant ancestors, or materialize stable explicit numbers in the renderer. The latter needs a reliable renderer integration. Setting `contain:none` alone cannot disable containment implicitly enabled by `content-visibility:auto`. Accept if automatic numbering is explicitly out of scope and verified absent in supported content.

### 5. Medium — Independent fake-ID allocators or mismatched wrappers can cancel the wrong request

**Location:** `butter-main.js:11–12,20–45`.

**Scenario:** another MAIN-world extension wraps rAF first and returns monotonically decreasing negative IDs. An ordinary callback goes through Butter to that wrapper and receives `-1`. Butter then schedules a smoother callback and independently returns its own `-1`. Canceling the ordinary callback deletes Butter's pending smoother instead, leaving the ordinary callback alive. The smoother's `this.frame` is still non-null, so its 50ms drain loop does not schedule a replacement; intermediate publication can remain stuck until completion/reset. The fixture reproduced exactly this collision. Re-executing this bootstrap can create a similar second allocator.

A second interference path is another tool retaining Butter's request function but replacing/bypassing its cancel function: `destroy()` sends a fake ID to the wrong cancel implementation and the old timer can still publish after teardown. Playwright clock replacement can also create mixed generations: captured rAF/cAF are from installation time, while `setTimeout`, `clearTimeout`, and `performance.now` are read later.

**Likelihood:** medium when stacking scheduling extensions, manually reinjecting scripts, or installing clock mocks at the wrong time; low in the clean profile used for the replay. Ordinary forwarding wrappers that preserve IDs and pair request/cancel correctly can compose successfully.

**Evidence:** the ID namespaces are not coordinated; nonmatching IDs pass through unchanged at line 25 but matching IDs are minted independently at line 27. Lookup at line 40 cannot distinguish two owners of the same numeric ID. `fire` and the inner rAF callback do not check a canceled/generation flag. `manifest.json:15–16` makes this shared MAIN-world state, and does not establish ordering against other extensions. No installation guard is present.

**Concrete fix:** guard installation with a private shared marker and install/restore request and cancel as a pair. Prefer deriving exposed handles from the captured request API: reserve a handle with an initial captured rAF, then keep a mapping from that exposed handle to the timer/current real frame while delaying delivery. Both pass-through and throttled handles then come from the same lower allocator instead of independent `-1` sequences. Maintain canceled/generation state and test it in both timer and real-frame callbacks; use nullable IDs. Capture clock/timer primitives consistently, and install clock mocks before Butter or reload afterward. Arbitrary later replacement that bypasses Butter cannot be made fully interoperable: detect it and disable/reload the experiment rather than claiming universal compatibility.

### 6. Medium — The source fingerprint is too broad for a global API hook and can silently stop matching

**Location:** `butter-main.js:13–16,25`.

**Scenario:** a different store schedules `()=>store.publish()` or even `()=>{ /* .publish() */ draw() }`. Both satisfy the current zero-arity, under-80-character substring test, so unrelated painting receives 250ms delays and nonnative IDs. A future refactor to `()=>this.publish()` also matches without the smoother's frame-clear/lifecycle contract. Conversely, renaming `publish`, using `obj["publish"]()`, wrapping the callback for instrumentation, or increasing its source length makes the real smoother stop matching with no visible warning.

**Likelihood:** low for false positives in the supplied corpus, material over future deployments or with other injected scripts. Silent false negatives are likely eventually because these are private bundle details.

**Evidence:** across seven numbered JS files, a search found 36 literal `requestAnimationFrame(` sites and only one site with `.publish()` in the following 180 characters: `731863.626bb34a55.js` @7348. The actual callback at @7370 is `()=>{this.frame=void 0,this.publish()}`. Thus no second current app rAF match was established; the adversarial examples are demonstrated classifier counterexamples, not claims about discovered app callers. `.publish()` also appears in an unrelated editor method at @250711, but that occurrence is not evidence of a matching rAF callback. Bound/proxied functions may stringify as native code and miss safely.

**Concrete fix:** match the audited complete callback shape: zero-argument arrow, assignment clearing the same receiver's `frame`, immediately followed by that receiver's `publish`, and no other statements. Tolerate deliberate whitespace/minifier variations only when tested. Capture `Function.prototype.toString` once, fail open on inspection failure, and expose match/miss diagnostics plus a reload-based kill switch. Require a fresh fixture check on bundle changes. Do not broaden the match to every `publish` substring to regain performance.

### 7. Medium — Selectors survive hash changes but remain tied to private structure and utility spelling

**Location:** `butter.css:3,11,20–22`; `manifest.json:8,13`.

**Scenario:** the app changes the source component name, replaces its Tailwind container utility with a module class, wraps all markdown blocks in one extra element, or switches renderer. The extension then silently loses an optimization or applies containment to the whole new wrapper/widget. In a different route sharing the app shell, the prefix-based container override can also affect a page that was never benchmarked. The manifest matches every path on chatgpt.com.

**Likelihood:** high over time; deployment frequency is unknown. The extension already anticipates hash churn, but handles only that one form of change.

| Selector | Dependency and concrete hardening |
| --- | --- |
| `[data-turn-key]` | Not hashed or Tailwind-generated; a private virtualizer identity marker. More stable than presentation classes, but targets measured rows and any other use of the attribute. Scope to the verified conversation root, validate expected row structure/counts, and disable on unfamiliar layouts. Do not replace it with a guessed hashed class. Prefer removing this rule for finding 2. |
| `[data-markdown-text-style="assistant-message"] > *` | Private semantic marker plus direct-child structure. A wrapper insertion reduces granularity to one entire answer; new child widgets gain containment indiscriminately. Scope to the conversation/assistant root and opt in audited text block kinds with explicit rich-content exceptions. A renderer lacking this marker should fail open; do not blindly apply the same rule to custom renderers. |
| `[class^="MainContentFrame-"], [class*=" MainContentFrame-"]` | Explicitly tied to a CSS-module **source name**. It survives `sss8BP` changing but not a component rename; its scope is all matching shell frames. Select candidate ancestors of a semantic thread marker and verify `getComputedStyle(el).containerName` includes `app-shell-main-content` before tagging an extension-owned attribute. That detects the role better, but does not solve finding 1: preserving the container is preferable. |
| `div.\[container-type\:inline-size\].min-h-full` | Exact Tailwind arbitrary-class token plus a generic utility/tag. Breaks if `min-h-full` changes, the tag changes, or the same semantics move into a module class; can match unrelated wrappers. The supplied JS provides `[data-thread-user-message-navigation-content]` inside the intended wrapper (@1567600 onward). From that marker, verify the nearest intended ancestor's computed `containerName` includes `thread-content`; tag it only after validation. A literal `[container-name:thread-content]` **class** selector is still a Tailwind dependency, not a real DOM attribute. |

**Evidence:** concrete class/container definitions and DOM creation are cited in findings 1–2. `731863.626bb34a55.js` @136277 emits the markdown marker from a prop rather than promising a stable public DOM contract. The existing comments document only the hash assumption, not these other dependencies.

**Concrete fix:** add scoped, one-time/route-change validation and cheap diagnostic counts, then fail open on unfamiliar DOM. Do not add a full-document scan on each frame. Broader selectors are not a durability fix if they apply unsafe containment to more features. The computed-container discovery above would require a separately reviewed implementation, not another global CSS guess.

### 8. Low — Shared `lastRun` does not enforce the documented interval across multiple smoothers

**Location:** `butter-main.js:9–10,20,29–34`.

**Scenario:** two matching callbacks are scheduled before either has run, or during the same 250ms wait window. Each independently chooses its wait from the same old `lastRun`; both can enter the same native frame and publish together. A newly created smoother can also inherit an unrelated smoother's delay. Therefore “at most once per smoothMs” holds for the current single instance with its one-pending-frame guard, not as an aggregate global limit. A page with several independently smoothed blocks can still produce a burst of React work.

**Likelihood:** low in the single-answer replay; higher with independently smoothed blocks. No text loss follows from this alone.

**Evidence:** inline fixture scheduled two matching callbacks and observed two deliveries in the same frame. The smoother's `null==this.frame` check is per instance (`731863.626bb34a55.js` @7330), whereas the extension's timestamp is shared by the entire window. That bundle @14970 onward can use a supplied buffer or construct a new one per smoothing component.

**Concrete fix / accept:** explicitly accept and document per-buffer approximate throttling if the goal is one stream, with aggregate bursts allowed. If an aggregate limit is intended, keep a FIFO of pending callbacks, recheck elapsed time at delivery, deliver one, and reschedule the remainder; document increased latency with N buffers. For independent per-buffer intervals, integrate at a verified buffer-instance seam. A WeakMap keyed only by callback is not sufficient because each scheduling arrow is a new function.

### 9. Low — Truthy ID sentinels and fake-ID coercion do not preserve the native cancellation contract

**Location:** `butter-main.js:28,39–44`.

**Scenario:** the underlying implementation/mock returns real rAF ID `0`; destruction deletes the fake entry but skips `caf(0)` because `entry.realId` is falsy. The queued callback subsequently publishes. Separately, a caller that normalizes a returned ID to an unsigned integer or passes its string form will miss the exact negative-number Map key, despite native `cancelAnimationFrame` accepting Web IDL numeric conversion.

**Likelihood:** very low with this actual smoother and ordinary short-lived Chrome pages: it preserves the exact returned number. ID zero is an overflow/mock edge case, not a normal first native handle. A fixture returning zero reproduced the canceled callback still running.

**Evidence:** line 44 uses `if (entry.realId)`. HTML's cancellation argument is `unsigned long`; native IDs should be treated as opaque, not assumed to stay positive/nonzero forever. Sending an unrecognized negative ID through native cancellation also converts it modulo 2^32, so a stale negative can theoretically target a high native handle. Negative fake IDs normally avoid ordinary small native IDs; no practical native-overflow collision or unbounded Map leak was demonstrated in this replay.

**Concrete fix:** use `null` for inactive timer/frame IDs and test `!== null`, with a canceled flag guarding delivery. Prefer the common underlying-handle allocator described in finding 5 to avoid introducing negative/unsigned conversion problems. Accept overflow-only collision risk if explicitly documented, but the zero-sentinel fix is inexpensive. The fake counter reaching JavaScript integer-precision exhaustion is not a credible lifetime risk at these rates.

### 10. Low — `smoothMs` is trusted without finite-number validation

**Location:** `config.js:2–5`; `butter-main.js:3–5,33–34`.

**Scenario:** a benchmark/user edit sets `smoothMs: "250"`. The `> 0` check accepts it, but `lastRun + smoothMs` concatenates: with `lastRun=1000` and current time 1000ms, the requested wait is 999,250ms instead of 250ms. Intermediate output can look frozen for more than 16 minutes. Infinity/oversized delays instead overflow the timer range and can remove the intended throttling. A zero/negative value already intentionally disables the hook.

**Likelihood:** low with the shipped numeric literal; plausible because `config.js:1` explicitly says benchmarks override the file.

**Evidence:** the code does not coerce/validate before addition. There is no settings UI or untrusted network configuration in the supplied files, so this is a configuration robustness defect, not an established security issue.

**Concrete fix:** require `typeof smoothMs === 'number' && Number.isFinite(smoothMs)`, enforce a documented sensible upper limit well below the timer maximum, and either reject invalid values with a diagnostic or fall back to 250. Preserve the intentional nonpositive kill switch. Accept the current code only if config is guaranteed generated from validated numeric inputs.

## Requested concerns that are not established defects

### Teardown, background delivery, `this`, timestamps, and leaks

- **Timer fires after `destroy()`:** with native paired APIs in one JS event loop, destruction either clears the timeout before it executes, or cancels the real frame after `fire()` executes. JavaScript tasks do not interleave inside `fire()`. If the publication has already begun, cancellation cannot undo it, just as with native rAF. The actual `destroy()` clears its own 50ms timer and accepts negative frame IDs via `null!=this.frame` (`731863.626bb34a55.js` @6056). The actual-class fixture confirmed teardown after the throttle timer fires. **Accept** for the current single installation; add canceled/generation guards for the interoperability cases in finding 5.
- **Background tabs:** if hidden rAF never runs, a timer that eventually fires merely queues a real frame. That intermediate publish can remain pending indefinitely **while the page remains hidden/frozen**; native rAF has the same lack of a hidden-page delivery deadline. Under the supplied class's one-pending-frame guard, this is one retained callback per live buffer, not an accumulating timer per 50ms tick. On foreground/resume, a normally functioning captured rAF delivers it. Browser discard/navigation destroys the realm; no wrapper can promise delivery through that.
- **No lost final publication found:** nonactive updates synchronously call `destroy()`, reveal all source, and `publish()` (@5587–6252). They do not wait for the throttled rAF. Visibility also feeds smoothing enablement: @15000 defines `C=x&&!w&&I`, @15800–16042 supplies `I` from `visibilitychange`/`document.visibilityState`; when that effect runs, hidden state can bypass smoothing entirely. The VM tested the stricter case where rAF remained paused without simulating React's visibility rerender. **Accept** eventual visible delivery and synchronous completion; a hard requirement to notify hidden subscribers would need an explicit separate timeout delivery policy, not merely a timer that still waits on rAF. OS/browser suspension cannot have a JS wall-clock guarantee.
- **`this`:** the actual matching callback is an arrow and preserves its lexical smoother instance when called as `cb(t)`. No binding bug was found. HTML/Web IDL invokes rAF callbacks with an unspecified callback receiver defaulting to `undefined`; strict functions receive `undefined`, sloppy functions substitute their realm's global, and bound/arrow functions retain their own binding. Do not unconditionally “fix” this with `cb.call(window, t)`. For clarity a future wrapper can use `Reflect.apply(cb, undefined, [t])`. A prior wrapper deliberately providing a different receiver is a separate nonnative contract to document.
- **Timestamp:** the delivered `t` is the real scheduled frame's timestamp, not timer time or the original request time. That is appropriate for a delayed rAF; all callbacks within a native frame can share that value. `lastRun=performance.now()` is a separate elapsed-time throttle clock, so small differences from `t` are expected. The current smoother uses its own `performance.now()` and ignores `t`. **Accept** both choices; keep the clocks consistent when introducing mocks.
- **Map lifecycle:** normal delivery deletes the entry before invoking user code (even a throwing callback does not leave that entry); normal cancellation deletes it and clears both stages. There is no systematic leak with native asynchronous rAF. A stalled hidden request retains its callback until delivery/cancel, similarly to native rAF. A broken wrapper that never delivers/cancels, bypassed cancellation, or mixed scheduler generations can retain it; apply finding 5. Never use an arbitrary TTL that silently drops a live smoother callback: it can strand `this.frame`.

### Find, selection/copy, margins, sticky content, and print

| Human-visible scenario | Evidence and disposition |
| --- | --- |
| Ctrl+F for text in an off-screen mounted answer | `auto` must keep skipped contents available to find-in-page, unlike `hidden` (CSS Containment 2 §4). **Accept expected findability**; do not claim it is inherently broken. Activation can still cause the size/alignment changes in finding 2. App-unmounted historical turns are a separate virtualizer limitation that this CSS cannot make searchable. Test a never-rendered hit and repeated next/previous hits. |
| Drag/Shift-select across several skipped blocks and copy | `auto` content must remain selectable; selected contents are relevant and should render. **Accept native selection/copy semantics**, pending browser verification. A large selection may activate a large subtree and erase the performance benefit; that is a sensible cost of preserving behavior. The app's selection toolbar reads Range/element rects (`431882.155aa23127.js` @30757–32767), so initial activation can cause expensive geometry work or a transiently misplaced toolbar. If reproducible, temporarily disable extension containment in the selected answer and wait for layout before toolbar positioning; do not suppress selection or clipboard events. Compare actual pasted text, not just answer textContent. |
| Adjacent paragraph spacing versus parent/child margin collapse | Independent formatting contexts stop margins from collapsing **through** a contained boundary and stop empty-box collapse. They do **not** automatically make every pair of adjacent sibling outer margins add instead of collapse. Ordinary sibling paragraph spacing need not change. A new wrapper with a first/last child's external margin can acquire extra space even on screen. CSS @514316 onward and @515790 onward uses paragraph/list/block margins; the universal child selector offers no structural exemption. **Accept current ordinary paragraph behavior pending a screenshot-free visual check by the human**; exempt a failing wrapper or preserve its intended spacing with audited explicit margins/padding. Do not globally zero margins. |
| Code/table headers stay sticky while the answer scrolls | See finding 3. **Accept normal sticky behavior pending validation**; inspect clipping and layering rather than assuming `auto` creates a new scrolling box. Test both vertical thread scroll and horizontal code/table scroll, including first activation. |
| Print/PDF before scrolling through history | `butter.css` has no print exemption, so its implicit containment remains applicable. The site's dedicated print CSS resets code containment/overflow and avoids breaks in headings/tables (CSS @495211 onward, @547521 onward), but does not reset the extension's `content-visibility`. Printing should make printable content render in a conforming implementation; **omitted off-screen text was not demonstrated**. Risks still include clipping from finding 3, changed counter scope from finding 4, and pagination interaction with layout containment. Dedicated print output may have different matching DOM. Concrete hardening: limit these optimizations to screen and explicitly disable them on `[data-conversation-print]`, or add the reset below. A reset does not remount history removed by the app's own virtualizer. Test both browser Ctrl+P and any app print/export path. |

Suggested print reset, to be implemented separately if this experiment continues:

```css
@media print {
  [data-turn-key],
  [data-markdown-text-style="assistant-message"] > * {
    content-visibility: visible !important;
    contain-intrinsic-size: none !important;
    contain: none !important;
  }
}
```

`contain:none` by itself is insufficient while `content-visibility:auto` still implicitly enables containment. Screen-only scoping also avoids the stylesheet applying its `container-type` override to print; the preferred fix for that override remains finding 1.

### Fingerprint overhead: estimate, not a measured page call rate

`Function.prototype.toString` runs on **zero-arity function registrations**, not on every node, every turn, or every call rejected by the arity/type check. There are 36 literal registration sites in the supplied seven bundles; that is a static count, not a calls-per-second measurement. Several sites are inactive/conditional. A few active animation loops plausibly produce 60–600 registrations/s at 60Hz (1–10 loops), or 144–1,440/s at 144Hz. These are sizing scenarios, not claims that all those loops run in ChatGPT. Actual source inspection should be paired with a registrations counter during profiling.

The smoother itself is not unconditionally a 60Hz loop: `updateBufferedState()` owns a 50ms retry timer (@6392–7542), and network updates can also call it. Before throttling, 20/s from that timer plus packet-driven work can lead toward display-frame rates; after throttling, the non-null frame guard normally reduces **matching rAF registrations** to roughly 4/s per continuously dirty buffer. Its internal 50ms updates can continue in the meantime.

An inline Node/V8 microbenchmark of the current type/arity/toString/length/includes sequence over four reused functions measured about **70 ns/registration** across 2 million warmed calls. This is not a Chrome/page benchmark; fresh closures, source materialization, large functions, wrappers and GC may differ substantially. A conservative planning allowance of **1–10 microseconds per inspected registration** would cost 0.06–0.6ms/s at 60/s, 0.6–6ms/s at 600/s, or 1.44–14.4ms/s at 1,440/s. The function string is materialized before the length-under-80 rejection, so occasional large callbacks merit profiling. Nothing here supports blaming this small hook for a multi-second layout stall.

**Accept** the overhead for this experiment unless the measured registration rate/source allocations are unexpectedly high. Capture the source intrinsic once and count registration/inspection/match rates. A WeakMap can cache classification for reused callback identities; it will not help newly allocated smoother arrows. Do not add stack traces or console logging per registration to the production hook.

## Short manual browser checklist

These checks are for a human; none was performed in this review. Compare extension enabled/disabled on the same conversation and viewport.

1. **Cold geometry/navigation:** reload at the bottom of a long mixed-content chat; jump to an old, never-viewed turn, then End/PageUp and back. Resize/zoom while reading the middle. Check for blank bands, wrong jump alignment, a moving reading position, and eventual reachability of the latest token.
2. **Responsive/rich content:** test widths below 53.5rem and above 900px, with sidebar/floating panel open. Inspect a wide table/diagram, long display equation, code block and sticky table/code headers, including horizontal scroll and first activation. Check two separately auto-numbered equations against explicit tags.
3. **Find and copy:** Ctrl+F a unique term in an off-screen mounted answer, repeat next/previous, then select across several turns/blocks and paste into plain text. Check missing text, jump alignment and toolbar positioning. Repeat with an equation in the selection.
4. **Streaming lifecycle:** stop/regenerate, navigate away midstream, and replace a stream while a 250ms delay is pending. Hide the tab for more than a minute and return both before and after completion. Confirm final copied output, no old-answer flashes, and no stuck partial answer; the small exposed stats do not prove the private pending Map is empty.
5. **Print:** print/PDF immediately after a cold load, then after traversing history. Compare first/middle/last answers, long tables/code, equation numbering and page breaks; exercise both browser and app printing if available.
6. **Compatibility/performance:** repeat a short lifecycle check with the actual other scheduling extensions/Playwright setup. Install clock mocks before page initialization. Count all/inspected/matching rAF registrations for a short trace, with and without Butter, and inspect allocations only if that rate warrants it. Confirm expected matcher activity after a deployment change.

## Done check

`notes/review.md` exists. Findings are ranked; each has a failure scenario, likelihood, source evidence, and a concrete fix or explicit acceptance condition. All requested scheduler/CSS/selector concerns are covered. Only this project file was written; no implementation changes, browser automation, or login were performed.
