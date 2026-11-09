# #57 bookmarks live lab, third run — 2026-11-08

**PASS: 29/29 live checks passed.** Both earlier-history click paths now load the
bookmarked answer and land with the requested text in view. No product bug was found in this
matrix. `extension/` was not changed.

Earlier run 1 failed because live answers lacked the assistant-role/message-ID markup bookmark creation required.
Earlier run 2 failed because an unloaded earlier bookmark was grouped under a loaded-tail question, so clicking it fetched no history.

## Build and method

Branch `t3/57-bookmark-lab-3`; tested source HEAD `708f3c3c2e3ab76f0b2545ea991908e399dbb476`,
containing integration `64c3dd48a9d9add2661c528d0f61825c63e9f09b` and the previous harness/report merge.
Manifest `0.1.0-alpha.16`; Linux Chromium `156.0.8078.47`.
This worktree's extension was copied byte-for-byte into a fresh, Snap-readable unpacked install;
source and copied extension SHA-256 both `468377989b8974b8a57271247ea4e2d96a4a76cde42d81b90bbaf2ada49ccda0`.
The harness/report changes do not change that extension tree.
Run UTC: `2026-11-09T01:51:47.605Z` to `2026-11-09T01:55:37.007Z`; directory date follows the requested report path.

The named `math12` long-chat fixture ran under both the lab and machine-wide perf locks.
Send guard on; layout consent declined; no composer input, new prompts or server-side writes.
The approved #51 addendum and artifact #2 supplied the earlier-history placement/card rules.
This is the assigned live behavior/geometry matrix, not a claim of exhaustive screenshot comparison
across both themes/platforms.

## Results, one row per live check

| # | Check | Result | Numeric/public evidence |
|---|---|---|---|
| 1 | real long fixture loaded | PASS | 5 initial / 16 total questions; 11 earlier pages. |
| 2 | held drag empty 1 | PASS | 31 seek updates; 102 frames; mounts/additions/reads/requests all 0; frame p95 33.3 ms. |
| 3 | held drag empty 2 | PASS | 32 seek updates; 85 frames; mounts/additions/reads/requests all 0; frame p95 16.7 ms. |
| 4 | held drag empty 3 | PASS | 31 seek updates; 88 frames; mounts/additions/reads/requests all 0; frame p95 16.7 ms. |
| 5 | live selection message ids match conversation API by SHA-256 | PASS | 10/10 rendered assistant IDs match API; target matches; 41 API assistant IDs across 13 observed API responses. |
| 6 | hover button tooltip reads Bookmark | PASS | Accessible label and visible tooltip both equal Bookmark. |
| 7 | paragraph button saves one bookmark | PASS | 1 record; 1 segment. |
| 8 | selection saved through real Alt+Shift+M | PASS | 30 selected characters; 1 real Chrome command; 2 records / 1 segment. |
| 9 | held drag bookmarked 1 | PASS | 31 seek updates; 87 frames; mounts/additions/reads/requests all 0; frame p95 16.7 ms. |
| 10 | held drag bookmarked 2 | PASS | 31 seek updates; 92 frames; mounts/additions/reads/requests all 0; frame p95 16.8 ms. |
| 11 | held drag bookmarked 3 | PASS | 32 seek updates; 86 frames; mounts/additions/reads/requests all 0; frame p95 16.8 ms. |
| 12 | matched drag comparison with bookmarks versus empty | PASS | 3 empty / 3 bookmarked runs; every hold has zero mounts, added elements, reads and bookmark requests. |
| 13 | selection card jump after drag lands on text | PASS | Selection text in view at 61.7 px below scroller top; trusted row click. |
| 14 | paragraph jump requested during native drag lands on text | PASS | Thumb held before/after activation; deferred until release; text in view at 64.0 px. |
| 15 | reload before row click leaves earlier answer unloaded | PASS | 2 records / 1 segment / 5 loaded questions; earlier dots available; target unmounted. |
| 16 | earlier bookmarks sit under dots and not a loaded tick (row) | PASS | 1 dots segment / 0 loaded-tick segments; width 8 px / height 2 px; 5 px below dots; butter color matches. |
| 17 | hover earlier segment shows 2-bookmark card (row) | PASS | Visible card, correct public title and accessible name; 2 rows / 0 stale; multi-bookmark card. |
| 18 | row click loads earlier pages and lands on requested text | PASS | 5 earlier pages; requested text mounted and in view at 61.7 px; loading meta/spinner/dots observed: True/True/True. |
| 19 | segment moves from dots to loaded question after row click | PASS | 0 dots segments; 1 loaded-question segment. |
| 20 | reload before segment click leaves earlier answer unloaded | PASS | 2 records / 1 segment / 5 loaded questions; earlier dots available; target unmounted. |
| 21 | earlier bookmarks sit under dots and not a loaded tick (segment) | PASS | 1 dots segment / 0 loaded-tick segments; width 8 px / height 2 px; 5 px below dots; butter color matches. |
| 22 | hover earlier segment shows 2-bookmark card (segment) | PASS | Visible card, correct public title and accessible name; 2 rows / 0 stale; multi-bookmark card. |
| 23 | segment click loads earlier pages and lands on requested text | PASS | 5 earlier pages; requested text mounted and in view at 64.0 px; loading meta/spinner/dots observed: False/False/True. |
| 24 | segment moves from dots to loaded question after segment click | PASS | 0 dots segments; 1 loaded-question segment. |
| 25 | reload resolves both bookmarks live without answer changed | PASS | 2/2 original hashes/excerpts match; 2 live rows; 0 stale segments / 0 stale rows or warnings. |
| 26 | card delete removes selection bookmark | PASS | 1 record remains. |
| 27 | earlier bookmarks sit under dots and not a loaded tick (single) | PASS | 1 dots segment / 0 loaded-tick segments; width 8 px / height 2 px; 5 px below dots; butter color matches. |
| 28 | hover earlier segment shows 1-bookmark card (single) | PASS | Visible card, correct public title and accessible name; 1 row / 0 stale; single-bookmark loading explanation matches. |
| 29 | card delete removes both test bookmarks | PASS | 0 records remain; 0 segments. |

