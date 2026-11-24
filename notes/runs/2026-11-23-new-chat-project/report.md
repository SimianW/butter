# How ChatGPT starts a new chat, in and out of a project

Date: 2026-11-23 (22:53–23:20 local). Lab 2 (account 2), Chromium 157, **no extension**
(`EXT=` empty; `REPORT setup … "extensions":[]`). One lock, owner `new-chat-probe`, held for the whole
sequence; 6 harness runs of `lab/harness/new-chat-probe.mjs`; send guard on throughout; nothing sent;
no project or chat created, renamed or deleted. `lab-restore` ok, lock released.

Fixtures: the project chat is lab 2's `math12`; the project page is that
project's `/project` URL; the normal chat is the first `/c/<id>` link in the sidebar. Q5's project
chat is `ats12`, because `math12` already held an unsent draft (left untouched by Q5).

Key presses: `page.keyboard.press` (CDP `Input.dispatchKeyEvent`). The page's own capture-phase
listener saw them as `isTrusted: true` keydowns. Clicks: Playwright mouse clicks, except the two
sidebar buttons (see Q2), which needed a DOM `element.click()`.

"Reloaded" means the in-page marker `window.__probe` was lost or `performance.timeOrigin` changed;
"client-side" means both survived.

REPORT lines below are shortened (`…` drops fields); ids are `<id>`, titles `<title>`. Raw logs:
`lab/harness/results/new-chat-probe-2026-11-24T0*.log` (local, git-ignored; run 1's log holds
unmasked sidebar titles and must not be published).

## Q1. URL shapes

