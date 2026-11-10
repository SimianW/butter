# PR #78 live lab check — selection pill and bookmark notification (#77)

Tested product: `84941c0b5fddfd9bd70c6d294f84bbdad61c00c6` (`0.1.0-alpha.20`).
Linux x86_64, Node v24.17.0, headed snap Chromium 156.0.8078.47, lab 1, `math12` fixture.
Only harnesses changed. All commands ran on the lab host in the isolated `live-77` worktree.

Commands (from the worktree root):

```sh
EXT=$PWD/extension TESTED_HEAD=84941c0 OUT=$PWD/notes/runs/2026-11-10-bookmark-selection-77-live node lab/harness/bookmarks-live.mjs
# The following held LAB_ID / LAB_OWNER's lock and used a snap-readable extension copy:
LAB_ID=1 LAB_OWNER=live-77 TESTED_HEAD=84941c0 node lab/harness/bookmark-selection-live.mjs
LAB_ID=1 LAB_OWNER=live-77 BRANCH_PATH='^/backend-api/conversation/new_branch$' node lab/harness/branch-live.mjs
LAB_ID=1 LAB_OWNER=live-77 BRANCH_PATH='^/backend-api/conversation/new_branch$' node lab/harness/branch-live-edges.mjs
```

- `summary.json`: all 35 checks passed. Six held drags had p95 frame intervals of 16.7–16.8 ms, zero mounts and zero bookmark storage activity. Both unloaded-history paths, reload resolution, removals and list-item landing passed. Zero send attempts; 193 mutations blocked by the guard. Test bookmarks ended at zero.
- `selection-notice.json`: all seven checks passed. Pill gap 4 px, top delta 0 px; radius, background and shadow match ChatGPT. Bookmark saves and shows the top-right card at top 64 px. Undo deletes a save and restores a rail × removal. A real eight-character selection in a user question shows no pill. Zero Butter or other page errors.
- `branch-live.json`: passed at 1280 and 800 px. Gap 4 px, top delta 0 px; both toolbars are 30 px high with 8 px radius, background `rgb(48, 48, 48)` and identical shadows. Both branches reached `ready`, preserved the latest answer, clicked Send once only in the new branch, and left the original unchanged. The send guard blocked the send requests.
- `branch-live-edges.json`: passed in English. Stream marker held 8080 ms; branch request occurred 1550 ms after its end. Reached `ready`; original unchanged. Whole pill absent in Work mode; branch cell absent in unsaved branches. Zero Butter or other page errors.

The original `button-1280.png` and `button-800.png` showed only ChatGPT's button: the screenshot stylesheet hid Butter's hosts. After the harness fix, both screenshots visibly show the two-cell pill beside it. Screenshots were inspected locally and are excluded from this commit. Raw account captures are not release evidence.

Harness corrections: use `.bdot` and its tick/earlier-history control instead of obsolete `.mark`; measure the current 4 px dot beside the visible three dots; read the current card metadata element; activate an earlier bookmark through its card's row or keyboard route (dots are decorative); focus the intended row before its hover/focus-only ×; allowlist Butter hosts in branch screenshots. Added the focused notification/Undo/user-selection helper and numeric page-error counts. The browser startup wrapper waits for CDP readiness.

No product failure established. Earlier failed harness attempts are retained in `bookmarks-initial.json`, `bookmarks-selector-rerun.json`, `bookmarks-before-row-focus.json` and `delete-probe.json`. The reduced probe showed a visible card with the first row's × visible and the unfocused last row's × set to `display: none`, explaining the deletion timeout. `branch-baseline.json` records a successful pre-screenshot-fix run; an earlier startup attempt failed with CDP not ready.

Locks: bookmark matrices and the reduced probe self-acquired lab 1 plus the perf lock as `butter-57-bookmarks-live-4`; the branch/focused runs acquired lab 1 as `live-77` with a 1800 s wait. Every acquisition restored the lab and released its lock, including failures. Bookmark cleanup restored shortcut preferences and removed test bookmarks; all restores returned an empty composer, one home tab and the default extensions. No message was sent. Only the explicitly permitted native branch request bypassed the branch scripts' guard.

The two historical branch run directories were restored after copying fresh output here. JSON contains numeric/boolean evidence and public code/UI labels; content fingerprints and raw screenshots are omitted. The host worktree is intentionally left for the lead to remove. No push was made.
