> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Independent review of Butter's uncommitted height-cache and pre-jump change

Reviewed working tree against HEAD `9d6cad4fe890a8c523731ed20f261e754d966832`, including `extension/butter-height-cache.js` and `test/butter-height-cache.test.mjs`. No repository files were changed and no work was delegated.

**Recommendation: request changes.** The streaming regression is reproducible in all three changed runs, and browser fixtures demonstrate incorrect cached geometry after a width change and an answer replacement.

## Findings, ranked by severity

### 1. P1 — The height-cache path materially regresses streaming responsiveness (confirmed)

**Location:** `extension/butter-cv.js:68-85` (publishing cached styles); `extension/butter-height-cache.js:40-44` (new selectors); longer-lived observers and per-record work are at `extension/butter-cv.js:99-170`.

**Scenario:** run the existing default 189-chunk streaming replay into the specified long math chat, scrolling and typing during the answer. Every changed run froze the page for more than twice as long as every HEAD run. Median blocked time rose from 3.607 s to 12.173 s, frame p95 from 16.8 ms to 33.4 ms, and the slowest keystroke from 357.5 ms to 428.9 ms. Median longest freeze rose from 581 ms to 1249 ms. This violates the explicit requirement that Butter's streaming performance must not regress.

**Evidence:** raw `harness/results/bench/{head,change}/rep-{1,2,3}.json`; table below. RecalcStyleDuration was 12.241 s in HEAD run 2 versus 23.008 s in changed run 1; ScriptDuration was lower in that changed run. Changed runs consistently spent 21.1–21.8 s in rendering style/layout within long frames, versus 8.3–10.3 s on HEAD. A post-run DOM snapshot found 1623 new cached CSS rules in six groups. These measurements establish the regression of the whole change, not exclusive attribution to one selector or callback. Profiling/ablation is needed before choosing a fix; a bounded rule count by itself does not establish acceptable matching/invalidation cost.

### 2. P1 — A column width change can use old heights during the very commit this cache is meant to accelerate (confirmed browser fixture)

**Location:** `extension/butter-cv.js:99-105`; generated rules at `extension/butter-height-cache.js:40-44`.

**Scenario:** a sidebar/panel changes the thread column's width without changing the window size, and React remounts an off-screen turn and measures it in that same task. The old CSS rules remain active until ResizeObserver delivers after layout. The window resize listener does not cover a column-only change. A synchronous layout read therefore sees a height measured at the previous width; the virtualizer may save that wrong row height and later correct it, moving scroll geometry or a rail landing.

**Evidence:** `node (not archived)` loads the actual CSS, cache and CV sources. After warming a 768 px column with a 1200 px turn, it narrows to 384 px, remounts the same content and reads the row in the same task: cached height **1200 px**, actual height with the generated rules disabled **2400 px**. `width-fixture.json` contains the exact output. There is no CSS width guard, and RO invalidation cannot protect an earlier React layout effect. Invalidate before layout or constrain rule applicability to the actual width, rather than relying solely on a later RO callback.

### 3. P2 — Cache identity cannot distinguish regenerated or switched answers (confirmed geometry fixture; production trigger plausible)

**Location:** `extension/butter-cv.js:129`; `extension/butter-height-cache.js:37-44`.

**Scenario:** an assistant answer is regenerated, or the user selects a different answer branch under the same question/turn key, then that completed turn is remounted while off-screen. Identity consists only of turn key, child index, tag and first class. No assistant message/revision identity invalidates the earlier answer's whole-turn or block heights. The in-progress CSS gate suspends a rule but does not erase it; once complete, the old fallback becomes eligible again. A height update after the next render/flush is too late for the first virtualizer measurement.

**Evidence:** the browser fixture warms a 1200 px answer, replaces it with a fresh completed 100 px answer with the same turn key/tag/class, and measures **1200 px** for the remounted turn. Disabling only generated rules gives **100 px**. See `browser-fixtures.json`, `beforeRegenerate`, `afterRegenerate`, and `regenerateWithoutRules`. This demonstrates the geometry failure, but no real regeneration was sent, so the exact current production transition is not claimed as a live reproduction. Include answer/revision identity or invalidate the turn cache when its answer changes.

### 4. P2 — Conversation ownership follows the URL, while generated rules are global (confirmed fixture mechanisms; shared-ID production collision plausible)

**Location:** `extension/butter-cv.js:25`; `extension/butter-height-cache.js:37-44`.

