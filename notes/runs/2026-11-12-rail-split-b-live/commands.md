# Commands and actual output

Commands ran in the pinned build worktree named below, except lab controls and private task scripts. Logs are actual output with private URLs, identifiers and endpoints redacted. Branch stdout is projected to its measured public JSON fields; raw screenshots, page titles, chat-content hashes and other private fields are omitted. This file also records setup and verification commands.

## Preparation

Initial reads of the previous report in the stale shared checkout failed:

```text
cat: notes/runs/2026-11-12-rail-split-a-live/report.md: No such file or directory
cat: notes/runs/2026-11-12-rail-split-a-live/commands.md: No such file or directory
```

After git fetch origin, read both files through git show origin/main:<path>. Also read lab/README.md, the host lab README, notes/runs/README.md, the prior external runner/adapter and the pinned harness code. These reads do not mutate the browser.

```sh
git fetch origin
git worktree add --detach /home/simon/snap/chromium/common/rail-split-b-main 6215c420051b9e9b486339143f60335b7673d1b0
git worktree add --detach /home/simon/snap/chromium/common/rail-split-b-pr 9128a35c41e9045dfd60256f5692fad748af643c
```

```text
From https://github.com/SimianW/butter
   4e6c259..6215c42  main            -> origin/main
 * [new branch]      t3/split-rail-b -> origin/t3/split-rail-b
Preparing worktree (detached HEAD 6215c42)
HEAD is now at 6215c42 Merge pull request #95 from SimianW/t3/split-rail-a
Preparing worktree (detached HEAD 9128a35)
HEAD is now at 9128a35 rail: name the jump module after the glossary's Jump: rail/jump.js, ButterRailJump
```

```sh
python3 /tmp/rail-split-b-live-work/setup.py
python3 /tmp/rail-split-b-live-work/run.py
```

Setup printed: `Prepared fresh pinned worktrees, dependency links, private branch harness copies, lock/auth/convcheck adapter.` The runner stage exits and actual output follow. The loader only redirects the host lab import to an external adapter: owner/wait/perf overrides, auth check, before/after convcheck and lock logging. The after-check runs before browser disconnect, before matrix cleanup stops Chromium to restore its shortcuts. No tracked source file is patched.

## matrix-main

