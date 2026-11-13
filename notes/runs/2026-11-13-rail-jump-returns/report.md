# Rail jump returns to its source — 2026-11-13

Diagnosis only: Control and Red from `docs/bugfix.md`. Product base: `6264167` (`0.1.0-alpha.21`, reported dev package `0.1.0-alpha.21+dev.2`). Local branch: `fix/rail-jump-returns`. No product changes, pushes, GitHub writes, or fix validation.

**Result:** a deterministic red reproduces an unmounted next-question jump spending several seconds behind the trip, abandoning the destination, and revealing the source turn. The same red fails before PR #112. The reproduced condition is an incorrect inferred next-turn position that never advances during retries. **The attachments do not establish that this was the condition during the user's click.** In particular, they do not measure the rail's source-turn rectangle at that time, and the fixture does not reproduce the video's exact final question-bubble position.

## 1. Control

Read the required repo instructions, local machine instructions, lab README, diagnostic/privacy documentation, glossary, prior middle-button run and its driver, and the `diagnosing-bugs` skill. Used that skill's Phase 1 only to construct the feedback loop; no Green work.

Ran the live lab's `lab status` once. It reported Xvfb, Chromium, x11vnc and noVNC all stopped. Its configured `/snap/bin/chromium` does not exist (`ls` exit 2). As the prior run also documented, the configuration contains paths from the old host. No live launch, authenticated ChatGPT run, or live Butter/no-Butter comparison was possible. No shared configuration/profile was edited; no lock was acquired, so none needed releasing.

The closest working control follows the previous run: independent headed Playwright Chromium **158.0.8127.18**, under `xvfb-run -a`, with a fresh temporary profile and the complete unpacked extension. All page requests are fulfilled locally or aborted; there are no ChatGPT requests, sends, account logins or saved private layouts.

The synthetic conversation differs from live ChatGPT:

- Three artificial turns, with allocated row heights 11817, 14796 and 2777 CSS px, and tops 100, 11917 and 26713 px. These are convenient rounded dimensions, not a reconstruction of the live virtualizer. The scroller is 900 px tall, rather than the capture's 1092 px.
- An explicit virtualizer mounts rows intersecting the viewport plus 200 px on either side, and removes distant rows. Question 2 starts unmounted. It mounts automatically if scrolling reaches its row; it is never deliberately blocked.
- The cold source turn's content is 800 px tall inside an independently allocated 11817 px row. The warm source fills its row. This artificial mismatch represents partial/remount content; the user's mismatch, if any, is unknown. The sanitized checked-in live page fixture also has a fixed-height, size-contained parent row around `data-turn-key`; it does not prove the user's live content was partial.
- No React, real ChatGPT mounting delays, formulas, streaming, hidden chat copy, actual answer content or browser scroll anchoring. All scroll assignments are accepted. The fixture contains one scroller.
- With Butter, input is the actual second rail tick's DOM click. Without Butter there is no rail: a fixture button requests the same destination using its known row position. This verifies that the row can mount and land, but is not an equivalent no-extension rail feature.

Actual browser results, sampled six seconds after each click:

| Extension | Source content | Target mounted at end | Final scrollTop | Target top in viewport | Trip released after click |
|---|---|---|---:|---:|---:|
| none | partial | yes | 11853 | 64 | n/a |
| none | full | yes | 11853 | 64 | n/a |
| Butter `6264167` | partial | no | 836 | n/a | 4541 ms |
| Butter `6264167` | full | yes | 11853 | 64 | 722 ms |

The partial Butter run finishes with only turn 0 mounted, its busy tick cleared, and the warp hidden. It does not restore the original scrollTop of 0; it reveals the source region at 836. Thus this control demonstrates Butter's wrong destination/reveal, not a pixel-exact replay of the video. This satisfies Control for the reproduced Butter failure; **the authenticated live control remains unavailable**.

Raw numeric samples: [browser-control.json](browser-control.json); actual console output: [browser-output.txt](browser-output.txt). Exact reproducible artificial driver: [fixture-driver.txt](fixture-driver.txt). Contexts are closed and temporary profiles removed in `finally`.

## 2. Red — first agreed seam

```sh
node --test test/rail-jump-returns.test.mjs
```

**Actual exit: 1.** Complete output: [red-output.txt](red-output.txt).

The test boots every real rail module in manifest order over `test/helpers/rail-boot.mjs`, the first seam in `docs/agents/seams.md`. Only DOM geometry, virtualizer mounting and time are simulated. The actual click handler, turn tracker, estimate, retarget, jump, trip and cleanup execute unchanged. No attachment is executed, no product function is replaced, no scroll is rejected/reset, and the target is not permanently withheld. The assertion requires the clicked question to be mounted and aligned at the rail's 64 px landing inset after 12.8 simulated seconds; it does not assert private jump state.

The warm control passes. A second positive control starts partial, becomes fully rendered after 1200 ms, and also lands. The persistent-partial scenario fails. Actual result data:

