# Commands and redacted actual output

This is an aborted control run, not a completed benchmark. No PR was opened. Private identifiers and endpoints are replaced with placeholders; raw captures remain local. Shared checkout path: `/home/simon/Dev/butter`. Temporary work directory: `/tmp/replay-blocking-work/`, mode 700.

## Read-only preparation

Read the host lab README and `lab/README.md` first; read `docs/bugfix.md`, `notes/runs/README.md`, `GLOSSARY.md` and the diagnosing-bugs skill. Recovered the historical driver with `rg --files /tmp/butter-bench-final /tmp/rail-model-live-work` and `cat`/`sed` of stream, fixture, common, settings and identity modules; inspected the #92 adapter and preparation runner. Relevant exact signal outputs are reproduced below; raw account/chat-bearing source output is omitted.

```text
$ git status --porcelain=v1
?? .claude/
?? lab/variants/cv-v1-trip-blocks/
?? lab/variants/cv-v2-trip-turns/
?? lab/variants/cv-v3-always-blocks/
?? notes/pdf-scroll-browser-evidence.md
?? notes/pdf-scroll-design.md
?? notes/pdf-scroll-full-history.md
?? notes/pdf-scroll-hybrid-native.md
?? notes/pdf-scroll-reading-view.md
$ git branch --show-current
main
$ git rev-parse HEAD
8d0840b38d1b0f420c7b5337df7a7b4ec7fe1e8d
```

```text
$ git show origin/main:notes/runs/2026-11-11-rail-model-live/report.md  # before fetch
fatal: path 'notes/runs/2026-11-11-rail-model-live/report.md' does not exist in 'origin/main'
$ git fetch origin
From https://github.com/SimianW/butter
 * [new branch]      fix/88-dil-harness-tap -> origin/fix/88-dil-harness-tap
   a100fd6..2f24127  main                   -> origin/main
$ git rev-parse origin/main
2f2412706c318e2592c081e13436cee8e1af80c6
```

`git show origin/main:notes/runs/2026-11-11-rail-model-live/report.md` and `commands.md` then succeeded after fetch. Their Builds and method/provenance and Replay adapter changes sections were read. Source-tree reads made no changes.

```text
$ mkdir -p /tmp/replay-blocking-work; chmod 700 /tmp/replay-blocking-work
(exit 0, no output)
$ gh release download v0.1.0-alpha.11 -R SimianW/butter -D /tmp/replay-blocking-work/builds
(exit 0, no output)
$ sha256sum /tmp/replay-blocking-work/builds/*.zip
8cc5476fdd0ac4748aa2b726dd0a1c1308f0b7ec6a63c3bd19dbd77c1f57a3ef  /tmp/replay-blocking-work/builds/butter-0.1.0-alpha.11.zip
$ mkdir /tmp/replay-blocking-work/builds/a11 /tmp/replay-blocking-work/builds/main
$ unzip -q /tmp/replay-blocking-work/builds/butter-0.1.0-alpha.11.zip -d /tmp/replay-blocking-work/builds/a11
$ git archive origin/main extension | tar -x -C /tmp/replay-blocking-work/builds/main
(all exit 0, no output)
$ python3 /tmp/replay-blocking-work/prepare.py
staged a11 42 entries
staged main 80 entries
fixture 359b4fe33317cb357e4f6646f3dc443dd6338241e53897039349c23fa239d345
recording 36b773bf0733ff3f4df3856157834243bfdcf886af1fbc2f0600631d251ca05c
M1-source b39be6a2a9fe43a5d52a4c273fbc1be228811a21b388b8f16fc39fde44bf44d8
M2-source 0249f58a22ce0c92703a198af7551849f31254ac938680ebe1061dc4b1235630
$ node --check /tmp/replay-blocking-work/harness/control-safety.mjs
(exit 0, no output)
```

The preparation script copied the historical harness and frozen inputs into the task directory, staged pristine build copies in Snap-readable new directories, redirected copied helper outputs, adapted only temporary drivers for control instrumentation, and ran `node --check` for m1/m2/fixtures/common/fixture-identity/rate-watch. No extension code edits. A subsequent byte comparison printed `archive latest matches zip True`.

```text
$ uname -r
7.0.0-38-generic
$ lsb_release -d
Description:	Ubuntu 24.04.5 LTS
$ lscpu  # selected actual output
CPU(s):                                  12
On-line CPU(s) list:                     0-11
Model name:                              Intel(R) Core(TM) i5-10400 CPU @ 2.90GHz
```

## Lab invocations and outputs

