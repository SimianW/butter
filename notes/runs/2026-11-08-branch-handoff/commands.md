# Commands and actual outputs

Run from `/home/simon/.t3/worktrees/butter/t3-9d5b9df2`, on 2026-11-08 UTC.
Diagnostic outputs below retain actual observed values with conversation IDs/Project segments
replaced by placeholders. Full recorded probe output is in the linked JSON/stdout files.

## Setup and source checks

```sh
pwd
```

```text
/home/simon/.t3/worktrees/butter/t3-9d5b9df2
```

```sh
git status --short
```

Initial output: empty (clean worktree).

Read before testing:

```sh
cat lab/README.md
cat docs/bugfix.md
cat notes/runs/README.md
cat /home/simon/.local/share/chatgpt-lab/README.md
cat /home/simon/.agents/skills/diagnosing-bugs/SKILL.md
```

These print the source instructions; the local lab README contains private fixture URLs and its
full output is intentionally excluded. Follow-up source inspection used `cat`, `sed -n`, `nl -ba`,
and `rg` on `AGENTS.md`, the extension manifest, `extension/branch/{content,logic,worker,page,ui}.js`,
`extension/storage/layout-worker.js`, the shared lab library, and the existing branch harnesses.
An attempted `cat GLOSSARY.md` returned `cat: GLOSSARY.md: No such file or directory`; an initial
search also reported `rg: lab/harness/lib.mjs: No such file or directory` (the lab library is
outside the repo). No nested `AGENTS.md` was found under the probed directories.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner branch-handoff-9d5b9df2 --wait 1800
```

```text
1
```

```sh
mkdir -p /home/simon/snap/chromium/common/branch-handoff-9d5b9df2
cp -a extension/. /home/simon/snap/chromium/common/branch-handoff-9d5b9df2/
LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/branch-handoff-9d5b9df2 /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 1009072)
```

```sh
git rev-parse HEAD
```

```text
933c2e15ae761f93f440a7ff43d327ace4aec8d8
```

```sh
node --version
git tag --list 'v0.1.0-alpha.15*'
git diff v0.1.0-alpha.15 HEAD -- extension/branch/logic.js extension/branch/worker.js extension/branch/content.js
```

```text
v24.17.0
v0.1.0-alpha.15
```

The diff printed nothing. Saving it as `source-equivalence.diff` and running
`wc -c notes/runs/2026-11-08-branch-handoff/source-equivalence.diff` printed:

```text
0 notes/runs/2026-11-08-branch-handoff/source-equivalence.diff
```

## Live probe commands

Each probe connects with the shared lab library and installs the lab send guard. The captured
stdout commands use `set -o pipefail` and `2>&1 | tee <mode>-output.txt` so the probe's exit status
is preserved. The script evolved during initial setup; failures below identify those attempts.

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs baseline
```

Final baseline run exited 0. Actual outcomes are in [baseline.json](baseline.json):

```text
project-fresh-document: put {ok:true}; received butter-branch-claimed; reason null; originalUnchanged true
normal-fresh-document: put {ok:true}; received butter-branch-claimed; reason null; originalUnchanged true
```

The lines above are a compact extraction of the recorded JSON fields. Initial attempts exited 1
with these actual setup errors, before the final baseline was collected:

```text
AssertionError [ERR_ASSERTION]: Butter worker is running
locator.waitFor: Timeout 8000ms exceeded.
  - waiting for locator('chatgpt-butter-branch .chip') to be visible
```

The first was an already-idle worker; a harmless message wakes it before worker instrumentation.
The second candidate was Work mode: the isolated-world facts were
`{"temporary":false,"work":true,"branchAction":true}`. It was excluded, then a normal Chat-mode
candidate (`work:false`) passed.

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs spa
```

Run twice successfully through the scenario, both reproducing the reported error and a passing
page-reload control. The final version deliberately exited 1 on the symptom assertion. Full
actual output: [spa-output.txt](spa-output.txt); data: [spa.json](spa.json).

```text
AssertionError [ERR_ASSERTION]: Ask in branch should hand over after sidebar navigation
+ actual - expected

+ 'Couldn’t hand your question to the new tab. Try again.'
- null
```

Intermediate setup attempts also exited 1 with:

```text
AssertionError [ERR_ASSERTION]: project conversation in sidebar
```

One comparison required matching conversation IDs rather than the entire sidebar href; later,
an explicit wait was needed because sidebar links loaded after the composer. These setup
failures did not count as handoff reproductions.

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs navigation
```

Exited 0; both Project → normal and Project → Project reproduced the exact reason and worker
`invalid` result. Full actual output: [navigation-output.txt](navigation-output.txt);
[navigation.json](navigation.json).

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs idle
```

Two runs exited 0. First, leaving CDP attached kept a worker target present, so it was repeated
with CDP disconnected. The second run printed:

```json
{"step":"idle-start","workerTargets":1,"waitMs":36000,"disconnectingCDP":true}
{"step":"idle-end","workerTargets":0,"waitMs":36000}
```

Then the actual put returned `ok:true`, and `butter-branch-claimed` was received, with reason null.
Full output: [idle-output.txt](idle-output.txt), [idle.json](idle.json). The preliminary run is
retained as [idle-attached-output.txt](idle-attached-output.txt), [idle-attached.json](idle-attached.json).

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs slow
```

