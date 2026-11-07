# Ask in branch #27: happy path, fixture and live check

2026-11-07. Ticket [#27](https://github.com/SimianW/butter/issues/27) (parent spec #26), branch
`t3/aib-27` off the integration branch `t3/ask-in-branch` (`9e2435e`). Code tested: `bd230e8`.
No version bump, no package.

## Result

- **Unit seam:** `node --test` passes 266/266. The 33 branch tests cover message format, identity
  parsing, one-time claim and expiry, selection rule, the settings key, and every decisive rule of
  the branch run. Each decisive-rule test was mutation-checked: it fails when its rule is removed
  (see "Mutation check").
- **Fixture seam:** `node lab/harness/branch-qa.mjs` passes. It covers button alignment and mirrored
  style, following and hiding with ChatGPT's button, the settings key, question-box placement and
  flip, Enter, Shift+Enter, Esc and click outside with the draft kept, and the full new-tab flow. It
  saves 19 screenshots: mockup states 1–4 in light and dark at 1280 and 800 px, plus Simplified
  Chinese. There were no page errors and no request left the fixture.
- **Live seam (lab1, send guard on, only `POST /backend-api/conversation/new_branch` allowed):**
  both widths ended in **ready**. Butter branched from the latest reply and verified a new identity
  (an unsaved `local-chatgpt:` route, different from the original). It clicked ChatGPT's send button
  once, only in the verified branch tab, and the guard blocked the request that followed. The
  original tab's URL, draft and scroll were unchanged. A control run with the guard blocking
  `new_branch` ended in **failed**: nothing was typed or sent, and the original was unchanged.

## Live findings

Selectors re-verified live on 2026-11-07 (lab1, ChatGPT build `1bf7707f`, English UI, dark theme):

| Purpose | Live evidence | vs first version's notes |
|---|---|---|
| ChatGPT's selection button | `button` with text `Ask ChatGPT` (28 px) inside a fixed `z-50` wrapper; the drawn chip is its parent `div`: 30 px high, 8 px radius, `rgb(48 48 48)`, shadow `0 4px 8px -2px rgb(0 0 0 / .1)`, 14 px text | Same label. Butter copies these values from the computed style at runtime; live comparison: identical height, radius, background, shadow and font size, gap 4 px, top delta 0 |
| Replies | `[data-markdown-text-style="assistant-message"]`, inside `[data-turn-key]`, wrapper `[data-chatgpt-selection-conversation-id]` | Unchanged |
| More actions | `button[aria-label="More actions"]` with `use[href*="icon-ellipsis-horizontal"]`; no `data-testid` | Unchanged; opens on synthetic `pointerdown` |
| Branch conversation | `[role=menuitem][aria-haspopup=menu]` with `use[href*="icon-branch"]` | Unchanged |
| Branch in new chat | `[role=menuitem]`, exact text `Branch in new chat`, no icon or test id; sibling `Branch into Work mode` | Unchanged; still the most fragile selector |
| New identity | Route `/c/local-chatgpt%3A<uuid>` after `POST /backend-api/conversation/new_branch` (≈4.5 s after Enter) | Unchanged |
| Composer | visible `.ProseMirror[contenteditable=true]` (a hidden second one exists; must filter by visibility); rounded box `ComposerLayoutRoot` (28 px radius) | `#prompt-textarea` absent |
| Send | `execCommand('insertText')` keeps the `> ` lines; send button enabled after fill; click → `POST /backend-api/sentinel/chat-requirements/prepare` (blocked) | Before: never clicked |
| Theme | `<html data-theme="dark" data-appearance-mode="dark" class="chatgpt-theme">`, no `dark` class; `data-reduced-motion` present | New: Butter reads `data-appearance-mode`/`data-theme` first |
| Header | visible `header`, 52 px | Scrim starts at its bottom |

Request timeline of one live run (ms after Enter in the original tab, `live.json`):
`new_branch` 4537 (allowed) → route changes to the branch → ChatGPT pre-warms
`f/conversation/prepare` after the fill (blocked; ≈500 ms before the click) → Butter's send click
7695 (in the branch tab, route = branch) → `sentinel/chat-requirements/prepare` 8108 (blocked). No
send-path request came from the original tab. The blocked `sentinel` request is the first step of
ChatGPT's send, so `/backend-api/f/conversation` itself was never reached.

**Original-tab scroll drift (investigated).** Two live runs from before the step timeline existed,
both at 1280 px, found the original tab's scroll position changed. One recorded which field (scroll
498 → 520 px, `live-drift-1280.json`); the other recorded only `false`. The script then recorded the
original tab's scroll after every step (selected, button shown, box open, typed, Enter, end). From
`live-diag-3` on, it also waited for the scroll to stay put for 1.5 s before starting. In all eight
width runs with a timeline (`live-diag-1/3/4.json`, `live.json`) the scroll never moved at any step.
The drift most likely came from ChatGPT still adjusting the scroll after loading the chat, before
Butter acted, while the old script recorded "before" too early. This is a judgement from the
timelines, not proof for the two runs without one.

