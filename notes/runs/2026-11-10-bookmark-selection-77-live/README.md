# PR #78 live lab check — selection pill and bookmark notification (#77)

Tested product: `84941c0b5fddfd9bd70c6d294f84bbdad61c00c6` (`0.1.0-alpha.20`).
Linux x86_64, Node v24.17.0, headed snap Chromium 156.0.8078.47, lab 1, `math12` fixture.
Only harnesses changed. All commands ran on the lab host in the isolated `live-77` worktree.

Commands (from the worktree root). The bookmark matrix acquired its own lab/perf locks:

```sh
EXT=$PWD/extension TESTED_HEAD=84941c0 OUT=$PWD/notes/runs/2026-11-10-bookmark-selection-77-live node lab/harness/bookmarks-live.mjs
```

The review follow-up used these commands, with no CDP startup wrapper. Each script waits for
`L.cdpVersion` itself; the shell did not insert a readiness wait between restart and script:

```sh
B=~/.local/share/chatgpt-lab/bin
LAB=$($B/lab-lock acquire --lab auto --owner live-77 --wait 1800)
export LAB_ID=$LAB LAB_OWNER=live-77
cleanup() {
  status=$?
  trap - EXIT
  $B/lab-restore --lab "$LAB" --owner live-77
  $B/lab-lock release --lab "$LAB" --owner live-77
  exit "$status"
}
trap cleanup EXIT

# Run 1: the lab's default extensions, no task copy. Expected exit 1 before connecting/writing.
$B/lab-restore --lab "$LAB" --owner live-77
node lab/harness/bookmark-selection-live.mjs
# Continue after verifying the expected refusal; do not use set -e for this negative check.

TASK_EXT=$(mktemp -d "$HOME/snap/chromium/common/butter-live-77-review-XXXXXX")
cp -a extension/. "$TASK_EXT/"
export LAB_EXTENSIONS=$TASK_EXT LAB_FLAGS="--disable-extensions-except=$TASK_EXT"

# Run 2: the guarded selection/notice script, against product 84941c0.
$B/lab restart-browser
TESTED_HEAD=84941c0 node lab/harness/bookmark-selection-live.mjs

# Run 3: restart again, then test the committed branch script at its own 1280/800 px widths.
$B/lab restart-browser
BRANCH_PATH='^/backend-api/conversation/new_branch$' OUT_JSON=live-77-review.json node lab/harness/branch-live.mjs
# Allowlist the raw branch JSON into this directory's branch-live.json; omit fingerprints/screenshots.
# EXIT trap: lab-restore, then lab-lock release, both for live-77 (also on failure).
```

The earlier `branch-live-edges.json` run used the same lock acquire / snap-readable task-copy /
`restart-browser` / `lab-restore` / release sequence, with this script command:

```sh
LAB_ID=$LAB LAB_OWNER=live-77 BRANCH_PATH='^/backend-api/conversation/new_branch$' node lab/harness/branch-live-edges.mjs
```

It was not rerun in this follow-up. Its CDP wait is now in the script and syntax-checked.

Review follow-up result: lab id `1`, owner `live-77`. Run 1 exited 1 at the extension guard,
before `L.connect`, settings writes or bookmark access:

```text
AssertionError [ERR_ASSERTION]: Refusing default lab extensions: load a fresh task-owned extension first
GUARD exit=1
```

Runs 2 and 3 exited 0. All seven selection checks passed, including
`{"name":"pill absent for user question","pass":true,"characters":8,"inUserQuestion":true,"nativeAskVisible":true}`.
Both branch widths reached ready, preserved the latest reply, recorded one Send click only in the
branch and blocked its requests; each allowed exactly one native `new_branch` request and blocked
34 other mutations. No original-tab send requests or page errors were recorded.
The final restore returned `ok: true`, `restarted: true`, an empty composer, one home tab and the
default extension; restore exit 0. Release returned
`{"lab":1,"lab_released":true,"perf_released":false}`; release exit 0. This functional run
held no perf lock. Only `lab-restore` cleared a composer; the test harness did not fill one.

- `summary.json`: all 35 checks passed. Six held drags had p95 frame intervals of 16.7–16.8 ms, zero mounts and zero bookmark storage activity. Both unloaded-history paths, reload resolution, removals and list-item landing passed. Zero send attempts; 193 mutations blocked by the guard. Test bookmarks ended at zero.
- `selection-notice.json`: all seven checks passed. Pill gap 4 px, top delta 0 px; radius, background and shadow match ChatGPT. Bookmark saves and shows the top-right card at top 64 px. Undo deletes a save and restores a rail × removal. A real eight-character selection in a user question shows no pill while ChatGPT's own Ask ChatGPT button is visible (`nativeAskVisible: true`). Zero Butter or other page errors.
- `branch-live.json`: passed at 1280 and 800 px. Gap 4 px, top delta 0 px; both toolbars are 30 px high with 8 px radius, background `rgb(48, 48, 48)` and identical shadows. Both branches reached `ready`, preserved the latest answer, clicked Send once only in the new branch, and left the original unchanged. The send guard blocked the send requests.
- `branch-live-edges.json`: passed in English. Stream marker held 8080 ms; branch request occurred 1550 ms after its end. Reached `ready`; original unchanged. Whole pill absent in Work mode; branch cell absent in unsaved branches. Zero Butter or other page errors on the watched original and branch tabs; Temporary Chat and home tabs were not watched.

The original `button-1280.png` and `button-800.png` showed only ChatGPT's button: the screenshot stylesheet hid Butter's hosts. After the harness fix, both screenshots visibly show the two-cell pill beside it. Screenshots were inspected locally and are excluded from this commit. Raw account captures are not release evidence.

Harness corrections: use `.bdot` and its tick/earlier-history control instead of obsolete `.mark`; measure the current 4 px dot beside the visible three dots; read the current card metadata element; activate an earlier bookmark through its card's row or keyboard route (dots are decorative); focus the intended row before its hover/focus-only ×; allowlist Butter hosts in branch screenshots. Added the focused notification/Undo/user-selection helper and numeric page-error counts. The branch, edge and focused selection scripts now wait for CDP readiness before connecting. The focused helper refuses default extensions and a non-empty bookmark store before settings writes, clears only after that guard passes, and still writes its result and disconnects if cleanup fails. The user-question check requires and records the native button, and the temporary user-question probe and redundant conditional were removed. The branch helper closes the guarded branch without filling its composer.

No product failure established. Earlier failed harness attempts are retained in `bookmarks-initial.json`, `bookmarks-selector-rerun.json`, `bookmarks-before-row-focus.json` and `delete-probe.json`. The reduced probe showed a visible card with the first row's × visible and the unfocused last row's × set to `display: none`, explaining the deletion timeout. `branch-baseline.json` records a successful pre-screenshot-fix run; an earlier startup attempt failed with CDP not ready.

Locks: bookmark matrices and the reduced probe self-acquired lab 1 plus the perf lock as `butter-57-bookmarks-live-4`; the branch/focused runs acquired lab 1 as `live-77` with a 1800 s wait. Every acquisition restored the lab and released its lock, including failures. Bookmark cleanup restored shortcut preferences and removed test bookmarks; all restores returned an empty composer, one home tab and the default extensions. No message was sent. Only the explicitly permitted native branch request bypassed the branch scripts' guard.

The historical branch screenshots were restored after allowlisting the fresh follow-up result here. JSON contains numeric/boolean evidence and public code/UI labels; content fingerprints and raw screenshots are omitted. The host worktree is intentionally left for the lead to remove. No push was made.