| Source content | Trip released at simulated time | Target mounted | Final target top | Final scrollTop |
|---|---:|---|---:|---:|
| full | 448 ms | yes | 64 | 11853 |
| partial, full after 1200 ms | 1408 ms | yes | 64 | 11853 |
| partial throughout retries | 4128 ms | no | n/a | 836 |

The persistent-partial run records a departure write to 450, followed by **eight identical writes to 836**. Its final busy state is false and warp is hidden. Actual failing output includes:

```text
✖ a rail click lands on the unmounted next question with partial source content
ℹ tests 3
ℹ pass 2
ℹ fail 1
AssertionError [ERR_ASSERTION]: jump did not land on clicked question 2 within 12.8 seconds: mounted=false, targetTop=null, scrollTop=836
```

The final three-scenario test was run on both heads. Earlier two-scenario iterations also failed on the same assertion; the complete final output above supersedes those exploratory outputs. Wall runtime is about a tenth of a second. The fake animations finish immediately; their clock values are not browser latency measurements.

## 3. What makes it run long, give up and reveal the source?

The reproduced path and condition, with line references at `6264167`:

1. The rail click calls `jump.go(i)` at `extension/rail/rail.js:218`. An unmounted target cannot use the glide branch (`extension/rail/jump.js:158`). The journey sets a 12000 ms deadline (`jump.js:24`, `jump.js:136`), measures the mounted turns (`jump.js:182`), and departs behind the moving placeholders (`jump.js:201`, `extension/rail/trip.js:102`). The departure itself waits 260 ms (`trip.js:14`, `trip.js:123`).
2. `extension/rail/turns.js:181` reads the **mounted turn element's** rectangle. `turns.js:193` then treats its bottom as the next question's exact position and adds that unmounted next question to `seen`. It does not measure the next question or the containing virtualizer row's allocation. In the cold fixture, the source bottom is 900 but the next row actually starts at 11917. `estimate()` returns the inferred value directly (`turns.js:241`); subtracting the 64 px inset puts the scroll at 836, still in the source's allocated row and nowhere near the target's mount window.
3. The mount loop (`jump.js:267`) tries at most eight times, waiting up to 30 animation frames per try (`jump.js:273`). On retry, `retarget()` calls `measure()` again (`turns.js:254`). With the same partial source still mounted, it writes the same inferred boundary again. For a target immediately after the mounted range, its deletion range starts after that target (`turns.js:256`), and `seen` additionally protects inferred positions (`turns.js:257`). The target estimate never advances. Merely deleting its old cache entry would not suffice if `measure()` immediately recreates the same wrong boundary.
4. After eight misses, `!el` returns at `jump.js:275`, **even if the 12 s deadline has not expired**. Cleanup at `jump.js:347` ends the trip, clears busy/wait, and unpins (`jump.js:354`). `trip.end()` calls `arrive(0, null)` (`trip.js:146`), which fades the current content back in without asking for another destination (`trip.js:91`). It does not explicitly scroll to question 1 or restore the original scrollTop. The source is shown because the actual scroll never reached the target.

Eight groups of 30 frames explain a multi-second placeholder interval on a responsive page; frame stalls increase wall time until the journey deadline is reached. The browser fixture releases in 4541 ms including its fade. **A long trip is not automatically a 12 s timeout.**

The readiness work comes **after** a successful mount: possible earlier-page wait (`jump.js:285`), pending math (`jump.js:297`), quiet frames and stable geometry (`jump.js:313`), then arrival (`jump.js:324`). None of those waits is reached in this red. An expired journey has a last chance to align a mounted target (`jump.js:334`); it cannot rescue an unmounted one. The capture cannot establish whether its live jump failed in the mount loop, expired later, was cancelled, or lost a mount during readiness.

## 4. Regression from PR #112?

**The reproduced failure is not introduced by #112.** The identical test was copied into an isolated archive of `5f429d4`, the commit before `864d566`, and run there. It exits **1**, with the same two passing controls, eight writes to 836, 4128 ms release, and destination-not-landed assertion. See [baseline-red-output.txt](baseline-red-output.txt).

`git diff 5f429d4 6264167 -- extension` changes only the middle-button pointer handler and its explanatory comment in `extension/rail/turns.js:114`; [product-comparison.txt](product-comparison.txt) preserves the exact diff. The estimate, retarget, jump, trip and rail click code are byte-identical. The new branch calls `scrolled()` for a middle press in the visible scroller (`turns.js:117`), wired to jump cancellation at `rail.js:125`. A normal left click on the rail's separate shadow host does not meet that condition. The test sends no middle press, and the video supplies no button event trace. This excludes #112 as the cause of this reproduced estimation failure, rather than proving the identity of the live incident.

## 5. Why intermittent?

In this loop, the difference is **whether the mount probe reaches the actual target row before the retries end**:

- With full source geometry, its bottom provides the right next-row position and the target mounts on the first probe.
- If the partial source finishes rendering during retries, the next measurement changes the estimate; the 1200 ms control lands at the same correct question.
- If the mismatch persists while the same source remains mounted, every retry repeats the same probe. The target never mounts, and cleanup reveals the source.

