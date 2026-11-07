# Press-time unseen preview investigation

Baseline: `d824781`, branch `t3/fix-scrollbar-preview-stuck`, 2026-11-06. No delegation,
ChatGPT sends, lab2 access, push, PR or source manifest/version change. Lab1 was locked,
send-guarded, restored and released. Reports contain synthetic content or sanitized
counts/geometry only.

## Result and confidence

**The reported Mac root cause remains unconfirmed.** No natural reproduction produced
readiness `layout: true` followed by an unseen notice for that same valid turn. This change
adds the requested press-time evidence; it does not claim to fix the reported defect or
relax layout trust checks.

A full-listener browser fixture with a single Dil turn passes on ordinary and project-shaped
URLs before and after the change. It uses the real recorder, real `prepare()` and real
`render()`, with a synthetic React virtualizer boundary. All 62 prose blocks and 63 preview
items are recorded. Synthetic content/virtualizer hooks are not evidence of the Mac's React
state. Its edge hit testing and disabled text selection deliberately simulate native scrollbar
events in headless Chromium; a trusted edge press followed by a programmatic held scroll
runs the real activation path. See [baseline output](baseline-fixture.txt),
[final fixture/output](press-fixture.mjs), [final decisions](fixture.txt).

The fixture also reproduces the **symptom condition** with an intentionally supplied
press-only width change: readiness is true at width 931, `:active` changes the pressed
scroller to width 916, the record remains width 931, and the real notice appears with
`sw-mismatch`. This proves the new capture can distinguish that hypothesis. **It is not
proof that macOS or ChatGPT changes width this way.** No such width change was observed
in the live lab, and no speculative width-tolerance fix was made.

## Exact readiness/press comparison

All source references below describe the final implementation.

| Candidate                     | Code evidence and observation                                                                                                                                                                                                                                                                                                                                  | Conclusion                                                                                                           |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Different scroller            | Readiness chooses the first visible `.thread-scroll-container` at `notes/diagnostics/capture-record-readiness.js:10`; `preview-main.js:614` accepts any visible element matching that class and prepares the event target. Synthetic second-scroller test reports identity false, widths 800/931 and `sw-mismatch`.                                            | A possible difference, now captured. Actual Mac identity unknown.                                                    |
| Fiber lookup / fallback IDs   | Readiness `:15` and `preview-main.js:173` walk the same first mounted turn's fiber and same hook shape. The press falls back at `preview-main.js:202`, while readiness stops without guessing. Synthetic removal of the fiber produces `ids-from-fallback`, `no-record`, model length 1 and actual unseen notice.                                              | No reader algorithm discrepancy found; a failed lookup at press time remains possible.                               |
| Project conversation filter   | Cache `layout-cache-main.js:34` and preview `preview-main.js:40` both match the `/c/<UUID>` portion at any prefix, including project URLs. Cache filtering is at `layout-cache-main.js:1259`. An intentionally changed conversation produces `conv-mismatch`; ordinary and nested synthetic paths both pass.                                                   | Project prefix alone does not break matching. Mac timing/identity change unproven.                                   |
| Synchronous re-record         | Readiness only calls `get()` at `capture-record-readiness.js:36`; the press calls `measure()` at `layout-cache-main.js:1250` before adoption/building. The real-recorder test captures row height 500 before flush and 540 afterward, with `recordChanged: true`. Failed recording preserves the prior entry (`core-main.js:218`, `layout-cache-main.js:970`). | A real difference in operations, now visible. No evidence yet that it changed the affected Mac record.               |
| Wrong model turn / beyond end | `core-main.js:365` clamps lookup to an existing row; `previewQuestion` at `:496` calls `mapTop` with the inset. A genuine one-turn model cannot select another turn. The new render snapshot identifies actual index/model length; the existing two-turn renderer test also checks index 1.                                                                    | Synthetic/placeholder/fallback entries are diagnosable; not observed in the healthy controls.                        |
| Release-time fresh prepare    | `preview-main.js:963` uses `fresh` only to find a release retarget row. Rendering and destination still read `a.prep.model` (`:435`, `:975`).                                                                                                                                                                                                                  | Fresh preparation does not replace the held notice's model. It is saved separately as `releasePrepare` if used.      |
| Storage overwrites warm entry | `layout-cache-main.js:1253` adopts only absent keys. Real persistence test proves a valid stored variant does not overwrite the warm entry. `currentEntry` at `:1125` may delete invalid stored entries, with a tested `retiredStored` diagnostic.                                                                                                             | No unconditional overwrite found; stored retirement is separately visible. The supplied Mac record was warm.         |
| Butter press styles / rail    | `prepare(s)` runs at `preview-main.js:662` before `activate()` applies its transform (`:705`). There is no `data-butter-seeking` style path in this tree; rail state follows render. The preview host's overlay strip does not change the scroller width.                                                                                                      | No Butter width/height mutation before model building found. Browser/page hover or active styles remain unconfirmed. |

