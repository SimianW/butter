# Butter main vs PR #91: live-lab smoke — 2026-11-11

**Result: raw matrix results differ by expected harness finding F1; all other prescribed checks pass.**

Review finding **F1** is the expected PR matrix harness failure: `drag-bookmarked` still requires `bookmarkCoverageScripts === 1` in `matrix.mjs:143`, while the PR records two scripts. Per the lead update, this sole expected failure did not trigger a PR matrix retry. The six individual held-drag checks and every other matrix check passed. A future PR head is outside this report.

All six harness runs completed in one attempt; the expected F1 failure was not rerun. Numerical drag observations and function-call counts can differ without a failed check. These are single runs, not a performance claim.

## Builds and method

- Main: `fd1ab4ac034e5b4a49f6aa6cdb8779b0a11e316b`.
- PR #91 (`t3/bookmark-session`): `e6d9f5f38e705ac7954a22a96bc20d8b83355a85`. These exact SHAs were archived; each side ran its own unmodified harness files.
- Separate `git archive` copies; `node_modules` linked to installed Playwright 1.65.0. Each harness installed a byte-for-byte snap-readable extension copy; separate snap copies were used for branch-live. The shared checkout was never edited, committed or pushed.
- Method: `origin/main:notes/runs/2026-11-11-page-reader-b-live/report.md`. Matrix: main then PR, lab 1, `math12`, default mode, perf lock, three repetitions per arm. Wash: main then PR, lab 2, `demo-en12`, `MODE=wash`, lab lock, no perf lock. Branch: main then PR, lab 1, `math12`, task-owned lab/perf locks, matching extension and browser restart before every attempt.
- Harness-owned locks waited up to 60 seconds; task-owned branch locks used `--wait 1800`. All acquired successfully. Harness cleanup called the shared `L.restore` then `L.release` (the same implementation used by `lab-restore`/`lab-lock release`); branch cleanup invoked those commands explicitly.
- Send guard stayed on. No manual typing or live message was sent. As in the previous method, branch-live filled Butter's test-question field, created native branches, and attempted a guarded send in each branch; message requests were blocked. Only the exact native branch endpoint was allowed: `BRANCH_PATH='^/backend-api/conversation/new_branch$'`.
- No ChatGPT settings or language change. Wash changed the page's theme attribute temporarily and reloaded afterward. Extension-local test settings and matrix shortcut bindings were restored/removed by cleanup.
- branch-live-edges, nav-earlier and nav-takeovers were excluded as requested.

## Results and attempts

| Harness | Build | Attempt | Passed/total | Exit | Seconds | Thrown error |
| --- | --- | --- | --- | --- | --- | --- |
| matrix | main | 1 | 35/35 | 0 | 303.283 | null |
| matrix | pr | 1 | 34/35 | 1 | 305.152 | null |
| wash | main | 1 | 42/42 | 0 | 134.525 | null |
| wash | pr | 1 | 42/42 | 0 | 133.267 | null |

PR matrix duration comes from its summary start/finish timestamps; other durations are measured subprocess wall times.

### matrix: ordered check names and results

main, attempt 1: 35/35; cleanup:

```json
{
  "remainingBeforeFallback": 0,
  "remainingAfterFallback": 0,
  "shortcutsRestored": true,
  "restored": true,
  "composerEmpty": true,
  "oneHomeTab": true,
  "defaultExtensions": true,
  "labLockReleased": true,
  "perfLockReleased": true
}
```

