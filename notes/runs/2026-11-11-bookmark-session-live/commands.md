# Commands and actual results

Paths are placeholders: `$REPO` is the unchanged checkout; `$WORK` the two archive copies; `$RAW` private harness outputs; `$B` the lab bin directory; `$DEPS` installed dependencies; `$EXT_MAIN`/`$EXT_PR` the snap-readable branch extension copies.

Preparatory commands (all exit 0 unless stated):

- `git fetch origin`: updated `origin/main` to `fd1ab4a` and fetched `origin/t3/bookmark-session`.
- `git show origin/main:notes/runs/2026-11-11-page-reader-b-live/report.md` and `commands.md`/`compare.py`: read previous method in full.
- `cat lab/README.md notes/runs/README.md "$LAB_ROOT/README.md"`: read required instructions in full.
- `git status --porcelain=v1`: pre-existing untracked files; no tracked changes.
- `git rev-parse fd1ab4a e6d9f5f`: SHAs in `data/builds.json`.
- `git archive <SHA>` piped through Python tarfile into `$WORK/main` and `$WORK/pr`: extracted separate copies.
- Python `Path.symlink_to` linked both `node_modules` to installed dependencies; `shutil.copytree` created snap-readable extension copies.
- `node -p 'require("./node_modules/playwright/package.json").version'`: `1.65.0`.
- `git diff fd1ab4a e6d9f5f -- lab/harness`: only `bookmarks-live/drag.mjs` changed, adding session coverage and the expected script count of two.
- `rg`/`sed`/`cat` reads inspected harness, guard, locking and cleanup. An initial read against the older shared checkout exited 2 for missing split-harness paths; the archived files were then inspected. A broad `rg --files` search exited 2 on inaccessible system temporary directories; dependencies were verified directly.
- `git clone https://github.com/SimianW/butter <fresh-clone>`: exit 0.
- `git switch -c t3/bookmark-session-live origin/main` in the fresh clone: exit 0, new tracking branch created.

The lead identified expected harness finding F1 during the PR matrix run and requested no retry if it was the only failure. The external Python runner was paused, the unmodified harness completed normally, and its actual process exit was read from the child process status. The runner was then replaced with a wash/branch-only continuation. PR matrix duration is `finishedUtc - startedUtc` from its summary; other durations are subprocess wall times. No harness or extension source was changed.

## Recorded harness commands

