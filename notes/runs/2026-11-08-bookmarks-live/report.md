# #57 bookmarks live lab, fourth run — 2026-11-08

**PASS: 35/35 live checks passed.** No product bug was found in this matrix.
This rerun covers the review fixes on integration commit `88dd6d5`, including a real top-level
list item, its distinct jump destination, and live resolution after reload. `extension/` was not changed.

Earlier run 1 failed because live answers lacked the assistant-role/message-ID markup bookmark creation required.
Earlier run 2 failed because an unloaded earlier bookmark was grouped under a loaded-tail question, so clicking it fetched no history.
Earlier run 3's exploratory attempt stopped because a locator click required a hit target that the pointer-events-none segment intentionally does not own; the corrected full run passed 29/29.
This run's exploratory attempt passed the original 29 checks, then stopped because its target filter required a list item longer than 40 characters and more than 180 px from the list start; the final harness selects the furthest nonempty item and requires more than 24 px separation with an 8 px landing tolerance.

## Build and method

Branch `t3/57-bookmark-lab-4`; tested source HEAD `88dd6d532218995ec32b7be1dc2cf6108a098b4b` plus this commit's harness changes.
Manifest `0.1.0-alpha.16`; Linux Chromium `156.0.8078.47`.
This worktree's extension was copied byte-for-byte into a fresh, Snap-readable unpacked install;
source and copied extension SHA-256 both `fe1113990663beb0d51acfadeeb2b5122309cdf78628cd436bd2232f81028163`.
Run UTC: `2026-11-09T02:35:14.456Z` to `2026-11-09T02:40:03.302Z`; the directory date follows the assigned report path.

The named `math12` long-chat fixture ran under both the lab lock and machine-wide perf lock.
Send guard on; layout consent declined; no composer input, new prompts or server-side writes.
This is the assigned live behavior/geometry matrix on Linux, not an exhaustive visual or
cross-platform qualification. No screenshot or raw fixture capture is retained.

## Harness changes

- Paragraph ordinals use the same block rule as `extension/bookmarks/content.js`: every direct
  child other than `ul`/`ol`, plus each direct `li` of a top-level list, in document order.
  Target choice, geometry, selection and reload matching all use this rule.
- Hover checks require a visible tooltip exactly `Bookmark` and a nonempty accessible name
  starting `Bookmark: `. No accessible name containing private text is written to the report.
- Reload matching also checks that both records carry the correct hashed question in `ask`
  and a positive first-line length in `line` bounded by the excerpt.
- A separate list-item sequence runs after the original two bookmarks are deleted. It selects a
  later item more than 24 px below its top-level list's start, bookmarks that item alone, verifies
  its individual ordinal, `ask` and `line`, jumps to it, reloads and jumps again, checks original
  message/excerpt equality and the live card, then deletes it through the card.
  Landing must put the item within 8 px of the expected 64 px offset; landing at the list start
  cannot meet this condition for the chosen item.

## Results, one row per live check

All evidence cells contain only public labels, counts, booleans, ordinals and geometry.