**Scenario:** after SPA navigation, ChatGPT retains an old hidden scroller and inserts late blocks/turns into it. `stateFor` uses the new URL rather than the owning scroller, so late old-chat elements acquire the new chat's state; even one scroller's existing and newly inserted elements can belong to different caches. Width bookkeeping can then refer to another state's column/cache. Separately, two conversation caches with a shared turn ID emit indistinguishable global rules. The later stylesheet applies to both scrollers regardless of conversation or width, defeating the claimed conversation isolation. Shared history in forked conversations is a plausible trigger; it was not established with live server data.

**Evidence:** `vm-races.log` reports `hidden-copy same scroller split across caches: true states: 2`. Browser CSS fixture: independent caches record the same ID at width 768/height 111 and width 640/height 222; **both** scrollers receive height 222 from the later stylesheet. The unit test named “conversation caches never share a turn identity or a width invalidation” only checks independent JS objects, not emitted CSS. Bind state to a stable scroller/conversation association and scope selectors to that owner.

### 5. P2 — Eviction can leave an observed turn permanently outside cleanup bookkeeping (confirmed deterministic lifecycle fixture)

**Location:** `extension/butter-cv.js:32-33`, `56-67`, `89-90`.

**Scenario:** a flush queues a turn mark for the next animation frame. Before that callback runs, insertion of a fifth conversation evicts the turn's cache and removes the target from `watched` and `columns`. The deferred callback checks only `isConnected`, so it can observe the old hidden turn again. When the virtualizer later removes it, neither cleanup map contains it, so nothing unobserves the target. Similar stale queued marks have no ownership check at line 60. Repeated races can retain detached subtrees and accumulate RO work outside the four-conversation accounting.

**Evidence:** `vm-races.mjs` executes the actual CV source with deterministic RO/rAF delivery. Before the delayed mark, both ownership and RO membership are false; after the frame and DOM removal, ownership remains false but RO membership is true. This is a narrow scheduling race, not a measured live heap leak. Require the same current watched/state ownership before marking/re-observing; cancel/filter pending queue/frame work on eviction.

### 6. P2 — The pre-ID conversation key retains detached chat DOM (confirmed deterministic lifecycle fixture)

**Location:** `extension/butter-cv.js:25`, `39`, `89-90`.

**Scenario:** a new chat mounts before it has a `/c/<id>` URL, so `conversations` uses the scroller DOM element as a strong Map key. When the chat gets its URL or its scroller is removed, there is no rekey/delete operation. Observer cleanup removes `watched` and `columns`, but the Map key still retains the entire detached scroller subtree until FIFO eviction. The four-state limit bounds the number of retained trees, not their size; a long math tree can be large.

**Evidence:** `vm-races.log`: `detached new-chat cleanup watched: 0 columns: 0 conversations retains scroller: true`. Migrate the pre-ID state when the conversation receives its ID, or remove disconnected fallback keys without dropping the serializable height cache.

### 7. P2 — Existing documented rail regression fixtures no longer initialize (confirmed)

**Location:** `extension/butter-cv.js:9`; unchanged callers `lab/harness/nav-earlier.mjs:71` and `lab/harness/nav-takeovers.mjs:32`.

**Scenario:** run the documented standalone history-rail fixtures. They inject the nav and CV sources directly, and were not updated to inject `butter-height-cache.js` first. CV now immediately reads an undefined global and exits before scanning any turns, so the rail never turns on. The extension manifest has the correct order; this is a regression in the test/validation path, not a claim that normal installed startup is broken.

**Evidence:** running an otherwise unchanged copy of `nav-earlier.mjs` against a copy of the working-tree extension exits 1 after `locator.waitFor: Timeout 30000ms exceeded`, waiting for `chatgpt-butter-nav[data-on]` at setup line 73. A separate direct injection reports `ButterHeightCache is not defined`. See `nav-earlier.log` and `missing-cache.log`. `nav-takeovers.mjs` has the same missing-prerequisite injection sequence by inspection. Update both fixtures alongside the dependency change and rerun them.

## Streaming benchmark

The existing `lab/harness/bench.mjs` was copied to `(not archived)`. Its first unmodified attempt selected a hidden `.ProseMirror` and timed out before submitting. The temporary copy was adapted only to choose the visible composer/scroller and fingerprint that scroller's answer; `harness-adaptation.diff` contains the exact changes. The original repository harness is unchanged.

