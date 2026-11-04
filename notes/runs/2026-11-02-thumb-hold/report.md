> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Native scrollbar history-request hold

Implementation on `t3/scrollbar-thumb-hold`, base `5be066e` (`origin/main` when fetched), with the requested uncommitted pre-jump patch applied. No commits, version bump, packaging or release.

## Method

Headed lab Chromium, viewport $1599 \times 912$ CSS px, native scrollbar on `.thread-scroll-container`. Final runs drag from the bottom thumb to $y=2$ using real CDP mouse events, then hold there for 3100 ms before native release. Each run reloads the long 12-question conversation with only its newest history page loaded. Older GET responses are replayed from the supplied captured data because live pagination is rate-limited. The production fetch hook remains in place. Both arms include the same pre-jump patch.

The harness records rAF scrollTop/scrollHeight, actual page-request starts, input dispatch times, native DOM events, page parse events, long tasks and native scrollbar screenshots. After release it waits 12 seconds without input, then uses ordinary upward wheel input every 1.5 seconds to load the rest. A single top drag does not load the whole conversation in either arm: ChatGPT compensates scrollTop after inserting the page, leaving the view above the newly loaded content. Full-history times therefore include the deliberate 12-second observation and further wheel input; they are not automatic background-load latency.

Thumb coordinates use the screenshot-calibrated native track: 12 px arrows at both ends, 12 px minimum thumb in a 912 px viewport. The control held screenshot independently shows the thumb at $y=223$–$233$ after insertion. The thumb top is calculated as $12 + (H-24-\max(12,(H-24)H/S))T/(S-H)$, where $H$ is the viewport height, $S$ the scrollHeight, and $T$ the scrollTop. Max jumps below are adjacent rAF samples during the stationary top hold, excluding the intentional bottom-to-top drag. Native screenshot pixels have approximately 1 px rounding uncertainty.

`*-timeline.json` gives each run's height, scrollTop and thumb-position timeline from just before the stationary hold through five seconds after release. Full unabridged samples are in `*.json`.

## Results: three final runs per arm

| Run | Height during stationary hold (px) | Max thumb jump held (px) | Max scrollTop jump held (px) | Page starts held / after release | First start after release (ms) | Max task in first 12 s after release (ms) | Full history parsed / height settled (s after release) |
|---|---|---:|---:|---:|---:|---:|---:|
| control-4 | 92770 → 121997 → 121945 | 211.45 | 29227 | 1 / 6 | 12065 | 0 | 23.39 / 23.40 |
| control-5 | 92770 → 121997 → 121945 | 211.45 | 29227 | 1 / 6 | 12074 | 0 | 23.07 / 23.08 |
| control-6 | 92770 → 121997 → 121945 | 211.45 | 29227 | 1 / 6 | 12060 | 0 | 22.98 / 22.99 |
| hold-1 | 92770 | 0.00 | 0 | 0 / 7 | 4 | 1073 | 23.39 / 23.41 |
| hold-2 | 92770 | 0.00 | 0 | 0 / 7 | 2 | 1054 | 22.98 / 22.99 |
| hold-3 | 92770 | 0.00 | 0 | 0 / 7 | 6 | 1087 | 22.99 / 23.00 |

All controls held the thumb at $y \approx 12$, then the inserted page moved it to $y \approx 223.45$. All holds kept it at $y \approx 12$ and $T=0$ throughout the stationary hold, then moved to $y \approx 223.45$ after release. The post-release request count includes further wheel-assisted loading; only one of the hold build’s seven requests starts immediately on release. Controls start the next page only when that wheel input begins at about +12.06 s. No arm finishes all history during the 12-second no-input observation.

Hold-1 begins the drag at 88,260 px scrollHeight and reaches 92,770 px before the stationary top hold. The other final runs begin at 92,770 px. This pre-hold geometry change is separate from pagination and remains visible in the raw data.

On release, all hold runs show a 29,227 px scrollTop compensation and 211.45 px thumb movement, with 1,054–1,087 ms maximum long tasks. The page height briefly reaches 121,997 px, then corrects down by 52 px. In hold-1’s video, JPEG region matching finds the existing answer heading 52 px higher at +2 s than at −0.5 s (`release-contact.jpg`, `release-visual-shift.json`). The large scrollTop change mostly compensates the insertion; it is not a 29,227 px displacement of the visible answer. The control has already incurred this work during the hold and stays stable immediately after release.

Complete history ends at 312,992 px and 12 rail questions in every final run.

## Native event facts

`native-events.json` captures an actual native scrollbar drag before implementation:

- Both pointerdown and mousedown arrive on the scroller ($x=1593$, offsetX 1252; clientWidth 1238, offsetWidth 1258).
- No pointermove or mousemove reaches page listeners while the native drag is held.
- Both pointerup and mouseup arrive on window capture after release.
- Focusing the scrollbar blurs the composer immediately after down. A capturing blur listener would end the hold prematurely. The implementation listens to window blur without capture.

