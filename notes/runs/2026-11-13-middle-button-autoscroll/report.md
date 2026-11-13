# Middle-button autoscroll diagnosis — 2026-11-13

Diagnosis only, through Control and Red. No product changes, commits, pushes, GitHub comments or fixes.

## 1. Regression or main?

**The reproduced rail-pin failure is also on main; it is not introduced by PR #110. Whether this is the exact cause of the user's live ChatGPT incident is not established.**

- Branch: `t3/popup-bookmark-toggle-storage`, `9fd9387664ab97b0764eb6e8e4bcc73b28049662`.
- Main: existing `origin/main`, `fac81813891d4c13fa603b6f79b37cc27eb69c80`, checked out detached under `/tmp/butter-middle-main`. No fetch or change to the task checkout's branch.
- The relevant `extension/rail/turns.js` and `extension/rail/jump.js` are byte-identical on these heads. The seek and history directories also have no branch diff.

### Live control limitation

Read the local live-lab README, acquired lab 1 and the performance lock as `middle-button-diagnosis`, copied both extensions to a Chromium-readable scratch path, and attempted to restart with the branch extension. The launcher reported a PID but the browser immediately failed:

```text
nohup: failed to run command '/snap/bin/chromium': No such file or directory
browserType.connectOverCDP: connect ECONNREFUSED 127.0.0.1:9222
```

`lab status` showed Chromium, Xvfb, VNC and noVNC stopped. This machine's migrated lab configuration still names the absent snap browser and paths belonging to its old host. Consequently none of the three builds was tested on authenticated, live ChatGPT. I did not modify the shared lab configuration or profiles, migrate a login, send a ChatGPT message, or assert that the live control passed.

`lab-restore --lab 1 --owner middle-button-diagnosis` was attempted with a 15-second outer timeout. It tried the same missing executable and timed out, exit 124. A successful home-tab restoration was impossible; `lab stop` returned the originally stopped lab to stopped. Both owned locks were released successfully:

```json
{"lab":1,"lab_released":true,"perf_released":true}
```

### Closest working control

Used an independent headed Playwright Chromium 158.0.8127.18 under Xvfb, with fresh temporary profiles and the complete unpacked branch extension, main extension, or no extension. This is a synthetic four-turn conversation at a fake, all-zero ChatGPT path, with 90 artificial paragraphs per turn. Every navigation is fulfilled locally; all other browser requests are aborted. No account, saved private layouts, live virtualizer or actual ChatGPT application is involved. All extension files are copied unchanged; the manifest loads their original ISOLATED and MAIN worlds.

Real native middle-button autoscroll works in this independent Linux Chromium when launched with `--enable-blink-features=MiddleClickAutoscroll`. Input was:

```js
await page.mouse.move(700, 300);
await page.mouse.down({ button: 'middle' });
await page.mouse.move(700, 600, { steps: 20 });
await page.waitForTimeout(1600);
await page.mouse.up({ button: 'middle' });
```

The page receives trusted middle events (`button: 1`, `buttons: 4`) and continues to scroll without wheel input or any injected scrolling loop. CDP `Input.dispatchMouseEvent` was not needed or tried. The unit red command described below does simulate compositor scroll increments; the browser controls use native autoscroll.

To produce the failure, first complete a rail jump to the second question, then trigger layout notifications by alternating the first turn's top padding between 30 and 31 px every 32 ms. This artificial size change stands in for asynchronous neighbouring-turn layout; it is **not evidence that the user's page had this particular change**. With no extension, the control starts at the same scroll position and makes the same size changes, without creating a Butter pin. Browser scroll anchoring is disabled uniformly in the fixture to separate Butter's writes from browser anchoring.

Primary runs, each starting at scrollTop 8314 (CSS px):

| Configuration | End scrollTop | Net downward progress (px) | Backward jumps over 3 px |
|---|---:|---:|---:|
| Branch, completed jump + size changes | 8502 | 188 | 52 |
| Main, completed jump + size changes | 8502 | 188 | 53 |
| No extension, matching size changes | 27616 | 19302 | 0 |
| Branch, size changes without a prior jump | 27306 | 18992 | 0 |
| Branch, prior jump without size changes | 27318 | 19004 | 0 |
| Branch, wheel after jump + size changes | 10114 | 1800 | 0 |

