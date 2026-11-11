# Butter main vs PR #90: live-lab smoke — 2026-11-11

**Result after one rerun of main: same checks, same results.** In the first pair of runs the PR
passed everything (matrix 35/35, wash 42/42, branch-live `ready` at both widths) while main failed
one matrix check and its wash run stopped early. One fresh rerun of main in each mode passed
matrix 35/35 and wash 42/42 with ordered checks and cleanup identical to the PR's runs
([rerun-main.md](rerun-main.md)); the same main extension tree had also passed both earlier the
same day ([page-reader-a-live](../2026-11-11-page-reader-a-live/report.md), as PR #87's head). The
first main run's two failures did not recur. The original first-pair report follows unchanged.

**First pair (as written by the run): the requested results are not all identical; full smoke
qualification is incomplete.**

Bookmarks matrix: main 34/35, PR 35/35; ordered check names/results differ; cleanup identical.
Bookmarks wash: main 5/5 completed; ERROR, PR 42/42; ordered check names/results differ; cleanup differs.

The PR passed all completed prescribed suites, with no PR-only failure observed. Main’s reload-landing failure and incomplete wash run prevent a full parity claim. The cause and repeatability of those main outcomes were not established.

## Builds and method

- Main: `86f95e52ebb00fc3edd70856bcbba66e72222ca7`.
- PR #90 (`t3/page-reader-b`): `3b5a6916b8b364c5ced20ed91e1c08689192ea6d`. Its later commit `2572a05` (review F1–F4) changes only tests, docs and a comment in `page/reader-main.js`. This exact SHA was archived after fetching; the requested head was unchanged.
- Each build came from its own `git archive` copy, with `node_modules` linked to installed Playwright 1.65.0. No edit, commit, checkout or push was made in the shared Butter repository; its pre-existing untracked files were left alone.
- Chromium 156.0.8078.47, headed on Xvfb. The two harness source files are identical between these commits. Snap-readable extension copies matched their archive sources byte for byte.
- Matrix: main then PR, lab 1, `math12`, default mode, three repetitions per drag arm, harness-owned lab and perf locks.
- Wash: main then PR, lab 2, `demo-en12`, `MODE=wash`, harness-owned lab lock; wash requires no perf lock.
- Branch: main then PR, lab 1, `math12`, task-owned lab/perf locks and a browser restart with the matching snap-readable extension before every attempt. `BRANCH_PATH` was exactly `^/backend-api/conversation/new_branch$`.
- Every lock operation was sequential. Each completed lock session ran `lab-restore` before `lab-lock release`, including failed harness attempts.
- The send guard stayed on. There was no manual typing, live ChatGPT message, ChatGPT settings change or language change. As in the prescribed previous run, branch-live fills Butter’s test-question field and attempts a guarded send in the branch; that message request is blocked. The native branch-creation request alone is allowed.
- Branch-live-edges, nav-earlier and nav-takeovers were not run. Issue #89 remains outside this qualification.

| Extension tree SHA-256 | Digest |
|---|---|
| main | `6165863f314ee6b6f449ad47907a9a2c7169296c0e08cf7422199587cf6be221` |
| pr | `7eadeaa8e6eafda1e2d73ca9b2df9b500f384e48650fc5756c93369e2358163e` |

## Results

| Harness | main | PR | Comparison |
|---|---|---|---|
| bookmarks-live matrix | 34/35; 310.682 s | 35/35; 303.807 s | ordered checks differ; cleanup identical |
| bookmarks-live wash | 5/5 completed; ERROR; 82.178 s | 42/42; 132.942 s | ordered checks differ; cleanup differs |
| branch-live, 1280/800 px | attempt 1: PASS (1280: ready, 800: ready) | attempt 1: PASS (1280: ready, 800: ready) | pill measurements identical |

### Script comparison output

```text
matrix ordered checks identical: False cleanup identical: True
DIFFERENCE {"index": 33, "main": ["list item resolves live and lands on the same item after reload", false], "pr": ["list item resolves live and lands on the same item after reload", true]}
wash ordered checks identical: False cleanup identical: False
DIFFERENCE {"index": 3, "main": ["wash dark: ChatGPT shows its dark theme", true], "pr": ["wash: the Bookmark cell bookmarks the paragraph", true]}
DIFFERENCE {"index": 4, "main": ["wash dark: the whole chat loads through the earlier-history dots", true], "pr": ["wash: the Bookmark cell bookmarks the selection", true]}
DIFFERENCE {"index": 5, "main": null, "pr": ["wash: the Bookmark cell bookmarks the table", true]}
DIFFERENCE {"index": 6, "main": null, "pr": ["wash light: a paragraph is washed on its own lines", true]}
DIFFERENCE {"index": 7, "main": null, "pr": ["wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash", true]}
DIFFERENCE {"index": 8, "main": null, "pr": ["wash light: a paragraph: the text keeps its colour under the wash", true]}
DIFFERENCE {"index": 9, "main": null, "pr": ["wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text", true]}
DIFFERENCE {"index": 10, "main": null, "pr": ["wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it", true]}
DIFFERENCE {"index": 11, "main": null, "pr": ["wash light: a paragraph: gone after the hold and fade", true]}
DIFFERENCE {"index": 12, "main": null, "pr": ["wash light: a selection is washed on its own lines", true]}
DIFFERENCE {"index": 13, "main": null, "pr": ["wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash", true]}
DIFFERENCE {"index": 14, "main": null, "pr": ["wash light: a selection: the text keeps its colour under the wash", true]}
DIFFERENCE {"index": 15, "main": null, "pr": ["wash light: a selection: scrolled -680 px during the hold, the boxes follow the text", true]}
DIFFERENCE {"index": 16, "main": null, "pr": ["wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it", true]}
DIFFERENCE {"index": 17, "main": null, "pr": ["wash light: a selection: gone after the hold and fade", true]}
DIFFERENCE {"index": 18, "main": null, "pr": ["wash light: a table is washed on its own lines (one box 3 px around the table)", true]}
DIFFERENCE {"index": 19, "main": null, "pr": ["wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash", true]}
DIFFERENCE {"index": 20, "main": null, "pr": ["wash light: a table: the text keeps its colour under the wash", true]}
DIFFERENCE {"index": 21, "main": null, "pr": ["wash light: a table: scrolled 80 px during the hold, the boxes follow the text", true]}
DIFFERENCE {"index": 22, "main": null, "pr": ["wash light: a table: gone after the hold and fade", true]}
DIFFERENCE {"index": 23, "main": null, "pr": ["wash dark: ChatGPT shows its dark theme", true]}
DIFFERENCE {"index": 24, "main": null, "pr": ["wash dark: the whole chat loads through the earlier-history dots", true]}
DIFFERENCE {"index": 25, "main": null, "pr": ["wash dark: a paragraph is washed on its own lines", true]}
DIFFERENCE {"index": 26, "main": null, "pr": ["wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash", true]}
DIFFERENCE {"index": 27, "main": null, "pr": ["wash dark: a paragraph: the text keeps its colour under the wash", true]}
DIFFERENCE {"index": 28, "main": null, "pr": ["wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text", true]}
DIFFERENCE {"index": 29, "main": null, "pr": ["wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it", true]}
DIFFERENCE {"index": 30, "main": null, "pr": ["wash dark: a paragraph: gone after the hold and fade", true]}
DIFFERENCE {"index": 31, "main": null, "pr": ["wash dark: a selection is washed on its own lines", true]}
DIFFERENCE {"index": 32, "main": null, "pr": ["wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash", true]}
DIFFERENCE {"index": 33, "main": null, "pr": ["wash dark: a selection: the text keeps its colour under the wash", true]}
DIFFERENCE {"index": 34, "main": null, "pr": ["wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text", true]}
DIFFERENCE {"index": 35, "main": null, "pr": ["wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it", true]}
DIFFERENCE {"index": 36, "main": null, "pr": ["wash dark: a selection: gone after the hold and fade", true]}
DIFFERENCE {"index": 37, "main": null, "pr": ["wash dark: a table is washed on its own lines (one box 3 px around the table)", true]}
DIFFERENCE {"index": 38, "main": null, "pr": ["wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash", true]}
DIFFERENCE {"index": 39, "main": null, "pr": ["wash dark: a table: the text keeps its colour under the wash", true]}
DIFFERENCE {"index": 40, "main": null, "pr": ["wash dark: a table: scrolled 80 px during the hold, the boxes follow the text", true]}
DIFFERENCE {"index": 41, "main": null, "pr": ["wash dark: a table: gone after the hold and fade", true]}
branch pill measurements identical: True
branch ready at both widths in every attempt: True
```

`compare.py` compares the complete ordered `(name, pass)` sequences and cleanup records. `data/comparison.json` contains its results and the drag metrics.

main matrix failed `list item resolves live and lands on the same item after reload`. Its complete numeric/boolean observation is retained in that run’s `summary.json`.
The bookmark matched the message and excerpt (`matchingMessageAndExcerpt=true`), but the item was outside the viewport (`inView=false`, `landsOnItem=false`, top -23319.65625 px). There were 0 stale marks and 0 stale rows.

main wash stopped with `Error` in `wash-bookmark`. Completed-check counts alone do not qualify this suite. Skipped scenarios: `wash-light-paragraph: needs 3 stored test bookmarks, has 0`, `wash-light-selection: needs 3 stored test bookmarks, has 0`, `wash-light-table: needs 3 stored test bookmarks, has 0`, `wash-dark-paragraph: needs 3 stored test bookmarks, has 0`, `wash-dark-selection: needs 3 stored test bookmarks, has 0`, `wash-dark-table: needs 3 stored test bookmarks, has 0`.

Main wash’s private exception was matched to the public harness label `paragraph target unmounted` (recorded in `data/failures.json`). Its zero stored test bookmarks caused all six wash jump scenarios to be skipped. PR completed all 42 wash checks. This is incomplete main coverage, rather than a passed wash comparison.

These are single harness runs per build and mode. A difference in a live result does not establish its cause or repeatability. The report preserves the original outcomes without substituting retries.

### Held native scrollbar drags

Each cell is `held / updates / mounts / frames / p95 frame ms / max frame ms`. These observations come directly from `summary.json` → `drags`. They are single runs, not a performance claim.

| Arm / repetition | main | PR |
|---|---|---|
| empty 1 | true / 32 / 0 / 85 / 16.8 / 16.8 | true / 31 / 0 / 90 / 16.8 / 16.8 |
| empty 2 | true / 32 / 0 / 86 / 16.7 / 16.8 | true / 32 / 0 / 85 / 16.7 / 16.8 |
| empty 3 | true / 32 / 0 / 89 / 16.8 / 49.9 | true / 32 / 0 / 86 / 16.7 / 16.8 |
| bookmarked 1 | true / 31 / 0 / 84 / 16.7 / 16.8 | true / 33 / 0 / 84 / 16.8 / 16.8 |
| bookmarked 2 | true / 32 / 0 / 84 / 16.8 / 16.8 | true / 31 / 0 / 86 / 16.7 / 16.8 |
| bookmarked 3 | true / 32 / 0 / 86 / 16.8 / 33.4 | true / 31 / 0 / 85 / 16.7 / 16.8 |

Wash records no held-drag observations (`drags=[]`) on either build. PR wash movement checks are retained in its summary; main never reached them.

### Branch attempts and pill measurements

main attempt 1: exit 0, 45.464 s; 1280 px: ready, original unchanged=true, original scroll=[520, 520]; 800 px: ready, original unchanged=true, original scroll=[511, 511].
pr attempt 1: exit 0, 42.728 s; 1280 px: ready, original unchanged=true, original scroll=[498, 498]; 800 px: ready, original unchanged=true, original scroll=[511, 511].

| Build / attempt | Width px | Gap px | Top delta px | Height px | Radius px | Native/Butter looks match |
|---|---:|---:|---:|---:|---:|---|
| main / 1 | 1280 | 4 | 0 | 30 | 8 | true |
| main / 1 | 800 | 4 | 0 | 30 | 8 | true |
| pr / 1 | 1280 | 4 | 0 | 30 | 8 | true |
| pr / 1 | 800 | 4 | 0 | 30 | 8 | true |

Sanitized branch data keeps ready state, dimensions/styles, original-tab comparison, request counts and safety booleans. It removes screenshot references, titles, content fingerprints and endpoint records. Every attempt is retained, including failures.

## Send guard and cleanup

| Bookmarks run | Send attempts | Blocked mutations |
|---|---:|---:|
| matrix main | 0 | 194 |
| matrix pr | 0 | 191 |
| wash main | 0 | 92 |
| wash pr | 0 | 113 |

Matrix cleanup on main:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "shortcutsRestored": true, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": true}
```
PR cleanup identical: `true`.

Wash cleanup on main:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": false}
```
PR cleanup identical: `false`.

PR cleanup:

```json
{"remainingBeforeFallback": 3, "remainingAfterFallback": 0, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": false}
```

Wash takes no perf lock, so `perfLockReleased=false` is expected. Branch restore/release data is retained per attempt; actual command exits are in `commands.md`. Restore success, empty composer, one home tab, default extensions and absence of extra flags are checked from actual restore output. All owned locks were released.

## Ordered checks

Each table preserves harness order. The full `summary.json` files retain the associated numeric/boolean observations.

### Bookmarks matrix

| # | Check | main | PR |
|---:|---|---|---|
| 1 | real long fixture loaded | PASS | PASS |
| 2 | held drag empty 1 | PASS | PASS |
| 3 | held drag empty 2 | PASS | PASS |
| 4 | held drag empty 3 | PASS | PASS |
| 5 | live selection message ids match conversation API by SHA-256 | PASS | PASS |
| 6 | the Bookmark cell is named Bookmark selection | PASS | PASS |
| 7 | paragraph button saves one bookmark | PASS | PASS |
| 8 | selection saved through real Alt+Shift+M | PASS | PASS |
| 9 | held drag bookmarked 1 | PASS | PASS |
| 10 | held drag bookmarked 2 | PASS | PASS |
| 11 | held drag bookmarked 3 | PASS | PASS |
| 12 | matched drag comparison with bookmarks versus empty | PASS | PASS |
| 13 | selection card jump after drag lands on text | PASS | PASS |
| 14 | paragraph jump requested during native drag lands on text | PASS | PASS |
| 15 | reload before row click leaves earlier answer unloaded | PASS | PASS |
| 16 | earlier bookmarks sit under dots and not a loaded tick (row) | PASS | PASS |
| 17 | hover earlier segment shows 2-bookmark card (row) | PASS | PASS |
| 18 | row click loads earlier pages and lands on requested text | PASS | PASS |
| 19 | segment moves from dots to loaded question after row click | PASS | PASS |
| 20 | reload before keyboard click leaves earlier answer unloaded | PASS | PASS |
| 21 | earlier bookmarks sit under dots and not a loaded tick (keyboard) | PASS | PASS |
| 22 | hover earlier segment shows 2-bookmark card (keyboard) | PASS | PASS |
| 23 | keyboard click loads earlier pages and lands on requested text | PASS | PASS |
| 24 | segment moves from dots to loaded question after keyboard click | PASS | PASS |
| 25 | reload resolves both bookmarks live without answer changed | PASS | PASS |
| 26 | card delete removes selection bookmark | PASS | PASS |
| 27 | earlier bookmarks sit under dots and not a loaded tick (single) | PASS | PASS |
| 28 | hover earlier segment shows 1-bookmark card (single) | PASS | PASS |
| 29 | card delete removes both test bookmarks | PASS | PASS |
| 30 | real fixture has a later top-level list item for distinct landing | PASS | PASS |
| 31 | list item: the Bookmark cell is named Bookmark selection | PASS | PASS |
| 32 | list item button saves its individual paragraph with ask and line | PASS | PASS |
| 33 | list item jump lands on the item instead of the list start | PASS | PASS |
| 34 | list item resolves live and lands on the same item after reload | FAIL | PASS |
| 35 | card delete removes list item test bookmark | PASS | PASS |

### Bookmarks wash

| # | Check | main | PR |
|---:|---|---|---|
| 1 | wash light: ChatGPT shows its light theme | PASS | PASS |
| 2 | wash light: the whole chat loads through the earlier-history dots | PASS | PASS |
| 3 | wash: a mounted answer holds two long paragraphs and a table | PASS | PASS |
| 4 | wash dark: ChatGPT shows its dark theme / PR: wash: the Bookmark cell bookmarks the paragraph | PASS | PASS |
| 5 | wash dark: the whole chat loads through the earlier-history dots / PR: wash: the Bookmark cell bookmarks the selection | PASS | PASS |
| 6 | wash: the Bookmark cell bookmarks the table | NOT RUN | PASS |
| 7 | wash light: a paragraph is washed on its own lines | NOT RUN | PASS |
| 8 | wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | NOT RUN | PASS |
| 9 | wash light: a paragraph: the text keeps its colour under the wash | NOT RUN | PASS |
| 10 | wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text | NOT RUN | PASS |
| 11 | wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | NOT RUN | PASS |
| 12 | wash light: a paragraph: gone after the hold and fade | NOT RUN | PASS |
| 13 | wash light: a selection is washed on its own lines | NOT RUN | PASS |
| 14 | wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | NOT RUN | PASS |
| 15 | wash light: a selection: the text keeps its colour under the wash | NOT RUN | PASS |
| 16 | wash light: a selection: scrolled -680 px during the hold, the boxes follow the text | NOT RUN | PASS |
| 17 | wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | NOT RUN | PASS |
| 18 | wash light: a selection: gone after the hold and fade | NOT RUN | PASS |
| 19 | wash light: a table is washed on its own lines (one box 3 px around the table) | NOT RUN | PASS |
| 20 | wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | NOT RUN | PASS |
| 21 | wash light: a table: the text keeps its colour under the wash | NOT RUN | PASS |
| 22 | wash light: a table: scrolled 80 px during the hold, the boxes follow the text | NOT RUN | PASS |
| 23 | wash light: a table: gone after the hold and fade | NOT RUN | PASS |
| 24 | wash dark: ChatGPT shows its dark theme | NOT RUN | PASS |
| 25 | wash dark: the whole chat loads through the earlier-history dots | NOT RUN | PASS |
| 26 | wash dark: a paragraph is washed on its own lines | NOT RUN | PASS |
| 27 | wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | NOT RUN | PASS |
| 28 | wash dark: a paragraph: the text keeps its colour under the wash | NOT RUN | PASS |
| 29 | wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text | NOT RUN | PASS |
| 30 | wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | NOT RUN | PASS |
| 31 | wash dark: a paragraph: gone after the hold and fade | NOT RUN | PASS |
| 32 | wash dark: a selection is washed on its own lines | NOT RUN | PASS |
| 33 | wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | NOT RUN | PASS |
| 34 | wash dark: a selection: the text keeps its colour under the wash | NOT RUN | PASS |
| 35 | wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text | NOT RUN | PASS |
| 36 | wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | NOT RUN | PASS |
| 37 | wash dark: a selection: gone after the hold and fade | NOT RUN | PASS |
| 38 | wash dark: a table is washed on its own lines (one box 3 px around the table) | NOT RUN | PASS |
| 39 | wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | NOT RUN | PASS |
| 40 | wash dark: a table: the text keeps its colour under the wash | NOT RUN | PASS |
| 41 | wash dark: a table: scrolled 80 px during the hold, the boxes follow the text | NOT RUN | PASS |
| 42 | wash dark: a table: gone after the hold and fade | NOT RUN | PASS |

All four branch width runs satisfy: different branch identity, same latest reply, exactly one send click in the branch, every request after that click blocked, no original-tab send request, and only the native branch mutation allowed. Both attempts record zero Butter/page errors. Full style strings are retained in the branch data.

Final checkout status matches the pre-run status, with no tracked modification. Lab 1, lab 2 and perf are free. Task-owned snap extension copies were removed after restore/release. `data/final-state.json` preserves the final numeric/boolean state.

## Commands, artifacts and privacy

`commands.md` lists operational invocations, actual exit codes, durations and sanitized command output. `data/executions.json` carries the same records. Paths use `$B`, `$REPO`, `$WORK`, `$BUILD`, `$EXT`, `$DEPS` and `$RAW` placeholders to exclude private host paths. Raw screenshots, console logs and chat data remain outside the report directory.

`privacy-scan.json` records the final scan for UUIDs, conversation URLs, emails, both configured account labels, private paths, private endpoints/hostnames, forbidden artifacts and world-readable permissions. Final scan output is appended below.

### Final privacy scan output

The scan covers every exported text/script/data file; the scan-result file itself is excluded from `filesScanned`.

```json
{
  "filesScanned": 19,
  "accountLabelsChecked": 2,
  "uuidMatches": 0,
  "conversationUrlMatches": 0,
  "emailMatches": 0,
  "privateEndpointMatches": 0,
  "accountLabelMatches": 0,
  "privatePathMatches": 0,
  "privateHostMatches": 0,
  "forbiddenArtifactFiles": 0,
  "notWorldReadableFiles": 0,
  "violations": []
}
```
