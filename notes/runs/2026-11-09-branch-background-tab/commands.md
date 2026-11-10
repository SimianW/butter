# Commands and observed output

`$LAB_HOST` below replaces the private SSH hostname. `$LAB_EXT` denotes the fresh snap-readable extension directory on that host. Account fixture URLs, the workspace path, machine endpoints and authentication material are redacted or omitted. JSON result links retain the actual observations; selected output fields below are excerpts, not new measurements. Repeated inspection commands are grouped rather than duplicating private lab documentation.

## Setup and discovery

Read with `cat`/`sed`: `lab/README.md`, `docs/bugfix.md`, `notes/runs/README.md`, `AGENTS.md`, the diagnosing-bugs and TDD skills, the local and remote lab README, existing branch harnesses, branch modules, throttle module, worker tests, and CI configuration. Used `rg --files` / `rg -n` for relevant files and timer/visibility hooks. `git status --short` initially produced no output.

```text
$ pwd
<workspace>

$ npm ci --prefix lab/harness
added 2 packages, and audited 3 packages in 423ms
found 0 vulnerabilities
```

The first local lab acquisition printed `1`. The local launcher printed a Chromium PID, but connecting failed:

```text
browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9222
```

`lab status` reported all four services stopped. Reading its Chromium log showed:

```text
nohup: failed to run command '/snap/bin/chromium': No such file or directory
```

`ls -ld` found neither authenticated profile directory. Local `timeout 20s .../lab-restore --lab 1 --owner branch-background-tab` exited 124. The local lock was then released:

```text
{"lab": 1, "lab_released": true, "perf_released": false}
```

The user supplied the SSH host. On that host:

```sh
ssh "$LAB_HOST" 'cat ~/.local/share/chatgpt-lab/README.md'
ssh "$LAB_HOST" '~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner branch-background-tab --wait 60 --needs-fixture math12'
```

Acquire output:

```text
1
```

Copied extension files with `rsync -a extension/ "$LAB_HOST":snap/chromium/common/<fresh-task-extension>/`, and copied the probes/instrumentation with `scp`. Applied `python3 /tmp/branch-background-instrument.py "$LAB_EXT"` on the host. Browser restarts used:

```sh
LAB_ID=1 LAB_EXTENSIONS="$LAB_EXT" LAB_FLAGS= ~/.local/share/chatgpt-lab/bin/lab restart-browser
```

Restarts reported `chromium: stopped` and `chromium: started (pid ...)`. A fresh extension path was used for the worker prototype so its new imported worker script was loaded.

## Live experiments

The commands below ran over SSH on the locked host. The probe was copied to `/tmp/branch-background-probe.mjs`; it is retained here as [probe.mjs](probe.mjs). Results were copied back with `scp`.

| Invocation environment before `node /tmp/branch-background-probe.mjs` | Observed output fields / exit |
|---|---|
| `LAB_ID=1 LAB_OWNER=branch-background-tab STAGE=immediate OUTPUT=/tmp/bg-immediate.json EXPECT_READY=1` | `hiddenEnd.state="ready"`, `hidden=true`, `frames=0`; exit 0; [data](data/immediate.json) |
| `... STAGE=settled OUTPUT=/tmp/bg-settled.json EXPECT_READY=1` | `state="ready"`, `hidden=true`; exit 0; [data](data/settled.json) |
| `... STAGE=streaming OUTPUT=/tmp/bg-streaming.json EXPECT_READY=1` on baseline | `state="waiting-for-reply"`, `hidden=true`, `replay.done=true`; exit 1, expected `ready`; [data](data/streaming-red.json) |
| `... STAGE=streaming OUTPUT=/tmp/bg-stream-timers.json EXPECT_READY=1` on baseline | `state="verifying"`, `sleeps="32"`, branch HTTP 200; foreground result `ready`; exit 1; [data](data/streaming-timers-red.json) |
| `... STAGE=streaming-visible OUTPUT=/tmp/bg-stream-visible.json EXPECT_READY=1` on baseline | `state="ready"`, `hidden=false`; exit 0; [data](data/streaming-visible.json) |
| `... STAGE=streaming OUTPUT=/tmp/bg-no-timer-throttle.json EXPECT_READY=1` with diagnostic browser flag | `state="ready"`, `hidden=true`, fixed rAF count; exit 0; [data](data/no-timer-throttle.json) |
| `... STAGE=streaming OUTPUT=/tmp/bg-worker-hidden.json EXPECT_READY=1` on fresh worker prototype | `state="ready"`, `hidden=true`; exit 0; [data](data/worker-hidden-1.json) |
| `... STAGE=streaming OUTPUT=/tmp/bg-worker-hidden-2.json EXPECT_READY=1` | `state="ready"`, `hidden=true`, `blockedSend="net::ERR_BLOCKED_BY_CLIENT.Inspector"`; worker counters unchanged at 148/148; exit 0; [data](data/worker-hidden-2.json) |
| `... STAGE=streaming OUTPUT=/tmp/bg-worker-hidden-3.json EXPECT_READY=1` | `state="ready"`, `hidden=true`, branch HTTP 200, guarded final send; worker counters unchanged at 113/113; exit 0, including hidden/rAF/branch/guard/idle assertions; [data](data/worker-hidden-3.json) |
| `... STAGE=streaming-visible OUTPUT=/tmp/bg-worker-visible.json EXPECT_READY=1` | `state="ready"`, `hidden=false`; worker counters unchanged at 236/236; exit 0; [data](data/worker-visible.json) |
| `... STAGE=immediate UI=1 OUTPUT=/tmp/bg-worker-ui-immediate.json EXPECT_READY=1` | actual UI: `state="ready"`, `hidden=true`, `tailMatches=true`, branch HTTP 200, guarded send; worker counters unchanged at 28/28; exit 0; [data](data/worker-ui-immediate.json) |
| `... STAGE=visible UI=1 OUTPUT=/tmp/bg-worker-ui-visible.json EXPECT_READY=1` | actual UI: `state="ready"`, `hidden=false`, branch HTTP 200, guarded send; worker counters unchanged at 145/145; exit 0; [data](data/worker-ui-visible.json) |