| Page | URL observed |
|---|---|
| (a) Project page | `/g/g-p-<id>-<slug>/project` (lab's home URL). Links ChatGPT renders to it (header link, "New chat in <project>") use `/g/g-p-<id>/project`, without the slug. Both load the project page. |
| (b) Saved chat in a project | `/g/g-p-<id>-<slug>/c/<id>` (fixture URL). Sidebar and project-page links use `/g/g-p-<id>/c/<id>`, without the slug. |
| (c) Normal saved chat | `/c/<id>` |
| (d) Fresh new chat | `/` (composer `placement=home`, label "Ask ChatGPT") |
| Temporary Chat | `/?temporary-chat=true` (header shows `button[aria-label="Turn off temporary chat"]`) |

A new chat in a project has no URL of its own before sending: it is the project page (d′ =
`/g/g-p-<id>[-<slug>]/project`, composer labelled "New chat in <project>"). The URL after a first
send was not observed (sending was out of scope).

```
REPORT survey {"page":"projectPage","url":"/g/g-p-<id>-<slug>/project",…,"composer":{…"placeholder":"New chat in <title>",…"placementAttr":"home",…"edAria":"New chat in <title>","focused":true},…}
REPORT survey {"page":"projectChat","url":"/g/g-p-<id>-<slug>/c/<id>",…"composer":{…"placementAttr":"thread",…"edAria":"Ask ChatGPT"…},…"headerProjectLink":true,…}
REPORT survey {"page":"normalChat","url":"/c/<id>",…"placementAttr":"thread",…"edAria":"Ask ChatGPT"…}
REPORT survey {"page":"home","url":"/",…"placementAttr":"home",…"edAria":"Ask ChatGPT"…}
REPORT survey {"page":"temporary","url":"/?temporary-chat=true",…"placementAttr":"home",…}
REPORT survey {"page":"projectPage","sidebarChatLinkSample":[{"kind":"chat",…"href":"/c/<id>"},{"kind":"projectChat",…"href":"/g/g-p-<id>/c/<id>"},…]}
```

## Q2. Controls that start a chat inside a project

The composer is `.ProseMirror[contenteditable="true"][role="textbox"]` (`#prompt-textarea` matched
nothing). Its form has `data-composer-placement` `home` (new chat) or `thread` (saved chat).
There is no `data-testid` on any of the controls below.

| Control | Structure | Clicked from a project chat |
|---|---|---|
| Sidebar "New chat in <project>" | `nav button[aria-label="New chat in <project>"]` (20×20, `type=button`, no href), inside the project's row | → `/g/g-p-<id>/project`, **client-side**; composer "New chat in <project>" (exact match with the project name), `placement=home`, project's chat list in `main` (12 links). **Starts a chat in the project.** |
| Header project link | `header a[href="/g/g-p-<id>/project"]`, aria-label = project name, 36×36 icon link; present only on project chats | → `/g/g-p-<id>/project`, **client-side**; same state as above. **Starts a chat in the project.** |
| Project page composer | composer labelled "New chat in <project>", `placement=home`, focused on arrival | is the new chat in the project |
| Sidebar project row | `nav div[role="button"][aria-expanded]`, holds the name, the actions button and the "New chat in" button; no `<a>` inside | **No navigation**; toggles `aria-expanded` (collapses/expands the project's chat list). |
| "Project actions for <project>" | `nav button[aria-haspopup="menu"]` | Menu: `Project settings`, `Pin project`, `Share project`, `Rename project`, `Project home`, `Delete project` (all `button[role=menuitem]`). **No "New chat" item.** `Project home` not clicked. |
| Sidebar "New chat" | `nav button[aria-label="New chat"]` (24×24) | → `/`: **leaves the project** (composer "Ask ChatGPT"). |

Playwright's real mouse clicks on both sidebar buttons ("New chat", "New chat in <project>")
timed out ("waiting for element to be visible, enabled and stable"). `elementFromPoint` at their
centres hit other sidebar or thread content: the buttons sit at x≈328–368, past the row's right
edge (60–322). Their results above come from `element.click()` on the button, which runs
ChatGPT's own handler. How a real pointer reaches them (on hover, at another sidebar width) was not
checked.

```
REPORT controls {"name":"click js:nav button[aria-label=\"New chat in <title>\"]","from":"/g/g-p-<id>-<slug>/c/<id>",…"reloaded":false,…"url":"/g/g-p-<id>/project","probeKept":"m1795493589595",…"mainProjectChatLinks":12,…"composer":{ph:"New chat in <title>",len:0,place:"home",aria:"New chat in <title>",focus:true},"composerLabelNamesProject":true,…}
REPORT controls {"name":"click header a[href$=\"/project\"]",…"reloaded":false,…"url":"/g/g-p-<id>/project",…"composerLabelNamesProject":true,…}
REPORT controls {"sel":"nav div[role=\"button\"]:has(button[aria-label=\"New chat in <title>\"])","count":1,"el":{"tag":"div","role":"button",…"expanded":"false","rect":[60,502,262,36],"hitSelf":true,…}}
REPORT controls {"name":"click nav div[role=\"button\"]:has(…)",…"url":"/g/g-p-<id>-<slug>/c/<id>",…"sidebarProjectChats":6,…}
REPORT controls {"rowAfterClick":{"expanded":"true"}}
REPORT controls {"projectActionsMenu":[{…"role":"menuitem",…"text":"Project settings"},{…"text":"Pin project"},{…"text":"Share project"},{…"text":"Rename project"},{…"text":"Project home"},{…"text":"Delete project"}]}
REPORT controls {"name":"click js:nav button[aria-label=\"New chat\"]",…"reloaded":false,…"url":"/",…"composer":{ph:"Ask ChatGPT",len:0,place:"home",aria:"Ask ChatGPT",focus:true},…}
REPORT controls {"sel":"nav button[aria-label=\"New chat in <title>\"]","count":1,"el":{…"rect":[328,510,20,20],"hitSelf":false,…}}
```

## Q3. Is a plain navigation to the project page reliable?

From the project chat, judged by the visible composer's label being exactly "New chat in
<project>", `placement=home`, and the project's chat list in `main`:

| Method | Result |
|---|---|
| (a) click the existing header `<a>` | `/g/g-p-<id>/project`, client-side, composer ready and focused, label names the project. **Yes.** |
| (b) `history.pushState(slugged /project path)` + `popstate` | `/g/g-p-<id>-<slug>/project`, client-side, same state as (a). **Yes.** |
| (c) `location.assign(project page URL)` | full reload, then the same state. **Yes, but reloads** (new `timeOrigin`, ~6 s here). |

After (a) and (b) the old chat's 3 turns and composer stay in the DOM, hidden (`hiddenTurns: 3`,
`editors: 2`). ChatGPT's own link click leaves the same state, so (b) matches native.
Any code that finds "the composer" must take the visible one. Run 2 read the first one, reported
`composerLabelNamesProject: false` for (a) and (b), and is superseded by run 3.

```
REPORT nav {"name":"click existing <a> to project page",…"reloaded":false,…"url":"/g/g-p-<id>/project",…"turns":0,"hiddenTurns":3,"editors":2,"mainProjectChatLinks":12,…"composer":{ph:"New chat in <title>",len:0,place:"home",aria:"New chat in <title>",focus:true},"composerLabelNamesProject":true,…}
REPORT nav {"name":"history.pushState + popstate",…"reloaded":false,…"url":"/g/g-p-<id>-<slug>/project",…"hiddenTurns":3,"editors":2,"mainProjectChatLinks":12,…"composerLabelNamesProject":true,…}
REPORT nav {"name":"location.assign",…"reloaded":true,…"url":"/g/g-p-<id>-<slug>/project","probeKept":null,…"hiddenTurns":0,"editors":1,"mainProjectChatLinks":12,…"composerLabelNamesProject":true,…}
```

## Q4. ChatGPT's own Ctrl+Shift+O (Linux)

| Pressed in | Result |
|---|---|
| (a) normal chat `/c/<id>` | `/`, client-side |
| (b) project chat | `/`, client-side: **leaves the project** (composer "Ask ChatGPT") |
| (c) project page | `/`, client-side: **leaves the project** |
| (d) Temporary Chat | `/`, client-side: **leaves Temporary Chat** (`?temporary-chat=true` dropped, no "Turn off temporary chat" button) |
| home `/` | stays `/` |
| Sidebar "New chat" from a project chat (Q4b) | `/`: leaves the project (Q2) |

ChatGPT handles the keydown: `defaultPrevented: true` on the trusted `Ctrl+Shift+O` keydown (key
log captured on the Temporary Chat press; the earlier presses' key logs were lost to a probe bug,
fixed in run 4; their URL results stand). Cmd+Shift+O on a Mac was not tested.

```
REPORT keys {"name":"Control+Shift+O in normalChat","from":"/c/<id>",…"reloaded":false,…"url":"/",…}
REPORT keys {"name":"Control+Shift+O in projectChat","from":"/g/g-p-<id>-<slug>/c/<id>",…"reloaded":false,…"url":"/",…"composer":{ph:"Ask ChatGPT",len:0,place:"home",aria:"Ask ChatGPT",focus:true},…}
REPORT keys {"name":"Control+Shift+O in projectPage","from":"/g/g-p-<id>-<slug>/project",…"reloaded":false,…"url":"/",…}
REPORT keys {"name":"Control+Shift+O in temporary","from":"/?temporary-chat=true",…"keysSeen":[{"t":"keydown","key":"O","code":"KeyO","ctrl":true,"alt":false,"shift":true,"meta":false,"trusted":true,"defaultPrevented":true},…],"url":"/",…"temporaryOn":false,…}
```

## Q5. Unsent composer text

Typed 16 characters (not sent) into a saved chat's composer, then started a new chat.

| Route | Warning? | Back (browser Back) | Reopened with a fresh load |
|---|---|---|---|
| Normal chat → Ctrl+Shift+O | none (no native dialog, no `role=dialog`) | draft there (16) | draft there (16) |
| Project chat → header link to the project page | none | draft there (16) | draft there (16) |
| Project chat → Ctrl+Shift+O | none | draft there (16) | draft there (16) |

ChatGPT keeps a per-chat draft across client-side navigation and full loads. The `math12` chat's
draft from before this run also survived every load. The test drafts were deleted afterwards
(`cleared: true`).

```
REPORT draft {"name":"normalChat: new chat with draft","from":"/c/<id>",…"nativeDialogs":[],"reloaded":false,…"url":"/",…"dialogs":[],…}
REPORT draft {"name":"normalChat: back","from":"/",…"url":"/c/<id>",…"composer":{ph:null,len:16,place:"thread",…}…}
REPORT draft {"name":"normalChat","afterReopen":{…"textLen":16,…}}
REPORT draft {"name":"projectChat: back","from":"/g/g-p-<id>/project",…"url":"/g/g-p-<id>-<slug>/c/<id>",…"composer":{ph:null,len:16,…}…}
REPORT draft {"name":"projectChat-ctrlShiftO: back","from":"/",…"composer":{ph:null,len:16,…}…}
```

## Q6. Alt+Shift+O with no extension

The press reaches the page in both cases (trusted keydown seen by a capture listener on `window`).

| Focus | Normal chat | Project chat |
|---|---|---|
| Composer focused | no navigation, no menu, focus stays, no text inserted, `defaultPrevented: false` | same |
| Page body focused | no navigation; ChatGPT **prevents the keydown, focuses the composer and inserts the character "O"** (draft 0 → 1) | same (draft 38 → 39) |

ChatGPT's type-to-focus handler sends any printable key pressed outside a field to the composer, and
it treats Alt+Shift+O as printable. A Butter handler on Alt+Shift+O must stop the event before
ChatGPT's handler, or the new chat will start with a stray "O" in the old chat's draft. The 2
inserted characters were removed in runs 5–6, and both drafts are back to their earlier length
(0 and 38).

```
REPORT alt {"name":"Alt+Shift+O in normalChat (composer focused)",…"keysSeen":[{"t":"keydown","key":"O","code":"KeyO","ctrl":false,"alt":true,"shift":true,"meta":false,"trusted":true,"defaultPrevented":false},…],"url":"/c/<id>",…"composer":{ph:"Ask ChatGPT",len:0,…}…}
REPORT alt {"name":"Alt+Shift+O in normalChat (body focused)",…"keysSeen":[{"t":"keydown","key":"O",…"alt":true,"shift":true,…"defaultPrevented":true},…],"url":"/c/<id>",…"composer":{ph:null,len:1,…,focus:true}…}
REPORT alt {"name":"Alt+Shift+O in projectChat (body focused)",…"defaultPrevented":true…,"url":"/g/g-p-<id>-<slug>/c/<id>",…"composer":{ph:null,len:39,…}…}
REPORT undo-alt {"name":"normalChat","before":{"len":1,"last":"O"},"done":true,"after":0}
REPORT undo-alt {"name":"projectChat","before":{"len":39,"last":"other","count":1},"done":true,"after":38}
```

## Q7. Work mode

Not entered. On this account the home page shows a `button` with the text "Work" (no aria-label).
The sidebar options menu has a "Show" filter with `menuitemradio` items `All` and `Work`. Neither
was clicked: it may change account-level sidebar state, and the run was at its time budget. So
Ctrl+Shift+O in Work mode was **not tested**.

```
REPORT work {"controls":[…,{"tag":"button","role":"menuitemradio",…"text":"Work"},{"tag":"button","role":null,"aria":null,…"text":"Work"}],"composer":{ph:"Ask ChatGPT",len:0,place:"home",aria:"Ask ChatGPT",focus:true}}
```

## Side effects and restore

- Run 2 clicked the project's sidebar row, which collapsed it (sidebar project chats 6 → 1).
  Run 4 expanded it again (`restoreRow: was false, now true, sidebarProjectChats 6`).
- Alt+Shift+O inserted characters into 2 drafts; both were removed (Q6).
- `lab-restore --lab 2`: `ok: true`, home URL, empty composer, no extensions; lock released.

## Method caveats

- Key events are CDP-dispatched, not hardware.
- The sidebar "New chat" buttons were activated with `element.click()`, not a pointer.
- Run 1's composer selector was stale and its REPORT masking was incomplete. Its answers are
  superseded by runs 2–3, and its raw log stays local.
