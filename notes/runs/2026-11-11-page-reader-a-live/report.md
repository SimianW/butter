# Butter main vs PR #87: live-lab smoke — 2026-11-11

**No PR-specific difference found in the completed live checks. Full smoke qualification is incomplete.**
Bookmarks matrix and wash have identical ordered check names, pass/fail results and cleanup records.
Branch pill measurements are identical at both widths. Both English edge runs pass every assertion.
Main's first branch-live attempt fails original-tab preservation because its scroll changes by 22 px;
a fresh rerun passes. The PR passes on its first attempt.
Both navigation fixtures fail on both builds before current-code checks can run, so they do not establish navigation parity.

## Builds and method

- Main: `88161e3eeaef8778064bbcebe5afd861c0e6be28`.
- PR #87 (`t3/page-reader-a`): `ec42e57dc139352874c30d10336d0077592875b3`, captured immediately after the initial fetch; unchanged from the requested head.
  The PR's later commit `8577db8` (review R1) changes only `lab/harness/branch-unsure-composer.mjs`, so its
  `extension/` is the one tested here.
- Each build comes from its own `git archive` directory, with a symlink to the installed Playwright 1.65.0 dependencies. No checkout, source edit, commit or push was made in the shared repository. Its pre-existing untracked files were left alone.
- Chromium 156.0.8078.47, headed on Xvfb. Every lab operation is sequential under its lock.
- Matrix: lab 1, fixture `math12`, harness-owned lab/perf locks, default repetitions and shortcut handling.
- Wash: lab 2, fixture `demo-en12`, harness-owned lab lock; temporary page theme attributes only.
- Branch suites: lab 1, `math12`, a task-owned snap-readable extension copy for each build, English, guarded POST exception limited to the native `new_branch` endpoint. The outer script holds lab/perf locks and restarts the browser before each attempt.
- Navigation fixtures: lab 1, both builds loaded from their snap-readable extension copies. Historical git objects are read through `GIT_DIR` pointing at the existing object database; archive files remain the work tree. No ChatGPT requests are made by the fixtures.
- The first navigation invocations race Chromium startup and exit `ECONNREFUSED` before any fixture check. Both builds were rerun after CDP readiness: both then fail waiting for `chatgpt-butter-nav[data-on]`.
- Every outer lock is followed by `lab-restore` and `lab-lock release`, including failures. Bookmarks-live performs the same steps internally.
- No live message was sent. The branch harnesses fill Butter's test question field and exercise the guarded branch send, as designed; the send request is blocked. No manual message or language/settings change was made. Home-page Chat/Work mode checks restore Chat mode. Chinese was not run.

| Extension tree SHA-256 | Digest |
|---|---|
| main | `c6e09447159630fab94b5b322d7954b8bae725c8a5d161d681c382ac21483f96` |
| PR | `6165863f314ee6b6f449ad47907a9a2c7169296c0e08cf7422199587cf6be221` |

Each digest uses bookmarks-live's sorted relative filenames plus file bytes. Matrix and wash agree on each build's digest.
The only harness-source difference between builds is a comment in bookmarks-live's page helper.

## Results

| Harness | main | PR | Comparison |
|---|---|---|---|
| bookmarks-live matrix | 35/35; 303.017 s | 35/35; 300.779 s | ordered checks and cleanup identical |
| bookmarks-live wash | 42/42; 132.422 s | 42/42; 133.967 s | ordered checks and cleanup identical |
| branch-live, 1280/800 px | attempt 1: ready both, FAIL original scroll at 1280; attempt 2: PASS both | attempt 1: PASS both | pill measurements identical |
| branch-live-edges, English | PASS, 16 behavior assertions | PASS, 16 behavior assertions | same checked outcomes |
| nav-earlier | FAIL: 0/14 cases | FAIL: 0/14 cases | same timeout before current rail activation |
| nav-takeovers | FAIL: 3/15 cases (historical only; 0/12 current) | FAIL: 3/15 cases (historical only; 0/12 current) | same timeout before current rail activation |

### Script comparison output

```text
matrix ordered checks identical: True cleanup identical: True
wash ordered checks identical: True cleanup identical: True
branch pill measurements identical: True
```

`compare.py` and `data/comparison.json` contain the repeatable comparison. Each bookmarks `summary.json` preserves every ordered check name and result. No ordered check differs.

### Branch attempts and assertions

Main attempt 1 (43.524 s) reaches `ready` at both widths. At 1280 px, `originalCompare.sameUrl=true`, draft lengths `[0,0]`, scroll `[498,520]`; its recorded timeline stays at 498 through Enter, then ends at 520. At 800 px, scroll `[511,511]` and original unchanged. The cause of the 22 px movement was not established.
Main attempt 2 (44.097 s) passes; PR attempt 1 (47.498 s) passes. Every attempt is retained in data, including the failed one.

