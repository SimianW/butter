# Commands and actual results

Paths are placeholders for host privacy. Preparatory read-only commands included `git status --short`, `git fetch origin`, `git rev-parse origin/main origin/t3/page-reader-a`, `git show origin/main:<required-document-or-harness>`, and reads of the lab README and machine configuration. Fetch succeeded; the resolved commits are in `data/builds.json`. The checkout was not edited.

```sh
git archive 88161e3eeaef8778064bbcebe5afd861c0e6be28 | tar -x -C "$WORK/main"
git archive ec42e57dc139352874c30d10336d0077592875b3 | tar -x -C "$WORK/pr"
ln -s "$REPO/node_modules" "$WORK/main/node_modules"
ln -s "$REPO/node_modules" "$WORK/pr/node_modules"
node -p 'require("./node_modules/playwright/package.json").version'
```

All exit 0; Playwright prints `1.65.0`. Extension digests are recorded in `data/builds.json`.

For each bookmarks run the command below was run in its own archive with the matching SHA, extension and output directory. Matrix used `MODE=matrix LAB_FIXTURE=math12`; wash used `MODE=wash LAB_FIXTURE=demo-en12`. Main preceded PR for each mode.

```sh
EXT="$BUILD/extension" OUT="$OUT" TESTED_HEAD="$SHA" LAB_FIXTURE="$FIXTURE" MODE="$MODE" node lab/harness/bookmarks-live.mjs
```

Branch setup used `LAB_ID=1 LAB_OWNER="$OWNER" LAB_EXTENSIONS="$EXT" LAB_FLAGS="--disable-extensions-except=$EXT"`, then `BRANCH_PATH='^/backend-api/conversation/new_branch$' LANG_TAG=en` for branch harnesses. Navigation fixtures additionally used read-only `GIT_DIR="$REPO/.git" GIT_WORK_TREE="$BUILD"`. CDP readiness was checked using GET `/json/version` on loopback before corrected navigation runs.

The following table records actual executions, including failures and every cleanup. The initial main branch failure is named `branch-live-main`; its preserved data is `branch-live-main-1.json`.

| Run | Command | Exit | Seconds |
|---|---|---:|---:|
| bookmarks-matrix-main | `node lab/harness/bookmarks-live.mjs` | 0 | 303.017 |
| bookmarks-matrix-pr | `node lab/harness/bookmarks-live.mjs` | 0 | 300.779 |
| bookmarks-wash-main | `node lab/harness/bookmarks-live.mjs` | 0 | 132.422 |
| bookmarks-wash-pr | `node lab/harness/bookmarks-live.mjs` | 0 | 133.967 |
| main-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-main --wait 1800 --perf` | 0 | 0.047 |
| main-restart | `$B/lab restart-browser` | 0 | 2.025 |
| branch-live-main | `node lab/harness/branch-live.mjs` | 1 | 43.524 |
| main-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-main` | 0 | 10.036 |
| main-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-main` | 0 | 0.054 |
| main-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-main --wait 1800 --perf` | 0 | 0.048 |
| main-restart | `$B/lab restart-browser` | 0 | 2.025 |
| branch-live-main-2 | `node lab/harness/branch-live.mjs` | 0 | 44.097 |
| main-edges-restart-1 | `$B/lab restart-browser` | 0 | 2.026 |
| branch-live-edges-main-1 | `node lab/harness/branch-live-edges.mjs` | 0 | 61.936 |
| main-nav-earlier-restart | `$B/lab restart-browser` | 0 | 2.027 |
| nav-earlier-main | `node lab/harness/nav-earlier.mjs` | 1 | 0.345 |
| main-nav-takeovers-restart | `$B/lab restart-browser` | 0 | 2.026 |
| nav-takeovers-main | `node lab/harness/nav-takeovers.mjs` | 1 | 0.315 |
| main-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-main` | 0 | 10.403 |
| main-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-main` | 0 | 0.074 |
| pr-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-pr --wait 1800 --perf` | 0 | 0.051 |
| pr-restart | `$B/lab restart-browser` | 0 | 2.026 |
| branch-live-pr-1 | `node lab/harness/branch-live.mjs` | 0 | 47.498 |
| pr-edges-restart-1 | `$B/lab restart-browser` | 0 | 2.026 |
| branch-live-edges-pr-1 | `node lab/harness/branch-live-edges.mjs` | 0 | 62.66 |
| pr-nav-earlier-restart | `$B/lab restart-browser` | 0 | 2.026 |
| nav-earlier-pr | `node lab/harness/nav-earlier.mjs` | 1 | 0.32 |
| pr-nav-takeovers-restart | `$B/lab restart-browser` | 0 | 2.025 |
| nav-takeovers-pr | `node lab/harness/nav-takeovers.mjs` | 1 | 0.318 |
| pr-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-pr` | 0 | 10.171 |
| pr-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-pr` | 0 | 0.055 |
| main-nav-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-nav-main --wait 1800 --perf` | 0 | 0.047 |
| main-nav-restart | `$B/lab restart-browser` | 0 | 2.026 |
| nav-earlier-main-ready | `node lab/harness/nav-earlier.mjs` | 1 | 30.85 |
| nav-takeovers-main-ready | `node lab/harness/nav-takeovers.mjs` | 1 | 60.822 |
| main-nav-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-nav-main` | 0 | 10.201 |
| main-nav-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-nav-main` | 0 | 0.054 |
| pr-nav-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-nav-pr --wait 1800 --perf` | 0 | 0.053 |
| pr-nav-restart | `$B/lab restart-browser` | 0 | 2.026 |
| nav-earlier-pr-ready | `node lab/harness/nav-earlier.mjs` | 1 | 30.71 |
| nav-takeovers-pr-ready | `node lab/harness/nav-takeovers.mjs` | 1 | 60.81 |
| pr-nav-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-nav-pr` | 0 | 10.134 |
| pr-nav-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-nav-pr` | 0 | 0.06 |
| main-probe-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-probe-main --wait 1800` | 0 | — |
| main-probe-restart | `$B/lab restart-browser` | 0 | — |
| nav-probe-main | `node probe-nav.mjs main` | 0 | — |
| main-probe-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-probe-main` | 0 | — |
| main-probe-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-probe-main` | 0 | — |
| pr-probe-acquire | `$B/lab-lock acquire --lab 1 --owner butter-page-reader-a-probe-pr --wait 1800` | 0 | — |
| pr-probe-restart | `$B/lab restart-browser` | 0 | — |
| nav-probe-pr | `node probe-nav.mjs pr` | 0 | — |
| pr-probe-restore | `$B/lab-restore --lab 1 --owner butter-page-reader-a-probe-pr` | 0 | — |
| pr-probe-release | `$B/lab-lock release --lab 1 --owner butter-page-reader-a-probe-pr` | 0 | — |

Postprocessing ran the sanitization/comparison script, `python3 compare.py`, report generation, the privacy scan, and a final read-only checkout/lock check. The ordered-check and pill comparison output is in the report. No raw console transcript is exported, in accordance with the privacy requirement.
