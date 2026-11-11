# Fixed-head rerun commands and actual results

Paths use placeholders: `$REPO` is the unchanged shared checkout, `$CLONE` the fresh report clone, `$WORK/pr2` the exact archive, `$RAW` private output, `$B` the shared lab bin directory, `$DEPS` installed dependencies, and `$EXT_PR2` the snap-readable branch copy. Raw logs, private URLs and paths are excluded.

## Preparation and inspection

- Initial `git show origin/t3/bookmark-session-live:.../report.md` and `commands.md` in `$REPO`: `fatal: invalid object name` for both; the local remote ref was unavailable. No shared-checkout fetch or mutation was needed.
- `git clone https://github.com/SimianW/butter "$CLONE"`: exit 0, `Cloning into <fresh-clone>...`.
- `git checkout -b t3/bookmark-session-live origin/t3/bookmark-session-live`: exit 0, `Switched to a new branch`, tracking `origin/t3/bookmark-session-live`.
- `cat`, `sed`, `rg`, `git show`: read the earlier report, commands, comparison, lab README and privacy rules, the prior exporter/scanner and this SHA’s harness locking, guard and cleanup code. One diagnostic `cat` for a nonexistent old runner exited 1; existing prior runner files were then read.
- `git rev-parse e4aa4d8`: `e4aa4d8e0627fbd310efb8bca2abd280132173c0`.
- Python preparation used `git archive <exact SHA>` and tar extraction, `Path.symlink_to` for `node_modules`, and `shutil.copytree` for the branch extension. Exit 0:

```text
archived e4aa4d8e0627fbd310efb8bca2abd280132173c0
Playwright 1.65.0
fixture labs {'math12': [1, 2], 'demo-en12': [2]}
```

- `git diff e6d9f5f e4aa4d8 -- lab/harness/bookmarks-live/matrix.mjs`: imported `BOOKMARK_SCRIPTS` and replaced literal coverage count 1 with its length. No source edits were made.
- `lab-lock status` during matrix: lab 1 and perf held by the matrix harness; lab 2 free.

## Recorded harness commands

| Run | Command | Exit | Seconds |
| --- | --- | --- | --- |
| bookmarks-matrix-pr2-1 | `EXT='$WORK/pr2/extension' OUT='$RAW/bookmarks-matrix-pr2-1' TESTED_HEAD=e4aa4d8e0627fbd310efb8bca2abd280132173c0 LAB_FIXTURE=math12 LAB_PLAYWRIGHT='$DEPS/playwright' node lab/harness/bookmarks-live.mjs` | 0 | 302.225 |
| bookmarks-wash-pr2-1 | `EXT='$WORK/pr2/extension' OUT='$RAW/bookmarks-wash-pr2-1' TESTED_HEAD=e4aa4d8e0627fbd310efb8bca2abd280132173c0 LAB_FIXTURE=demo-en12 LAB_PLAYWRIGHT='$DEPS/playwright' MODE=wash node lab/harness/bookmarks-live.mjs` | 0 | 133.218 |
| branch-live-pr2-1-acquire | `'$B/lab-lock' acquire --lab 1 --owner butter-bookmark-session-rerun-pr2-1 --wait 1800 --perf` | 0 | 0.05 |
| branch-live-pr2-1-restart | `LAB_ID=1 LAB_OWNER=butter-bookmark-session-rerun-pr2-1 LAB_PLAYWRIGHT='$DEPS/playwright' LAB_EXTENSIONS='$EXT_PR2' LAB_FLAGS='--disable-extensions-except=$EXT_PR2' '$B/lab' restart-browser` | 0 | 2.024 |
| branch-live-pr2-1 | `LAB_ID=1 LAB_OWNER=butter-bookmark-session-rerun-pr2-1 LAB_PLAYWRIGHT='$DEPS/playwright' BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=branch-live-pr2-1.json node lab/harness/branch-live.mjs` | 0 | 44.073 |
| branch-live-pr2-1-restore | `'$B/lab-restore' --lab 1 --owner butter-bookmark-session-rerun-pr2-1` | 0 | 10.16 |
| branch-live-pr2-1-release | `'$B/lab-lock' release --lab 1 --owner butter-bookmark-session-rerun-pr2-1` | 0 | 0.06 |

## Actual sanitized observations

The following ordered check output comes directly from the saved harness summary.

`bookmarks-matrix-pr2-1`: 35/35; exit 0.

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

`bookmarks-wash-pr2-1`: 42/42; exit 0.

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

`branch-live-pr2-1`:

```json
{
  "lab": 1,
  "pageErrors": {
    "butter": 0,
    "other": 0
  },
  "attempt": 1,
  "exit": 0,
  "seconds": 44.073,
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
      "afterSendClickRequestCount": 5,
      "allRequestsAfterSendClickBlocked": true,
      "originalSendRequestCount": 0,
      "mutationRequestCount": 34,
      "blockedMutationCount": 33,
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

`python3 export.py`: exit 0, `exported 27 entries`; summaries copied unchanged and branch JSON exported through the earlier allowlist.

`python3 compare-pr2.py`: exit 0.

```text
matrix ordered checks identical: True cleanup identical: True
wash ordered checks identical: True cleanup identical: True
branch pill measurements identical: True
branch ready at both widths in every attempt: True
```

`python3 report.py`: exit 0, `generated fixed-head rerun report and commands`.

Final read-only checkout and lock verification:

```json
{
  "sharedCheckoutStatusUnchanged": true,
  "sharedCheckoutTrackedDiffExit": 0,
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
  "branchExtensionCopyRemoved": true,
  "branchExtensionByteIdentical": true,
  "files": 59
}
```

`python3 privacy.py`: same earlier scanner, scoped to the entire report directory, output in `privacy-scan-pr2.json`.


Final verification commands:

- `python3 -m py_compile <exporter> <report-generator> <privacy-scanner>`: exit 0, no output.
- Python JSON, check, branch-safety, original-report and byte-copy assertions: exit 0.

```text
JSON artifacts valid; all 77 checks pass; branch safety aggregates true; page errors zero
Original report unchanged after the added paragraph; exported summaries byte-for-byte identical
```

- `git diff --check`: exit 0, no output.
- `git status --short`: only the report intro and the 12 new rerun/comparison/data files.
- Commit and fast-forward push commands and their actual output are provided in the task reply.