Both invocations were `python3 /tmp/replay-blocking-work/run.py > /tmp/replay-blocking-work/run.log 2>&1`. The runner executed the commands below, with `LAB_ID` resolved from the lock output and `CHAT` resolved privately from the named `math12` fixture. No private fixture URL appears in a published command. Each measured browser restart used explicit `LAB_EXTENSIONS` (empty for none; task-owned alpha.11 directory for a11) and empty M1 extra flags. For no-extension, extension storage and rail/CV checks were skipped.

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner replay-blocking --wait 1800 --perf --needs-fixture math12
# UTC 2026-11-11T20:42:05.305529+00:00 -> 2026-11-11T20:42:05.369589+00:00; exit 0; 0.064 s
1
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T20:42:05.369947+00:00 -> 2026-11-11T20:42:07.440988+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2783730)
```

```text
$ node /tmp/replay-blocking-work/harness/m1.mjs M1-none-1 1
# UTC 2026-11-11T20:42:07.441151+00:00 -> 2026-11-11T20:42:07.805487+00:00; exit 1; 0.364 s
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

browserType.connectOverCDP: connect ECONNREFUSED <LAB_CDP>
Call log:
  - <ws preparing> retrieving websocket url from http://<LAB_CDP>

    at /tmp/replay-blocking-work/harness/m1.mjs:41:32
    at async node:internal/modules/esm/loader:633:26 {
  log: [
    '  - <ws preparing> retrieving websocket url from http://<LAB_CDP>'
  ],
  name: 'Error',
  code: 'ECONNREFUSED'
}