## Deviations from the mockup and spec

1. **State 2 doesn't show ChatGPT's "Ask ChatGPT" chip.** Focusing the question field moves the page
   selection into it, and ChatGPT hides its chip. Restoring the page selection would take the
   keyboard away from the field (tested). Butter's own button stays where it was. The quote stays
   visibly highlighted with the CSS Custom Highlight API, and Esc gives the selection back.
2. **Working-card copy:** "Your question will be sent in the new chat when it's ready."
   (完成后会在新对话中发送你的问题。) instead of the mockup's "filled into", because the spec
   decided on auto-send.
3. **When the line disappears.** The ticket says the line "disappears after the send", but Butter
   sends before the line could be read. It now stays after Butter's send and disappears when the
   user sends their next message from that tab (a trusted Enter in the composer or a click on send),
   on ×, or when the tab leaves the conversation. ChatGPT saving the branch (`local-chatgpt:` → saved
   id) doesn't count as leaving.
4. **Identity equal to the original → failed, not unsure.** Ticket AC 6 says to fill when the
   identity equals the original. That contradicts the rule "never type into the original
   conversation", which wins. An unreadable identity, a branch that hasn't rendered, or no send
   button → unsure: filled, not sent.
5. **× and Cancel on the working card are wired to cancel the run.** This keeps them from being dead
   buttons in a state #27 ships. Esc, the per-state cancel UI checks and the failure card's buttons
   are left to #28. #27 shows a minimal failure card: heading, "Nothing was sent.", the question, ×.
6. **Fixture native-chip position** follows the selection, not the mockup's illustrative coordinates.
   The live chip's colour and radius (8 px, `#303030` dark) differ slightly from the mockup's sample
   (7 px, `#3a3a3a`). Butter copies ChatGPT's live values, which is what the acceptance criterion
   asks for ("same … as ChatGPT's button").
7. **Live screenshots are dark only.** The lab account uses dark mode, and the fixture covers light.
   Live screenshots hide all chat content: page content is invisible, and the quote, title and
   composer are masked.
