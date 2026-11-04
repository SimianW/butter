> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter / ChatGPT scroll diagnosis — 2026-11-01

No fix applied. All research files are under `(not archived)`; no repository files were edited.

## Findings

**Submission reproduced the animation; focus and typing did not.** The send animation belongs to ChatGPT's thread-end placement controller. A Motion spring drives repeated **instant** `scrollTo` calls on `.thread-scroll-container`. Its frame clock caps each delta at 40 ms, so dropped frames extend the wall-clock animation. ChatGPT's rendering, virtualizer measurements, style and layout account for the substantial costs observed; Butter's directly attributed work is small in this capture.

This is a bounded observation of the supplied chat: the server has 7 user turns / 48 mapping nodes. After loading its older page, the history rail had 7 ticks. I reproduced a roughly 9,000-pixel trip with substantial dropped frames, not a many-second traversal of hundreds of turns. I did not establish that every instance of the user's report has the same trigger or cost.

## 1. Trigger

All tests used the already-open supplied chat and the existing headed Chromium on CDP port 9222. The thread viewport was 912 pixels high. After the history rail loaded the older turns, the scroll height was approximately 11,324 pixels. Normal test setup scrolled instantly to 1,800 pixels and then used a real 100-pixel wheel event to release Butter's rail alignment. Measurements began at scrollTop 1,900 after a 3-second settling period.

| Action | Observation window | Thread position before / after | Thread API calls / scroll events |
|---|---:|---:|---:|
| DOM `.focus()` | 3,773 ms | 1,900 / 1,900 | 0 / 0 |
| Actual mouse click in composer | 3,847 ms | 1,900 / 1,900 | 0 / 0 |
| Real `keyboard.press('x')` | 3,834 ms | 1,900 / 1,900 | 0 / 0 |
| Repeat real `x` | 3,825 ms | 1,900 / 1,900 | 0 / 0 |
| `keyboard.insertText('x')` | 3,779 ms | 1,900 / 1,900 | 0 / 0 |
| Real `x` after rail landing, no wheel release | 3,823 ms | 20 / 20 | 0 / 0 |
| Enter with intercepted local send, first isolated run | 3,943 ms total recording | 1,900 / 10,958 | 33 / 27 |
| Enter with intercepted local send, repeat | 3,969 ms total recording | 1,900 / 10,958 | 33 / 27 |

Typing generated 18 `scrollTop` setter calls on composer ancestors, including `DIV.contents`, from **ProseMirror**, with no thread scroll events. Do not mistake these for the reported history scroll. Example captured stack:

```text
F                         617936.ae7778a590.js:73:339928
tH.scrollToSelection      617936.ae7778a590.js:73:424215
tH.updateStateInner       617936.ae7778a590.js:73:423764
tH.dispatchTransaction    396705.6b0f9c5f16.js:10:776415
```

Evidence: `focus.json`, `click.json`, `keystroke.json`, `keystroke-repeat.json`, `type-insert.json`, `rail-keystroke.json`; each contains before/after states, all wrapped calls, frames, mutations and performance entries. `summary.json` / `summary-output.txt` provide compact derived results. Conversation preparation POSTs initiated by typing were blocked; this is a safety-related difference from an unrestricted typing test.

## 2. Mechanism and responsible source

Instrumentation ran in the page's main world through CDP **Runtime.evaluate**. Reset runs used **Page.addScriptToEvaluateOnNewDocument** with `Page.enable` before reload, then removed that registration. The probe wraps Element/Window `scroll`, `scrollTo`, `scrollBy`, `scrollIntoView`, the Element `scrollTop` setter, and window rAF, preserving native behavior. It observes scroll events, rAF timing, DOM turn additions/removals, long tasks and Long Animation Frames. The complete probe is `probe.js` and driver is `run.mjs`.

Every thread write captured in the isolated send was:

```js
threadScrollContainer.scrollTo({ behavior: 'instant', top: /* changing number */ })
```