At both widths, every branch attempt measures gap 4 px, top delta 0 px, height 30 px and radius 8 px. Native and Butter look strings match exactly, across both builds.

English edges: main 61.936 s; PR 62.660 s. Both complete these 16 assertions:

1. Branch cell offered in a saved Chat-mode conversation.
2. Waiting tab title matches the waiting label.
3. Branch request occurs after the simulated stream ends.
4. Branch reaches `ready`.
5. Branch identity differs from the original.
6. Latest reply matches the original's latest reply.
7. Exactly one send click.
8. Send clicked inside the branch.
9. All recorded requests after that send click are blocked.
10. No send request from the original tab.
11. Original tab unchanged.
12. Native selection toolbar shown in an unsaved branch.
13. Butter branch cell hidden in an unsaved branch.
14. Work-mode toolbar offers side chat.
15. Butter branch cell hidden in Work mode.
16. Butter selection pill hidden in Work mode.

There are also lock-ownership preconditions. Temporary Chat and home-page observations are recorded, but the harness does not assert them. Both edge runs record zero Butter and other page errors. Branch request follows simulated stream end by 1531 ms on main and 1567 ms on PR; these are single-run timings, not a performance claim.

### Navigation coverage limitation

After waiting for CDP, `nav-earlier` exits 1 after 30.850 s on main and 30.710 s on PR, with zero completed cases of 14.
`nav-takeovers` exits 1 after 60.822 s on main and 60.810 s on PR. Its `alpha6` historical cases `repeat`, `same-final`, `deadline` pass their assertions (3 cases), then current `new` code times out before its first result (0 of 12 current cases).
A separate read-only nine-turn fixture probe, using the same rail and offscreen scripts, reproduces two `ReferenceError` events for missing `ButterBookmarks` on each build, with rail inactive. Both fixture harnesses omit `bookmarks/model.js` although the current rail uses `ButterBookmarks` (follow-up #89); loading the extension in the lab does not inject that dependency into the fixture origin. The probe does not modify the harnesses or extension. This identifies a fixture bootstrap gap shared by both builds.

Neither fixture writes its final summary on this failure path; the report provides numeric/boolean failure summaries and the three public fixture result rows instead. Raw errors, traces and console logs are excluded.

## Send guard and cleanup

| Bookmarks run | Send attempts | Blocked mutations |
|---|---:|---:|
| matrix main | 0 | 191 |
| matrix PR | 0 | 192 |
| wash main | 0 | 110 |
| wash PR | 0 | 112 |

Branch data reduces redacted request records to counts and booleans: `onlyBranchMutationAllowed`, `allRequestsAfterSendClickBlocked`, and `originalSendRequestCount`. All branch attempts satisfy these safety checks. No message reaches ChatGPT.

Matrix cleanup on both builds:

```json
{"remainingBeforeFallback": 0, "remainingAfterFallback": 0, "shortcutsRestored": true, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": true}
```

Wash cleanup on both builds:

```json
{"remainingBeforeFallback": 3, "remainingAfterFallback": 0, "restored": true, "composerEmpty": true, "oneHomeTab": true, "defaultExtensions": true, "labLockReleased": true, "perfLockReleased": false}
```

Wash uses no perf lock, so `perfLockReleased=false` is expected. `data/cleanup.json` contains every outer restore/release result, with private URLs and paths removed. All restore/release commands exit 0; restore reports empty composer, one home tab, one default extension and no extra flags. Every owned lock is released.

## Commands and actual results

`commands.md` lists operational invocations and their actual exit codes and elapsed times. `data/executions.json` stores the same records. Paths use `$B` (lab bin), `$WORK` (private archive/run area), `$BUILD` (one archive), `$EXT` (snap-readable extension), `$OUT` (sanitized data) placeholders to exclude host-private paths. `data/` keeps each bookmarks summary, sanitized branch attempts, navigation failure summaries, comparison and cleanup records. It contains no screenshots or console logs.

Privacy scan results are in `privacy-scan.json` and appended below after the final scan. All report/data files are world-readable.

### Final privacy scan output

```json
{
  "filesScanned": 25,
  "accountLabelsChecked": 2,
  "uuidMatches": 0,
  "conversationUrlMatches": 0,
  "emailMatches": 0,
  "accountLabelMatches": 0,
  "privatePathMatches": 0,
  "privateEndpointMatches": 0,
  "forbiddenArtifactFiles": 0
}
```

Final lock status: lab 1 free, lab 2 free, perf free. Final checkout status matches its pre-run untracked-file list. No tracked file was modified.
