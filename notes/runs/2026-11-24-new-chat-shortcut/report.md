# The new chat key (Alt+Shift+O, #163) on live ChatGPT

Date: 2026-11-24, 22:30–22:32 UTC. Lab 2 (account 2), Chromium 157.0.8103.50 (snap), with this
branch's unpacked build loaded: `feat/new-chat-shortcut` at `37811a4`, version `0.1.0-alpha.22`
(`0.1.0.22`), copied unchanged from `extension/` to a snap-readable directory
(`diff -r` clean). One lock, owner `new-chat-live`, taken with `--needs-fixture ats12` and held for
the whole sequence. 1 harness run of `lab/harness/new-chat-live.mjs`, plus one read-only draft check.
Send guard on throughout; nothing sent. No Temporary Chat with turns, no Work mode, and no project
or chat created, renamed or deleted. `lab-restore` ok, lock released.

**Exit code: 0.**

## Method

- Command: `LAB_ID=2 LAB_OWNER=new-chat-live EXT=<snap copy of extension/> FIXTURE=ats12 node lab/harness/new-chat-live.mjs`.
- The script restarts the lab browser with only the build loaded, then connects over CDP with the
  send guard on.
- The key is the real Chrome command: `xtest-keys.py Alt+Shift+O` sends XTest input on the lab's
  display (`:98`). The X pointer is on the tab strip and page focus is on the body
  (`activeElement.blur()`), so a stray key would reach ChatGPT's type-to-focus handler.
- "Reloaded" means `performance.timeOrigin` changed against a marker set before the press.
- `keysO` counts Alt+O keydowns seen by a capture-phase listener on the page's `window`.
- "Label" is the `aria-label` of the visible composer. With the old chat's composer still hidden
  in the DOM, the script reads the visible one (the catch in the 2026-11-23 probe).
- Fixture: the project chat is lab 2's `ats12`, not the script's default `math12`, so the
  `math12` chat's existing unsent draft was never touched. Both chats are in the same project.
  The project page is that project's `/g/g-p-<id>/project`. The normal chat is the first `/c/<id>`
  link in the sidebar.

## Key setup

`chrome.commands.getAll()` from the extension's service worker reported `Alt+Shift+O` for
`new-chat` in the lab 2 profile (`PASS key-assigned`). The key needed no manual setup; the
manifest's suggested key took effect.

## Script fix

None. The script ran as written. Its default fixture was overridden with `FIXTURE=ats12`, which is
an environment setting, not a code change.

## Verdict lines

Verbatim from the log, with ids masked by the script:

```
PASS key-assigned
REPORT project page loaded {"href":"/g/g-p-<id>/project","reloaded":false,"turns":0,"label":"New chat in <project>","len":0,"focused":true,"temporaryOn":false,"keysO":0}
REPORT project-page after {"href":"/g/g-p-<id>/project","reloaded":false,"turns":0,"label":"New chat in <project>","len":16,"focused":true,"temporaryOn":false,"keysO":0}
PASS project-page
REPORT project-chat before {"href":"/g/g-p-<id>-<slug>/c/<id>","reloaded":false,"turns":3,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0} after {"href":"/g/g-p-<id>/project","reloaded":false,"turns":0,"label":"New chat in <project>","len":0,"focused":true,"temporaryOn":false,"keysO":0}
PASS project-chat
REPORT normal-chat before {"href":"/c/<id>","reloaded":false,"turns":1,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0} after {"href":"/","reloaded":false,"turns":0,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0}
PASS normal-chat
PASS no-stray-key
REPORT temporary: not run (needs one send in Temporary Chat; TEMP_SEND=1 on a lab that allows sends)
REPORT work: not run (no Work-mode page without changing account settings; WORK_URL=...)
```

A `before` state is read before the press blurs the page, so `focused: true` there is ChatGPT's
focus on load.

## Summary per check

| Check | Verdict | Reloaded | URL after | Visible label names the project | Focus after | Page saw the key |
|---|---|---|---|---|---|---|
| project-chat | PASS | no | `/g/g-p-<id>/project` (from `/g/g-p-<id>-<slug>/c/<id>`) | yes (same as the project page's own label) | composer | no |
| project-page | PASS | no | `/g/g-p-<id>/project` (unchanged); typed text kept, 16/16 | yes | composer | no |
| normal-chat | PASS | no | `/` (from `/c/<id>`), not Temporary Chat, 0 turns | no ("Ask ChatGPT", as expected) | composer | no |
| no-stray-key | PASS | n/a | after browser Back, the normal chat's draft is unchanged (0 → 0) | n/a | n/a | no (0 Alt+O keydowns) |
| temporary | REPORT not run | n/a | n/a | n/a | n/a | n/a |
| Work mode | REPORT not run | n/a | n/a | n/a | n/a | n/a |

`temporary` needs one sent message in a Temporary Chat. This run had no permission to send, so
`TEMP_SEND` was not set. Work mode was not entered, so `WORK_URL` was not set.

## Drafts and restore

The project-page step typed 16 characters into the project page's composer, and the script
removed them. A read-only check afterwards, with the send guard on, read these visible composer
lengths:

| Page | Draft length |
|---|---|
| Project page | 0 |
| `ats12` | 0 |
| `math12` | 38 |

`math12`'s 38 is the draft length the 2026-11-23 probe recorded, so it is untouched. The normal
chat's draft was 0 before and after (no-stray-key).

`lab-restore --lab 2` restarted the browser without extensions, opened the home URL with an empty
composer, and returned `ok: true`. `lab-lock release` succeeded, and `lab-lock status` showed no
lab held.

## Caveats

- One run of each check; no repeats.
- The page's keydown listener runs in ChatGPT's page world. `keysO: 0` shows that the page never
  received the keydown: Chrome consumed it as the extension command.
- The raw log is `lab/harness/results/new-chat-live-2026-11-24T2230.log` (local, git-ignored). It
  holds only masked shapes, lengths and flags.