No `scrollIntoView`, `scrollBy`, native `behavior:'smooth'`, or thread `scrollTop` setter writes caused this send animation. Computed `scroll-behavior` was `auto` before and after. Early writes compensate for spacer / layout changes; the next writes advance the spring.

The complete recurring captured stack (full URLs are retained in the JSON):

```text
U                         https://chatgpt.com/cdn/assets/982651.b54a722d42.js:244:351082
callback                  https://chatgpt.com/cdn/assets/982651.b54a722d42.js:260:10206
Q                         https://chatgpt.com/cdn/assets/982651.b54a722d42.js:244:351657
compensateScrollToDistanceFromBottomPx
                          https://chatgpt.com/cdn/assets/982651.b54a722d42.js:260:10206
Object.onUpdate           https://chatgpt.com/cdn/assets/901075.5cc9ea5885.js:1:94701
onUpdate                  https://chatgpt.com/cdn/assets/617936.ae7778a590.js:73:134367
v.tick                    https://chatgpt.com/cdn/assets/617936.ae7778a590.js:73:118909
(anonymous)               https://chatgpt.com/cdn/assets/617936.ae7778a590.js:73:120004
```

The first compensation call instead has `Object.place` at `901075.5cc9ea5885.js:1:94011`, called by `onSubmitAccepted` at `751731.f6cc1c5815.js:1:211956`. This ties the mechanism directly to submission acceptance.

All loaded ChatGPT bundle source was saved using `Debugger.enable`, `Debugger.scriptParsed` and `Debugger.getScriptSource` by `sources.mjs`; `script-index.json` maps script IDs to full URLs. Local `bundles/` has 173 files. Relevant verbatim source excerpts:

**Scroll primitive `U`**, `982651.b54a722d42.js`, line 244, around column 351082:

```js
U=(e,t)=>{let n=tl.current;if(null==n)return;
let a=Math.max(0,t(n));a!==(0,I.a)(n)&&(ty.current=null);
let r=Math.max(0,n.scrollHeight-n.clientHeight-a);
n.scrollTop!==r&&n.scrollTo({behavior:e,top:r});
let i=(0,I.a)(n);
tf.current="instant"===e&&i!==a&&a>0&&a<n.scrollHeight-n.clientHeight?
 {requestedDistanceFromBottomPx:a,actualDistanceFromBottomPx:i}:null,tN(i)}
```

**Compensation primitive `Q`**, same line around column 351657:

```js
Q=e=>{tS.current||tF("instant",()=>e)}
```

**Placement controller**, anonymous exported class in webpack module `KFm7`, `901075.5cc9ea5885.js`, line 1, around columns 94011–94837:

```js
animatePlacement=()=>{let e=this.scrollController.getScrollElement();
if(null==e)return;let t=Math.max(1,this.getPlacementDistancePx(e));
if(!this.prefersReducedMotion){
 let e=this.scrollController.getLastScrollDistanceFromBottomPx()-t;
 if(e>0){let t=0,n=!1,r=(0,l.a)(0,e,{...o.g,
  driver:e=>{let t=0,n=n=>{let{delta:r}=n;e(t+=r)};
   return{start:()=>{a.b.update(n,!0)},stop:()=>{(0,a.a)(n)},now:()=>t}},
  onUpdate:e=>{if(n)return;
   let r=this.scrollController.getUnroundedScrollDistanceFromBottomPx(
    this.scrollController.getLastScrollDistanceFromBottomPx());
   this.scrollController.compensateScrollToDistanceFromBottomPx(Math.max(1,r-(e-t))),t=e},
  onComplete:()=>{this.stopPlacementAnimation=null,
   this.scrollController.compensateScrollToDistanceFromBottomPx(
    this.scrollController.getUnroundedScrollDistanceFromBottomPx(
     this.scrollController.getLastScrollDistanceFromBottomPx()))}});
 this.stopPlacementAnimation=()=>{n=!0,r.stop()};return}}
this.scrollController.scrollToDistanceFromBottomPx(t,"instant")}
```

