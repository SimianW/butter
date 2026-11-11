# Commands and actual output

Commands ran from the separate worktree or its two `git archive` copies. The shared checkout was used only for initial read-only inspection and `git fetch`/worktree registration. Private raw outputs remain outside the repository; the following outputs are sanitized, with explicit replacements for identifiers and URLs.

## Preparation

```sh
git fetch origin
git worktree add /tmp/rail-model-live origin/t3/rail-model
```

Actual output:

```text
From https://github.com/SimianW/butter
   fd1ab4a..a100fd6  main -> origin/main
   e6d9f5f..3e7be5d  t3/bookmark-session -> origin/t3/bookmark-session
 * [new branch] t3/bookmark-session-live -> origin/t3/bookmark-session-live
 * [new branch] t3/rail-model -> origin/t3/rail-model
Preparing worktree (detached HEAD b4a0ac8)
HEAD is now at b4a0ac8 test: the earlier wait ignores another conversation's marks after switching back
```

- `pwd`, `git status --short`, `git branch --show-current`: shared checkout on main; only pre-existing untracked files. The final comparison verifies status is unchanged.
- `cat`/`sed`/`rg` read `lab/README.md`, `notes/runs/README.md`, `docs/benchmarks.md`, `docs/development.md`, the prior bookmark-session report and commands, host README/config, and harness source. The prior report paths were absent in the older shared checkout (exit 1), then read from the PR worktree. A broad `/tmp` filename search printed permission errors for system-owned directories; narrowed reads succeeded. `ls lab/harness/recordings` exited 2 because recordings are external.
- Python invoked `git archive <full SHA>` per side, extracted it with `tarfile`, linked installed dependencies, and copied frozen history/recording from the prior benchmark. Output:

```text
main a100fd6dec8841411e183e3d178065bfcbe9f10d /home/simon/snap/chromium/common/rail-model-live-main
pr b4a0ac87ab5d4f5227de3521ffe325e66ce94cdb /home/simon/snap/chromium/common/rail-model-live-pr
math-nine.json 359b4fe33317cb357e4f6646f3dc443dd6338241e53897039349c23fa239d345
recording.json 36b773bf0733ff3f4df3856157834243bfdcf886af1fbc2f0600631d251ca05c
main original bench 2e1498fd9e979f90b79ce391d6fca06a0c2d92e0f3bb59abf692937d40bd8def
pr original bench 2e1498fd9e979f90b79ce391d6fca06a0c2d92e0f3bb59abf692937d40bd8def
```

The safety/measurement adapter and lock loader are described in report.md. They edit only task-owned harness copies. The pristine archived `bench.mjs` files and all extension files remain intact.

## Harness invocations and actual outputs

### matrix-main-1

Started 2026-11-11T18:53:36.892950+00:00; finished 2026-11-11T18:58:39.379748+00:00; exit 0; wall seconds 302.487.

