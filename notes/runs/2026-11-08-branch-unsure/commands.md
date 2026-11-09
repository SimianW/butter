# Commands and actual outputs

Only signal-bearing output is retained here. Private URLs/IDs, the lab hostname and account paths are redacted. `$LAB_HOST` denotes the user-provided SSH host; `<repo>` denotes this worktree. Shell source reads are listed without reproducing the private lab configuration contents.

## Instructions and source reads

Read with `cat`, `sed`, `rg`, `nl` and `head`:

- `lab/README.md`, `docs/bugfix.md`, `docs/development.md`, `notes/runs/README.md`, `AGENTS.md`.
- `diagnosing-bugs/SKILL.md` and `research/SKILL.md`. No further delegation: the user's explicit instruction overrides the research skill's background-agent default.
- `extension/branch/{logic,run,page,content}.js`, `extension/manifest.json`, `test/branch-run.test.js`, and `lab/harness/{branch-live,branch-fixture,branch-qa}.mjs`.
- Both local and remote `~/.local/share/chatgpt-lab/{README.md,labs.json,lib/lab.mjs,bin/lab}`. The remote configuration had authenticated profiles and both Chinese/math and English project fixtures.

`git status --short` initially printed nothing. `git rev-parse HEAD` printed:

```text
a8d111a7c64490b079856bf234ac945c3109b574
```

## Initial local attempts

```sh
~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner branch-unsure-research --wait 1800 --needs-fixture math12
```

```text
1
```