| # | Check | Result | Numeric/public evidence |
|---|---|---|---|
| 1 | real long fixture loaded | PASS | `{"initialTicks":5,"totalTicks":16,"earlierPages":11}` |
| 2 | held drag empty 1 | PASS | `{"mounts":0,"additions":0,"held":true,"updates":30,"frames":85,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}` |
| 3 | held drag empty 2 | PASS | `{"mounts":0,"additions":0,"held":true,"updates":30,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}` |
| 4 | held drag empty 3 | PASS | `{"mounts":0,"additions":0,"held":true,"updates":31,"frames":87,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}` |
| 5 | live selection message ids match conversation API by SHA-256 | PASS | `{"checked":10,"matched":10,"targetMatched":true,"apiPages":13,"assistantApiMessages":41}` |
| 6 | hover button tooltip reads Bookmark | PASS | `{"labelStartsBookmark":true,"labelHasText":true,"tooltipIsBookmark":true,"tooltipVisible":true}` |
| 7 | paragraph button saves one bookmark | PASS | `{"stored":1,"marks":1}` |
| 8 | selection saved through real Alt+Shift+M | PASS | `{"stored":2,"selectionCharacters":30,"commands":1,"marks":1}` |
| 9 | held drag bookmarked 1 | PASS | `{"mounts":0,"additions":0,"held":true,"updates":30,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}` |
| 10 | held drag bookmarked 2 | PASS | `{"mounts":0,"additions":0,"held":true,"updates":30,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":60,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}` |
| 11 | held drag bookmarked 3 | PASS | `{"mounts":0,"additions":0,"held":true,"updates":31,"frames":86,"p95FrameMs":16.7,"maxFrameMs":16.8,"bookmarkCoverageScripts":1,"bookmarkFunctionCalls":62,"bookmarkWork":{"refresh":0,"paragraphs":0,"measure":0,"selection":0,"topBlock":0,"locate":0,"create":0,"remove":0,"show":0,"place":0},"storage":{"reads":0,"messages":0}}` |
| 12 | matched drag comparison with bookmarks versus empty | PASS | `{"emptyRuns":3,"bookmarkedRuns":3,"emptyP95FrameMs":[16.7,16.7,16.7],"bookmarkedP95FrameMs":[16.7,16.7,16.7]}` |
| 13 | selection card jump after drag lands on text | PASS | `{"top":61.703125,"bottom":113.921875,"x":736,"y":125.703125,"height":52.21875,"inView":true}` |
| 14 | paragraph jump requested during native drag lands on text | PASS | `{"heldBefore":true,"heldAfterActivation":true,"visibleWhileHeld":false,"visibleAfterRelease":true,"textTopAfterRelease":64}` |
| 15 | reload before row click leaves earlier answer unloaded | PASS | `{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":11}` |
| 16 | earlier bookmarks sit under dots and not a loaded tick (row) | PASS | `{"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}` |
| 17 | hover earlier segment shows 2-bookmark card (row) | PASS | `{"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}` |
| 18 | row click loads earlier pages and lands on requested text | PASS | `{"earlierPages":5,"targetMounted":true,"inView":true,"textTop":61.703125,"sawLoadingMeta":true,"sawSpinner":true,"sawBusyDots":true}` |
| 19 | segment moves from dots to loaded question after row click | PASS | `{"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}` |
| 20 | reload before segment click leaves earlier answer unloaded | PASS | `{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"stored":2,"targetMounted":false,"earlierPagesBefore":16}` |
| 21 | earlier bookmarks sit under dots and not a loaded tick (segment) | PASS | `{"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}` |
| 22 | hover earlier segment shows 2-bookmark card (segment) | PASS | `{"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":2,"staleRows":0,"singleExplanation":false}` |
| 23 | segment click loads earlier pages and lands on requested text | PASS | `{"earlierPages":5,"targetMounted":true,"inView":true,"textTop":64,"sawLoadingMeta":false,"sawSpinner":false,"sawBusyDots":true}` |
| 24 | segment moves from dots to loaded question after segment click | PASS | `{"marks":1,"earlierMarks":0,"loadedMarks":1,"moreVisible":true,"offsetBelowDotsPx":null,"widthPx":null,"heightPx":null,"butterColor":false}` |
| 25 | reload resolves both bookmarks live without answer changed | PASS | `{"marks":1,"staleMarks":0,"cardRows":2,"staleRows":0,"targetMounted":true,"records":2,"matchingMessagesAndExcerpts":2,"matchingQuestions":2,"validFirstLines":2}` |
| 26 | card delete removes selection bookmark | PASS | `{"remaining":1}` |
| 27 | earlier bookmarks sit under dots and not a loaded tick (single) | PASS | `{"marks":1,"earlierMarks":1,"loadedMarks":0,"moreVisible":true,"offsetBelowDotsPx":5,"widthPx":8,"heightPx":2,"butterColor":true}` |
| 28 | hover earlier segment shows 1-bookmark card (single) | PASS | `{"shown":true,"correctMeta":true,"correctAccessibleName":true,"rows":1,"staleRows":0,"singleExplanation":true}` |
| 29 | card delete removes both test bookmarks | PASS | `{"remaining":0,"marks":0}` |
| 30 | real fixture has a later top-level list item for distinct landing | PASS | `{"lists":20,"items":56,"maxMeasuredOffset":78.65625,"targetFound":true,"paragraph":29}` |
| 31 | list item tooltip and accessible name match | PASS | `{"labelStartsBookmark":true,"labelHasText":true,"tooltipIsBookmark":true,"tooltipVisible":true}` |
| 32 | list item button saves its individual paragraph with ask and line | PASS | `{"stored":1,"matchingParagraph":true,"matchingQuestion":true,"validFirstLine":true,"top":160.34375,"bottom":186.5625,"x":762,"y":224.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":81.6875,"landsOnItem":false}` |
| 33 | list item jump lands on the item instead of the list start | PASS | `{"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true}` |
| 34 | list item resolves live and lands on the same item after reload | PASS | `{"cold":{"ticks":5,"marks":1,"more":true,"stale":0,"busy":0,"targetMounted":false},"top":64.34375,"bottom":90.5625,"x":762,"y":128.34375,"height":26.21875,"inView":true,"isListItem":true,"itemOrdinal":3,"offsetFromListStart":78.65625,"listTop":-14.3125,"landsOnItem":true,"matchingMessageAndExcerpt":true,"staleMarks":0,"staleRows":0}` |
| 35 | card delete removes list item test bookmark | PASS | `{"remaining":0,"marks":0}` |

