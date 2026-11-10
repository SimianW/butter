# Dev build: live held-drag capture and bug-fix handoff (#47)

The live check passed twice on the existing `math12` fixture, without sending ChatGPT a message.
The toast appeared while the thumb stayed held, further movement continued the same seek session,
and each shortcut press downloaded one privacy-safe file with press/seek events and
`pointerHeld: true`. No product bug was observed in this check; no product code was changed.

Tested base: integration branch `origin/t3/32-dev-bug-capture` at
`cb1cdce439bef95f001eceace2ac1182352bc9c3` (tickets #43–#46 merged). The starting worktree already
matched that commit after `git fetch origin`, so no reset was needed. Work branch:
`t3/47-live-check`. Package: `python3 scripts/package.py --dev`,
`0.1.0-alpha.15+dev.1`; source manifest unchanged. Platform: Linux, lab 1, Snap Chromium
156.0.8078.47, existing authenticated lab profile.

## Procedure and safeguards

Read issues #47 and #32 in full, `AGENTS.md`, `lab/README.md`, the external lab README,
`notes/runs/README.md`, the bug-file format/privacy section, and the earlier fixture reports.

Reusable command: `BUTTER_DEV_ZIP=dist/butter-0.1.0-alpha.15+dev.1.zip node lab/harness/dev-capture-live.mjs`.
Without `BUTTER_DEV_ZIP`, the script packages a new dev build itself. It uses the external lab
library and reads fixture URLs from its config; neither private URLs nor account data are in the
script or this report. [commands.md](commands.md) records commands and actual output;
[checks.txt](checks.txt) contains complete local CI output.

1. Acquire the lab with `lab-lock acquire --lab auto --owner butter-47-live-check --wait 60
   --needs-fixture math12` through the lab library. This was a functional check, not a performance
   benchmark; no perf lock was needed.
2. Unzip the package into a Snap-readable directory. Stop Chromium before modifying its profile
   preferences. Temporarily set an isolated download directory and seed `linux:Alt+Shift+B` for
   the dev extension's `save-bug` command, preserving the previous command/download preferences.
3. Restart with the unzipped dev build as the only allowed extension (`LAB_EXTENSIONS` plus
   `--disable-extensions-except`). Confirm its real worker and `chrome.commands.getAll()` binding.
   This new dev install used enabled defaults, English, and declined layout storage consent.
4. Install `L.sendGuard` before opening the fixture. It aborts non-GET/HEAD/OPTIONS ChatGPT
   requests. No composer input or send action is used. The final run counted 23 blocked mutation
   requests and zero conversation-send attempts; the first passing run counted 22 and zero.
5. Navigate to the named fixture and verify the URL equals that fixture. Select the visible
   conversation scroller and wait for hydration, scrolling upward through existing history if
   necessary. In both passing runs it grew from a five-turn, 1,268 px shell to six turns and
   16,182 px of scroll range, with an 860 px viewport and 20 px classic scrollbar gutter. The
   check requires substantial scroll length, not an arbitrary number of questions.
6. Park the real X pointer before holding the button. Move the native thumb with Playwright,
   press the left button, and drag 100 px. While still holding, send **real X11** Alt+Shift+B via
   `lab/harness/xtest-keys.py`, as in `dev-capture-qa.mjs`. A worker-side witness confirmed exactly
   one `save-bug` command; the worker's capture/download path was not called directly.
7. Read the actual on-page toast and held/session state, move another 90 px, and verify further
   seek updates and changed scroll position in the same session. Release explicitly and verify
   that session ends on `pointerup`.
8. Read the actual downloaded JSON, audit it before copying into this report, and save only the
   privacy-checked file and numeric/fixed-code observations. In `finally`, release any held
   button, disconnect, stop Chromium, restore the original command/download preferences, run
   `lab-restore --lab 1 --owner butter-47-live-check`, then release the owned lock. This cleanup
   also ran after every failed harness attempt.

## Evidence

| Check | Final run observation |
|---|---|
| Toast during held drag | `Bug 1 saved last 30 s · round 1`; `held: true`, `pointerEvents: none`, focus unchanged |
| Drag after toast | Same session 1; seek updates increased from 13 to 25; scroll position changed from 2,930 px to 4,676 px; toast still present, pointer still held |
| Explicit release | Same session, `reason: pointerup`, `held: false` |
| Download | Exactly one `butter-diag/round-1/bug-01_06-11-20.json`, 268,908 bytes, no Save As interaction |
| File state | `trigger: shortcut`, `pointerHeld: true`, 21 events: 1 press, 13 seek, 1 preview, 6 record; all event times ordered within the last 30 s |
| Readiness | Six readiness rows, matching `turns.order.count`; `turns.active.selection: active-preview-update` |
| Privacy | 1,263 private tokens/fragments checked from 33 current text containers and 348 math-source elements; zero matches; all non-metadata string values in the closed vocabulary |
| Cleanup | Original preferences restored; `lab-restore` returned `ok: true`, default extension restored, one home tab, empty composer; owned lab lock released |

Primary artifacts: [bug-01_06-11-20.json](bug-01_06-11-20.json), [summary.json](summary.json).
The download's SHA-256 is `658097850534658ccb6e2aade9fc790474decb559faa644b56a04164694d53ad`.

The earlier passing run is also retained: [bug-01_06-10-10.json](bug-01_06-10-10.json),
[initial-summary.json](initial-summary.json). It had 21 events (12 seek), six readiness rows,
`pointerHeld: true`, and the same uninterrupted-drag result (12 to 24 updates). Its older message
selector matched no message nodes, though its ID/math comparisons and complete string inventory
passed. The final run added current turn/bubble/answer selectors and 32-character text fragments,
asserted that text containers actually matched, and repeated the entire live procedure. Use the
final run for the stronger privacy check.

Privacy curation: no question/answer text, TeX, conversation/message IDs, URLs or account identifiers
were found in either saved file. Nothing needed stripping from the downloads: the archived bytes
are unchanged. Every non-metadata string was tested against the shipped closed allowlist, and the
complete unique string inventory in each summary was independently inspected: fixed codes,
settings values, HTML/SVG/MathML tags, fixed class names and attribute **names**, never values.
The specified top-level `kind`, ISO save time, version and trigger are format metadata. URL,
email and ID-shape scans also passed. Actual private page values were compared in-browser and
never exported. Raw browser output, profile preferences, fixture URL, and screenshots are excluded.

## Harness corrections and limits

Four setup attempts failed before the two passing captures. These were harness assumptions, not
product bugs; the lab was restored and the lock released after each:

- A direct `querySelector` selected a hidden duplicate scroller, so the classic-gutter assertion
  failed. A subsequent wait on the first turn timed out because that duplicate's turn was hidden.
  The final harness selects the visible scroller, as the shipped sources module does.
- The next attempt inspected the five-turn loading shell too early and rejected its short scroll
  range. The harness now waits for existing history to hydrate/load through read-only scrolling.
- One attempt reached nine turns and a 93,520 px scroll range but failed the harness's initial
  arbitrary requirement for more than ten turns. The corrected requirement measures a long scroll
  range (more than five viewports) and more than one turn. The passing run's six long turns meet it.

This verifies the real page and real extension command on Linux with a **seeded** Alt+Shift+B
binding. Linux Chrome reserves that chord for the bookmarks bar and does not assign it on install.
**The Mac default Option+Shift+B binding cannot be checked on this Linux lab and was not checked.**
No claim is made about macOS, automatic shortcut assignment, overlay scrollbars, all possible
history lengths, or screenshots/video. No visual product change was made.

## Ticket #47 acceptance criteria

| Criterion | Verification |
|---|---|
| Report shows toast during held drag, continued drag, saved press/seek events and `pointerHeld: true` | Passed twice; final run's table, file and summary above provide the witnesses |
| Saved file contains no chat text, TeX, IDs, URLs or account identifiers | Passed: exhaustive string inventory/allowlist, URL/email/ID scans, and live private-token comparisons; no stripping required |
| Bug-fix handoff before step 1 | `docs/bugfix.md` now explicitly says to read attached `butter-diag` files before step 1, linking the format/privacy section |
| Every CI check passes locally; PR carries reported tier | Local portion passed: `npm ci`, format, lint, 359 Node tests, 47 Python tests, version check. `Review tier: 2` against `origin/main`. PR metadata is deferred: this assignment explicitly forbids opening a PR; the eventual integration PR must carry that line and satisfy its review requirements |

No PR was opened, no integration-branch push was made, and the issue was not closed. This ticket's
branch is for the parent task to integrate; the PR portion of the last criterion remains the
parent's responsibility.