| Run | Command | Exit | Seconds |
|---|---|---:|---:|
| bookmarks-matrix-main-1 | `EXT="$WORK/main/extension" OUT="$RAW/bookmarks-matrix-main-1" TESTED_HEAD="fd1ab4ac034e5b4a49f6aa6cdb8779b0a11e316b" LAB_FIXTURE=math12 MODE=matrix LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 0 | 303.283 |
| bookmarks-matrix-pr-1 | `EXT="$WORK/pr/extension" OUT="$RAW/bookmarks-matrix-pr-1" TESTED_HEAD="e6d9f5f38e705ac7954a22a96bc20d8b83355a85" LAB_FIXTURE=math12 MODE=matrix LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 1 | 305.152 |
| bookmarks-wash-main-1 | `EXT="$WORK/main/extension" OUT="$RAW/bookmarks-wash-main-1" TESTED_HEAD="fd1ab4ac034e5b4a49f6aa6cdb8779b0a11e316b" LAB_FIXTURE=demo-en12 MODE=wash LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 0 | 134.525 |
| bookmarks-wash-pr-1 | `EXT="$WORK/pr/extension" OUT="$RAW/bookmarks-wash-pr-1" TESTED_HEAD="e6d9f5f38e705ac7954a22a96bc20d8b83355a85" LAB_FIXTURE=demo-en12 MODE=wash LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 0 | 133.267 |
| branch-live-main-1-acquire | `'$B/lab-lock' acquire --lab 1 --owner butter-bookmark-session-main-1 --wait 1800 --perf` | 0 | 0.051 |
| branch-live-main-1-restart | `LAB_ID=1 LAB_EXTENSIONS="$EXT" LAB_FLAGS="--disable-extensions-except=$EXT" '$B/lab' restart-browser` | 0 | 2.026 |
| branch-live-main-1 | `LAB_ID=1 LAB_OWNER=butter-bookmark-session-main-1 BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=branch-live-main-1.json LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/branch-live.mjs` | 0 | 43.545 |
| branch-live-main-1-restore | `'$B/lab-restore' --lab 1 --owner butter-bookmark-session-main-1` | 0 | 10.262 |
| branch-live-main-1-release | `'$B/lab-lock' release --lab 1 --owner butter-bookmark-session-main-1` | 0 | 0.057 |
| branch-live-pr-1-acquire | `'$B/lab-lock' acquire --lab 1 --owner butter-bookmark-session-pr-1 --wait 1800 --perf` | 0 | 0.052 |
| branch-live-pr-1-restart | `LAB_ID=1 LAB_EXTENSIONS="$EXT" LAB_FLAGS="--disable-extensions-except=$EXT" '$B/lab' restart-browser` | 0 | 2.028 |
| branch-live-pr-1 | `LAB_ID=1 LAB_OWNER=butter-bookmark-session-pr-1 BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=branch-live-pr-1.json LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/branch-live.mjs` | 0 | 43.833 |
| branch-live-pr-1-restore | `'$B/lab-restore' --lab 1 --owner butter-bookmark-session-pr-1` | 0 | 10.368 |
| branch-live-pr-1-release | `'$B/lab-lock' release --lab 1 --owner butter-bookmark-session-pr-1` | 0 | 0.051 |

## Actual sanitized outputs

Harness stdout/console logs are excluded. The following is the ordered check output reconstructed directly from the saved harness observations; no result was inferred.

`bookmarks-matrix-main-1`: 35/35; exit 0.

```text
PASS real long fixture loaded
PASS held drag empty 1
PASS held drag empty 2
PASS held drag empty 3
PASS live selection message ids match conversation API by SHA-256
PASS the Bookmark cell is named Bookmark selection
PASS paragraph button saves one bookmark
PASS selection saved through real Alt+Shift+M
PASS held drag bookmarked 1
PASS held drag bookmarked 2
PASS held drag bookmarked 3
PASS matched drag comparison with bookmarks versus empty
PASS selection card jump after drag lands on text
PASS paragraph jump requested during native drag lands on text
PASS reload before row click leaves earlier answer unloaded
PASS earlier bookmarks sit under dots and not a loaded tick (row)
PASS hover earlier segment shows 2-bookmark card (row)
PASS row click loads earlier pages and lands on requested text
PASS segment moves from dots to loaded question after row click
PASS reload before keyboard click leaves earlier answer unloaded
PASS earlier bookmarks sit under dots and not a loaded tick (keyboard)
PASS hover earlier segment shows 2-bookmark card (keyboard)
PASS keyboard click loads earlier pages and lands on requested text
PASS segment moves from dots to loaded question after keyboard click
PASS reload resolves both bookmarks live without answer changed
PASS card delete removes selection bookmark
PASS earlier bookmarks sit under dots and not a loaded tick (single)
PASS hover earlier segment shows 1-bookmark card (single)
PASS card delete removes both test bookmarks
PASS real fixture has a later top-level list item for distinct landing
PASS list item: the Bookmark cell is named Bookmark selection
PASS list item button saves its individual paragraph with ask and line
PASS list item jump lands on the item instead of the list start
PASS list item resolves live and lands on the same item after reload
PASS card delete removes list item test bookmark
```