The implementation releases on either up, pointercancel, window blur, a hidden document, `older` switching off, a later mousemove with no buttons, or the absolute 30-second safety timeout. The duplicate pointer/mouse pair flushes the queue only once.

## Changes

- `extension/butter-nav-main.js`: scrollbar hit testing (including RTL gutter and overlay edge), bounded hold queue, AbortSignal cleanup/rejection, existing `older` off-marker gate. Only earlier GET page requests wait. On release the original fetch receives its original receiver and request init. Send detection and `onPage` parsing are retained.
- `test/thumb-hold.test.mjs`: real fetch-wrapper unit tests for deferral, all releases, timeout, aborts, Request/init signals, settings, untouched sends/non-page requests, ordinary scroll loads and RTL/overlay geometry.
- `test/older.test.mjs`: window event-listener stub for the new event handling.
- `docs/how-it-works.md`: describes the existing older switch's new behavior and the wait-until-release trade-off.
- The supplied pre-jump patch remains uncommitted in `butter-nav.js`, its tests and the docs.

No popup text, items, stylesheet or layout changed.

## Verification

`node --test`: 39 passed, 0 failed (`unit-green.log`). The regression suite first ran against the control: 14 failures, including a page starting while held (`unit-red.log`).

`python3 scripts/check-version.py`: `OK: 0.1.0-alpha.8 / 0.1.0.8; manifest, READMEs, and changelog agree.`

`git diff --check`: exit 0, no output.

## Limits and risks

Already-started requests can still land during a drag. This change defers request initiation; it does not intercept response delivery or cancel requests in flight. A hold longer than 30 seconds intentionally releases for safety. Overlay hit testing uses the scroller's outer 12 px and only a direct scroller target, so custom/OS scrollbar geometry remains browser-dependent. RTL/overlay geometry has unit coverage; the live lab uses a right-side layout gutter.

The out-of-scope virtualizer rollback/remount mechanism is unchanged. This fix does not suppress scroll events, retain turns, alter estimates, or prevent remount work. It moves the page's insertion work from a drag to release and does not promise a jump-free release.

Small sequential samples in one browser with replayed responses establish the request-deferral effect, not production network timings or performance on other devices. Native drags have substantial remount/geometry work independent of pagination.

No real message was sent. Both page-world and browser-level guards reject conversation writes. All captures and frozen builds are local in this directory. Read-only source artifacts under `(not archived)` were reused without changes. Full commands and actual outputs are in `commands-and-output.md` and the referenced `.log` files.

## Regression checks and artifacts

| Check | Actual result |
|---|---|
| Wheel to the top with hold enabled | Seven older page requests start normally during wheel input; all 12 questions and 312,992 px history load. |
| Live rail jump to the first question | Seven replayed HTTP 200 pages, 12 ticks; first question at 64 px, no busy state, no page errors or uncovered insertions; 15.77 s including the harness's waits. |
| Repository `nav-earlier.mjs` fixture | All 14 scenarios pass; `errors []`. The copied harness uses the installed Playwright location and unchanged assertions. |
| `older` off, actual extension storage | Off marker `older`; a page request starts 3,087 ms before release, with the original `num_turns=10`. Settings restored afterward. The off arm replays captured two-turn bodies for those ten-turn requests; it tests passthrough/hold disabling, not ten-turn rendering performance. |
| Final artifact assertions | `node (not archived)`: all ten assertions/groups pass (`verification.log`). |

The copied live harness initially selected ChatGPT's hidden duplicate scroller, producing a null landing coordinate despite the visible first question being present. Only the copy was corrected to select a positive-height scroller; its full successful rerun is `nav-earlier-live.log`. The repo's original harness is untouched.

The separate slow-drag virtualizer rollback was not rerun as its own matrix here. This implementation leaves its event/remount path unchanged; pre-hold geometry changes still occur, and the measured release retains ChatGPT's 52 px correction. No claim is made that this fixes virtualizer rollback.

- Short, aligned comparison recording: control-vs-hold.mp4 (not archived), 8.03 s, 1600 × 456. Release is marked in both panels. Source recordings: `control-4.mp4`, `hold-1.mp4`.
- Per-run tables and timelines: `summary.json`, `control-4-timeline.json` through `control-6-timeline.json`, and `hold-1-timeline.json` through `hold-3-timeline.json`.
- Commands and actual output (not archived), with full `.log` files alongside.
- Frozen `extension-control/` and `extension-hold/`, `prejump.patch`, implementation/combined diff, and executable measurement/assertion scripts are retained here. `core.mjs` reads the original cached responses; it writes only into this output directory.

## Restoration

After verification, the browser was restarted with `LAB_EXTENSIONS=~/snap/chromium/common/butter-blank-head`, and the original tab was restored to `<chat>`. The task's lock was removed. Actual output: `chromium: started (pid 3231193)` followed by `restored <chat>`.

The retention-research task then reacquired the lock (`purpose: screen-v2`, start `2026-11-02T05:53:49Z`) and changed the lab to its own build. Its lock and browser were left untouched.
