# #57 bookmarks live lab rerun — 2026-11-08

**FAIL: the unloaded-earlier-bookmark jump does not load history or reach its text.**
The live-markup fix enables creation, and the settled during/after-drag jumps and drag-overhead
checks pass. User story 28 and #57's full live-lab criterion remain unmet. No extension code changed.

The first run failed because bookmark creation required assistant role/message-ID markup absent from live chats.

## Build and method

Branch `t3/57-bookmark-lab-2`; tested source HEAD `64b4d0019322aa528cc139dae4e8c7156cc99de3`,
containing integration `933c2e15ae761f93f440a7ff43d327ace4aec8d8` and fix `1d5db95`.
Manifest `0.1.0-alpha.16`; headed Linux Chromium `156.0.8078.47`.
This worktree's `extension/` was copied byte-for-byte into a unique Snap-readable unpacked install:
SHA-256 `0e8224b35c5be4bb8a3c97ac5dd1bea0a788fe1899b59ebfd326daa6b00d3faf`. Reports/harness changes do not change this extension tree.
The named `math12` fixture ran with both the lab and machine-wide perf locks, send guard on,
layout consent declined, and no composer input or new prompts.

## Results

Final matrix: **16 passed, 1 failed**. `npm run format:check && npm run lint` passed after
`git fetch origin && git merge origin/t3/51-bookmarks` reported `Already up to date.`
The extension tree still matches that integration branch exactly.

| Check | Result | Evidence |
|---|---|---|
| Existing long chat / older history | PASS | 5 initial questions, 16 after 11 successful earlier-page reads. |
| Paragraph button | PASS | 1 visible button; 1 saved bookmark and 1 segment. |
| Selection with real Alt+Shift+M | PASS | 30 selected characters; 1 Chrome command; 2 stored bookmarks sharing 1 segment. |
| Live DOM message ID equals API message ID | PASS | SHA-256 equality for 10/10 rendered assistant messages, including the target; 41 API assistant IDs hashed from 13 observed API responses. No message IDs or hashes recorded. |
| Selection card jump after native drag settles | PASS | Trusted row click; selected paragraph top 61.7 px below scroller top, in view. |
| Paragraph jump requested while native thumb held | PASS, deferred | Trusted Enter on segment with held true before/after activation; text not visible while held; after release and seek completion its top is 64 px, in view. |
| Reload persistence and unloaded precondition | PASS | 2 records, 1 segment; only 5 questions loaded, earlier-history control available, target unmounted. |
| Jump to unloaded earlier bookmark | **FAIL** | Trusted row click; 0 earlier-page reads; target remains unmounted and text out of view. |
| Reloaded bookmark resolves live | PASS after manually loading history | Original message hashes and excerpt heads match for 2/2 records; 2 live card rows, 0 stale segments/rows/warnings. Manual history load plus bookmark click lands at 64 px. This does not rescue the failed automatic-history check. |
| Delete from rail card | PASS | Both deleted through real × controls; 0 records and 0 segments. |
| Bookmark drag overhead | PASS in six measured holds | 3 empty and 3 bookmarked drags; 0 extra mounts, added elements, storage reads or bookmark runtime requests. |
| Restore and release | PASS | Default extensions, one home tab, empty composer, original shortcut preferences restored, lab and perf locks released. |

## Held-drag measurements

| Arm | Run | Seek updates | Frames | Turn mounts | Added elements | Storage reads | Bookmark requests | Frame p95 ms | Frame max ms |
|---|---|---|---|---|---|---|---|---|---|
| empty | 1 | 31 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| empty | 2 | 32 | 87 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| empty | 3 | 31 | 87 | 0 | 0 | 0 | 0 | 16.7 | 33.3 |
| bookmarked | 1 | 32 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.7 |
| bookmarked | 2 | 32 | 86 | 0 | 0 | 0 | 0 | 16.8 | 16.8 |
| bookmarked | 3 | 32 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |

A thread-subtree MutationObserver counts newly added element roots and descendants, including turn
mounts. Worker probes count IndexedDB object-store/index read methods and local-settings reads;
a runtime listener counts bookmark requests. Precise coverage sees the actual bookmark content
script in every hold. `refresh`, `paragraphs`, `measure`, `selection`, `topBlock`, `locate`, `create`,
`remove`, `show` and `place` execute 0 times in all six intervals. Cheap event guards still execute
62–64 aggregate function calls per interval; this is not zero bookmark JavaScript.
The measurement starts after initial press/seek and ends before release. Release/settling latency
is outside these frame figures. Three repetitions per arm establish this fixture's measured
hold behavior, not a broad cross-platform performance claim.

## Bug: a reloaded earlier bookmark jumps inside the loaded tail

Reproduce with the tested build, named long fixture, send guard on:

1. Load all earlier history through the rail's dots. Bookmark two paragraphs in an answer that
   will be outside the initial tail after reopening: the harness uses the paragraph button and
   a 30-character selection saved with real Alt+Shift+M.
2. Reopen the existing chat (the harness navigates away and back, so content scripts and the rail
   are recreated). Confirm both bookmarks persist but only 5 of the 16 questions are loaded,
   the earlier-history dots are present, and the bookmarked answer is unmounted.
3. Focus its segment, press ArrowLeft, and click its first bookmark row.
4. Expected: fetch earlier messages, mount the original answer, and land with the marked text in view.
   Actual: 0 earlier-page responses, still 5 questions, target unmounted and text not visible.
5. As a control, manually use the earlier-history dots and click the bookmark again. The original
   answer mounts, the paragraph lands at 64 px, both saved message hashes/excerpts match, and
   neither bookmark says “answer changed”.

The final failure reached the real UI: 1 trusted row click, `rail.jumpTo` 1 call, `rail.jump`
1 call, `rail.glide` 1 call and `bookmark.locate` 27 calls. This was not an unreceived input.
It reproduced in all three reruns; the final run's independent history-loading control passes.

Code inspection explains the route: `bookmarks/model.js` `group()` places an unknown message
under its stored question position clamped to the currently loaded last question. The rail then
jumps to that loaded question; there is no pending destination that reads older pages until the
bookmark's message is known. No implementation change or injected bookmark/markup workaround
was applied. This is the remaining user story 28 blocker.

## Harness corrections and safety

The old script's fixed 2.5-second post-release pause was too short for seek completion. During
that interval the seek card suppresses bookmark-card opening, and the old silent fallback could
activate the first bookmark instead of the requested selection. The final harness waits for
native seek completion and disappearance of the seek card, requires the intended row, records
trusted control input/function-call evidence, and checks actual mounted-message/excerpt matches
after reload. Earlier exploratory jump failures from insufficient waiting are not product bugs.

The send guard blocked 77 unrelated non-read ChatGPT requests and observed
**0 send attempts**. All three reruns restored their task install/shortcuts and
released both locks. The task-owned bookmark store was empty before fallback cleanup in the final
run. No screenshots, chat text, prompts/answers, IDs, account data, fixture URLs, credentials,
private endpoints or raw coverage are included. Hash comparisons retain only counts/booleans.
The report directory follows the requested local date; the run crossed into 2026-11-09 UTC.

## Artifacts and rerun

- [Numeric evidence](summary.json), including all final checks, six drag measurements and jump probes.
- [Commands and actual output](commands.md), including exploratory runs and final verification.
- [Harness](../../../lab/harness/bookmarks-live.mjs):
  `OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs`.
  It exits 1 for the unloaded-history failure, then restores the lab and releases locks in `finally`.

This is a failed qualification run, with one product bug reported and no extension changes.