A new Snap-readable copy of `extension/` was made, then `LAB_ID=1 LAB_EXTENSIONS=<copy> .../bin/lab restart-browser` reported a started PID, but its process exited. Relevant actual diagnostic output:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'playwright' imported from <lab-root>/lib/lab.mjs
browserType.connectOverCDP: connect ECONNREFUSED <lab-CDP>
xvfb: stopped
chromium: stopped
nohup: failed to run command '/snap/bin/chromium': No such file or directory
du: cannot access '<home>/snap/chromium/common/*profile*': No such file or directory
```

```sh
npm ci --prefix lab/harness
```

```text
added 2 packages, and audited 3 packages in 508ms
found 0 vulnerabilities
```

The initial default offline browser launch also failed:

```text
browserType.launch: Executable doesn't exist at <home>/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome
```

The cached revision 1254 was used explicitly afterward. Local lock cleanup:

```sh
~/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner branch-unsure-research
```

```json
{"lab": 1, "lab_released": true, "perf_released": false}
```

## Remote setup

```sh
ssh "$LAB_HOST" 'cat ~/.local/share/chatgpt-lab/README.md ~/.local/share/chatgpt-lab/labs.json'
ssh "$LAB_HOST" '~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 2 --owner branch-unsure-research --wait 1800 --needs-fixture math12'
```

The first command read the instructions/configuration; its private URLs are omitted. The second printed:

```text
2
```

```sh
rsync -a extension/ "$LAB_HOST":snap/chromium/common/butter-branch-unsure-a8d111a/
ssh "$LAB_HOST" 'LAB_ID=2 LAB_EXTENSIONS=$HOME/snap/chromium/common/butter-branch-unsure-a8d111a ~/.local/share/chatgpt-lab/bin/lab restart-browser'
```

`rsync` exited 0 with no output. Browser output (PID redacted):

```text
chromium: stopped
chromium: started (pid <pid>)
```

Read-only CDP inspections of fixture content returned Chinese/math paragraphs and this empty composer shape:

```html
<div contenteditable="true" role="textbox" class="ProseMirror ProseMirror-focused" data-composer-markdown="">
<p data-empty-paragraph="true" data-placeholder="Ask ChatGPT" class="placeholder before:composer-placeholder"><br class="ProseMirror-trailingBreak"></p>
</div>
```

Unrelated attributes omitted. The model button's actual label/text was `Select ChatGPT model`, `Thinking effort\nInstant`.

## Live probes

Scripts were transferred using `scp <script> "$LAB_HOST":/tmp/<script>`, which exited 0 with no output. Remote invocations:

```sh
ssh "$LAB_HOST" 'node /tmp/branch-unsure-live.mjs'
```

First invocation, before adding a rendered-math hydration wait, exited 1:

```text
AssertionError [ERR_ASSERTION]: selection found
actual: null
expected: true
```

The next toolbar invocation's UI observer timed out:

```text
locator.waitFor: Timeout 70000ms exceeded.
- waiting for locator('chatgpt-butter-branch .line, chatgpt-butter-branch .card.err') to be visible
```

A separate `ssh "$LAB_HOST" 'node --input-type=module'` CDP inspection returned the actual isolated-world terminal trace; its sanitized values are retained in `data/live-chinese.json`. Critical actual fields:

```text
states: loading, branching, verifying, sending(verified:true), unsure(cause:composer)
fill result: true
sendButton: {label:"Send",type:"submit",disabled:false}
isRendered: true
expectedLength: 123
composerText length: 132
matchesExpected: false
```

A second toolbar attempt used polling of that trace and emitted the same comparison and `line:"line unsure"`. Its driver was subsequently terminated while cleaning up:

```text
[tailscale-ssh: process died: signal: terminated]
```

An auxiliary concurrent inspector failed to attach during the debugger session:

```text
browserType.connectOverCDP: Timeout 30000ms exceeded.
```

Debuggers were resumed and the lab browser restarted under the same lock before the English check. A rescue-file `scp` attempt failed because the timed-out inspector had not written that optional file:

```text
scp: /tmp/branch-unsure-rescue.json: No such file or directory
```

This is why Chinese data provenance explicitly says transcribed from sanitized output, not copied from that absent file.

```sh
ssh "$LAB_HOST" 'node /tmp/branch-unsure-adapter.mjs'
```

Exited 0:

```text
loading fixture
running real adapter
```

The following actual JSON record is retained in `data/live-english.json`; its key fields are:

```text
state: ready
expectedLength: 85
composerText length: 88
matchesExpected: true
send: {inBranch:true,rendered:true}
```

```sh
ssh "$LAB_HOST" 'LAB_ID=2 LAB_EXTENSIONS= ~/.local/share/chatgpt-lab/bin/lab restart-browser'
ssh "$LAB_HOST" 'node /tmp/branch-unsure-control.mjs'
```

Control exited 0. Its complete output record is retained in `data/live-control.json`; relevant actual fields:

```text
fill: true
whiteSpace: break-spaces
paragraphs: 5
butterPresent: false
nativeSendClicked: true
blocked: /backend-api/f/conversation/prepare
error: net::ERR_BLOCKED_BY_CLIENT.Inspector
```

There were two blocked preparation requests. No question was delivered.

## Red and existing tests

```sh
node --test test/branch-run.test.js
```

Exited 0; actual final lines:

```text
ℹ tests 38
ℹ suites 0
ℹ pass 38
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 112.932623
```

```sh
BROWSER_EXECUTABLE="$HOME/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome" node lab/harness/branch-unsure-composer.mjs
```

Exited 1 on each run. Exact stdout/stderr (repo path redacted) is in `data/red-output.txt`; exact synthetic strings and markup are in `data/fixture.json`.

```text
AssertionError [ERR_ASSERTION]: two Chinese paragraphs with inline math: full formatted message should be sent in the verified branch (cause=composer)
'unsure' !== 'ready'
```

`node --check` on the new harness and all three diagnostic `.mjs` scripts exited 0 with no output. Own scripts were formatted using pinned `prettier@3.6.2`; the harness needed `--ignore-path /dev/null` because the repo's formatter ignores `lab/`.

## Restore and release

`ssh "$LAB_HOST" 'node --input-type=module'` called `L.restore` with the lock owner, then `L.release` only after a successful restore. Actual stdout:

```json
{"ok":true,"restarted":false,"composerEmpty":true,"pages":1,"extensions":0}
{"lab":2,"lab_released":true,"perf_released":false}
```

Stored as `data/restore.json`. No commit or push command ran.

Final `git diff --exit-code -- extension/` exited 0 with no output. `git status --short` printed only:

```text
?? lab/harness/branch-unsure-composer.mjs
?? notes/runs/2026-11-08-branch-unsure/
```