The exact trust guard now lives in `core-main.js:286` and is used by both `buildModel` and
its reason capture. It retains the existing width equality, nonempty item requirement,
virtualizer height tolerance and stored-height exception.

## Live lab

[Final live script](lab-check.mjs) inspected 14 existing conversations without sending.
It found single-turn ordinary chats and a single-turn chat inside a project, all using the
classic renderer. No live single-turn Dil example was available in that inspected set.
All four sampled single-turn chats activated through an actual native scrollbar press
with a controlled held scroll; the capture also ran after release.

| Live single-turn sample                              | Readiness | Actual notice | Press reason |
| ---------------------------------------------------- | --------- | ------------- | ------------ |
| Ordinary, 28 items                                   | true      | hidden        | null         |
| Ordinary, 29 items                                   | true      | hidden        | null         |
| Project, no accepted record, recorder `math-pending` | false     | shown         | `no-record`  |
| Ordinary, 21 items                                   | true      | hidden        | null         |

See [sanitized full output](lab-check.txt) and [summary](lab-summary.json). A separate
[project/math-pending sample](lab-math-pending.txt) also matched readiness and the held
notice. This is a different condition from the Mac's valid 64-item record. It does not
justify changing math validation. The Linux classic scrollbar cannot establish macOS
overlay behavior. Some sampled live runs preceded the final addition of mounted-row height
fields; the final full Dil fixture verifies those fields without further DOM reads.

## Diagnostics delivered

`__seekDump.pressDecision` is a getter with no setter that returns a detached copy. It saves
one latest qualifying press summary and its latest render decision. It survives release and
DevTools clicks. Reading it does not invoke `__seekDump()`, read the DOM/cache, flush, hydrate,
access storage or send requests. Release retarget prepares cannot overwrite the original
press/render evidence.

The summary contains scroller identity/counts/widths, fallback/fiber flags, per-turn mounted
row and recorded/measured/model heights, item counts, storage status, before/after cache
summaries, record replacement/retirement, fixed rejection codes, and the actual rendered
turn index/model length/prepare sequence. There are no text, TeX, CSS, URLs, keys/IDs, account
identifiers, React props or DOM references. Numeric geometry is explicitly selected.

Overhead is scalar work per model turn at prepare time and one constant-size assignment per
render. It walks no item text and adds no per-item layout reads. Mounted row heights reuse
rects already read by prepare. JSON copying occurs only when diagnostics are requested.

Run [capture-press-decision.js](../../diagnostics/capture-press-decision.js) in DevTools
**top** context after pressing, moving slightly and releasing the thumb once, using the new
test package. Share its JSON alongside readiness taken just before that press. The snippet
prints the JSON and copies it when Console's `copy()` is available. Instructions are in
[diagnostics README](../../diagnostics/README.md).

## Commands and actual results

Routine `rg`, `cat`, `sed`, `nl`, Git status/diff and source-inspection commands were also
used. The task's executable checks and their actual results are below; full output files
preserve the result rather than a proposed command.

