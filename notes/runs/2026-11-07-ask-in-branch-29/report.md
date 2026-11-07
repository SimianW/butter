# Ask in branch #29: streaming wait, hidden-button rules, Chinese menus

2026-11-07. Ticket [#29](https://github.com/SimianW/butter/issues/29) (parent spec #26), branch
`t3/aib-29` off the integration branch `t3/ask-in-branch` (`19da28d`), then merged with it at `8f0d247` (#30).
All checks below were re-run after the merge. No version bump, no package.

## Result

- **Unit seam:** `node --test` passes 290/290 after merging `origin/t3/ask-in-branch` (#30's popup
  tests included; 284/284 before the merge). The new and changed branch tests cover the streaming
  wait with a fake streaming page, the hidden-button rules, Work-mode detection and menu matching
  in English and Simplified Chinese. Every new rule was mutation-checked: each one fails a test
  when removed (see "Mutation check").
- **Fixture seam:** `node lab/harness/branch-qa.mjs` passes (14 `PASS` lines, 24 screenshots, no page
  errors, no request left the fixture). New checks:
  - the button is offered while the latest reply streams;
  - the new tab shows the waiting card and title, then branches from the finished latest reply;
  - Cancel while waiting stops, and nothing is branched, typed or sent;
  - there is no button in Temporary Chat, Work mode (form cue, side-chat cue, Chinese UI), with no
    branch action, on an unsaved branch, or on an unsaved new chat, with Chat-mode controls;
  - the whole flow works with ChatGPT's menus in Simplified Chinese.
- **Live seam (lab1, send guard on, only `POST /backend-api/conversation/new_branch` allowed),
  `branch-live-edges.mjs`, run with ChatGPT in English and again in Simplified Chinese:**
  - **Streaming wait:** the new tab showed "Waiting for the reply to finish…" (card and tab title)
    while its latest turn was marked as streaming. It requested `new_branch` 1.69 s (en) and 1.66 s
    (zh) after the stream ended, then reached **ready**. It branched from the same latest reply
    (matching fingerprint) and made one send click, in the branch, which the guard blocked. The
    original tab was unchanged, and nothing was sent from it.
  - **Hidden-button cases:** no button in an unsaved branch or in a Work-mode branch, while
    ChatGPT's own selection button was shown. The control is a saved Chat-mode conversation, where
    the button appeared.

## Streaming: how the live check makes a reply "stream"

A real stream needs a real message, which lab1 forbids. The bench replay (`bench.mjs`) needs a send
in the original tab, which the guard blocks. Its fetch hook would also never reach a newly opened
tab, since that tab loads the conversation from the server. So a real streaming reply could not be
produced live.

`branch-live-edges.mjs` instead holds ChatGPT's own streaming marker on the new tab's latest turn:
`data-talvt-turn-state="in_progress"` for 8 s, then back to `complete`. That is the value ChatGPT
uses on finished turns: every turn on the live page read `complete`. The hold is installed when the
tab reaches the conversation URL (≈1 s after Enter). An init script would only reach the popup's
initial `about:blank`, whose window the real page reuses. ChatGPT had rendered some turns before
the hold, so Butter saw the stream begin after load, the case the settle window exists for.

Not verified live: the in-progress value itself and ChatGPT's stop button
(`[data-testid="stop-button"]`) during a real stream. Both come from the first version's lab notes
(2026-11-05) and #27's adapter.

## Work-mode detection evidence (for the PR)

Recorded live on 2026-11-07 (lab1, ChatGPT build `1bf7707f`), in English and with the browser
locale set to `zh-CN` (`LANGUAGE`/`LANG` env, ChatGPT auto-detect; no account setting changed).
Data: `live-en.json` / `live-zh.json` (`control`, `workBranch`, `unsavedBranch`, `temporary`, `home`).
A Work-mode conversation was made without sending: **Branch into Work mode** on the latest reply
uses the same `POST /backend-api/conversation/new_branch` and opens an unsaved Work branch. It was
discarded.

| Signal | Chat mode (saved conversation, home) | Work mode (Work branch, home after the Work switch) |
|---|---|---|
| Composer `<form>` attributes | `data-composer-placement` + `data-chatgpt-composer` | `data-composer-placement` only |
| Composer `aria-label` | `Ask ChatGPT` / `询问 ChatGPT` | `Work with ChatGPT` / `使用 ChatGPT Work` |
| Selection toolbar | `Ask ChatGPT` / `向 ChatGPT 提问` | `Ask ChatGPT` + `Ask in side chat` / `向 ChatGPT 提问` + `在侧边聊天中提问` |
| Replies with More actions | 5 of 5 | 0 of 7 (only Copy buttons) |
| Home switch | `Chat` `aria-pressed=true` (`聊天`), `data-composer-mode="chat"` | `Work` `aria-pressed=true` (`工作`), `data-composer-mode` absent |
| `<html>` | `data-appearance-preset="codex"`, `data-codex-*` | same, so **not** a Work signal |
| Route | `/c/<uuid>` (also `/g/g-p-…/c/<uuid>`) | same form; no Work-specific route |

Butter's rule (`ButterBranch.isWorkMode`) is Work = a composer form with `data-composer-placement`
but without `data-chatgpt-composer`, or a Work composer label, or "Ask in side chat" in ChatGPT's
selection toolbar. The structural signal comes first. If ChatGPT renames both attributes, the
form check stays silent and the labels decide. Screenshots: [Work branch toolbar en](live-screenshots/hidden-work-1280.png),
[zh](live-screenshots/hidden-work-1280-zh.png) (all page content hidden; Butter's button absent).

Other hidden-button signals seen live:

- **Temporary Chat:** URL `/?temporary-chat=true`. Its switch reads `Turn off temporary chat` /
  `关闭临时聊天` with icon `chat-bubble-checkmark-dashed` while on (`chat-bubble-dashed` while off).
  It has no replies to select without sending, so the live check records only the markers; the
  fixture covers the rule.
- **Unsaved branch / new chat:** route `/c/local-chatgpt%3A<uuid>` or `/`. The unsaved branch's
  replies have no More actions (0 of 7 en, 0 of 6 zh), so it is hidden for two reasons.
- **Menus** (ChatGPT's own labels; structure first):

| Item | Structure | English | Simplified Chinese |
|---|---|---|---|
| More actions | `button` with `use[href*=icon-ellipsis-horizontal]` | More actions | 更多操作 |
| Branch conversation | `[role=menuitem][aria-haspopup=menu]` with `icon-branch` | Branch conversation | 创建对话分支 |
| Branch in new chat | leaf `[role=menuitem]`, no icon | Branch in new chat | 在新聊天中创建分支 |
| Branch into Work mode | leaf `[role=menuitem]`, no icon (never pressed by Butter) | Branch into Work mode | 在工作模式中创建分支 |
| Send | composer form `button[type=submit]`, no test id | Send | 发送 |

## Live findings

- The Chinese live run went 更多操作 → 创建对话分支 → 在新聊天中创建分支 to **ready** with
  Butter in English. Butter's UI language is its own setting, independent of ChatGPT's.
- Before #29 the send button matcher had no Chinese label. It now also takes `发送` and, as a
  structural fallback, the composer form's submit button.
- An unsaved branch has no More actions on its replies, so a branch can't be branched before it is
  saved; this is consistent with the "unsaved" rule.
- Request timelines are in `live-*.json` (`stream.requests`). After the fill, ChatGPT pre-warms
  `f/conversation/prepare` (blocked). Butter's click → `sentinel/chat-requirements/prepare` (blocked).
  Nothing on the send path came from the original tab.

## Deviations

1. **The live stream is simulated** (see above). Everything else in that check is the real page.
2. **There is no separate waiting frame in mockup.html.** The waiting state is the working card
   (state 3) with the heading "Waiting for the reply to finish…" (正在等待回复完成…), as briefed.
   Geometry is checked against the mockup in the fixture: 400 px wide, centred, top 250 px, scrim
   from 56 px. The supporting line keeps #27's auto-send wording.
3. **Cancel while waiting removes the cover on the run's next poll (≤ 100 ms)**, through #27's
   cancel path, which #28 owns. The fixture waits up to 1 s for it rather than asserting it
   synchronously.
4. **A 1 s settle before every branch**, also when nothing streams, adds about 1 s to each run.
   Without it, a new tab that picks up a running stream just after load would branch a
   half-written reply.
5. **No live check of a saved Work conversation or a non-empty Temporary Chat.** Both need a sent
   message. The Work branch shows the Work signals, but it is also unsaved; the fixture checks each
   rule on its own.

## Mutation check

Each line removes one rule and lists how many unit tests fail (`branch-run`, `branch-rules`,
`branch-logic`): settle window removed → 2; a stream pause doesn't reset the settle window → 1;
no finished-reply wait before menus → 8; Temporary Chat rule → 1; Work rule → 1;
no-branch-action rule → 1; page facts not required → 1; structural Work cue → 1; labels not a
fallback (first match of either kind wins) → 1; new-chat leaf may open a submenu → 1; Chinese
More label → 1; Chinese new-chat label → 2.

## Commands and output

Full outputs are in [`checks/`](checks).

| Command | Output |
|---|---|
| `npm ci` | `found 0 vulnerabilities` |
| `npm run format:check` | `All matched files use Prettier code style!` |
| `npm run lint` | no findings |
| `node --test` | `tests 290`, `pass 290`, `fail 0` (after the merge of `8f0d247`; 284/284 before) |
| `python3 -m unittest discover -s scripts -p 'test_*.py'` | `Ran 41 tests`, `OK` |
| `python3 scripts/check-version.py` | `OK: 0.1.0-alpha.14 / 0.1.0.14; manifest, READMEs, and changelog agree.` |
| `node lab/harness/branch-qa.mjs` | 14 `PASS` lines ending `PASS 24 screenshots …; no page errors; no requests left the fixture` ([output](checks/branch-qa.txt)) |
| `lab-lock acquire --lab 1 --owner butter-aib-29 --wait 1800` | `1` (twice: inspection, then the live check) |
| `LAB_ID=1 LAB_EXTENSIONS=~/snap/chromium/common/butter-aib29-ext lab restart-browser` | `chromium: started` |
| `LAB_ID=1 LAB_OWNER=butter-aib-29 node lab/harness/branch-live-edges.mjs` | exit 0 ([live-en.json](live-en.json)) |
| `LANGUAGE=zh_CN LANG=zh_CN.UTF-8 … lab restart-browser`, then `LANG_TAG=zh … branch-live-edges.mjs` | exit 0 ([live-zh.json](live-zh.json)) |
| `lab-restore --lab 1 --owner butter-aib-29` | `"ok":true`, default extension, no flags, home tab, empty composer; home page back in Chat mode (`Chat=true`, `Work=false`, `en-US`) |
| `lab-lock release --lab 1 --owner butter-aib-29` | `"lab_released": true` |

The unsent branches (new chat and Work) were discarded. Their composers were cleared, the tabs
closed, and `lab-restore` reset the lab. Because the send was blocked, they were never saved.

## Screenshots

Fixture (`screenshots/`), mockup states plus the new waiting state:

| State | 1280 light | 800 light | 1280 dark | 800 dark | zh |
|---|---|---|---|---|---|
| 3 waiting (new) | [png](screenshots/waiting-1280-light.png) | [png](screenshots/waiting-800-light.png) | [png](screenshots/waiting-1280-dark.png) | [png](screenshots/waiting-800-dark.png) | [png](screenshots/waiting-1280-light-zh.png) |
| 3 working | [png](screenshots/working-1280-light.png) | [png](screenshots/working-800-light.png) | [png](screenshots/working-1280-dark.png) | [png](screenshots/working-800-dark.png) | [png](screenshots/working-1280-light-zh.png) |
| 1 button, 2 question, 4 ready | `button-*`, `question-*`, `ready-*` in the same folder | | | | |

Mockup reference for the card: [working light](mockup/working-light.png), [working dark](mockup/working-dark.png)
(rendered from the approved artifact at 1280 × 800 in #27).

Live, redacted, dark (`live-screenshots/`; all page content hidden, the chat title and composer
masked): [waiting en](live-screenshots/waiting-1280.png), [waiting zh](live-screenshots/waiting-1280-zh.png),
[ready after wait](live-screenshots/ready-after-wait-1280.png), [hidden: unsaved branch](live-screenshots/hidden-unsaved-1280.png),
[hidden: Work branch](live-screenshots/hidden-work-1280.png), and the `-zh` variants.

## Privacy

The JSON keeps request paths with ids replaced (`<id>`, `<local>`, `/cdn-cgi/<challenge>`), route
kinds, ChatGPT's UI labels, counts, and a 6-byte hash prefix comparison of the latest reply ("same
latest reply" as a boolean). It keeps no chat text, titles, URLs or ids. In the two
`hidden-unsaved` screenshots, the original chat's title in Butter's line was covered with the mask
grey after capture; the script now masks it at capture.
