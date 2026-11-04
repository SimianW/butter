> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter 0.1.0-alpha.8 implementation report

Implemented the approved toolbar popup, all five live switches, a master switch, live status probes,
and English/中文 settings shared with the history rail. Settings use only `chrome.storage.local` under
`butter`. The only new permission is `storage`; no tabs or host permissions were added. The numeric
config settings and existing optimization selectors remain in place. Updated the manifest, both
READMEs, changelog, privacy/install/development docs, and alpha.8 package.

All changes are uncommitted. Nothing was pushed. The existing, untracked `mockups/` was left intact.

## Findings and limits

The lab profile was logged in. On an existing ChatGPT conversation, container and content-visibility
switches changed computed CSS live; the rail hid, became inert, resumed and changed language.
The master switch disabled all five items, and removal of the off marker was repaired automatically.
Initial statuses were container/cv/rail `ok`, throttle/older `wait`, as expected before exercise.
Final statuses were all `ok` after exercising the hooks.

The throttle was exercised with the exact known smoother callback locally on the real ChatGPT tab.
Older requests were intercepted by Playwright before reaching ChatGPT: `num_turns` was 2 when on
and 10 when off. No new ChatGPT message was sent, and a fresh real streamed answer was not checked.

A live check found that ChatGPT can wrap `fetch` again while still delegating to Butter. Comparing
function identities incorrectly reported failure. Status now uses observed hook engagement; a
regression test covers a later delegating wrapper.

A ChatGPT-origin fixture verified real content-script classification: missing wrapper fails;
unexercised throttle/older wait; streaming observed for over 2 seconds without a matching callback
fails; missing parsed conversation data after 5 seconds fails the rail; CV marks work; master off
overrides everything. A real tab without a receiver showed the away state.

## Visual comparison

Reused the approved CSS tokens, sizes, font stack, translations and bundled Lucide SVG paths.
Captured 32 screenshots: 24 language/theme/state combinations and 8 scrolled-bottom views.
Compared the 14 approved panels at the 600 px Chrome cap. Every panel has the same dimensions.
Settings interiors match pixel-for-pixel; home differences are small antialiasing differences, with
at most 25 per RGB channel internally. Popup screenshots have transparent/white rounded corners
where the reference sits over the mockup background. Chinese references use the selected Chinese
language for comparison, matching the popup's `lang="zh-CN"` accessibility metadata.

Keyboard activation, accent focus rings, 150 ms switch transitions, dynamic broken counts in both
languages, instant page navigation, 320 px width and scrolling at 600 px were checked in Chromium.
The screenshot fixtures are confined to `lab/harness/`; none ships in the zip.

## Deviations

No layout, palette, translation or icon deviations from the approved mockup.

For cases not shown in the mockup:
- Opening settings on a tab without Butter shows enabled items as "Not yet checked"; switches and
  language remain usable.
- After resuming an item, a cached "Off" becomes "Not yet checked" until the next status response.
- The document language follows the language choice so assistive technology reads Chinese correctly.

## Commands and actual output

The final verification outputs are copied below. Earlier harness setup needed two corrections:
snap Chromium denied a `file://` reference inside the hidden worktree (`net::ERR_ACCESS_DENIED`),
so the mockup is read with `fs` and supplied with `setContent`; a background screenshot timed out
(`page.screenshot: Timeout 30000ms exceeded`), so the harness brings each capture tab forward.
The focus check initially used programmatic focus after mouse input (`'none' !== 'solid'`); it now
enters keyboard modality before verifying `:focus-visible`. A launcher run also hit
`connect ECONNREFUSED 127.0.0.1:9222` before Chromium had finished starting; later runs connected.

Setup: `npm install --prefix lab/harness --ignore-scripts --no-audit --no-fund` returned
`added 2 packages in 303ms`. Copied `extension/.` to the snap-readable
`~/snap/chromium/common/butter-popup-alpha8/` and ran
`LAB_EXTENSIONS=~/snap/chromium/common/butter-popup-alpha8 lab/lab restart-browser`.
Chromium loaded alpha.8 with empty manifestErrors and runtimeErrors. The copied extension remains
loaded in the lab; original repo edits remain uncommitted.

### `node --test`

```text
✔ hover wave stays within its targets when the frame timestamp predates kick() (8.597692ms)
✔ hover wave converges monotonically, stays finite across long frames, and stops at rest (9.671697ms)
✔ overlapping older pages deduplicate questions, and an empty final page hides the earlier button (1.38842ms)
✔ wheel invalidates a pending jump before it can settle or pin its old target (2.349697ms)
✔ keyboard invalidates a pending jump before it can settle or pin its old target (1.7299ms)
✔ new click invalidates a pending jump before it can settle or pin its old target (2.350451ms)
✔ older hook lowers only older GET page sizes, and switches live without reloading (26.972661ms)
✔ a later fetch wrapper that delegates to Butter does not falsely fail the engaged hook (0.931584ms)
raf throttle: all checks passed
✔ test/raf.test.mjs (43.130773ms)
✔ missing selector after observing turns fails; unexercised hooks wait (0.954326ms)
✔ confirmed engagement works; ambiguous exercise waits (0.192209ms)
✔ individual and master switches override engagement and failure (0.722556ms)
✔ partial and missing storage values keep all defaults; English is default (0.266271ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 114.082575
```

