# Commands and actual output

Outputs below omit private fixture URLs and raw page text. Long per-jump output is saved as
one log per completed run beside this file. Exit 1 is the expected red result; exit 2 means a
harness/setup error and is not counted as a reproduced extension bug.

## Setup

```text
$ npm ci
added 90 packages, and audited 91 packages in 650ms
25 packages are looking for funding
found 0 vulnerabilities
```

The installation also printed the package's ESLint deprecation warning.

```text
$ git rev-parse HEAD origin/main
d0d6b1b38a09a1c679cd159b8f8b5257e9be6bd8
907297d4f38c71413b5f49dbd432ed3ed470ec02

$ python3 scripts/package.py --dev
/home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/dist/butter-0.1.0-alpha.21+dev.1.zip
Note: Chrome version remains 0.1.0.21; remove the previous install before loading this test build.

$ git worktree add --detach /tmp/butter-main-907297d 907297d
Preparing worktree (detached HEAD 907297d)
HEAD is now at 907297d Merge pull request #117 from SimianW/fix/rail-tick-thin

$ python3 /tmp/butter-main-907297d/scripts/package.py --dev
/tmp/butter-main-907297d/dist/butter-0.1.0-alpha.21+dev.1.zip
Note: Chrome version remains 0.1.0.21; remove the previous install before loading this test build.

$ ~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 2 --owner rail-jump-live-20261116 --wait 60 --perf
2
```

Python's `zipfile.ZipFile.extractall` extracted each package into its own task-owned Snap-readable
scratch directory. Comparing the head package with the checkout printed:

```text
head packaged sources identical: 70/70; manifest and dev popup transformed by package.py
```

The lab browser was restarted only while holding its lock:

```text
$ LAB_ID=2 LAB_EXTENSIONS=<head scratch>/butter ~/.local/share/chatgpt-lab/bin/lab restart-browser
chromium: stopped
chromium: started (pid 4130245)
```

## Reads before testing

```sh
cat ~/.agents/machine.md
cat lab/README.md
cat ~/.local/share/chatgpt-lab/README.md
cat ~/.agents/skills/diagnosing-bugs/SKILL.md
cat docs/development.md notes/diagnostics/README.md
cat docs/agents/seams.md GLOSSARY.md notes/runs/README.md
git show docs/recordings:docs/agents/recordings.md
git show docs/recordings:docs/bugfix.md
gh pr view 118
gh issue view 113 --comments
gh issue view 96
```

All succeeded. PR #118 explicitly said no real browser/live fixture was tested. Issue #113 remained
open; issue #96 described broken old live harnesses, which this task did not edit. The local lab's
config was read for fixture names and connection settings only; its URLs are not reproduced here.
Source reads were limited to current rail, trace, settings and harness wiring needed to build the
observer and native control. No extension source was edited.

Preview automation was attempted first. It reported `available: false`; opening the lab preview
failed with `net::ERR_CONNECTION_REFUSED`. The documented lab CDP connection was used instead.
An initial blank-page preview attempt also returned `unsupported-protocol: about:`.

## Pilots excluded from final comparison

- An inspection helper initially failed with `ReferenceError: i is not defined` before any jump.
- The first harness setup waited for a sleeping service worker and exited 2 with
  `browserContext.waitForEvent: Timeout 30000ms exceeded while waiting for event "serviceworker"`.
  The harness now reads the scratch extension through its own popup context.
- The first native pilot wrote a stale position saved before earlier questions were prepended.
  It printed one failed and one clean jump, exit 1. This was an invalid native control, not evidence
  of ChatGPT's bug. Binary-search calibration against mounted native turns replaced that guess.
- The corrected two-jump native pilot printed:

```text
native-pilot-2 math9 from=top to=4 phase=reload-setup class=clean samples=120
native-pilot-2 math9 from=bottom to=0 phase=settled class=clean samples=123
SUMMARY {"math9":{"clean":2,"detour":0,"failed":0}}
EXIT 0
```

- The 50-jump `head-1` exploration used a 12 px landing tolerance, then its saved samples were
  reclassified using the final 32 px tolerance. Original verdicts remain as `initialClass` and
  `initialCounts`. Two harmless first-question shifts of 20 px ceased counting as failures.
  Corrected counts: math9 3 clean / 19 detour / 0 failed; math12 5 / 21 / 2; exit 1.
- `head-2` added explicit reload jumps; later observations tightened starting-edge checks and
  recorded current turn ordinals during pagination. Its results are exploratory, not one of the
  final three repeatability runs.

