# PR #91 fixed-head live-lab rerun — 2026-11-11

**Result: matrix 35/35 and wash 42/42; branch ready at 1280 and 800 px.** Ordered checks, cleanup and branch pill measurements match today’s saved main run. F1 now passes with two coverage scripts; F2’s doubled `bookmark.locate` counts are gone. Every prescribed run passed on its first attempt.

These are single runs, not a performance claim. Main was not rerun. Its observations come unchanged from the earlier run in this directory.

## Builds and method

- Earlier main: `fd1ab4ac034e5b4a49f6aa6cdb8779b0a11e316b`.
- Rerun PR #91: `e4aa4d8e0627fbd310efb8bca2abd280132173c0`.
- Fresh report clone checked out `origin/t3/bookmark-session-live`. An exact `git archive` of the PR SHA supplied its own unmodified harness and extension. `node_modules` linked to the installed Playwright 1.65.0. Harness snap copies were checked byte for byte; branch-live used a separate snap-readable copy.
- Matrix: default mode, lab 1, `LAB_FIXTURE=math12`, perf lock, three held drags per arm. Wash: lab 2, `LAB_FIXTURE=demo-en12`, `MODE=wash`, lab lock without perf. The unmodified harness waits 60 seconds for locks and restores then releases through the shared library.
- Branch: lab 1, `math12`, task-owned lab/perf lock with `--wait 1800`, matching extension loaded with a browser restart, `BRANCH_PATH='^/backend-api/conversation/new_branch$'`. Explicit `lab-restore` then `lab-lock release` followed its work.
- Send guard stayed on. No manual typing or live message was sent. As in the original method, the unmodified branch harness filled Butter’s test-question field, created native branches and attempted sends in those branches; all message requests were blocked. Only the exact native branch endpoint was allowed.
- No ChatGPT settings or language change. Wash temporarily changed the page theme attribute and reloaded. Matrix shortcuts and extension-local test state were restored or removed.
- The shared checkout was never edited, committed or pushed. `data/final-state-pr2.json` records its unchanged status and final lock state.

## Results and every attempt

| Harness | Build | Attempt | Passed/total | Exit | Seconds | Thrown error |
| --- | --- | --- | --- | --- | --- | --- |
| matrix | main | 1 | 35/35 | 0 | 303.283 | null |
| matrix | pr2 | 1 | 35/35 | 0 | 302.225 | null |
| wash | main | 1 | 42/42 | 0 | 134.525 | null |
| wash | pr2 | 1 | 42/42 | 0 | 133.218 | null |

### matrix: ordered check names and results

| # | Check | main | PR rerun |
| --- | --- | --- | --- |
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
| 34 | list item resolves live and lands on the same item after reload | PASS | PASS |
| 35 | card delete removes list item test bookmark | PASS | PASS |

Cleanup records, against main:

```json
{
  "main": {
    "remainingBeforeFallback": 0,
    "remainingAfterFallback": 0,
    "shortcutsRestored": true,
    "restored": true,
    "composerEmpty": true,
    "oneHomeTab": true,
    "defaultExtensions": true,
    "labLockReleased": true,
    "perfLockReleased": true
  },
  "bookmarks-matrix-pr2-1": {
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
}
```

### Held native scrollbar drags

Each cell: `held / updates / mounts / frames / p95 frame ms / max frame ms / bookmarkCoverageScripts / storage reads / storage messages`. The run has three repetitions per arm; these are single-run observations.

| Arm / repetition | main | PR rerun |
| --- | --- | --- |
| empty 1 | true / 34 / 0 / 85 / 16.7 / 16.8 / 1 / 0 / 0 | true / 31 / 0 / 85 / 16.7 / 16.8 / 2 / 0 / 0 |
| empty 2 | true / 32 / 0 / 85 / 16.7 / 16.8 / 1 / 0 / 0 | true / 31 / 0 / 88 / 16.8 / 16.8 / 2 / 0 / 0 |
| empty 3 | true / 32 / 0 / 84 / 16.7 / 16.8 / 1 / 0 / 0 | true / 31 / 0 / 86 / 16.7 / 16.8 / 2 / 0 / 0 |
| bookmarked 1 | true / 32 / 0 / 85 / 16.8 / 33.3 / 1 / 0 / 0 | true / 32 / 0 / 85 / 16.7 / 16.8 / 2 / 0 / 0 |
| bookmarked 2 | true / 32 / 0 / 84 / 16.7 / 16.8 / 1 / 0 / 0 | true / 32 / 0 / 86 / 16.7 / 16.8 / 2 / 0 / 0 |
| bookmarked 3 | true / 33 / 0 / 88 / 16.8 / 16.8 / 1 / 0 / 0 | true / 32 / 0 / 84 / 16.8 / 16.8 / 2 / 0 / 0 |

