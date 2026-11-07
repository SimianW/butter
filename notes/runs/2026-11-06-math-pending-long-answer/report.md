# Long Dil answer stays `math-pending` with no record

Baseline: `f977a88`, branch `t3/fix-scrollbar-preview-stuck`, 2026-11-06. Test package
`0.1.0-alpha.13+unseen-notice.9`; source manifest unchanged. No delegation, ChatGPT sends, lab
access, push or PR. Fixtures and outputs here contain synthetic content and counts/geometry only.

## Result

**Recorder mechanism: confirmed with the real recorder in Chromium and in unit tests. Which
trigger applied on the Mac: not confirmed.** The Mac's state was turn 2 at about 16k px,
`hasRecord: false`, `lastRejection: "math-pending"`, with every formula typeset. The baseline
recorder reaches exactly that state in two ways, and the fix removes both. A third, related path
(`placeholder`, after a fast drag through a streamed answer) was also real and is also fixed.

### Root cause (baseline line numbers, `git show f977a88:<file>`)

1. A skipped block's display-math geometry was reused only for the **identical cached object**:
   `cached?.text === text && cached.w === r.width && cached.h === r.height`
   (`extension/seek/layout-cache-main.js:903`). Otherwise the snapshot got `mathReady = false`
   (`:906`), so `validateSnapshot` returned `math-pending` (`extension/seek/core-main.js:183`).
   Spatial widget blocks had the same identity check, which set `placeholder` (`:894-895`).
2. **Any** mutation inside the turn clears `leanCache` for every item
   (`layout-cache-main.js:1092`, MutationObserver; also `:1048` on release). The next `lean()`
   produces new objects, so every skipped block's geometry stops matching, even though the
   content and box are unchanged. Geometry is written only while a block is unskipped during a
   job (`:915`). In a long answer only a viewport's worth of blocks is unskipped at a time, so
   with any DOM churn (stand-in here: an action bar added and removed on hover) the cache never
   covers the whole answer and the turn stays `math-pending` for good.
3. Even without churn, a reader who has not had **every** formula block on screen during an
   idle job never gets a record. On a 16k px turn that means reading all of it.
4. Related `placeholder` path: a held-back streamed block (`data-butter-unrendered`) that rendered
   during a scrollbar drag but was skipped again before the 1 s flush was held back again
   (`extension/stream/offscreen.js:38`). So `placeholder()` kept rejecting the turn
   (`core-main.js:185`). Once the late marks did land, nothing queued the turn again: the
   recorder's MutationObserver did not watch `data-butter-seen`
   (`layout-cache-main.js:1118`), and no reveal event was left to fire.

`mathReady(t)` (`layout-cache-main.js:531`) is not the blocker, which matches the Mac's
`capture-math-pending.js` result (no `[data-math-source]` without `.katex`). `lean()` detects
Dil display math by KaTeX classes (`.katex-display`, `.katex`) and the `annotation`, not by
`[data-math-source]`. A turn with no `[data-math-source]` is therefore not a false positive:
its formulas really are display math.

## Fix (minimal option chosen and trade-off)

Source line numbers below are for the final tree.

- **Compare skipped-block geometry by content, not object identity**
  (`layout-cache-main.js:900-947`). `signature()` covers lean text plus math offsets/kinds. A
  widget is compared by its row-free text (`lean(el, false)`) and keeps the row text measured
  while it was on screen. Box width and height must still match exactly. With this, geometry
  accumulates across reveals despite DOM churn.
- **Flagged estimates for blocks never measured on screen** (`:921-932`). A seen block that
  content-visibility skips is at its remembered real size, which the record already trusted
  for every other skipped block. Only the formula boxes or widget rows _inside_ it are
  unknown. Such a block now gets a formula height of 40 px per TeX row, capped by the block
  height and always within `displayMathLimit`, and the item carries `approx: true`. A
  never-rendered placeholder is still rejected in `begin()`. Records containing estimates:
  - are never persisted (`:1014`);
  - keep the turn `stale`, so each reveal re-queues it and the estimates are replaced by
    measurements (`:1010`);
  - are never adopted by a remounted copy (`:861`);
  - **never replace a record measured in full**: such a snapshot is rejected as `estimated` and
    the old record is kept (`:999-1001`). This preserves the existing
    `changed skipped grid cannot replace good rows` guarantee.
