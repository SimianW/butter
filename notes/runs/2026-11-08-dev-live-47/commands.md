# Commands and observed output

Private fixture URLs, identifiers from locator error output, local scratch paths and browser
restore output are excluded. The shared lab library resolves private configuration locally.
Read-only file inspection (`cat`, `sed`, `rg`) covered the files listed in the report, the workflow,
package scripts, recorder/sources, existing fixture harness and XTest helper. No ChatGPT message was
sent. The full local CI command output is in [checks.txt](checks.txt).

## Setup

```text
$ gh issue view 47 -R SimianW/butter
title: Dev build: live lab check and the bug-fix handoff
state: OPEN
number: 47
[Full body read; acceptance criteria transcribed into report.md.]

$ gh issue view 32 -R SimianW/butter
title: Dev build: bug capture with a shortcut, one file per bug
state: OPEN
number: 32
[Full body read, including Testing Decisions, Docs and Out of Scope.]

$ git fetch origin
[exit 0; no output]

$ git rev-parse HEAD origin/t3/32-dev-bug-capture
cb1cdce439bef95f001eceace2ac1182352bc9c3
cb1cdce439bef95f001eceace2ac1182352bc9c3

$ git switch -c t3/47-live-check
Switched to a new branch 't3/47-live-check'

$ python3 scripts/package.py --dev
[worktree]/dist/butter-0.1.0-alpha.15+dev.1.zip
Note: Chrome version remains 0.1.0.15; remove the previous install before loading this test build.

$ node --check lab/harness/dev-capture-live.mjs
[exit 0; no output]
```

## Live command and output

The same command was used for all six attempts; the harness was corrected between attempts as
described in the report. The first four failed before a capture; all restored/released the lab.
Their meaningful errors, with private locator values removed, were:

```text
1. AssertionError [ERR_ASSERTION]: native classic scrollbar exists
2. locator.waitFor: Timeout 60000ms exceeded.
   waiting for locator('.thread-scroll-container [data-turn-key]').first() to be visible
   locator resolved to hidden [turn; private attribute value omitted]
3. INFO scroller geometry: {"x":1589,"top":52,"height":860,"scrollHeight":1268,"width":20,"scrollbarWidth":"thin","overflowY":"auto","orderCount":5}
   AssertionError [ERR_ASSERTION]: fixture is a real long chat
4. INFO scroller geometry: {"x":1589,"top":52,"height":860,"scrollHeight":93520,"width":20,"scrollbarWidth":"thin","overflowY":"auto","orderCount":9}
   AssertionError [ERR_ASSERTION]: fixture is a real long chat

After every attempt:
PASS lab-restore: ok, default extension, one home tab, composer empty
PASS lab-lock release: released own lock
```

First passing run:

```text
$ BUTTER_DEV_ZIP=dist/butter-0.1.0-alpha.15+dev.1.zip node lab/harness/dev-capture-live.mjs
PASS lab-lock acquire --lab auto --owner butter-47-live-check --wait 60 --needs-fixture math12: lab 1
PASS browser restarted with only dev extension; send guard installed
PASS fixture loaded; Butter diagnostics available
INFO scroller geometry: {"x":1589,"top":52,"height":860,"scrollHeight":16182,"width":20,"scrollbarWidth":"thin","overflowY":"auto","orderCount":6}
PASS real long fixture: 6 turns, scrollHeight 16182, viewport 860, scrollbar 20px
PASS toast visible while pointer held; pointer-events none; focus unchanged
PASS drag continued in same session: 12 -> 24 updates; ended on pointerup
PASS saved butter-diag/round-1/bug-01_06-10-10.json: 21 events, 6 readiness rows, pointerHeld true
PASS privacy: 133 private tokens checked, 0 matches; all strings allowlisted
PASS lab-restore: ok, default extension, one home tab, composer empty
PASS lab-lock release: released own lock
[exit 0]
```

Final run, after strengthening the live text comparison:

```text
$ BUTTER_DEV_ZIP=dist/butter-0.1.0-alpha.15+dev.1.zip node lab/harness/dev-capture-live.mjs
PASS lab-lock acquire --lab auto --owner butter-47-live-check --wait 60 --needs-fixture math12: lab 1
PASS browser restarted with only dev extension; send guard installed
PASS fixture loaded; Butter diagnostics available
INFO scroller geometry: {"x":1589,"top":52,"height":860,"scrollHeight":16182,"width":20,"scrollbarWidth":"thin","overflowY":"auto","orderCount":6}
PASS real long fixture: 6 turns, scrollHeight 16182, viewport 860, scrollbar 20px
PASS toast visible while pointer held; pointer-events none; focus unchanged
PASS drag continued in same session: 13 -> 25 updates; ended on pointerup
PASS saved butter-diag/round-1/bug-01_06-11-20.json: 21 events, 6 readiness rows, pointerHeld true
PASS privacy: 1263 private tokens checked, 0 matches; all strings allowlisted
PASS lab-restore: ok, default extension, one home tab, composer empty
PASS lab-lock release: released own lock
[exit 0]

$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock status
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}

$ git diff --check
[exit 0; no output]

$ npx prettier --write lab/harness/dev-capture-live.mjs
[exit 0; no output]

$ python3 [inline archive integrity/privacy validator]
PASS archive integrity/privacy scan: bug-01_06-10-10.json; 268800 bytes; cleanup verified
PASS archive integrity/privacy scan: bug-01_06-11-20.json; 268908 bytes; cleanup verified
```

The final inline validator loaded each summary and archived download, checked its recorded SHA-256
and byte size, verified held state, press/seek events and readiness counts, scanned URL/email/ID
patterns, and checked the restore/release witnesses. It did not modify either file.

The script runs `lab-lock acquire`, `lab restart-browser`, `xtest-keys.py Shift 640 400`,
`xtest-keys.py Alt+Shift+B`, `lab-restore`, and `lab-lock release` via the external lab library
and child processes. Private browser paths and restore URLs are intentionally not reproduced.

## Local CI

```text
npm ci: exit 0
npm run format:check: exit 0
npm run lint: exit 0
node --test: exit 0
python3 -m unittest discover -s scripts -p 'test_*.py': exit 0
python3 scripts/check-version.py: exit 0
python3 scripts/review-tier.py origin/main: exit 0
```

Selected actual output (complete output in `checks.txt`):

```text
All matched files use Prettier code style!
ℹ tests 359
ℹ pass 359
ℹ fail 0
Ran 47 tests in 1.384s
OK
OK: 0.1.0-alpha.15 / 0.1.0.15; manifest, READMEs, and changelog agree.
Review tier: 2
extension/popup/popup.js (storage or consent)
```

The tier is for the complete integration diff against `origin/main`, not only this ticket's
report, harness and documentation. No PR was requested or created.
