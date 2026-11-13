# Commands and actual outputs

Only diagnosis was performed. Long output is retained in the linked files; below are the commands, exit states and diagnostic lines. User attachment filenames and private fixture URLs are omitted. `VIDEO` and `BUG_JSON` below denote the supplied MP4/JSON paths, passed as literal data paths, never evaluated as code.

## Instructions, repository and dependency inspection

Read with `cat`/`sed`: `~/.agents/machine.md`, `~/.agents/skills/diagnosing-bugs/SKILL.md`, `docs/bugfix.md`, `notes/diagnostics/README.md`, `lab/README.md`, `~/.local/share/chatgpt-lab/README.md`, `~/.local/share/chatgpt-lab/lib/lab.mjs`, `docs/agents/seams.md`, `docs/how-it-works.md`, `GLOSSARY.md`, and the privacy/introduction section of `notes/runs/README.md`. Output: the checked-in/local instructions; no modifications.

Read/search with `rg`, `cat`, `sed`, `nl -ba`: `extension/manifest.json`, `shared/status.js`, `shared/settings.js`, `dev/recorder.js`, `dev/sources.js`, `stream/containment.css`, `stream/offscreen.js`, `history/conversation-main.js`, `seek/core-main.js`, `seek/preview-main.js`, `seek/layout-cache-main.js`, `seek/anchor-main.js`, `rail/turns.js`, `rail/jump.js`, `rail/rail.js`; the existing seek/history/rail tests and fake-DOM helpers; `lab/harness/rail-scripts.mjs`, `nav-takeovers.mjs`, `dil-renderer.mjs`, bookmarks-live and its lab/driver helpers. Output: source used to construct the controlled loop and identify line references in the report. `rg --files docs/adr` reported that directory does not exist; a search for `lab/harness/lib` likewise found no such directory.

```sh
git status --short
git rev-parse HEAD origin/main
git diff origin/main...HEAD --stat
```

Initially clean. Heads:

```text
9fd9387664ab97b0764eb6e8e4bcc73b28049662
fac81813891d4c13fa603b6f79b37cc27eb69c80
52 files changed, 1857 insertions(+), 511 deletions(-)
```

```sh
git diff origin/main...HEAD -- extension/rail/turns.js extension/rail/jump.js extension/seek extension/history
git diff --quiet origin/main HEAD -- extension/rail/turns.js extension/rail/jump.js
```

No diff; the second command exited 0.

```sh
npm ci
```

Exit 0: `added 90 packages, and audited 91 packages in 966ms`; `found 0 vulnerabilities`. npm also printed its existing ESLint-version deprecation notice. No tracked files changed.

## Live lab attempt

```sh
~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner middle-button-diagnosis --wait 1800 --perf
```

Exit 0, stdout `1`.

```sh
git worktree add --detach /tmp/butter-middle-main fac81813891d4c13fa603b6f79b37cc27eb69c80
```

Exit 0:

```text
Preparing worktree (detached HEAD fac8181)
HEAD is now at fac8181 Merge pull request #107 from SimianW/simianize-rerun
```

Created a unique `~/snap/chromium/common/butter-middle-diagnosis/` scratch tree with `mkdir -p`; `cp -a extension/. .../branch/` and `cp -a /tmp/butter-middle-main/extension/. .../main/` copied the source extensions unchanged. Created this report directory with `mkdir -p`.

```sh
LAB_ID=1 LAB_EXTENSIONS=/home/Simian/snap/chromium/common/butter-middle-diagnosis/branch LAB_FLAGS=--enable-blink-features=MiddleClickAutoscroll ~/.local/share/chatgpt-lab/bin/lab restart-browser
```

Launcher exit 0, `chromium: started (pid 1183768)`. This did **not** mean the process stayed running. The actual launch log was:

```text
nohup: failed to run command '/snap/bin/chromium': No such file or directory
```