Two further repetitions per build gave branch progress 188/188 with 52/52 backward jumps, main 187/188 with 52/52, and no-extension progress 19279/19287 with zero backward jumps. The failure was 3/3 for branch, 3/3 for main, and 0/3 for no extension. These are functional scroll observations, not performance qualification or a Windows benchmark.

Full numeric samples and input-event summaries: [matrix.json](matrix.json), [repeats.json](repeats.json), [matrix-output.txt](matrix-output.txt), [repeats-output.txt](repeats-output.txt). The artificial fixture driver's exact source is preserved as data in [fixture-driver.txt](fixture-driver.txt). [comparison.html](comparison.html) plots the primary controls.

## 2. Feature and mechanism

**The rail's uncancelled pin causes the reproduced oscillation.** This is a missing user-scroll cancellation, rather than a middle press being accepted as a native-thumb seek.

1. `extension/rail/turns.js:109` cancels a jump on wheel, and line 110 on touch. The pointer listener at lines 111–118 calls `scrolled()` only when the target is the scroller itself and the pointer is at its right scrollbar edge. A middle press on answer content bubbles through that listener but fails that condition.
2. `extension/rail/rail.js:125` wires `scrolled` to `cancelJump`; therefore a middle press leaves the old jump pinned.
3. The pin's `ResizeObserver`, `extension/rail/jump.js:77`, continues following the clicked question. Line 84 writes `scrollTop` back to that question whenever it differs by more than 2 px. Native autoscroll moves down again, another size notification restores the old destination, and the two repeat.
4. In the unit seam, every simulated autoscroll increment goes from 236 to 316 then back to 236 when the actual observer callback runs. The wheel control progresses 236 → 316 → 396 → 476 → 556 → 636 → 716 with the same callbacks. The browser fixture independently exhibits over 50 backward movements while seeking remains inactive.

Single-key branch ablations, same jump/size-change scenario:

| Disabled key | Net progress (px) | Backward jumps | Failure remains? |
|---|---:|---:|---|
| `container` | 187 | 52 | yes |
| `cv` | 0 | 53 | yes |
| `throttle` | 188 | 53 | yes |
| `older` | 0 | 53 | yes |
| `rail` | 19104 | 0 | no |
| `seek` | 188 | 52 | yes |
| `layout` | 187 | 52 | yes |
| `branch` | 188 | 52 | yes |
| `bookmark` | 187 | 52 | yes |

Rail off prevents creating the pin; the size changes and native middle input still run. Without a prior pin, or without notifications to the pin's observer, this fixture does not shake. Disabling cv changes the exact equilibrium but does not remove the failure. This establishes a sufficient rail mechanism; it does not prove cv or the virtualizer cannot cause another kind of live autoscroll failure.

Seek reports `active: false`, `pending: false`, zero sessions on all of the failing runs. Its only middle-press entry is `{kind: null, reason: 'target', onScroller: false}` because the press is on content. Directly invoking the actual `classifyPress` on a trusted middle press targeting the scroller returns `{kind: null, reason: 'button'}` (`extension/seek/core-main.js:30`). The history-hold handler rejects non-left buttons at `extension/history/conversation-main.js:29`. Disabling either seek or older leaves the reproduced failure. The 40 existing seek-activation/history-hold tests pass; see [existing-controls-output.txt](existing-controls-output.txt).

## 3. Red command — first agreed seam

```sh
node --test test/middle-button-autoscroll.test.mjs
```

New uncommitted test: `test/middle-button-autoscroll.test.mjs`.

This uses the first seam in `docs/agents/seams.md`: the actual complete rail modules booted over `test/helpers/rail-boot.mjs` and its fake DOM. It completes a real rail jump, delivers middle pointer/mouse events on a descendant, then alternates downward scroll increments with the registered observer callbacks. It asserts preserved downward progress, not merely cancellation state or absence of exceptions. The wheel control uses the identical jump and observer sequence.

The browser fixture is corroboration, not the retained red seam: no live markup is needed to expose this cancellation/observer chain.

Observed exit code: **1**. Relevant actual output (the complete output is in [red-output.txt](red-output.txt)):