- **offscreen.js** (`:28-33, 43, 58`): a held-back block that came back into view and rendered
  is marked seen at the flush even if it is skipped again by then. Its unskip event means it
  was laid out, and `contain-intrinsic-size: auto` remembers that size. A block whose only size
  report came while streaming is still held back (existing event-first/size-first tests).
- **Re-queue on `data-butter-seen`** (`layout-cache-main.js:1097-1100, 1159`): only for watched
  turns that are still stale. No lean-text invalidation.

Rejected alternatives: forcing layout of the missing blocks (whole turn up to 0.6 s, see `:35`),
or layout of the missing blocks only (the same DisplayLock cost, on a press). Content comparison
alone fixes a fully read answer but leaves a partly read long answer with the notice. Estimates
alone would re-estimate after every churn. Hence both.

**Trade-off.** Item tops and heights stay exact; only formula box heights or widget row
breaks inside never-shown blocks may differ, until the block is shown. This is not drawn
differently in the preview (no visible UI change). It is visible in the record as `approx` and in
`__heightCacheDump().stats.approx`. Re-records continue while estimates remain: one idle job per
reveal, the same number of attempts the baseline spent being rejected (see perf).

One existing unit assertion changed. `display descendants inside a skipped block are not measured
until it renders` asserted `get('a') === null` while the only block was skipped. It now asserts the
record's item is `approx` and then measured and unflagged after reveal. Its `reads === 0`
no-layout guarantee is unchanged.

## Reproduction (red before the fix)

[`lab/harness/math-pending-long-answer.mjs`](../../../lab/harness/math-pending-long-answer.mjs):
real recorder, `containment.css` and `offscreen.js` in headless Chromium. It uses a synthetic
Dil turn of 80 blocks (two thirds paragraph + KaTeX display formula with `annotation` and no
`[data-math-source]`, one third grid widget), about 19.8k px tall. For history scenarios the
first record is held back past the 1 s seen-flush by `__butterSeeking`, as a stand-in for the
Mac's "no record" state. Without that hold, the baseline records once at load before blocks are
skipped and keeps that record, so the fixture was too lenient. Scenarios: `history` (read in
500 px steps, 250 ms pauses), `hover` (same, with action-bar churn in the turn), `partial` (read
one third, with churn), `streamed` (streamed below the fold, then dragged at 350 px/30 ms). After
reading, the harness turns containment off and compares every record item's top/height with
real layout.

The earlier cancelled agent's harness was partly faithful: its `placeholder` result was real
(path 4), but its drag stopped early because it read `scrollHeight` once while the answer was
still placeholder-sized. That is fixed here.

| Scenario | Baseline (`red-browser.txt`)                     | Fixed (`fixture-math-pending-long-answer.txt`)   |
| -------- | ------------------------------------------------ | ------------------------------------------------ |
| history  | record after full read (36 `math-pending` first) | record; 0 estimates; worst item error 0 px       |
| hover    | **no record**, `math-pending` ×68                | record; 0 estimates; 0 px                        |
| partial  | **no record**, `math-pending` ×28                | record; 46 flagged items; 0 px                   |
| streamed | **no record**, `placeholder` ×28                 | record; 72 flagged items; 0 px; row 19798 = real |

Unit regressions in `test/height-cache-dom.test.js` (`longAnswer` fixture) and
`test/offscreen.test.js` failed first ([red-unit.txt](red-unit.txt): 37/39 and 5/6), then pass:
read-with-churn, estimates flagged/refined/not re-measured once complete, estimates never
replace a full record (checked by disabling the guard: 0/1), and drag-rendered held block marked.

## Performance (300-block answer, about 74k px; `perf-before.txt` / `perf-after.txt`)

|              | Before: attempts            | Before: total / max ms | After: records  | After: total / max ms |
| ------------ | --------------------------- | ---------------------- | --------------- | --------------------- |
| history load | 1 rejected                  | 6.6 / 5.5              | 1 (292 flagged) | 6.5 / 5.5             |
| history read | 144 rejected + 1 record     | 274 / 5.5              | 145             | 293 / 5.5             |
| hover read   | 252 rejected, **no record** | 614 / 5.7              | 240             | 659 / 5.6             |