| # | Check | Result |
| --- | --- | --- |
| 1 | real long fixture loaded | PASS |
| 2 | held drag empty 1 | PASS |
| 3 | held drag empty 2 | PASS |
| 4 | held drag empty 3 | PASS |
| 5 | live selection message ids match conversation API by SHA-256 | PASS |
| 6 | the Bookmark cell is named Bookmark selection | PASS |
| 7 | paragraph button saves one bookmark | PASS |
| 8 | selection saved through real Alt+Shift+M | PASS |
| 9 | held drag bookmarked 1 | PASS |
| 10 | held drag bookmarked 2 | PASS |
| 11 | held drag bookmarked 3 | PASS |
| 12 | matched drag comparison with bookmarks versus empty | PASS |
| 13 | selection card jump after drag lands on text | PASS |
| 14 | paragraph jump requested during native drag lands on text | PASS |
| 15 | reload before row click leaves earlier answer unloaded | PASS |
| 16 | earlier bookmarks sit under dots and not a loaded tick (row) | PASS |
| 17 | hover earlier segment shows 2-bookmark card (row) | PASS |
| 18 | row click loads earlier pages and lands on requested text | PASS |
| 19 | segment moves from dots to loaded question after row click | PASS |
| 20 | reload before keyboard click leaves earlier answer unloaded | PASS |
| 21 | earlier bookmarks sit under dots and not a loaded tick (keyboard) | PASS |
| 22 | hover earlier segment shows 2-bookmark card (keyboard) | PASS |
| 23 | keyboard click loads earlier pages and lands on requested text | PASS |
| 24 | segment moves from dots to loaded question after keyboard click | PASS |
| 25 | reload resolves both bookmarks live without answer changed | PASS |
| 26 | card delete removes selection bookmark | PASS |
| 27 | earlier bookmarks sit under dots and not a loaded tick (single) | PASS |
| 28 | hover earlier segment shows 1-bookmark card (single) | PASS |
| 29 | card delete removes both test bookmarks | PASS |
| 30 | real fixture has a later top-level list item for distinct landing | PASS |
| 31 | list item: the Bookmark cell is named Bookmark selection | PASS |
| 32 | list item button saves its individual paragraph with ask and line | PASS |
| 33 | list item jump lands on the item instead of the list start | PASS |
| 34 | list item resolves live and lands on the same item after reload | PASS |
| 35 | card delete removes list item test bookmark | PASS |

pr, attempt 1: 34/35; cleanup:

```json
{
  "remainingBeforeFallback": 0,
  "remainingAfterFallback": 0,
  "shortcutsRestored": true,
  "restored": true,
  "composerEmpty": true,
  "oneHomeTab": true,
  "defaultExtensions": true,
  "labLockReleased": true,
  "perfLockReleased": true
}
```

| # | Check | Result |
| --- | --- | --- |
| 1 | real long fixture loaded | PASS |
| 2 | held drag empty 1 | PASS |
| 3 | held drag empty 2 | PASS |
| 4 | held drag empty 3 | PASS |
| 5 | live selection message ids match conversation API by SHA-256 | PASS |
| 6 | the Bookmark cell is named Bookmark selection | PASS |
| 7 | paragraph button saves one bookmark | PASS |
| 8 | selection saved through real Alt+Shift+M | PASS |
| 9 | held drag bookmarked 1 | PASS |
| 10 | held drag bookmarked 2 | PASS |
| 11 | held drag bookmarked 3 | PASS |
| 12 | matched drag comparison with bookmarks versus empty | FAIL |
| 13 | selection card jump after drag lands on text | PASS |
| 14 | paragraph jump requested during native drag lands on text | PASS |
| 15 | reload before row click leaves earlier answer unloaded | PASS |
| 16 | earlier bookmarks sit under dots and not a loaded tick (row) | PASS |
| 17 | hover earlier segment shows 2-bookmark card (row) | PASS |
| 18 | row click loads earlier pages and lands on requested text | PASS |
| 19 | segment moves from dots to loaded question after row click | PASS |
| 20 | reload before keyboard click leaves earlier answer unloaded | PASS |
| 21 | earlier bookmarks sit under dots and not a loaded tick (keyboard) | PASS |
| 22 | hover earlier segment shows 2-bookmark card (keyboard) | PASS |
| 23 | keyboard click loads earlier pages and lands on requested text | PASS |
| 24 | segment moves from dots to loaded question after keyboard click | PASS |
| 25 | reload resolves both bookmarks live without answer changed | PASS |
| 26 | card delete removes selection bookmark | PASS |
| 27 | earlier bookmarks sit under dots and not a loaded tick (single) | PASS |
| 28 | hover earlier segment shows 1-bookmark card (single) | PASS |
| 29 | card delete removes both test bookmarks | PASS |
| 30 | real fixture has a later top-level list item for distinct landing | PASS |
| 31 | list item: the Bookmark cell is named Bookmark selection | PASS |
| 32 | list item button saves its individual paragraph with ask and line | PASS |
| 33 | list item jump lands on the item instead of the list start | PASS |
| 34 | list item resolves live and lands on the same item after reload | PASS |
| 35 | card delete removes list item test bookmark | PASS |

### matrix: held native scrollbar drags

Each cell is `held / updates / mounts / frames / p95 frame ms / max frame ms / bookmarkCoverageScripts / storage reads / storage messages`. These are single-run observations, not a performance claim. All attempts are in the data files.