| Arm / repetition | main bookmarkWork | PR rerun bookmarkWork |
| --- | --- | --- |
| empty 1 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| empty 2 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| empty 3 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| bookmarked 1 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| bookmarked 2 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |
| bookmarked 3 | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} | {"refresh": 0, "paragraphs": 0, "measure": 0, "selection": 0, "topBlock": 0, "locate": 0, "create": 0, "remove": 0, "show": 0, "place": 0} |

### jumpEvidence calls by label

| Label | main calls | PR rerun calls |
| --- | --- | --- |
| after-drag | {"rail.jumpTo": 1, "rail.landOff": 25, "rail.targetTop": 7, "rail.jump": 6, "bookmark.locate": 25} | {"rail.jumpTo": 1, "rail.landOff": 26, "rail.targetTop": 7, "rail.jump": 6, "bookmark.locate": 26} |
| during-drag | {"rail.landOff": 45, "rail.targetTop": 9, "rail.jump": 6} | {"rail.landOff": 44, "rail.targetTop": 9, "rail.jump": 6} |
| unloaded-row | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 24} | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 24} |
| unloaded-keyboard | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 24} | {"rail.jumpTo": 1, "rail.earlierJump": 1, "rail.landOff": 24, "rail.targetTop": 5, "rail.jump": 1, "bookmark.locate": 24} |

| Label | main bookmark.locate | PR rerun bookmark.locate | main rail.landOff | PR rerun rail.landOff |
| --- | --- | --- | --- | --- |
| after-drag | 25 | 26 | 25 | 26 |
| during-drag | absent | absent | 45 | 44 |
| unloaded-row | 24 | 24 | 24 | 24 |
| unloaded-keyboard | 24 | 24 | 24 | 24 |

The locate count equals the landOff count for each recorded locate label on both builds. During-drag has no recorded `bookmark.locate` on either build. The earlier PR’s doubled probe counts were instrumentation from the adapter arrow; the fixed head no longer doubles them. Complete jump evidence is retained in the summaries and comparison JSON.

### wash: ordered check names and results

