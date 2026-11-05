# Unseen preview notice

Implemented on e4a4eb5 (0.1.0-alpha.13), without a version bump. The preview keeps the same answer-start excerpt at every position in an unseen question. A notice explains the limitation, in the rail's selected language. Opened questions, the seek card, and question-start release behavior retain their existing logic.

The approved reference is `notes/mockups/unseen-preview-honest.html`, Proposed panel. The implementation uses its 110 px fade, 8 px bottom inset, dashed 1 px border, 8 px corner radius, 8/10 px padding, ellipsis mark, 13 px text, and bold first line. Light colors match the mockup; dark colors follow the existing preview theme. The source answer font remains unchanged. Notice text is local to preview-main.js because seek-meta.js runs in the isolated world. No additional script or world bridge was needed.

## Browser evidence

The shared lab's long-chat fixture was locked by another task. An available lab was acquired through the lab helper; an isolated Chromium context used synthetic content at `butter.test`. No ChatGPT request or message was sent by the fixture. The context closed, the lab restored successfully, and its lock released. Browser automation through the shared preview tool was attempted first, but fixture loading failed with parameter validation and a missing core reference; the lab's Playwright/CDP connection supplied the captures instead.

`capture.mjs` runs the real core and preview code, exposing only surface/place/render for deterministic screenshots. It does not replace notice markup, styles, or rendering. Four offsets in the unseen question all retained the same excerpt at the top. Returning to an opened question hid the notice and rendered its measured answer. Checks cover English/Chinese, light/dark, and widths 840/390 px: eight combinations, ten screenshots. `checks.json` contains the synthetic results. The notice remained within the preview bounds in all cases.

Screenshots were compared with the approved Proposed panel: matching notice construction, position and fade. The screenshot content is synthetic and safe to commit. The mockup uses Chinese answer text; fixture answer text is English to avoid copying a private conversation. Dark mode uses existing theme behavior, as requested; the mockup covers only light mode. These are fixture captures, not a new live ChatGPT navigation/performance qualification. Native release behavior is covered by the unit regression and unchanged source logic.

- [Desktop, light, English](840-light-en.png)
- [Desktop, light, Chinese](840-light-zh.png)
- [Desktop, dark, English](840-dark-en.png)
- [Desktop, dark, Chinese](840-dark-zh.png)
- [Mobile, light, English](390-light-en.png)
- [Mobile, light, Chinese](390-light-zh.png)
- [Mobile, dark, English](390-dark-en.png)
- [Mobile, dark, Chinese](390-dark-zh.png)
- [Desktop, measured](840-measured.png)
- [Mobile, measured](390-measured.png)

## Commands and actual results

From the repository root:

```text
npm ci
added 1 package, and audited 2 packages in 326ms
1 package is looking for funding
  run `npm fund` for details
found 0 vulnerabilities

npx prettier --write extension/seek/preview-main.js test/seek-landing.test.js
extension/seek/preview-main.js 172ms (unchanged)
test/seek-landing.test.js 52ms

node --test --test-name-pattern='unseen previews' test/seek-landing.test.js
✔ unseen previews explain their fixed answer-start excerpt and hide the notice for measured questions (18.879574ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0

mkdir -p /tmp/butter-unseen-notice
git show e4a4eb5:extension/seek/preview-main.js > /tmp/butter-unseen-notice/preview-base.js
RENDER_SOURCE=/tmp/butter-unseen-notice/preview-base.js node --test --test-name-pattern='unseen previews' test/seek-landing.test.js
✖ unseen previews explain their fixed answer-start excerpt and hide the notice for measured questions (11.915449ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1
AssertionError [ERR_ASSERTION]: Unseen answers explain the fixed preview
true !== false
(exit 1, expected)

node --test > /tmp/butter-unseen-notice/node-test.log 2>&1
tail -n 12 /tmp/butter-unseen-notice/node-test.log
ℹ tests 213
ℹ suites 0
ℹ pass 213
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1212.605694

npm run format:check
> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"
Checking formatting...
All matched files use Prettier code style!

python3 -m unittest discover -s scripts -p 'test_*.py'
........
----------------------------------------------------------------------
Ran 8 tests in 0.842s
OK

python3 scripts/check-version.py
OK: 0.1.0-alpha.13 / 0.1.0.13; manifest, READMEs, and changelog agree.

node notes/runs/2026-11-05-unseen-notice/capture.mjs
PASS: 8 viewport/theme/language combinations; four pointer positions each; measured notices hidden; 10 screenshots.
Lab restored: true
{"lab":2,"lab_released":true,"perf_released":false}

python3 scripts/package.py --test unseen-notice
/home/simon/.t3/worktrees/butter/t3-8302ad9c/dist/butter-0.1.0-alpha.13+unseen-notice.1.zip
Note: Chrome version remains 0.1.0.13; remove the previous install before loading this test build.

git diff --check
(no output; exit 0)
```

The test runs the baseline preview source from e4a4eb5 through the same render fixture. The only production difference from that baseline is preview-main.js. The earlier uncommitted pointer-following test was replaced; that behavior is not implemented.

A Python zipfile assertion also passed: the archive exists, its preview file matches the source, its numeric Chrome version remains `0.1.0.13`, its version_name is `0.1.0-alpha.13+unseen-notice.1`, and the source manifest still reads `0.1.0-alpha.13` with no build metadata. The build zip stays in ignored `dist/`. The approved mockups remain untouched and ignored by the `mockups/` pattern.
