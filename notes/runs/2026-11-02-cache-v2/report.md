> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter height-cache investigation

Worktree: `~/.t3/worktrees/butter/t3-ae2c1476`.
Base: `9d6cad4fe890a8c523731ed20f261e754d966832`.
Artifacts: `(not archived)`.

## Result

The display-math cache meets the measured streaming, send-landing, and lifecycle acceptance checks.

The accepted pre-jump is preserved byte-for-byte. The failed cache was replaced by a smaller, independent display-math cache. `extension/butter-cv.js` is exactly HEAD: cache readiness cannot suppress ordinary seen marks. No commit, version bump, README or changelog change was made, and the lead checkout was not modified.

## Pre-jump-only streaming comparison

All runs used the recorded 189-chunk answer, the same scrolling/typing schedule, headed lab Chromium, and the same fail-closed browser write guard. HEAD and pre-jump were measured first, three runs each; final came later in the same session. Runs were batched, not randomized. Before/after server user-turn checks are byte-identical.

HEAD blocked-time median was **5.068 s**, range **3.890–5.418 s**. Pre-jump median was **3.528 s**, range **2.899–3.770 s**. Pre-jump frame p95 was **16.8 ms in all three runs**; HEAD was 16.8, 16.8, 33.3 ms. Slowest keys: HEAD **349.9–395.8 ms**, pre-jump **332.4–361.4 ms**. There is no observed pre-jump streaming regression. These small, batched samples do not establish a general streaming speedup from the pre-jump.

## Actual cause of the failed attempt

The failure reproduces: first-cache run blocked **12.661 s**, frame p95 **33.4 ms**, style **18.8%**, seen marks **434**. This agrees with the independent review's three changed runs. The screening command in `stream-red.log` returns 1 with a **3.589** median blocked-time ratio against pre-jump.

Ablations change one condition at a time:

| Ablation | Blocked (s) | Style (%) | Seen marks | Longest freeze (ms) | Interpretation |
|---|---:|---:|---:|---:|---|
| First attempt | 12.661 | 18.8 | 434 | 1254 | Reproduces review |
| Publish no cache rules; keep observer and marking logic | 5.919 | 13.0 | 434 | 1174 | Large CSS contribution, independent of missing marks |
| Same selectors, inert `outline-offset:0px` declarations | 12.652 | 18.9 | 434 | 1259 | Matching rule set reproduces the sustained cost without cache layout properties |
| Remove whole-turn `:has()` rules only | 12.022 | 18.7 | 433 | 1254 | `:has()` is not the main cause in this replay |
| Remove whole-turn math marking gate only | 13.737 | 20.1 | 433 | 1321 | Does not restore marks or responsiveness |
| Remove all math readiness checks from the mark flush; keep cached-skip gate | 8.561 | 14.8 | 434 | 1228 | Some rendering work changes, but missing marks remain |
| Remove cached/skipped mark deferral; keep math readiness | 12.566 | 19.4 | 1059 | 661 | Restores marks and reduces initial remount freeze, but expensive CSS remains |

The principal sustained regression is the generated block-selector rule set's style matching/invalidation cost. It is not explained by streaming content-visibility behavior alone: inert declarations reproduce it. The missing ~625 marks have a separate, directly demonstrated cause: the cached-and-skipped mark gate in the first `butter-cv.js` flush. Removing that condition restores marks while leaving the sustained CSS regression intact. The first cache mixed ordinary marking policy with cache confidence.

Diagnostic counters in `gate-diagnostic.json` record **1412** block math-readiness deferrals, **8** turn math deferrals, and **932** cached/skipped deferrals. Complete historical remounts sometimes initially contain entirely untypeset math (e.g. 420 sources without KaTeX), so cache measurement does need a readiness guard. It must not become an ordinary marking guard. The trace is `harness/results/bench/diagnostic/trace.json`; `diagnostic-trace-analysis.txt` describes its 12-second mid-stream window. It is not a full-run trace and does not independently allocate all full-run matching time.

