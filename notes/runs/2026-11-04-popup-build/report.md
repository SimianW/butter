> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter popup implementation handoff

Implemented on `t3/seek-preview` in `~/.t3/worktrees/butter/t3-6cf413cf` from `e7f5fc1`. No push or version bump.
The tracked tree is clean. Existing PRIVACY.md and both root READMEs were not edited.

## Commits

```text
55b6e49f98b59dd19e92cf239b8affb4b1b58fb8 Build the approved paper popup with grouped controls and layout usage
01cde6d70ca929041432b71546a666bdf7ea262d Replace Butter icons with approved vector art and bundle local popup fonts
8ddf1e0cc8f9f5630c643c8876de62c9782df1ee Map feature groups to live settings and retain failures for the browser session
```

## Verification

- Node: 147 tests passed, zero failed/skipped/cancelled. Nine new tests cover groups/migration,
  master status, persistent failure merging and worker restart/concurrency, usage, confirmation,
  retry identity, version labels, and seek-off behavior.
- Formatting and version consistency pass; version remains `0.1.0-alpha.10` / `0.1.0.10`.
- Real built extension popup, real Chrome extension storage and layout service worker: all 12
  approved states captured in both light and dark at 320 px. The active-tab probe is the only
  API stub for screenshot states; failures are seeded into real session storage and synthetic
  usage into the worker's real IndexedDB. The real clear endpoint is called.
- The brief success timer is held only during the Cleared screenshot; the live smoke verified
  its actual two-second duration. Static animations are finished before capture to avoid
  background-tab throttling. Melt frames pause the real CSS transition at 150 ms.
- All 24 reference pairs have identical measured header, master, label, list, first row,
  usage and footer geometry (tolerance 0.02 px). Each pair was compared visually; contact sheets:
  light (not archived), dark (not archived).
- Reference captures use the bundled fonts and a common pixel origin, without the mockup's
  decorative outer shadow. Header art/version and the illustrative jar fill differ as specified below.
- Additional browser assertions cover combined group warnings, successful recovery, keyboard
  switches, visible switch/language focus, reduced motion, zero popup exceptions and zero popup
  network requests.

## Screenshots

All full-height PNGs below are exactly 320 px wide, captured from the real built popup page.
Chrome caps the visible popup at 600 px. Tall states also have `-viewport.png` and `-bottom.png`
files alongside them, showing normal scrolling without changing the layout.

| State | Light | Dark |
|---|---|---|
| 01 — Normal | PNG (not archived) | PNG (not archived) |
| 02 — Problem | PNG (not archived) | PNG (not archived) |
| 03 — Not on ChatGPT | PNG (not archived) | PNG (not archived) |
| 04 — Paused | PNG (not archived) | PNG (not archived) |
| 05 — Clear confirmation | PNG (not archived) | PNG (not archived) |
| 06 — Cleared | PNG (not archived) | PNG (not archived) |
| 07 — Normal (original dark state) | PNG (not archived) | PNG (not archived) |
| 08 — Problem (original dark state) | PNG (not archived) | PNG (not archived) |
| 09 — English, memory off | PNG (not archived) | PNG (not archived) |
| 10 — English, paused | PNG (not archived) | PNG (not archived) |
| 11 — Melt animation | PNG (not archived) | PNG (not archived) |
| 12 — Melt animation (original dark state) | PNG (not archived) | PNG (not archived) |

Animation captures include off, midpoint and on frames:

- 11, light: midpoint (not archived), on (not archived).
- 11, dark: midpoint (not archived), on (not archived).
- 12, light: midpoint (not archived), on (not archived).
- 12, dark: midpoint (not archived), on (not archived).

Interactive screenshot gallery (not archived), screenshot manifest (not archived),
geometry measurements (not archived).

## Icons and fonts

Icons were rasterized with separate headless Chromium and retain transparent backgrounds.
The 16 px icon uses the simplified halo drawing; 32/48/128 use the main drawing.
Native-size icons on light/dark (not archived).

- 16 px PNG (not archived) (760 bytes).
- 32 px PNG (not archived) (1,490 bytes).
- 48 px PNG (not archived) (2,482 bytes).
- 128 px PNG (not archived) (7,685 bytes).

Sources and reproducible script: design/icon/ (not archived).
Bagel Fat One wordmark subset: 3,152 bytes. Nunito Latin variable subset: 33,140 bytes.
**Font payload added: 36,292 bytes.** OFL license notices add 8,870 bytes; fonts plus licenses
are 45,162 bytes. Local sources are documented in
fonts/SOURCES.md (not archived). Chinese uses system fallbacks.

## Settings mapping

| Popup group | Stored options |
|---|---|
| Smoother streaming / 回答生成时更顺 | `container`, `cv`, `throttle` |
| Smoother scrolling / 长对话滚动更顺 | `older`, new `seek` (default true) |
| Question rail / 问题导航条 | `rail` |
| Remember long-chat layouts / 记住长对话的布局 | `layout` |

A group is on only when every key is on; toggling sets every member. Normalization retains
existing option values, unrelated fields and unknown options. All changes apply live.
`opts.layout=false` still clears every saved layout through the existing worker.

Send pre-jump lives in `rail/rail.js` but its existing `beforeSend` does not check `railOff`, so
it remains independent of that switch. Latest-question prediction belongs to the rail display
and disappears with it. Neither behavior was changed.