The cost per attempt is unchanged: the maximum single idle slice series is 5.5-5.7 ms for 300
blocks, and the press-time flush is 0-0.2 ms. The extra `lean(el, false)` runs only for on-screen
widgets. Once fully measured, a turn stops re-recording (unit-tested).

## Commands and actual results

| Command                                                                                       | Exit | Result                                                                            |
| --------------------------------------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------- |
| `node lab/harness/math-pending-long-answer.mjs` at baseline extension code                    | 1    | `FAILED: hover, partial, streamed` ([red-browser.txt](red-browser.txt))           |
| `node --test test/height-cache-dom.test.js` before fix                                        | 1    | tests 39, pass 37, fail 2 ([red-unit.txt](red-unit.txt))                          |
| `node --test test/offscreen.test.js` before fix                                               | 1    | tests 6, pass 5, fail 1 (appended to red-unit.txt)                                |
| `node --test` final                                                                           | 0    | tests 232, pass 232, fail 0 ([node-test.txt](node-test.txt))                      |
| `npm run -s format:check` final                                                               | 0    | `All matched files use Prettier code style!` ([format.txt](format.txt))           |
| `node lab/harness/math-pending-long-answer.mjs` final                                         | 0    | `PASS: history, hover, partial, streamed`                                         |
| `node lab/harness/dil-renderer.mjs`                                                           | 0    | all checks pass ([output](fixture-dil-renderer.txt))                              |
| `node lab/harness/dil-tables-widgets.mjs`                                                     | 0    | 32 `PASS` lines. It failed (2 `FAIL`) before the replace guard was added; see fix |
| `node notes/runs/2026-11-06-press-time-unseen/press-fixture.mjs`                              | 0    | eight scenarios pass ([output](fixture-press-fixture.txt))                        |
| `node notes/runs/2026-11-06-single-turn-unseen/synthetic-dil.mjs`                             | 0    | pass ([output](fixture-synthetic-dil.txt))                                        |
| `BLOCKS=300 EXTENSION=<git archive f977a88> node …math-pending-long-answer.mjs history hover` | 1    | `FAILED: hover` ([perf-before.txt](perf-before.txt))                              |
| `BLOCKS=300 node …math-pending-long-answer.mjs history hover`                                 | 0    | `PASS: history, hover` ([perf-after.txt](perf-after.txt))                         |

`notes/runs/2026-11-05-preview-record-capture/verify.mjs` and `2026-11-05-unseen-notice/capture.mjs`
drive the live lab and were not run. Package receipt: see below.

## Next evidence from the Mac

Install `+unseen-notice.9`. Then, on the same chat, check the following without reading
turn 2 to the end. Readiness should show turn 2 `hasRecord: true`, `layout: true`; while blocks
are still unmeasured, `__heightCacheDump().stats.approx > 0`. Holding the scrollbar over turn 2
should show the full preview, not the notice. If the notice persists, run
`capture-record-readiness.js` and `capture-press-decision.js` as before.

## Package and commit

The implementation, tests, diagnostics note and this report were committed as `f4db1d1`
(`fix: record long Dil answers whose skipped blocks were never measured on screen`). The package
ran after that commit; this receipt was then added by amending the commit, without changing
extension code.

| Command                                                                        | Exit | Result                                                                                                                                                                                                                                        |
| ------------------------------------------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python3 scripts/package.py --test unseen-notice`                              | 0    | `dist/butter-0.1.0-alpha.13+unseen-notice.9.zip`; `Note: Chrome version remains 0.1.0.13; remove the previous install before loading this test build.`                                                                                        |
| `unzip -p dist/butter-0.1.0-alpha.13+unseen-notice.9.zip butter/manifest.json` | 0    | `"version": "0.1.0.13"`, `"version_name": "0.1.0-alpha.13+unseen-notice.9"`; zipped `seek/layout-cache-main.js` and `stream/offscreen.js` byte-identical to source; sha256 `55180e27af4d3534fa944f64e9c749f570af65a4f32517cc10c40e1b2c709e5e` |
