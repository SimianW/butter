# Commands and actual results

Private paths are represented by placeholders. `$B` is the lab bin directory, `$REPO` the unchanged checkout, `$WORK` the archive area, `$BUILD` the selected archive, `$EXT` its snap-readable extension, `$DEPS` the installed dependencies, and `$RAW` the private harness output area.

Preparatory read-only operations:

- `pwd`: selected Butter checkout.
- `git status --short`: pre-existing untracked files only; no tracked modifications.
- Initial `git show origin/main:notes/runs/2026-11-11-page-reader-a-live/report.md`: exit 128 because the local remote-tracking ref was stale.
- `git fetch origin`: exit 0; fetched requested main and PR refs.
- `git show origin/main:notes/runs/2026-11-11-page-reader-a-live/report.md`, its `commands.md` and `compare.py`: exit 0 after fetch; read previous method and result.
- `cat lab/README.md notes/runs/README.md "$LAB_ROOT/README.md"`: exit 0; all required instructions read in full.
- `git rev-parse 86f95e5 origin/t3/page-reader-b`: exit 0; exact SHAs are recorded in `data/builds.json`.
- `git diff 86f95e5 3b5a691 -- lab/harness/bookmarks-live.mjs lab/harness/branch-live.mjs` and the corresponding `bookmarks-live/` and `runner/` directory diff: exit 0, empty output.
- `rg` and `sed` reads of harness and lab helpers: inspected lock ownership, guard, cleanup and output behavior. Installed package reads verified Playwright 1.65.0; older fallback dependencies were not used.
- `mkdir`, `mktemp`, archive extraction, `ln -s`, extension copies and orchestration scripts: exit 0; archive dependencies resolve to Playwright 1.65.0, and extension copies have identical tree digests.

## Recorded executions

| Run | Command | Exit | Seconds |
|---|---|---:|---:|
| archive-main | `git archive 86f95e52ebb00fc3edd70856bcbba66e72222ca7 &#124; tar -x -C "$WORK/main"` | 0 | 0.234 |
| archive-pr | `git archive 3b5a6916b8b364c5ced20ed91e1c08689192ea6d &#124; tar -x -C "$WORK/pr"` | 0 | 0.227 |
| playwright-version | `node -p 'require("./node_modules/playwright/package.json").version'` | 0 | 0.031 |
| bookmarks-matrix-main | `EXT="$BUILD/extension" OUT="$RAW/bookmarks-matrix-main" TESTED_HEAD="86f95e52ebb00fc3edd70856bcbba66e72222ca7" LAB_FIXTURE=math12 MODE=matrix LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 1 | 310.682 |
| bookmarks-matrix-pr | `EXT="$BUILD/extension" OUT="$RAW/bookmarks-matrix-pr" TESTED_HEAD="3b5a6916b8b364c5ced20ed91e1c08689192ea6d" LAB_FIXTURE=math12 MODE=matrix LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 0 | 303.807 |
| bookmarks-wash-main | `EXT="$BUILD/extension" OUT="$RAW/bookmarks-wash-main" TESTED_HEAD="86f95e52ebb00fc3edd70856bcbba66e72222ca7" LAB_FIXTURE=demo-en12 MODE=wash LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 1 | 82.178 |
| bookmarks-wash-pr | `EXT="$BUILD/extension" OUT="$RAW/bookmarks-wash-pr" TESTED_HEAD="3b5a6916b8b364c5ced20ed91e1c08689192ea6d" LAB_FIXTURE=demo-en12 MODE=wash LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/bookmarks-live.mjs` | 0 | 132.942 |
| branch-live-main-1-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-b-main-1 --wait 1800 --perf` | 0 | 0.048 |
| branch-live-main-1-restart | `LAB_ID=1 LAB_EXTENSIONS="$EXT" LAB_FLAGS="--disable-extensions-except=$EXT" $B/lab restart-browser` | 0 | 2.025 |
| branch-live-main-1 | `LAB_ID=1 LAB_OWNER=butter-page-reader-b-main-1 BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=branch-live-main-1.json LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/branch-live.mjs` | 0 | 45.464 |
| branch-live-main-1-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-b-main-1` | 0 | 9.923 |
| branch-live-main-1-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-b-main-1` | 0 | 0.051 |
| branch-live-pr-1-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-b-pr-1 --wait 1800 --perf` | 0 | 0.049 |
| branch-live-pr-1-restart | `LAB_ID=1 LAB_EXTENSIONS="$EXT" LAB_FLAGS="--disable-extensions-except=$EXT" $B/lab restart-browser` | 0 | 2.026 |
| branch-live-pr-1 | `LAB_ID=1 LAB_OWNER=butter-page-reader-b-pr-1 BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=branch-live-pr-1.json LAB_PLAYWRIGHT="$DEPS/playwright" node lab/harness/branch-live.mjs` | 0 | 42.728 |
| branch-live-pr-1-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-b-pr-1` | 0 | 10.562 |
| branch-live-pr-1-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-b-pr-1` | 0 | 0.053 |

## Actual sanitized output

Archive commands emitted tar bytes, extracted into separate directories; no archive content is exported. The version command printed `1.65.0`. Browser restart commands exited as recorded above. Detailed console logs are excluded for privacy.

`bookmarks-matrix-main`: 34/35; exit 1.

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
FAIL list item resolves live and lands on the same item after reload
PASS card delete removes list item test bookmark
```
Cleanup:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "shortcutsRestored": true, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": true}
```

`bookmarks-matrix-pr`: 35/35; exit 0.

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

`bookmarks-wash-main`: 5/5 completed; ERROR; exit 1.

```text
PASS wash light: ChatGPT shows its light theme
PASS wash light: the whole chat loads through the earlier-history dots
PASS wash: a mounted answer holds two long paragraphs and a table
PASS wash dark: ChatGPT shows its dark theme
PASS wash dark: the whole chat loads through the earlier-history dots
```
Cleanup:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": false}
```