A scratch Node probe imported the lab library, connected over CDP, installed the send guard, and would have opened the named `math12` fixture. The first invocation failed to resolve Playwright, before connection:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from .../lib/lab.mjs
```

Retry, with the now-installed dependency explicitly supplied:

```sh
LAB_PLAYWRIGHT="$PWD/node_modules/playwright" NAV=1 node /tmp/butter-middle-probe.mjs
```

Exit 1:

```text
browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9222
```

`lab status`, `tail` of its launch log, `command -v chromium`, `ls -l /snap/bin/chromium` and inspection of `labs.json` confirmed the absent configured executable. Status: `xvfb: stopped`, `chromium: stopped`, `x11vnc: stopped`, `novnc: stopped`; `ls` reported `No such file or directory`.

```sh
timeout 15s env LAB_PLAYWRIGHT="$PWD/node_modules/playwright" ~/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner middle-button-diagnosis
```

Exit 124. Actual output is in [lab-restore-output.txt](lab-restore-output.txt), with the default extension path redacted. It attempted another restart using the missing executable. Then:

```sh
~/.local/share/chatgpt-lab/bin/lab stop
~/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner middle-button-diagnosis
```

Exit 0; stop printed nothing; release printed:

```json
{"lab":1,"lab_released":true,"perf_released":true}
```

## Attachment inspection

```sh
mktemp -d /tmp/butter-middle-video.XXXXXX
```

Exit 0, created a new empty outside-repo directory. Only that directory held extracted private frames/contact sheets.

```sh
ffprobe -v error -show_entries format=duration -show_entries stream=width,height,r_frame_rate -of json "$VIDEO"
ffmpeg -v error -i "$VIDEO" -vf 'fps=2,scale=960:-1' /tmp/butter-middle-video.6FDOw8/frame-%03d.png
```

Exit 0; ffprobe output: video width `1586`, height `976`, frame rate `30/1`, duration `3.903979`. Eight PNGs were created. Viewed frames 001, 003, 005 and 008 with the image tool. `magick montage` made an outside-repo cropped contact sheet of all eight; inspected that sheet too. No captured image was copied into the repo.

```sh
ffmpeg -v error -i "$VIDEO" -vf 'crop=690:760:440:30,scale=128:141,format=gray' -f rawvideo /tmp/butter-middle-video.6FDOw8/gray.raw
python3 -I - <<'PY'
# Read only the derived grayscale bytes, compute vertical row projections,
# compare shifts against frame zero, and emit numeric motion data.
PY
```

Exit 0. Actual summary: `frames: 116`, `minVerticalShiftPx: -91.6`, `maxVerticalShiftPx: 0.0`. Numeric results and method caveat: [video-motion.json](video-motion.json). An earlier optional Pillow crop attempt exited 1 with `ModuleNotFoundError: No module named 'PIL'`; ImageMagick was used instead.

`python3 -I` with the standard-library `json` module read the supplied bug JSON twice: first to inspect allowlisted settings/events/geometry, then to write [diagnostic-summary.json](diagnostic-summary.json). No JSON strings were executed. Actual output included `version "0.1.0-alpha.21+dev.8"`, `trigger "button"`, `pointerHeld false`, four turns/two mounted, nine `estimated` rejections and `failures {}`. The report explains what these do and do not establish. No raw IDs, chat text or video content is saved here.

## Isolated native-autoscroll controls

Cached Playwright Chromium was available (`158.0.8127.18`), and `/usr/bin/Xvfb` was installed. The T3 preview tools were also checked: status initially reported unavailable, `about:blank` was rejected as an unsupported protocol, and opening with no URL succeeded; that unused blank tab was closed. Browser experiments then used the explicitly requested Playwright extension fixture, independent of the unavailable authenticated lab.

Two scratch pilot scripts were created outside the repo with shell heredocs/Python fixed-source transformations:

```sh
xvfb-run -a env EXT="$PWD/extension" node /tmp/butter-middle-fixture.mjs
xvfb-run -a env EXT="$PWD/extension" PIN=1 RESIZE=1 node /tmp/butter-middle-pin.mjs
```

Exit 0 for both. Fresh-page pilot: `top: 20312`, `height: 33512`, trusted `pointerdown`/`mousedown` with `button: 1`, `buttons: 4`, monotonically increasing scroll samples, seek inactive. Pinned/resize pilot: repeated samples `8690,8501,8690,8503,...`, ending at `8501`, seek inactive. These pilots established that native autoscroll was available and that a rail pin plus size notifications creates a sharp red signal.

The controlled driver was written outside the repo; its exact source is retained in [fixture-driver.txt](fixture-driver.txt):

```sh
xvfb-run -a node /tmp/butter-middle-matrix.mjs > notes/runs/2026-11-13-middle-button-autoscroll/matrix-output.txt 2>&1
```

Exit 0; 23 configurations completed. All actual summary lines: [matrix-output.txt](matrix-output.txt); all input events/scroll geometry: [matrix.json](matrix.json). It includes branch/main/none, pin/no-pin, size-change/no-size-change, nine single-key ablations, and wheel controls.

A fixed-source transformation restricted the same driver to `pin-resize` and repeated branch/main/none twice, writing separate files:

```sh
xvfb-run -a node /tmp/butter-middle-repeat.mjs > notes/runs/2026-11-13-middle-button-autoscroll/repeats-output.txt 2>&1
```

Exit 0; six configurations completed. Actual output: [repeats-output.txt](repeats-output.txt); samples: [repeats.json](repeats.json).

## First-seam red and existing controls

Created **only** `test/middle-button-autoscroll.test.mjs` as a source/test addition, then:

```sh
npx prettier --write test/middle-button-autoscroll.test.mjs
node --test test/middle-button-autoscroll.test.mjs
```

Prettier exited 0. Test exited **1**, wheel passed and middle failed, with `start=236, final=236`; exact output: [red-output.txt](red-output.txt).

```sh
cp test/middle-button-autoscroll.test.mjs /tmp/butter-middle-main/test/middle-button-autoscroll.test.mjs
node --test /tmp/butter-middle-main/test/middle-button-autoscroll.test.mjs
```

Exit **1** for the test on main; same preserved-progress failure: [main-red-output.txt](main-red-output.txt). The copied main test was subsequently removed.

```sh
node --test test/seek-activation.test.js test/history-thumb-hold.test.mjs
```

Exit 0: 40 tests, 40 pass, zero fail. Exact output: [existing-controls-output.txt](existing-controls-output.txt).

```sh
node - <<'JS'
const c = require('./extension/seek/core-main.js');
console.log('middle-button classification:', JSON.stringify(c.classifyPress({
  isTrusted: true, button: 1, pointerType: 'mouse', targetIsScroller: true
})));
JS
```

Exit 0:

```text
middle-button classification: {"kind":null,"reason":"button"}
```

## Artifacts and cleanup

Standard-library `python3 -I` generated the numeric comparison HTML from `matrix.json` and the safe diagnostic summary. No original captured images or chat content were included. T3 `html_preview` reported no console messages and rendered at height 365; `html_render` displayed that synthetic numeric comparison.

Removed the temporary main test, then `git worktree remove /tmp/butter-middle-main`; removed the copied extension scratch tree only after the independent browser runs ended. Independent contexts and their temporary profiles were closed/deleted by each driver's `finally` block. Checked the main worktree was absent and the task checkout remained at `9fd9387`.

The first combined cleanup command was rejected before execution because it used `rm -rf`. The safer retry used `rm -r` on the exact task-created extension directory and succeeded. No approval was needed.

Final checks:

```sh
npx eslint test/middle-button-autoscroll.test.mjs
git status --short
git rev-parse --short HEAD
```

ESLint exited 0 with no findings. A standard-library `python3 -I` scan of the report folder found no unexpected UUIDs, original account-chat prefixes or credential markers: `artifact privacy scan: PASS`. Cleanup facts are in [cleanup.json](cleanup.json). Actual repository status:

```text
?? notes/runs/2026-11-13-middle-button-autoscroll/
?? test/middle-button-autoscroll.test.mjs
```

HEAD remained `9fd9387`. A final direct invocation of the red command also exited 1, with the same one pass / one fail and preserved-progress assertion.

No full test suite or release checks were run: the deliverable deliberately includes a failing diagnostic test and no product change.