The rule-disabled control still has more blocked time than pre-jump. It retains all first-attempt long-lived observers, attribute observation, per-record math work and marking gates. These runs do not isolate a unique residual cost among those mechanisms; it would be unsupported to claim that ResizeObserver or MutationObserver alone accounts for the remainder. The final design observes only completed display math and its width parents, and removes the per-record math ancestor processing, and its end-to-end result supplies the acceptance test.

## Design and evidence

- Cache only a finished main answer's direct display-math `.katex-display` content height. Its parent already exists as a flow-root. Paragraphs, lists, tables and streaming answers retain HEAD's path; no new wrapper is inserted.
- Bind every entry and emitted selector to `data-chatgpt-selection-conversation-id` plus `data-chatgpt-selection-message-id` from the owning DOM. Block position identifies display math within that immutable message. A regenerated/branch-switched message has a new message identity. Unknown/pre-ID owners bypass the cache. The current URL never determines ownership.
- Scope each cached height to an exact-width `@container butter-math` query on that display-math parent. A width change disables stale fallback during the same layout/React commit, before ResizeObserver delivery. The cache doesn't need a window resize to notice it.
- Keep HEAD's first-render seen gate unchanged and independent. Cached inner math rules remain valid after the outer block is marked; marking does not drop a fallback before native remembered geometry exists. No `:has()` selector is emitted.
- A complete-state ancestor selector disables cache rules synchronously during streaming. Only typeset KaTeX measurements are accepted. Pending samples are revalidated for ownership/completion before publication.
- Retain at most four conversations, 64 messages per conversation and 2048 display-math sizes. Cache maps hold strings and numbers, never scroller DOM keys. Removed/evicted observer targets are explicitly released; timers never observe targets, eliminating the deferred re-observe race.
- Batch publication at most once per second, with one local-container rule per message and height rules grouped by width. New streaming blocks are not observed by the cache, and no math-ancestor scan runs per mutation record.

A general answer-container prototype passed basic width/identity checks but was rejected: live layout probing showed it shrank wide tables from **973 to 768 px** by becoming their nearest query container. A whole-answer skipping prototype would also contain wide content. `layout-compatibility.json` shows a local display-math container preserves the same answer/math geometry and original wide-table widths. This is why the final implementation is deliberately narrower.

Primary sources: `extension/butter-height-cache.js`, unchanged `extension/butter-cv.js`, `extension/butter.css`, and the actual DOM capture `message-dom.json`; architecture/benchmark method in `docs/how-it-works.md`, `docs/benchmarks.md`, `docs/development.md`, `lab/README.md`. The review mechanisms were ported to actual Chromium geometry checks in `lab/harness/height-cache.mjs` and deterministic VM/RO checks in `test/butter-height-cache.test.mjs`.

## Streaming measurements

“Blocked” means summed Long Animation Frame blocking duration, not wall time. Frame p95 covers the harness's whole replay while it scrolls/types. All runs produced **21,448 characters, 420 KaTeX elements, SHA prefix `043dc8afaf8d`**, and delivered every chunk.