The first slow-load probe exited 1 with this Playwright setup error:

```text
Error: Frame for this navigation request is not available, because the request
was issued before the frame is created. You can check whether the request
is a navigation request by calling isNavigationRequest() method.
```

Full output: [slow-setup-error.txt](slow-setup-error.txt). The navigation gate was adjusted to
identify the popup request without calling `request.frame()` before the frame exists.

The corrected slow-load probe exited 0. Full actual output: [slow-output.txt](slow-output.txt),
[slow.json](slow.json). Put returned `ok:true`; the original received `butter-branch-claimed`;
the worker timestamps were `1794186983864` for put and `1794186999153` for claim. The recorded
navigation delay was 15 seconds and the original stayed unchanged.

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs reload
```

The open-tab attempt reproduced the exact reason. Actual content-world output:

```json
{"type":"butter-branch-put","threw":"Extension context invalidated."}
```

The mode then exited 1 because its subsequent page-reload control lacked a Butter isolated
world. It did not establish recovery for the orphaned-context variation:

```text
AssertionError [ERR_ASSERTION]: Butter isolated world exists
```

Full actual output: [reload-output.txt](reload-output.txt); saved first attempt: [reload.json](reload.json).

```sh
EXT= LAB_ID=1 bash -c 'LAB_EXTENSIONS="$EXT" exec /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser'
```

This maps the requested empty `EXT` to the live lab launcher's `LAB_EXTENSIONS` variable.

```text
chromium: stopped
chromium: started (pid 1038015)
```

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs control
```

Exited 0. Actual stdout (also in [control-output.txt](control-output.txt)):

```json
{"label":"project","kind":"no-extension-control","url":"/g/g-p-<project>/c/<chat-1>","markdownReplies":5,"composer":1,"branchHost":0,"workers":0}
{"label":"normal","kind":"no-extension-control","url":"/c/<chat-2>","markdownReplies":3,"composer":1,"branchHost":0,"workers":0}
```

```sh
diff -qr extension/ /home/simon/snap/chromium/common/branch-handoff-9d5b9df2/
git diff --exit-code
git status --short
```

Both diff commands exited 0 with no output. Status printed only:

```text
?? notes/runs/2026-11-08-branch-handoff/
```

## Other exploratory observations

Small `node --input-type=module` snippets connected through `L.connect`, installed the send guard,
and inspected counts/route kinds, without saving page content. Actual sanitized observations:

```json
{"reply":0,"markdown":10,"articles":0,"login":false,"path":"/g/g-p-<project>/c/<chat>","bodyLength":963}
{"normalLinks":4,"projectLinks":13,"markdown":10,"ready":"complete","bodyTextLength":963}
```

The zero `reply` count came from an outdated author-role selector; ChatGPT's current assistant
markdown selector found the replies. The harness uses that selector.

The shared preview was checked and its temporary blank tab closed. It has a separate profile;
the live run used the authenticated lab browser over CDP. No screenshots were saved.

## Restoration and cleanup

Ran this Node script via `node --input-type=module`:

```js
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import assert from 'node:assert/strict';
const lab={...L.getLab(1),owner:'branch-handoff-9d5b9df2'};
const r=await L.restore(lab,{log:()=>{}});
console.log(JSON.stringify({restore:{lab:r.lab,ok:r.ok,restarted:r.restarted,
  homeMatches:r.url===lab.homeUrl,composerEmpty:r.composer.trim()==='',pages:r.pages.length,
  defaultExtensions:r.browser.extensions.length===(lab.defaultExtensions||[]).length}}));
assert.ok(r.ok);
console.log(JSON.stringify({release:L.release(lab)}));
```

Exited 0. Actual output:

```text
chromium: stopped
chromium: started (pid 1039917)
{"restore":{"lab":1,"ok":true,"restarted":true,"homeMatches":true,"composerEmpty":true,"pages":1,"defaultExtensions":true}}
{"release":{"lab":1,"lab_released":true,"perf_released":false}}
```

A Python privacy scan checked all report artifacts against 15 private URL tokens from the local
discovery state, literal conversation UUIDs, and private machine endpoint patterns. Actual
initial output before adding the cleanup documentation and inventory:

```json
{"filesScanned":20,"privateUrlTokensChecked":15,"privateUrlTokenMatches":0,"literalUuidMatches":0,"privateEndpointMatches":0}
```

The final scan is saved in [privacy.json](privacy.json). Cleanup removes only this task's
temporary staged extension and discovery file:

```sh
rm -r /home/simon/snap/chromium/common/branch-handoff-9d5b9df2
rm /tmp/butter-branch-handoff-9d5b9df2.json
```

No output. No commit or fix was made.

An initial combined cleanup command using forced removal was rejected before execution:
`rm -f style commands are not permitted. Use a safer approach`. Cleanup uses the non-forced,
explicit paths above instead.
