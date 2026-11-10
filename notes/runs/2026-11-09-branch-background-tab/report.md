# Ask in branch: hidden-tab stalls

## Finding

**Chrome's background page-timer throttling can suspend Butter's polling between state-machine steps.** The reproduced stalls were in `waiting-for-reply` and `verifying`. Moving the run's short waits to the extension service worker let three repeated replay runs finish while the destination stayed genuinely hidden. The actual selection → Ask in branch → new-tab handoff also finished while hidden.

This establishes a cause and a working prototype for the reproduced pause/resume behavior. It does not establish that every possible live-stream resumption problem has this cause.

Baseline: commit `0fd5b2384b6b14cf9c3b2a60ef17e41f0ec2a696`, Butter `0.1.0-alpha.18`. Browser: headed Chrome `156.0.8078.47` on the live Linux lab's virtual display. Normal browser flags were used except for the explicitly identified diagnostic arm. These are functional observations, not performance benchmarks.

## Evidence

| Arm | Result while hidden | Evidence |
|---|---|---|
| Baseline, hide at navigation commit | `ready` | [immediate.json](data/immediate.json); native rAF count remained zero |
| Baseline, hide after reply finished / entering menu steps | `ready` | [settled.json](data/settled.json); rAF count stayed fixed |
| Baseline, local stream replay | Stalled in `waiting-for-reply`; foregrounding advanced it | [streaming-red.json](data/streaming-red.json) |
| Baseline, repeated replay with polling instrumentation | Stalled in `verifying` despite native branch HTTP 200; foregrounding reached `ready` | [streaming-timers-red.json](data/streaming-timers-red.json) |
| Baseline replay, visible | `ready` | [streaming-visible.json](data/streaming-visible.json) |
| Baseline replay, background timer throttling disabled | `ready`, still hidden with stopped rAF | [no-timer-throttle.json](data/no-timer-throttle.json) |
| No extensions, replay + native branch menu | Stream finished; native branch rendered while hidden | [native-control.json](data/native-control.json) |
| Worker-delay prototype, hidden replay, three runs | `ready` in every run, without foregrounding | [run 1](data/worker-hidden-1.json), [run 2](data/worker-hidden-2.json), [run 3](data/worker-hidden-3.json) |
| Worker-delay prototype, visible replay | `ready` | [worker-visible.json](data/worker-visible.json) |
| Worker-delay prototype, actual Ask in branch UI, hide immediately | `ready`; native branch request targeted the server's latest saved message | [worker-ui-immediate.json](data/worker-ui-immediate.json) |
| Worker-delay prototype, actual UI, visible | `ready` | [worker-ui-visible.json](data/worker-ui-visible.json) |

In the first valid streaming red, all 189 replay chunks arrived and ChatGPT's streaming marker cleared. Nevertheless the page's interval counter remained at 40 from 16,190 through 41,576 ms, and Butter remained in `waiting-for-reply`. The document remained hidden and its rAF counter stayed fixed.

In the instrumented red, Butter's completed-sleep counter remained at 32 from 21,593 through 46,596 ms. The native branch request returned HTTP 200, the branch's replies and composer rendered, and Butter still showed `verifying`. After foregrounding, the pending work continued and the run reached `ready`. The probe received no `freeze` event and continued to evaluate DOM state through CDP throughout the stall.

The decisive differential was `--disable-background-timer-throttling`: the same page-timer-based implementation reached `ready` while hidden, with no native rAF progress. The observations identify page-timer starvation; their onset after expensive rendering is consistent with Chrome's background timer budget being exhausted. The browser's internal budget balance was not directly measured, so this report does not claim to distinguish every internal timer-throttling policy.

### Why deadlines did not make it fail immediately

`run.js` awaits `clock.sleep(100)` before its next predicate/deadline check. A delayed timer leaves the state machine suspended inside that await even though `performance.now()` keeps advancing. When the callback finally runs, a now-true predicate returns before the timeout check. Thus an already-rendered branch can be accepted after foregrounding even when the nominal verification window elapsed during the suspension. The streaming state also has its much longer existing deadline.

### rAF and native ChatGPT control

The valid hidden runs all reported `document.hidden === true` and a constant native rAF counter. The baseline hidden replay recorded zero matches/publications in Butter's smoother hook, yet the replay completed and its text rendered. rAF suspension therefore did not cause the reproduced polling stall.

The no-extension control restarted with an empty extension list and normal flags. It recorded no Butter page markers or smoother hook. Its page interval also stopped, remaining at 43 from 11,160 through 31,320 ms. The replay nevertheless finished and ChatGPT cleared the streaming marker. A driver polling from Node dispatched ChatGPT's own menu events and rendered a native branch while the tab stayed hidden. This separates the browser timer policy from an inability of ChatGPT's native branch UI to work in a background document. The user specifically requested continuing to find a workaround even if underlying page behavior also pauses; this investigation therefore continued beyond the repository's usual stop-after-native-control rule.

## Prototype

[prototype.patch](prototype.patch) contains the complete uncommitted product/test diff:

- `extension/branch/content.js`: the incoming tab's claim/run clock awaits a `butter-branch-delay` runtime message instead of a renderer `setTimeout`.
- `extension/branch/worker.js`: the extension worker responds after a bounded delay. It accepts only this extension's tab senders and integer delays from zero through 1000 ms. The run currently requests 100 ms.
- `test/branch-worker.test.mjs`: verifies asynchronous completion without a renderer timer and rejects invalid delays/senders.

The existing state-machine cancellation and identity checks remain in charge. The clock is used by the incoming branch claim/run and its retry, not by ordinary ChatGPT activity. Once the run ends it requests no more delays. In hidden replay run 3, the worker counters were 113 scheduled / 113 completed at `ready`, and were still 113 / 113 after another 1.5 seconds. The other measured ready runs also showed unchanged counters. One already-pending short response can still arrive after cancellation; existing cancellation checks prevent further page calls.

The successful hidden replay runs used normal Chrome flags. They retained real hidden-document visibility and stopped native rAF. The final native branch requests returned HTTP 200. The final send pipeline was blocked by the lab guard, as intended: `ready` proves Butter verified the branch and attempted submission, not that a model request succeeded. No real messages were sent.

## Method and limits

The lab was reached over SSH because this workspace machine only contained copied lab documentation, not the authenticated browser. A fresh snap-readable extension directory was loaded on the lab host. The lab lock was held throughout browser mutations and released after restoration.

Playwright's default focus emulation initially made background pages report visible. That setup run was discarded. Valid runs connected using `chromium.connectOverCDP(..., { noDefaults: true })`, switched to another tab in the same window, and checked actual hidden state and stopped rAF. The visible replay control additionally showed advancing rAF.

Streaming was a **local SSE replay in the destination tab**, using the lab's existing recording and ChatGPT's real streaming/rendering code. It was not merely a planted streaming marker. Preparatory responses were supplied locally, and the model request was intercepted locally. The lab-only content instrumentation waited for ChatGPT's real streaming marker before starting Butter's run. Because the replay's synthetic message IDs do not exist on the server, the native `new_branch` request was remapped to the source's real saved tail message. The rest of branch creation, routing, rendering, verification and attempted submission used the live UI. The recorded `tailMatches` field is taken before that rewrite, so false is expected for replay requests. The actual-UI hidden run needed no rewrite and recorded true. Its generic click probe did not count the popup submission; the blocked preparation request, rather than that counter, is the submission evidence for actual-UI runs.

A genuinely generating source conversation subsequently resumed in another tab was not separately tested: lab1 forbids real sends. In particular, this report does not establish behavior of every ChatGPT cross-tab stream-resumption transport. Early hiding and settled menu steps did not independently stall on the saved fixture. The prototype addresses the timer-suspended waits demonstrated here; Chrome discarding/freezing a tab or a separate visibility-gated network transport would need its own evidence.

[excluded-invalid-branch.json](data/excluded-invalid-branch.json) is retained as an excluded setup result: its first replay attempted an invalid branch because the harness had not yet captured the authenticated plural `/conversations/<id>` response. It is not used as evidence of the bug. Other failed setup attempts are listed in [commands.md](commands.md).

## Verification and artifacts

The worker test was observed red before implementation: six tests, five passed, one failed (`actual 'undefined'`, expected `'function'`). After implementation all six passed. The complete repository checks then passed: **456 Node tests, 70 Python tests, formatting, lint, version consistency, and `git diff --check`**. Raw check outputs are in `data/check-*.txt`.

- [Commands and actual output](commands.md)
- [Compact result summary](data/summary.json)
- [Live branch probe](probe.mjs)
- [Native no-extension control](native-control.mjs)
- [Lab-copy-only instrumentation](instrument-lab.py)
- [Prototype diff](prototype.patch)

No screenshots, HARs, credentials, real chat/message/account identifiers, or captured prompts/answers are included. The raw replay recording stayed on the lab host. Public fixed probe literals are harness inputs; real selected text in the UI tests stayed in the extension's transient handoff and was not exported. Result files retain only counters, states, Boolean comparisons, request-field names, status codes, and relative times.

Lab cleanup confirmed: default browser restored, one home tab, empty composer, lab lock released.

## Follow-up, 2026-11-10

Not lab runs; added after the lab was released.

- **Fallback added.** The shipped wait differs from [prototype.patch](prototype.patch): when the worker gives no answer (still starting, restarted, or the extension reloaded under the page), the run waits on a page timer as before instead of failing. The wait now lives in `extension/branch/logic.js` (`sleeper`) with a unit test. This version was not re-run in the lab.
- **User check in real Chrome.** The user installed test build `0.1.0-alpha.18+bgtab.1` (prototype plus the fallback) and tried three cases: Ask in branch while the source reply was still being written, leaving the new tab at once; Ask in branch on a finished reply, leaving at once; and staying on the new tab. They reported no problems. This is the only evidence for a genuinely generating source reply, the case the lab could not send. It is a report, not a recorded run: no states or timings were captured.
