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

## 2026-11-24, 22:48–22:56 UTC: Temporary Chat and the before/after GIFs

Lab 2, Chromium 157.0.8103.50 (snap). One lock, owner `new-chat-temp`, taken with
`--needs-fixture ats12` and held for the whole sequence (22:48:37–22:55:58). Six harness runs:
`new-chat-live.mjs` twice, one temporary re-check, and `new-chat-demo.mjs` three times. Small
helper scripts read the tab and the drafts. **One send**, in Temporary Chat. No Work mode, and no
project or chat created, renamed or deleted. `lab-restore` ok, lock released.

**Result: `temporary` is still not verified.** Every other check passes again on `d01f811`. The
one authorized send was spent on a run where the key was not bound, so `temporary` needs another
authorized send.

### Builds and the key binding

- After: `feat/new-chat-shortcut` at `d01f811`, version `0.1.0.22`. `extension/` was copied
  unchanged to a snap-readable directory (`diff -r` clean).
- Before: `main` at `b2df865`, taken with `git archive b2df865 extension | tar -x` into a new
  empty directory. Nothing was checked out.
- An unpacked extension's id comes from its directory. This profile's `extensions.commands` binds
  `linux:Alt+Shift+O` to the id of the directory the first run used (`new-chat` from that build).
  An extension loaded from a new directory gets a new id. Chrome leaves its suggested key unbound
  because another extension id already holds that key. The first run below used a new directory
  and got `FAIL key-assigned`. Every later run loads `d01f811`'s `extension/` from the first run's
  directory (contents replaced, `diff -r` clean). The id is the same, and the key is bound with no
  profile change.

### Job 1: Temporary Chat with turns

**Run 1** (`TEMP_SEND=1`, new directory, so no key). Exit 1. Verbatim; the script masks the ids:

```
FAIL key-assigned: no key assigned to new-chat
REPORT project page loaded {"href":"/g/g-p-<id>/project","reloaded":false,"turns":0,"label":"New chat in <project>","len":0,"focused":true,"temporaryOn":false,"keysO":0}
REPORT project-page after {"href":"/g/g-p-<id>/project","reloaded":false,"turns":0,"label":"New chat in <project>","len":17,"focused":true,"temporaryOn":false,"keysO":2}
FAIL project-page: url /g/g-p-<id>/project, reloaded false, text differs (17/16), focused true, page keydowns 2
REPORT project-chat before {"href":"/g/g-p-<id>-<slug>/c/<id>","reloaded":false,"turns":3,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0} after {"href":"/g/g-p-<id>-<slug>/c/<id>","reloaded":false,"turns":3,"label":"Ask ChatGPT","len":1,"focused":true,"temporaryOn":false,"keysO":1}
FAIL project-chat: url /g/g-p-<id>-<slug>/c/<id>, reloaded false, label differs, focused true, turns 3, page keydowns 1
REPORT normal-chat before {"href":"/c/<id>","reloaded":false,"turns":1,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0} after {"href":"/c/<id>","reloaded":false,"turns":1,"label":"Ask ChatGPT","len":24,"focused":true,"temporaryOn":false,"keysO":2}
FAIL normal-chat: url /c/<id>, reloaded false, turns 1, temporary false
FAIL no-stray-key: page keydowns 2, draft differs (23 → 1)
REPORT temporary before {"href":"/c/<id>?temporary-chat=true","reloaded":false,"turns":1,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0} after {"href":"/c/<id>?temporary-chat=true","reloaded":false,"turns":1,"label":"Ask ChatGPT","len":1,"focused":true,"temporaryOn":false,"keysO":2}
FAIL temporary: turns before 1, url /c/<id>?temporary-chat=true, temporary false, turns 1, composer 1
REPORT temporary navigation: client-side
REPORT work: not run (no Work-mode page without changing account settings; WORK_URL=...)
```

With no command bound, the key reached the page as a typed character. These FAILs measure the
missing binding, not the build. `temporary navigation: client-side` only means nothing happened.

- **The send.** The script's own prompt, `Reply with the single word: ok`, in
  `/?temporary-chat=true`. Count: 1. Lab 2 is `"sends": "opt-in"` in labs.json, and the brief
  allowed this one send. The script lifts the guard (`unrouteAll`) for this send only, so nothing
  in the lab's config changed.
- **Guard put back.** The script reinstalls the guard in `finally` and stops with a setup error
  if that fails. The run went on to print its `temporary` lines, so the guard was back. Every
  later connection installed the guard again.