| Command                                                                                                                           | Exit | Actual output/result                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `node notes/runs/2026-11-06-press-time-unseen/press-fixture.mjs` before diagnostics, healthy cases                                | 0    | Both ordinary/project: `active: true`, `notice: false`, `layout: 1` ([output](baseline-fixture.txt)).                                                                                                                                                                                                                                                                            |
| `node --test test/press-decision.test.js` before helper                                                                           | 1    | 1 test, 0 pass, 1 fail: `TypeError: core.layoutReason is not a function` ([output](red-diagnostics.txt)). This is the diagnostics feature's red test, not a reproduction of the Mac defect.                                                                                                                                                                                      |
| `node --test test/press-decision.test.js test/single-turn-unseen.test.js test/layout-store.test.js test/height-cache-dom.test.js` | 0    | 52 tests, 52 pass, 0 fail ([output](targeted.txt)); subsequent added cases are included in the full suite.                                                                                                                                                                                                                                                                       |
| `node --test test/height-cache-dom.test.js`                                                                                       | 0    | 37 tests, 37 pass, 0 fail ([output](cache-diagnostics.txt)).                                                                                                                                                                                                                                                                                                                     |
| `node --test` final                                                                                                               | 0    | 228 tests, 228 pass, 0 fail ([output](node-test.txt)).                                                                                                                                                                                                                                                                                                                           |
| `node notes/runs/2026-11-06-press-time-unseen/press-fixture.mjs` final                                                            | 0    | Eight scenarios pass: ordinary, project, press-width, no-measured, height-mismatch, fallback-ids, conv-mismatch, different-scroller. Exact reasons agree with actual notice; after-release snippet matches the frozen summary with live DOM/cache reads disabled; detached copy mutation cannot change internal state; no private fixture values appear ([output](fixture.txt)). |
| `node lab/harness/dil-renderer.mjs`                                                                                               | 0    | Dil/direct: 20 block sizes, 23 items; formula sizing, anchors, resize, preview clamp and containment pass ([output](dil-renderer.txt)).                                                                                                                                                                                                                                          |
| `node lab/harness/dil-tables-widgets.mjs`                                                                                         | 0    | 32 `PASS` lines, including actual preview/table geometry and no browser errors ([output](dil-tables-widgets.txt)).                                                                                                                                                                                                                                                               |
| `node notes/runs/2026-11-06-press-time-unseen/lab-check.mjs` final                                                                | 0    | 14 conversations inspected; all four sampled presses agree with readiness; project single turn found; `restored: true`, `released: true` ([output](lab-check.txt)).                                                                                                                                                                                                              |
| `npm run -s format:check` final                                                                                                   | 0    | `Checking formatting...` / `All matched files use Prettier code style!` ([output](format.txt)).                                                                                                                                                                                                                                                                                  |
| `npx prettier --write <changed JS/test/harness files>` and `npx prettier --check <changed non-product JS/harness files>`          | 0    | Changed files formatted; `All matched files use Prettier code style!` for the targeted check.                                                                                                                                                                                                                                                                                    |
| `python3 scripts/check-version.py`                                                                                                | 0    | `OK: 0.1.0-alpha.13 / 0.1.0.13; manifest, READMEs, and changelog agree.` ([output](version.txt)).                                                                                                                                                                                                                                                                                |
| `git diff --check`                                                                                                                | 0    | No output.                                                                                                                                                                                                                                                                                                                                                                       |
| `lab-lock status` after restoration                                                                                               | 0    | Lab1, lab2 and perf all `held: false`, `owner: null`.                                                                                                                                                                                                                                                                                                                            |

During setup, headless edge clicks first hit content or changed the selection and were correctly
rejected; the fixture now simulates the native target/selection explicitly. Initial live starts
returned `ECONNREFUSED` because `cdpVersion()` returns null rather than throwing; the script now
waits for a non-null value. A live `addScriptTag` invocation failed; executing diagnostic snippets directly in the page
context succeeded, so the script now uses that route. Existing direct-render fixtures needed the new
prepare diagnostic holder, and the new cache unit fixture needed its existing `layoutReady()`
setup. Before those fixture updates, four full-suite tests failed and the table browser harness
failed with a missing diagnostic `sequence`; all final checks pass. None of these setup failures
was treated as a reproduction of the user's Mac bug.

## Package and commit

Implementation, tests, diagnostics and this report were committed with
`git commit -m "Add privacy-safe diagnostics for frozen seek press decisions"` (exit 0;
initial commit `69a219b`). The following package commands ran **after** that commit;
the report/package receipts are added by amending the commit without changing extension code.

| Command                                                                                                                  | Exit | Actual output/result                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `python3 scripts/package.py --test unseen-notice`                                                                        | 0    | `/home/simon/.t3/worktrees/butter/t3-8302ad9c/dist/butter-0.1.0-alpha.13+unseen-notice.8.zip`; `Note: Chrome version remains 0.1.0.13; remove the previous install before loading this test build.` ([output](package.txt)). |
| Python `zipfile` inspection of `butter/manifest.json` and byte comparison of all three changed seek files against source | 0    | `{"version": "0.1.0.13", "version_name": "0.1.0-alpha.13+unseen-notice.8", "seekSourcesMatch": true, "sha256": "8c9defe5cc3d145c3b7bf173097676a2ea2cdca16e66a1317ea8b45580f5c22b"}` ([receipt](package-manifest.json)).      |

The source manifest stays `0.1.0-alpha.13` / `0.1.0.13`. All requested done-checks pass.
The remaining investigation input is the affected Mac's **press decision JSON**, collected
with the new snippet after reproducing and releasing the scrollbar. The cause is still a
hypothesis until that evidence identifies a failing boundary.
