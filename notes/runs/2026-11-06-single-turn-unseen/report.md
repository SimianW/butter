# Single-turn unseen preview investigation

Baseline: `c315410`, branch `t3/fix-scrollbar-preview-stuck`. Test package:
`0.1.0-alpha.13+unseen-notice.7` (Chrome version `0.1.0.13`). No manifest/version change,
push, PR, ChatGPT message, or delegation. Lab1 was locked, guarded against sends, restored,
and released; lab2 was not used. This report contains only synthetic content and sanitized
counts/geometry. Existing capture JSON was read without copying question/answer text.

## Finding and confidence

**Confirmed conditional defect:** a turn already mounted when the recorder initializes is
never registered by startup. If it subsequently only scrolls, it has no record, even after
the entire answer has been rendered. The same defect applies to an already-mounted last
turn in a longer chat; being last is not itself a recording exclusion.

At baseline, `extension/seek/layout-cache-main.js:1050` installs a MutationObserver, but
only added turn nodes reach `watch()` (`:1060`), and there is no initial scan. The
content-visibility listener (`:564`) queues a revealed turn only when `meta.has(t)`;
an unregistered existing turn cannot recover through that path. The new startup scan is
at `extension/seek/layout-cache-main.js:1122`.

A synthetic single-turn Dil page, modeled on the saved capture's response-root children
(prose, simplified synthetic code widgets, display math), reproduced this distinction:

| Recorder timing                                 | Baseline observed turns | Baseline record | Baseline layout | Fixed items | Fixed layout |
| ----------------------------------------------- | ----------------------- | --------------- | --------------- | ----------- | ------------ |
| Before inserting DOM                            | 1                       | yes             | true            | 23          | true         |
| After inserting DOM, then scroll through answer | 0                       | no              | false           | 23          | true         |

Evidence: [red browser output](red-synthetic.txt), [fixed browser output](synthetic.txt),
[fixture](synthetic-dil.mjs). The real-recorder unit regression failed first with
`startup must observe the already-mounted turn`, then passed:
[red unit output](red-startup.txt), [unit implementation](../../../test/height-cache-dom.test.js).
No production code mutation was used to force this failure.

**Not confirmed as the cause on the user's Mac.** The manifest normally runs the MAIN
scripts at `document_start`. This investigation did not establish that their affected
page actually initialized Butter after the turn mounted, nor reproduce that lifecycle
using Chrome's extension loader. Delayed startup is a demonstrated failure condition,
not proof of the reported page's history. The old supplied captures have usable records
and `layout: true`; neither is a capture of this new unseen failure. The .7 package
therefore fixes a verified recorder gap and includes diagnostics to identify the Mac's
actual failing condition if the notice persists.

## Other candidates checked

- There is no generic single/last-turn exclusion. The normal synthetic Dil fixture records
  22 block heights and 23 items without unmounting. Existing real-browser fixtures still
  pass for classic/Dil formulas, table rows, widget rows, resize and skipped-widget safety.
- A real **classic single-turn** chat in lab1 also records before any fix after scrolling:
  28 items, `rowH` and actual row height both 1428 px, recorded/current scroller width both
  1526 px, no snapshot rejections. The virtualizer measurement was also 1428 px. This does
  **not** reproduce the user's failure. See [live output with current baseline scripts](lab-injected.txt).
  The earlier [discovery run](lab-check.txt) used the lab's default extension state and showed
  missing records, so those absence results are not evidence against this branch.
- `buildModel` at `extension/seek/core-main.js:306` requires items, matching width, and a
  matching nonzero virtualizer height for a warm record. Missing and stale measurements
  deterministically produce `layout: false` in the actual press-time `prepare()` function.
  [Exploratory red output](red-model.txt) tested the opposite expectation; final
  `test/single-turn-unseen.test.js` explicitly preserves the guard and checks the matching
  positive case. No evidence showed stale/missing heights on the affected live single turn,
  so this fix does not loosen that guard or replace virtualizer measurements with guesses.
- Normal capture-shaped Dil math passes validation; its display span is measured at
  38.484375 px, within the existing allowance. Table/widget fixtures also pass. This
  does not rule out a different rejected snapshot on the Mac.
- Warm records exist with disk persistence disabled/unavailable in both synthetic and lab
  checks. `persistence.record()` returns early when consent/account/source prerequisites
  are absent, **after** `finish()` stores the warm record in `turns` (`layout-cache-main.js:978`).
  Disabling persistence retires disk-backed entries, not fresh warm entries (`:223`).
- The notice is controlled directly by the destination question's `layout` in
  `extension/seek/preview-main.js:378`; the rail's separately selected card does not set it.
  A single-turn model has no neighboring question that could explain a selection mismatch.

## Change

The production fix is a one-time scan of existing turn nodes after the observer is
installed. It invokes the existing `watch()` path, retaining generation parking, idle
measurement, validation, width/height guards and consent behavior. No preview surface,
styles, strings or interaction changed.