- **Drafts the run changed.** The stray character went into `ats12`'s composer. On the normal
  chat, browser Back returned to `ats12`, so the script's draft reset cleared `ats12` (0) and
  left the normal chat holding the 24-character marker draft. A helper, with the guard on,
  cleared only that marker draft (`normal: 24 (marker draft) -> cleared to 0`). The Temporary
  Chat's stray character went with the chat, which is not saved.

**Run 2** (no `TEMP_SEND`, the first run's directory, so the key is bound). Exit 0. Verbatim:

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

**Temporary re-check, without a send.** A local script (not committed) reopened the Temporary
Chat that run 1 made, with the guard on and the bound build loaded, to run the same `temporary`
check on it:

```
PASS key-assigned
REPORT temporary reopen: no turns {"href":"/?temporary-chat=true","reloaded":false,"turns":0,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":true,"keysO":0}; not run
```

ChatGPT does not reopen a Temporary Chat by its URL: it opened a new, empty one. So the
`temporary` check (PASS/FAIL, and client-side or reload) needs one more authorized send. Next
time, load the build from the bound directory (`PASS key-assigned`) before sending.

### Job 2: before/after GIFs

- Recorder: `lab/harness/new-chat-demo.mjs`, on the same lock. It runs `ffmpeg -f x11grab` on the
  lab's display (`:98`) at 30 fps, as `rail-demo.mjs` does. The X cursor is not drawn.
- Steps, the same on both builds: restart the browser with only that build, open `ats12`, wait
  6 s, click the composer (focus in the message box), and wait 1.5 s. Then record: 1.0 s, press
  Alt+Shift+O as XTest input (`xtest-keys.py`, with the pointer on the tab strip), and hold 3.5 s.
- Crop, measured on the page: the chat column under ChatGPT's header, down to the viewport's
  bottom, as wide as the composer plus 16 px a side. That is 800 × 860 at x 570, y 139 on the
  1600 × 1000 display, the same in both runs. It leaves out the URL bar, tab strip, header (where
  the chat title is), sidebar and account.
- Masking, in post from the raw MP4:
  - Everything but the composer is pixelated in 20 px blocks: the chat turns, and the project
    page's heading and chat list.
  - The composer is sharp only in frames where its rect matches the settled page, within 0.3 % of
    pixels changing by more than 40 grey levels. The chat's composer is matched against the first
    frame, the new chat's against the last. Frames in between are pixelated whole: 7 frames of
    30 fps in the after run, 47–53 of 0–137.
  - The project name after "New chat in " is a solid grey box. It is measured with a canvas in the
    placeholder's own font, so "New chat in" stays readable.
- Caption strip: the build, "Alt+Shift+O pressed" from the press on, and "Page pixelated outside
  the composer for privacy".
- GIF: 12 fps, 128-colour palette.
- The raw MP4s and measured rects stay out of the repo, under the lab's `captures/new-chat-demo/`.

| | Build | What happens | File |
|---|---|---|---|
| Before | `main` at `b2df865` | nothing: same chat, composer "Ask ChatGPT", no character typed | `before.gif`, 800 × 924, 4.58 s, 95,911 bytes |
| After | `d01f811` | the page changes about 0.6 s after the press (frame 47; press at frame 30), and by 0.8 s it is the project's new chat: composer "New chat in ▇" at the top, focused | `after.gif`, 800 × 924, 4.58 s, 92,003 bytes |

A first after-recording had the name box in the wrong place. The `::before` `font` shorthand came
back unusable, so the canvas measured at 10 px. The box covered "at i" and left the name readable.
That GIF was replaced before any commit. The recorder now builds the font from its longhands, and
a third run made the committed `after.gif`.

Every frame of both committed GIFs (55 each) was extracted and looked at. They show no account
name, URL, chat or project title, or readable chat text.

### Drafts and restore

The read-only draft check after the last recording found: project page 0, `ats12` 0, normal chat
0, `math12` 38, all as before the session. `lab-restore --lab 2` restarted the browser without
extensions, opened the home URL with an empty composer, and returned `ok: true`.
`lab-lock release` succeeded, and `lab-lock status` showed no lab held.

## 2026-11-24, 22:59–23:02 UTC: Temporary Chat with the key bound

Lab 2, Chromium 157.0.8103.50 (snap). One lock, owner `new-chat-temp2`, taken with
`--needs-fixture ats12` and held for the whole sequence (22:59:34–23:01:51). Three harness runs:
a no-send probe, `new-chat-live.mjs` with `TEMP_SEND=1`, and a read-only draft check. The probe
and the draft check are local scripts and are not committed. **One send**, in Temporary Chat. No
Work mode, and no project or chat created, renamed or deleted. `lab-restore` ok, lock released.

**Result: `PASS temporary`**, client-side (no reload). Every check passes on `ef6792f`, plus the
script fix below. Exit code 0.

### Build and key

The build is `feat/new-chat-shortcut` at `ef6792f`, version `0.1.0.22`. It was loaded from the
directory the profile binds Alt+Shift+O to, the one the earlier runs used. Its contents already
matched `extension/`: `diff -r` was clean before each run, so nothing was copied. Both runs
printed `PASS key-assigned` before anything else.

### Script fix

`new-chat-live.mjs` used to send with `TEMP_SEND=1` even after `FAIL key-assigned`; the 22:48 run
spent its send that way. The send is now gated on the key: with `TEMP_SEND=1` and no
`PASS key-assigned`, the script prints
`REPORT temporary: not run, nothing sent (key-assigned did not pass, ...)` and sends nothing. The
`temporary` verdict's logic is unchanged.

### Is "temporary on" valid on an empty Temporary Chat?

The verdict reads `temporaryOn` (a `button[aria-label="Turn off temporary chat"]` exists) and the
URL shape `/?temporary-chat=true`. A probe with the bound build and the guard on checked this
before the send. It loaded each page with nothing typed and nothing sent:

```
PASS key-assigned
REPORT {"path":"/?temporary-chat=true","turns":0,"len":0,"temporaryOn":true,"tempButtons":["Turn off temporary chat (shown)"]}
REPORT {"path":"/","turns":0,"len":0,"temporaryOn":false,"tempButtons":["Temporary chat (shown)"]}
```

An empty Temporary Chat shows "Turn off temporary chat"; a normal new chat shows "Temporary chat"
instead. A Temporary Chat with turns has neither (`temporaryOn: false` in its `before` state), so
the signal separates the empty Temporary Chat from both. The check needed no change.

### Verdict lines

Command: `LAB_ID=2 LAB_OWNER=new-chat-temp2 EXT=<bound directory> FIXTURE=ats12 TEMP_SEND=1 node lab/harness/new-chat-live.mjs`.
Verbatim; the script masks the ids:

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
REPORT temporary before {"href":"/c/<id>?temporary-chat=true","reloaded":false,"turns":1,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":false,"keysO":0} after {"href":"/?temporary-chat=true","reloaded":false,"turns":0,"label":"Ask ChatGPT","len":0,"focused":true,"temporaryOn":true,"keysO":0}
PASS temporary
REPORT temporary navigation: client-side
REPORT work: not run (no Work-mode page without changing account settings; WORK_URL=...)
```

Key press from `/c/<id>?temporary-chat=true` with 1 turn: the page landed on
`/?temporary-chat=true` with no reload, 0 turns, an empty composer that had focus, and "Turn off
temporary chat" visible. The page saw no Alt+O keydown.

### The send

- The script's own prompt, `Reply with the single word: ok`, in `/?temporary-chat=true`.
  Count: 1. Lab 2 is `"sends": "opt-in"` in labs.json, and the brief allowed this one send. The
  script lifts the guard (`unrouteAll`) for this send only, so the lab's config did not change.
- **Guard put back.** The script reinstalls the guard in `finally`. If that fails, it prints
  `FAIL temporary: send guard could not be put back` and stops with a setup error. It printed the
  `temporary` lines and exited 0, so the guard was back. The draft check after it installed the
  guard on its own connection (`REPORT guard installed`).

### Drafts and restore

The run's typed text (16 characters on the project page and the normal chat's marker draft) was
removed by the script. The Temporary Chat is not saved. The read-only check afterwards, with the
guard on, read `{"projectPage":0,"ats12":0,"normal":0,"math12":38}`, the same as before the
session. `lab-restore --lab 2` restarted the browser without extensions, opened the home URL with
an empty composer, and returned `ok: true`. `lab-lock release` succeeded, and `lab-lock status`
showed no lab held.

The raw log is `lab/harness/results/new-chat-live-2026-11-24T2300-temp2.log` (local, git-ignored).