| # | Check | main | PR rerun |
| --- | --- | --- | --- |
| 1 | wash light: ChatGPT shows its light theme | PASS | PASS |
| 2 | wash light: the whole chat loads through the earlier-history dots | PASS | PASS |
| 3 | wash: a mounted answer holds two long paragraphs and a table | PASS | PASS |
| 4 | wash: the Bookmark cell bookmarks the paragraph | PASS | PASS |
| 5 | wash: the Bookmark cell bookmarks the selection | PASS | PASS |
| 6 | wash: the Bookmark cell bookmarks the table | PASS | PASS |
| 7 | wash light: a paragraph is washed on its own lines | PASS | PASS |
| 8 | wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS | PASS |
| 9 | wash light: a paragraph: the text keeps its colour under the wash | PASS | PASS |
| 10 | wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS | PASS |
| 11 | wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS | PASS |
| 12 | wash light: a paragraph: gone after the hold and fade | PASS | PASS |
| 13 | wash light: a selection is washed on its own lines | PASS | PASS |
| 14 | wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS | PASS |
| 15 | wash light: a selection: the text keeps its colour under the wash | PASS | PASS |
| 16 | wash light: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS | PASS |
| 17 | wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS | PASS |
| 18 | wash light: a selection: gone after the hold and fade | PASS | PASS |
| 19 | wash light: a table is washed on its own lines (one box 3 px around the table) | PASS | PASS |
| 20 | wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash | PASS | PASS |
| 21 | wash light: a table: the text keeps its colour under the wash | PASS | PASS |
| 22 | wash light: a table: scrolled 80 px during the hold, the boxes follow the text | PASS | PASS |
| 23 | wash light: a table: gone after the hold and fade | PASS | PASS |
| 24 | wash dark: ChatGPT shows its dark theme | PASS | PASS |
| 25 | wash dark: the whole chat loads through the earlier-history dots | PASS | PASS |
| 26 | wash dark: a paragraph is washed on its own lines | PASS | PASS |
| 27 | wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS | PASS |
| 28 | wash dark: a paragraph: the text keeps its colour under the wash | PASS | PASS |
| 29 | wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text | PASS | PASS |
| 30 | wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it | PASS | PASS |
| 31 | wash dark: a paragraph: gone after the hold and fade | PASS | PASS |
| 32 | wash dark: a selection is washed on its own lines | PASS | PASS |
| 33 | wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS | PASS |
| 34 | wash dark: a selection: the text keeps its colour under the wash | PASS | PASS |
| 35 | wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text | PASS | PASS |
| 36 | wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it | PASS | PASS |
| 37 | wash dark: a selection: gone after the hold and fade | PASS | PASS |
| 38 | wash dark: a table is washed on its own lines (one box 3 px around the table) | PASS | PASS |
| 39 | wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash | PASS | PASS |
| 40 | wash dark: a table: the text keeps its colour under the wash | PASS | PASS |
| 41 | wash dark: a table: scrolled 80 px during the hold, the boxes follow the text | PASS | PASS |
| 42 | wash dark: a table: gone after the hold and fade | PASS | PASS |

Cleanup records, against main:

```json
{
  "main": {
    "remainingBeforeFallback": 3,
    "remainingAfterFallback": 0,
    "restored": true,
    "composerEmpty": true,
    "oneHomeTab": true,
    "defaultExtensions": true,
    "labLockReleased": true,
    "perfLockReleased": false
  },
  "bookmarks-wash-pr2-1": {
    "remainingBeforeFallback": 3,
    "remainingAfterFallback": 0,
    "restored": true,
    "composerEmpty": true,
    "oneHomeTab": true,
    "defaultExtensions": true,
    "labLockReleased": true,
    "perfLockReleased": false
  }
}
```

Both sides record `drags=[]` and no `jumpEvidence`.

## Branch attempts, readiness and pill measurements

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

pr2 attempt 1: exit 0, 44.073 seconds; cleanup:

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

| Build | Width px | End | Gap px | Top delta px | Height | Radius | Looks match | Original unchanged |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| main | 1280 | ready | 4 | 0 | 30px | 8px | True | True |
| main | 800 | ready | 4 | 0 | 30px | 8px | True | True |
| pr2 | 1280 | ready | 4 | 0 | 30px | 8px | True | True |
| pr2 | 800 | ready | 4 | 0 | 30px | 8px | True | True |

Full public CSS measurements, request counts and safety booleans are in the branch JSON; screenshots, titles, identities, endpoint records and content fingerprints are excluded.

## Comparison output

```text
matrix ordered checks identical: True cleanup identical: True
wash ordered checks identical: True cleanup identical: True
branch pill measurements identical: True
branch ready at both widths in every attempt: True
```

## Send guard and final cleanup

| Attempt | Guard enabled | Send attempts | Blocked mutations |
| --- | --- | --- | --- |
| bookmarks-matrix-pr2-1 | True | 0 | 192 |
| bookmarks-wash-pr2-1 | True | 0 | 108 |

Wash held no perf lock, so its `perfLockReleased=false` is expected. Branch message requests were blocked, original tabs were unchanged, and only the native branch mutation was allowed. Task-owned snap copies were removed after restore and release. Raw captures remain local and are excluded.

## Commands and privacy

See [rerun-commands-pr2.md](rerun-commands-pr2.md) for the commands and actual sanitized output, `data/executions-pr2.json` for every measured invocation, and `privacy-scan-pr2.json` for the same privacy scan across this whole directory. All exported files are world-readable.


### Final privacy scan output

```json
{
  "filesScanned": 24,
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