| Arm / repetition | main | PR |
| --- | --- | --- |
| empty 1 | true / 34 / 0 / 85 / 16.7 / 16.8 / 1 / 0 / 0 | true / 32 / 0 / 85 / 16.7 / 16.8 / 2 / 0 / 0 |
| empty 2 | true / 32 / 0 / 85 / 16.7 / 16.8 / 1 / 0 / 0 | true / 32 / 0 / 84 / 16.7 / 16.8 / 2 / 0 / 0 |
| empty 3 | true / 32 / 0 / 84 / 16.7 / 16.8 / 1 / 0 / 0 | true / 32 / 0 / 85 / 16.7 / 16.8 / 2 / 0 / 0 |
| bookmarked 1 | true / 32 / 0 / 85 / 16.8 / 33.3 / 1 / 0 / 0 | true / 32 / 0 / 85 / 16.8 / 16.8 / 2 / 0 / 0 |
| bookmarked 2 | true / 32 / 0 / 84 / 16.7 / 16.8 / 1 / 0 / 0 | true / 32 / 0 / 85 / 16.8 / 16.8 / 2 / 0 / 0 |
| bookmarked 3 | true / 33 / 0 / 88 / 16.8 / 16.8 / 1 / 0 / 0 | true / 31 / 0 / 88 / 16.7 / 16.8 / 2 / 0 / 0 |

| Arm / repetition | main bookmarkWork | PR bookmarkWork |
| --- | --- | --- |
| empty 1 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| empty 2 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| empty 3 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| bookmarked 1 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| bookmarked 2 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| bookmarked 3 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |

### matrix: jumpEvidence by label

Full unabridged observations are in each build's `data/bookmarks-matrix-<build>-1/summary.json`. The table lists every label; seek-state cells give the ordered distinct states and the total event count. Target booleans count events whose target equals the bookmarked question.

| Build | Label | Calls | Clicks / keys | Seek states / count | Target matches | Paragraph / selection in view |
|---|---|---|---|---|---|---|
| main | after-drag | {"rail.jumpTo": 1, "rail.landOff": 25, "rail.targetTop": 7, "rail.jump": 6, "bookmark.locate": 25} | {"clicks": [{"control": "go", "trusted": true, "detail": 1}], "keys": [{"key": "ArrowLeft", "control": "mark", "trusted": true}]} | [] / 0 | 0 / 0 | False / True |
| main | during-drag | {"rail.landOff": 45, "rail.targetTop": 9, "rail.jump": 6} | {"clicks": [{"control": "mark", "trusted": true, "detail": 0}], "keys": [{"key": "ArrowLeft", "control": "mark", "trusted": true}, {"key": "Enter", "control": "mark", "trusted": true}]} | ["dragging", "loading", "idle"] / 50 | 17 / 50 | True / False |
| main | unloaded-row | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 24} | {"clicks": [{"control": "go", "trusted": true, "detail": 1}], "keys": []} | [] / 0 | 0 / 0 | False / True |
| main | unloaded-keyboard | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 24} | {"clicks": [{"control": "go", "trusted": true, "detail": 0}], "keys": [{"key": "ArrowLeft", "control": "mark", "trusted": true}, {"key": "Enter", "control": "other", "trusted": true}]} | [] / 0 | 0 / 0 | True / False |
| pr | after-drag | {"rail.jumpTo": 1, "rail.landOff": 25, "rail.targetTop": 7, "rail.jump": 6, "bookmark.locate": 50} | {"clicks": [{"control": "go", "trusted": true, "detail": 1}], "keys": [{"key": "ArrowLeft", "control": "mark", "trusted": true}]} | [] / 0 | 0 / 0 | False / True |
| pr | during-drag | {"rail.landOff": 44, "rail.targetTop": 9, "rail.jump": 6} | {"clicks": [{"control": "mark", "trusted": true, "detail": 0}], "keys": [{"key": "ArrowLeft", "control": "mark", "trusted": true}, {"key": "Enter", "control": "mark", "trusted": true}]} | ["dragging", "loading", "idle"] / 49 | 17 / 49 | True / False |
| pr | unloaded-row | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 23, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 46} | {"clicks": [{"control": "go", "trusted": true, "detail": 1}], "keys": []} | [] / 0 | 0 / 0 | False / True |
| pr | unloaded-keyboard | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 48} | {"clicks": [{"control": "go", "trusted": true, "detail": 0}], "keys": [{"key": "ArrowLeft", "control": "mark", "trusted": true}, {"key": "Enter", "control": "other", "trusted": true}]} | [] / 0 | 0 / 0 | True / False |

`bookmark.locate` counts (main / PR): after-drag 25 / 50; during-drag absent on both; unloaded-row 24 / 46; unloaded-keyboard 24 / 48. The PR coverage also sees the page-adapter arrow named `locate` in `content.js`. These observed differences are not check failures or performance claims.

### wash: ordered check names and results

main, attempt 1: 42/42; cleanup:

```json
{
  "remainingBeforeFallback": 3,
  "remainingAfterFallback": 0,
  "restored": true,
  "composerEmpty": true,
  "oneHomeTab": true,
  "defaultExtensions": true,
  "labLockReleased": true,
  "perfLockReleased": false
}
```

| # | Check | Result |
| --- | --- | --- |
| 1 | wash light: ChatGPT shows its light theme | PASS |
| 2 | wash light: the whole chat loads through the earlier-history dots | PASS |
| 3 | wash: a mounted answer holds two long paragraphs and a table | PASS |
| 4 | wash: the Bookmark cell bookmarks the paragraph | PASS |
| 5 | wash: the Bookmark cell bookmarks the selection | PASS |
| 6 | wash: the Bookmark cell bookmarks the table | PASS |
| 7 | wash light: a paragraph is washed on its own lines | PASS |
| 8 | wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 9 | wash light: a paragraph: the text keeps its colour under the wash | PASS |
| 10 | wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS |
| 11 | wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS |
| 12 | wash light: a paragraph: gone after the hold and fade | PASS |
| 13 | wash light: a selection is washed on its own lines | PASS |
| 14 | wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 15 | wash light: a selection: the text keeps its colour under the wash | PASS |
| 16 | wash light: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS |
| 17 | wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS |
| 18 | wash light: a selection: gone after the hold and fade | PASS |
| 19 | wash light: a table is washed on its own lines (one box 3 px around the table) | PASS |
| 20 | wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 21 | wash light: a table: the text keeps its colour under the wash | PASS |
| 22 | wash light: a table: scrolled 80 px during the hold, the boxes follow the text | PASS |
| 23 | wash light: a table: gone after the hold and fade | PASS |
| 24 | wash dark: ChatGPT shows its dark theme | PASS |
| 25 | wash dark: the whole chat loads through the earlier-history dots | PASS |
| 26 | wash dark: a paragraph is washed on its own lines | PASS |
| 27 | wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 28 | wash dark: a paragraph: the text keeps its colour under the wash | PASS |
| 29 | wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS |
| 30 | wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS |
| 31 | wash dark: a paragraph: gone after the hold and fade | PASS |
| 32 | wash dark: a selection is washed on its own lines | PASS |
| 33 | wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 34 | wash dark: a selection: the text keeps its colour under the wash | PASS |
| 35 | wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS |
| 36 | wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS |
| 37 | wash dark: a selection: gone after the hold and fade | PASS |
| 38 | wash dark: a table is washed on its own lines (one box 3 px around the table) | PASS |
| 39 | wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 40 | wash dark: a table: the text keeps its colour under the wash | PASS |
| 41 | wash dark: a table: scrolled 80 px during the hold, the boxes follow the text | PASS |
| 42 | wash dark: a table: gone after the hold and fade | PASS |

pr, attempt 1: 42/42; cleanup:

```json
{
  "remainingBeforeFallback": 3,
  "remainingAfterFallback": 0,
  "restored": true,
  "composerEmpty": true,
  "oneHomeTab": true,
  "defaultExtensions": true,
  "labLockReleased": true,
  "perfLockReleased": false
}
```

| # | Check | Result |
| --- | --- | --- |
| 1 | wash light: ChatGPT shows its light theme | PASS |
| 2 | wash light: the whole chat loads through the earlier-history dots | PASS |
| 3 | wash: a mounted answer holds two long paragraphs and a table | PASS |
| 4 | wash: the Bookmark cell bookmarks the paragraph | PASS |
| 5 | wash: the Bookmark cell bookmarks the selection | PASS |
| 6 | wash: the Bookmark cell bookmarks the table | PASS |
| 7 | wash light: a paragraph is washed on its own lines | PASS |
| 8 | wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 9 | wash light: a paragraph: the text keeps its colour under the wash | PASS |
| 10 | wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS |
| 11 | wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS |
| 12 | wash light: a paragraph: gone after the hold and fade | PASS |
| 13 | wash light: a selection is washed on its own lines | PASS |
| 14 | wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 15 | wash light: a selection: the text keeps its colour under the wash | PASS |
| 16 | wash light: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS |
| 17 | wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS |
| 18 | wash light: a selection: gone after the hold and fade | PASS |
| 19 | wash light: a table is washed on its own lines (one box 3 px around the table) | PASS |
| 20 | wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS |
| 21 | wash light: a table: the text keeps its colour under the wash | PASS |
| 22 | wash light: a table: scrolled 80 px during the hold, the boxes follow the text | PASS |
| 23 | wash light: a table: gone after the hold and fade | PASS |
| 24 | wash dark: ChatGPT shows its dark theme | PASS |
| 25 | wash dark: the whole chat loads through the earlier-history dots | PASS |
| 26 | wash dark: a paragraph is washed on its own lines | PASS |
| 27 | wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 28 | wash dark: a paragraph: the text keeps its colour under the wash | PASS |
| 29 | wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS |
| 30 | wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS |
| 31 | wash dark: a paragraph: gone after the hold and fade | PASS |
| 32 | wash dark: a selection is washed on its own lines | PASS |
| 33 | wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 34 | wash dark: a selection: the text keeps its colour under the wash | PASS |
| 35 | wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS |
| 36 | wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS |
| 37 | wash dark: a selection: gone after the hold and fade | PASS |
| 38 | wash dark: a table is washed on its own lines (one box 3 px around the table) | PASS |
| 39 | wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS |
| 40 | wash dark: a table: the text keeps its colour under the wash | PASS |
| 41 | wash dark: a table: scrolled 80 px during the hold, the boxes follow the text | PASS |
| 42 | wash dark: a table: gone after the hold and fade | PASS |

