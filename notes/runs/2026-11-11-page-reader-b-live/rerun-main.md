# Main bookmarks-live rerun for PR #90 — 2026-11-11

matrix: main rerun 35/35; exit 0; 300.216 s. Saved PR run: 35/35. Ordered names/results identical: True; cleanup identical: True.

wash: main rerun 42/42; exit 0; 133.954 s. Saved PR run: 42/42. Ordered names/results identical: True; cleanup identical: True.

Exactly one fresh-archive run per mode; no retry. Main is `86f95e52ebb00fc3edd70856bcbba66e72222ca7`; PR reference is `3b5a6916b8b364c5ced20ed91e1c08689192ea6d`. The PR was not rerun.

## Method and safety

The prior report and command record were read first. A new `git archive` of the requested main commit was extracted outside the checkout, with `node_modules` linked to the same installed dependencies as the prior run. Playwright 1.65.0 and Chromium 156.0.8078.47 were used. Archived harness module sources matched the previous main archive byte for byte. Each harness verified its snap-readable extension copy against the archived source and removed that task copy during cleanup.

Matrix used lab 1, `LAB_FIXTURE=math12`, `MODE=matrix`, three drag repetitions per arm and the perf lock. Wash used lab 2, `LAB_FIXTURE=demo-en12`, `MODE=wash`, without a perf lock. Harness-owned lock operations were sequential; each session ran `lab-restore` before `lab-lock release`. The unchanged harness uses a 60-second lock wait, within the requested 30-minute maximum; both acquisitions succeeded.

The send guard stayed on. No message was typed or sent, and no ChatGPT account setting was changed. Wash changed only the page theme attribute for its dark pass; navigation restored the page theme. Matrix temporarily bound the extension shortcut and restored it. The shared checkout was not edited, committed or pushed. Private stdout/stderr and exception stacks remain outside the exports.

Extension tree SHA-256: `6165863f314ee6b6f449ad47907a9a2c7169296c0e08cf7422199587cf6be221`. Both modes match the original main digest: `true`.

## Script comparison output

`python3 rerun-main-compare.py` compares the complete ordered `(name, pass)` sequences and cleanup records with the saved PR summaries. Its actual output:

```text
matrix ordered checks identical: True cleanup identical: True
COUNTS {"mainRerun": {"passed": 35, "total": 35}, "pr": {"passed": 35, "total": 35}}
wash ordered checks identical: True cleanup identical: True
COUNTS {"mainRerun": {"passed": 42, "total": 42}, "pr": {"passed": 42, "total": 42}}
```

## Failures and prior observations

### matrix

No failed checks or harness exception.

The earlier main run failed this reload check. Rerun observation:

```json
{
  "name": "list item resolves live and lands on the same item after reload",
  "pass": true,
  "cold": {
    "ticks": 5,
    "marks": 1,
    "more": true,
    "stale": 0,
    "busy": 0,
    "targetMounted": false
  },
  "top": 64.34375,
  "bottom": 90.5625,
  "x": 762,
  "y": 128.34375,
  "height": 26.21875,
  "inView": true,
  "isListItem": true,
  "itemOrdinal": 3,
  "offsetFromListStart": 78.65625,
  "listTop": -14.3125,
  "landsOnItem": true,
  "matchingMessageAndExcerpt": true,
  "staleMarks": 0,
  "staleRows": 0
}
```

### wash

No failed checks or harness exception.

Earlier main completed 5 checks, then stopped in `wash-bookmark` with public label `paragraph target unmounted`; six wash jump scenarios were skipped. The rerun result above is retained without retries.

A live-run difference alone does not establish its cause. These outcomes record the requested additional observations; they do not attribute a main/PR difference to PR #90.

## Cleanup and send guard

### matrix

Main rerun:

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

Saved PR cleanup:

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

Main rerun send guard:

```json
{
  "enabled": true,
  "sendAttempts": 0,
  "blockedMutations": 194
}
```

### wash

Main rerun:

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

Saved PR cleanup:

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

Main rerun send guard:

```json
{
  "enabled": true,
  "sendAttempts": 0,
  "blockedMutations": 112
}
```

Wash takes no perf lock, so `perfLockReleased=false` is expected. The before-fallback bookmark count is a cleanup observation; successful fallback leaves zero test bookmarks.

Final read-only checkout, lock and extension verification:

```json
{
  "checkoutStatusUnchanged": true,
  "trackedDiffExit": 0,
  "lockStatusExit": 0,
  "locks": [
    {
      "lab": 1,
      "held": false,
      "owner": null
    },
    {
      "lab": 2,
      "held": false,
      "owner": null
    },
    {
      "lab": "perf",
      "held": false,
      "owner": null
    }
  ],
  "labBrowsers": [
    {
      "lab": 1,
      "browserRunning": true,
      "defaultExtensions": true,
      "extraFlagsCount": 0
    },
    {
      "lab": 2,
      "browserRunning": true,
      "defaultExtensions": true,
      "extraFlagsCount": 0
    }
  ],
  "taskExtensionCopiesObserved": 2,
  "observedTaskExtensionCopiesRemoved": true
}
```

## Held native scrollbar drags

Each cell is `held / updates / mounts / frames / p95 frame ms / max frame ms`. These are individual observations.

| Arm / repetition | main rerun | saved PR |
|---|---|---|
| empty 1 | true / 31 / 0 / 85 / 16.7 / 16.8 | true / 31 / 0 / 90 / 16.8 / 16.8 |
| empty 2 | true / 31 / 0 / 84 / 16.7 / 16.8 | true / 32 / 0 / 85 / 16.7 / 16.8 |
| empty 3 | true / 31 / 0 / 86 / 16.8 / 16.8 | true / 32 / 0 / 86 / 16.7 / 16.8 |
| bookmarked 1 | true / 32 / 0 / 83 / 16.7 / 16.8 | true / 33 / 0 / 84 / 16.8 / 16.8 |
| bookmarked 2 | true / 33 / 0 / 86 / 16.8 / 16.8 | true / 31 / 0 / 86 / 16.7 / 16.8 |
| bookmarked 3 | true / 32 / 0 / 86 / 16.7 / 16.8 | true / 31 / 0 / 85 / 16.7 / 16.8 |

Wash records no held-drag rows in either run (`drags=[]`).

## Ordered checks

The table compares the ordered names and results by position, preserving any name difference. Full associated measurements remain in each summary.

### matrix

| # | Main rerun check | Result | Saved PR check | Result |
|---:|---|---|---|---|
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

### wash

| # | Main rerun check | Result | Saved PR check | Result |
|---:|---|---|---|---|
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

## Commands and actual results

Private locations are represented by placeholders: `$REPO` is the unchanged checkout, `$WORK` the fresh archive area, `$BUILD` its main archive, `$DEPS` the same installed dependencies, `$RAW` the private result area, and `$B` the shared lab bin directory.

Read-only preparation used `cat`/`sed` for the prior report, command record, lab instructions, harness and original runner/privacy scripts; `rg`, `find`, `ls` and `readlink` located those scripts/dependencies. No live browser action was taken by those reads. An initial lookup of the unsuffixed old work directory returned “No such file or directory”; the actual suffixed directory was then located and read. `find` reported permission denied for unrelated system-owned temporary directories. The shared checkout contained only its pre-existing untracked files.

A read-only Python browser-argument probe returned `AttributeError` because that helper is provided only by the Node library. The Node probe then captured one task-extension path per mode for the final removal check; no browser state was changed.

Fresh-archive setup (Python, outside the checkout):

- `git archive 86f95e52ebb00fc3edd70856bcbba66e72222ca7` plus Python tar extraction: exit 0, no textual output; new archive extracted.
- Python `node_modules` symlink creation: succeeded; same dependency target as the prior runner.
- `node -p 'require("./node_modules/playwright/package.json").version'`: exit 0; output `1.65.0`.
- Python comparison of archived harness module bytes with the previous archive: `true`.
- `$B/lab-lock status` before runs: labs 1, 2 and perf all `held=false`, `owner=null`.