`o.g` is exported as `m` from webpack module `V8uZ` in `982651.b54a722d42.js`:

```js
m={type:"spring",bounce:0,duration:.5}
```

Its scheduler is webpack module `VAXu` / `p5Yg` in `617936.ae7778a590.js`. It obtains rAF once when the module initializes, and updates its timing with:

```js
a.delta=o?1e3/60:Math.max(Math.min(s-a.timestamp,40),1)
```

Thus the driver accumulates **clamped frame deltas**, not raw elapsed wall time. A 150 ms frame contributes at most 40 ms of spring progress. This is a concrete reason the nominal half-second animation becomes longer when rendering stalls.

There is another cubic rAF scroll-to-bottom path (`X`, nominal 260 ms) in `982651`, but the captured submit stacks go through the **placement spring**, not `X`. The rAF wrapper's `raf` field is null for these calls; API stacks and the scheduler's source establish the mechanism. Do not use that null field as evidence of native scrolling.

## 3. Cost

The recorded SSE answer was held for **15 seconds** in the isolated runs. Measurements stopped around 4 seconds after submission, while `replay.done` was still false. Therefore these metrics include submission and virtualizer traversal, but **exclude replayed answer rendering**. The script then let the local replay finish before exiting.

Quantiles below use only frames from measurement start through the final scroll event plus 20 ms, using the same sorted-array quantile indexing as the repository benchmark. Whole-recording p95 is approximately 16.8 ms because idle time after arrival dominates; reporting that as the animation p95 would hide the jank.

| Metric | Isolated send | Repeat, no profiler | Profiled send |
|---|---:|---:|---:|
| Trigger to final scroll | 764.7 ms | 814.5 ms | 896.8 ms |
| First to final visible scroll event | 595.5 ms | 619.3 ms | 647.7 ms |
| Active frame count | 27 | 27 | 29 |
| Frame p50 | 16.7 ms | 16.7 ms | 16.7 ms |
| Frame p95 | 116.7 ms | 116.7 ms | 166.6 ms |
| Worst frame | 149.9 ms | 183.4 ms | 233.4 ms |
| Long tasks during action | 3 | 3 | 2 |
| Longest task | 160 ms | 186 ms | 237 ms |
| Long Animation Frames during action | 3 | 3 | 3 |
| Longest LoAF | 170.7 ms | 196.6 ms | 249.5 ms |
| Total LoAF blocking duration | 188.3 ms | 239.2 ms | 290.1 ms |
| Thread `scrollTo` calls | 33 | 33 | 33 |
| Turns mounted / removed | 3 / 3 | 3 / 3 | 3 / 2 |

The three turn additions include **two previously virtualized existing turns plus the new local user turn**. No turn keys were repeatedly mounted in these runs. Counts measure `[data-turn-key]` DOM lifecycles, not React render counts. Five turns were present initially; the unprofiled run ended with five, and the profiled run with six.

Example unprofiled mount timings, relative to measurement start: at 231.9 ms one existing turn mounted; at 310.5 ms another existing turn mounted and two old turns unmounted; at 422.4 ms the new local user turn mounted and one old turn unmounted. See `send-isolated.json` → `mounts` for exact keys / absolute timestamps.

**Attribution from LoAF:** first isolated run has a 158.2 ms composer keydown script, including 30.6 ms forced style/layout. The next long frame contains ChatGPT React scheduler `T` (28.8 ms / 13.4 ms forced style/layout) and a ChatGPT `ResizeObserverCallback` in `901075` (55.0 ms / 40.6 ms forced style/layout). The third contains scheduler `T` (60.7 ms / 32.7 ms forced style/layout). No Butter script appears in these long-frame script entries.

**Trace:** `send-isolated-trace-trace.json` is the raw Chrome trace. Enabling its CPU profiler caused a separate approximately 5.1-second instrumentation-startup stall **before the action**. An earlier exploratory trace additionally included burst rendering of the replayed answer. Neither is a valid measure of scroll duration. `crop-trace.py` extracts keydown through final scroll plus 50 ms, excludes the startup stall, and filters CPU samples to the page's renderer PID. The cropped trace is `send-animation-only-trace.json`.