`bookmarks-wash-pr`: 42/42; exit 0.

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
          520,
          520
        ]
      },
      "originalScroll": [
        [
          "before",
          520
        ],
        [
          "selected",
          520
        ],
        [
          "button shown",
          520
        ],
        [
          "box open",
          520
        ],
        [
          "typed",
          520
        ],
        [
          "enter",
          520
        ],
        [
          "end",
          520
        ]
      ],
      "branchIdentityDifferent": true,
      "sameLatestReply": true,
      "sendClickCount": 1,
      "sendClickedInBranch": true,
      "afterSendClickRequestCount": 7,
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
  ]
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
      "mutationRequestCount": 35,
      "blockedMutationCount": 34,
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
  ]
}
```

`branch-live-main-1-restore`:

```json
{"ok": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "extraFlagsCount": 0}
```

`branch-live-pr-1-restore`:

```json
{"ok": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "extraFlagsCount": 0}
```

`branch-live-main-1-release`:

```json
{"lab": 1, "lab_released": true, "perf_released": true}
```

`branch-live-pr-1-release`:

```json
{"lab": 1, "lab_released": true, "perf_released": true}
```

`python3 compare.py`: exit 0.

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

Postprocessing: allowlist branch data; copy bookmarks summaries; generate report and command record; scan all exported files; set files world-readable; verify final checkout/lock state. Privacy scan output is in `privacy-scan.json` and the report.

## Final verification output

`python3 "$WORK/report.py"`: exit 0; `generated report.md and commands.md`.

Read-only checkout and lock verification: exit 0.

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
  ]
}
```

Task-owned snap extension removal: completed. File modes were set with Python to 0755 for directories and 0644 for files; the privacy scan checks world readability.

`python3 "$WORK/privacy.py"`: exit 0. Actual output:

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
