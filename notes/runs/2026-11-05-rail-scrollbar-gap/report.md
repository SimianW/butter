# Keep the history rail clear of overlay scrollbars

2026-11-05. Baseline: `318cd96e9d9ee00a23b78ff95e2c8576500eaba6`.
Implementation on `t3/fix-scrollbar-preview-stuck`, matching the approved
[mockup](../../mockups/rail-scrollbar-gap.html).

## Change

`extension/rail/rail.js` reserves a named 14 px `OVERLAY_SCROLLBAR_GAP` when
`offsetWidth - clientWidth` is zero. Together with the existing 4 px margin,
this leaves 18 px between the scroller's right edge and the entire rail.
A measured gutter keeps exactly the baseline calculation; it receives no extra offset.
The no-gutter fallback also applies before content overflows, so later overflow does not
depend on a scroller resize to start protecting the thumb strip.

Only the shared `--r` positioning changes. The rail remains 52 px wide, with the same
ticks, animations, hit areas and pointer handling. The hover tooltip and seek card
already use `--r`, so both follow the shifted rail. The content/travel-preview geometry
continues to use the original content bounds.

## Regression evidence

The new unit test in `test/rail.test.mjs` runs the real rail script in the existing fake-DOM
harness. It checks overlay clearance, unchanged 15 px and 20 px gutter positions, hover,
seek state and transitions between gutter modes (no accumulated offset).

Copied into an archive of `318cd96`, the test fails: expected 18 px, actual 4 px.
With the fix it passes. Full baseline output: [red.txt](red.txt).
The full suite passes: 215 tests, zero failures. See [test.txt](test.txt) and
[format.txt](format.txt).

## Browser check

Used a fresh T3 preview Chromium 156 tab on Linux, with only synthetic content in
same-origin iframes. No ChatGPT requests or messages were needed. The actual unmodified
baseline and fixed rail scripts were injected separately with `seek-meta.js`; each run
received a fresh iframe. The browser already measured zero gutter with `overflow-y:auto`,
so no overlay launch flag was needed. `scrollbar-gutter:stable` supplied a measured 15 px
reserved gutter for comparison. This checks classic-gutter geometry, not an OS classic
thumb drag.

The reusable [browser fixture](../../../lab/harness/rail-scrollbar-gap-fixture.js) measures
real bounds and shadow-root hit targets. `checkRailFixture()` throws `wrong scrollbar
clearance` on the baseline and passes with the fix. In addition to bounds, it asserts that
all sampled points in the outer 14 px reach the scroller; a shown card must remain 8 px
beside the rail and vertically centered on the hovered/seek tick.

| Case | Baseline rail right | Fixed rail right | Outcome |
| --- | ---: | ---: | --- |
| 1280 px, zero gutter | 1276 px | 1262 px | Outer 14 px clear after fix |
| 1280 px, 15 px reserved gutter | 1261 px | 1261 px | Position unchanged |
| 560 px, zero gutter | 556 px | 542 px | Outer 14 px clear after fix |
| 559 px and 390 px | Hidden | Hidden | Responsive behavior unchanged |

Hit tests sampled 1, 2, 6, 10 and 14 px from the right edge at the rail's top padding,
third tick and bottom padding. With the fix, all 15 samples reach the scroller, including
when the pill and tooltip/seek card are shown. Before the fix, the 6–14 px samples hit
the rail/pill/bar. A trusted browser click 10 px from the edge, at the third tick's height,
produced these actual pointerdown records:

```json
{"target":"CHATGPT-BUTTER-NAV","inner":"pill","isScroller":false,"trusted":true}
{"target":"MAIN","inner":"thread-scroll-container","isScroller":true,"trusted":true}
```

Hover and seek cards both remain 8 px left of the rail and centered at the third tick's
356 px vertical coordinate. The rail's width remains 52 px. Captures, taken after the
hover animations settled: [before](before.png), [after](after.png), [seek card](seek.png).
The screenshots match the approved position change; the mockup is an enlarged schematic,
so its illustrative tick dimensions were not copied over the existing rail design.
Full geometry, hit samples and click records: [browser.json](browser.json).

No real macOS native-thumb drag, ChatGPT virtualizer or production conversation was tested.
The trusted click and geometry exercise the reported rail interception directly.

