# Live harnesses before and after harness refactor 4/4 (#86) — 2026-11-11

**Result: same checks, same results.** Each live harness that #86 changes ran in the live lab
once on main (`6679151`) and once on the PR. bookmarks-live gave the same ordered check names and
results in both modes (matrix 35/35, wash 42/42) and the same cleanup record. branch-live reached
`ready` at both widths with the same pill measurements. branch-live-edges (English) passed every
assert on the PR. On main its first run failed one assert, "original tab unchanged"; two reruns
of main passed (see [Notes](#notes)). Run alone, a later bookmarks-live scenario is skipped with
its reason instead of crashing.

#86 changes test tooling only; `extension/` is the same in every run (extension tree SHA-256
below).

## Builds and method

- **main:** `6679151` (#85 merged).
- **PR #86:** bookmarks-live at `1854dbb` (the reviewed head). Its precondition runs and the two
  branch harnesses ran at `9ab5c4b`. The commits after `9ab5c4b` change bookmarks-live only on a
  throw or a skip, and do not touch `branch-live.mjs` or `branch-live-edges.mjs`. bookmarks-live
  also ran at `9ab5c4b`, with the same check results.
- Each build ran from its own `git archive` copy on the lab host, never from a checkout: the
  branch harnesses write into `notes/runs/`.
- Linux lab, Chromium on Xvfb. bookmarks-live takes its own lock: the matrix on lab 1 with the
  perf lock and fixture `math12`, the wash on lab 2 with `LAB_FIXTURE=demo-en12`.
  - The two branch harnesses ran on lab 1 (`math12`) under a lock held by the run script. The
    browser was restarted with a snap-readable copy of `extension/`. They ran with
    `BRANCH_PATH='^/backend-api/conversation/new_branch$'` for branch-live, and English for edges.
  - Every run was followed by `lab-restore`, then the lock was released.
- Send guard on in every run. bookmarks-live recorded 0 send attempts. Both branch harnesses
  recorded their one send click inside the branch, blocked by the guard, and no send request from
  the original tab.
- No message was typed or sent and no ChatGPT setting was changed. That is why
  `LANG_TAG=zh` was not run: it needs ChatGPT's language switched.
- Extension tree SHA-256 (bookmarks-live's digest of the copied `extension/`): the same on main
  and the PR, `extensionTreeSha256` in the data files.

## Results

| Harness | main `6679151` | PR #86 | Same? |
|---|---|---|---|
| bookmarks-live, matrix (lab 1) | 35/35, 5:02 | 35/35, 5:00 (`1854dbb`); 35/35, 5:06 (`9ab5c4b`) | ordered check names and results identical; `cleanup` identical |
| bookmarks-live, `MODE=wash` (lab 2) | 42/42, 2:13 | 42/42, 2:12 (`1854dbb`); 42/42, 2:11 (`9ab5c4b`) | ordered check names and results identical; `cleanup` identical |
| branch-live (lab 1, 1280 and 800 px) | `ready` both, original unchanged, 0:41 | `ready` both, original unchanged, 0:45 | pill gap 4 px, top delta 0, native and Butter look strings identical |
| branch-live-edges, English (lab 1) | run 1: failed "original tab unchanged" (0:28); runs 2 and 3: every assert passed (1:00, 1:09) | every assert passed (1:01) | same end states: waits, then `ready`; no Butter cell in the unsaved and Work-mode branches |

- **bookmarks-live drags (matrix):** every held drag in both builds shows 0 turn mounts, 0
  storage reads, 0 bookmark messages and 0 calls to the bookmark functions the check watches.
  - **Frame times (single runs, no performance claim):** p95 frame time is 16.7–16.8 ms in all 12
    drags of both builds. main's max frame was 33 ms in three drags; the PR's was 17 ms in all six.
- **bookmarks-live wash:** six jumps per build (paragraph, selection and table, in light and dark),
  with the same box counts and the same scroll distances during the hold (+74, −680 and +80 px).
- **Send guard (blocked non-GET requests to chatgpt.com):**
  - matrix: 192 on main, 188 on the PR (191 at `9ab5c4b`);
  - wash: 112 on main, 115 on the PR (110 at `9ab5c4b`);
  - 0 send attempts in every run.
- **branch-live:**
  - The order of the blocked requests after the send click varies from run to run; all of them
    were blocked.
  - Branch identity, readiness, the original tab and the count of send requests from the original
    tab match.
  - The edges branch request came 1575 ms after the simulated stream ended on the PR, against
    1578 and 1538 ms in main's passing runs.

### Console output (quiet runner output)

| bookmarks-live run | main | PR `1854dbb` |
|---|---|---|
| matrix | 69 lines, 15 064 B | 39 lines, 1 791 B |
| wash | 70 lines, 6 360 B | 37 lines, 1 710 B |

The byte counts include the `/usr/bin/time -v` footer, 23 lines, in every log. What the
harness prints is one line per scenario, the cleanup line and the total. `VERBOSE=1` prints every
check and the `INFO` measurements, as before.

### A later scenario alone (preconditions)

At `9ab5c4b`, a later scenario run alone reports a skip with its reason:

```text
$ ONLY=resolve node lab/harness/bookmarks-live.mjs
skip resolve: the fixture chat is not loaded
cleanup {"remainingBeforeFallback":0,"remainingAfterFallback":0,"shortcutsRestored":true,"restored":true,"composerEmpty":true,"oneHomeTab":true,"defaultExtensions":true,"labLockReleased":true,"perfLockReleased":true}; summary.json in <out>
FAIL: no checks ran; skipped: resolve
```

`MODE=wash LAB_FIXTURE=demo-en12 ONLY=wash-light-table` prints the same skip line for
`wash-light-table`. Both runs:

- exit 1, because the runner fails a run with no checks;
- take and restore the lab: a precondition reads the live page;
- record the skip in `summary.json`'s `skipped`.

## Fixture harnesses that import the shared driver

| Harness | main | PR |
|---|---|---|
| branch-qa (headless) | 28/28, 381 s | 28/28, 379 s; lead rerun at `9ab5c4b`: 28/28, 380 s |
| bookmarks-qa, both markups, with the #69 and #51 mockups (`xvfb-run`) | 285/285 per markup, 1165 s | 285/285 per markup, 1165 s; lead rerun at `9ab5c4b`: 285/285 per markup, same check names as main, 1166 s |

Unit tests: `node --test` 541 on main, 571 on the PR.

## Notes

- **The edges failure on main.** branch-live-edges' first run on main failed "original tab
  unchanged" after the stream case had reached `ready`. Five later asserts (unsaved branch, Work
  mode, Temporary Chat, home page) did not run. The harness records only whether the original
  tab's URL, draft and scroll all stayed the same, not which one changed. Two reruns of the same
  build, under the same lock and browser, passed every assert, and so did the PR's run. The cause
  was not found; a scroll adjustment by ChatGPT after load, which branch-live waits out, is a
  guess, not a finding.
- **What the PR changes in output.** A run prints one line per scenario instead of a `PASS` line per
  check. bookmarks-live's `summary.json` keeps its fields, and adds `skipped`.
- **What is not covered.** Neither run set `LANG_TAG=zh`. The live lab has no fixture answer with
  a code block, so code blocks are covered by the fixture QA only.

## Data

`data/` holds each run's own output, as written by the harness (numbers, booleans, public Butter
labels, request paths with ids redacted):

- bookmarks-live: `bookmarks-{matrix,wash}-{main,pr}.json`, and the two precondition runs,
  `bookmarks-only-*.json`;
- branch-live: `branch-live-{main,pr}.json`;
- branch-live-edges: `branch-live-edges-main-{1,2,3}.json`, `branch-live-edges-pr.json`.

Screenshots, console logs, the lab host's paths and the private error file stay local.