## Reproduction and earlier-history evidence

1. Load earlier history through the rail's dots, then bookmark one paragraph with its button and
   a different paragraph in the same answer using a 30-character selection and real Alt+Shift+M.
2. Reopen the fixture, recreating the rail/content scripts. Only five questions are initially
   loaded; the bookmarked answer is unmounted. Both records persist on one butter segment under
   the earlier-history dots, with no segment under a loaded question tick.
3. Hover its visible centre: the card says “Earlier questions · 2 bookmarks”, with two live rows.
   Click the second row. Earlier pages load until the target is known and mounted; the selection
   lands in view. The card's loading title, selected-row spinner and busy dots are observed.
4. Reopen again to restore the same unloaded precondition. Hover, then physically click the
   segment's centre. It selects the oldest paragraph bookmark, loads earlier pages, and lands
   that paragraph in view. Precise coverage records `rail.earlierJump` once on each path;
   the real input is trusted. After each load the segment leaves the dots for the real question.
5. Read the original answer and records in memory: both message hashes and excerpt heads match;
   reopen its card to confirm two live rows and no “answer changed” state.
6. Delete the selection from that card. Reopen with the remaining bookmark unloaded, hover its
   dots segment, and verify “Bookmark · earlier question” and the explanation that clicking loads
   earlier messages. Delete the remaining bookmark through the card; zero records/segments remain.

A direct segment click puts the hover card away; busy dots remain visible during loading.
The loading card/spinner are therefore observed for the row path, not the segment path.

The row and segment destinations are deliberately different paragraphs, so merely landing at
some part of the answer cannot pass both checks. No manual history-loading fallback was needed
in the final run. `jumpEvidence` in the summary retains trusted-input and public function-call
counts, not message IDs, excerpts or hashes of private IDs.

## Held-drag measurements

| Arm | Run | Seek updates | Frames | Turn mounts | Added elements | Storage reads | Bookmark requests | Frame p95 ms | Frame max ms |
|---|---|---|---|---|---|---|---|---|---|
| empty | 1 | 31 | 102 | 0 | 0 | 0 | 0 | 33.3 | 33.4 |
| empty | 2 | 32 | 85 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| empty | 3 | 31 | 88 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| bookmarked | 1 | 31 | 87 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| bookmarked | 2 | 31 | 92 | 0 | 0 | 0 | 0 | 16.8 | 16.8 |
| bookmarked | 3 | 32 | 86 | 0 | 0 | 0 | 0 | 16.8 | 16.8 |

A thread-subtree MutationObserver counts newly added element roots/descendants and turn mounts.
Worker probes count IndexedDB object-store/index read methods and local-settings reads; a
runtime listener counts bookmark requests. Precise coverage sees the real bookmark content
script in every hold: `refresh`, `paragraphs`, `measure`, `selection`, `topBlock`, `locate`,
`create`, `remove`, `show` and `place` execute zero times in all six intervals. Cheap event
checks still execute; the summary reports their aggregate function calls.
The measured interval starts after initial press/seek and ends before release; release/settling
latency is excluded. Three repetitions per arm describe this Linux fixture and do not establish
cross-platform performance or a precise timing difference between arms.

## Harness correction, privacy and cleanup

An exploratory attempt stopped because locator `.click()` requires the segment itself to own
the hit target. Segments intentionally inherit `pointer-events: none`; the rail routes clicks
on the underlying dots/tick using geometry. The corrected harness uses a real pointer click
at the visible segment centre, verifies actual pagination and the distinct text destination,
and reruns the entire matrix. This was a harness mistake, not a product bug. Both attempts
restored the lab, original shortcut preferences and released both locks.

The final send guard observed **0 send attempts** and blocked 131 unrelated
non-read ChatGPT requests. Final cleanup: 0 records before fallback /
0 after; shortcut preferences restored, default extensions, one home tab,
empty composer, lab lock released and perf lock released. The unique extension copy was removed.

Only public labels, counts, booleans, structure metadata and geometry are retained. No screenshots,
chat text, prompts/answers, message/account/conversation IDs, private-ID hashes, fixture URLs,
credentials, private endpoints or raw coverage are committed. The downloaded public visual spec
stays outside the report and is removed from the worktree after inspection.

## Artifacts and rerun

- [Numeric evidence](summary.json): all checks, six drag observations, trusted jump evidence and cleanup.
- [Commands and actual output](commands.md): setup, exploratory harness correction, final run, merge,
  checks and push.
- [Harness](../../../lab/harness/bookmarks-live.mjs):
  `OUT="$PWD/notes/runs/2026-11-08-bookmarks-live" EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs`.

Post-run `git fetch origin && git merge origin/t3/51-bookmarks` reported `Already up to date.`
`npm run format:check && npm run lint` passed. The extension tree still matches that integration
branch exactly. Actual output is recorded in the command log. This task
only pushes its test branch; it does not open a PR or merge into the integration branch.