## Verification performed during development

```text
$ node --check lab/harness/rail-jump-live.mjs
$ node --check lab/harness/rail-jump-live-page.mjs
$ npx eslint lab/harness/rail-jump-live.mjs lab/harness/rail-jump-live-page.mjs
(no output; exit 0)
```

`npx prettier --write` was also invoked for the two files; the repository's ignore rules leave
lab harness files unchanged. One exploratory conversion command named a nonexistent MP4 and
returned `No such file or directory`; successful conversions use the actual retained paths below.



## Completed full runs

The shared campaign held lab 2 and the perf lock as owner `rail-jump-live-20261116`.
Each command used `LAB_ID=2 LAB_OWNER=rail-jump-live-20261116`, except head-5, which omitted
`LAB_OWNER` and exercised its own acquire/restore/release. All use the default fixtures math9
and math12. `EXT` is the unpacked dev build, never a modified source directory.

```sh
EXT=/home/simon/snap/chromium/common/rail-jump-head/butter LABEL=head-3 RECORD=1 RECORD_PHASE=settled node lab/harness/rail-jump-live.mjs
EXT=/home/simon/snap/chromium/common/rail-jump-head/butter LABEL=head-4 RECORD=1 RECORD_PHASE=settled node lab/harness/rail-jump-live.mjs
LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-head/butter LABEL=head-5 RECORD=1 RECORD_PHASE=settled node lab/harness/rail-jump-live.mjs
EXT=/home/simon/snap/chromium/common/rail-jump-head/butter LABEL=streaming-off SMOOTHER=off RECORD=0 node lab/harness/rail-jump-live.mjs
EXT=/home/simon/snap/chromium/common/rail-jump-main/butter LABEL=main RECORD=0 node lab/harness/rail-jump-live.mjs
EXT= LABEL=native RECORD=0 node lab/harness/rail-jump-live.mjs
```

Actual summaries (each run printed 54 individual jump lines first; the complete logs are retained):

```text
head-3
SUMMARY {"math9":{"clean":3,"detour":21,"failed":0},"math12":{"clean":6,"detour":21,"failed":3}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/head-3.json
process exit: 1
```

```text
head-4
SUMMARY {"math9":{"clean":3,"detour":20,"failed":1},"math12":{"clean":6,"detour":21,"failed":3}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/head-4.json
process exit: 1
```

```text
head-5
SUMMARY {"math9":{"clean":3,"detour":20,"failed":1},"math12":{"clean":6,"detour":21,"failed":3}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/head-5.json
process exit: 1
```

```text
streaming-off
SUMMARY {"math9":{"clean":3,"detour":21,"failed":0},"math12":{"clean":8,"detour":22,"failed":0}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/streaming-off.json
process exit: 1
```

```text
main
SUMMARY {"math9":{"clean":4,"detour":19,"failed":1},"math12":{"clean":8,"detour":13,"failed":9}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/main.json
process exit: 1
```

```text
native
SUMMARY {"math9":{"clean":24,"detour":0,"failed":0},"math12":{"clean":21,"detour":6,"failed":3}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/native.json
process exit: 1
```


Before the corrected native run, a full native attempt completed all 24 math9 jumps cleanly,
then exited 2 during math12 setup with `native calibration could not mount target`. Its old
binary-search bound did not expand when earlier history increased the page height. Calibration
now updates both the live order and search range; the complete native run above finished 54 jumps.
This setup exception is excluded from the final result counts.

Click-baseline reclassification of the saved streaming-off data printed:

```text
streaming-off click-baseline reclassification changed verdicts: 0
math9: clean 3, detour 21, failed 0
math12: clean 8, detour 22, failed 0
```

## Native readback replay

Under the same shared lock, with no extension:

```sh
LAB_ID=2 LAB_OWNER=rail-jump-live-20261116 EXT= FIXTURES=math12 LABEL=native-witness RECORD=1 ONLY='[{"from":"bottom","to":10},{"from":"previous","to":0},{"from":"previous","to":1}]' node lab/harness/rail-jump-live.mjs
```

Actual output:

```text
FIXTURE math12 {"questions":12,"hasPrev":null,"height":344869,"mathDisplay":231,"nativeQuestions":12,"measuredRows":0,"trace":false}
native-witness math12 from=bottom to=10 phase=reload-setup class=failed positions=[[1461,347022]] targetTop=-17529 reversals=0
native-witness math12 from=previous to=0 phase=settled class=clean samples=145
native-witness math12 from=previous to=1 phase=settled class=clean samples=140
SUMMARY {"math12":{"clean":2,"detour":0,"failed":1}}
EXIT 1; evidence /home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/notes/runs/2026-11-16-rail-jump-live/native-witness.json

```

