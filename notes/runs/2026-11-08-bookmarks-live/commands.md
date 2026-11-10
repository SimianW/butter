# Commands and actual output — #57 fourth live run

Outputs below are literal task output, with trailing whitespace removed and private fixture/account details omitted.
Read-only documentation/source inspection is listed without repeating the files. No extension
file was edited. All commands ran in the assigned fresh worktree unless stated otherwise.

## Setup and inspection

```sh
pwd && git status --short --branch && git log -5 --oneline
```

```text
/home/simon/.t3/worktrees/butter/t3-d3a4502c
## t3/update-bookmark-live-lab-tests
88dd6d5 Merge remote-tracking branch 'origin/t3/51-bookmarks' into t3/51-bookmarks-review-fixes
4e45313 Bookmarks: review fixes for the integration branch
52f8087 Rerun bookmark live matrix after earlier-history fix
708f3c3 Merge remote-tracking branch 'origin/t3/57-bookmark-lab-2' into t3/57-bookmark-lab-3
64c3dd4 Bookmarks: earlier, unloaded history sits on the rail's dots
```

```sh
git fetch origin && git merge-base --is-ancestor origin/t3/51-bookmarks HEAD
```

Exit 0, no output: HEAD already contains the integration branch; no reset needed.

```sh
git switch -c t3/57-bookmark-lab-4 && npm ci --prefix lab/harness
```

```text
Switched to a new branch 't3/57-bookmark-lab-4'

added 2 packages, and audited 3 packages in 359ms

found 0 vulnerabilities
```

```sh
npm ci
```

