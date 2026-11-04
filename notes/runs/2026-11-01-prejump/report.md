> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter pre-jump prototype — 2026-11-01

Prototype implemented; performance target not achieved. Median trigger-to-final-scroll falls from 9,637.4 ms to 2,595.6 ms (3.71 times faster), rather than the requested approximately ten times. Cold-load endpoints differ. With previously measured geometry, both variants can reach the same endpoint; this does not resolve the cold-load discrepancy.

Only extension/butter-nav.js and test/butter-nav.test.mjs changed. No commit, version bump, package or release.

## Measurements

The supplied long math chat has 12 user turns / 50 mapping nodes. Loading all older pages expands the thread from roughly 87,000 to 307,000–310,000 pixels. All six primary runs start at scrollTop 1,900, near the oldest question, after loading all 12 rail questions and observing the earlier button become hidden. Baseline is this checkout's HEAD, copied with git archive; prototype is the working-tree extension copied to a different snap-readable directory. Chromium was restarted when switching variants.

Timing and quantile definitions match (not archived) trigger is probe.start(), immediately before focus/Enter dispatch; final arrival is the last thread scroll event. Active frames end at that event plus 20 ms; quantiles use the sorted-array floor index. Longest LoAF includes entries starting between trigger minus 1 ms and arrival. Turn lifecycle counts cover the observation window (existing virtualized turns plus the new local user turn), not React render counts. Final message position is the new user bubble's top minus the visible scroller's top, captured after settling and before replayed answer chunks arrive. Neither the initial focus/setup interval nor idle recording frames are presented as the animation's frame distribution.

| Run | Trigger→final ms | Frame p50 | Frame p95 | Frame max | Longest LoAF | Mounted / removed |
|---|---:|---:|---:|---:|---:|---:|
| base-1 | 9823.4 | 16.8 | 2349.8 | 2516.6 | 2484.7 | 8 / 8 |
| base-2 | 9637.4 | 16.7 | 2116.5 | 2483.2 | 2460.1 | 8 / 7 |
| base-3 | 9549.4 | 16.8 | 2099.9 | 2466.6 | 2443.0 | 8 / 8 |
| prejump-1 | 2551.4 | 16.7 | 83.3 | 1983.1 | 1986.7 | 5 / 5 |
| prejump-2 | 2595.6 | 16.7 | 100.0 | 2033.2 | 2032.6 | 5 / 5 |
| prejump-3 | 2601.8 | 16.7 | 83.3 | 2033.3 | 2038.2 | 5 / 5 |

All frame/LoAF values are milliseconds.

| Run | Initial scrollHeight | Final scrollTop | New user bubble top relative to scroller |
|---|---:|---:|---:|
| base-1 | 308466 | 308100 | 4798 |
| base-2 | 307283 | 306917 | 5981 |
| base-3 | 309765 | 309399 | 3499 |
| prejump-1 | 308498 | 311346 | 1552 |
| prejump-2 | 308466 | 311314 | 1573 |
| prejump-3 | 307283 | 310131 | 1573 |

These cold-load endpoints are not within a few pixels. The baseline itself varies by 2,482 pixels between runs. The new question remains below the viewport in both cold variants. This is a material limitation, not an accepted completion of the endpoint requirement. Height changes during virtualizer remounts affect ChatGPT's placement destination, so a constant pre-jump target does not guarantee baseline equivalence for cold history.

## Implementation and timing

The isolated-world window capture listeners detect plain Enter in a nonempty editable composer or a click on that composer's enabled send button. Shift/modifiers, IME composition (including keyCode 229), repeat keydowns, empty text and disabled buttons are excluded. The current ChatGPT button is button[type="submit"] without the legacy test ID; the selectors cover both forms. Before a send, cancelJump() invalidates an in-progress rail journey and unpins; the existing fetch-level send handler also cancels, covering other submission paths. No scroll method is intercepted by the implementation, no DOM styles change, and no new fades or overlays are added.

If the visible scroller is more than one and a half viewport heights from the bottom, Butter makes one instant jump to one viewport above the bottom. ChatGPT handles the original event and retains ownership of its placement spring.

Empirical timing: in the inactive-selector trace, window main-world capture sees scrollTop 1,900 at 29,677.3 ms, then the first Object.place write occurs at 29,696.5 ms. With the active prototype, main capture sees the already-jumped scrollTop 306,674; Object.place preserves 306,674.3 at approximately 43.7 ms after measurement start. The guarded fetch begins at 41,712.3 ms; the restored Butter send event occurs at 41,714.8 ms, after placement. Thus place reads the actual position synchronously during event processing, before fetch/commit, and capture is the necessary timing. Moving the jump to the existing network send notification would be too late.