### `python3 scripts/check-version.py`

```text
OK: 0.1.0-alpha.8 / 0.1.0.8; manifest, READMEs, and changelog agree.
```

### `python3 scripts/package.py`

```text
~/.t3/worktrees/butter/t3-2d91deec/dist/butter-0.1.0-alpha.8.zip
```

### `python3 zipfile content assertions (popup.html, popup.css, popup.js, butter-settings.js, butter-status.js)`

```text
butter/popup.html
butter/popup.css
butter/popup.js
butter/butter-settings.js
butter/butter-status.js
PASS: popup and settings files are in the alpha.8 zip.
```

### `node lab/harness/popup-qa.mjs`

```text
PASS: 32 screenshots; all approved states plus Chinese dark variants, capped scrolling, dynamic counts, keyboard switch, focus ring, 150ms transition; no popup errors.
```

### `node lab/harness/popup-probes.mjs`

```text
PASS: real content script reports unexercised throttle/older as wait.
PASS: observed turns with a missing wrapper selector report fail.
PASS: a streaming turn observed for over 2 seconds without a matching smoother reports fail.
PASS: missing conversation data after 5 seconds reports rail fail; marked content reports cv ok.
PASS: missing storage defaults on; master off overrides every fixture status.
PASS: a real tab without a content-script receiver shows the away state.
```

### `node lab/harness/popup-live.mjs`

```text
Existing conversation available: true
Initial status: {
  states: {
    container: 'ok',
    cv: 'ok',
    throttle: 'wait',
    older: 'wait',
    rail: 'ok'
  }
}
PASS: container switch changes computed container-type live.
PASS: off-screen content switch changes computed content-visibility live.
PASS: question rail hides, becomes inert, resumes, and changes language live.
PASS: throttle switch live, local smoother published 1 on / 12 off.
PASS: older-page switch live, intercepted num_turns 2 on / 10 off.
PASS: master switch disables all five; removed off marker is restored.
Final status: {
  states: {
    container: 'ok',
    cv: 'ok',
    throttle: 'ok',
    older: 'ok',
    rail: 'ok'
  }
}
```

### `Python/Pillow comparison against mockup panels`

```text
en-dark-home-away.png: same size 320x257; 193 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 9/255.
en-dark-home-broken.png: same size 320x257; 241 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 14/255.
en-dark-home-ok.png: same size 320x240; 166 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 6/255.
en-dark-home-paused.png: same size 320x240; 229 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 23/255.
en-dark-settings-mixed.png: same size 320x600; 66 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 0/255.
en-dark-settings-paused.png: same size 320x600; 66 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 0/255.
en-light-home-away.png: same size 320x257; 168 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 11/255.
en-light-home-broken.png: same size 320x257; 170 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 11/255.
en-light-home-ok.png: same size 320x240; 161 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 8/255.
en-light-home-paused.png: same size 320x240; 250 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 25/255.
en-light-settings-mixed.png: same size 320x600; 66 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 0/255.
en-light-settings-paused.png: same size 320x600; 66 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 0/255.
zh-light-home-ok.png: same size 320x245; 162 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 10/255.
zh-light-settings-mixed.png: same size 320x600; 66 pixels differ (outer-edge/background or rasterization); maximum interior channel difference 0/255.
```

`git diff --check` returned no output and exited 0.

Package: butter-0.1.0-alpha.8.zip (not archived).

## Screenshots

Every link is an absolute path under `(not archived)`.

| State | English light | English dark | 中文 light | 中文 dark |
|---|---|---|---|---|
| home-ok | en-light-home-ok.png (not archived) | en-dark-home-ok.png (not archived) | zh-light-home-ok.png (not archived) | zh-dark-home-ok.png (not archived) |
| home-broken | en-light-home-broken.png (not archived) | en-dark-home-broken.png (not archived) | zh-light-home-broken.png (not archived) | zh-dark-home-broken.png (not archived) |
| home-paused | en-light-home-paused.png (not archived) | en-dark-home-paused.png (not archived) | zh-light-home-paused.png (not archived) | zh-dark-home-paused.png (not archived) |
| home-away | en-light-home-away.png (not archived) | en-dark-home-away.png (not archived) | zh-light-home-away.png (not archived) | zh-dark-home-away.png (not archived) |
| settings-mixed | en-light-settings-mixed.png (not archived) | en-dark-settings-mixed.png (not archived) | zh-light-settings-mixed.png (not archived) | zh-dark-settings-mixed.png (not archived) |
| settings-mixed-bottom | en-light-settings-mixed-bottom.png (not archived) | en-dark-settings-mixed-bottom.png (not archived) | zh-light-settings-mixed-bottom.png (not archived) | zh-dark-settings-mixed-bottom.png (not archived) |
| settings-paused | en-light-settings-paused.png (not archived) | en-dark-settings-paused.png (not archived) | zh-light-settings-paused.png (not archived) | zh-dark-settings-paused.png (not archived) |
| settings-paused-bottom | en-light-settings-paused-bottom.png (not archived) | en-dark-settings-paused-bottom.png (not archived) | zh-light-settings-paused-bottom.png (not archived) | zh-dark-settings-paused-bottom.png (not archived) |

Interactive screenshot gallery (not archived).