Cleanup:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "shortcutsRestored": true, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": true}
```

`bookmarks-matrix-pr-1`: 34/35; exit 1.

```text
PASS real long fixture loaded
PASS held drag empty 1
PASS held drag empty 2
PASS held drag empty 3
PASS live selection message ids match conversation API by SHA-256
PASS the Bookmark cell is named Bookmark selection
PASS paragraph button saves one bookmark
PASS selection saved through real Alt+Shift+M
PASS held drag bookmarked 1
PASS held drag bookmarked 2
PASS held drag bookmarked 3
FAIL matched drag comparison with bookmarks versus empty
PASS selection card jump after drag lands on text
PASS paragraph jump requested during native drag lands on text
PASS reload before row click leaves earlier answer unloaded
PASS earlier bookmarks sit under dots and not a loaded tick (row)
PASS hover earlier segment shows 2-bookmark card (row)
PASS row click loads earlier pages and lands on requested text
PASS segment moves from dots to loaded question after row click
PASS reload before keyboard click leaves earlier answer unloaded
PASS earlier bookmarks sit under dots and not a loaded tick (keyboard)
PASS hover earlier segment shows 2-bookmark card (keyboard)
PASS keyboard click loads earlier pages and lands on requested text
PASS segment moves from dots to loaded question after keyboard click
PASS reload resolves both bookmarks live without answer changed
PASS card delete removes selection bookmark
PASS earlier bookmarks sit under dots and not a loaded tick (single)
PASS hover earlier segment shows 1-bookmark card (single)
PASS card delete removes both test bookmarks
PASS real fixture has a later top-level list item for distinct landing
PASS list item: the Bookmark cell is named Bookmark selection
PASS list item button saves its individual paragraph with ask and line
PASS list item jump lands on the item instead of the list start
PASS list item resolves live and lands on the same item after reload
PASS card delete removes list item test bookmark
```

Cleanup:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "shortcutsRestored": true, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": true}
```

`bookmarks-wash-main-1`: 42/42; exit 0.

```text
PASS wash light: ChatGPT shows its light theme
PASS wash light: the whole chat loads through the earlier-history dots
PASS wash: a mounted answer holds two long paragraphs and a table
PASS wash: the Bookmark cell bookmarks the paragraph
PASS wash: the Bookmark cell bookmarks the selection
PASS wash: the Bookmark cell bookmarks the table
PASS wash light: a paragraph is washed on its own lines
PASS wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash
PASS wash light: a paragraph: the text keeps its colour under the wash
PASS wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text
PASS wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it
PASS wash light: a paragraph: gone after the hold and fade
PASS wash light: a selection is washed on its own lines
PASS wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash
PASS wash light: a selection: the text keeps its colour under the wash
PASS wash light: a selection: scrolled -680 px during the hold, the boxes follow the text
PASS wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it
PASS wash light: a selection: gone after the hold and fade
PASS wash light: a table is washed on its own lines (one box 3 px around the table)
PASS wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash
PASS wash light: a table: the text keeps its colour under the wash
PASS wash light: a table: scrolled 80 px during the hold, the boxes follow the text
PASS wash light: a table: gone after the hold and fade
PASS wash dark: ChatGPT shows its dark theme
PASS wash dark: the whole chat loads through the earlier-history dots
PASS wash dark: a paragraph is washed on its own lines
PASS wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash
PASS wash dark: a paragraph: the text keeps its colour under the wash
PASS wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text
PASS wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it
PASS wash dark: a paragraph: gone after the hold and fade
PASS wash dark: a selection is washed on its own lines
PASS wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash
PASS wash dark: a selection: the text keeps its colour under the wash
PASS wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text
PASS wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it
PASS wash dark: a selection: gone after the hold and fade
PASS wash dark: a table is washed on its own lines (one box 3 px around the table)
PASS wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash
PASS wash dark: a table: the text keeps its colour under the wash
PASS wash dark: a table: scrolled 80 px during the hold, the boxes follow the text
PASS wash dark: a table: gone after the hold and fade
```

Cleanup:

```json
{"remainingBeforeFallback": 3, "remainingAfterFallback": 0, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": false}
```