The diagnostic browser restart added only:

```sh
LAB_FLAGS=--disable-background-timer-throttling
```

The native control restarted with `LAB_EXTENSIONS= LAB_FLAGS=` and ran:

```sh
LAB_ID=1 LAB_OWNER=branch-background-tab OUTPUT=/tmp/bg-native-control.json node /tmp/branch-background-native-control.mjs
```

Actual stdout:

```json
{"end":{"hidden":true,"frames":130,"timers":43,"replay":{"started":true,"done":true,"chunks":189,"mocks":["sentinel","prepare","sentinel","prepare"]},"streaming":false,"butter":false},"nativeBranchRendered":true}
```

The script exited 0. [Full result](data/native-control.json).

### Excluded setup attempts

- A default Playwright connection kept background documents visible. Its capture had `hidden=false` and advancing rAF; discarded. A connection with `noDefaults:true` then reported `native visible hidden` for the foreground/background pair.
- An initial synthetic handoff used an invalid negative origin tab ID. The lab-only claim probe returned `{"error":"storage"}`. It was replaced with a valid-shaped origin ID; actual UI checks later used the real handoff.
- A replay selector initially filled the hidden composer copy: `AssertionError: the local stream reached the real page`, `false !== true`. A Playwright click retry then timed out on the duplicate/disabled Send control. The final probe types into the visible hydrated composer and waits for an enabled button.
- A direct unauthenticated singular conversation GET returned `{status:404, keys:["detail"]}`. The final harness captures ChatGPT's own authenticated plural conversation response instead. An initial replay result with an invalid branch is [explicitly excluded](data/excluded-invalid-branch.json).
- One immediate post-restart connection returned `ECONNREFUSED`; the final probe retries CDP startup.
- A reused extension path did not provide a working new delay handler in an initial prototype setup; it never started the run. It was excluded and a fresh extension directory used.
- One temporary Python script edit had `SyntaxError: invalid syntax`; it was corrected before any corresponding lab run.

These failures are setup failures, not evidence for the reported bug.

## Regression and repository checks

```text
$ node --test test/branch-worker.test.mjs     # before worker implementation
ℹ tests 6
ℹ pass 5
ℹ fail 1
AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
+ 'undefined'
- 'function'
```

```text
$ node --test test/branch-worker.test.mjs     # after implementation
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

```text
$ npm ci
added 88 packages, and audited 89 packages in 923ms
found 0 vulnerabilities

$ npx prettier --write extension/branch/content.js extension/branch/worker.js test/branch-worker.test.mjs
extension/branch/content.js 103ms (unchanged)
extension/branch/worker.js 10ms (unchanged)
test/branch-worker.test.mjs 17ms

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!

$ npm run lint
npm notice run lint
npm notice run eslint .

$ node --test
ℹ tests 456
ℹ pass 456
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0

$ python3 -m unittest discover -s scripts -p 'test_*.py'
Ran 70 tests in 3.331s
OK

$ python3 scripts/check-version.py
OK: 0.1.0-alpha.18 / 0.1.0.18; manifest, READMEs, and changelog agree.

$ git diff --check
(no output; exit 0)
```

Full repository-check stdout/stderr is in `data/check-{format,lint,node,python,version}.txt`. The five checks were run independently in parallel. Additional artifact checks: `node --check` on both retained JavaScript probes; `rg` for debug markers in product/test changes; a scan of retained artifacts for real UUIDs, private endpoint strings and credentials. The final scan result is recorded in [summary.json](data/summary.json).

## Restoration

An inline Node command imported the shared lab library, called `L.restore(lab, {log:()=>{}})`, printed only non-private status fields, and called `L.release(lab)` in `finally`.

Actual stdout:

```text
chromium: stopped
chromium: started (pid 3032046)
{"restored":true,"restarted":true,"pages":1,"composerEmpty":true}
{"lab":1,"lab_released":true,"perf_released":false}
```

Final environment check before restoration:

```json
{"browser":"Chrome/156.0.8078.47","flags":[],"extensionVersion":"0.1.0-alpha.18","headed":true}
```

The prototype remains uncommitted in this checkout. No commit, push or PR commands were run.

Final artifact validation:

```text
$ node --check notes/runs/2026-11-09-branch-background-tab/probe.mjs
(no output; exit 0)
$ node --check notes/runs/2026-11-09-branch-background-tab/native-control.mjs
(no output; exit 0)
$ git apply --reverse --check notes/runs/2026-11-09-branch-background-tab/prototype.patch
(no output; exit 0)
$ git diff --check
(no output; exit 0)
Privacy scan: {"filesScanned":26,"unexpectedIdentifierOrCredentialMatches":0,"rawReplayExported":false}
```