```text
wheel: [{"before":316,"after":316},{"before":396,"after":396},{"before":476,"after":476},{"before":556,"after":556},{"before":636,"after":636},{"before":716,"after":716}]
middle: [{"before":316,"after":236},{"before":316,"after":236},{"before":316,"after":236},{"before":316,"after":236},{"before":316,"after":236},{"before":316,"after":236}]
✔ wheel scrolling after a rail jump keeps downward progress through resize notifications
✖ middle scrolling after a rail jump keeps downward progress through resize notifications
ℹ tests 2
ℹ pass 1
ℹ fail 1
AssertionError [ERR_ASSERTION]: downward scrolling must not be reset by the old rail pin; start=236, final=236
```

The identical test was copied temporarily into the separate main worktree and failed in the same way: [main-red-output.txt](main-red-output.txt). The copy and worktree were removed afterwards.

## Supplied video and bug file

Both attachments were treated as data. No attachment content was executed. Every Python invocation reading an attachment or its derived frames used `python3 -I`.

The video is 3.904 seconds, 1586 × 976, 30 fps. Frames were extracted with ffmpeg into a newly created, initially empty directory outside the repository. I inspected first/early/middle/last frames and a contact sheet. The native autoscroll cursor is visible over answer content, and the same answer repeatedly moves upward then returns to the same starting position; it does not sustain downward progress. A Windows screenshot notification also appears; it is not diagnostic of Butter's state. No screenshots, text, formulas or account information from the video are included in this folder.

[video-motion.json](video-motion.json) retains only numeric frame-motion estimates. Coarse grayscale row registration across 116 frames finds repeated returns to the initial visual position, with the largest displacement about 92 original pixels. It is image registration at about 5.4 px resolution, not exact scrollTop telemetry, a frame-time trace, or a record of the mouse buttons. For example, the visual position returns to baseline around 0.533, 0.767, 1.5, 2.233, 2.533 and 2.733 seconds. The clip starts after any possible prior rail click, so it cannot establish the missing pin precondition.

The `butter-diag` file is version `0.1.0-alpha.21+dev.8`, saved by `trigger: 'button'`. Its safe summary is [diagnostic-summary.json](diagnostic-summary.json):

- Four turns, two currently mounted; saved press geometry clientHeight 1092, scrollHeight 27605, width 1760.
- Butter enabled, layout consent granted, all eight recorded option keys true. The recorder's allowlist omits `bookmark`, so its absence cannot establish whether the new Bookmarks switch was on or off.
- Nine events in the retained 30-second window, all layout-cache `rejection` events with reason `estimated`; there are no press, seek, commit or retarget events in that window.
- `pointerHeld: false` tracks **the left button only**. It is not evidence that the middle button was up.
- `turns.active.selection: 'last-seek-update'`, preview inactive, and a surviving earlier press/render summary. These show that a seek happened previously, without giving its time relative to this video or establishing that seeking caused the incident.
- No recorded failures. That mechanism records recognized feature failures, not every unexpected scrolling interaction, so this does not rule out the rail bug.

The `estimated` rejections alone do not demonstrate corrupt geometry or identify the cause of shaking. The file has no rail-pinned flag or scrollTop time series that could confirm this reproduction's preconditions.

## Proposed smallest fix — not applied

Treat a middle-button pointerdown anywhere inside the active conversation scroller, including its descendants, as the user's own scrolling and call the existing rail jump cancellation path. Preserve native autoscroll by leaving the event's default action intact.

## Remaining limits and cleanup

- Exact Windows/Chrome behaviour on the user's live conversation, the prior rail/bookmark jump, and the source of live size notifications remain unestablished.
- Source builds were tested, not an independently recovered copy of the user's exact dev zip. The fixture loads the complete ordinary extension; it does not include the dev recorder. Nothing observed implicates the PR's new bookmark/storage code.
- The artificial fixture has no ChatGPT React virtualizer or earlier-page traffic; no claim is made about all live causes of autoscroll shaking.
- The lab could not be fully restored to a home tab because its configured executable is absent. It was left stopped, as found; both locks were released. Independent browsers/profiles were closed/deleted.
- Temporary main test/worktree and the copied extension scratch tree were removed. The original checkout remains on `9fd9387`. Only the new red test and this report/data directory are untracked.

Commands and actual diagnostic outputs are recorded in [commands.md](commands.md). Private user captures stay outside the repository; only counts, numeric geometry, public reason codes, source references and synthetic fixture content are retained here.