A small WeakMap retains each mounted element's latest completed recording outcome, and
`__butterLayoutCache.diagnostics(t)` exposes only observation/queue/generation state and a
fixed rejection reason. Successful recording/adoption clears the previous failure.
It performs no layout reads. The unit test exercises rejection, recovery and the output
allowlist; existing selector-blind test document mocks were updated for the new startup query.

The new [readiness snippet](../../diagnostics/capture-record-readiness.js) reports, for
every virtualizer turn, record availability, item/block counts, latest rejection,
record geometry validation, recorded/virtualizer/current row heights, recorded/current
width, storage origin, and the exact `buildModel` layout result. It reads cache state before
DOM geometry, uses an explicit field allowlist, and never outputs text, TeX, styles, IDs,
URLs, React props or account data. It does not flush, hydrate or prepare. The normal getter
may retire invalid restored entries, and subsequent DOM reads may force layout; these limits
are documented in [instructions](../../diagnostics/README.md). Build .6 can report geometry,
but per-turn rejection state requires .7. The browser fixture also ran the real snippet and
verified its copied output in both recorder timing cases.

## Commands and actual results

Full outputs are linked; command summaries below omit routine source reads/searches.

| Command                                                                                              | Exit | Actual result                                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------- |
| `node --test --test-name-pattern='single Dil turn mounted' test/height-cache-dom.test.js` before fix | 1    | 1 test, 0 pass, 1 fail: startup must observe the already-mounted turn                                                           |
| `node notes/runs/2026-11-06-single-turn-unseen/synthetic-dil.mjs` before fix                         | 1    | Early startup layout true; late startup observed 0, no record, layout false                                                     |
| `node --test test/single-turn-unseen.test.js` exploratory expectations                               | 1    | 2 tests failed: absent/stale virtualizer measurements return false                                                              |
| `node --test` final                                                                                  | 0    | 225 tests, 225 pass, 0 fail ([output](node-test.txt))                                                                           |
| `node lab/harness/dil-renderer.mjs` final                                                            | 0    | Dil/direct: 20 block sizes, 23 items; math, anchor, resize, containment checks pass ([output](dil-renderer.txt))                |
| `node lab/harness/dil-tables-widgets.mjs` final                                                      | 0    | 32 PASS lines, including identical classic/Dil table geometry and no browser errors ([output](dil-tables-widgets.txt))          |
| `node notes/runs/2026-11-06-single-turn-unseen/synthetic-dil.mjs` final                              | 0    | Early/late: 23 items, layout true; both copied readiness results agree ([output](synthetic.txt))                                |
| `node notes/runs/2026-11-06-single-turn-unseen/lab-check.mjs`                                        | 0    | Existing classic single-turn found; 28 items, matching row/width, no rejections; restored/released ([output](lab-injected.txt)) |
| `npm run format:check`                                                                               | 0    | All matched files use Prettier code style ([output](format-product.txt))                                                        |
| `npx prettier --check .`                                                                             | 1    | Code style issues found in 133 files ([output](format-check.txt))                                                               |
| Same formatter against `git archive HEAD` baseline                                                   | 1    | Same 133 existing files; no new warnings ([output](format-baseline.txt))                                                        |
| `git diff --check`                                                                                   | 0    | No output                                                                                                                       |
| `python3 scripts/check-version.py`                                                                   | 0    | OK: 0.1.0-alpha.13 / 0.1.0.13; manifest, READMEs, and changelog agree.                                                          |
| `python3 scripts/package.py --test unseen-notice`                                                    | 0    | Created `dist/butter-0.1.0-alpha.13+unseen-notice.7.zip`; Chrome version remains 0.1.0.13 ([output](package.txt))               |
| Python `zipfile` manifest inspection                                                                 | 0    | `{"version": "0.1.0.13", "version_name": "0.1.0-alpha.13+unseen-notice.7"}`                                                     |

The exact whole-repository formatting done-check remains unmet because of **133 pre-existing
files**, including old reports and documentation. The first working-tree check found those
133 plus two new harness files; formatting the new files removed those two. A file-by-file
comparison against the archived baseline produced `New warnings: []` and `Removed warnings: []`.
The repository's configured extension/test formatting check passes. Formatting all unrelated
archives would exceed this minimal bug-fix scope, so those files were left unchanged.

During verification, the first whole-suite run after adding the startup scan failed in 15
existing tests whose document mocks returned the scroller for every selector. Making those
mocks distinguish `[data-turn-key]` fixed the fixtures. An initial browser-fixture invocation
also used an incorrect relative Playwright import and failed with `ERR_MODULE_NOT_FOUND`;
correcting the path allowed the recorded red/green runs above. Neither was a product defect.

## User check

Install the .7 test package, then open/reload the affected chat normally. Let it settle,
scroll through the answer, and hold the native scrollbar. If the notice persists, release
it and run the readiness snippet in Console's **top** context before clearing anything.
Share only its copied JSON, ideally once before and once after scrolling through the answer
and waiting a second. `lastRejection` distinguishes validation failures; `layoutReason`
distinguishes missing records from row/width trust failures. If readiness says `layout: true`
but the held preview still says unseen, run the original drag capture to compare the frozen
press-time preview with the later cache. This Mac confirmation is still needed.