Node.js v24.17.0
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner replay-blocking
# UTC 2026-11-11T20:42:07.805670+00:00 -> 2026-11-11T20:42:18.445688+00:00; exit 0; 10.64 s
restore lab 1: restarting browser (now {"pid":2783730,"extensions":[],"flags":[]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 2784093)
restored {"lab":1,"restarted":true,"url":"<REDACTED_CHAT_URL>","composer":"","pages":["<REDACTED_CHAT_URL>"],"browser":{"pid":2784093,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T20:42:17.810Z","ok":true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner replay-blocking
# UTC 2026-11-11T20:42:18.445934+00:00 -> 2026-11-11T20:42:18.510006+00:00; exit 0; 0.064 s
{"lab": 1, "lab_released": true, "perf_released": true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock status
# UTC 2026-11-11T20:42:18.510137+00:00 -> 2026-11-11T20:42:18.573992+00:00; exit 0; 0.064 s
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner replay-blocking --wait 1800 --perf --needs-fixture math12
# UTC 2026-11-11T20:42:33.620149+00:00 -> 2026-11-11T20:42:33.684300+00:00; exit 0; 0.064 s
1
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T20:42:33.684662+00:00 -> 2026-11-11T20:42:35.758339+00:00; exit 0; 2.074 s
chromium: stopped
chromium: started (pid 2784990)
```

```text
$ node /tmp/replay-blocking-work/harness/m1.mjs M1-none-1 1
# UTC 2026-11-11T20:42:39.282362+00:00 -> 2026-11-11T20:45:21.496054+00:00; exit 0; 162.214 s
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
20:42:40 [M1-none-1] replaying 189 chunks over 122s, 1 reps
20:43:05 [M1-none-1] fresh-history {"rep":1,"beforeReset":{"url":"https://chatgpt.com/","ticks":0,"rows":[]},"freshHistory":{"ticks":0,"rows":[5]}}
20:43:45 [M1-none-1] progress {"rep":1,"elapsedMs":30187,"chunks":74,"total":189,"started":true,"done":false}
20:44:15 [M1-none-1] progress {"rep":1,"elapsedMs":60366,"chunks":105,"total":189,"started":true,"done":false}
20:44:48 [M1-none-1] progress {"rep":1,"elapsedMs":92749,"chunks":140,"total":189,"started":true,"done":false}
20:45:21 [M1-none-1] rep 1: fps=14.9 p95=333.3 jank=18.5% busy=87.2% style=63.6% blocked=76.9s maxFreeze=2916 keyP95=329.8 keyMax=406 wheelP95=430 LoAF[renderSL=74.5s forcedSL=31.3s script=8.5s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1158 seenMarks=0 butter=null nodes=194641 turns=9 chunks=189/189
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
# UTC 2026-11-11T20:45:21.503650+00:00 -> 2026-11-11T20:45:23.574469+00:00; exit 0; 2.071 s
chromium: stopped
chromium: started (pid 2789651)
```

```text
$ node /tmp/replay-blocking-work/harness/m1.mjs M1-a11-1 1
# UTC 2026-11-11T20:45:27.095727+00:00 -> 2026-11-11T20:45:41.539658+00:00; exit 1; 14.444 s
storage seed {"version":"0.1.0-alpha.11","storage":{"butter":{"enabled":true,"layoutConsent":"granted","opts":{"layout":true}}}}
environment {"version":"\n            \n              156.0.8078.47\n              (Official Build)\n              snap\n              (x86_64)\n  \n            \n            \n              \n            \n          ","extensionVerified":true}
20:45:28 [M1-a11-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":3870,"visibleScrollers":1,"off":""}
file:///tmp/replay-blocking-work/harness/control-safety.mjs:32
 const denied=await page.evaluate(()=>window.__replay?.denied?.length??0);if(denied)throw Error('FETCH_WRITE_GUARD_TRIPPED');
                                                                                          ^

Error: FETCH_WRITE_GUARD_TRIPPED
    at checkPage (file:///tmp/replay-blocking-work/harness/control-safety.mjs:32:91)
    at async runOnce (file:///tmp/replay-blocking-work/harness/m1.mjs:160:162)
    at async file:///tmp/replay-blocking-work/harness/m1.mjs:242:33

Node.js v24.17.0
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner replay-blocking
# UTC 2026-11-11T20:45:41.539999+00:00 -> 2026-11-11T20:45:51.727665+00:00; exit 0; 10.188 s
restore lab 1: restarting browser (now {"pid":2789651,"extensions":["/home/simon/snap/chromium/common/replay-blocking-a11"],"flags":[]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 2790479)
restored {"lab":1,"restarted":true,"url":"<REDACTED_CHAT_URL>","composer":"","pages":["<REDACTED_CHAT_URL>"],"browser":{"pid":2790479,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T20:45:51.090Z","ok":true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner replay-blocking
# UTC 2026-11-11T20:45:51.727892+00:00 -> 2026-11-11T20:45:51.791921+00:00; exit 0; 0.064 s
{"lab": 1, "lab_released": true, "perf_released": true}
```

```text
$ /home/simon/.local/share/chatgpt-lab/bin/lab-lock status
# UTC 2026-11-11T20:45:51.792054+00:00 -> 2026-11-11T20:45:51.855885+00:00; exit 0; 0.064 s
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

The first attempt ended before measurement because CDP was not ready. Its restore/release succeeded. The runner was changed to wait for CDP plus 3 s before connecting, then restarted under a new perf lock.

The initial helper checked completed network writes but did not reject accumulated fetch denials. A denial assertion was added while the first none process was already running; alpha.11 loaded it and stopped before replay. Later inspection found 46 fetch denials and 3 route denials in the none raw record. That observation is excluded. No live work followed the detected trip. The failed alpha.11 process did not persist its denied paths/final network counters.

```text
$ python3 /tmp/replay-blocking-work/export.py
/tmp/replay-blocking-work/publish/notes/runs/2026-11-11-replay-blocking
$ python3 /tmp/replay-blocking-work/commands-export.py
commands.md exported
```

## Final local verification before publication

```text
$ python3 [task-owned checkout/build verification]
statusUnchanged True
branchUnchanged True
headUnchanged True
a11FilesPristine True
mainFilesPristine True
$ git ls-remote --heads origin t3/replay-blocking
(exit 0, no output; branch absent before publication)
$ python3 /tmp/replay-blocking-work/privacy.py
{
  "filesScanned": 10,
  "identifierNeedles": 110,
  "textFragmentNeedles": 6,
  "uuid": 0,
  "chatURL": 0,
  "email": 0,
  "privateEndpoint": 0,
  "bearerCredential": 0,
  "tokenCredential": 0,
  "privateIdentifiers": 0,
  "capturedTextFragments": 0,
  "allJsonLeavesNumeric": 1,
  "passed": 1
}
```

The verification byte-compared both Snap-readable build copies with their immutable inputs, then removed only those task-owned runtime copies after restore. Raw captures and build archives remain under the private temporary directory.

Publication commands use a temporary index: `GIT_INDEX_FILE=/tmp/replay-blocking-work/index git read-tree origin/main`, then `git hash-object -w`, `git update-index --add --cacheinfo`, `git write-tree`, `git commit-tree -p origin/main`, and `git push origin <commit>:refs/heads/t3/replay-blocking`. The pushed SHA and actual push output are recorded in the final task reply/local publication log; a commit cannot contain its own final SHA. No checkout, git add, branch switch, or PR command is used.
