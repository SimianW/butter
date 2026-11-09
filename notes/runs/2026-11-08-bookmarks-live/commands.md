# Commands and actual output — #57 live rerun

Output below is from this task. Fixture URLs, chat content, credentials and private endpoints
are excluded. Read-only source/README inspections are not reproduced in full.
The final harness run is authoritative; the first two reruns helped correct the harness's
seek-card timing, silent first-bookmark fallback and mounted-answer resolution assertion.

## Preparation

```sh
git status --short --branch
git fetch origin
git merge-base --is-ancestor origin/t3/51-bookmarks HEAD
```

```text
## t3/rerun-bookmark-live-lab
```

All three exited 0; fetch and the ancestry check produced no output, so reset was unnecessary.

```sh
git switch -c t3/57-bookmark-lab-2
git merge origin/t3/57-bookmark-lab
npm ci --prefix lab/harness
```

```text
Switched to a new branch 't3/57-bookmark-lab-2'
Merge made by the 'ort' strategy.
 lab/harness/bookmarks-live.mjs                    | 758 ++++++++++++++++++++++
 notes/runs/2026-11-08-bookmarks-live/commands.md  | 233 +++++++
 notes/runs/2026-11-08-bookmarks-live/report.md    |  78 +++
 notes/runs/2026-11-08-bookmarks-live/summary.json | 413 ++++++++++++
 4 files changed, 1482 insertions(+)
 create mode 100644 lab/harness/bookmarks-live.mjs
 create mode 100644 notes/runs/2026-11-08-bookmarks-live/commands.md
 create mode 100644 notes/runs/2026-11-08-bookmarks-live/report.md
 create mode 100644 notes/runs/2026-11-08-bookmarks-live/summary.json

added 2 packages, and audited 3 packages in 426ms

found 0 vulnerabilities
```

```sh
gh issue view 57 -R SimianW/butter
gh issue view 51 -R SimianW/butter
```

Actual output excerpts (both exit 0):

```text
title: Bookmarks: privacy docs, live lab check and release
state: OPEN
number: 57
- [ ] The live lab report in `notes/runs/` shows bookmarking and jumping working during and after a drag, with no extra mounts.

title: Bookmarks: mark any spot in an answer, one rail segment per question
state: OPEN
number: 51
```

Read `lab/README.md`, the external lab README, `notes/runs/README.md`, the old report,
`docs/bugfix.md`, the diagnosing-bugs skill, and the bookmark/rail/history code. No glossary or
applicable ADR file was found. `cat GLOSSARY.md` returned `No such file or directory` (exit 1).
A first `test -d node_modules` returned exit 1, so root check dependencies were installed:

```sh
npm ci
node --check lab/harness/bookmarks-live.mjs
```