The longest prototype LoAF is 1,986.7 ms. Its ChatGPT DIV.onkeydown script is 1,894.1 ms, including 1,309.0 ms forced style/layout. The pre-jump avoids visiting intervening turns, but dirty virtualized tail content still needs synchronous rendering. This cost is consistent with the roughly two-second floor. The prior diagnosis's two-millisecond Butter self-time estimate was not re-measured here and is not used as an attribution claim for this prototype.

## Controls and visual evidence

- near-base: 844.6 ms; final scrollTop 312615; new user top 272; mounted/removed 1/0.
- near-prejump: 846.0 ms; final scrollTop 311432; new user top 272; mounted/removed 1/0.
- shift-prejump: 0.0 ms; final scrollTop 1900; new user top None; mounted/removed 0/0.
- click-prejump: 2956.4 ms; final scrollTop 310131; new user top 1573; mounted/removed 5/5.
- base-warm: 11096.7 ms; final scrollTop 312626; new user top 272; mounted/removed 10/8.
- prejump-warm: 2572.1 ms; final scrollTop 312626; new user top 272; mounted/removed 5/3.
- prejump-warm-final: 2635.5 ms; final scrollTop 312626; new user top 272; mounted/removed 5/3.

Near-bottom prototype capture and fetch both retain exactly the initial scrollTop 310,886; no pre-jump occurs. Shift+Enter has zero scroll events, zero local intercepted sends and identical initial/final scrollTop 1,900. Near-bottom baseline and prototype both place the new user bubble at 272 px; their approximately 845 ms timings match. The absolute near-bottom scrollTop differs because the previously loaded virtualizer estimates differ.

The supplementary geometry-settled checks begin with scrollHeight 312,992 and end at scrollTop 312,626 with user bubble top 272 px in both variants (zero-pixel difference in the first pair). This shows the chosen jump target can preserve ChatGPT's resting position when its measurements are settled. These checks are supplementary, not replacements for the cold-load primary comparison.

click-prejump is a separate recorded send, excluded from the three-rep timing summary. CDP Page.startScreencast captured 158 PNG frames. first-frames.png shows before send, the first captured frame after the send, a later spring frame, and the resting state. The first captured changed frame arrives 2,436 ms after measurement start, following a long held frame; it contains rendered math content, with no blank overlay or additional effect. The new question remains below the viewport, so the visual acceptance is limited. Full frames and timestamps are in click-prejump-frames/ and click-prejump.json.

## Safety and measurement corrections

No real user message was sent. Every measured send had exactly one locally intercepted POST /backend-api/f/conversation. The main-world hook returns only remapped recorded SSE, held for 15 seconds; other conversation/response/completion writes fail closed. The browser context routing firewall independently aborts any escaped matching non-GET/non-OPTIONS request. No escaped conversation write reached that firewall during the valid send runs. Conversation preparation writes were blocked by the page hook. replay.done is false at each measurement's end, excluding answer rendering.

Read-only server snapshots agree: before-server.json, after-base-server.json, after-prejump-server.json, after-controls-server.json, after-baseline-controls-server.json and after-server.json when present contain the same 50 nodes, 12 user IDs and current node. Snapshot reads use a fresh hidden iframe fetch to avoid Butter interpreting the full-conversation response as a loaded history page. Authentication tokens remain inside the page and are never logged or written to results.

The driver was adapted from the diagnosis's run.mjs/probe.js, not replaced with a synthetic scroller fixture. Necessary corrections: choose the visible scroller and composer (ChatGPT retains hidden copies); load actual earlier pages rather than trusting rail ticks populated by a full snapshot GET; restore Butter's fetch wrapper outside the local replay hook so send events still fire; restart Chromium after extension source changes because page reload can retain its cached script. Earlier setup/selector/cached-script attempts are discarded. Their JSON is named inactive-* where retained, and is excluded from comparison.json. Baseline primary runs predate restoration of the fetch-level rail signal, but the setup's real wheel cancels the rail journey before each send; they therefore have no pending rail activity. The supplementary baseline controls include the restored signal.

## Verification and reproduction

The new send-cancellation test first failed: 736 !== 700, proving the old pending jump could move the viewport. The final tests cover rail cancellation, pre-jump triggers, current submit markup, modifier/composition/empty/disabled guards, and near-bottom preservation.

Run (not archived) to rebuild both variant copies, restart the lab, load full history, collect three far-up sends per variant and controls, compare server snapshots, and restore the original extension and tab. It uses existing (not archived) Playwright and the recorded t09.json. summary.py prints the metrics; build-report.py writes comparison.json/html. Warm checks can be rerun using run.mjs reset, run.mjs prep, warm.mjs, then RUN=<name> node run.mjs send. All artifacts remain under /tmp; only the fix and tests are in git.

Commands and actual outputs are in commands-and-output.md. The browser restoration result is recorded in final-state.json.