| Variant | Run | blocked s | p95 ms | key max ms | longest freeze ms | style % | marks | SHA |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| head | 1 | 5.068 | 16.8 | 349.9 | 552 | 11.1 | 1061 | 043dc8afaf8d |
| head | 2 | 3.890 | 16.8 | 352.3 | 566 | 10.2 | 1060 | 043dc8afaf8d |
| head | 3 | 5.418 | 33.3 | 395.8 | 598 | 13.1 | 1061 | 043dc8afaf8d |
<!-- head loafBlockMs: median=5068 range=3890..5418 -->
<!-- head keyMax: median=352.3 range=349.9..395.8 -->
<!-- head stylePct: median=11.1 range=10.2..13.1 -->
| prejump | 1 | 3.770 | 16.8 | 332.4 | 604 | 10.6 | 1059 | 043dc8afaf8d |
| prejump | 2 | 2.899 | 16.8 | 355.5 | 575 | 9.8 | 1057 | 043dc8afaf8d |
| prejump | 3 | 3.528 | 16.8 | 361.4 | 648 | 10 | 1058 | 043dc8afaf8d |
<!-- prejump loafBlockMs: median=3528 range=2899..3770 -->
<!-- prejump keyMax: median=355.5 range=332.4..361.4 -->
<!-- prejump stylePct: median=10 range=9.8..10.6 -->
| first | 1 | 12.661 | 33.4 | 421.1 | 1254 | 18.8 | 434 | 043dc8afaf8d |
| no-rules | 1 | 5.919 | 33.3 | 400.1 | 1174 | 13 | 434 | 043dc8afaf8d |
| head-gate | 1 | 8.561 | 33.3 | 442.1 | 1228 | 14.8 | 434 | 043dc8afaf8d |
| turn-gate | 1 | 13.737 | 49.9 | 409 | 1321 | 20.1 | 433 | 043dc8afaf8d |
| no-has | 1 | 12.022 | 33.4 | 410.8 | 1254 | 18.7 | 433 | 043dc8afaf8d |
| no-skip-gate | 1 | 12.566 | 33.5 | 396.4 | 661 | 19.4 | 1059 | 043dc8afaf8d |
| match-only | 1 | 12.652 | 33.4 | 427.5 | 1259 | 18.9 | 434 | 043dc8afaf8d |
| final | 1 | 3.377 | 16.8 | 350 | 600 | 9.9 | 1067 | 043dc8afaf8d |
| final | 2 | 3.408 | 16.8 | 340.8 | 663 | 9.9 | 1064 | 043dc8afaf8d |
| final | 3 | 2.974 | 16.8 | 345.5 | 585 | 9.7 | 1059 | 043dc8afaf8d |
<!-- final loafBlockMs: median=3377 range=2974..3408 -->
<!-- final keyMax: median=345.5 range=340.8..350 -->
<!-- final stylePct: median=9.9 range=9.7..9.9 -->


Final cache blocked-time median is **3.377 s**, range **2.974–3.408 s**, versus pre-jump **3.528 s**, range **2.899–3.770 s**. The median difference is **151 ms**; pre-jump's observed range spans **871 ms** and final's **434 ms**, so this is within run-to-run noise. No claim of a statistically established streaming speedup is made.

Final frame p95 is **16.8 ms in every run**; slowest keys **340.8–350.0 ms** fall inside pre-jump's **332.4–361.4 ms** range. Longest freezes overlap (final **585–663 ms**, pre-jump **575–648 ms**). Style time is **9.7–9.9%**, versus pre-jump **9.8–10.6%**. **PASS: no measured streaming regression.**

## Far-up sends and landing positions

The send driver holds replay output for 15 seconds so generation does not contaminate placement measurement. Cold means reload plus loading all earlier history without an intentional full-chat traversal. Warm adds a traversal before scrolling away. Every trigger starts at scroll top 1900 px. Settle time is trigger to last observed scroll before replay output; every row records the question's position relative to the visible scroller. The viewport is 912 px high. A replay/fetch firewall is installed before input; no real message is sent.

| Variant | State | Run | Trigger to last scroll (ms) | Keydown forced style/layout (ms) | New question top (px) | Scroll top / height (px) |
|---|---|---:|---:|---:|---:|---|
| prejump | cold | 1 | 2742.3 | 1355.5 | 292 | 312595 / 313712 |
| prejump | cold | 2 | 2810.8 | 1436.5 | 292 | 312595 / 313712 |
| prejump | cold | 3 | 2775.9 | 1395.8 | 292 | 312595 / 313712 |
| prejump | warm | 1 | 2601.8 | 1304.5 | 272 | 312626 / 313723 |
| prejump | warm | 2 | 2567.4 | 1346.7 | 272 | 312626 / 313723 |
| prejump | warm | 3 | 2585.5 | 1357.9 | 272 | 312626 / 313723 |
| final | cold | 1 | 2551.7 | 1097.6 | 292 | 312595 / 313712 |
| final | cold | 2 | 2527.3 | 1089.8 | 292 | 312595 / 313712 |
| final | cold | 3 | 2579.3 | 1121.7 | 292 | 312595 / 313712 |
| final | warm | 1 | 1797.7 | 481.4 | 272 | 312626 / 313723 |
| final | warm | 2 | 1816.8 | 477.5 | 272 | 312626 / 313723 |
| final | warm | 3 | 1665.1 | 484.8 | 272 | 312626 / 313723 |


