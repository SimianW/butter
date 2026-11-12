# Butter PR #97: main versus split-rail B live comparison

**Matrix: 35/35 per build. Wash: 42/42 per build. Ordered checks and cleanup match.** Branch results and the shared initial 800 px pill timeout are detailed below.

Compared baseline `6215c420051b9e9b486339143f60335b7673d1b0` with PR build `9128a35c41e9045dfd60256f5692fad748af643c`. These results qualify the pinned builds. Commands, actual redacted output, timestamps and exits are in [commands.md](commands.md). Only this report folder is committed.

## Method

Read lab/README.md, the host lab README and notes/runs/README.md first. Reused the setup of [split-rail A](https://github.com/SimianW/butter/blob/6215c420051b9e9b486339143f60335b7673d1b0/notes/runs/2026-11-12-rail-split-a-live/report.md) and its surviving private work directory. Fetched origin and created two fresh detached, Snap-readable worktrees; their extension files match Git bytes. The shared checkout and all tracked files in the measured worktrees were left untouched. A dependency link uses the existing host Playwright installation. A separate branch-live harness copy changes only its output directory so screenshots remain private.

All acquisitions use `--lab auto --owner rail-split-b-live --wait 1800`, with the named fixture constraint. The matrix takes the machine-wide perf lock for its held-drag frame observations; the external adapter also takes it for wash to match the prior comparison. There is no streaming replay and no `--perf` replay. Branch ready checks use only the lab lock. Each suite restores defaults and releases its locks in cleanup; the branch runner does so in a finally block. Login expiration or a 30-minute lock timeout stops the task.

Only configured test fixtures were opened: math12 for the matrix and branch checks, demo-en12 for wash. Every connection has the lab send guard. The bookmark suites never submit a prompt. Branch-live permits only the native new_branch request; the attempted message send is blocked, and its unsent composer is cleared before the destination tab closes. Server conversation GETs before and after each suite compare the complete user-message set by count and SHA-256 without exporting text or message IDs.

Ran each pinned build’s original bookmarks-live matrix and wash suites, with three empty and three bookmarked native-scrollbar drags, then branch-live at 1280 and 800 px. The branch harness asserts ready, distinct destination, latest-reply equality in memory, one send click in the branch, blocked send requests, and original-tab stability. The only tracked harness difference relevant to measurement is the PR jump probe’s inclusion of rail/jump.js alongside rail/rail.js.

Skipped jump-typing, jump-latency, nav-earlier-live and nav-settle as requested because of the baseline failures tracked in #96. No streaming performance or general live jump/typing qualification is inferred from this run.

## bookmarks-live matrix

| Build | Passed / total | Failure | Skipped |
|---|---|---|---|
| main | 35/35 | null | [] |
| pr | 35/35 | null | [] |

Ordered check names/results identical: **yes**. Cleanup identical: **yes**.

| Cleanup field | Main | PR |
|---|---|---|
| composerEmpty | True | True |
| defaultExtensions | True | True |
| labLockReleased | True | True |
| oneHomeTab | True | True |
| perfLockReleased | True | True |
| remainingAfterFallback | 0 | 0 |
| remainingBeforeFallback | 0 | 0 |
| restored | True | True |
| shortcutsRestored | True | True |

| # | Main check | Main | PR check | PR |
|---|---|---|---|---|
| 1 | real long fixture loaded | PASS | real long fixture loaded | PASS |
| 2 | held drag empty 1 | PASS | held drag empty 1 | PASS |
| 3 | held drag empty 2 | PASS | held drag empty 2 | PASS |
| 4 | held drag empty 3 | PASS | held drag empty 3 | PASS |
| 5 | live selection message ids match conversation API by SHA-256 | PASS | live selection message ids match conversation API by SHA-256 | PASS |
| 6 | the Bookmark cell is named Bookmark selection | PASS | the Bookmark cell is named Bookmark selection | PASS |
| 7 | paragraph button saves one bookmark | PASS | paragraph button saves one bookmark | PASS |
| 8 | selection saved through real Alt+Shift+M | PASS | selection saved through real Alt+Shift+M | PASS |
| 9 | held drag bookmarked 1 | PASS | held drag bookmarked 1 | PASS |
| 10 | held drag bookmarked 2 | PASS | held drag bookmarked 2 | PASS |
| 11 | held drag bookmarked 3 | PASS | held drag bookmarked 3 | PASS |
| 12 | matched drag comparison with bookmarks versus empty | PASS | matched drag comparison with bookmarks versus empty | PASS |
| 13 | selection card jump after drag lands on text | PASS | selection card jump after drag lands on text | PASS |
| 14 | paragraph jump requested during native drag lands on text | PASS | paragraph jump requested during native drag lands on text | PASS |
| 15 | reload before row click leaves earlier answer unloaded | PASS | reload before row click leaves earlier answer unloaded | PASS |
| 16 | earlier bookmarks sit under dots and not a loaded tick (row) | PASS | earlier bookmarks sit under dots and not a loaded tick (row) | PASS |
| 17 | hover earlier segment shows 2-bookmark card (row) | PASS | hover earlier segment shows 2-bookmark card (row) | PASS |
| 18 | row click loads earlier pages and lands on requested text | PASS | row click loads earlier pages and lands on requested text | PASS |
| 19 | segment moves from dots to loaded question after row click | PASS | segment moves from dots to loaded question after row click | PASS |
| 20 | reload before keyboard click leaves earlier answer unloaded | PASS | reload before keyboard click leaves earlier answer unloaded | PASS |
| 21 | earlier bookmarks sit under dots and not a loaded tick (keyboard) | PASS | earlier bookmarks sit under dots and not a loaded tick (keyboard) | PASS |
| 22 | hover earlier segment shows 2-bookmark card (keyboard) | PASS | hover earlier segment shows 2-bookmark card (keyboard) | PASS |
| 23 | keyboard click loads earlier pages and lands on requested text | PASS | keyboard click loads earlier pages and lands on requested text | PASS |
| 24 | segment moves from dots to loaded question after keyboard click | PASS | segment moves from dots to loaded question after keyboard click | PASS |
| 25 | reload resolves both bookmarks live without answer changed | PASS | reload resolves both bookmarks live without answer changed | PASS |
| 26 | card delete removes selection bookmark | PASS | card delete removes selection bookmark | PASS |
| 27 | earlier bookmarks sit under dots and not a loaded tick (single) | PASS | earlier bookmarks sit under dots and not a loaded tick (single) | PASS |
| 28 | hover earlier segment shows 1-bookmark card (single) | PASS | hover earlier segment shows 1-bookmark card (single) | PASS |
| 29 | card delete removes both test bookmarks | PASS | card delete removes both test bookmarks | PASS |
| 30 | real fixture has a later top-level list item for distinct landing | PASS | real fixture has a later top-level list item for distinct landing | PASS |
| 31 | list item: the Bookmark cell is named Bookmark selection | PASS | list item: the Bookmark cell is named Bookmark selection | PASS |
| 32 | list item button saves its individual paragraph with ask and line | PASS | list item button saves its individual paragraph with ask and line | PASS |
| 33 | list item jump lands on the item instead of the list start | PASS | list item jump lands on the item instead of the list start | PASS |
| 34 | list item resolves live and lands on the same item after reload | PASS | list item resolves live and lands on the same item after reload | PASS |
| 35 | card delete removes list item test bookmark | PASS | card delete removes list item test bookmark | PASS |

### Held-drag probe

| Build | Arm | Rep | Held | Mounts | Added nodes | Updates | Reads | Messages | Bookmark scripts | Bookmark function calls | Critical bookmark work |
|---|---|---|---|---|---|---|---|---|---|---|---|
| main | empty | 1 | True | 0 | 0 | 33 | 0 | 0 | 2 | 132 | 0 |
| main | empty | 2 | True | 0 | 0 | 33 | 0 | 0 | 2 | 132 | 0 |
| main | empty | 3 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |
| main | bookmarked | 1 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |
| main | bookmarked | 2 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |
| main | bookmarked | 3 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |
| pr | empty | 1 | True | 0 | 0 | 33 | 0 | 0 | 2 | 132 | 0 |
| pr | empty | 2 | True | 0 | 0 | 33 | 0 | 0 | 2 | 132 | 0 |
| pr | empty | 3 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |
| pr | bookmarked | 1 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |
| pr | bookmarked | 2 | True | 0 | 0 | 33 | 0 | 0 | 2 | 132 | 0 |
| pr | bookmarked | 3 | True | 0 | 0 | 32 | 0 | 0 | 2 | 128 | 0 |

Critical bookmark work comprises refresh, paragraphs, measure, selection, topBlock, locate, create, remove, show and place. The per-function counts and frame observations are retained in the numeric JSON. Frame numbers are observations under the matrix perf lock, not a timing-equivalence claim.

### Jump probe calls

The probe records coverage after selected jumps, separately from the held-drag interval above. Both builds aggregate functions under the same rail label; the PR also reads rail/jump.js, where jump, landOff, targetTop and glide moved. A newly included source file alone is not an extra operation.

| Jump label | Function | Main calls | PR calls |
|---|---|---|---|
| after-drag | bookmark.locate | 25 | 26 |
| after-drag | rail.jump | 6 | 6 |
| after-drag | rail.jumpTo | 1 | 1 |
| after-drag | rail.landOff | 25 | 26 |
| after-drag | rail.targetTop | 7 | 7 |
| during-drag | rail.jump | 6 | 6 |
| during-drag | rail.landOff | 44 | 44 |
| during-drag | rail.targetTop | 9 | 9 |
| unloaded-keyboard | bookmark.locate | 23 | 19 |
| unloaded-keyboard | rail.earlierJump | 1 | 1 |
| unloaded-keyboard | rail.jump | 1 | 1 |
| unloaded-keyboard | rail.jumpTo | 1 | 1 |
| unloaded-keyboard | rail.landOff | 23 | 19 |
| unloaded-keyboard | rail.targetTop | 5 | 5 |
| unloaded-row | bookmark.locate | 23 | 19 |
| unloaded-row | rail.earlierJump | 1 | 1 |
| unloaded-row | rail.jump | 1 | 1 |
| unloaded-row | rail.jumpTo | 1 | 1 |
| unloaded-row | rail.landOff | 23 | 19 |
| unloaded-row | rail.targetTop | 5 | 5 |

## bookmarks-live wash

| Build | Passed / total | Failure | Skipped |
|---|---|---|---|
| main | 42/42 | null | [] |
| pr | 42/42 | null | [] |

Ordered check names/results identical: **yes**. Cleanup identical: **yes**.

| Cleanup field | Main | PR |
|---|---|---|
| composerEmpty | True | True |
| defaultExtensions | True | True |
| labLockReleased | True | True |
| oneHomeTab | True | True |
| perfLockReleased | True | True |
| remainingAfterFallback | 0 | 0 |
| remainingBeforeFallback | 3 | 3 |
| restored | True | True |

| # | Main check | Main | PR check | PR |
|---|---|---|---|---|
| 1 | wash light: ChatGPT shows its light theme | PASS | wash light: ChatGPT shows its light theme | PASS |
| 2 | wash light: the whole chat loads through the earlier-history dots | PASS | wash light: the whole chat loads through the earlier-history dots | PASS |
| 3 | wash: a mounted answer holds two long paragraphs and a table | PASS | wash: a mounted answer holds two long paragraphs and a table | PASS |
| 4 | wash: the Bookmark cell bookmarks the paragraph | PASS | wash: the Bookmark cell bookmarks the paragraph | PASS |
| 5 | wash: the Bookmark cell bookmarks the selection | PASS | wash: the Bookmark cell bookmarks the selection | PASS |
| 6 | wash: the Bookmark cell bookmarks the table | PASS | wash: the Bookmark cell bookmarks the table | PASS |
| 7 | wash light: a paragraph is washed on its own lines | PASS | wash light: a paragraph is washed on its own lines | PASS |
| 8 | wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS | wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 9 | wash light: a paragraph: the text keeps its colour under the wash | PASS | wash light: a paragraph: the text keeps its colour under the wash | PASS |
| 10 | wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS | wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS |
| 11 | wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS | wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS |
| 12 | wash light: a paragraph: gone after the hold and fade | PASS | wash light: a paragraph: gone after the hold and fade | PASS |
| 13 | wash light: a selection is washed on its own lines | PASS | wash light: a selection is washed on its own lines | PASS |
| 14 | wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS | wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 15 | wash light: a selection: the text keeps its colour under the wash | PASS | wash light: a selection: the text keeps its colour under the wash | PASS |
| 16 | wash light: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS | wash light: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS |
| 17 | wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS | wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS |
| 18 | wash light: a selection: gone after the hold and fade | PASS | wash light: a selection: gone after the hold and fade | PASS |
| 19 | wash light: a table is washed on its own lines (one box 3 px around the table) | PASS | wash light: a table is washed on its own lines (one box 3 px around the table) | PASS |
| 20 | wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS | wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 21 | wash light: a table: the text keeps its colour under the wash | PASS | wash light: a table: the text keeps its colour under the wash | PASS |
| 22 | wash light: a table: scrolled 80 px during the hold, the boxes follow the text | PASS | wash light: a table: scrolled 80 px during the hold, the boxes follow the text | PASS |
| 23 | wash light: a table: gone after the hold and fade | PASS | wash light: a table: gone after the hold and fade | PASS |
| 24 | wash dark: ChatGPT shows its dark theme | PASS | wash dark: ChatGPT shows its dark theme | PASS |
| 25 | wash dark: the whole chat loads through the earlier-history dots | PASS | wash dark: the whole chat loads through the earlier-history dots | PASS |
| 26 | wash dark: a paragraph is washed on its own lines | PASS | wash dark: a paragraph is washed on its own lines | PASS |
| 27 | wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS | wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 28 | wash dark: a paragraph: the text keeps its colour under the wash | PASS | wash dark: a paragraph: the text keeps its colour under the wash | PASS |
| 29 | wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS | wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS |
| 30 | wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS | wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS |
| 31 | wash dark: a paragraph: gone after the hold and fade | PASS | wash dark: a paragraph: gone after the hold and fade | PASS |
| 32 | wash dark: a selection is washed on its own lines | PASS | wash dark: a selection is washed on its own lines | PASS |
| 33 | wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS | wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 34 | wash dark: a selection: the text keeps its colour under the wash | PASS | wash dark: a selection: the text keeps its colour under the wash | PASS |
| 35 | wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS | wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS |
| 36 | wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS | wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS |
| 37 | wash dark: a selection: gone after the hold and fade | PASS | wash dark: a selection: gone after the hold and fade | PASS |
| 38 | wash dark: a table is washed on its own lines (one box 3 px around the table) | PASS | wash dark: a table is washed on its own lines (one box 3 px around the table) | PASS |
| 39 | wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS | wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 40 | wash dark: a table: the text keeps its colour under the wash | PASS | wash dark: a table: the text keeps its colour under the wash | PASS |
| 41 | wash dark: a table: scrolled 80 px during the hold, the boxes follow the text | PASS | wash dark: a table: scrolled 80 px during the hold, the boxes follow the text | PASS |
| 42 | wash dark: a table: gone after the hold and fade | PASS | wash dark: a table: gone after the hold and fade | PASS |

## Branch ready and pill

Both initial two-width commands exited 1: after a successful 1280 px ready check, the 800 px selection pill never appeared within five seconds. Repeated 800 px alone after a fresh restart on each build; both commands again exited 1 at the same pill wait, with no ready or pill measurements. The only extra harness-copy change for that diagnostic retry is replacing the width list with [800]. These attempts are retained, not discarded.

| Build | Width (px) | End | Gap (px) | Top delta (px) | Original unchanged | Distinct destination | Latest reply matched | Send blocked |
|---|---|---|---|---|---|---|---|---|
| main | 1280 | ready | 4 | 0 | True | True | True | True |
| pr | 1280 | ready | 4 | 0 | True | True | True | True |

Pill fields identical at the completed 1280 px width: **yes**. Fields include gap, vertical delta and both native/Butter computed height, radius, background and shadow. The 800 px runs timed out before the pill measurement and ready check, in both the sequential attempt and the isolated-width retry; there are no 800 px pill measurements to compare.

| Build | Width | Native style | Butter style |
|---|---|---|---|
| main | 1280 | 30px \| 8px \| rgb(48, 48, 48) \| rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px | 30px \| 8px \| rgb(48, 48, 48) \| rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px |
| pr | 1280 | 30px \| 8px \| rgb(48, 48, 48) \| rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px | 30px \| 8px \| rgb(48, 48, 48) \| rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 4px 8px -2px |

## Server checks and cleanup

| Suite | Before HTTP | After HTTP | Before users | After users | Fingerprint unchanged |
|---|---|---|---|---|---|
| matrix-main | 200 | 200 | 16 | 16 | True |
| wash-main | 200 | 200 | 12 | 12 | True |
| matrix-pr | 200 | 200 | 16 | 16 | True |
| wash-pr | 200 | 200 | 12 | 12 | True |
| branch-main | 200 | 200 | 16 | 16 | True |
| branch-pr | 200 | 200 | 16 | 16 | True |
| branch800-main | 200 | 200 | 16 | 16 | True |
| branch800-pr | 200 | 200 | 16 | 16 | True |

Full server user-turn fingerprints are in [server-checks.json](data/server-checks.json). These are fingerprints of the server’s user-message set, not captured prompt text. Raw branch screenshots, titles, content fingerprints and private endpoints remain outside this report.

## Command exits

| Stage | Exit | Seconds |
|---|---|---|
| matrix-main | 0 | 297.435 |
| wash-main | 0 | 128.692 |
| matrix-pr | 0 | 292.371 |
| wash-pr | 0 | 131.651 |
| live-acquire | 0 | 0.064 |
| live-restart-main | 0 | 2.07 |
| branch-main-before | 0 | 1.617 |
| branch-live-main | 1 | 32.498 |
| branch-main-after | 0 | 1.117 |
| live-restart-pr | 0 | 2.071 |
| branch-pr-before | 0 | 1.517 |
| branch-live-pr | 1 | 32.947 |
| branch-pr-after | 0 | 1.367 |
| live-restore | 0 | 10.238 |
| live-release | 0 | 0.064 |
| final-lock-status | 0 | 0.064 |
| retry-acquire | 0 | 0.064 |
| retry-restart-main | 0 | 2.073 |
| branch800-main-before | 0 | 1.517 |
| branch800-live-main | 1 | 12.549 |
| branch800-main-after | 0 | 1.267 |
| retry-restart-pr | 0 | 2.073 |
| branch800-pr-before | 0 | 1.316 |
| branch800-live-pr | 1 | 12.599 |
| branch800-pr-after | 0 | 1.368 |
| retry-restore | 0 | 11.088 |
| retry-release | 0 | 0.064 |
| final-lock-status-retry | 0 | 0.064 |

## Findings and limits

No PR-only failure was observed in the requested checks. The matrix and wash pass on both pinned builds with identical ordered names/results and cleanup. At 1280 px both branch runs reach ready, have identical pill measurements, preserve the original tab and block the message send. Both destination routes are classified local by the harness, with a distinct identity and matching latest reply.

The requested 800 px branch-ready/pill comparison is **unqualified**. Both original two-width commands fail at the same five-second wait for the selection pill at 800 px, after completing 1280 px. One fresh-browser 800 px-only retry per build fails at that same wait before recording any width result. This is a shared baseline failure; it is additional to the skipped #96 harnesses. Its cause was not diagnosed, and no product or tracked harness code was changed. Public fields and exact timeout errors are retained in commands.md and data/branch-attempts.json.

All six held drags per build keep held=true with zero mounts, additions, storage reads/messages and critical bookmark work. There are two bookmark coverage scripts on every drag. Total bookmark callback counts for empty repetitions are 132, 132, 128 on both builds. For bookmarked repetitions they are 128, 128, 128 on main and 128, 132, 128 on the PR; the middle repetition has 32 versus 33 seek updates. These total callbacks include housekeeping and do not mean critical bookmark work ran.

Jump-probe landOff/bookmark.locate pairs are 25/25 versus 26/26 after drag, 23/23 versus 19/19 for unloaded-row, and 23/23 versus 19/19 for unloaded-keyboard. During-drag counts match (landOff 44, targetTop 9, jump 6). All jump, jumpTo, earlierJump and targetTop entries match by probe. glide has no reported entry on either build. The probe now includes rail/jump.js and preserves the moved functions' coverage, but the numerical differences are **not solely a visibility change**: bookmark.locate's unchanged probe also differs. Repeated landing/pin lookups and frame scheduling can affect these live counts; this single sample per jump does not establish their cause or timing equivalence. No held-drag safety count or landing pass/fail result differs.

Wash covers paragraph, selection and table targets in light and dark themes. Its fixture supplies no code-block wash case. Cleanup has three bookmarks before fallback and zero afterward on both builds. Matrix cleanup has zero before and after fallback, with shortcuts restored.

All eight before/after server checks match within each lock window: 16 user turns for math12 and 12 for demo-en12. No new real user message was sent. Both final restore/release cycles succeeded; the final status shows both labs and the perf lock free. Raw captures and screenshots remain private outside this folder.

## Publication scope

Fetched before testing and again before creating the publication worktree. The branch head was still 9128a35c41e9045dfd60256f5692fad748af643c at both fetches; it had not moved past the measured PR build. The separate publication worktree is on t3/split-rail-b. Only notes/runs/2026-11-12-rail-split-b-live/ is staged and committed. This report does not replace the implementation PR's gate review.

## Verification

Both measured extension trees were checked against Git again after all live work: main 65 files and PR 66 files, zero byte mismatches and zero tracked changes. The report verifier recomputes check counts/order and cleanup equality, verifies every held-drag safety count, checks 1280 px branch data and both sets of shared 800 px timeouts, and compares all 16 server-check artifacts. JSON parses and the public export passes privacy scanning.

- PASS: matrix 35/35 per build; ordered checks and cleanup identical.
- PASS: wash 42/42 per build; ordered checks and cleanup identical.
- PASS: 1280 px branch ready and pill fields match; original tabs unchanged, sends guarded. Shared 800 px timeout retained for both initial and isolated attempts.
- PASS: all eight before/after server user-turn sets unchanged (16 HTTP 200 checks).
- PASS: public JSON parses; privacy scan zero matches (2 private titles/content fingerprints and four identifier/endpoint patterns).
- PASS: report folder contains only Markdown and JSON; raw screenshots and captures excluded.