One-run-per-mode wrapper commands (a `.started` sentinel prevents a second invocation):

`python3 "$WORK/run-mode.py" matrix` executed:

```sh
EXT="$BUILD/extension" OUT="$RAW/bookmarks-matrix-main-rerun" TESTED_HEAD="86f95e52ebb00fc3edd70856bcbba66e72222ca7" LAB_FIXTURE=math12 MODE=matrix LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs
```

Actual process result, recorded from its exit and allowlisted summary:

```json
{
  "mode": "matrix",
  "exit": 0,
  "seconds": 300.216,
  "command": "EXT=\"$BUILD/extension\" OUT=\"$RAW/bookmarks-matrix-main-rerun\" TESTED_HEAD=\"86f95e52ebb00fc3edd70856bcbba66e72222ca7\" LAB_FIXTURE=math12 MODE=matrix LAB_PLAYWRIGHT=\"$DEPS/playwright\" node lab/harness/bookmarks-live.mjs",
  "passed": 35,
  "total": 35,
  "failure": null,
  "cleanup": {
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
  "sendGuard": {
    "enabled": true,
    "sendAttempts": 0,
    "blockedMutations": 194
  }
}
```

`python3 "$WORK/run-mode.py" wash` executed:

```sh
EXT="$BUILD/extension" OUT="$RAW/bookmarks-wash-main-rerun" TESTED_HEAD="86f95e52ebb00fc3edd70856bcbba66e72222ca7" LAB_FIXTURE=demo-en12 MODE=wash LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs
```

Actual process result, recorded from its exit and allowlisted summary:

```json
{
  "mode": "wash",
  "exit": 0,
  "seconds": 133.954,
  "command": "EXT=\"$BUILD/extension\" OUT=\"$RAW/bookmarks-wash-main-rerun\" TESTED_HEAD=\"86f95e52ebb00fc3edd70856bcbba66e72222ca7\" LAB_FIXTURE=demo-en12 MODE=wash LAB_PLAYWRIGHT=\"$DEPS/playwright\" node lab/harness/bookmarks-live.mjs",
  "passed": 42,
  "total": 42,
  "failure": null,
  "cleanup": {
    "remainingBeforeFallback": 3,
    "remainingAfterFallback": 0,
    "restored": true,
    "composerEmpty": true,
    "oneHomeTab": true,
    "defaultExtensions": true,
    "labLockReleased": true,
    "perfLockReleased": false
  },
  "sendGuard": {
    "enabled": true,
    "sendAttempts": 0,
    "blockedMutations": 112
  }
}
```

The harness internally invoked `lab restart-browser`, `lab-restore`, then `lab-lock release`; restoration and release results are recorded above. The matrix run was observed holding lab 1 and perf; the wash run was observed holding lab 2 only. No further live mode was run.

`python3 "$WORK/report.py"`: exit 0; output `generated rerun-main.md and rerun-main-executions.json`.

`node "$WORK/final-state.mjs"`: exit 0. Final verification read `git status --porcelain=v1 -uall`, `git diff --quiet`, `lab-lock status` and lab browser arguments; its actual allowlisted output is the final-state JSON above. Files were set to mode 0644 and export directories to 0755.

## Privacy scan

The original privacy scanner was reused with its input scope restricted to the seven new report/data/script files and its result written separately. It checks account labels, UUIDs, conversation URLs, emails, private endpoints/hosts/paths, forbidden artifacts and world readability. No original report or PR summary was replaced.

`python3 "$WORK/privacy.py"`: actual output (exit 0):

```json
{
  "filesScanned": 7,
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

The scan was run again after its output was embedded in this report; it returned the same zero-violation result.

Artifacts: `data/bookmarks-matrix-main-rerun/summary.json`, `data/bookmarks-wash-main-rerun/summary.json`, `rerun-main-compare.py`, `data/rerun-main-comparison.json`, `data/rerun-main-executions.json`, `data/rerun-main-final-state.json`, `rerun-main-privacy-scan.json`.