`bookmarks-wash-pr-1`: 42/42; exit 0.

```text
PASS wash light: ChatGPT shows its light theme
PASS wash light: the whole chat loads through the earlier-history dots
PASS wash: a mounted answer holds two long paragraphs and a table
PASS wash: the Bookmark cell bookmarks the paragraph
PASS wash: the Bookmark cell bookmarks the selection
PASS wash: the Bookmark cell bookmarks the table
PASS wash light: a paragraph is washed on its own lines
PASS wash light: a paragraph: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash
PASS wash light: a paragraph: the text keeps its colour under the wash
PASS wash light: a paragraph: scrolled 74 px during the hold, the boxes follow the text
PASS wash light: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it
PASS wash light: a paragraph: gone after the hold and fade
PASS wash light: a selection is washed on its own lines
PASS wash light: a selection: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash
PASS wash light: a selection: the text keeps its colour under the wash
PASS wash light: a selection: scrolled -680 px during the hold, the boxes follow the text
PASS wash light: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it
PASS wash light: a selection: gone after the hold and fade
PASS wash light: a table is washed on its own lines (one box 3 px around the table)
PASS wash light: a table: Butter's layer, multiplied, in the wash colour, no pointer events, no bubble flash
PASS wash light: a table: the text keeps its colour under the wash
PASS wash light: a table: scrolled 80 px during the hold, the boxes follow the text
PASS wash light: a table: gone after the hold and fade
PASS wash dark: ChatGPT shows its dark theme
PASS wash dark: the whole chat loads through the earlier-history dots
PASS wash dark: a paragraph is washed on its own lines
PASS wash dark: a paragraph: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash
PASS wash dark: a paragraph: the text keeps its colour under the wash
PASS wash dark: a paragraph: scrolled 74 px during the hold, the boxes follow the text
PASS wash dark: a paragraph: with the washed text under ChatGPT's header, the wash reaches the header and no butter shows on it
PASS wash dark: a paragraph: gone after the hold and fade
PASS wash dark: a selection is washed on its own lines
PASS wash dark: a selection: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash
PASS wash dark: a selection: the text keeps its colour under the wash
PASS wash dark: a selection: scrolled -680 px during the hold, the boxes follow the text
PASS wash dark: a selection: with the washed text under ChatGPT's composer, the wash reaches the composer and no butter shows on it
PASS wash dark: a selection: gone after the hold and fade
PASS wash dark: a table is washed on its own lines (one box 3 px around the table)
PASS wash dark: a table: Butter's layer, lightened, in the wash colour, no pointer events, no bubble flash
PASS wash dark: a table: the text keeps its colour under the wash
PASS wash dark: a table: scrolled 80 px during the hold, the boxes follow the text
PASS wash dark: a table: gone after the hold and fade
```

Cleanup:

```json
{"remainingBeforeFallback": 3, "remainingAfterFallback": 0, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": false}
```

`branch-live-main-1`:

```json
{
  "lab": 1,
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "attempt": 1,
  "exit": 0,
  "seconds": 43.545,
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
          0,
          0
        ],
        "scroll": [
          498,
          498
        ]
      },
      "originalScroll": [
        [
          "before",
          498
        ],
        [
          "selected",
          498
        ],
        [
          "button shown",
          498
        ],
        [
          "box open",
          498
        ],
        [
          "typed",
          498
        ],
        [
          "enter",
          498
        ],
        [
          "end",
          498
        ]
      ],
      "branchIdentityDifferent": true,
      "sameLatestReply": true,
      "sendClickCount": 1,
      "sendClickedInBranch": true,
      "afterSendClickRequestCount": 6,
      "allRequestsAfterSendClickBlocked": true,
      "originalSendRequestCount": 0,
      "mutationRequestCount": 36,
      "blockedMutationCount": 35,
      "onlyBranchMutationAllowed": true
    },
    {
      "width": 800,
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
          0,
          0
        ],
        "scroll": [
          511,
          511
        ]
      },
      "originalScroll": [
        [
          "before",
          511
        ],
        [
          "selected",
          511
        ],
        [
          "button shown",
          511
        ],
        [
          "box open",
          511
        ],
        [
          "typed",
          511
        ],
        [
          "enter",
          511
        ],
        [
          "end",
          511
        ]
      ],
      "branchIdentityDifferent": true,
      "sameLatestReply": true,
      "sendClickCount": 1,
      "sendClickedInBranch": true,
      "afterSendClickRequestCount": 6,
      "allRequestsAfterSendClickBlocked": true,
      "originalSendRequestCount": 0,
      "mutationRequestCount": 35,
      "blockedMutationCount": 34,
      "onlyBranchMutationAllowed": true
    }
  ],
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

`branch-live-pr-1`:

```json
{
  "lab": 1,
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "attempt": 1,
  "exit": 0,
  "seconds": 43.833,
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
          0,
          0
        ],
        "scroll": [
          498,
          498
        ]
      },
      "originalScroll": [
        [
          "before",
          498
        ],
        [
          "selected",
          498
        ],
        [
          "button shown",
          498
        ],
        [
          "box open",
          498
        ],
        [
          "typed",
          498
        ],
        [
          "enter",
          498
        ],
        [
          "end",
          498
        ]
      ],
      "branchIdentityDifferent": true,
      "sameLatestReply": true,
      "sendClickCount": 1,
      "sendClickedInBranch": true,
      "afterSendClickRequestCount": 7,
      "allRequestsAfterSendClickBlocked": true,
      "originalSendRequestCount": 0,
      "mutationRequestCount": 37,
      "blockedMutationCount": 36,
      "onlyBranchMutationAllowed": true
    },
    {
      "width": 800,
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
          0,
          0
        ],
        "scroll": [
          511,
          511
        ]
      },
      "originalScroll": [
        [
          "before",
          511
        ],
        [
          "selected",
          511
        ],
        [
          "button shown",
          511
        ],
        [
          "box open",
          511
        ],
        [
          "typed",
          511
        ],
        [
          "enter",
          511
        ],
        [
          "end",
          511
        ]
      ],
      "branchIdentityDifferent": true,
      "sameLatestReply": true,
      "sendClickCount": 1,
      "sendClickedInBranch": true,
      "afterSendClickRequestCount": 6,
      "allRequestsAfterSendClickBlocked": true,
      "originalSendRequestCount": 0,
      "mutationRequestCount": 35,
      "blockedMutationCount": 34,
      "onlyBranchMutationAllowed": true
    }
  ],
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

`python3 compare.py`: exit 0.

```text
matrix ordered checks identical: False cleanup identical: True
DIFFERENCE {"index": 12, "main": ["matched drag comparison with bookmarks versus empty", true], "pr": ["matched drag comparison with bookmarks versus empty", false]}
wash ordered checks identical: True cleanup identical: True
branch pill measurements identical: True
branch ready at both widths in every attempt: True
```

Report generation and privacy scanning: Python; exit and output recorded in `privacy-scan.json`. Raw captures are intentionally excluded.

## Final verification

- `python3 export.py`: initial attempts exited 1 while parsing the restore command's text prefix; corrected to parse its `restored` JSON record, then exit 0, `exported 13 entries`. This affected report generation only.
- `python3 report.py`: exit 0, `generated report.md and commands.md`.
- JSON artifact parsing: exit 0, `JSON artifacts valid`; both branch safety aggregates true and both page-error counters zero.
- Read-only checkout and lock verification: exit 0; output in `data/final-state.json`. Shared checkout status unchanged, tracked diff exit 0; lab 1, lab 2 and perf all free.
- Task-owned snap copies removed; exported directories 0755 and files 0644.
- `python3 privacy.py`: exit 0; output in `privacy-scan.json` and the report.