Observed ranges:

- prejump, cold, 3 runs: median 2775.9 ms, range 2742.3–2810.8 ms; new question top 292–292 px.
- prejump, warm, 3 runs: median 2585.5 ms, range 2567.4–2601.8 ms; new question top 272–272 px.
- final, cold, 3 runs: median 2551.7 ms, range 2527.3–2579.3 ms; new question top 292–292 px.
- final, warm, 3 runs: median 1797.7 ms, range 1665.1–1816.8 ms; new question top 272–272 px.

- **cold:** median settle time from 2775.9 to 2551.7 ms (8.1% lower); median keydown forced style/layout from 1395.8 to 1097.6 ms. The cache and control ranges do not overlap in these three runs.
- **warm:** median settle time from 2585.5 to 1797.7 ms (30.5% lower); median keydown forced style/layout from 1346.7 to 481.4 ms. The cache and control ranges do not overlap in these three runs.

The cold gain is modest because unknown or never-rendered math retains the first-render path. The warm traversal makes real measurements available for more remounted math. This cache does not promise that every cold remount takes the first attempt's 1.5–1.8 seconds.

See verification.log for the complete replay, landing, server-snapshot and browser-restoration assertions.

Setup qualification: an earlier cold-cache attempt loaded only eight of twelve questions after the server's pagination endpoint returned HTTP 429. Its 1.351 s result is **excluded** in `incomplete-history/`. A subsequent setup also hit 429 before send. `pagination-native.json` records the 429; disabling cache styles did not restore native pagination. Successful unmodified GET responses were then captured in `history-responses.json` and reused during setup for the replacement third cold run and final warm runs. This runs outside the measured send interval, changes no message data, and preserves the same full-history heights/landing coordinates. `run.mjs` now refuses to submit a replay unless the rail contains all twelve questions and reports no earlier page remaining. Server verification uses an uncached endpoint. See `history-cache.log` and `prep-record-history.log`.

## Acceptance items 1–7

| Item | Verdict | Evidence |
|---|---|---|
| 1. Streaming regression | PASS for the final three-run replay | 2.974–3.408 s blocked and 16.8 ms frame p95, inside pre-jump noise; ablations above establish original causes |
| 2. Same-commit column width change | PASS on actual Chromium CSS | Cache hit required first; fresh same-task remount after column narrowing measures the same height with and without cached styles; `cache-fixtures.json` |
| 3. Regenerated/branch-switched answer under same turn key | PASS in identity fixture | Replacement message ID keeps natural short-answer geometry, not the prior cached height; `cache-fixtures.json`; pending-identity unit test |
| 4. Conversation scope and late hidden-copy insertions | PASS in CSS and lifecycle fixtures | Simultaneous conversations with a shared message ID retain distinct heights; late hidden insertion follows DOM owner despite changed URL; `cache-fixtures.json`, unit test |
| 5. Eviction re-observe race | PASS in deterministic scheduling test | Evict between timer and rAF; no ownership or RO target reappears; detached block/parent cleanup tests |
| 6. Detached pre-ID conversation DOM | PASS in lifecycle test | No state or RO target is created without stable IDs; maps use string keys; detached math and its width parent are unobserved |
| 7. Rail fixture startup and assertions | PASS; see nav-earlier.log and nav-takeovers.log | `butter-cv.js` has no new global dependency; both rail fixtures inject the optional cache module as well |

Fixture passes are synthetic integration evidence for these race mechanisms, not claims that real regeneration or branch creation was performed. No real regeneration was sent.

## Tests and diff

Actual `node --test` output:

