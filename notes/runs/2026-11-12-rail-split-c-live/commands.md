# Commands and actual output

Commands run in the pinned worktree named below. Logs are actual output with private chat URLs, identifiers and endpoints redacted. Branch output is projected to measured public fields; private titles, screenshots and chat-content fingerprints are omitted. Setup and publication commands are recorded separately below.

## Preparation

Read `lab/README.md`, the host lab README, `docs/benchmarks.md`, `notes/runs/README.md` and the prior split-A/B reports and commands. The shared checkout is stale: the first direct reads of split-A/B report/commands files returned `No such file or directory` (exit 1). Fetched origin, then read them with `git show origin/main:<path>` and from their surviving report worktrees. No shared checkout files changed.

```sh
git fetch origin
git rev-parse origin/t3/split-rail-c
```

```text
From https://github.com/SimianW/butter
   6215c42..1bde0d2  main            -> origin/main
   50c2fd1..7d44f25  t3/split-rail-b -> origin/t3/split-rail-b
 * [new branch]      t3/split-rail-c -> origin/t3/split-rail-c
5c6a6272a22175033092afa32cba000005c196cb
```

```sh
mkdir -m 700 /tmp/rail-split-c-live-work
git worktree add --detach /home/simon/snap/chromium/common/rail-split-c-s0 4e6c25928ee3eb1b31a91533ce6490ce7ea0358e
git worktree add --detach /home/simon/snap/chromium/common/rail-split-c-main 1bde0d28af4994b011bb96b3095d773f3d1db4f4
git worktree add --detach /home/simon/snap/chromium/common/rail-split-c-pr 5c6a6272a22175033092afa32cba000005c196cb
```

```text
Preparing worktree (detached HEAD 4e6c259)
HEAD is now at 4e6c259 Merge pull request #94 from SimianW/t3/replay-blocking
Preparing worktree (detached HEAD 1bde0d2)
HEAD is now at 1bde0d2 Merge pull request #97 from SimianW/t3/split-rail-b
Preparing worktree (detached HEAD 5c6a627)
HEAD is now at 5c6a627 review: fold in #97's F4-F6: a fake mark lands per bookmark and a second row jumps; pin view.found's guard with a card moved to meanwhile; credit rail/jump.js for the flash ring; rail-dom's header names its module tests
```

```sh
python3 /tmp/rail-split-c-live-work/setup.py
python3 /tmp/rail-split-c-live-work/verify-builds.py
python3 /tmp/rail-split-c-live-work/run-bench.py
```

Setup output:

```text
Prepared three pinned builds; identical replay adapter; private copies only; auth/convcheck/lock adapters ready.
```

Verification output is retained in the pinned extension verification section. Runner commands and actual output are expanded by stage below. The setup links existing dependencies; copies the unchanged replay adapter and fixtures from split-A; changes the safety helper's private fixture path; copies split-B's owner/wait/perf/auth/convcheck adapter with the new task name; and copies branch-live with only its output directory changed. The after-check runs before browser disconnect, so matrix shortcut restoration may stop Chromium afterward. Conversation mismatches write a STOP marker and stop subsequent suites. No tracked extension/harness files are patched.

`rg`/`cat`/`sed`/`ls`/`git show`/`git worktree list` were used for read-only setup inspection, and `date`/`ps`/`tail` for progress. Two guessed inspection paths (`bookmarks/live-lab.mjs`, `bookmarks/live.mjs`) did not exist; inspected the actual `bookmarks-live/lab.mjs` afterward. These errors did not affect lab runs.

```sh
sha256sum /home/simon/snap/chromium/common/rail-split-main/lab/harness/bench-live.mjs /home/simon/snap/chromium/common/rail-split-c-s0/lab/harness/bench-live.mjs /home/simon/snap/chromium/common/rail-split-c-pr/lab/harness/bench-live.mjs /tmp/rail-split-c-live-work/raw/*
```

```text
0249f58a22ce0c92703a198af7551849f31254ac938680ebe1061dc4b1235630  <split-A>/lab/harness/bench-live.mjs
0249f58a22ce0c92703a198af7551849f31254ac938680ebe1061dc4b1235630  <S0>/lab/harness/bench-live.mjs
0249f58a22ce0c92703a198af7551849f31254ac938680ebe1061dc4b1235630  <C>/lab/harness/bench-live.mjs
359b4fe33317cb357e4f6646f3dc443dd6338241e53897039349c23fa239d345  <private-work>/raw/math-nine.json
36b773bf0733ff3f4df3856157834243bfdcf886af1fbc2f0600631d251ca05c  <private-work>/raw/recording.json
```

## Interrupted final replay and recovery