```text
npm warn deprecated eslint@9.39.5: This version is no longer supported. Please see https://eslint.org/version-support for other options.

added 88 packages, and audited 89 packages in 544ms

25 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

Read using `cat`, `sed`, `tail` and `rg`: `AGENTS.md`, `lab/README.md`, the external live-lab
README, `notes/runs/README.md`, the previous report and command log, the bookmark section of
`docs/development.md`, `package.json`, `eslint.config.mjs`, `lab/harness/bookmarks-live.mjs`,
`extension/bookmarks/content.js` and `extension/bookmarks/model.js`. The external README contains
private fixture URLs and is intentionally not reproduced. `rg --files` found `AGENTS.md`,
`CLAUDE.md` and `eslint.config.mjs`. An exploratory `cat eslint.config.js` and `ls -d node_modules`
reported that those paths did not exist; the actual config is `.mjs`, and root dependencies were
then installed above.

The harness was edited with a Python replacement script and `apply_patch`.

```sh
npx prettier --write lab/harness/bookmarks-live.mjs && node --check lab/harness/bookmarks-live.mjs
```

Exit 0, no output: the repository ignore list excludes the harness from that Prettier invocation.
Formatting was applied explicitly instead (whitespace only, while the already-loaded run continued):

```sh
node_modules/.bin/prettier --write --ignore-path /dev/null lab/harness/bookmarks-live.mjs
```

```text
lab/harness/bookmarks-live.mjs 183ms
```

`node --check lab/harness/bookmarks-live.mjs`, `git diff --check`, and
`git diff --quiet -- extension` exited 0 with no output. `git diff --stat`, `git diff`,
`git status --short` and `git rev-parse HEAD origin/t3/51-bookmarks` inspected the change;
both revisions were `88dd6d532218995ec32b7be1dc2cf6108a098b4b`.

## Full live matrix

```sh
OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs > /tmp/butter-57-lab4-run.log 2>&1
```

The harness acquires the lab and perf locks, installs the unique extension copy and send guard,
uses the existing fixture without composer input, and restores/releases in `finally`.
`tail` inspected the public-only log during the run. The exploratory attempt exited 1 after its overly strict list-target filter found no candidate.
The original 29 checks all passed. This was a harness eligibility failure, not a product bug.
Its actual complete output follows:

```text
PASS acquired fixture lab and perf lock
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
PASS real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
PASS held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":64,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":93,"p95FrameMs":16.8,"maxFrameMs":33.4,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
PASS hover button tooltip reads Bookmark {"labelStartsBookmark":true,"labelHasText":true,"tooltipIsBookmark":true,"tooltipVisible":true}
PASS paragraph button saves one bookmark {"stored":1,"marks":1}
PASS selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
PASS held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":87,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.8,16.8],"bookmarkedP95FrameMs":[16.7,16.8,16.8]}
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":25,"rail.targetTop":6,"rail.jump":6,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
PASS selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":26,"rail.targetTop":8,"rail.jump":6,"bookmark.locate":26},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
PASS paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":64}
PASS reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
PASS earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}
PASS hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":24,"rail.targetTop":4,"rail.jump":1,"bookmark.locate":24},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
PASS row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
PASS segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
PASS reload before segment click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
PASS earlier bookmarks sit under dots and not a loaded tick (segment) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}
PASS hover earlier segment shows 2-bookmark card (segment) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-segment {"clicks":[{"control":"other","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.earlierJump":1,"rail.landOff":19,"rail.targetTop":4,"rail.jump":1,"bookmark.locate":19},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
PASS segment click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":false,"sawSpinner":false,"sawBusyDots":true}
PASS segment moves from dots to loaded question after segment click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
PASS reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
PASS card delete removes selection bookmark {"remaining":1}
PASS earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}
PASS hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
PASS card delete removes both test bookmarks {"remaining":0,"marks":0}
FAIL real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"targetFound":false,"paragraph":null}
FAIL harness phase=pick-list-item error=Error
chromium: started (pid 1218238)
PASS lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
PASS lab and perf locks released
```

## Corrected full rerun

The target picker now selects the furthest nonempty later list item with more than 24 px
separation from the list start; a successful landing must be within 8 px of the expected 64 px
offset. The first-line bound uses Unicode code points, as the extension model does.
The script was edited with Python, then:

```sh
node_modules/.bin/prettier --write --ignore-path /dev/null lab/harness/bookmarks-live.mjs
node --check lab/harness/bookmarks-live.mjs
```

```text
lab/harness/bookmarks-live.mjs 172ms
```

Both exited 0. The failed attempt's public-only summary was retained as `attempt-1-summary.json`.
The same full live command was run again:

```sh
OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs > /tmp/butter-57-lab4-run.log 2>&1
```

Exit 0. Complete actual output:

```text
PASS acquired fixture lab and perf lock
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
PASS real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
PASS held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
PASS hover button tooltip reads Bookmark {"labelStartsBookmark":true,"labelHasText":true,"tooltipIsBookmark":true,"tooltipVisible":true}
PASS paragraph button saves one bookmark {"stored":1,"marks":1}
PASS selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
PASS held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":30,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
PASS matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.7,16.7]}
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":26,"rail.targetTop":6,"rail.jump":6,"bookmark.locate":26},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
PASS selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":26,"rail.targetTop":8,"rail.jump":6,"bookmark.locate":26},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
PASS paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":64}
PASS reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
PASS earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}
PASS hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":24,"rail.targetTop":4,"rail.jump":1,"bookmark.locate":24},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
PASS row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
PASS segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
PASS reload before segment click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
PASS earlier bookmarks sit under dots and not a loaded tick (segment) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}
PASS hover earlier segment shows 2-bookmark card (segment) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-segment {"clicks":[{"control":"other","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.earlierJump":1,"rail.landOff":24,"rail.targetTop":4,"rail.jump":1,"bookmark.locate":24},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
PASS segment click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":false,"sawSpinner":false,"sawBusyDots":true}
PASS segment moves from dots to loaded question after segment click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
PASS reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
PASS card delete removes selection bookmark {"remaining":1}
PASS earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}
PASS hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
PASS card delete removes both test bookmarks {"remaining":0,"marks":0}
PASS real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}
PASS list item tooltip and accessible name match {"labelStartsBookmark":true,"labelHasText":true,"tooltipIsBookmark":true,"tooltipVisible":true}
PASS list item button saves its individual paragraph with ask and line {"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}
PASS list item jump lands on the item instead of the list start {"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}
PASS list item resolves live and lands on the same item after reload {"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}
PASS card delete removes list item test bookmark {"remaining":0,"marks":0}
chromium: started (pid 1228857)
PASS lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
PASS lab and perf locks released
```

## Evidence validation

`python3 /tmp/butter-57-lab4-report.py` regenerated the report from the completed summary.
A Python command appended both runs' actual stdout to this log. An initial deliberately broad
URL scan rejected the public ESLint support URL in npm's warning; the corrected scan allowlists
that known public documentation URL and extension-source SHA-256 fingerprints.

```sh
python3 /tmp/butter-57-lab4-audit.py
git diff --check && git diff --quiet origin/t3/51-bookmarks -- extension && node --check lab/harness/bookmarks-live.mjs && node_modules/.bin/prettier --check --ignore-path /dev/null lab/harness/bookmarks-live.mjs
```

```text
PASS final live matrix: 35/35; no send attempts; complete restoration and lock release
PASS artifact privacy scan: {"uuid": 0, "privateOrUnexpectedUrl": 0, "unexpectedSha256": 0}
Run UTC: 2026-11-09T02:35:14.456Z to 2026-11-09T02:40:03.302Z
Extension tree SHA-256: fe1113990663beb0d51acfadeeb2b5122309cdf78628cd436bd2232f81028163
Checking formatting...
All matched files use Prettier code style!
```

Both commands exited 0. The extension directory is byte-for-byte the integration source.

## Commit, integration merge, checks and push

```sh
git add lab/harness/bookmarks-live.mjs notes/runs/2026-11-08-bookmarks-live && git commit -m "Rerun bookmark live matrix after review fixes"
```

```text
[t3/57-bookmark-lab-4 fc4bbb1] Rerun bookmark live matrix after review fixes
 5 files changed, 1746 insertions(+), 363 deletions(-)
 create mode 100644 notes/runs/2026-11-08-bookmarks-live/attempt-1-summary.json
```

```sh
git fetch origin && git merge origin/t3/51-bookmarks
```

```text
From https://github.com/SimianW/butter
 * [new branch]      t3/fix-new-branch-confirmation -> origin/t3/fix-new-branch-confirmation
Already up to date.
```

```sh
npm run format:check && npm run lint
```

```text

> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"

Checking formatting...
All matched files use Prettier code style!

> lint
> eslint .

```

All exited 0. A follow-up `git diff --quiet origin/t3/51-bookmarks -- extension` exited 0,
`git status --short --branch` showed only `## t3/57-bookmark-lab-4`, and `git rev-parse HEAD`
returned `fc4bbb1d6515f9b0974d3ed246a9cfc3d2b93d29`.

```sh
git push -u origin t3/57-bookmark-lab-4 > /tmp/butter-57-lab4-push.log 2>&1
cat /tmp/butter-57-lab4-push.log
```

```text
remote:
remote: Create a pull request for 't3/57-bookmark-lab-4' on GitHub by visiting:
remote:      https://github.com/SimianW/butter/pull/new/t3/57-bookmark-lab-4
remote:
To https://github.com/SimianW/butter.git
 * [new branch]      t3/57-bookmark-lab-4 -> t3/57-bookmark-lab-4
branch 't3/57-bookmark-lab-4' set up to track 'origin/t3/57-bookmark-lab-4'.
```

Exit 0. GitHub's suggested PR URL above was not opened and no PR was created.
A final documentation-only commit records these actual outputs and is pushed to the same branch;
the handoff reports that final head and push result. No merge into the integration branch occurred.

`git diff --check` initially rejected trailing spaces emitted by the GitHub remote in the copied
push output (exit 2); those spaces were removed. An intervening push returned
`Everything up-to-date` (exit 0). The final documentation commit follows the corrected diff check.
