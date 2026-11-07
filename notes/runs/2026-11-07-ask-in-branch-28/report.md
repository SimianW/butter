# Ask in branch #28: cancel and failure recovery, fixture check

2026-11-07. Ticket [#28](https://github.com/SimianW/butter/issues/28) (parent spec #26), branch
`t3/aib-28` off the integration branch `t3/ask-in-branch` (`19da28d`), then merged with it at
`8f0d247` (#30, popup row). Fixture and unit seams
only; no live lab run (not required for this ticket). No version bump, no package.

## Result

- **Unit seam:** `node --test` passes 286/286 after merging #30. New or changed tests:
  - `test/branch-run.test.js`: a cancel arriving while the run waits in each non-terminal state
    (loading, waiting-for-reply, branching, verifying, sending) makes no further page call and
    sends nothing; a cancel before the first state makes no call at all; a cancel after the end
    changes nothing. A page error while the branch has landed ends in ready, not failed. A page
    error with no branch fails only after the re-check. An error after the send click never
    sends again.
  - `test/status-session.test.mjs`: a branch failure is recorded at once as
    `butterFailures.branch`, the popup's probe of the tab still sees it, and a later successful
    branch clears it.
  - `test/branch-worker.test.mjs`: the original tab hears `claimed` or `unclaimed` for its job;
    "Close tab" closes only the asking tab.
  - `test/branch-logic.test.js`: which run failures count against the feature.
- **Fixture seam:** `node lab/harness/branch-qa.mjs` passes ([output](checks/branch-qa.txt)). New
  cases:
  - cancel via ×, Cancel and Esc: the card and cover go at once, ChatGPT's More menu is not pressed
    again, the tab stays on the original conversation and nothing is sent;
  - each failure type (`more`, `branch`, `newchat`, `identity`, `load`): the card appears no
    earlier than the re-check, shows its one-sentence cause plus "Nothing was sent.", nothing is
    typed or sent, and `butterFailures` is `{ branch: { branch: true } }`;
  - the card's controls, one per failure case: Esc and × close the card and cover and keep the tab;
    Close tab closes the tab; Copy question puts `> quote\n\nquestion` on the clipboard and shows
    "Copied"; Try again (after ChatGPT's menu is back) makes the branch, sends once in it, and
    clears the status failure;
  - a branch that lands during the re-check: ready, and no failure card at any poll;
  - pop-up blocked: no new tab, the box keeps the question and shows the whole reason, the job is
    deleted; a later Enter works;
  - failed hand-over (the worker can't store the job): the new tab is closed, and the box keeps
    the question and the reason;
  - after a normal hand-over the original tab's box closes once the new tab has claimed the job.
- **Screenshots:** state 5 in light and dark at 1280 and 800 px, plus Simplified Chinese at
  1280 px light, compared with the mockup rendered at 1280 × 800. The Chinese card matches the
  mockup's position, size, colours, copy and buttons. Light and dark use the same tokens as the
  working card from #27. States 1–4 were re-shot here as a regression check.

## Mutation and red checks

- Removing the post-sleep cancel check and the page-proxy cancel guard from `run.js` fails the 5
  "cancel while waiting in …" tests.
- Dropping `...reported` from the popup probe in `settings.js` fails the status-session test.
- The three page-error tests failed before `recover()` existed in `run.js`.
- The harness's `branch` failure case failed before the Esc listener ignored untrusted keys (see
  Findings).

## Findings

1. **The run's own Escape cancelled it.** `dismissMenus()` sends a synthetic Escape to close
   ChatGPT's menu after a menu step times out. The new Esc-to-cancel listener took that Escape as
   the user's, so every menu failure after the first step turned into a silent cancel. Esc now
   counts only when `isTrusted`. The harness's `branch` failure case caught it.
2. **Chrome's pop-up blocker doesn't apply to Butter's `window.open`.** From an extension content
   script, `window.open` opened a tab even with no user gesture and the blocker on. The same call
   from the page's main world was blocked. So the harness simulates a blocked pop-up where Butter
   makes the call: over CDP, `window.open` returns `null` in Butter's isolated world. The code
   path stays for browsers or policies that do block it.
3. **Popup rows are keyed by index.** Adding `branch` to `ButterStatus.groups` after `rail` (the
   agreed contract with #30) shifted the popup's fourth row ("Remember long-chat layouts") onto
   the `branch` key. The existing test `test/layout-consent.test.js` caught it. Fixed for the
   interim by a guard, then made moot by #30's row (see Deviations 4).

## Deviations from the mockup and spec

1. **"Copied" feedback.** The mockup doesn't show it. After Copy question succeeds, its label
   reads "Copied" (已复制) for 1.5 s.
2. **The pop-up-blocked and hand-over reasons have no mockup.** The reason replaces the box's hint
   line, in the failure colour (`--err`), wrapping to a second line when needed
   ([screenshot](screenshots/blocked-1280-light.png)). Copy: "Chrome blocked the new tab. Allow
   pop-ups for chatgpt.com, then try again." / "Couldn’t hand your question to the new tab. Try
   again." Chinese: 「Chrome 拦截了新标签页。请允许 chatgpt.com 打开弹出窗口，然后重试。」 /
   「没能把问题交给新标签页，请重试。」
3. **The original-tab box now stays open until the new tab claims the job.** It closes on the
   worker's `claimed` message, so a hand-over that fails at any point, including a claim the worker
   refuses, keeps the question. If nothing is heard within the job's lifetime (60 s + 5 s), the box
   shows the hand-over reason and the new tab is left alone.
4. **No popup change in the end.** Before #30 landed, this branch carried a one-statement guard in
   `extension/popup/popup.js`: until the popup had a row for every group, `groupKeys` left out
   `branch`. Without it, the "Remember long-chat layouts" switch toggled `branch`, a layout
   failure made `warning()` throw (index 4 has no row), and a branch failure was named with the
   layout row's label. #30 (merged into this branch at `8f0d247`) adds the row, so the guard was
   removed in the merge. `extension/popup/` and `extension/shared/status.js` are now identical to
   the integration branch.
5. **Esc on the failure card closes it**, like ×. The spec names Esc only for the working card.
6. **Failure causes and status.** One sentence per cause:
   - `more`: "Couldn’t find the latest reply’s “More actions” button."
   - `branch`: "Couldn’t find ChatGPT’s “Branch conversation” menu."
   - `newchat`: the mockup's sentence
   - `identity`: "The tab didn’t move to a new chat."
   - `load`: "This chat didn’t finish loading."
   - `stream`: "The reply didn’t finish in time."
   - `error`: "Something went wrong while making the branch."

   `stream` (a reply still being written after 15 minutes) is not reported to status. The other
   causes are. A cancel or an unsure result reports nothing.
7. **Page errors.** An unexpected page error before filling now re-checks for a branch, as a menu
   failure does, and carries on if one exists. After filling has begun it ends in unsure, never
   retrying, so it cannot send twice. #27 reported every page error as failed without a re-check.
8. **The failure card's menu labels stay in English** in the Chinese copy, as in the mockup.

## Commands and output

Full outputs are in [`checks/`](checks).

| Command | Output |
|---|---|
| `npm ci` | `found 0 vulnerabilities` |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run lint` | no findings |
| `node --test` (after merging #30) | `tests 286`, `pass 286`, `fail 0` |
| `python3 -m unittest discover -s scripts -p 'test_*.py'` | `Ran 41 tests`, `OK` |
| `python3 scripts/check-version.py` | `OK: 0.1.0-alpha.14 / 0.1.0.14; manifest, READMEs, and changelog agree.` |
| `node lab/harness/branch-qa.mjs` | 20 `PASS` lines ending `PASS 25 screenshots …; no page errors; no requests left the fixture` |

## Screenshots

Mockup references (state 5 rendered from the approved artifact at 1280 × 800):
[light](mockup/failure-light.png), [dark](mockup/failure-dark.png).

| State | 1280 light | 800 light | 1280 dark | 800 dark | zh |
|---|---|---|---|---|---|
| 5 failure | [png](screenshots/failure-1280-light.png) | [png](screenshots/failure-800-light.png) | [png](screenshots/failure-1280-dark.png) | [png](screenshots/failure-800-dark.png) | [png](screenshots/failure-1280-light-zh.png) |
| pop-up blocked | [png](screenshots/blocked-1280-light.png) | | | | |
| 1–4 (regression) | `button-*`, `question-*`, `working-*`, `ready-*` in [`screenshots/`](screenshots) | | | | |

## Privacy

Fixture only: synthetic page text, no account, chat ids or captured chat content.