Actual output from the repository analyzer, for the 941.8 ms cropped window:

```text
span 0.9s  busy 0.8s
exclusive ms: FunctionCall 311, Layout 111, UpdateLayoutTree 84,
RunTask 65, Layerize 52, RunMicrotasks 17, PrePaint 15
UpdateLayoutTree: total 85ms
Layout: total 111ms
```

Largest forced layout paths include ChatGPT `r` at `396705.6b0f9c5f16.js:43:527912` (53 ms layout over two calls), and virtualizer `Z` at `901075.5cc9ea5885.js:1:62849` called through `eM` / React commit (20 ms style plus 14 ms layout over two calls). Butter's rail IntersectionObserver had approximately **1 ms layout**. The trace also attributes **15 ms style** to the probe's scroll listener, which reads geometry; instrumentation has a measurable observer effect.

Filtered CPU sample self time in the same window: ChatGPT bundle JavaScript **236.5 ms**; Butter **2.0 ms**; probe **3.5 ms**; browser/native/other including idle **700.1 ms**. Native costs inside script calls are not included in a JavaScript function's self time. These are sampled estimates, not a complete additive ownership model. In particular Butter's CSS can affect ChatGPT layout without appearing as Butter JS. No extension-disabled ablation was performed, so this establishes low direct Butter execution cost, not zero indirect Butter influence.

CDP interval counters for the first unprofiled run's full 3.943-second observation: TaskDuration 800 ms, ScriptDuration 241 ms, RecalcStyleDuration 203 ms, LayoutDuration 21 ms. Trace accounting includes more rendering-thread work than these CDP counters; do not mix them into one percentage breakdown.

## 4. Interception constraints

- **Repeated writes:** 33 calls, including compensation before motion and a final `onComplete` compensation. A one-shot conversion of a native smooth-scroll request cannot address this observed path.
- **Readback:** `U` immediately recomputes distance from bottom after the write and records requested/actual mismatches in `tf.current`. Every spring `onUpdate` reads the controller's last/unrounded distance and subtracts the *incremental* spring movement. Unexpected jumps can therefore feed into following updates. No interception experiment was run; this risk is established by source and repeated call stacks.
- **Placement target and spacer:** `place` calls `holdViewport()`, adjusts an end spacer using `writeHeight`, compensates distance from bottom, then animates. `getPlacementDistancePx` measures the submitted user-message target with `getBoundingClientRect` and padding. It intentionally places that target near the top of the viewport, so arrival is not necessarily literal `scrollHeight - clientHeight`. In the isolated run the final bottom gap was 195 pixels (height 12,065, viewport 912, scrollTop 10,958).
- **Virtualization and observers:** React commits and ResizeObserver callbacks compensate scrolling as turn geometry changes. The thread controller has separate sticky-bottom state, distance listeners, a 24-pixel near-bottom threshold, user-scroll direction handling and growth compensation. ResizeObserver and turn commits are directly present in captured stacks. IntersectionObserver work was present in the trace, but no evidence establishes that IntersectionObserver initiates this send animation.
- **Cancellation/restart:** source for module `Ho4C` installs capture/passive `wheel`, `touchstart`, `pointerdown`, and `keydown` handlers on the scroll element to stop placement animation. `reconcileViewport` can stop/restart placement when viewport height or scroll padding changes. These are source-level observations; I did not separately trigger every branch.
- **rAF interception:** Motion module `p5Yg` captures `requestAnimationFrame` at initialization. Replacing only the global later may miss it. Butter's existing smoother hook matches one exact streaming-publish callback and this placement animation does not match it.
- **Reduced motion:** the placement controller bypasses the spring when `prefersReducedMotion` is true. This was observed in source, not tested as an alternate configuration.

## Safety, environment and cleanup