The active tool wait was interrupted during C repetition 5. The Python runner and its Node child had stopped; `ps` found neither. The partial replay log contains its start and active-Butter preflight but no result line, and its result directory is empty. Nine completed samples were already saved. The interrupted command has no observed process exit status and is not counted as a sample:

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-5 1
```

Actual partial output:

```text
09:31:17 [bench-pr-5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
```

`lab-lock status` showed lab 1 and perf still held by this task; lab 2 was free. Ran `python3 /tmp/rail-split-c-live-work/recover.py`: checked the server against this attempt's before fingerprint, restored defaults and released the owned locks. All three stages exited 0. Ran `python3 /tmp/rail-split-c-live-work/resume-bench.py` then `python3 /tmp/rail-split-c-live-work/run-functional.py`. The resumed runner acquires a fresh perf lock and repeats only unfinished C repetition 5. It retains the nine earlier completed samples. Expanded commands and outputs follow below.

## Matched wash repeat

The first C wash command exited 1. It passed five setup/theme checks but threw at `wash-bookmark` before creating any bookmark, then skipped six dependent wash scenarios. The runner prints a synthetic thrown failure in addition to the five successful checks, so its terminal summary is 5/6, while summary.json stores five successful check rows plus a separate failure field. The other build's initial wash completed 42/42. After the original branch comparison and its successful restore/release, ran a matched repeat on both pinned builds:

```sh
cp /tmp/butter-bookmarks-live-error.txt /tmp/rail-split-c-live-work/wash-pr-error.txt
python3 /tmp/rail-split-c-live-work/repeat-wash.py
```

The captured private error file's public error and source stack were:

```text
phase=wash-bookmark error=Error
Error: paragraph target unmounted
    at requireThat (file://<C-worktree>/lab/harness/bookmarks-live/page.mjs:23:17)
    at washBookmark (file://<C-worktree>/lab/harness/bookmarks-live/wash.mjs:34:3)
    at async Object.run (file://<C-worktree>/lab/harness/bookmarks-live/wash.mjs:281:70)
    at async runScenarios (file://<C-worktree>/lab/harness/runner/index.mjs:94:9)
    at async runLive (file://<C-worktree>/lab/harness/bookmarks-live/harness.mjs:36:14)
    at async file://<C-worktree>/lab/harness/bookmarks-live.mjs:47:12
```

No extension or tracked harness code was changed to obtain the repeat. All first-attempt data and command outputs are retained. The branch `ls-remote` during testing returned `ce7454c0b6ce9277ac8b214a1e268a147520398a`; the measured C build remains the requested `5c6a6272a22175033092afa32cba000005c196cb`.

## Publication worktree

```sh
git fetch origin
git log -3 --oneline origin/t3/split-rail-c
git worktree add --detach /tmp/rail-split-c-live-report origin/t3/split-rail-c
cd /tmp/rail-split-c-live-report
git switch -c t3/split-rail-c --track origin/t3/split-rail-c
```

```text
From https://github.com/SimianW/butter
   5c6a627..ce7454c  t3/split-rail-c -> origin/t3/split-rail-c
ce7454c review: pin the card's grace over the card, refill's whole-pixel centre, the hint's Escape and seek from a hidden card; the rail's leftward move within the card, a seek's end and Escape before the rail is built; palette credits rail/style.js for --dot
5c6a627 review: fold in #97's F4-F6: a fake mark lands per bookmark and a second row jumps; pin view.found's guard with a card moved to meanwhile; credit rail/jump.js for the flash ring; rail-dom's header names its module tests
4e8243b rail: split the card's DOM adapter (rail/card.js) and the shadow-root CSS (rail/style.js) out of rail.js
Preparing worktree (detached HEAD ce7454c)
HEAD is now at ce7454c review: pin the card's grace over the card, refill's whole-pixel centre, the hint's Escape and seek from a hidden card; the rail's leftward move within the card, a seek's end and Escape before the rail is built; palette credits rail/style.js for --dot
Switched to a new branch 't3/split-rail-c'
branch 't3/split-rail-c' set up to track 'origin/t3/split-rail-c'.
```


## bench-acquire

Started 2026-11-12T09:06:17.065213+00:00; finished 2026-11-12T09:06:17.129104+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-c-live --wait 1800 --perf --needs-fixture math12
```

```text
1
```

## bench-restart-main-1

Started 2026-11-12T09:06:17.129465+00:00; finished 2026-11-12T09:06:19.200424+00:00; exit 0; 2.071 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-s0/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-s0/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3855905)
```

## bench-main-1-before

Started 2026-11-12T09:06:21.200737+00:00; finished 2026-11-12T09:06:23.168485+00:00; exit 0; 1.968 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-1-before
```

```text
convcheck bench-main-1-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-main-1

Started 2026-11-12T09:06:23.168603+00:00; finished 2026-11-12T09:09:00.569769+00:00; exit 0; 157.401 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-s0.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-1 1
```

```text
09:06:26 [bench-main-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:09:00 [bench-main-1] rep 1: fps=45.9 p95=50.1 jank=5.2% busy=54.7% style=18.5% blocked=12.7s maxFreeze=843 keyP95=249.1 keyMax=255.5 wheelP95=100 LoAF[renderSL=23s forcedSL=2.3s script=2.4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1175 seenMarks=440 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4062,"visibleScrollers":1,"off":""}
```

## bench-main-1-after

Started 2026-11-12T09:09:00.569923+00:00; finished 2026-11-12T09:09:02.288275+00:00; exit 0; 1.718 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-1-after
```

```text
convcheck bench-main-1-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-pr-1

Started 2026-11-12T09:09:02.289132+00:00; finished 2026-11-12T09:09:04.359797+00:00; exit 0; 2.071 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3860154)
```

## bench-pr-1-before

Started 2026-11-12T09:09:06.360113+00:00; finished 2026-11-12T09:09:07.676286+00:00; exit 0; 1.316 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-1-before
```

```text
convcheck bench-pr-1-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-pr-1

Started 2026-11-12T09:09:07.676424+00:00; finished 2026-11-12T09:11:45.193130+00:00; exit 0; 157.517 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-1 1
```

```text
09:09:11 [bench-pr-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:11:44 [bench-pr-1] rep 1: fps=46.1 p95=50.1 jank=5.1% busy=54.2% style=18.1% blocked=12.4s maxFreeze=817 keyP95=250.7 keyMax=257.1 wheelP95=101 LoAF[renderSL=22.5s forcedSL=2.1s script=2.5s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1178 seenMarks=441 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
```

## bench-pr-1-after

Started 2026-11-12T09:11:45.193274+00:00; finished 2026-11-12T09:11:46.961463+00:00; exit 0; 1.768 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-1-after
```

```text
convcheck bench-pr-1-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-main-2

Started 2026-11-12T09:11:46.962226+00:00; finished 2026-11-12T09:11:49.034267+00:00; exit 0; 2.072 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-s0/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-s0/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3863907)
```

## bench-main-2-before

Started 2026-11-12T09:11:51.034501+00:00; finished 2026-11-12T09:11:52.451017+00:00; exit 0; 1.417 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-2-before
```

```text
convcheck bench-main-2-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-main-2

Started 2026-11-12T09:11:52.451146+00:00; finished 2026-11-12T09:14:30.100188+00:00; exit 0; 157.649 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-s0.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-2 1
```

```text
09:11:56 [bench-main-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:14:29 [bench-main-2] rep 1: fps=46.3 p95=50 jank=4.9% busy=54% style=18.4% blocked=12.5s maxFreeze=793 keyP95=282.2 keyMax=294.1 wheelP95=97 LoAF[renderSL=22.7s forcedSL=2.1s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1166 seenMarks=441 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
```

## bench-main-2-after

Started 2026-11-12T09:14:30.100323+00:00; finished 2026-11-12T09:14:32.721644+00:00; exit 0; 2.621 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-2-after
```

```text
convcheck bench-main-2-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-pr-2

Started 2026-11-12T09:14:32.722723+00:00; finished 2026-11-12T09:14:34.793970+00:00; exit 0; 2.071 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3868250)
```

## bench-pr-2-before

Started 2026-11-12T09:14:36.794362+00:00; finished 2026-11-12T09:14:43.529133+00:00; exit 0; 6.735 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-2-before
```

```text
convcheck bench-pr-2-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-pr-2

Started 2026-11-12T09:14:43.529309+00:00; finished 2026-11-12T09:17:21.243386+00:00; exit 0; 157.714 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-2 1
```

```text
09:14:47 [bench-pr-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:17:20 [bench-pr-2] rep 1: fps=46.5 p95=50 jank=5% busy=54.4% style=18% blocked=11.9s maxFreeze=781 keyP95=249.7 keyMax=255.9 wheelP95=100 LoAF[renderSL=22.2s forcedSL=2.3s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=440 butter={"smootherFrames":392,"published":391} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-pr-2-after

Started 2026-11-12T09:17:21.243549+00:00; finished 2026-11-12T09:17:23.362427+00:00; exit 0; 2.119 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-2-after
```

```text
convcheck bench-pr-2-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-main-3

Started 2026-11-12T09:17:23.363490+00:00; finished 2026-11-12T09:17:25.437134+00:00; exit 0; 2.074 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-s0/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-s0/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3872072)
```

## bench-main-3-before

Started 2026-11-12T09:17:27.437411+00:00; finished 2026-11-12T09:17:28.903940+00:00; exit 0; 1.467 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-3-before
```

```text
convcheck bench-main-3-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-main-3

Started 2026-11-12T09:17:28.904074+00:00; finished 2026-11-12T09:20:06.311754+00:00; exit 0; 157.408 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-s0.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-3 1
```

```text
09:17:32 [bench-main-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:20:06 [bench-main-3] rep 1: fps=46.5 p95=50 jank=4.8% busy=53.5% style=18.1% blocked=12.1s maxFreeze=802 keyP95=248.2 keyMax=254.9 wheelP95=99 LoAF[renderSL=22.4s forcedSL=2.1s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=439 butter={"smootherFrames":391,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
```

## bench-main-3-after

Started 2026-11-12T09:20:06.311905+00:00; finished 2026-11-12T09:20:08.129628+00:00; exit 0; 1.818 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-3-after
```

```text
convcheck bench-main-3-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-pr-3

Started 2026-11-12T09:20:08.130905+00:00; finished 2026-11-12T09:20:10.203484+00:00; exit 0; 2.073 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3876342)
```

## bench-pr-3-before

Started 2026-11-12T09:20:12.203750+00:00; finished 2026-11-12T09:20:13.870790+00:00; exit 0; 1.667 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-3-before
```

```text
convcheck bench-pr-3-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-pr-3

Started 2026-11-12T09:20:13.870933+00:00; finished 2026-11-12T09:22:51.435448+00:00; exit 0; 157.565 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-3 1
```

```text
09:20:17 [bench-pr-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:22:51 [bench-pr-3] rep 1: fps=46.5 p95=50 jank=4.8% busy=53.7% style=18% blocked=11.5s maxFreeze=841 keyP95=247.6 keyMax=253.8 wheelP95=96 LoAF[renderSL=22.1s forcedSL=2.2s script=2.3s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1172 seenMarks=443 butter={"smootherFrames":389,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
```

## bench-pr-3-after

Started 2026-11-12T09:22:51.435597+00:00; finished 2026-11-12T09:22:54.308711+00:00; exit 0; 2.873 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-3-after
```

```text
convcheck bench-pr-3-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-main-4

Started 2026-11-12T09:22:54.310195+00:00; finished 2026-11-12T09:22:56.382584+00:00; exit 0; 2.072 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-s0/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-s0/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3880520)
```

## bench-main-4-before

Started 2026-11-12T09:22:58.382840+00:00; finished 2026-11-12T09:22:59.899505+00:00; exit 0; 1.517 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-4-before
```

```text
convcheck bench-main-4-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-main-4

Started 2026-11-12T09:22:59.899632+00:00; finished 2026-11-12T09:25:36.902421+00:00; exit 0; 157.003 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-s0.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-4 1
```

```text
09:23:03 [bench-main-4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:25:36 [bench-main-4] rep 1: fps=46.4 p95=50 jank=5% busy=53.8% style=18.3% blocked=12.3s maxFreeze=789 keyP95=247 keyMax=251.2 wheelP95=100 LoAF[renderSL=22.4s forcedSL=2.2s script=2.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=442 butter={"smootherFrames":390,"published":390} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4062,"visibleScrollers":1,"off":""}
```

## bench-main-4-after

Started 2026-11-12T09:25:36.902567+00:00; finished 2026-11-12T09:25:38.670222+00:00; exit 0; 1.768 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-4-after
```

```text
convcheck bench-main-4-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-pr-4

Started 2026-11-12T09:25:38.671799+00:00; finished 2026-11-12T09:25:40.743546+00:00; exit 0; 2.072 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3884351)
```

## bench-pr-4-before

Started 2026-11-12T09:25:42.743818+00:00; finished 2026-11-12T09:25:44.110129+00:00; exit 0; 1.366 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-4-before
```

```text
convcheck bench-pr-4-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-pr-4

Started 2026-11-12T09:25:44.110256+00:00; finished 2026-11-12T09:28:20.965641+00:00; exit 0; 156.855 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-4 1
```

```text
09:25:47 [bench-pr-4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:28:20 [bench-pr-4] rep 1: fps=46.1 p95=50.1 jank=5.1% busy=54.3% style=18.6% blocked=12.7s maxFreeze=769 keyP95=238.5 keyMax=244.8 wheelP95=99 LoAF[renderSL=22.9s forcedSL=2.4s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1184 seenMarks=440 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-pr-4-after

Started 2026-11-12T09:28:20.965785+00:00; finished 2026-11-12T09:28:25.947812+00:00; exit 0; 4.982 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-4-after
```

```text
convcheck bench-pr-4-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-main-5

Started 2026-11-12T09:28:25.949824+00:00; finished 2026-11-12T09:28:28.022485+00:00; exit 0; 2.073 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-s0/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-s0/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3888585)
```

## bench-main-5-before

Started 2026-11-12T09:28:30.022746+00:00; finished 2026-11-12T09:28:31.589404+00:00; exit 0; 1.567 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-5-before
```

```text
convcheck bench-main-5-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-main-5

Started 2026-11-12T09:28:31.589530+00:00; finished 2026-11-12T09:31:06.496140+00:00; exit 0; 154.907 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-s0.

```sh
LAB_ID=1 CHAT=<math12-from-lab-config> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-main-5 1
```

```text
09:28:35 [bench-main-5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:31:06 [bench-main-5] rep 1: fps=47 p95=50 jank=4.9% busy=54% style=17.5% blocked=11.2s maxFreeze=754 keyP95=270.1 keyMax=288.9 wheelP95=96 LoAF[renderSL=21.7s forcedSL=2.2s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1169 seenMarks=440 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

## bench-main-5-after

Started 2026-11-12T09:31:06.496293+00:00; finished 2026-11-12T09:31:08.414406+00:00; exit 0; 1.918 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-main-5-after
```

```text
convcheck bench-main-5-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restart-pr-5

Started 2026-11-12T09:31:08.416193+00:00; finished 2026-11-12T09:31:10.487866+00:00; exit 0; 2.072 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3892243)
```

## bench-pr-5-before

Started 2026-11-12T09:31:12.488190+00:00; finished 2026-11-12T09:31:13.854501+00:00; exit 0; 1.366 s.

Working directory: None.

```sh
node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-5-before
```

```text
convcheck bench-pr-5-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-pr-5-after

Started 2026-11-12T09:34:13.172860+00:00; finished 2026-11-12T09:34:14.939466+00:00; exit 0; 1.767 s.

Working directory: None.

```sh
env LAB_ID=1 node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-5-after
```

```text
convcheck bench-pr-5-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## interruption-restore

Started 2026-11-12T09:34:14.939626+00:00; finished 2026-11-12T09:34:25.222565+00:00; exit 0; 10.283 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-c-live
```

```text
restore lab 1: restarting browser (now {"pid":3892243,"extensions":["/home/simon/snap/chromium/common/rail-split-c-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3900193)
restored {"lab":1,"restarted":true,"url":"<private-chat-url>","composer":"","pages":["<private-chat-url>"],"browser":{"pid":3900193,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T09:34:24.671Z","ok":true}
```

## interruption-release

Started 2026-11-12T09:34:25.222704+00:00; finished 2026-11-12T09:34:25.286689+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-c-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```

## resume-acquire

Started 2026-11-12T09:34:44.970913+00:00; finished 2026-11-12T09:34:45.034933+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-c-live --wait 1800 --perf --needs-fixture math12
```

```text
1
```

## resume-restart

Started 2026-11-12T09:34:45.035213+00:00; finished 2026-11-12T09:34:47.105541+00:00; exit 0; 2.07 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3901218)
```

## bench-pr-5-resume-before

Started 2026-11-12T09:34:49.105778+00:00; finished 2026-11-12T09:34:50.472124+00:00; exit 0; 1.366 s.

Working directory: None.

```sh
env LAB_ID=1 node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-5-resume-before
```

```text
convcheck bench-pr-5-resume-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-pr-5-resume

Started 2026-11-12T09:34:50.472290+00:00; finished 2026-11-12T09:37:27.682141+00:00; exit 0; 157.21 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
env LAB_ID=1 CHAT=<private-chat-url> REC=/tmp/rail-split-c-live-work/raw/recording.json node lab/harness/bench-live.mjs bench-pr-5-resume 1
```

```text
09:34:54 [bench-pr-5-resume] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
09:37:27 [bench-pr-5-resume] rep 1: fps=46.9 p95=50 jank=4.8% busy=53.4% style=17.8% blocked=11.3s maxFreeze=794 keyP95=242 keyMax=257.5 wheelP95=101 LoAF[renderSL=21.9s forcedSL=2.1s script=2.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=441 butter={"smootherFrames":390,"published":389} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4061,"visibleScrollers":1,"off":""}
```

## bench-pr-5-resume-after

Started 2026-11-12T09:37:27.682295+00:00; finished 2026-11-12T09:37:29.400167+00:00; exit 0; 1.718 s.

Working directory: None.

```sh
env LAB_ID=1 node /tmp/rail-split-c-live-work/convcheck.mjs bench-pr-5-resume-after
```

```text
convcheck bench-pr-5-resume-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## bench-restore

Started 2026-11-12T09:37:29.402433+00:00; finished 2026-11-12T09:37:39.690771+00:00; exit 0; 10.288 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-c-live
```

```text
restore lab 1: restarting browser (now {"pid":3901218,"extensions":["/home/simon/snap/chromium/common/rail-split-c-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3904863)
restored {"lab":1,"restarted":true,"url":"<private-chat-url>","composer":"","pages":["<private-chat-url>"],"browser":{"pid":3904863,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T09:37:39.182Z","ok":true}
```

## bench-release

Started 2026-11-12T09:37:39.690903+00:00; finished 2026-11-12T09:37:39.754860+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-c-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```

## matrix-main

Started 2026-11-12T09:37:39.784497+00:00; finished 2026-11-12T09:42:26.265840+00:00; exit 0; 286.481 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-main.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-c-main/extension OUT=/tmp/rail-split-c-live-work/matrix-main TESTED_HEAD=1bde0d28af4994b011bb96b3095d773f3d1db4f4 LAB_FIXTURE=math12 MODE=matrix VERBOSE=1 RUN_NAME=matrix-main node --no-warnings --experimental-loader /tmp/rail-split-c-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck matrix-main-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (40 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (31 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.7,16.7]}
pass drag-bookmarked: 4/4 checks passed (28 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.landOff":26,"rail.targetTop":7,"rail.jump":6,"rail.jumpTo":1,"bookmark.locate":26},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":45,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (11 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.landOff":19,"rail.targetTop":5,"rail.jump":1,"rail.jumpTo":1,"rail.earlierJump":1,"bookmark.locate":19},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (26 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.landOff":19,"rail.targetTop":5,"rail.jump":1,"rail.jumpTo":1,"rail.earlierJump":1,"bookmark.locate":19},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (27 s)
ok   reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
pass resolve: 1/1 checks passed (3 s)
ok   card delete removes selection bookmark {"remaining":1}
ok   earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
ok   card delete removes both test bookmarks {"remaining":0,"marks":0}
pass delete: 4/4 checks passed (11 s)
ok   real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}
ok   list item: the Bookmark cell is named Bookmark selection
ok   list item button saves its individual paragraph with ask and line {"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}
ok   list item jump lands on the item instead of the list start {"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}
ok   list item resolves live and lands on the same item after reload {"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}
ok   card delete removes list item test bookmark {"remaining":0,"marks":0}
pass list-item: 6/6 checks passed (82 s)

convcheck matrix-main-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
chromium: started (pid 3912098)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-c-live-work/matrix-main
35 checks passed
```

## wash-main

Started 2026-11-12T09:42:26.266109+00:00; finished 2026-11-12T09:44:33.304198+00:00; exit 0; 127.038 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-main.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-c-main/extension OUT=/tmp/rail-split-c-live-work/wash-main TESTED_HEAD=1bde0d28af4994b011bb96b3095d773f3d1db4f4 LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 RUN_NAME=wash-main node --no-warnings --experimental-loader /tmp/rail-split-c-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck wash-main-before {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (30 s)
ok   wash: a mounted answer holds two long paragraphs and a table {"paragraph":1,"selectionParagraph":75,"selectionCharacters":110,"table":188,"tableNested":true}
pass wash-pick: 1/1 checks passed (2 s)
ok   wash: the Bookmark cell bookmarks the paragraph {"stored":1}
ok   wash: the Bookmark cell bookmarks the selection {"stored":2}
ok   wash: the Bookmark cell bookmarks the table {"stored":3}
pass wash-bookmark: 3/3 checks passed (11 s)
ok   wash light: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a paragraph: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a paragraph: gone after the hold and fade
pass wash-light-paragraph: 6/6 checks passed (7 s)
ok   wash light: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a selection: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a selection: gone after the hold and fade
pass wash-light-selection: 6/6 checks passed (7 s)
ok   wash light: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a table: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash light: a table: gone after the hold and fade
pass wash-light-table: 5/5 checks passed (7 s)
ok   wash dark: ChatGPT shows its dark theme {"background":[0,0,0],"colorScheme":"dark","darkClass":false}
ok   wash dark: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-dark: 2/2 checks passed (21 s)
ok   wash dark: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a paragraph: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a paragraph: gone after the hold and fade
pass wash-dark-paragraph: 6/6 checks passed (8 s)
ok   wash dark: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a selection: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a selection: gone after the hold and fade
pass wash-dark-selection: 6/6 checks passed (7 s)
ok   wash dark: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a table: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash dark: a table: gone after the hold and fade
pass wash-dark-table: 5/5 checks passed (7 s)

convcheck wash-main-after {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
chromium: stopped
chromium: started (pid 3916413)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-c-live-work/wash-main
42 checks passed
```

## matrix-pr

Started 2026-11-12T09:44:33.304404+00:00; finished 2026-11-12T09:49:20.971539+00:00; exit 0; 287.667 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-c-pr/extension OUT=/tmp/rail-split-c-live-work/matrix-pr TESTED_HEAD=5c6a6272a22175033092afa32cba000005c196cb LAB_FIXTURE=math12 MODE=matrix VERBOSE=1 RUN_NAME=matrix-pr node --no-warnings --experimental-loader /tmp/rail-split-c-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck matrix-pr-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (40 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":91,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (31 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.8,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.7,16.7]}
pass drag-bookmarked: 4/4 checks passed (28 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.landOff":25,"rail.targetTop":7,"rail.jump":6,"rail.jumpTo":1,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":45,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (11 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.landOff":20,"rail.targetTop":5,"rail.jump":1,"rail.jumpTo":1,"rail.earlierJump":1,"bookmark.locate":20},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (26 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.landOff":17,"rail.targetTop":5,"rail.jump":1,"rail.jumpTo":1,"rail.earlierJump":1,"bookmark.locate":17},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (26 s)
ok   reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
pass resolve: 1/1 checks passed (3 s)
ok   card delete removes selection bookmark {"remaining":1}
ok   earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
ok   card delete removes both test bookmarks {"remaining":0,"marks":0}
pass delete: 4/4 checks passed (11 s)
ok   real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}
ok   list item: the Bookmark cell is named Bookmark selection
ok   list item button saves its individual paragraph with ask and line {"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}
ok   list item jump lands on the item instead of the list start {"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}
ok   list item resolves live and lands on the same item after reload {"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}
ok   card delete removes list item test bookmark {"remaining":0,"marks":0}
pass list-item: 6/6 checks passed (84 s)

convcheck matrix-pr-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
chromium: started (pid 3925555)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-c-live-work/matrix-pr
35 checks passed
```

## wash-pr

Started 2026-11-12T09:49:20.971731+00:00; finished 2026-11-12T09:50:38.061343+00:00; exit 1; 77.09 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-c-pr/extension OUT=/tmp/rail-split-c-live-work/wash-pr TESTED_HEAD=5c6a6272a22175033092afa32cba000005c196cb LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 RUN_NAME=wash-pr node --no-warnings --experimental-loader /tmp/rail-split-c-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck wash-pr-before {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (30 s)
ok   wash: a mounted answer holds two long paragraphs and a table {"paragraph":1,"selectionParagraph":75,"selectionCharacters":110,"table":188,"tableNested":true}
pass wash-pick: 1/1 checks passed (2 s)
FAIL wash-bookmark threw: phase=wash-bookmark error=Error
FAIL wash-bookmark: 0/1 checks passed, then threw (2 s)
skip wash-light-paragraph: needs 3 stored test bookmarks, has 0
skip wash-light-selection: needs 3 stored test bookmarks, has 0
skip wash-light-table: needs 3 stored test bookmarks, has 0
ok   wash dark: ChatGPT shows its dark theme {"background":[0,0,0],"colorScheme":"dark","darkClass":false}
ok   wash dark: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-dark: 2/2 checks passed (22 s)
skip wash-dark-paragraph: needs 3 stored test bookmarks, has 0
skip wash-dark-selection: needs 3 stored test bookmarks, has 0
skip wash-dark-table: needs 3 stored test bookmarks, has 0

convcheck wash-pr-after {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
chromium: stopped
chromium: started (pid 3928693)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-c-live-work/wash-pr
FAIL: 1 of 6 checks failed; threw: wash-bookmark; skipped: wash-light-paragraph, wash-light-selection, wash-light-table, wash-dark-paragraph, wash-dark-selection, wash-dark-table
FAIL: a full run skipped wash-light-paragraph, wash-light-selection, wash-light-table, wash-dark-paragraph, wash-dark-selection, wash-dark-table
```

## live-acquire

Started 2026-11-12T09:50:38.061503+00:00; finished 2026-11-12T09:50:38.125257+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-c-live --wait 1800 --needs-fixture math12
```

```text
1
```

## live-restart-main

Started 2026-11-12T09:50:38.125449+00:00; finished 2026-11-12T09:50:40.194356+00:00; exit 0; 2.069 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-main/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-main/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3929252)
```

## branch-main-before

Started 2026-11-12T09:50:42.194609+00:00; finished 2026-11-12T09:50:43.711135+00:00; exit 0; 1.517 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-main/extension node /tmp/rail-split-c-live-work/convcheck.mjs branch-main-before
```

```text
convcheck branch-main-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## branch-live-main

Started 2026-11-12T09:50:43.711283+00:00; finished 2026-11-12T09:51:24.861851+00:00; exit 0; 41.151 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-main.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-main/extension 'BRANCH_PATH=^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-c-live-work/branch-main node lab/harness/branch-live-task.mjs
```

Actual result projected to public measured fields; any public harness error is retained below (full private stdout omitted):

```text
{
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "runs": [
    {
      "width": 1280,
      "button": {
        "gap": 4,
        "topDelta": 0,
        "native": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px",
        "butter": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px"
      },
      "end": "ready",
      "originalUnchanged": true,
      "originalCompare": {
        "sameUrl": true,
        "draftLength": [
          0,
          0
        ],
        "scroll": [
          498,
          498
        ]
      },
      "sendClicks": [
        {
          "inBranch": true,
          "ms": 7977
        }
      ],
      "originalSendRequests": [],
      "afterSendClick": [
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/sentinel/chat-requirements/prepare",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 8310
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/telemetry/intake",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9938
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/codex/notification/subscriptions",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9987
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11657
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11658
        }
      ],
      "distinctBranch": true,
      "branchIdentityKind": "local",
      "latestReplyMatchesOriginal": true
    },
    {
      "width": 800,
      "button": {
        "gap": 4,
        "topDelta": 0,
        "native": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px",
        "butter": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px"
      },
      "end": "ready",
      "originalUnchanged": true,
      "originalCompare": {
        "sameUrl": true,
        "draftLength": [
          0,
          0
        ],
        "scroll": [
          511,
          511
        ]
      },
      "sendClicks": [
        {
          "inBranch": true,
          "ms": 8178
        }
      ],
      "originalSendRequests": [],
      "afterSendClick": [
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/sentinel/chat-requirements/prepare",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 8501
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/telemetry/intake",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 10150
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/codex/notification/subscriptions",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 10153
        }
      ],
      "distinctBranch": true,
      "branchIdentityKind": "local",
      "latestReplyMatchesOriginal": true
    }
  ],
  "exit": 0,
  "selectionPillTimeout": false
}
```

## branch-main-after

Started 2026-11-12T09:51:24.862010+00:00; finished 2026-11-12T09:51:26.280315+00:00; exit 0; 1.418 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-main/extension node /tmp/rail-split-c-live-work/convcheck.mjs branch-main-after
```

```text
convcheck branch-main-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## live-restart-pr

Started 2026-11-12T09:51:26.280464+00:00; finished 2026-11-12T09:51:28.352469+00:00; exit 0; 2.072 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-c-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3930567)
```

## branch-pr-before

Started 2026-11-12T09:51:30.352702+00:00; finished 2026-11-12T09:51:31.768932+00:00; exit 0; 1.416 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension node /tmp/rail-split-c-live-work/convcheck.mjs branch-pr-before
```

```text
convcheck branch-pr-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## branch-live-pr

Started 2026-11-12T09:51:31.769077+00:00; finished 2026-11-12T09:52:13.131584+00:00; exit 0; 41.363 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension 'BRANCH_PATH=^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-c-live-work/branch-pr node lab/harness/branch-live-task.mjs
```

Actual result projected to public measured fields; any public harness error is retained below (full private stdout omitted):

```text
{
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "runs": [
    {
      "width": 1280,
      "button": {
        "gap": 4,
        "topDelta": 0,
        "native": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px",
        "butter": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px"
      },
      "end": "ready",
      "originalUnchanged": true,
      "originalCompare": {
        "sameUrl": true,
        "draftLength": [
          0,
          0
        ],
        "scroll": [
          498,
          498
        ]
      },
      "sendClicks": [
        {
          "inBranch": true,
          "ms": 7596
        }
      ],
      "originalSendRequests": [],
      "afterSendClick": [
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/sentinel/chat-requirements/prepare",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 7915
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/telemetry/intake",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9450
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/codex/notification/subscriptions",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9452
        }
      ],
      "distinctBranch": true,
      "branchIdentityKind": "local",
      "latestReplyMatchesOriginal": true
    },
    {
      "width": 800,
      "button": {
        "gap": 4,
        "topDelta": 0,
        "native": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px",
        "butter": "30px | 8px | rgb(48, 48, 48) | rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px"
      },
      "end": "ready",
      "originalUnchanged": true,
      "originalCompare": {
        "sameUrl": true,
        "draftLength": [
          0,
          0
        ],
        "scroll": [
          511,
          511
        ]
      },
      "sendClicks": [
        {
          "inBranch": true,
          "ms": 9054
        }
      ],
      "originalSendRequests": [],
      "afterSendClick": [
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/sentinel/chat-requirements/prepare",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9412
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/telemetry/intake",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9433
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/codex/notification/subscriptions",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9453
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11339
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11340
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11375
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11925
        }
      ],
      "distinctBranch": true,
      "branchIdentityKind": "local",
      "latestReplyMatchesOriginal": true
    }
  ],
  "exit": 0,
  "selectionPillTimeout": false
}
```

## branch-pr-after

Started 2026-11-12T09:52:13.131776+00:00; finished 2026-11-12T09:52:14.549922+00:00; exit 0; 1.418 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-c-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension node /tmp/rail-split-c-live-work/convcheck.mjs branch-pr-after
```

```text
convcheck branch-pr-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## live-restore

Started 2026-11-12T09:52:14.550063+00:00; finished 2026-11-12T09:52:24.287139+00:00; exit 0; 9.737 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-c-live
```

```text
restore lab 1: restarting browser (now {"pid":3930567,"extensions":["/home/simon/snap/chromium/common/rail-split-c-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-c-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3931978)
restored {"lab":1,"restarted":true,"url":"<private-chat-url>","composer":"","pages":["<private-chat-url>"],"browser":{"pid":3931978,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T09:52:24.183Z","ok":true}
```

## live-release

Started 2026-11-12T09:52:24.287269+00:00; finished 2026-11-12T09:52:24.401229+00:00; exit 0; 0.114 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-c-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": false}
```

## final-lock-status

Started 2026-11-12T09:52:24.401368+00:00; finished 2026-11-12T09:52:24.465255+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock status
```

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## wash-repeat-main

Started 2026-11-12T09:52:39.403189+00:00; finished 2026-11-12T09:54:49.792491+00:00; exit 0; 130.389 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-main.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-c-main/extension OUT=/tmp/rail-split-c-live-work/wash-repeat-main TESTED_HEAD=1bde0d28af4994b011bb96b3095d773f3d1db4f4 LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 RUN_NAME=wash-repeat-main node --no-warnings --experimental-loader /tmp/rail-split-c-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck wash-repeat-main-before {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (31 s)
ok   wash: a mounted answer holds two long paragraphs and a table {"paragraph":1,"selectionParagraph":75,"selectionCharacters":110,"table":188,"tableNested":true}
pass wash-pick: 1/1 checks passed (2 s)
ok   wash: the Bookmark cell bookmarks the paragraph {"stored":1}
ok   wash: the Bookmark cell bookmarks the selection {"stored":2}
ok   wash: the Bookmark cell bookmarks the table {"stored":3}
pass wash-bookmark: 3/3 checks passed (11 s)
ok   wash light: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a paragraph: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a paragraph: gone after the hold and fade
pass wash-light-paragraph: 6/6 checks passed (7 s)
ok   wash light: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a selection: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a selection: gone after the hold and fade
pass wash-light-selection: 6/6 checks passed (7 s)
ok   wash light: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a table: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash light: a table: gone after the hold and fade
pass wash-light-table: 5/5 checks passed (7 s)
ok   wash dark: ChatGPT shows its dark theme {"background":[0,0,0],"colorScheme":"dark","darkClass":false}
ok   wash dark: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-dark: 2/2 checks passed (22 s)
ok   wash dark: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a paragraph: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a paragraph: gone after the hold and fade
pass wash-dark-paragraph: 6/6 checks passed (8 s)
ok   wash dark: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a selection: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a selection: gone after the hold and fade
pass wash-dark-selection: 6/6 checks passed (7 s)
ok   wash dark: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a table: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash dark: a table: gone after the hold and fade
pass wash-dark-table: 5/5 checks passed (7 s)

convcheck wash-repeat-main-after {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
chromium: stopped
chromium: started (pid 3936327)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-c-live-work/wash-repeat-main
42 checks passed
```

## wash-repeat-pr

Started 2026-11-12T09:54:49.792744+00:00; finished 2026-11-12T09:56:57.285531+00:00; exit 0; 127.493 s.

Working directory: /home/simon/snap/chromium/common/rail-split-c-pr.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-c-pr/extension OUT=/tmp/rail-split-c-live-work/wash-repeat-pr TESTED_HEAD=5c6a6272a22175033092afa32cba000005c196cb LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 RUN_NAME=wash-repeat-pr node --no-warnings --experimental-loader /tmp/rail-split-c-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck wash-repeat-pr-before {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (30 s)
ok   wash: a mounted answer holds two long paragraphs and a table {"paragraph":1,"selectionParagraph":75,"selectionCharacters":110,"table":188,"tableNested":true}
pass wash-pick: 1/1 checks passed (2 s)
ok   wash: the Bookmark cell bookmarks the paragraph {"stored":1}
ok   wash: the Bookmark cell bookmarks the selection {"stored":2}
ok   wash: the Bookmark cell bookmarks the table {"stored":3}
pass wash-bookmark: 3/3 checks passed (11 s)
ok   wash light: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a paragraph: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a paragraph: gone after the hold and fade
pass wash-light-paragraph: 6/6 checks passed (7 s)
ok   wash light: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a selection: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash light: a selection: gone after the hold and fade
pass wash-light-selection: 6/6 checks passed (7 s)
ok   wash light: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash {"blend":"multiply","pointer":"none","flash":false}
ok   wash light: a table: the text keeps its colour under the wash {"inkDuring":[13,12,9],"inkAfter":[13,13,13]}
ok   wash light: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash light: a table: gone after the hold and fade
pass wash-light-table: 5/5 checks passed (7 s)
ok   wash dark: ChatGPT shows its dark theme {"background":[0,0,0],"colorScheme":"dark","darkClass":false}
ok   wash dark: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-dark: 2/2 checks passed (21 s)
ok   wash dark: a paragraph is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a paragraph: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text {"scrolled":74,"boxes":2,"expected":2}
ok   wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a paragraph: gone after the hold and fade
pass wash-dark-paragraph: 6/6 checks passed (8 s)
ok   wash dark: a selection is washed on its own lines {"boxes":2,"expected":2,"maxOffPx":0}
ok   wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a selection: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text {"scrolled":-680,"boxes":2,"expected":2}
ok   wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it {"differ":0,"reach":true,"under":true,"clipTop":52,"clipBottom":836,"headerBottom":null,"composerTop":836,"scrollerTop":52}
ok   wash dark: a selection: gone after the hold and fade
pass wash-dark-selection: 6/6 checks passed (7 s)
ok   wash dark: a table is washed on its own lines (one box 3 px around the table) {"boxes":1,"expected":1,"maxOffPx":0}
ok   wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash {"blend":"lighten","pointer":"none","flash":false}
ok   wash dark: a table: the text keeps its colour under the wash {"inkDuring":[237,237,237],"inkAfter":[237,237,237]}
ok   wash dark: a table: scrolled 80 px during the hold, the boxes follow the text {"scrolled":80,"boxes":1,"expected":1}
ok   wash dark: a table: gone after the hold and fade
pass wash-dark-table: 5/5 checks passed (7 s)

convcheck wash-repeat-pr-after {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
chromium: stopped
chromium: started (pid 3939732)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-c-live-work/wash-repeat-pr
42 checks passed
```

## repeat-final-lock-status

Started 2026-11-12T09:56:57.285695+00:00; finished 2026-11-12T09:56:57.349617+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock status
```

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Internal lab acquisitions

The bookmarks adapter invokes the same lab-lock CLI as the library. Each uses `lab-lock acquire --lab auto --owner rail-split-c-live --wait 1800 --perf --needs-fixture <fixture>`, followed by restore before release. Actual adapter lock records:

```json
{"at":"2026-11-12T09:37:39.897Z","action":"wait","fixture":"math12"}
{"at":"2026-11-12T09:37:39.952Z","action":"acquire","lab":1}
{"at":"2026-11-12T09:42:26.228Z","action":"release","lab":1,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T09:42:26.379Z","action":"wait","fixture":"demo-en12"}
{"at":"2026-11-12T09:42:26.433Z","action":"acquire","lab":2}
{"at":"2026-11-12T09:44:33.264Z","action":"release","lab":2,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T09:44:33.428Z","action":"wait","fixture":"math12"}
{"at":"2026-11-12T09:44:33.478Z","action":"acquire","lab":1}
{"at":"2026-11-12T09:49:20.926Z","action":"release","lab":1,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T09:49:21.093Z","action":"wait","fixture":"demo-en12"}
{"at":"2026-11-12T09:49:21.152Z","action":"acquire","lab":2}
{"at":"2026-11-12T09:50:38.028Z","action":"release","lab":2,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T09:52:39.518Z","action":"wait","fixture":"demo-en12"}
{"at":"2026-11-12T09:52:39.569Z","action":"acquire","lab":2}
{"at":"2026-11-12T09:54:49.739Z","action":"release","lab":2,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T09:54:49.905Z","action":"wait","fixture":"demo-en12"}
{"at":"2026-11-12T09:54:49.956Z","action":"acquire","lab":2}
{"at":"2026-11-12T09:56:57.255Z","action":"release","lab":2,"lab_released":true,"perf_released":true}
```

## Pinned extension verification

```sh
python3 /tmp/rail-split-c-live-work/verify-builds.py
```

```json
{
  "main": {
    "pinnedHead": "1bde0d28af4994b011bb96b3095d773f3d1db4f4",
    "extensionFiles": 66,
    "mismatches": 0,
    "trackedChanges": []
  },
  "pr": {
    "pinnedHead": "5c6a6272a22175033092afa32cba000005c196cb",
    "extensionFiles": 68,
    "mismatches": 0,
    "trackedChanges": []
  },
  "s0": {
    "pinnedHead": "4e6c25928ee3eb1b31a91533ce6490ce7ea0358e",
    "extensionFiles": 62,
    "mismatches": 0,
    "trackedChanges": []
  }
}
```

## External adapter fingerprints

The loader/adapter and runner are private task files, not tracked source edits. SHA-256 fingerprints:

```json
{
  "convcheck-lib.mjs": "0c8689931702be90ecfa5962550880d8bb3371a06df835863351f0a042e216ee",
  "convcheck.mjs": "8a4c9a576b824d0ff3cd69f0d8f5da4438dc1abaeb1cf0b6fe34135956eed596",
  "lab-wrapper.mjs": "f3a8c067741f99537900d21ac34a0c539a3fb696703daae726cb82559782377c",
  "loader.mjs": "432e072fcaa0dd77f76d921f6bdb8657f6dcf0b9a19330a2505daa29c10250b3"
}
```

## Report validation

```sh
python3 /tmp/rail-split-c-live-work/verify-report.py
```

Exit 0. Actual output:

```text
PASS: 10 strictly interleaved replays, expected answer SHA-256, 189 chunks each, zero completed writes.
NO_WORSE: {"loafBlockMs": true, "loafMaxMs": true, "p95": true, "keyMax": true, "keyP95": true, "idle.keyMax": true, "idle.keyP95": true}
PASS: matrix 35/35 per build; ordered checks and cleanup identical.
PASS: wash-repeat 42/42 per build; ordered checks and cleanup identical.
RETAINED: initial C wash failed at unmounted paragraph, 5 successful checks, one thrown failure, six skipped scenarios.
BRANCH: {"main": [{"stage": "branch-live-main", "exit": 0, "selectionPillTimeout": false, "completedWidths": [1280, 800]}], "pr": [{"stage": "branch-live-pr", "exit": 0, "selectionPillTimeout": false, "completedWidths": [1280, 800]}]}
PASS: all 19 before/after server user-turn fingerprints unchanged (38 HTTP 200 checks).
PASS: JSON parses; privacy scan zero matches (120 private tokens/titles/content fingerprints and four identifier/endpoint patterns); Markdown, numeric JSON and SVG only.
PASS: all measured extension trees match Git bytes and have zero tracked changes.
```

```sh
git diff --cached --check
```

Exit 0. Actual output:

```text
(no output)
```

```sh
python3 scripts/review-tier.py HEAD
```

Exit 0. Actual output:

```text
Review tier: 0
notes/runs/2026-11-12-rail-split-c-live/commands.md (Markdown)
notes/runs/2026-11-12-rail-split-c-live/comparison.svg (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/branch-attempts.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/branch-live-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/branch-live-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/build-check.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/fixture-adapter-sha256.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/matrix-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/matrix-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/replay.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/server-checks.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/wash-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/wash-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/wash-repeat-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/data/wash-repeat-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-c-live/report.md (Markdown)
```