```text
✔ display-math heights use conversation/message identity and an exact CSS width guard (3.386389ms)
✔ detached display math and its width owner are both unobserved (0.736221ms)
✔ eviction between timer and rAF cannot re-observe a detached target (0.825812ms)
✔ pre-ID answers create no cache, observer target, or DOM map key (0.615056ms)
✔ late insertion into a hidden copy keeps its DOM conversation after URL navigation (0.697187ms)
✔ pending samples are rejected after streaming or message identity changes (1.215495ms)
✔ a width-only observer notification discards pending measurements at the old width (0.643012ms)
✔ only typeset, completed main-answer display math is cached (0.666618ms)
✔ cache limits evict serializable measurements and their observer ownership together (9.434144ms)
✔ hover wave stays within its targets when the frame timestamp predates kick() (7.731414ms)
✔ hover wave converges monotonically, stays finite across long frames, and stops at rest (9.244447ms)
✔ overlapping older pages deduplicate questions, and an empty final page hides the earlier button (1.434866ms)
✔ wheel invalidates a pending jump before it can settle or pin its old target (2.3327ms)
✔ keyboard invalidates a pending jump before it can settle or pin its old target (1.707056ms)
✔ send invalidates a pending jump before it can settle or pin its old target (1.905441ms)
✔ new click invalidates a pending jump before it can settle or pin its old target (2.033447ms)
✔ Enter pre-jumps a distant send but leaves the last viewport for ChatGPT (1.123922ms)
✔ click pre-jumps a distant send but leaves the last viewport for ChatGPT (1.133968ms)
✔ near-bottom sends and non-send key events preserve the thread position (1.245875ms)
✔ empty composers and disabled send buttons do not pre-jump (1.118462ms)
✔ the current composer submit button works without legacy IDs (1.025636ms)
raf throttle: all checks passed
✔ test/raf.test.mjs (41.80515ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 123.51711

```

Version check:

```text
OK: 0.1.0-alpha.7 / 0.1.0.7; manifest, READMEs, and changelog agree.

```

`git diff --check` exits 0 without output. Actual `git diff --stat` (tracked files):

```text
 docs/development.md           |  2 ++
 docs/how-it-works.md          | 18 ++++++++---
 extension/butter-nav.js       | 29 ++++++++++++++++-
 extension/manifest.json       |  1 +
 lab/harness/bench.mjs         | 14 ++++-----
 lab/harness/nav-earlier.mjs   |  3 +-
 lab/harness/nav-takeovers.mjs |  3 +-
 test/butter-nav.test.mjs      | 73 +++++++++++++++++++++++++++++++++++++++++--
 8 files changed, 126 insertions(+), 17 deletions(-)

```

New untracked implementation/test/fixture files are intentionally not staged: `extension/butter-height-cache.js`, `test/butter-height-cache.test.mjs`, `lab/harness/height-cache.mjs`. `final.diff` includes them. The temporary dependency symlink is removed before handback.

## Reproduction and safety

The paused live matrix was resumed after the user confirmed lab access; all requested browser work and restoration are now complete. `resume-browser-work.log` and `finish-final-sends.log` preserve those commands and outputs. The repo geometry/rail fixtures were also run in a separate temporary headless Chromium: only browser connection and source paths changed in task-owned copies under `offline-harness/`; the logged-in lab browser was untouched. Those outputs are preserved in `offline-harness/*.log`. The canonical fixtures were subsequently run in the headed lab browser; their final outputs are `final-fixtures.log`, `nav-earlier.log`, and `nav-takeovers.log`.

From the worktree:

```bash
bash (not archived)
```

The script rebuilds frozen variants under the snap-readable directory, applies the identical input schedule and firewall to every streaming arm, runs the send/rail/geometry checks, compares read-only snapshots and restores `butter-blank-head` plus the original URL in an EXIT trap. Its constituent commands were run; the top-level script is syntax-checked and was not redundantly executed as one more full matrix. The original URL is preserved in `original-url.txt`.

Full executed commands and actual outputs are indexed in `commands-and-output.md`; detailed benchmark commands are traced in each batch log. Server user-turn snapshots all hash to `0b1b1a37652476b32ba2b54030b05f5e1c85563af3b5dcbee4eadd14d04b888b`. Strong before/after send snapshots additionally compare node IDs, user IDs and current node. See `verification.log`, `restore.log`, and `restored-browser.json` for final safety and restoration checks.