## Commands and actual results

Read-only setup used `pwd`, `git status --short`, `git branch --show-current`,
`git rev-parse HEAD`, `cat`, `sed`, `rg`, `ls` and `git diff` to inspect the instructed
documents, diagnosed problem, approved mockup, source and existing tests. The worktree
was initially clean at `318cd96`, on `t3/fix-scrollbar-preview-stuck`.

The shared lab was briefly locked while checking available browser options:

```text
$ ~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-scrollbar-gap --wait 45
2
$ ~/.local/share/chatgpt-lab/bin/lab-restore --lab 2 --owner rail-scrollbar-gap
restored: lab 2, restarted false, composer empty, ok true
$ ~/.local/share/chatgpt-lab/bin/lab-lock release --lab 2 --owner rail-scrollbar-gap
{"lab": 2, "lab_released": true, "perf_released": false}
```

The restore output above is summarized to exclude account URLs and process details.
The functional run used the isolated T3 browser instead, so no shared browser restart,
extension change or synthetic lab navigation was necessary. The T3 tab was closed after
the run. No other worktree was touched.

Baseline reproduction (the Python wrapper archived the baseline, copied only the new test,
captured stdout/stderr to `red.txt`, and asserted exit 1):

```sh
baseline_dir=$(mktemp -d /tmp/butter-rail-baseline-XXXXXX)
git archive 318cd96 extension test | tar -x -C "$baseline_dir"
cp test/rail.test.mjs "$baseline_dir/test/rail.test.mjs"
node --test --test-name-pattern='overlay rail reserves' "$baseline_dir/test/rail.test.mjs"
```

```text
✖ overlay rail reserves the scrollbar strip; classic gutters keep their original position
ℹ tests 1
ℹ pass 0
ℹ fail 1
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
4 !== 18
exit: 1

$ node --test test/rail.test.mjs
ℹ tests 21
ℹ pass 21
ℹ fail 0

$ npx prettier --write extension/rail/rail.js test/rail.test.mjs lab/harness/rail-scrollbar-gap-fixture.js
extension/rail/rail.js 173ms (unchanged)
test/rail.test.mjs 76ms (unchanged)
```

The repository's ignore rules exclude `lab/` from Prettier; the fixture follows the existing
lab harness style. No production code or tests needed formatting changes.

```text
$ node --test
ℹ tests 215
ℹ suites 0
ℹ pass 215
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 771.535849

$ npm run format:check
> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"
Checking formatting...
All matched files use Prettier code style!

$ git diff --check
(no output; exit 0)

$ python3 scripts/package.py --test unseen-notice
/home/simon/.t3/worktrees/butter/t3-8302ad9c/dist/butter-0.1.0-alpha.13+unseen-notice.3.zip
Note: Chrome version remains 0.1.0.13; remove the previous install before loading this test build.
```

A Python `zipfile` check compared the archived `butter/rail/rail.js` byte-for-byte with the
fixed source, checked the test `version_name` and unchanged numeric Chrome version, and printed:

```text
OK: /home/simon/.t3/worktrees/butter/t3-8302ad9c/dist/butter-0.1.0-alpha.13+unseen-notice.3.zip (147374 bytes); fixed rail included; 0.1.0-alpha.13+unseen-notice.3 / 0.1.0.13
```

Browser reproduction uses `preview_status`, `preview_open(open:false)` and `preview_evaluate`:
evaluate the fixture file, then call `installRailFixture({source, meta, width, gutter})`, where
`source` is the full baseline/fixed rail script and `meta` is `extension/seek/seek-meta.js`.
Use width 1280 or 560 and gutter false, or width 1280 and gutter true.
Hover the third tick with `preview_act`, wait 450 ms for animations, then evaluate
`checkRailFixture()`. Call `seekRailFixture()` and check again after 450 ms.
At width 1280, `preview_act(action:'click', x:1270, y:356)` supplies the trusted edge click;
`measureRailFixture().presses` contains its record. `preview_snapshot(save:true)` captured
the images. Baseline check output was `Error: wrong scrollbar clearance`; fixed hover and
seek checks returned `card: {shown:true, gap:8, centerY:356}`.

Version and changelog sources were not changed. The package is a local ignored artifact.