The failed replay recorded write 328400, immediate readback 328400, final 347022,
targetTop -17529, target still mounted. The other two replay jumps were clean.

## Recordings and conversion

`RECORD=1` invokes ffmpeg exactly as the live harness source records it:

```text
ffmpeg -f x11grab -draw_mouse 0 -framerate 30 -video_size 1020x912 -i :98+580,88 ...
```

The retained settled witnesses are head-3 jump 4 (detour) and jump 32 (failed). Raw MP4s stay
under /tmp. Retained media masks the lower 212 source pixels for composer privacy, then uses
15 fps, scale width 800, a 96-colour palette and Bayer dithering. Actual conversion pattern:

```sh
ffmpeg -i <raw.mp4> -vf "drawbox=x=0:y=700:w=1020:h=212:color=black:t=fill,drawtext=text='Composer hidden for privacy':fontcolor=white:fontsize=20:x=24:y=785" -c:v libx264 -preset fast -crf 20 -pix_fmt yuv420p <sanitized.mp4>
ffmpeg -i <sanitized.mp4> -t 10 -filter_complex '[0:v]fps=15,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=96[p];[b][p]paletteuse=dither=bayer:bayer_scale=4' <output.gif>
```

The conversion commands exited 0. Each retained GIF was inspected as a frame storyboard after
masking. Actual ffprobe and file-size results:

```json
{
  "bug-detour.gif": {
    "width": 800,
    "height": 715,
    "duration": "5.400000",
    "nb_frames": "81",
    "bytes": 1501049
  },
  "bug-failed.gif": {
    "width": 800,
    "height": 715,
    "duration": "6.940000",
    "nb_frames": "104",
    "bytes": 1791060
  },
  "control-native.gif": {
    "width": 800,
    "height": 715,
    "duration": "4.470000",
    "nb_frames": "67",
    "bytes": 127531
  }
}
```

## Final checks and cleanup

```text
$ node --check lab/harness/rail-jump-live.mjs
$ node --check lab/harness/rail-jump-live-page.mjs
$ npx eslint lab/harness/rail-jump-live.mjs lab/harness/rail-jump-live-page.mjs
(no output; exit 0)

$ ~/.local/share/chatgpt-lab/bin/lab-restore --lab 2 --owner rail-jump-live-20261116
restored {"lab":2,"restarted":false,"url":"<private-url>","composer":"","pages":["<private-url>"],"browser":{"pid":63846,"extensions":[],"flags":[]},"at":"2026-11-16T17:25:16.733Z","ok":true}
exit 0

$ ~/.local/share/chatgpt-lab/bin/lab-lock release --lab 2 --owner rail-jump-live-20261116
{"lab": 2, "lab_released": true, "perf_released": true}
exit 0
```

Head-5 then acquired a fresh task lock and its own `finally` reported:

```json
{"restored":true,"released":{"lab":2,"lab_released":true,"perf_released":true}}
```

The final read-only verification recomputed all 324 classifications from the archived frames and
matched every saved verdict. It checked the real lab home tab, empty composer, default extensions
and flags, absence of any task lock, the GIF limits, no tracked changes, and scratch worktree
removal. Its initial strict integer timestamp check found one 1999 ms difference; the real-clock
termination check runs after geometry reads and requires at least 2000 ms. The final verification
allows one millisecond of sample/end rounding, records that fact and passes. Full output is in
`verification.log`; structured results are in `verification.json`.

```text
$ git worktree remove /tmp/butter-main-907297d
(no output; exit 0)
$ python3 <remove task-owned unpacked main copy>
main scratch worktree and unpacked control copy removed
head copy retained for the red command: True

$ git branch --show-current
fix/rail-jump-detours
$ git rev-parse HEAD
d0d6b1b38a09a1c679cd159b8f8b5257e9be6bd8
$ git diff --quiet
(no output; exit 0)
$ git status --short
?? lab/harness/rail-jump-live-page.mjs
?? lab/harness/rail-jump-live.mjs
?? notes/runs/2026-11-16-rail-jump-live/
```

Final lab status: lab 2 Chromium, Xvfb, VNC and noVNC running, default extension list empty,
no extra flags, one home tab, empty composer. Lab 2 and perf locks free. Lab 1 is running under
another task's lock and extension list; it was never acquired or changed by this task.
No task lock remains.