```text
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 88 packages, and audited 89 packages in 567ms

25 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Both exited 0; the syntax check emitted no output. Scripts/reports were edited with Python;
no extension file was edited. `git diff -- extension/` emitted no output.

## Exploratory rerun 1

```sh
EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs
```

Exit 1. Assertions later corrected are explained in the report. Actual output:

```text
PASS acquired fixture lab and perf lock
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
PASS real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
PASS held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
PASS paragraph button saves one bookmark {"stored":1,"marks":1}
PASS selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
PASS held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
FAIL selection card jump after drag lands on text {"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}
FAIL paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":false,"textTopAfterRelease":-22474}
INFO cold {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
PASS reload leaves bookmarked earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
FAIL unloaded bookmark jump loads earlier pages and lands on text {"earlierPages":0,"targetMounted":false,"inView":false,"textTop":null,"ticks":5,"marks":1,"more":true,"stale":0,"busy":0}
PASS reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0}
PASS card delete removes both test bookmarks {"remaining":0,"marks":0}
chromium: started (pid 970792)
PASS lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
PASS lab and perf locks released
```

## Exploratory rerun 2

```sh
OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs
```

Exit 1. Assertions later corrected are explained in the report. Actual output:

```text
PASS acquired fixture lab and perf lock
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
PASS real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
PASS held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
PASS paragraph button saves one bookmark {"stored":1,"marks":1}
PASS selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
PASS held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.8,16.8],"bookmarkedP95FrameMs":[16.7,16.8,16.7]}
INFO jump after-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"calls":{"rail.landOff":27,"rail.targetTop":6,"rail.jump":6,"bookmark.locate":27},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
FAIL selection card jump after drag lands on text {"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0},{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"Enter","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"calls":{"rail.landOff":26,"rail.targetTop":6,"rail.jump":6,"bookmark.locate":26},"paragraph":{"top":-22474,"bottom":-22422,"x":736,"y":-22410,"height":52,"inView":false},"selection":{"top":-15534.296875,"bottom":-15482.078125,"x":736,"y":-15470.296875,"height":52.21875,"inView":false}}
FAIL paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":false,"textTopAfterRelease":-22474}
INFO cold {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
PASS reload leaves bookmarked earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
INFO jump unloaded {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"calls":{"rail.jumpTo":1,"rail.landOff":27,"rail.targetTop":4,"rail.jump":1,"rail.glide":1,"bookmark.locate":27},"paragraph":null,"selection":null}
FAIL unloaded bookmark jump loads earlier pages and lands on text {"earlierPages":0,"targetMounted":false,"inView":false,"textTop":null,"ticks":5,"marks":1,"more":true,"stale":0,"busy":0}
FAIL reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":false,"records":2,"matchingMessagesAndExcerpts":0}
PASS card delete removes both test bookmarks {"remaining":0,"marks":0}
chromium: started (pid 977320)
PASS lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
PASS lab and perf locks released
```

## Final corrected full matrix

```sh
./node_modules/.bin/prettier --ignore-path /dev/null --write lab/harness/bookmarks-live.mjs
node --check lab/harness/bookmarks-live.mjs
OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs
```

Formatting output: `lab/harness/bookmarks-live.mjs 163ms`; syntax check: no output, exit 0.
Harness exit 1: the unloaded-earlier-bookmark check fails. Full actual harness output:

```text
PASS acquired fixture lab and perf lock
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
PASS real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
PASS held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.7,"maxFrameMs":33.3,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
PASS paragraph button saves one bookmark {"stored":1,"marks":1}
PASS selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
PASS held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.7,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.8,16.7]}
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":28,"rail.targetTop":6,"rail.jump":6,"bookmark.locate":28},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
PASS selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":27,"rail.targetTop":8,"rail.jump":6,"bookmark.locate":27},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
PASS paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":64}
INFO cold {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
PASS reload leaves bookmarked earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
INFO jump unloaded {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":27,"rail.targetTop":4,"rail.jump":1,"rail.glide":1,"bookmark.locate":27},"paragraph":null,"selection":null}
FAIL unloaded bookmark jump loads earlier pages and lands on text {"earlierPages":0,"targetMounted":false,"inView":false,"textTop":null,"ticks":5,"marks":1,"more":true,"stale":0,"busy":0}
INFO jump after-manual-history {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":23,"rail.targetTop":4,"rail.jump":8,"bookmark.locate":23},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
PASS reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2}
PASS card delete removes both test bookmarks {"remaining":0,"marks":0}
chromium: started (pid 982910)
PASS lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
PASS lab and perf locks released
```

## Independent post-run verification

Imported the external lab library, called `getLab` / `lockStatus`, selected only booleans, and
saved them under `cleanup.postRunLockVerification` in `summary.json` (exit 0):

```text
Post-run lock verification: {"labFree":true,"perfFree":true,"taskOwnsNoLock":true}
Final harness checks: {"pass":16,"fail":1,"cleanup":{"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true,"postRunLockVerification":{"labFree":true,"perfFree":true,"taskOwnsNoLock":true}}}
```

## Privacy, commit, integration update and required checks

Privacy scan checked report-directory files for UUIDs, private endpoints, ChatGPT conversation
URLs and Bearer tokens. The Python assertion exited 0 with actual output:

```text
Privacy pattern scan: {'summary.json': 0, 'commands.md': 0, 'report.md': 0}
```

```sh
git diff --check
git diff --quiet origin/t3/51-bookmarks -- extension/
git add lab/harness/bookmarks-live.mjs notes/runs/2026-11-08-bookmarks-live
git commit -m "Rerun bookmark live lab after markup fix; report unloaded jump failure"
```

All exit 0. Only commit emitted output:

```text
[t3/57-bookmark-lab-2 cc9990f] Rerun bookmark live lab after markup fix; report unloaded jump failure
 4 files changed, 1095 insertions(+), 281 deletions(-)
```

```sh
git fetch origin && git merge origin/t3/51-bookmarks
```

Exit 0:

```text
Already up to date.
```

```sh
npm run format:check && npm run lint
```

Exit 0:

```text
> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"

Checking formatting...
All matched files use Prettier code style!

> lint
> eslint .
```

```sh
git status --short --branch
git diff --quiet origin/t3/51-bookmarks -- extension/
git rev-parse HEAD
```

All exit 0; actual combined output:

```text
## t3/57-bookmark-lab-2
cc9990f413ee43273a0051805df57e23029ba1e1
```

The above commit is amended once to include this check transcript and the report's validation
note. That amendment changes only Markdown; final head and push output are in the task handoff.
No PR is opened and no merge into the integration branch is performed.