```sh
node --no-warnings --experimental-loader /tmp/rail-model-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `MODE=matrix LAB_FIXTURE=math12 EXT=<this arm archive>/extension TESTED_HEAD=<requested SHA> VERBOSE=1`

Actual output (private values stripped):

```text
INFO acquired fixture lab and perf lock {}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (44 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (33 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.8,16.7]}
pass drag-bookmarked: 4/4 checks passed (30 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":25,"rail.targetTop":7,"rail.jump":6,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":45,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (12 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":18,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":18},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (27 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":21,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":21},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (28 s)
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
pass list-item: 6/6 checks passed (89 s)

chromium: started (pid 2631009)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-model-live-work/matrix-main-1
35 checks passed
```

### wash-main-1

Started 2026-11-11T18:58:39.380357+00:00; finished 2026-11-11T19:00:53.615486+00:00; exit 0; wall seconds 134.235.

```sh
node --no-warnings --experimental-loader /tmp/rail-model-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `MODE=wash LAB_FIXTURE=demo-en12 EXT=<this arm archive>/extension TESTED_HEAD=<requested SHA> VERBOSE=1`

Actual output (private values stripped):

```text
INFO acquired fixture lab and perf lock {}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (32 s)
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
pass wash-theme-dark: 2/2 checks passed (25 s)
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

chromium: stopped
chromium: started (pid 2634733)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-model-live-work/wash-main-1
42 checks passed
```

### bench-acquire-cancelled

Started 2026-11-11T18:55:41.087929+00:00; finished 2026-11-11T19:01:52.102716+00:00; exit -15; wall seconds 371.015.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-model-live --wait 1800 --perf --needs-fixture math12
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text

```

### matrix-pr-1

Started 2026-11-11T19:00:53.615941+00:00; finished 2026-11-11T19:05:57.904154+00:00; exit 0; wall seconds 304.288.

```sh
node --no-warnings --experimental-loader /tmp/rail-model-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `MODE=matrix LAB_FIXTURE=math12 EXT=<this arm archive>/extension TESTED_HEAD=<requested SHA> VERBOSE=1`

Actual output (private values stripped):

```text
INFO acquired fixture lab and perf lock {}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1268,"scrollTop":408,"gutter":20,"y":620.3596214511041}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (44 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":31,"frames":85,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":124,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (33 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.8],"bookmarkedP95FrameMs":[16.7,16.7,16.7]}
pass drag-bookmarked: 4/4 checks passed (30 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":25,"rail.targetTop":7,"rail.jump":6,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":45,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (12 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":24,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":24},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (28 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":24,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":24},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (28 s)
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
pass list-item: 6/6 checks passed (89 s)

chromium: started (pid 2642537)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-model-live-work/matrix-pr-1
35 checks passed
```

### wash-pr-1

Started 2026-11-11T19:05:57.904734+00:00; finished 2026-11-11T19:08:12.594453+00:00; exit 0; wall seconds 134.69.

```sh
node --no-warnings --experimental-loader /tmp/rail-model-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `MODE=wash LAB_FIXTURE=demo-en12 EXT=<this arm archive>/extension TESTED_HEAD=<requested SHA> VERBOSE=1`

Actual output (private values stripped):

```text
INFO acquired fixture lab and perf lock {}
ok   wash light: ChatGPT shows its light theme {"background":[252,252,252],"colorScheme":"light","darkClass":false}
ok   wash light: the whole chat loads through the earlier-history dots {"ticks":12}
pass wash-theme-light: 2/2 checks passed (32 s)
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
pass wash-theme-dark: 2/2 checks passed (26 s)
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

chromium: stopped
chromium: started (pid 2646653)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-model-live-work/wash-pr-1
42 checks passed
```

### nav-acquire

Started 2026-11-11T19:08:12.594777+00:00; finished 2026-11-11T19:08:12.658670+00:00; exit 0; wall seconds 0.064.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-model-live --wait 1800 --perf --needs-fixture math12
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
1
```

### nav-earlier-main-1

Started 2026-11-11T19:08:12.658961+00:00; finished 2026-11-11T19:08:43.292232+00:00; exit 1; wall seconds 30.633.

```sh
node --import /tmp/rail-model-live-work/guard.mjs lab/harness/nav-earlier.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-nav[data-on]')

    at setup (/home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-earlier.mjs:73:50)
    at async file:///home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-earlier.mjs:85:5 {
  log: [ "  - waiting for locator('chatgpt-butter-nav[data-on]')" ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

### nav-earlier-main-2

Started 2026-11-11T19:08:43.292385+00:00; finished 2026-11-11T19:09:13.920841+00:00; exit 1; wall seconds 30.628.

```sh
node --import /tmp/rail-model-live-work/guard.mjs lab/harness/nav-earlier.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-nav[data-on]')

    at setup (/home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-earlier.mjs:73:50)
    at async file:///home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-earlier.mjs:85:5 {
  log: [ "  - waiting for locator('chatgpt-butter-nav[data-on]')" ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

### nav-takeovers-main-1

Started 2026-11-11T19:09:13.921026+00:00; finished 2026-11-11T19:10:14.780346+00:00; exit 1; wall seconds 60.859.

```sh
node --import /tmp/rail-model-live-work/guard.mjs lab/harness/nav-takeovers.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"version":"alpha6","kind":"repeat","clicks":[0,999,1999],"revealMs":6185,"top":64,"busy":false,"warp":"hidden"}
{"version":"alpha6","kind":"same-final","clicks":[0,999,1999],"revealMs":6181,"top":64,"busy":false,"warp":"hidden"}
{"version":"alpha6","kind":"deadline","clicks":[0,999,1997,2999,3998,4998,5998,6998,7999,8997,9996,10998],"revealMs":15196,"top":64,"busy":false,"warp":"hidden"}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-nav[data-on]')

    at setup (/home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-takeovers.mjs:34:50)
    at async file:///home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-takeovers.mjs:43:7 {
  log: [ "  - waiting for locator('chatgpt-butter-nav[data-on]')" ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

### nav-takeovers-main-2

Started 2026-11-11T19:10:14.780532+00:00; finished 2026-11-11T19:11:15.731347+00:00; exit 1; wall seconds 60.951.

```sh
node --import /tmp/rail-model-live-work/guard.mjs lab/harness/nav-takeovers.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"version":"alpha6","kind":"repeat","clicks":[0,999,1999],"revealMs":6203,"top":64,"busy":false,"warp":"hidden"}
{"version":"alpha6","kind":"same-final","clicks":[0,999,2001],"revealMs":6187,"top":64,"busy":false,"warp":"hidden"}
{"version":"alpha6","kind":"deadline","clicks":[0,1000,1998,2999,3998,4999,5998,6998,7998,8998,9998,10999],"revealMs":15195,"top":64,"busy":false,"warp":"hidden"}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 30000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-nav[data-on]')

    at setup (/home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-takeovers.mjs:34:50)
    at async file:///home/simon/snap/chromium/common/rail-model-live-main/lab/harness/nav-takeovers.mjs:43:7 {
  log: [ "  - waiting for locator('chatgpt-butter-nav[data-on]')" ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

### nav-earlier-pr-1

Started 2026-11-11T19:11:15.731503+00:00; finished 2026-11-11T19:12:12.576831+00:00; exit 0; wall seconds 56.845.

```sh
node --import /tmp/rail-model-live-work/guard.mjs lab/harness/nav-earlier.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"kind":"growth","run":1,"ms":3259,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":2,"ms":3246,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":3,"ms":3240,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":4,"ms":3239,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":5,"ms":3242,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"late-growth","first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"anchor-released","first":0,"firstTop":-15336,"latestTop":1064,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"earlier-click","ms":5038,"first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","uncoveredPages":0,"pass":true}
{"kind":"earlier-keyboard","ms":5010,"first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","uncoveredPages":0,"pass":true}
{"kind":"slow-final-page","first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"reduced-motion","first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"empty-final-page","first":6,"firstTop":-5400,"latestTop":-1800,"growth":false,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"earlier-takeover","first":6,"firstTop":-3536,"latestTop":64,"growth":false,"pages":[],"more":true,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"earlier-cancelled","first":4,"firstTop":-3936,"latestTop":3264,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":0.51395,"content":0.648054}],"more":true,"busy":0,"warp":"hidden","content":"1","pass":true}
errors []
```

### nav-takeovers-pr-1

Started 2026-11-11T19:12:12.577055+00:00; finished 2026-11-11T19:13:29.916946+00:00; exit 0; wall seconds 77.34.

```sh
node --import /tmp/rail-model-live-work/guard.mjs lab/harness/nav-takeovers.mjs
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"version":"alpha6","kind":"repeat","clicks":[0,1001,2000],"revealMs":6182,"top":64,"busy":false,"warp":"hidden"}
{"version":"alpha6","kind":"same-final","clicks":[0,998,1999],"revealMs":6206,"top":64,"busy":false,"warp":"hidden"}
{"version":"alpha6","kind":"deadline","clicks":[0,1000,2000,3000,3999,5000,6000,6999,8000,9000,9999,11001],"revealMs":15190,"top":64,"busy":false,"warp":"hidden"}
{"version":"new","kind":"repeat","clicks":[0,999,1999],"revealMs":3687,"top":64,"busy":false,"warp":"hidden"}
{"version":"new","kind":"same-final","clicks":[0,999,2000],"revealMs":5675,"top":64,"busy":false,"warp":"hidden"}
{"version":"new","kind":"deadline","clicks":[0,999,2000,3000,4000,4999,6000,7000,8000,8999,9999,10999],"revealMs":12260,"top":64,"busy":false,"warp":"hidden"}
{"version":"new","kind":"deadline-followed","clicks":[0,999,2000,3000,4000,4999,6000,7000,8000,8999,9999,10999],"revealMs":12260,"top":64,"busy":false,"warp":"hidden"}
{"version":"new","kind":"remount-during-reveal","clicks":[0],"revealMs":672,"top":64,"busy":false,"warp":"hidden","remounted":true}
{"version":"new","kind":"remount","clicks":[0],"revealMs":661,"top":64,"busy":false,"warp":"hidden"}
{"version":"new","kind":"send-during-readiness","clicks":[0],"revealMs":578,"top":464,"busy":false,"warp":"hidden"}
{"version":"new","kind":"deadline-unmounted","clicks":[0,999,2000,2999,4000,4999,6000,6999,7999,9000,9999,11002],"revealMs":12257,"top":null,"busy":false,"warp":"hidden"}
{"version":"new","kind":"deadline-fallback-released","clicks":[0,999,2000,2999,4000,4999,6000,6999,7999,9000,9999,11002],"revealMs":12257,"top":-336,"busy":false,"warp":"hidden"}
{"version":"new","kind":"release-keyboard","clicks":[0],"revealMs":672,"top":1564,"busy":false,"warp":"hidden"}
{"version":"new","kind":"release-touch","clicks":[0],"revealMs":674,"top":1564,"busy":false,"warp":"hidden"}
{"version":"new","kind":"release-scrollbar","clicks":[0],"revealMs":674,"top":1564,"busy":false,"warp":"hidden"}
errors []
```

### nav-restore

Started 2026-11-11T19:13:29.917089+00:00; finished 2026-11-11T19:13:34.189100+00:00; exit 0; wall seconds 4.272.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-model-live
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
restored {"lab":1,"restarted":false,"url":"[private ChatGPT URL removed]","composer":"","pages":["[private ChatGPT URL removed]"],"browser":{"pid":2642537,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T19:13:33.546Z","ok":true}
```

### nav-release

Started 2026-11-11T19:13:34.189323+00:00; finished 2026-11-11T19:13:34.253232+00:00; exit 0; wall seconds 0.064.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-model-live
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```

### pilot-acquire

Started 2026-11-11T19:08:26.651326+00:00; finished 2026-11-11T19:13:34.977520+00:00; exit 0; wall seconds 308.326.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-model-live --wait 1800 --perf --needs-fixture math12
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
1
```

### pilot-restart-main-1

Started 2026-11-11T19:13:34.977796+00:00; finished 2026-11-11T19:13:37.049017+00:00; exit 0; wall seconds 2.071.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2654764)
```

### pilot-main-1

Started 2026-11-11T19:13:37.049154+00:00; finished 2026-11-11T19:16:28.823509+00:00; exit 0; wall seconds 171.774.

```sh
node lab/harness/bench-live.mjs bench-main-1 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:13:41 [bench-main-1] replaying 189 chunks over 122s, 1 reps
19:16:28 [bench-main-1] rep 1: fps=12.2 p95=350 jank=19.5% busy=87.7% style=68.2% blocked=84.5s maxFreeze=2735 keyP95=3106.1 keyMax=4678.2 wheelP95=1473 LoAF[renderSL=30s forcedSL=58.3s script=10.1s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=0 blockAdds=0 seenMarks=0 butter={"smootherFrames":178,"published":177} nodes=194642 turns=9 chunks=189/189
```

### pilot-restart-pr-1

Started 2026-11-11T19:16:28.824468+00:00; finished 2026-11-11T19:16:30.896048+00:00; exit 0; wall seconds 2.072.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2658609)
```

### pilot-pr-1

Started 2026-11-11T19:16:30.896048+00:00; finished 2026-11-11T19:19:57.870105+00:00; exit -15; wall seconds None.

```sh
node lab/harness/bench-live.mjs bench-pr-1 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:16:35 [bench-pr-1] replaying 189 chunks over 122s, 1 reps
19:19:26 [bench-pr-1] rep 1: fps=12.1 p95=300 jank=18.4% busy=87.9% style=68.8% blocked=86.7s maxFreeze=2811 keyP95=2902.5 keyMax=4107.1 wheelP95=1387 LoAF[renderSL=28.4s forcedSL=61.7s script=9.7s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=0 blockAdds=0 seenMarks=0 butter={"smootherFrames":175,"published":174} nodes=194642 turns=9 chunks=189/189
```

### pilot-restore

Started boundary not recorded; follows pilot cancellation; finished 2026-11-11T19:19:38.643772+00:00; exit 0; wall seconds None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-model-live
```

Working directory: `/tmp/rail-model-live-work`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
restore lab 1: restarting browser (now {"pid":2658609,"extensions":["/home/simon/snap/chromium/common/rail-model-live-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-model-live-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 2663953)
restored {"lab":1,"restarted":true,"url":"[private ChatGPT URL removed]","composer":"","pages":["[private ChatGPT URL removed]"],"browser":{"pid":2663953,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T19:19:38.023Z","ok":true}
```

### pilot-release

Started boundary not recorded; follows pilot cancellation; finished 2026-11-11T19:19:38.714773+00:00; exit 0; wall seconds None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-model-live
```

Working directory: `/tmp/rail-model-live-work`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```

### bench-acquire

Started 2026-11-11T19:20:29.034771+00:00; finished 2026-11-11T19:20:29.098769+00:00; exit 0; wall seconds 0.064.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-model-live --wait 1800 --perf --needs-fixture math12
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
1
```

### bench-restart-main-1

Started 2026-11-11T19:20:29.099085+00:00; finished 2026-11-11T19:20:31.171136+00:00; exit 0; wall seconds 2.072.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2665718)
```

### bench-main-1

Started 2026-11-11T19:20:31.171289+00:00; finished 2026-11-11T19:23:18.588733+00:00; exit 0; wall seconds 167.417.

```sh
node lab/harness/bench-live.mjs bench-main-1 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:20:35 [bench-main-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
19:23:18 [bench-main-1] rep 1: fps=20.6 p95=249.9 jank=12.2% busy=82.7% style=58% blocked=66.0s maxFreeze=1727 keyP95=601.2 keyMax=612.9 wheelP95=388 LoAF[renderSL=67.8s forcedSL=6.6s script=4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1160 seenMarks=437 butter={"smootherFrames":335,"published":334} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

### bench-restart-pr-1

Started 2026-11-11T19:23:18.596789+00:00; finished 2026-11-11T19:23:20.669772+00:00; exit 0; wall seconds 2.073.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2670275)
```

### bench-pr-1

Started 2026-11-11T19:23:20.669953+00:00; finished 2026-11-11T19:26:10.481805+00:00; exit 0; wall seconds 169.812.

```sh
node lab/harness/bench-live.mjs bench-pr-1 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:23:25 [bench-pr-1] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
19:26:10 [bench-pr-1] rep 1: fps=20.8 p95=250 jank=12.1% busy=82.3% style=58.2% blocked=65.8s maxFreeze=1557 keyP95=600.5 keyMax=614.2 wheelP95=370 LoAF[renderSL=67.2s forcedSL=7s script=3.8s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1177 seenMarks=438 butter={"smootherFrames":332,"published":331} nodes=194643 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

### bench-restart-pr-2

Started 2026-11-11T19:26:10.489978+00:00; finished 2026-11-11T19:26:12.561108+00:00; exit 0; wall seconds 2.071.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2674210)
```

### bench-pr-2

Started 2026-11-11T19:26:12.561247+00:00; finished 2026-11-11T19:29:07.403577+00:00; exit 0; wall seconds 174.842.

```sh
node lab/harness/bench-live.mjs bench-pr-2 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:26:17 [bench-pr-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4747,"visibleScrollers":1,"off":""}
19:29:07 [bench-pr-2] rep 1: fps=20.6 p95=250 jank=12.3% busy=82.4% style=57.8% blocked=65.7s maxFreeze=1541 keyP95=605.1 keyMax=754 wheelP95=386 LoAF[renderSL=67.5s forcedSL=6.7s script=3.7s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1164 seenMarks=438 butter={"smootherFrames":332,"published":332} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

### bench-restart-main-2

Started 2026-11-11T19:29:07.404979+00:00; finished 2026-11-11T19:29:09.475518+00:00; exit 0; wall seconds 2.071.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2678741)
```

### bench-main-2

Started 2026-11-11T19:29:09.475672+00:00; finished 2026-11-11T19:32:00.605430+00:00; exit 0; wall seconds 171.13.

```sh
node lab/harness/bench-live.mjs bench-main-2 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:29:14 [bench-main-2] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
19:32:00 [bench-main-2] rep 1: fps=20.8 p95=250 jank=12.2% busy=82.7% style=58.1% blocked=65.4s maxFreeze=1564 keyP95=632 keyMax=655 wheelP95=368 LoAF[renderSL=67.5s forcedSL=6.9s script=4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1157 seenMarks=438 butter={"smootherFrames":333,"published":332} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

### bench-restart-main-3

Started 2026-11-11T19:32:00.606559+00:00; finished 2026-11-11T19:32:02.675800+00:00; exit 0; wall seconds 2.069.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2682594)
```

### bench-main-3

Started 2026-11-11T19:32:02.675972+00:00; finished 2026-11-11T19:34:55.172971+00:00; exit 0; wall seconds 172.497.

```sh
node lab/harness/bench-live.mjs bench-main-3 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:32:07 [bench-main-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
19:34:54 [bench-main-3] rep 1: fps=19.6 p95=266.6 jank=13% busy=84% style=59.2% blocked=67.8s maxFreeze=1539 keyP95=686.6 keyMax=693.1 wheelP95=420 LoAF[renderSL=68.9s forcedSL=7s script=4.4s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1160 seenMarks=437 butter={"smootherFrames":333,"published":333} nodes=194549 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2245,"visibleScrollers":1,"off":""}
```

### bench-restart-pr-3

Started 2026-11-11T19:34:55.174325+00:00; finished 2026-11-11T19:34:57.244692+00:00; exit 0; wall seconds 2.07.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2687252)
```

### bench-pr-3

Started 2026-11-11T19:34:57.244827+00:00; finished 2026-11-11T19:37:50.522879+00:00; exit 0; wall seconds 173.278.

```sh
node lab/harness/bench-live.mjs bench-pr-3 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:35:01 [bench-pr-3] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":2932,"visibleScrollers":1,"off":""}
19:37:50 [bench-pr-3] rep 1: fps=19.7 p95=250 jank=13.1% busy=83.5% style=59.2% blocked=67.0s maxFreeze=1598 keyP95=682.5 keyMax=701.1 wheelP95=379 LoAF[renderSL=68.8s forcedSL=6.6s script=3.9s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1164 seenMarks=440 butter={"smootherFrames":332,"published":331} nodes=194549 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":2248,"visibleScrollers":1,"off":""}
```

### bench-restart-pr-4

Started 2026-11-11T19:37:50.524303+00:00; finished 2026-11-11T19:37:52.597082+00:00; exit 0; wall seconds 2.073.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2691369)
```

### bench-pr-4

Started 2026-11-11T19:37:52.597216+00:00; finished 2026-11-11T19:40:45.634560+00:00; exit 0; wall seconds 173.037.

```sh
node lab/harness/bench-live.mjs bench-pr-4 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:37:57 [bench-pr-4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4747,"visibleScrollers":1,"off":""}
19:40:45 [bench-pr-4] rep 1: fps=20.2 p95=250 jank=12.6% busy=83% style=58.8% blocked=66.5s maxFreeze=1809 keyP95=638.6 keyMax=644.5 wheelP95=371 LoAF[renderSL=68.4s forcedSL=6.6s script=3.9s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1170 seenMarks=438 butter={"smootherFrames":328,"published":328} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

### bench-restart-main-4

Started 2026-11-11T19:40:45.636245+00:00; finished 2026-11-11T19:40:47.708523+00:00; exit 0; wall seconds 2.072.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2696007)
```

### bench-main-4

Started 2026-11-11T19:40:47.708669+00:00; finished 2026-11-11T19:43:22.711938+00:00; exit 0; wall seconds 155.003.

```sh
node lab/harness/bench-live.mjs bench-main-4 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:40:52 [bench-main-4] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":4987,"visibleScrollers":1,"off":""}
19:43:22 [bench-main-4] rep 1: fps=19.9 p95=250 jank=12.9% busy=83.5% style=58.7% blocked=66.7s maxFreeze=1532 keyP95=602.3 keyMax=1023.5 wheelP95=414 LoAF[renderSL=68.5s forcedSL=6.4s script=4.2s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1168 seenMarks=445 butter={"smootherFrames":334,"published":334} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":3622,"visibleScrollers":1,"off":""}
```

### bench-restart-main-5

Started 2026-11-11T19:43:22.713607+00:00; finished 2026-11-11T19:43:24.785942+00:00; exit 0; wall seconds 2.072.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2699492)
```

### bench-main-5

Started 2026-11-11T19:43:24.786100+00:00; finished 2026-11-11T19:46:15.256998+00:00; exit 0; wall seconds 170.471.

```sh
node lab/harness/bench-live.mjs bench-main-5 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-main`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:43:29 [bench-main-5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
19:46:14 [bench-main-5] rep 1: fps=21 p95=249.9 jank=12.1% busy=82.2% style=57.7% blocked=65.0s maxFreeze=1522 keyP95=679.3 keyMax=706 wheelP95=380 LoAF[renderSL=67s forcedSL=6.6s script=3.6s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1165 seenMarks=439 butter={"smootherFrames":333,"published":333} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4060,"visibleScrollers":1,"off":""}
```

### bench-restart-pr-5

Started 2026-11-11T19:46:15.258779+00:00; finished 2026-11-11T19:46:17.332058+00:00; exit 0; wall seconds 2.073.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
chromium: stopped
chromium: started (pid 2703907)
```

### bench-pr-5

Started 2026-11-11T19:46:17.332212+00:00; finished 2026-11-11T19:49:08.258661+00:00; exit 0; wall seconds 170.926.

```sh
node lab/harness/bench-live.mjs bench-pr-5 1
```

Working directory: `/home/simon/snap/chromium/common/rail-model-live-pr`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
19:46:22 [bench-pr-5] replaying 189 chunks over 122s, 1 reps
active Butter preflight {"ticks":9,"seen":5864,"visibleScrollers":1,"off":""}
19:49:08 [bench-pr-5] rep 1: fps=19.8 p95=250.1 jank=12.9% busy=83.4% style=59.3% blocked=67.4s maxFreeze=1507 keyP95=607.8 keyMax=627.4 wheelP95=372 LoAF[renderSL=69.5s forcedSL=6.9s script=3.9s] answer=21448c/420k/043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68 remounts=2 blockAdds=1164 seenMarks=443 butter={"smootherFrames":333,"published":333} nodes=194642 turns=9 chunks=189/189
active Butter preflight {"ticks":10,"seen":4063,"visibleScrollers":1,"off":""}
```

### bench-restore

Started 2026-11-11T19:49:08.260555+00:00; finished 2026-11-11T19:49:18.648467+00:00; exit 0; wall seconds 10.388.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-model-live
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
restore lab 1: restarting browser (now {"pid":2703907,"extensions":["/home/simon/snap/chromium/common/rail-model-live-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-model-live-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 2708448)
restored {"lab":1,"restarted":true,"url":"[private ChatGPT URL removed]","composer":"","pages":["[private ChatGPT URL removed]"],"browser":{"pid":2708448,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-11T19:49:17.978Z","ok":true}
```

### bench-release

Started 2026-11-11T19:49:18.648604+00:00; finished 2026-11-11T19:49:18.712562+00:00; exit 0; wall seconds 0.064.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-model-live
```

Working directory: `None`. Environment: `LAB_ID=<acquired lab>; CHAT=<approved math12 URL>; REC=<private frozen recording>` for replay; task-owned extension/flags for restart. CHAT is not passed to fixture harnesses.

Actual output (private values stripped):

```text
{"lab": 1, "lab_released": true, "perf_released": true}
```


## Exact replay adapter changes

`diff -u <archive>/lab/harness/bench.mjs <archive>/lab/harness/bench-live.mjs`: exit 1, as expected for differences. Both arms have the identical final adapter hash above.

```diff
--- /home/simon/snap/chromium/common/rail-model-live-main/lab/harness/bench.mjs	2026-11-11 11:58:14.000000000 -0500
+++ /home/simon/snap/chromium/common/rail-model-live-main/lab/harness/bench-live.mjs	2026-11-11 14:19:57.878843971 -0500
@@ -1,3 +1,4 @@
+import {prepareContext,checkPage,network,forceTheme} from './bench-live-safety.mjs';
 // Deterministic streaming benchmark: replay a recorded SSE answer into a long chat and measure jank.
 // Usage: node bench.mjs <variant> [reps=2]
 //   EXT=/abs/ext1,/abs/ext2   load unpacked extensions (restarts the lab browser)
@@ -31,22 +32,32 @@
   for (let i = 0; i < 60; i++) { try { await fetch('http://127.0.0.1:9222/json/version'); break; } catch { await sleep(500); } }
   await sleep(3000);
 }
+for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:9222/json/version');break}catch{await sleep(500)}}await sleep(3000);
 const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
-const ctx = browser.contexts()[0];
+const ctx = browser.contexts()[0]; await prepareContext(ctx);
 const page = ctx.pages().find(p => p.url().startsWith('https://chatgpt.com')) ?? ctx.pages()[0] ?? await ctx.newPage();
-await page.bringToFront();
+await page.bringToFront();await page.setViewportSize({width:1440,height:1000});await page.emulateMedia({colorScheme:'light'});
 const cdp = await ctx.newCDPSession(page);
-await cdp.send('Performance.enable');
+await cdp.send('Performance.enable');await cdp.send('Network.setBypassServiceWorker',{bypass:true});
 
 await page.addInitScript(R => {
   const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;
-  const st = window.__replay = { done: false, started: 0, chunksSent: 0 };
-  const of = window.fetch;
+  const st = window.__replay = { done: false, started: 0, chunksSent: 0, denied: [] };
+  const native = window.fetch;
+  const first = function(input,init){const m=(init?.method||input?.method||'GET').toUpperCase();if(!['GET','HEAD','OPTIONS'].includes(m))throw Error('FAIL CLOSED first stream guard');return native.apply(this,arguments);};
+  const of = function(input,init){const m=(init?.method||input?.method||'GET').toUpperCase();if(!['GET','HEAD','OPTIONS'].includes(m)){st.denied.push({method:m,path:new URL(typeof input==='string'?input:input.url,location.href).pathname});throw Error('FAIL CLOSED second stream guard');}return first.apply(this,arguments);};
   window.fetch = async function (input, init) {
     const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
     const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
+    const path=new URL(url,location.href).pathname;
+    // Local-only preparatory fixtures. Neither branch delegates a write to fetch.
+    if(method==='POST'&&['/backend-api/conversation/init','/backend-api/f/conversation/prepare','/backend-api/sentinel/chat-requirements/prepare'].includes(path)){
+      st.localPreparations=(st.localPreparations||0)+1;
+      const fixture=path.includes('sentinel')?{token:'local-replay-only',proofofwork:{required:false},turnstile:{required:false}}:{};
+      return new Response(JSON.stringify(fixture),{status:200,headers:{'content-type':'application/json'}});
+    }
     if (method === 'POST' && /\/backend-api\/f\/conversation(\?|$)/.test(url) && !st.started) {
-      const body = JSON.parse(init.body);
+      const body = JSON.parse(init.body);st.localInputId=body.messages[0].id;
       const map = new Map([[R.inputId, body.messages[0].id]]);
       const remap = txt => txt.replace(UUID, u => u === R.convId ? u : (map.has(u) ? map.get(u) : (map.set(u, crypto.randomUUID()), map.get(u))));
       st.started = performance.now();
@@ -69,9 +80,9 @@
 const INSTRUMENT = () => {
   window.__lab = {
     start() {
-      this.frames = []; this.loaf = []; this.keys = []; this.running = true;
+      this.frames = []; this.loaf = []; this.keys = [];this.inputDelays=[];this.frameTimes=[]; this.running = true;
       let last = performance.now();
-      const loop = t => { if (!this.running) return; this.frames.push(+(t - last).toFixed(2)); last = t; requestAnimationFrame(loop); };
+      const loop = t => { if (!this.running) return; this.frames.push(+(t - last).toFixed(2));this.frameTimes.push(t); last = t; requestAnimationFrame(loop); };
       requestAnimationFrame(loop);
       // attr: where long-frame time goes. renderSL = style+layout in the frame's rendering phase;
       // forced[k] = style+layout forced synchronously by script k; script[k] = script time of k.
@@ -90,7 +101,7 @@
         }
       } });
       this.po.observe({ type: 'long-animation-frame' });
-      this.onKey = e => { const t0 = e.timeStamp; requestAnimationFrame(() => setTimeout(() => this.keys.push(+(performance.now() - t0).toFixed(1)))); };
+      this.onKey = e => {if(!window.__idle&&(!window.__replay?.started||window.__replay.done))return;if(!/^[a-z]$/.test(e.key)&&e.key!=='Backspace')return;const t0=e.timeStamp;this.inputDelays.push(performance.now()-t0);requestAnimationFrame(()=>setTimeout(()=>this.keys.push(+(performance.now()-t0).toFixed(1))));};
       addEventListener('keydown', this.onKey, true);
       // Big subtree insertions/removals (remounts) inside the thread.
       this.remounts = []; const t0 = performance.now();
@@ -101,14 +112,14 @@
           if (!where && (r.addedNodes.length || r.removedNodes.length)) where = `${r.target.tagName}.${String(r.target.className).slice(0, 60)}|${r.target.closest?.('[data-turn-key]') ? 'in-turn' : 'outside'}`; }
         if (add + rem > 1500) this.remounts.push({ t: Math.round(performance.now() - t0), add, rem, where });
       });
-      this.mo.observe(document.querySelector('.thread-scroll-container') || document.body, { childList: true, subtree: true });
+      this.mo.observe([...document.querySelectorAll('.thread-scroll-container')].find(s=>s.clientHeight>0) || document.body, { childList: true, subtree: true });
       this.seenMarks = 0; this.blockAdds = 0;
       this.mo2 = new MutationObserver(recs => { for (const r of recs) {
         if (r.type === 'attributes') this.seenMarks++;
         else for (const n of r.addedNodes) if (n.nodeType === 1 && n.parentElement?.matches('[data-markdown-text-style="assistant-message"]')) this.blockAdds++; } });
-      this.mo2.observe(document.querySelector('.thread-scroll-container') || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-butter-seen'] });
+      this.mo2.observe([...document.querySelectorAll('.thread-scroll-container')].find(s=>s.clientHeight>0) || document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-butter-seen'] });
     },
-    stop() { this.running = false; this.po.disconnect(); removeEventListener('keydown', this.onKey, true); this.mo.disconnect(); this.mo2.disconnect(); return { seenMarks: this.seenMarks, blockAdds: this.blockAdds, frames: this.frames, loaf: this.loaf, keys: this.keys, attr: this.attr, remounts: this.remounts }; },
+    stop() { this.running = false; this.po.disconnect(); removeEventListener('keydown', this.onKey, true); this.mo.disconnect(); this.mo2.disconnect(); return { seenMarks: this.seenMarks, blockAdds: this.blockAdds, frameTimes:this.frameTimes,inputDelays:this.inputDelays,frames: this.frames, loaf: this.loaf, keys: this.keys, attr: this.attr, remounts: this.remounts }; },
   };
 };
 const CDP_KEYS = ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration', 'LayoutCount', 'RecalcStyleCount'];
@@ -131,11 +142,15 @@
 }
 
 async function runOnce(rep) {
-  await page.goto(CHAT); await page.locator('.ProseMirror').first().waitFor({ timeout: 60_000 }); await sleep(8000);
-  const sc = await page.evaluate(() => { const s = document.querySelector('.thread-scroll-container'); s.scrollTop = s.scrollHeight; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
+  await page.goto('about:blank');await page.goto(CHAT); await page.locator('.ProseMirror:visible').first().waitFor({ timeout: 60_000 }); await sleep(8000);await forceTheme(page);await checkPage(page);
+  const sc = await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s=>s.clientHeight>0); s.scrollTop = s.scrollHeight; const r = s.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
   await sleep(1500);
   const before = await page.evaluate(DOM);
-  await page.locator('.ProseMirror').first().click();
+  await page.locator('.ProseMirror:visible').first().click();
+  await page.evaluate(INSTRUMENT);await page.evaluate(()=>{window.__idle=true;window.__lab.start()});
+  await page.keyboard.type('abcdefghijklmnopqrstuvwxyzabcdefghijklmnopqrstuvwxyzab',{delay:80});await sleep(250);
+  const ir=await page.evaluate(()=>{window.__idle=false;return window.__lab.stop()});const idle={keyMax:Math.max(...ir.keys),keyP95:q(ir.keys,.95),inputDelayP95:q(ir.inputDelays,.95),keys:ir.keys.length};
+  await page.locator('.ProseMirror:visible').first().fill('');
   await page.keyboard.insertText(`[r${rep}] replay benchmark`);
   await page.evaluate(INSTRUMENT); await page.evaluate(() => window.__lab.start());
   const m0 = await metrics(); const t0 = Date.now();
@@ -156,7 +171,7 @@
     }
     // Type into the composer mid-stream, like drafting the next question.
     if (st.started && typed < 2 && el > (typed + 1) * total / 3) {
-      await page.locator('.ProseMirror').first().click({ timeout: 10_000 }).catch(() => {});
+      await page.locator('.ProseMirror:visible').first().click({ timeout: 10_000 }).catch(() => {});
       await page.keyboard.type('abcdefghij', { delay: 120 });
       for (let k = 0; k < 10; k++) await page.keyboard.press('Backspace');
       await page.mouse.move(sc.x, sc.y); typed++;
@@ -182,13 +197,13 @@
     const roots = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
     const txt = roots.at(-1)?.textContent ?? '';   // innerText drops content-visibility-skipped blocks
     const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
-    return { chars: txt.length, katex: roots.at(-1)?.querySelectorAll('.katex').length ?? 0, sha: [...new Uint8Array(buf)].slice(0, 6).map(b => b.toString(16).padStart(2, '0')).join('') };
+    return { chars: txt.length, katex: roots.at(-1)?.querySelectorAll('.katex').length ?? 0, sha: [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('') };
   });
   const wall = Date.now() - t0; const r = await page.evaluate(() => window.__lab.stop()); const m1 = await metrics();
   const d = Object.fromEntries(CDP_KEYS.map(k => [k, +(m1[k] - m0[k]).toFixed(3)]));
-  const f = r.frames.slice(1);
+  const replay=await page.evaluate(()=>window.__replay);r.loaf=r.loaf.filter(e=>e.t>=replay.started&&e.t<=replay.endedAt);const f=r.frames.filter((v,i)=>r.frameTimes[i]>=replay.started&&r.frameTimes[i]<=replay.endedAt);
   const res = {
-    variant, rep, wallMs: wall, answer, before, after: await page.evaluate(DOM), chunksSent: (await page.evaluate(() => window.__replay)).chunksSent, butter: await page.evaluate(() => window.__butterStats ?? null),
+    themeLight:await page.evaluate(()=>document.documentElement.getAttribute('data-theme')==='light'),idle,network,replayComplete:!!replay.done,keySamples:r.keys.length,inputDelayP95:q(r.inputDelays,.95),variant, rep, wallMs: wall, answer, before, after: await page.evaluate(DOM), chunksSent: (await page.evaluate(() => window.__replay)).chunksSent, butter: await page.evaluate(() => window.__butterStats ?? null),
     fps: +(f.length / (wall / 1000)).toFixed(1), p50: q(f, 0.5), p95: q(f, 0.95), maxFrame: Math.max(...f), jankPct: +(100 * f.filter(x => x > 50).length / f.length).toFixed(1),
     loafBlockMs: r.loaf.reduce((a, e) => a + e.block, 0), loafMaxMs: Math.max(0, ...r.loaf.map(e => e.dur)), loafCount: r.loaf.length,
     keyP50: q(r.keys, 0.5), keyP95: q(r.keys, 0.95), keyMax: Math.max(0, ...r.keys), wheelP95: q(wheelMs, 0.95),
@@ -203,9 +218,9 @@
   fs.writeFileSync(path.join(OUT, `rep-${rep}.json`), JSON.stringify(res, null, 1));
   await page.screenshot({ path: path.join(OUT, `rep-${rep}.png`) });
   log(`rep ${rep}: fps=${res.fps} p95=${res.p95} jank=${res.jankPct}% busy=${res.busyPct}% style=${res.stylePct}% blocked=${(res.loafBlockMs / 1000).toFixed(1)}s maxFreeze=${res.loafMaxMs} keyP95=${res.keyP95} keyMax=${res.keyMax} wheelP95=${res.wheelP95} LoAF[renderSL=${res.attr.renderSLs}s forcedSL=${res.attr.forcedSLs}s script=${res.attr.scripts}s] answer=${res.answer.chars}c/${res.answer.katex}k/${res.answer.sha} remounts=${res.remounts.length} blockAdds=${res.blockAdds} seenMarks=${res.seenMarks} butter=${JSON.stringify(res.butter)} nodes=${res.after.nodes} turns=${res.after.turns} chunks=${res.chunksSent}/${REPLAY.schedule.length}`);
-  return res;
+  if(!res.replayComplete||res.chunksSent!==REPLAY.schedule.length||res.answer.chars<1000||network.writes!==0)throw Error('INCOMPLETE_OR_UNSAFE_REPLAY');await checkPage(page);return res;
 }
 
 log(`replaying ${REPLAY.schedule.length} chunks over ${(REPLAY.schedule.at(-1)[0] / 1000).toFixed(0)}s, ${reps} reps`);
 for (let i = 1; i <= reps; i++) await runOnce(i);
-await browser.close();
+await page.locator('.ProseMirror:visible').first().fill('');await browser.close();
```

`bench-live-safety.mjs`, identical on both arms:

```js
import fs from 'node:fs';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
const data=JSON.parse(fs.readFileSync('/tmp/rail-model-live-work/raw/math-nine.json'));
const lab=L.getLab(Number(process.env.LAB_ID));const id=new URL(L.fixture(lab,'math12')).pathname.split('/').at(-1);
export const network={writes:0,blocked:0,fixtureReads:0};
export async function prepareContext(ctx){
 await L.sendGuard(ctx,lab);await ctx.routeWebSocket('**/*',ws=>ws.close());
 ctx.on('requestfinished',r=>{const u=new URL(r.url());if(!['GET','HEAD','OPTIONS'].includes(r.method())&&u.hostname.endsWith('chatgpt.com'))network.writes++;});
 await ctx.route('**/*',r=>{const q=r.request(),u=new URL(q.url());if(!['GET','HEAD','OPTIONS'].includes(q.method())&&u.hostname.endsWith('chatgpt.com'))network.blocked++;return r.fallback()});
 await ctx.route('**/backend-api/conversation/'+id+'**',r=>r.request().method()==='GET'?r.abort('blockedbyclient'):r.fallback());
 await ctx.route('**/backend-api/conversations/'+id+'**',r=>{if(r.request().method()!=='GET')return r.fallback();network.fixtureReads++;return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})});
 await ctx.addInitScript(ids=>{const allowed=new Set(ids);window.__fixtureUnexpected=[];new MutationObserver(rs=>{for(const r of rs)for(const n of r.addedNodes){if(n.nodeType!==1)continue;for(const e of [...(n.matches('[data-turn-key]')?[n]:[]),...n.querySelectorAll('[data-turn-key]')])if(!allowed.has(e.dataset.turnKey)&&e.dataset.turnKey!==window.__replay?.localInputId)window.__fixtureUnexpected.push(e.dataset.turnKey);}}).observe(document,{subtree:true,childList:true});},data.messages.filter(x=>x.author.role==='user').map(x=>x.id));
 const worker=ctx.serviceWorkers()[0]||await ctx.waitForEvent('serviceworker',{timeout:20000});
 await worker.evaluate(async()=>{await chrome.storage.local.clear();await chrome.storage.session.clear();await chrome.storage.local.set({butter:{enabled:true,layoutConsent:'granted',opts:{layout:true}}});});
}
export async function checkPage(page){const auth=await page.evaluate(async()=>{const r=await fetch('/api/auth/session');const d=await r.json();return !!d.accessToken});if(!auth)throw Error('EXPIRED_LOGIN: stop');await page.waitForFunction(()=>!!document.querySelector('chatgpt-butter-nav[data-on]')?.shadowRoot?.querySelector('.tick'),null,{timeout:15000});const facts=await page.evaluate(()=>({ticks:document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick').length,seen:document.querySelectorAll('[data-butter-seen]').length,visibleScrollers:[...document.querySelectorAll('.thread-scroll-container')].filter(s=>s.clientHeight>0).length,off:document.documentElement.getAttribute('data-butter-off')||''}));if(facts.off.includes('rail')||facts.off.includes('cv')||facts.visibleScrollers!==1)throw Error('INVALID_ACTIVE_BUTTER_PREFLIGHT');console.log('active Butter preflight',JSON.stringify(facts));const unexpected=await page.evaluate(()=>window.__fixtureUnexpected.length);if(unexpected)throw Error('NONFIXTURE_HISTORY: stop');}

export async function forceTheme(page){await page.evaluate(()=>{const e=document.documentElement;const pin=()=>{if(e.classList.contains('dark'))e.classList.remove('dark');if(!e.classList.contains('light'))e.classList.add('light');if(e.style.colorScheme!=='light')e.style.colorScheme='light';for(const a of ['data-theme','data-appearance-theme'])if(e.getAttribute(a)!=='light')e.setAttribute(a,'light');};pin();new MutationObserver(pin).observe(e,{attributes:true,attributeFilter:['class','data-theme','data-appearance-theme']});});}
```

Task-owned lab-wrapper.mjs:

```js
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs?real';
import fs from 'node:fs';
export * from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs?real';
const log = x => fs.appendFileSync('/tmp/rail-model-live-work/locks.jsonl',JSON.stringify({at:new Date().toISOString(),...x})+'\n');
export function acquire(id,opts={}) {log({action:'wait',fixture:opts.needsFixture});const lab=L.acquire(id,{...opts,owner:'rail-model-live',wait:1800,perf:true});log({action:'acquire',lab:lab.id});return lab;}
export function release(lab) {const r=L.release(lab);log({action:'release',lab:lab.id,...r});return r;}
export async function connect(lab) {
 const r=await L.connect(lab);await L.sendGuard(r.context,lab);
 const response=await r.context.request.get('https://chatgpt.com/api/auth/session');const auth=await response.json();
 if(!auth.accessToken){fs.writeFileSync('/tmp/rail-model-live-work/STOP','EXPIRED_LOGIN');await r.browser.close();throw Error('EXPIRED_LOGIN: stop');}
 return r;
}
```

Task-owned loader.mjs:

```js
export async function resolve(specifier,context,next) {
 if(specifier==='file:///home/simon/.local/share/chatgpt-lab/lib/lab.mjs')return {url:'file:///tmp/rail-model-live-work/lab-wrapper.mjs',shortCircuit:true};
 return next(specifier,context);
}
```

Task-owned guard.mjs:

```js
import {chromium} from '/home/simon/Dev/butter/node_modules/playwright/index.mjs';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs?real';
const connect=chromium.connectOverCDP.bind(chromium);
chromium.connectOverCDP=async (...args)=>{const b=await connect(...args);const lab=L.getLab(Number(process.env.LAB_ID||1));for(const c of b.contexts())await L.sendGuard(c,lab);const nc=b.newContext.bind(b);b.newContext=async (...a)=>{const c=await nc(...a);await L.sendGuard(c,lab);return c};return b;};
```

## Verification

`python3 export-report.py`: exported 10 valid replay samples, 4 live attempts and 6 nav attempts.

`python3 verify-final.py`: actual output:

```text
{"fiveOrMorePerBuild": 1, "firstOrderCorrect": 1, "secondOrderCorrect": 1, "oneFullAnswerHash": 1, "allReplayChunksComplete": 1, "noCompletedNetworkMutations": 1, "allStreamingKeysRecorded": 1, "allLightTheme": 1, "allIdleKeysRecorded": 1, "matrix-main-allChecks": 1, "matrix-main-cleanup": 1, "matrix-pr-allChecks": 1, "matrix-pr-cleanup": 1, "wash-main-allChecks": 1, "wash-main-cleanup": 1, "wash-pr-allChecks": 1, "wash-pr-cleanup": 1, "nav-earlier-main-1-expectedTimeout": 1, "nav-earlier-main-2-expectedTimeout": 1, "earlier-pr-14Passed": 1, "nav-takeovers-main-1-expectedTimeout": 1, "nav-takeovers-main-2-expectedTimeout": 1, "takeovers-pr-3Alpha6": 1, "takeovers-pr-12Current": 1, "nav-restoreOk": 1, "nav-releaseOk": 1, "bench-restoreOk": 1, "bench-releaseOk": 1, "sharedStatusUnchanged": 1, "sharedBranchMain": 1, "sharedHeadUnchanged": 1, "sharedTrackedDiffClean": 1, "main-extensionPristine": 1, "pr-extensionPristine": 1, "diffWhitespaceClean": 1, "allVerificationPassed": 1}
```

`python3 privacy.py`: actual final output is reproduced in `data/privacy-scan.json`. `git diff --check`: exit 0. The report-only change is tier 0 relative to the PR head; the parent PR’s code-review gate remains its owner’s responsibility.

## Publishing base

`git fetch origin && git switch -c rail-model-live-report origin/t3/rail-model`: exit 0. Actual output included `b4a0ac8..697307c t3/rail-model -> origin/t3/rail-model`, then switched to `rail-model-live-report` tracking that remote branch. The two new commits change the rail adapter/model, tests and docs. These later changes are outside the pinned live measurements.

## Other control and verification commands

- `kill -TERM 2626709`: exit 0, no output; cancelled only the queued initial benchmark acquire. The runner recorded exit -15 without taking a lock.
- `kill -STOP 2647456`: exit 0, no output; paused the invalid-pilot runner so it could not start another sample.
- `kill -TERM 2658627 2647456 && kill -CONT 2647456`: exit 0, no output; terminated the invalid PR pilot and its runner. The orchestration session returned 143. Explicit restore/release followed; both outputs are recorded above.
- `chmod 700` on the task working directory and both archive `results/` directories: exit 0, no output; raw captures remain local and owner-readable.
- The first `node -p` for Playwright was run in the worktree without linked dependencies and exited 1 (`MODULE_NOT_FOUND`). The absolute installed dependency path returned `1.65.0`.
- Byte comparison using `git archive <requested SHA> extension`: exit 0; `main extension files byte-identical to requested SHA: 59`; `pr extension files byte-identical to requested SHA: 62`.
- `git diff --check`: exit 0, no output. `python3 scripts/review-tier.py HEAD`: exit 0, `Review tier: 0`; every changed path is under `notes/runs/`.
- HTML chart preview initially rejected a fragment-only file; wrapping it as a complete document succeeded, 728 px wide, 725 px content height, zero console messages. This changed only the conversation chart wrapper outside the repository.

## Excluded PR pilot record recovered during final verification

Python read the already-written task-owned `results/bench/pilot-pr-1/rep-1.json` after the process was terminated. Exit 0; actual numeric output (no account/chat fields):

```json
{
  "valid": 0,
  "processCompleted": 0,
  "replayComplete": 1,
  "terminated": 1,
  "loafBlockMs": 86712,
  "loafMaxMs": 2811,
  "p95": 300,
  "keyMax": 4107.1,
  "keyP95": 2902.5,
  "inputDelayP95": 1225.5999999046326,
  "idle.keyMax": 557.8,
  "idle.keyP95": 29.5,
  "idle.inputDelayP95": 2,
  "networkWrites": 0,
  "chunksSent": 189
}
```

The replay had finished and its JSON/screenshot had been written before termination; final console logging/postflight had not completed. Both excluded pilots remain outside all acceptance medians.