The sanitized numeric JSON archives were compressed after testing; original raw stdout filenames
above therefore now end in `.json.gz`. Compression printed:

```text
Archived 11 runs; 61909674 bytes -> 1236117 gzip bytes
```

The comparison preview reported width 728, contentHeight 329 and no console messages. Its first
path-based attempt rejected the fragment format; passing the same file contents as inline HTML
succeeded. No preview server was started.

Final retained-copy check: `Retained loaded head matches packaged dev build: 72 / 72 files`. Exit 0.

Narrow comparison preview: width 360, contentHeight 497, no console messages; labels and bars fit.

## Fix (2026-11-16, after the diagnosis)

The evidence JSONs this file names (`EXIT …; evidence …json`) were moved to
`~/.local/share/chatgpt-lab/captures/2026-11-16-rail-jump-live/` (local), with every other raw
capture; this folder keeps the `.log` files.

```text
$ python3 scripts/package.py --dev
/home/simon/.t3/worktrees/butter/t3-3b51885a-1b7fbd47051eba67/dist/butter-0.1.0-alpha.21+dev.2.zip
Note: Chrome version remains 0.1.0.21; remove the previous install before loading this test build.
$ unzip -q dist/butter-0.1.0-alpha.21+dev.2.zip -d ~/snap/chromium/common/rail-jump-fix
$ diff -rq ~/snap/chromium/common/rail-jump-head/butter ~/snap/chromium/common/rail-jump-fix/butter
Files …/rail-jump-head/butter/manifest.json and …/rail-jump-fix/butter/manifest.json differ
Files …/rail-jump-head/butter/rail/jump.js and …/rail-jump-fix/butter/rail/jump.js differ
Files …/rail-jump-head/butter/stream/containment.css and …/rail-jump-fix/butter/stream/containment.css differ
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-fix/butter LABEL=fix-1 OUT=<local>/fix-1.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":43,"rawReversalCount":86,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":44}
EXIT 0; evidence <local>/fix-1.json
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-fix/butter LABEL=fix-2 OUT=<local>/fix-2.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":43,"rawReversalCount":88,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":44}
EXIT 0; evidence <local>/fix-2.json
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-fix/butter LABEL=fix-3 OUT=<local>/fix-3.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":43,"rawReversalCount":86,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":44}
EXIT 0; evidence <local>/fix-3.json
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-head/butter LABEL=head-after-fix OUT=<local>/head-after-fix.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":3,"visibleDetour":9,"native":0,"gated":9,"postCompletion":6,"postCompletionEventMoves":3,"afterLanding":8,"rawReversal":45,"rawReversalCount":108,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":0}
EXIT 1; evidence <local>/head-after-fix.json
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-fix/butter LABEL=fix-recording ONLY='[{"from":"top","to":1},{"from":"top","to":5}]' RECORD=1 RECORD_ALL=1 OUT=<local>/fix-recording.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":4,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":4,"rawReversalCount":8,"unpinChecks":6,"anchoringLeftOff":0,"pinnedAnchoringOff":4}
EXIT 0; evidence <local>/fix-recording.json
$ python3 lab/harness/rail-jump-gif.py <local>/fix-recording.json /tmp/rail-gif/after.gif
(after.gif: 800x715, 1716033 bytes, 9410 ms, 113 frames, 12 fps; storyboards watched, then deleted)
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-fix/butter LABEL=lead-verify-fix OUT=<local>/lead-verify-fix.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":43,"rawReversalCount":88,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":44}
EXIT 0; evidence <local>/lead-verify-fix.json
$ python3 scripts/package.py --dev     # the working tree that became c0178b7; unpacked at ~/snap/chromium/common/rail-jump-fix2/butter
dist/butter-0.1.0-alpha.21+dev.3.zip
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-fix2/butter LABEL=lead-verify-fix2 OUT=<local>/lead-verify-fix2.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":43,"rawReversalCount":86,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":44}
EXIT 0; evidence <local>/lead-verify-fix2.json
$ LAB_ID=2 EXT=/home/simon/snap/chromium/common/rail-jump-head/butter LABEL=lead-verify-head2 OUT=<local>/lead-verify-head2.json node lab/harness/rail-jump-live.mjs
SUMMARY {"jumps":54,"failed":4,"visibleDetour":10,"native":0,"gated":10,"postCompletion":5,"postCompletionEventMoves":4,"afterLanding":8,"rawReversal":45,"rawReversalCount":109,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":0}
EXIT 1; evidence <local>/lead-verify-head2.json
```