8. **Scope kept for later tickets.** No popup row or status group (#30). No Chinese menu labels,
   streaming UI or hidden-button rules (#29); the run already has a waiting-for-reply state, and its
   UI is the generic working card. No failure reporting to status (#28).

## Mutation check

Each line removes one rule from `extension/branch/run.js` and lists how many tests fail:
re-check before failure removed → 2; landed-check between menu attempts removed → 1; identity guard
before typing removed → 1; send while unverified → 2; thrown "Branch in new chat" press treated as
a timeout → 1; retry after the leaf was pressed → 5; streaming wait removed → 2.

## Commands and output

Full outputs are in [`checks/`](checks).

| Command | Output |
|---|---|
| `npm ci` | `found 0 vulnerabilities` |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run lint` | no findings |
| `node --test` | `tests 266`, `pass 266`, `fail 0` |
| `node --test test/branch-logic.test.js test/branch-run.test.js test/branch-worker.test.mjs` | `tests 33`, `pass 33`, `fail 0` |
| `python3 -m unittest discover -s scripts -p 'test_*.py'` | `Ran 41 tests`, `OK` |
| `python3 scripts/check-version.py` | `OK: 0.1.0-alpha.14 / 0.1.0.14; manifest, READMEs, and changelog agree.` |
| `node lab/harness/branch-qa.mjs` | 10 `PASS` lines ending `PASS 19 screenshots …; no page errors; no requests left the fixture` ([output](checks/branch-qa.txt)) |
| `lab-lock acquire --lab 1 --owner butter-aib-27 --wait 900` | `1` |
| `LAB_ID=1 LAB_EXTENSIONS=~/snap/chromium/common/butter-aib27-ext lab restart-browser` | `chromium: started` |
| `LAB_ID=1 LAB_OWNER=butter-aib-27 node lab/harness/branch-live.mjs` (no exception) | control: both widths `end: failed`, `sameAsOriginal: true`, no send click |
| `… BRANCH_PATH='^/backend-api/conversation/new_branch$' node lab/harness/branch-live.mjs` | exit 0; both widths `end: ready`, `kind: local`, `sameAsOriginal: false`, same latest-reply fingerprint, one send click `inBranch: true`, following request blocked, original unchanged |
| `lab-restore --lab 1 --owner butter-aib-27` | `"ok":true`, default extension, home tab, empty composer |
| `lab-lock release --lab 1 --owner butter-aib-27` | `"lab_released": true` |

The unsent local branches were discarded: Butter's composer text was cleared, the tabs closed, and
`lab-restore` reset the lab. Because the send was blocked, the branches were never saved.

## Screenshots

Mockup references (rendered from the approved artifact at 1280 × 800): [`mockup/`](mockup).

| State | 1280 light | 800 light | 1280 dark | 800 dark | zh |
|---|---|---|---|---|---|
| 1 button | [png](screenshots/button-1280-light.png) | [png](screenshots/button-800-light.png) | [png](screenshots/button-1280-dark.png) | [png](screenshots/button-800-dark.png) | |
| 2 question | [png](screenshots/question-1280-light.png) | [png](screenshots/question-800-light.png) | [png](screenshots/question-1280-dark.png) | [png](screenshots/question-800-dark.png) | [png](screenshots/question-1280-light-zh.png) |
| 3 working | [png](screenshots/working-1280-light.png) | [png](screenshots/working-800-light.png) | [png](screenshots/working-1280-dark.png) | [png](screenshots/working-800-dark.png) | [png](screenshots/working-1280-light-zh.png) |
| 4 ready | [png](screenshots/ready-1280-light.png) | [png](screenshots/ready-800-light.png) | [png](screenshots/ready-1280-dark.png) | [png](screenshots/ready-800-dark.png) | [png](screenshots/ready-1280-light-zh.png) |

Live, redacted, dark (`live-screenshots/`): [button 1280](live-screenshots/button-1280.png),
[question 1280](live-screenshots/question-1280.png), [working 1280](live-screenshots/working-1280.png),
[ready 1280](live-screenshots/ready-1280.png), and the same four at 800 px. Control (branch request
blocked, `live-control/`): [failed 1280](live-control/failed-1280.png), [failed 800](live-control/failed-800.png).

## Privacy

The JSON files keep paths with ids replaced (`<id>`, `<local>`, `/cdn-cgi/<challenge>`), identity
kinds and equality, and a 6-byte SHA-256 prefix of the latest reply's text (to show "same latest
reply"). They keep no chat text, titles, URLs or ids. In live screenshots all page content is hidden,
and the quote, title and composer are masked.