Started 2026-11-12T07:44:14.184023+00:00; finished 2026-11-12T07:49:11.619441+00:00; exit 0; 297.435 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-main.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-b-main/extension OUT=/tmp/rail-split-b-live-work/matrix-main TESTED_HEAD=6215c420051b9e9b486339143f60335b7673d1b0 LAB_FIXTURE=math12 MODE=matrix VERBOSE=1 RUN_NAME=matrix-main node --no-warnings --experimental-loader /tmp/rail-split-b-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck matrix-main-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1395,"scrollTop":535,"gutter":20,"y":646.910394265233}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (42 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":84,"p95FrameMs":16.7,"maxFrameMs":50,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (31 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":84,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.7,16.8]}
pass drag-bookmarked: 4/4 checks passed (28 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.landOff":25,"rail.targetTop":7,"rail.jump":6,"bookmark.locate":25},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":44,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (11 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":23,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":23},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (28 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.jumpTo":1,"rail.earlierJump":1,"rail.landOff":23,"rail.targetTop":5,"rail.jump":1,"bookmark.locate":23},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (30 s)
ok   reload resolves both bookmarks live without answer changed {"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}
pass resolve: 1/1 checks passed (3 s)
ok   card delete removes selection bookmark {"remaining":1}
ok   earlier bookmarks sit under dots and not a loaded tick (single) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 1-bookmark card (single) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}
ok   card delete removes both test bookmarks {"remaining":0,"marks":0}
pass delete: 4/4 checks passed (14 s)
ok   real fixture has a later top-level list item for distinct landing {"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}
ok   list item: the Bookmark cell is named Bookmark selection
ok   list item button saves its individual paragraph with ask and line {"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}
ok   list item jump lands on the item instead of the list start {"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}
ok   list item resolves live and lands on the same item after reload {"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}
ok   card delete removes list item test bookmark {"remaining":0,"marks":0}
pass list-item: 6/6 checks passed (83 s)

convcheck matrix-main-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
chromium: started (pid 3743588)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-b-live-work/matrix-main
35 checks passed
```

## wash-main

Started 2026-11-12T07:49:11.619761+00:00; finished 2026-11-12T07:51:20.312163+00:00; exit 0; 128.692 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-main.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-b-main/extension OUT=/tmp/rail-split-b-live-work/wash-main TESTED_HEAD=6215c420051b9e9b486339143f60335b7673d1b0 LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 RUN_NAME=wash-main node --no-warnings --experimental-loader /tmp/rail-split-b-live-work/loader.mjs lab/harness/bookmarks-live.mjs
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

convcheck wash-main-after {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
chromium: stopped
chromium: started (pid 3747089)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-b-live-work/wash-main
42 checks passed
```

## matrix-pr

Started 2026-11-12T07:51:20.312362+00:00; finished 2026-11-12T07:56:12.683801+00:00; exit 0; 292.371 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-pr.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-b-pr/extension OUT=/tmp/rail-split-b-live-work/matrix-pr TESTED_HEAD=9128a35c41e9045dfd60256f5692fad748af643c LAB_FIXTURE=math12 MODE=matrix VERBOSE=1 RUN_NAME=matrix-pr node --no-warnings --experimental-loader /tmp/rail-split-b-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck matrix-pr-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
INFO initial {"ticks":5,"marks":0,"more":true,"stale":0,"busy":0,"x":1589,"top":52,"height":860,"scrollHeight":1395,"scrollTop":535,"gutter":20,"y":646.910394265233}
INFO history {"before":{"ticks":5,"marks":0,"more":true,"stale":0,"busy":0},"after":{"ticks":16,"marks":0,"more":false,"stale":0,"busy":0}}
INFO structure [{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":1,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":347,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":408,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":246,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":314,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":319,"messageIds":0},{"assistant":0,"ids":0,"markdown":1,"paragraphs":264,"messageIds":0}]
ok   real long fixture loaded {"initialTicks":5,"totalTicks":16,"earlierPages":11}
pass load-fixture: 1/1 checks passed (41 s)
ok   held drag empty 1 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":85,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 2 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag empty 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
pass drag-empty: 3/3 checks passed (31 s)
ok   live selection message ids match conversation API by SHA-256 {"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}
pass message-ids: 1/1 checks passed (0 s)
ok   the Bookmark cell is named Bookmark selection
ok   paragraph button saves one bookmark {"stored":1,"marks":1}
pass bookmark-paragraph: 2/2 checks passed (4 s)
ok   selection saved through real Alt+Shift+M {"stored":2,"selectionCharacters":30,"commands":1,"marks":1}
pass bookmark-selection: 1/1 checks passed (3 s)
ok   held drag bookmarked 1 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 2 {"mounts":0,"additions":0,"held":true,"updates":33,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":132,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   held drag bookmarked 3 {"mounts":0,"additions":0,"held":true,"updates":32,"frames":86,"p95FrameMs":16.8,"maxFrameMs":16.8,"bookmarkCoverageScripts":2,"bookmarkFunctionCalls":128,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}
ok   matched drag comparison with bookmarks versus empty {"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.8,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.7,16.8]}
pass drag-bookmarked: 4/4 checks passed (28 s)
INFO jump after-drag {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true}],"seekStates":[],"calls":{"rail.landOff":26,"rail.targetTop":7,"rail.jump":6,"rail.jumpTo":1,"bookmark.locate":26},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   selection card jump after drag lands on text {"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}
pass jump-after-drag: 1/1 checks passed (5 s)
INFO jump during-drag {"clicks":[{"control":"mark","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"mark","trusted":true}],"seekStates":[{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":true,"pointerHeld":true},{"state":"dragging","targetEqualsBookmarkedQuestion":false,"pointerHeld":true},{"state":"loading","targetEqualsBookmarkedQuestion":false,"pointerHeld":false},{"state":"idle","targetEqualsBookmarkedQuestion":false,"pointerHeld":false}],"calls":{"rail.landOff":44,"rail.targetTop":9,"rail.jump":6},"paragraph":{"top":669,"bottom":721,"x":736,"y":733,"height":52,"inView":true},"selection":{"top":7608.703125,"bottom":7660.921875,"x":736,"y":7672.703125,"height":52.21875,"inView":false}}
ok   paragraph jump requested during native drag lands on text {"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":669}
pass jump-during-drag: 1/1 checks passed (11 s)
ok   reload before row click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}
ok   earlier bookmarks sit under dots and not a loaded tick (row) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (row) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-row {"clicks":[{"control":"go","trusted":true,"detail":1}],"keys":[],"seekStates":[],"calls":{"rail.landOff":19,"rail.targetTop":5,"rail.jump":1,"rail.jumpTo":1,"rail.earlierJump":1,"bookmark.locate":19},"paragraph":{"top":-6878,"bottom":-6826,"x":736,"y":-6814,"height":52,"inView":false},"selection":{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}}
ok   row click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after row click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-row: 5/5 checks passed (27 s)
ok   reload before keyboard click leaves earlier answer unloaded {"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}
ok   earlier bookmarks sit under dots and not a loaded tick (keyboard) {"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"gapLeftOfDotsPx":4,"offsetBelowDotsPx":0,"widthPx":4,"heightPx":4,"butterColor":true}
ok   hover earlier segment shows 2-bookmark card (keyboard) {"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}
INFO jump unloaded-keyboard {"clicks":[{"control":"go","trusted":true,"detail":0}],"keys":[{"key":"ArrowLeft","control":"mark","trusted":true},{"key":"Enter","control":"other","trusted":true}],"seekStates":[],"calls":{"rail.landOff":19,"rail.targetTop":5,"rail.jump":1,"rail.jumpTo":1,"rail.earlierJump":1,"bookmark.locate":19},"paragraph":{"top":64,"bottom":116,"x":736,"y":128,"height":52,"inView":true},"selection":{"top":7003.703125,"bottom":7055.921875,"x":736,"y":7067.703125,"height":52.21875,"inView":false}}
ok   keyboard click loads earlier pages and lands on requested text {"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}
ok   segment moves from dots to loaded question after keyboard click {"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"gapLeftOfDotsPx":null,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}
pass unloaded-keyboard: 5/5 checks passed (30 s)
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
pass list-item: 6/6 checks passed (83 s)

convcheck matrix-pr-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
chromium: started (pid 3754407)
INFO lab restored {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-b-live-work/matrix-pr
35 checks passed
```

## wash-pr

Started 2026-11-12T07:56:12.684083+00:00; finished 2026-11-12T07:58:24.334861+00:00; exit 0; 131.651 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-pr.

```sh
env EXT=/home/simon/snap/chromium/common/rail-split-b-pr/extension OUT=/tmp/rail-split-b-live-work/wash-pr TESTED_HEAD=9128a35c41e9045dfd60256f5692fad748af643c LAB_FIXTURE=demo-en12 MODE=wash VERBOSE=1 RUN_NAME=wash-pr node --no-warnings --experimental-loader /tmp/rail-split-b-live-work/loader.mjs lab/harness/bookmarks-live.mjs
```

```text
INFO acquired fixture lab and perf lock {}
convcheck wash-pr-before {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
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
pass wash-theme-dark: 2/2 checks passed (23 s)
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

convcheck wash-pr-after {"status":200,"users":12,"userTurnsSha256":"96a1611df0b8e38e4403062fdc23ebd56e3985e0616d151fb40a2879e2b6aa2a"}
chromium: stopped
chromium: started (pid 3758480)
INFO lab restored {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true}
INFO lab and perf locks released {}
cleanup {"remainingBeforeFallback":3,"remainingAfterFallback":0,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in /tmp/rail-split-b-live-work/wash-pr
42 checks passed
```

## live-acquire

Started 2026-11-12T07:58:24.335035+00:00; finished 2026-11-12T07:58:24.399061+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-b-live --wait 1800 --needs-fixture math12
```

```text
1
```

## live-restart-main

Started 2026-11-12T07:58:24.399283+00:00; finished 2026-11-12T07:58:26.469428+00:00; exit 0; 2.07 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-b-main/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3759019)
```

## branch-main-before

Started 2026-11-12T07:58:28.469691+00:00; finished 2026-11-12T07:58:30.086270+00:00; exit 0; 1.617 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch-main-before
```

```text
convcheck branch-main-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## branch-live-main

Started 2026-11-12T07:58:30.086415+00:00; finished 2026-11-12T07:59:02.584318+00:00; exit 1; 32.498 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-main.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension 'BRANCH_PATH=^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-b-live-work/branch-main node lab/harness/branch-live-task.mjs
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
          269,
          269
        ],
        "scroll": [
          498,
          498
        ]
      },
      "sendClicks": [
        {
          "inBranch": true,
          "ms": 7636
        }
      ],
      "originalSendRequests": [],
      "afterSendClick": [
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/sentinel/chat-requirements/prepare",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 7962
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/codex/notification/subscriptions",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9597
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/telemetry/intake",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9702
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11249
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11255
        }
      ],
      "distinctBranch": true,
      "branchIdentityKind": "local",
      "latestReplyMatchesOriginal": true
    }
  ],
  "exit": 1,
  "selectionPillTimeout": true
}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible

    at /home/simon/snap/chromium/common/rail-split-b-main/lab/harness/branch-live-task.mjs:215:39 {
  log: [
    `  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible`
  ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

## branch-main-after

Started 2026-11-12T07:59:02.584490+00:00; finished 2026-11-12T07:59:03.701649+00:00; exit 0; 1.117 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch-main-after
```

```text
convcheck branch-main-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## live-restart-pr

Started 2026-11-12T07:59:03.701798+00:00; finished 2026-11-12T07:59:05.772678+00:00; exit 0; 2.071 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-b-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3760217)
```

## branch-pr-before

Started 2026-11-12T07:59:07.772940+00:00; finished 2026-11-12T07:59:09.289560+00:00; exit 0; 1.517 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch-pr-before
```

```text
convcheck branch-pr-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## branch-live-pr

Started 2026-11-12T07:59:09.289707+00:00; finished 2026-11-12T07:59:42.236347+00:00; exit 1; 32.947 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-pr.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension 'BRANCH_PATH=^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-b-live-work/branch-pr node lab/harness/branch-live-task.mjs
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
          269,
          269
        ],
        "scroll": [
          498,
          498
        ]
      },
      "sendClicks": [
        {
          "inBranch": true,
          "ms": 7748
        }
      ],
      "originalSendRequests": [],
      "afterSendClick": [
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/sentinel/chat-requirements/prepare",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 8078
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/telemetry/intake",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 9819
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/backend-api/codex/notification/subscriptions",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 10282
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11345
        },
        {
          "tab": "branch",
          "method": "POST",
          "path": "/ces/v1/rgstr",
          "blocked": "net::ERR_BLOCKED_BY_CLIENT.Inspector",
          "ms": 11347
        }
      ],
      "distinctBranch": true,
      "branchIdentityKind": "local",
      "latestReplyMatchesOriginal": true
    }
  ],
  "exit": 1,
  "selectionPillTimeout": true
}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible

    at /home/simon/snap/chromium/common/rail-split-b-pr/lab/harness/branch-live-task.mjs:215:39 {
  log: [
    `  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible`
  ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

## branch-pr-after

Started 2026-11-12T07:59:42.236495+00:00; finished 2026-11-12T07:59:43.603587+00:00; exit 0; 1.367 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch-pr-after
```

```text
convcheck branch-pr-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## live-restore

Started 2026-11-12T07:59:43.603713+00:00; finished 2026-11-12T07:59:53.841481+00:00; exit 0; 10.238 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-b-live
```

```text
restore lab 1: restarting browser (now {"pid":3760217,"extensions":["/home/simon/snap/chromium/common/rail-split-b-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3761366)
restored {"lab":1,"restarted":true,"url":"<private-chat-url>","composer":"","pages":["<private-chat-url>"],"browser":{"pid":3761366,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T07:59:53.197Z","ok":true}
```

## live-release

Started 2026-11-12T07:59:53.841649+00:00; finished 2026-11-12T07:59:53.905615+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-b-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": false}
```

## final-lock-status

Started 2026-11-12T07:59:53.905742+00:00; finished 2026-11-12T07:59:53.969639+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock status
```

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## retry-acquire

Started 2026-11-12T08:00:43.504633+00:00; finished 2026-11-12T08:00:43.568483+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner rail-split-b-live --wait 1800 --needs-fixture math12
```

```text
1
```

## retry-restart-main

Started 2026-11-12T08:00:43.568750+00:00; finished 2026-11-12T08:00:45.641333+00:00; exit 0; 2.073 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-b-main/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3763371)
```

## branch800-main-before

Started 2026-11-12T08:00:47.641571+00:00; finished 2026-11-12T08:00:49.158294+00:00; exit 0; 1.517 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch800-main-before
```

```text
convcheck branch800-main-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## branch800-live-main

Started 2026-11-12T08:00:49.158446+00:00; finished 2026-11-12T08:01:01.707554+00:00; exit 1; 12.549 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-main.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension 'BRANCH_PATH=^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-b-live-work/branch800-main node lab/harness/branch-live-800-task.mjs
```

Actual result projected to public measured fields; any public harness error is retained below (full private stdout omitted):

```text
{
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "runs": [],
  "exit": 1,
  "selectionPillTimeout": true
}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible

    at /home/simon/snap/chromium/common/rail-split-b-main/lab/harness/branch-live-800-task.mjs:215:39 {
  log: [
    `  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible`
  ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

## branch800-main-after

Started 2026-11-12T08:01:01.707699+00:00; finished 2026-11-12T08:01:02.974243+00:00; exit 0; 1.267 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-main/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch800-main-after
```

```text
convcheck branch800-main-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## retry-restart-pr

Started 2026-11-12T08:01:02.974411+00:00; finished 2026-11-12T08:01:05.047804+00:00; exit 0; 2.073 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension LAB_EXTENSIONS=/home/simon/snap/chromium/common/rail-split-b-pr/extension /home/simon/.local/share/chatgpt-lab/bin/lab restart-browser
```

```text
chromium: stopped
chromium: started (pid 3764106)
```

## branch800-pr-before

Started 2026-11-12T08:01:07.048108+00:00; finished 2026-11-12T08:01:08.364226+00:00; exit 0; 1.316 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch800-pr-before
```

```text
convcheck branch800-pr-before {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## branch800-live-pr

Started 2026-11-12T08:01:08.364375+00:00; finished 2026-11-12T08:01:20.963136+00:00; exit 1; 12.599 s.

Working directory: /home/simon/snap/chromium/common/rail-split-b-pr.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension 'BRANCH_PATH=^/backend-api/conversation/new_branch$' OUT_JSON=live.json BRANCH_OUT=/tmp/rail-split-b-live-work/branch800-pr node lab/harness/branch-live-800-task.mjs
```

Actual result projected to public measured fields; any public harness error is retained below (full private stdout omitted):

```text
{
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "runs": [],
  "exit": 1,
  "selectionPillTimeout": true
}
node:internal/modules/run_main:107
    triggerUncaughtException(
    ^

locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible

    at /home/simon/snap/chromium/common/rail-split-b-pr/lab/harness/branch-live-800-task.mjs:215:39 {
  log: [
    `  - waiting for locator('chatgpt-butter-pill button[data-cell="branch"]') to be visible`
  ],
  name: 'TimeoutError'
}

Node.js v24.17.0
```

## branch800-pr-after

Started 2026-11-12T08:01:20.963274+00:00; finished 2026-11-12T08:01:22.331608+00:00; exit 0; 1.368 s.

Working directory: None.

```sh
env LAB_ID=1 LAB_OWNER=rail-split-b-live LAB_FLAGS=--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension node /tmp/rail-split-b-live-work/convcheck.mjs branch800-pr-after
```

```text
convcheck branch800-pr-after {"status":200,"users":16,"userTurnsSha256":"fd033a734d9085e1e9242eb1ac19b5df7a0425ecb5692eb450fc195b0c9e2470"}
```

## retry-restore

Started 2026-11-12T08:01:22.331730+00:00; finished 2026-11-12T08:01:33.419399+00:00; exit 0; 11.088 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner rail-split-b-live
```

```text
restore lab 1: restarting browser (now {"pid":3764106,"extensions":["/home/simon/snap/chromium/common/rail-split-b-pr/extension"],"flags":["--disable-extensions-except=/home/simon/snap/chromium/common/rail-split-b-pr/extension"]}, cdp up, want {"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]})
chromium: stopped
chromium: started (pid 3764833)
restored {"lab":1,"restarted":true,"url":"<private-chat-url>","composer":"","pages":["<private-chat-url>"],"browser":{"pid":3764833,"extensions":["/home/simon/snap/chromium/common/butter-blank-head"],"flags":[]},"at":"2026-11-12T08:01:33.355Z","ok":true}
```

## retry-release

Started 2026-11-12T08:01:33.419525+00:00; finished 2026-11-12T08:01:33.483441+00:00; exit 0; 0.064 s.

Working directory: None.

```sh
/home/simon/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner rail-split-b-live
```

```text
{"lab": 1, "lab_released": true, "perf_released": false}
```

## final-lock-status-retry

Started 2026-11-12T08:01:33.483567+00:00; finished 2026-11-12T08:01:33.547700+00:00; exit 0; 0.064 s.

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

The bookmarks adapter invokes the same lab-lock CLI as the library. Each uses `lab-lock acquire --lab auto --owner rail-split-b-live --wait 1800 --perf --needs-fixture <fixture>`, followed by restore before release. Actual adapter lock records:

```json
{"at":"2026-11-12T07:44:14.290Z","action":"wait","fixture":"math12"}
{"at":"2026-11-12T07:44:14.341Z","action":"acquire","lab":1}
{"at":"2026-11-12T07:49:11.576Z","action":"release","lab":1,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T07:49:11.732Z","action":"wait","fixture":"demo-en12"}
{"at":"2026-11-12T07:49:11.784Z","action":"acquire","lab":2}
{"at":"2026-11-12T07:51:20.264Z","action":"release","lab":2,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T07:51:20.426Z","action":"wait","fixture":"math12"}
{"at":"2026-11-12T07:51:20.481Z","action":"acquire","lab":1}
{"at":"2026-11-12T07:56:12.621Z","action":"release","lab":1,"lab_released":true,"perf_released":true}
{"at":"2026-11-12T07:56:12.798Z","action":"wait","fixture":"demo-en12"}
{"at":"2026-11-12T07:56:12.853Z","action":"acquire","lab":2}
{"at":"2026-11-12T07:58:24.282Z","action":"release","lab":2,"lab_released":true,"perf_released":true}
```

## Pinned extension verification

```sh
python3 /tmp/rail-split-b-live-work/verify-builds.py
```

```json
{
  "main": {
    "pinnedHead": "6215c420051b9e9b486339143f60335b7673d1b0",
    "extensionFiles": 65,
    "mismatches": 0,
    "trackedChanges": []
  },
  "pr": {
    "pinnedHead": "9128a35c41e9045dfd60256f5692fad748af643c",
    "extensionFiles": 66,
    "mismatches": 0,
    "trackedChanges": []
  }
}
```

## External adapter fingerprints

The loader/adapter and runner are private task files, not tracked source edits. SHA-256 fingerprints:

```json
{
  "loader.mjs": "919260f1266f0368ccfc5ae7e378838f0f88478a926052c5463a5cb5d33f4e53",
  "lab-wrapper.mjs": "28d31c51d3e931e22f8f52657516644c67684112a5dd75fe94e0a09a1694cfc0",
  "convcheck-lib.mjs": "d1065f16b26ffb63a39c4efe9cfea72621962484093ae8d20e53ef8ce2842a2b",
  "run.py": "60426c6170b988fadeffe24899b68584e3d6f09f98796e70f92845f83a158f8b"
}
```

## Publication worktree

```sh
git fetch origin
git rev-parse origin/t3/split-rail-b
git worktree add -b t3/split-rail-b /tmp/rail-split-b-live-report origin/t3/split-rail-b
```

The fetch exited 0 with no output. Actual remaining output:

```text
9128a35c41e9045dfd60256f5692fad748af643c
Preparing worktree (new branch 't3/split-rail-b')
branch 't3/split-rail-b' set up to track 'origin/t3/split-rail-b'.
HEAD is now at 9128a35 rail: name the jump module after the glossary's Jump: rail/jump.js, ButterRailJump
```

## Report validation

```sh
python3 /tmp/rail-split-b-live-work/export.py
python3 /tmp/rail-split-b-live-work/verify-report.py
```

Actual output:

```text
Exported sanitized report, command transcript and numeric JSON to /tmp/rail-split-b-live-work/publish/notes/runs/2026-11-12-rail-split-b-live
PASS: matrix 35/35 per build; ordered checks and cleanup identical.
PASS: wash 42/42 per build; ordered checks and cleanup identical.
PASS: 1280 px branch ready and pill fields match; original tabs unchanged, sends guarded. Shared 800 px timeout retained for both initial and isolated attempts.
PASS: all eight before/after server user-turn sets unchanged (16 HTTP 200 checks).
PASS: public JSON parses; privacy scan zero matches (2 private titles/content fingerprints and four identifier/endpoint patterns).
PASS: report folder contains only Markdown and JSON; raw screenshots and captures excluded.
```

## Staged scope and whitespace

```sh
git add -- notes/runs/2026-11-12-rail-split-b-live
git diff --cached --check
python3 scripts/review-tier.py 9128a35c41e9045dfd60256f5692fad748af643c
```

The whitespace check exited 0 with no output. The staged name list contains only the requested report folder (11 files). Actual tier output for this report-only delta:

```text
Review tier: 0
notes/runs/2026-11-12-rail-split-b-live/commands.md (Markdown)
notes/runs/2026-11-12-rail-split-b-live/data/branch-attempts.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/branch-live-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/branch-live-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/build-check.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/matrix-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/matrix-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/server-checks.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/wash-main.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/data/wash-pr.json (docs or assets)
notes/runs/2026-11-12-rail-split-b-live/report.md (Markdown)
```