No real message was sent. The main-world hook intercepts every POST matching `/backend-api/f/conversation` and returns a local `ReadableStream` using recorded SSE chunks. Message UUIDs and conversation UUID are remapped to the local attempted submission. All other non-GET conversation/response/completion requests fail closed; a browser routing firewall separately blocks any corresponding request that escapes the hook. Exactly one conversation POST was locally intercepted in each send run; no escaped write reached the browser firewall. Preparation requests were blocked by either the hook or firewall.

`before-server.json` and `after-server.json`, fetched read-only using the same approach as `convcheck.mjs`, are identical: 48 nodes, 7 user IDs, identical current node. The post-run clean reload discards fake turns and restores all temporary wrappers. The composer is empty and the URL is the original supplied chat. Git status was empty before and after research.

The installed extension directory is `~/snap/chromium/common/butter-blank-head`, reporting 0.1.0-alpha.7, with legacy `turbo-*` filenames. After normalizing the Butter/Turbo rename, config, CSS, stream smoother, CV and network hooks match this checkout. The loaded nav differs in two spots: it calls `endOpening()` on every keydown, and lacks a final forced-alignment branch present in this checkout. I left the installed build untouched, as requested. Results describe the actual supplied browser; no claim of exact installed-source equivalence is made.

## Reproduction and actual commands/output

Scripts and all evidence are in this directory. Required runtime dependency is the already-installed `(not archived)`; no npm install or repository edit was needed. Recording used: `~/Dev/butter/lab/harness/recordings/t09.json` (189 chunks).

Main commands executed, in order of their role (exploratory repeats omitted here; raw test outputs are linked below):

```bash
lab/lab status
node (not archived)
node (not archived) server before-server
node (not archived) reset
node (not archived) prep
node (not archived) focus
node (not archived) click
node (not archived) keystroke
RUN=keystroke-repeat node (not archived) keystroke
RUN=type-insert node (not archived) type
RAIL=1 RUN=rail-keystroke node (not archived) keystroke
RUN=send-isolated node (not archived) send
RUN=send-repeat node (not archived) send
TRACE=1 RUN=send-isolated-trace node (not archived) send
node (not archived)
python3 (not archived)
python3 lab/harness/analyze-trace.py (not archived)
python3 (not archived)
python3 (not archived) --fail-on-jank
node (not archived) server after-server
node (not archived) cleanup
git status --short
```

`lab status` actual relevant output: Chromium running (PID 2422635), extension path above, CDP `http://127.0.0.1:9222`. `sources.mjs`: `saved 173 ChatGPT sources`. Server snapshots each printed `nodeCount: 48, userCount: 7, current_node: '<id>'`. Cleanup printed `clean  <chat>`. Git status printed nothing.

`summary-output.txt` is the actual JSON-lines summary output for every table row, followed by:

```text
SERVER_UNCHANGED True nodes 48 user_turns 7
TRIGGER_CHECKS_PASS: focus, click, keystrokes, insertText, rail keystroke did not scroll
```

`repro-verdict.txt` adds `RED: REPRODUCED repeated instant-scroll animation with janky frames` and exits **1**, deliberately signaling the bug. This evaluates already-captured data.

For an end-to-end **fresh** reproduction, run `(not archived)`. It resets/reloads, snapshots server state, loads history, measures focus / a keystroke / local send, checks the recorded animation, then cleans up via an EXIT trap. Exit 1 means the specified janky animation reproduced. Its actual output is saved as `reproduce-output.txt`. This takes tens of seconds because it includes reload, history loading, settling and waiting for the safely delayed local replay; the measured action itself remains subsecond.

Evidence files contain conversation identifiers but no auth tokens or headers. Raw tracing and source files are kept local. Read-only auth access follows the existing harness and never prints the credential.

Fresh end-to-end actual output (`(not archived)`, exit 1):

```text
RED: REPRODUCED travel_ms 605.3 p95_ms 99.9 calls 32
nodeCount: 48, userCount: 7, current_node: <id>
clean  <chat>
```

The fresh before/after server snapshots also compare identical.