### wash: held native scrollbar drags

Each cell is `held / updates / mounts / frames / p95 frame ms / max frame ms / bookmarkCoverageScripts / storage reads / storage messages`. These are single-run observations, not a performance claim. All attempts are in the data files.

Both builds record `drags=[]`.

### wash: jumpEvidence by label

main:

```json
{}
```

PR:

```json
{}
```

The comparison retains all jump evidence, including coordinates, trusted input and seek states. Function-call differences are observations, not check failures.

## Branch attempts and pill measurements

main attempt 1: exit 0, 43.545 seconds; cleanup:

```json
{
  "restore": {
    "ok": true,
    "composerEmpty": true,
    "oneHomeTab": true,
    "noExtraFlags": true,
    "defaultExtensions": true
  },
  "release": {
    "lab": 1,
    "lab_released": true,
    "perf_released": true
  }
}
```

pr attempt 1: exit 0, 43.833 seconds; cleanup:

```json
{
  "restore": {
    "ok": true,
    "composerEmpty": true,
    "oneHomeTab": true,
    "noExtraFlags": true,
    "defaultExtensions": true
  },
  "release": {
    "lab": 1,
    "lab_released": true,
    "perf_released": true
  }
}
```

| Build | Attempt | Width px | End | Gap px | Top delta px | Height | Radius | Looks match | Original unchanged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main | 1 | 1280 | ready | 4 | 0 | 30px | 8px | True | True |
| main | 1 | 800 | ready | 4 | 0 | 30px | 8px | True | True |
| pr | 1 | 1280 | ready | 4 | 0 | 30px | 8px | True | True |
| pr | 1 | 800 | ready | 4 | 0 | 30px | 8px | True | True |

Sanitized branch JSON retains full public CSS measurements, original-tab comparisons, request counts and safety booleans. It excludes screenshots, account labels, titles, chat identities, endpoint records and content fingerprints.

## Script comparison output

```text
matrix ordered checks identical: False cleanup identical: True
DIFFERENCE {"index": 12, "main": ["matched drag comparison with bookmarks versus empty", true], "pr": ["matched drag comparison with bookmarks versus empty", false]}
wash ordered checks identical: True cleanup identical: True
branch pill measurements identical: True
branch ready at both widths in every attempt: True
```

`compare.py` compares the complete ordered `(name, pass)` sequences of the final attempts, cleanup records and branch pill measurements. It also preserves all attempt counts. The raw numerical observations are not expected to be identical.

## Send guard and cleanup

| Attempt | Guard enabled | Send attempts | Blocked mutations |
| --- | --- | --- | --- |
| bookmarks-matrix-main-1 | True | 0 | 191 |
| bookmarks-matrix-pr-1 | True | 0 | 190 |
| bookmarks-wash-main-1 | True | 0 | 114 |
| bookmarks-wash-pr-1 | True | 0 | 111 |

Wash takes no perf lock, so `perfLockReleased=false` is expected. All harness cleanup records are shown above. All task-owned locks were released and snap extension copies removed. Final read-only checkout/lock verification is in `data/final-state.json`.

## Commands, artifacts and privacy

`commands.md` lists commands, actual exits, durations and sanitized outputs. `data/executions.json` is the execution ledger. Paths use placeholders to exclude private host paths. Raw screenshots, console logs and exception stacks are excluded.

`privacy-scan.json` records the scan for UUIDs, conversation URLs, emails, the configured account labels, private paths/endpoints/hosts and forbidden artifacts.


### Final privacy scan output

```json
{
  "filesScanned": 13,
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