## Reproduction and findings

1. Load earlier history through the rail's dots, then save one paragraph with its hover button
   and a different paragraph in the same answer through a 30-character selection and real
   Alt+Shift+M. Both bookmarks are attached to one question segment.
2. Exercise three native scrollbar holds before and three after creating bookmarks. Jump from
   the selection row after a drag, then activate the paragraph segment while a native thumb is
   held and confirm the paragraph lands after release.
3. Reopen the fixture separately for the row and segment paths. Each starts with the bookmarked
   answer unloaded and the segment under the earlier-history dots. A trusted pointer click on
   the row loads its selection; a real pointer click at the segment centre loads its oldest
   bookmark. Each destination is different, and the segment moves to its loaded question.
4. Verify both original records resolve live, including matching `ask` and valid `line`. Delete
   the selection; reopen to check the single earlier-history card, then delete the paragraph.
5. Find a real answer's top-level list, bookmark a later item alone, move away and jump through
   its card. Reopen the fixture and jump again. The item's message/excerpt must still match,
   with no stale mark or stale card; delete the final bookmark through the card.

The summary retains trusted-input/function-call counts for the original jump paths and numeric
list-item placement for the new path. Raw IDs, excerpts and private-ID hashes stay in memory.
A direct segment click puts the hover card away; busy dots remain visible during loading.
The row path observes the loading meta line and spinner as well.

## Held-drag measurements

| Arm | Run | Seek updates | Frames | Turn mounts | Added elements | Storage reads | Bookmark requests | Frame p95 ms | Frame max ms |
|---|---|---|---|---|---|---|---|---|---|
| empty | 1 | 30 | 85 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| empty | 2 | 30 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| empty | 3 | 31 | 87 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| bookmarked | 1 | 30 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| bookmarked | 2 | 30 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| bookmarked | 3 | 31 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |

A thread-subtree MutationObserver counts element additions and turn mounts. Worker probes count
IndexedDB/index reads and local-settings reads; a runtime listener counts bookmark messages,
including those now sent through `bookmarks/client.js`. Precise content-script coverage measures
`refresh`, `paragraphs`, `measure`, `selection`, `topBlock`, `locate`, `create`, `remove`, `show`
and `place` during each hold. The measured interval excludes initial press/seek and release.
Three repetitions per arm do not establish a precise timing difference or cross-platform result.

## Privacy and cleanup

Send guard observed **0 send attempts** and blocked
195 unrelated non-read ChatGPT requests.
Cleanup: `{"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}`.
The unique unpacked extension copy was removed after restoration and lock release.

Only public labels, counts, booleans, structure metadata and geometry are retained. No screenshots,
chat text, prompts/answers, message/account/conversation IDs, private-ID hashes, fixture URLs,
credentials, private endpoints or raw coverage are committed. The extension tree fingerprint is
of public source files, not private data.

## Artifacts and rerun

- [Numeric evidence](summary.json): every final check, six drag observations, jump evidence and cleanup.
- [Exploratory attempt](attempt-1-summary.json): original 29 checks passed, target-selection harness failure, successful cleanup.
- [Commands and actual output](commands.md): setup, full run, commit, merge, checks and push.
- [Harness](../../../lab/harness/bookmarks-live.mjs):
  `OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs`.

Post-run integration merge, formatting/lint checks and push results are recorded in the command log.
This task only pushes its test branch; it does not open a PR or merge into the integration branch.