HEAD and change extension copies were loaded from snap-readable directories, three runs each. Both used the default `t09.json` recording (189 chunks over about 122 s), the specified CHAT URL, the same input schedule, and the same additional fail-closed network guard. Runs were batched HEAD then change, not randomized. The figures are aggregate frame p95 while the harness scrolls and types, as reported by the existing harness; it does not separately segment wheel-only frames.

| Variant | Run | Page frozen (s) | Frame p95 (ms) | Slowest key (ms) | Longest freeze (ms) | Busy (%) | Answer SHA prefix |
|---|---:|---:|---:|---:|---:|---:|---|
| head | 1 | 4.887 | 16.8 | 343.2 | 864 | 40.2 | 043dc8afaf8d |
| head | 2 | 3.607 | 16.8 | 364 | 581 | 38.5 | 043dc8afaf8d |
| head | 3 | 3.163 | 16.8 | 357.5 | 557 | 37.6 | 043dc8afaf8d |
| change | 1 | 12.173 | 33.4 | 428.9 | 1249 | 46.9 | 043dc8afaf8d |
| change | 2 | 12.668 | 33.4 | 426.2 | 1283 | 47.8 | 043dc8afaf8d |
| change | 3 | 12.154 | 33.4 | 429.1 | 1211 | 47 | 043dc8afaf8d |
| **head median** | 3 runs | 3.607 | 16.8 | 357.5 | 581 | 38.5 | |
| **change median** | 3 runs | 12.173 | 33.4 | 428.9 | 1249 | 47 | |

“Page frozen” is the harness's summed Long Animation Frame blocking duration (`loafBlockMs`), not wall time. Every run replayed all 189 chunks and produced 21,448 characters, 420 KaTeX elements and SHA-256 prefix `043dc8afaf8d`.

`convcheck.mjs` ran before the benchmark, after HEAD, and after the change. All three outputs are byte-identical: 12 user turns, including the pre-existing final `<prompt text>`, with **no replay prompt**. All three check-output SHA-256s are `0b1b1a37652476b32ba2b54030b05f5e1c85563af3b5dcbee4eadd14d04b888b`. No real message was sent. The extra browser-level guard aborted 19 conversation initialization/preparation writes across setup/runs (`blocked-writes.jsonl`); the answer POST itself was intercepted in-page by the replay hook and did not reach the network. Blocking these auxiliary writes was identical for both variants and is a deliberate safety difference from an unguarded benchmark.

## Tests, documentation, and remaining limits

`node --test`: **20 passed, 0 failed**. Version check: **OK: 0.1.0-alpha.7 / 0.1.0.7**. `git diff --check`: clean. Source hashes remained unchanged throughout review.

The pre-jump filtering covers the specified modifiers, IME composition/keyCode 229, empty text and disabled/aria-disabled buttons. The send notification now calls `cancelJump`, and the unit test exercises cancellation of pending rail settlement. No additional confirmed pre-jump defect was established. The documented browser fixture does fail to initialize as described in finding 7; its rail landing assertions were therefore not reached. A synthetic consumed-Enter example still pre-jumps because the capture listener does not inspect defaultPrevented or popup state; no production popup failure was reproduced, so that is not promoted to a finding.

The new cache tests check cache bookkeeping, selector strings and math readiness. They do not run the CV integration, observer ordering, real CSS selection, remount/width races, eviction, or the flush. The docs accurately describe the intended architecture and limits, but the conversation isolation and width-safety claims are contradicted by findings 2/4. Persistence was not added. CSS.escape is used in production. The four-state/64-turn/8192-block limits bound cached rules but do not eliminate the measured matching cost or detached-element retention.

The browser fixtures run the actual sources with minimal layout/React-like commits; they do not prove a permanent live ChatGPT rail mislanding. Wrong first row measurements and later corrections are established; actual landing behavior for each new geometry case is a remaining integration boundary. No real generation, regeneration, branch creation or stop request was performed.

## Browser restoration and artifacts

Restored `LAB_EXTENSIONS=~/snap/chromium/common/butter-blank-head` and original URL `<chat>`. Final snapshot: one visible composer with empty text, zero height-cache style elements, no replay hook. See `restored-browser.json` and `restore.log`.

Commands, actual outputs, the initial harness failure, safety guard, temporary harness adaptation and reproduction scripts are indexed in commands-and-output.md (not archived). Full raw inspection output is in inspection-command-output.log (not archived). Benchmark comparison is also available as HTML (not archived).