A target that is already mounted can avoid this mount loop altogether. Actual frame rate, delayed mounts, geometry changes, remounts and other input can affect which branch completes. Once mounted, a successful trip must also retain the target through readiness/alignment while its token remains live. These are code conditions; **the capture does not identify which varies between the user's successful and failing attempts**. No live failure rate was measured.

## 6. Does the supplied evidence contradict this mechanism?

Re-derived the JSON with `python3 -I`, reading it only as JSON data. The allowlisted result is [diagnostic-summary.json](diagnostic-summary.json):

- `butter-diag`, version `0.1.0-alpha.21+dev.2`, trigger `button`, left pointer not held, all eight recorded option keys true, and `failures` empty. An early return from the jump is not an exception, so an empty failure map does not rule it out.
- Three turns; only turn 0 mounted at save time. Recorded row heights approximately 11817, 14796 and 2777 px; all `measuredHeight` values zero; all readiness rows report `unmeasured-row`.
- The earlier scrollbar-press scroller reports clientHeight 1092, scrollHeight 27033, and two thread scrollers. These are **press-time** dimensions, not rail-click-time measurements. Two scrollers can be normal hidden chat copies; there is no evidence here that the rail chose the wrong one.
- 141 events: 32 `rejection` events (20 for turn 0, 12 for turn 1, all `estimated`), one press, one preview, 104 seek updates, one release, one commit and one reveal. The scrollbar release/commit around 26 s before save successfully reveals turn 1 in about 113 ms. That proves the target was reachable in a different operation; it does not trace the later rail click.
- The dev recorder has no rail click, journey, estimate, mount-retry or cancellation event. Its `turns.active` is the last scrollbar seek's target, not the currently active rail tick.

**Do not read `unmeasured-row` as the direct cause.** It describes seek-layout eligibility; the rail does not use that height map or layout reason. Likewise, `estimated` rejections belong to layout recording and do not prove that the rail's `estimate()` was incorrect.

The saved turn-0 `rowHeightNow` of 11815.56 px looks close to its recorded 11816.67 px. That is **the parent row's** rectangle (`extension/dev/sources.js:374`), whereas rail `measure()` reads the inner turn element. It neither disproves nor demonstrates the fixture's mismatch. The active diagnostic DOM belongs to the earlier sought turn 1, now unmounted, so there is no saved turn-0 element tree/rectangle to settle this. A demonstrated correct inner source bottom and adjacent row boundary throughout the click would falsify this particular fixture mechanism.

The video was probed with ffprobe: 7.445313 s, 1618 by 980, 30 fps. Frames were extracted by ffmpeg into a newly created empty directory outside the repo and inspected locally. Coarse half-second samples show source content, then Butter's streaming placeholders, then source content again around the latter part of the clip. This supports a failed trip reveal and is compatible with exhausting frame-counted mount retries before 12 s. It does not show DOM mounting, scrollTop, estimated positions, event buttons, the jump token, or a deadline. The source bubble appears near its starting position; **the retained 800 px fixture ends at a different offset within the source row**, so the exact visual return remains unexplained by measured evidence. No video frame, chat text, formula, account detail, original chat/message ID or captured URL is included in these artifacts.

## 7. Smallest proposed fix — not applied

For the adjacent unmounted target, base its inferred boundary on the **containing virtualizer row's end**, rather than only the potentially partial inner turn's bottom, when that row can be identified. The existing seek path already treats `data-turn-key`'s parent as the allocated row (`extension/seek/preview-main.js:240`). Preserve the current turn-based fallback for layouts without such a row. This is a narrow candidate in `turns.measure()`; it would make the cold fixture probe the actual next row.

A fix must be checked against real row gaps, parent identification and existing turn-tracker tests; blindly substituting any parent rectangle can overestimate when that parent contains the whole conversation. Independently, a repeated failed mount probe should have a bounded progress fallback rather than spend all eight tries at an unchanged position. Increasing the deadline or retry count alone leaves this red's no-progress condition intact. No candidate fix was applied, even temporarily, and no Green claim is made.

## 8. Checks and limits

- `npm run format:check`: exit 0, `All matched files use Prettier code style!` — [format-output.txt](format-output.txt).
- `npm run lint`: exit 0, no findings — [lint-output.txt](lint-output.txt).
- Existing rail jump/turn/trip/adapter tests: exit 0, **46 passed, 0 failed** — [existing-tests-output.txt](existing-tests-output.txt).
- The new red deliberately exits 1. The full CI suite was not run: this task stops at Red and does not claim a release-ready change.
- No authenticated ChatGPT control, Windows browser run, live virtualizer reproduction, exact live root-cause proof, or product fix. No shared lab lock/config/profile changes. Independent browser contexts/profiles cleaned up.

[commands.md](commands.md) records invocations, actual outputs and exploratory limitations. The only implementation-language addition is the red test under `test/`; everything else is this local diagnostic report and sanitized supporting data.