Probe failures are persisted at `chrome.storage.session.butterFailures`, grouped by failed
feature. Unexercised/neutral evidence, chat switches and disabled options retain records;
successful engagement clears the corresponding failed feature. The worker serializes merges.
There is no unverified/wait state in the popup. The master line depends only on receiver
availability and the master switch.

## Deviations and uncovered cases

- The mockup header used an illustrative block; the build inlines the explicitly required
  final icon SVG at 54 × 48 px.
- The version comes from the unchanged manifest, so the label is `v0.1.0 · alpha 10`, rather
  than the mockup's illustrative alpha 11.
- An 8.4 MB payload fills 16.8% of the specified 50 MB cap; the mockup's sample fill was 34%.
- Multiple failures use one sentence naming every affected group. Disabled groups and a paused
  master suppress their warning/chip while retaining the session failure record, matching
  the previous popup's exclusion of disabled features.
- Storage API failure after three attempts shows Unavailable in the usage row and retains a
  Clear control for retry. An in-flight clear disables its confirm/cancel buttons.
- English and warning states can exceed Chrome's 600 px height cap; the page scrolls and has
  no outer radius/shadow. Inner card geometry is unchanged.
- No further visual or behavior deviations.

## Real lab smoke

The lock was taken with atomic `mkdir ~/.local/share/chatgpt-lab/run/lock.d` and an owner file.
A snap-readable staging copy was loaded, without experimental flags. Outgoing ChatGPT/OpenAI
writes were blocked for the smoke. No real message was sent, and no API write was issued by
the harness. The synthetic older requests were fulfilled locally and never reached ChatGPT.

```text
PASS: real content-script response on ChatGPT → Working in this chat.
PASS: chrome.action.openPopup opened the real toolbar popup on ChatGPT.
PASS: streaming group updates container, content-visibility and throttle markers live.
PASS: local smoother publishes 1 with streaming on / 12 off (no chat sent).
PASS: question rail disappears and returns live.
PASS: scrolling group changes intercepted older page size 2/10; trusted seek presses ignored off (0) and observed on (1).
PASS: real worker seeded usage, cancel, confirmed clear, 2s completion, layout off/on and usage visibility.
PASS: master pause/resume takes effect live.
PASS: real toolbar popup opens on non-ChatGPT tab.
PASS: non-ChatGPT tab → hollow dot and open-chat prompt.
```

Experimental layout, local and session storage were cleared in the smoke's finally block.
The restore launcher briefly returned before CDP was ready; the first restore connection
reported ECONNREFUSED. A subsequent restore command succeeded before releasing the lock:

```text
Restored: <chat> composer: "\n"
```

The composer contains only its empty-editor newline (no text). Final launcher status:

```text
extensions: ~/snap/chromium/common/butter-blank-head
lock absent
```

Normal launcher flags and the required tab were restored. No shared lab browser operations
were performed after releasing the lock.

## Commands and actual output

Dependency setup:

```sh
npm ci --prefix lab/harness
npm ci
```

Actual output: `added 2 packages, and audited 3 packages in 358ms` and
`added 1 package, and audited 2 packages in 325ms`; both reported `found 0 vulnerabilities`.
The initial system Python lacked Brotli; font subsetting succeeded in an isolated temporary
venv with fontTools and Brotli. The local font output was:

```text
Nunito-OFL.txt 4385
Bagel-Fat-One-OFL.txt 4485
bagel-wordmark.woff2 3152
nunito-latin.woff2 33140
```

```sh
node design/icon/regenerate.mjs
```

```text
icon-16.png (16×16, transparent)
icon-32.png (32×32, transparent)
icon-48.png (48×48, transparent)
icon-128.png (128×128, transparent)
```

```sh
npm run format
node --test
```

```text
ℹ tests 147
ℹ suites 0
ℹ pass 147
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 434.502622
```

```sh
npm run format:check
python3 scripts/check-version.py
```

```text
> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"

Checking formatting...
All matched files use Prettier code style!
OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
```

```sh
BUTTER_MOCKUP=~/.t3/worktrees/butter/t3-54326eed/mockups/popup-butter-paper.html node lab/harness/popup-qa.mjs
```

```text
PASS: 24 full 320px state screenshots (12 states × light/dark), native-height scroll views, melt frames, real worker usage/clear, keyboard, focus, reduced motion; no errors or network requests.
```

```sh
BUTTER_CASES=11,12 BUTTER_SHOTS=(not archived) node lab/harness/popup-qa.mjs
```

```text
PASS: 4 full 320px state screenshots (2 states × light/dark), native-height scroll views, melt frames, real worker usage/clear, keyboard, focus, reduced motion; no errors or network requests.
```

```sh
LAB_EXTENSIONS=~/snap/chromium/common/butter-popup-build ~/.local/share/chatgpt-lab/bin/lab restart-browser
bash (not archived)
node (not archived)
```

Actual smoke/restore output is quoted above. Full local log: lab-smoke.log (not archived).
Other commands included reading the requested repo/spec files, `node --check` on the popup and
QA harness, image/geometry comparison scripts, `git diff --check` (no output), `git status
--short` (no output after commits), and the three `git add`/`git commit` operations listed above.
The early asset test expected the previous raster header; it was updated to validate inline
SVG and local font assets. The first screenshot QA caught an incorrectly set-up focus check;
keyboard modality was added, then the final capture and assertions passed.

Full final Node output: butter-tests.log (not archived).
Formatting: log (not archived). Version: log (not archived).
All raw captures and logs remain under `/tmp`; none were committed or published.
