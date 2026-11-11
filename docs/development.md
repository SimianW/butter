# Development

| Path | What |
|---|---|
| `extension/` | The extension. |
| `extension/popup/popup.html`, `extension/popup/popup.css`, `extension/popup/popup.js` | Single-page 360 px popup, bundled fonts, inline SVGs and translations. |
| `extension/shared/status.js` | Pure settings migration, four-group mapping, probes and session-failure merging. |
| `extension/shared/settings.js` | Storage, live off markers and on-request page probes. |
| `extension/branch/logic.js` | Ask in branch, pure: message format, conversation identity, selection rule, one-time handoff jobs. |
| `extension/branch/run.js` | Ask in branch run in the new tab: state machine over an injected page adapter. |
| `extension/branch/page.js` | ChatGPT DOM for Ask in branch: native button, latest reply menu, composer; the real page adapter. |
| `extension/branch/ui.js`, `extension/branch/content.js` | Shadow-root UI (question box, overlay, line) and the glue for both tabs; the original tab's Ask in branch cell in the selection pill. |
| `extension/selection/pill.js` | The selection pill (`ButterPill`, #77): follows ChatGPT's "Ask ChatGPT" every frame (4 px right of it, flipped left without room, hidden with it and in Work mode, its resting look copied) and draws the registered cells in one pill, Ask in branch then Bookmark, with each cell's label 8 px below after 300 ms of hover. `register({ id, feature, icon, label, keys, shortcut, wants, activate, reset })`, `update()`, `hold(range, { place, lost })` (Ask in branch's question box anchors where ChatGPT's button last was), `release()`, `hide()`. Loads before both features' scripts. |
| `extension/branch/worker.js` | Loaded by the service worker: handoff jobs in `chrome.storage.session`. |
| `extension/bookmarks/model.js` | Bookmarks, pure: the excerpt rule, identity (`key`), the stored allowlist (`clean`), grouping by question in answer order (and the earlier, unloaded history's group `EARLIER`), a selection's anchor (`anchor`), the shortcut's top paragraph (`topParagraph`), the tooltip's key hint (`keyHint`), resolution to live or stale (`resolve`, `matches`, `pale`), the rail's bookmark dot (`dotSize` from the pitch, `dotRight` from the tick's scale, `dotLook`: solid, hollow or faint), what the rail's hover card lists (`card`), what a tick's card holds when its question has bookmarks (`questionCard`), the bookmarks' accessible label (`label`), a tick's accessible name (`tickLabel`), the excerpt's first-line length (`firstLine`) and the Bookmark cell's `aria-keyshortcuts` (`ariaKeys`). |
| `extension/bookmarks/wash.js` | The landing wash, pure (`ButterWash`): one box per rendered line from a range's rectangles (`boxes`), a code block's or a table's one box (`blockBox`), and the sweep or a block's fade-in, the hold and the fade (`plan`). |
| `extension/bookmarks/client.js` | The store client shared by `content.js` and `notice.js` (`ButterBookmarkStore.send`): one version-1 runtime message, retried up to three times on `bookmark-storage` or a closed port. |
| `extension/bookmarks/content.js` | Bookmarks on the page: the Bookmark cell of the selection pill, the shortcut, the marks handed to the rail (`ButterRail.setMarks`), the landing wash in its own layer, and the notification on every save and remove. An answer's paragraphs are its top-level blocks, each item of a top-level list on its own. |
| `extension/bookmarks/worker.js` | Loaded by the service worker: the `bookmarks` object store and its runtime messages, and the `bookmark` command relayed to its tab. |
| `extension/bookmarks/notice.js` | The bookmark notification (#77), top right: "Bookmark saved", "Bookmark removed" or "Already bookmarked", the first words and Undo (Undo of a save deletes it, of a remove stores it again); 4 s, held by the pointer or focus; the first save ever expands it with the privacy text and Got it, which sets `bookmarkNotice: 'acknowledged'` in settings. |
| `extension/consent/card.js` | `ButterCard`, the shell the layout consent card and the bookmark notification share: look, font, themes and motion; bottom-right cards stack, the `top` card (the notification) sits top right outside that stack. |
| `extension/dev/` | Dev build only, left out of the store and `--test` zips: `recorder.js` (pure bug-capture recorder and privacy filter), `sources.js` (the snapshot's `turns` and `usage`, read from the page with injected page objects), `recorder-main.js` (MAIN world, listens to the seek and layout-cache hooks), `content.js` (relays a snapshot request), `toast.js` (isolated world: the on-page "Bug N saved" toast the worker asks for once a file is written), `worker.js` (service worker: loads the store worker, handles the save-bug shortcut, the popup's save and New round, and the download), `popup.js` and `popup.css` (the popup's DEV tag and dev card, rendered through `popup.js`'s passive dev slot). |
| `docs/` | User docs, test report, media. |
| `results/` | Earlier published result tables, made by `lab/summarize.py`. |
| `lab/` | Test lab: browser launcher, replay benchmark and other harness scripts, ablation variants. |
| `notes/review.md` | Historical risk review of the early extension code. |
| `notes/runs/` | Curated lab reports and numeric results; private captures excluded. |
| `report/report.html` | One-page visual summary. |
| `scripts/package.py` | Builds `dist/butter-<version>.zip`; `--test <tag>` and `--dev` build numbered test zips. |
| `CHANGELOG.md` | Versions. |

The MAIN-world scripts retain their dependency order. `seek/layout-codec.js` supplies the geometry wire format before the single
`seek/layout-cache-main.js`; all consumers still run after it.
`seek/anchor-main.js` supplies semantic landing anchors as well as swap diagnostics.

## Tests

- Unit tests: `node --test` (runs `*.test.js` and `*.test.mjs`; run `npm ci` first for `test/max-lines-caps.test.mjs`).
- Popup in the lab browser: `node lab/harness/popup-qa.mjs` uses an isolated headless Chromium to capture all 22 states in both themes at 360 px under `/tmp/butter-popup-build/` (set `BUTTER_MOCKUP` to also capture approved references, and `BUTTER_CASES=13,16` to run only those states).
  `BUTTER_REDESIGN_MOCKUP=<path>` compares the built states with the #35 redesign mockup
  (`gh issue artifact download 35 1 -R SimianW/butter`), and `BUTTER_REDESIGN_SIDE=before|after`
  (default `after`) picks its panels: default, paused, rail fault, layouts pending, clear confirm,
  branch off, branch fault, dark and Chinese, where that side has them. Each panel must match its
  state's height and differ in under 0.1% of pixels (by more than 24 in a channel), with the
  version label and the storage line masked; the run prints every panel's height and diff ratio,
  then fails with a summary if any differ.
  The same run then builds the dev zip (`BUTTER_DEV_ZIP` names an existing one; `BUTTER_DEV=0` skips
  it), loads it unpacked in its own profile with the save-bug binding seeded, and captures the dev
  states (recording, just saved, not on a ChatGPT tab, the tallest state, Chinese recording and
  tallest) in both themes, each at most 600 px with the dev row unclipped. It also drives the card:
  New round survives a reload, Open round folder, and the save button through the real worker.
  `BUTTER_DEV_MOCKUP=<path>` (`gh issue artifact download 32 1 -R SimianW/butter`) compares the
  English and dark dev states with that mockup's `dev-*-after` panels the same way.
  `popup-probes.mjs` checks status failures with a fixture, and `popup-live.mjs` checks live switches
  in an existing chat. The probe/live scripts need `extension/` loaded in the shared lab browser first (see `lab/README.md`); acquire its lock before using them. The QA script starts its own browser.
- Consent card in the lab browser: `BUTTER_CONSENT_MOCKUP=<approved #35 mockup> node lab/harness/consent-qa.mjs` loads the real extension in its own headless Chromium over a synthetic page (no ChatGPT requests), compares the pending card in light/English and dark/Chinese with the mockup's consent panels, and checks the dark shadow, the secondary hover and the focus ring; screenshots go to `/tmp/butter-consent-qa/` (`SHOTS=` overrides).
- Ask in branch: `test/branch-logic.test.js`, `test/branch-rules.test.js` (hidden-button rules,
  Work-mode detection, menu matching), `test/branch-run.test.js` (state machine with a fake
  page and virtual clock) and `test/branch-worker.test.mjs` run under `node --test`.
  `node lab/harness/branch-qa.mjs` loads the real extension in its own headless Chromium over the
  synthetic page in `branch-fixture.mjs` (no ChatGPT requests; `lang=zh`, `stream=<ms>`, `work`,
  `side`, `nobranch`, `nodisclaimer` and `temporary-chat=true` select ChatGPT variants). Since #77
  it drives Ask in branch's icon cell in the selection pill: 4 px right of the native button, its
  look copied, named and labelled "Ask in branch", opening the question box under it by pointer and
  by keyboard. It writes the mockup-state screenshots to
  `notes/runs/2026-11-07-ask-in-branch-29/screenshots/` (`SHOTS=` overrides; set it to keep that
  run's committed screenshots).
  `branch-live.mjs` is the live check: hold the lab lock, restart the lab browser with a
  snap-readable copy of `extension/`, then run it with `LAB_ID`, `LAB_OWNER` and
  `BRANCH_PATH='^/backend-api/conversation/new_branch$'` (the only request let past the send guard).
  `branch-live-edges.mjs` (same setup, `LANG_TAG=zh` with ChatGPT in Chinese) checks the streaming
  wait and the hidden-button cases on the live page; see its header for how the stream is held.
- Dev build bug capture: `test/dev-recorder.test.js` and `test/dev-sources.test.js` (`node --test`)
  cover the recorder and the `turns`/`usage` sources against planted page state, and
  `test/dev-toast.test.js` the toast (text in both languages, no pointer events, focus, 2 s, replace).
  The bug-file format is in [notes/diagnostics/README.md](../notes/diagnostics/README.md#bug-files-from-the-dev-build).
  `xvfb-run -a node lab/harness/dev-capture-qa.mjs` builds the dev zip, loads it in its own
  Chromium on a virtual display over a long synthetic chat (`dev-capture-fixture.mjs`, no ChatGPT
  requests), presses the real shortcut through XTest (`xtest-keys.py`; keys sent over the
  DevTools protocol never reach `chrome.commands`) and checks the files written to a temporary
  Downloads folder. It measures the event rate and size, the snapshot's cost, seek behaviour with
  and without the recorder, and `data:` URL downloads. It also checks that every save shows the
  toast while a held drag continues, and shoots the toast on a light and a dark page; with
  `BUTTER_DEV_MOCKUP=<#32 mockup>` (`gh issue artifact download 32 1 -R SimianW/butter`) it
  compares them with the mockup's `toast-light` and `toast-dark` panels (same size, under 0.1% of
  pixels differing). The saved files, screenshots and `summary.json` go to
  `notes/runs/2026-11-08-full-snapshot-44/` (`OUT=` overrides).
- Bookmarks: `test/bookmark-model.test.js` (excerpt, identity, allowlist, grouping, earlier history, the
  rail dot's diameter from the pitch and its 4 px gap at 12, 21 and 31 px ticks),
  `test/bookmark-wash.test.js` (the landing wash's plan: lines filled in reading order in 360 ms, each
  line's share of the progress by its width, the hold and fade, reduced motion, one box per line; a
  code block's or a table's one box 3 px beyond it with its corners and its border left clear, faded
  in over 160 ms, at once under reduced motion),
  `test/bookmark-anchor.test.js` (a selection's anchor within one paragraph, across paragraphs and in
  CJK text, the viewport-top rule, the key hint and its `aria-keyshortcuts` form), `test/bookmark-card.test.js` (the hover card's meta
  line, rows, five-row limit and names; a tick's card for several bookmarks, one, a stale one and more
  than five, its group name and the tick's name, in English and Chinese), `test/bookmark-stale.test.js` (live and stale resolution: a
  regenerated answer, an edited one, a vanished message, a version switched back; the dot solid,
  hollow when all are stale, or faint under 4 px; the stale card in both languages), `test/bookmark-store.test.js` (the worker store, the command
  relay and the key query), `test/bookmark-notice.test.js` (the notification: the saved, removed and
  already-bookmarked cards in English and Chinese, the expanded first-bookmark card until Got it,
  Undo of a save and of a remove through the real worker store, replacement and a stale Undo, the
  4 s lifetime held by the pointer or focus under fake timers, hiding when Butter or the rail goes
  off, its top-right place, independence from the layout switch and consent) and
  `test/selection-pill.test.js` (the selection pill: the cells shown for each switch combination,
  Work mode and no "Ask ChatGPT", their order and place, names and `aria-keyshortcuts`, activation on
  a primary pointerdown or a keyboard click, the label's 300 ms and switching, a held selection's
  anchor, and its host inside `<body>`) run under `node --test`, and
  `test/rail.test.mjs` checks that each dot keeps its 4 px gap through every frame of the hover wave
  and stays inside the rail, shrinks and turns faint for close ticks, fades out when its last
  bookmark goes, and that the arrow stops are the ticks only; and, for earlier history (#72), the
  solid 4 px dot 4 px left of the three dots on their row, the three dots' name, their card on hover
  and focus (their hint card without bookmarks), and ArrowLeft into it with ArrowRight and Escape
  back. `test/bookmark-card.test.js` also covers the earlier card for one and several bookmarks and
  the three dots' name, in English and Chinese.
  The fixture QA, `lab/harness/bookmarks-qa.mjs`, loads the real extension in its own Chromium over
  a synthetic chat (every chatgpt.com request answered locally, with stand-ins for ChatGPT's "Ask
  ChatGPT" and "More actions"; no ChatGPT requests). Run `npm ci`, then
  `xvfb-run -a -s '-screen 0 1600x1000x24' node lab/harness/bookmarks-qa.mjs`. Under an X display
  it runs headed and presses the real shortcut through XTest (`xtest-keys.py`; `chrome.commands`
  ignores DevTools key events); without one it runs headless and asks the worker to relay the
  command instead, which skips Chrome's key handling.
  Its scenarios live in `lab/harness/bookmarks/scenarios/`, listed in run order in
  `bookmarks/scenarios.mjs`. Each declares its start (fixture scene, settings, store rows) and the
  harness builds it on a fresh page, so a scenario alone runs as it does in a full run. Each
  scenario's description, which `--list` prints, and the header of its file are the reference for
  what it checks.
  - `--list` prints every scenario's name and description; `ONLY=<name>[,<name>…]` runs only those
    (an unknown name exits 2).
  - `MARKUP=old` or `MARKUP=live` runs one answer markup; by default the run covers both, each in its
    own browser: the earlier `[data-message-author-role="assistant"][data-message-id]` wrapper, and
    live chats' answers, whose ancestor carries `data-chatgpt-selection-message-id` instead.
  - The run prints only failing checks and one line per scenario; `VERBOSE=1` prints every check.
  - `SHOTS=<dir>` sets where screenshots and `summary.json` (every result) go, one subdirectory per
    markup; the default is `/tmp/butter-bookmarks-qa/`.
  - Mockups, when given: `BUTTER_BOOKMARKS_DOT_MOCKUP=<#69 mockup>` (`gh issue artifact download 69 1
    -R SimianW/butter`) compares the tick's card, the rail and its strips, and the held wash with
    the mockup's panels (`card`, `dot*`, `wash-mockup`, which is skipped without it);
    `BUTTER_BOOKMARKS_EARLIER_MOCKUP=<#51 Earlier history mockup>` (`gh issue artifact download 51 2
    -R SimianW/butter`) shoots its panels next to `earlier-shots`' states; and
    `BUTTER_BOOKMARKS_MOCKUP=<#51 mockup>` (`gh issue artifact download 51 1 -R SimianW/butter`)
    shoots its stale cards next to `stale`'s.

  The live check, `lab/harness/bookmarks-live.mjs` with `MODE=wash` (the lab lock, the send guard
  and a fresh unpacked install, as its header says; `LAB_FIXTURE=demo-en12`, the fixture whose
  answers hold long paragraphs and tables): on real ChatGPT markup in light and dark theme (the dark
  pass switches ChatGPT's `<html data-theme>` on the page), it bookmarks a paragraph, a selection and
  a table with the selection pill's Bookmark cell (the paragraph and the table selected whole),
  jumps to each from its tick's card, and checks that the wash's boxes
  sit on the bookmarked lines (the table's box 3 px around it), that the text keeps its colour under
  it, that there is no bubble flash, and that when the chat scrolls during the hold the boxes follow
  their text while the header and composer show no butter and the wash reaches their edges. Only
  numbers and booleans go to `summary.json`; the report goes to `notes/runs/` (the first one is
  `notes/runs/2026-11-10-bookmarks-wash-live/`). No fixture answer holds a code block yet, so code
  blocks are checked in the fixture only.
- Version consistency: `python3 scripts/check-version.py`; packaging tests: `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- Review tier: `python3 scripts/review-tier.py [base]` (default `origin/main`) prints the tier from the changed files; its tests run with `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- PR body: `PR_BODY="$(cat body.md)" python3 scripts/check-pr-body.py [base]` runs CI's `pr-body` check locally: the tier line, the review line, and no tier 1 or 2 change after the reviewed commit.
- History rail in the lab browser: `lab/harness/nav-jumps.mjs`, `nav-stream.mjs`,
  `nav-switch.mjs`, `nav-video.mjs`; `nav-earlier.mjs` (fixture for far-jump landing and the "earlier" dots, no ChatGPT requests), `nav-earlier-live.mjs` and `nav-settle.mjs` (same checks in an open ChatGPT tab).
  Far-jump timing: `jump-latency.mjs` (phase timings on a long chat), `jump-latency-edge.mjs`,
  `jump-latency-summary.mjs`; takeover deadline fixture: `nav-takeovers.mjs`.

## Formatting

Run `npm ci` to install the pinned development tools (Prettier, ESLint, and Playwright for
`lab/harness/`), then `npm run format` to format
`extension/**/*.{js,css,html,json}` and `test/**`. Use `npm run format:check` to check them.
`npm run lint` checks `extension/` and `test/` for undefined and unused names, and those plus `lab/harness/` for file length: at most 500 lines (blank lines and comments count), except the files capped at their current length in `eslint.config.mjs`, which may only shrink (ESLint; config in `eslint.config.mjs`).
`node --test` uses only Node built-ins, except `test/max-lines-caps.test.mjs`, which imports the ESLint config and so needs `npm ci`; it fails when a capped file has shrunk below its cap or to 500 lines or fewer, so the cap is lowered or dropped.

## Release

`python3 scripts/package.py` builds the zip. Version rules are in [AGENTS.md](../AGENTS.md).
For testing, `python3 scripts/package.py --test <tag>` builds `dist/butter-<version_name>+<tag>.<N>.zip` without changing the source manifest or consuming an alpha number (tag: `[a-z0-9-]+`; numbering starts at 1 per base version and tag).
Test zips retain the base Chrome numeric version; remove the previous install before loading one unpacked.
`python3 scripts/package.py --dev` builds the dev build, `dist/butter-<version_name>+dev.<N>.zip`: a test build
that also contains `extension/dev/`, whose popup.html loads the popup's dev card, and whose manifest adds the dev scripts, the `save-bug` command (suggested
key Alt+Shift+B, Option+Shift+B on a Mac) and the `downloads` permission. The shortcut saves a privacy-safe
snapshot of the last 30 s on a ChatGPT chat to `Downloads/butter-diag/round-<N>/bug-<NN>_<HH-MM-SS>.json`.
On Windows and Linux, Alt+Shift+B is Chrome's own "focus bookmarks bar" key, so Chrome does not assign it
automatically; set it in `chrome://extensions/shortcuts`. Until then the popup's save button shows only its
camera icon. Only `--dev` zips carry the dev files.

The dev card keeps the round in `chrome.storage.local.butterDev` (`round`, `bugs`, and after a save the
`file` name and its `download` id). Its save button and New round go to the dev worker as
`butter-dev-save` (with the active `tabId`) and `butter-dev-new-round` runtime messages, which only the
extension's own pages may send; the worker serializes them with the shortcut's saves. Open round folder
shows the round's last saved file through the downloads API; before the round's first save, when the
round folder does not exist yet, it opens the Downloads folder.

## Layout storage API

From an extension context (including the popup), use:

```js
await chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-usage' });
// { conversations, bytes } across ALL accounts; expired records are pruned.
const clearRequest = { version: 1, type: 'butter-layout-clear', requestId: crypto.randomUUID() };
await chrome.runtime.sendMessage(clearRequest);
// { conversations: 0, bytes: 0 }; settings remain, delayed writes are fenced.
```

`conversations` counts distinct account/conversation pairs, not layouts or turns. `bytes` is the
UTF-8 serialized size of the stored rows including metadata, excluding IndexedDB/index overhead.
Failures return `{ error: 'layout-storage' }`; unsupported protocol versions return
`{ error: 'layout-protocol' }`. Retry a closed port/storage error up to three times with the same
request (including the same clear `requestId`), then show an unavailable state. These are
runtime messages, never page events. The service worker also handles version-1 internal `butter-layout-load`
(account + conversation SHA-256 hashes) and `butter-layout-put` (same hashes, compact records and the
load's generation). Unknown identities are rejected. An external extension cannot call the API.

Protocol v1:

| Request `type` | Additional fields | Successful response |
|---|---|---|
| `butter-layout-usage` | None | `{ conversations, bytes }` |
| `butter-layout-clear` | `requestId`: random UUID, reused on retry | `{ conversations: 0, bytes: 0 }` for that operation |
| `butter-layout-load` | `account`, `conv`: SHA-256 hashes | `{ generation, records }` for that partition |
| `butter-layout-put` | Same hashes, `generation` from load, compact `records` | `{ conversations, bytes }`; `{}` when an old generation is fenced |

All requests include `version: 1`. Unknown identities or layout-off produce no geometry reads or
writes. Clear ids are durably deduplicated for the latest 64 clear operations. Retrying clear gets
its original result; query usage again if subsequent measurements may already have saved data.

`layoutConsent` starts as `pending`, and `ButterStatus.normalize` keeps `opts.layout` false
unless consent is `granted` and the saved layout option is not false. Persisted reads/writes
require both. The in-page card asks first; the popup switch also records consent. While pending,
usage reports zero and no layout data is saved. Setting layout false deletes layouts for all
accounts and stops reads/writes; it is independent of the master optimization switch.
The popup shows usage below Remember long-chat layouts and confirms Clear inline.
Clear preserves settings, the migration marker and bounded non-content control metadata
(generation and the latest 64 clear-operation ids). Clear retires disk-backed memory in open tabs; newly measured geometry can
save again while the setting is on. Set the option false for a persistent opt-out.

## Bookmarks store API

Version-1 runtime messages from content scripts to the service worker (`bookmarks/worker.js`),
on the layout store's queue. Ids are SHA-256 hex, as layouts hash them; a bookmark is
`{ account, conv, msg, ask, turn, para, start, end, excerpt, line, time }` (`ask` and `line` are
missing from bookmarks saved before they were added; see
[layout-storage-data.md](layout-storage-data.md#object-store-bookmarks-database-version-2)), and
stored ones also carry their `key`.

| Request `type` | Fields | Response |
|---|---|---|
| `butter-bookmark-list` | `account`, `conv` | `{ bookmarks }` for that conversation |
| `butter-bookmark-create` | `bookmark` | `{ bookmark, created }`; the same paragraph and range returns the existing one with `created: false` |
| `butter-bookmark-delete` | `account`, `conv`, `key` | `{ deleted }` |
| `butter-bookmark-key` | None (version 1 like the others) | `{ shortcut }`: the key Chrome reports for the `bookmark` command, `''` when it has none |

Unknown or raw account/conversation ids get `{ error: 'bookmark-identity' }`, a malformed bookmark or
another protocol version `{ error: 'bookmark-protocol' }`, a storage failure
`{ error: 'bookmark-storage' }` (retry the same request up to three times). None of these depend on
the layout setting, `layoutConsent` or layout Clear.

The `bookmark` command (manifest `commands`, suggested key Alt+Shift+M, Option+Shift+M on a Mac,
rebindable in `chrome://extensions/shortcuts`) makes the worker send `{ version: 1, type:
'butter-bookmark-shortcut' }` to the tab it was pressed in. The content script bookmarks the selection
inside one answer (anchored to its first paragraph), or with nothing selected the first answer
paragraph whose top is at or below ChatGPT's 52 px header; a selection outside the answers creates
nothing. Alt+Shift+M is in neither Chrome's accelerator table (Windows, Linux; on a Mac Chrome binds
no Option+Shift letter) nor ChatGPT's documented shortcuts, and is not the dev build's Alt+Shift+B,
which Chrome reserves on Windows and Linux for its bookmarks bar. `--dev` zips keep the `bookmark`
command beside `save-bug`.

On the page, `bookmarks/content.js` reads a conversation's bookmarks once when the rail first shows
it, and the rail calls `ButterBookmarkPage.sync(conv, items, complete)` whenever it renders
(`complete`: no earlier page is left to load). The content script answers with
`ButterRail.setMarks(conv, marks, items)` (`items`: the list it worked from): a `Map` from question id
(or `ButterBookmarks.EARLIER`, -1, for the bookmarks in earlier history that isn't loaded) to
`{ count, fresh, bookmarks, stale, land, wash, remove }`, where `fresh` grows the dot in, `bookmarks` are the question's bookmarks in answer order, each with its `stale` flag,
`stale` is set when all of them are stale (the dot is hollow), `land(turnElement, bookmark = bookmarks[0])` returns that
bookmark's offset below the turn's top for the rail's jump (or null to land on the question, as a
stale bookmark does), `wash(turnElement, bookmark)` washes that bookmark's text once a trip from a
card row has landed on it (false when it is stale; the rail then flashes the bubble instead), and
`remove(bookmark)` deletes it from the store and sends the marks again. The rail calls
`ButterBookmarkPage.unwash()` as any jump starts.

Staleness (`ButterBookmarks.resolve`) is computed on the page and never stored. A bookmark is live
when its answer is rendered, its paragraph exists and that paragraph still contains the excerpt's
first rendered line (its first `line` characters; its first 40 for a bookmark saved without `line`).
It is stale when the paragraph or its text changed (an edited answer), when its question's turn is
mounted with another answer (regenerated, or another version shown), or when its message is no
longer in a fully loaded conversation or in its loaded question (`ask`), where it stays under that
question; only a bookmark whose question isn't loaded (or, without `ask`, whose message isn't
listed or rendered) waits on the earlier-history dots while earlier history is unloaded. A turn that isn't
mounted keeps the state last seen in the tab. The content script resolves on every rail render, about
0.6 s and 2.5 s after a click on the page (regenerate, edit and the version arrows are clicks), and
when the pointer or focus reaches the rail; never while a scrollbar drag is seeking. The card shows a
stale row grey with "answer changed", and a single stale bookmark with "Bookmark · answer changed",
grey text and a footer saying a click opens its question instead.

Earlier history (#51 addendum). After a reload ChatGPT lists only a long chat's latest questions.
While earlier history isn't loaded, `ButterBookmarks.group` puts a bookmark whose message is neither
listed nor rendered in the `EARLIER` group: the rail draws one dot for it beside the three
"earlier" dots (#72), never stale, and the three dots show its card, "Bookmark · earlier question"
(one, with a footer) or "Earlier questions · k bookmarks" (oldest first). A click on the three dots
still loads earlier messages. A click on a row runs the rail's earlier trip with that bookmark's
key: pages load only until `setMarks` places
the key under a question, then the trip lands on its text as a bookmark jump does (at the
question's start when it turned stale: its message isn't in the now complete conversation). Meanwhile
the dots blink, the card's meta line reads "Loading earlier questions…" and that row's × is a spinner;
Escape or leaving puts the card away without stopping the trip; a keyboard trip ends with focus on
the question's tick. A bookmark leaving the three dots grows in as a dot beside its tick; the dot
beside the three dots fades out when none are left (at once under reduced motion, or when the three
dots go).

The rail draws a question's dot (#71) in its shadow root as an `aria-hidden` `<i class="bdot">`
with no pointer events: `ButterBookmarks.dotSize(pitch)` across, `dotLook(bookmarks, size)` for
solid, hollow (`.stale`, a 1 px inset ring) or faint (`.faint`, 45 %), and placed with `translate`
by `placeDots()`, which `step()` calls on every frame of the hover wave after setting the ticks'
scales, at `dotRight(scale)` (12 px times the tick's scale plus 4) left of the ticks' right end and
centred on the tick's row. Earlier history's dot is always 4 px and solid, centred on the three
dots' row at `dotBeside(17)` (the three dots span 17 px from the ticks' right end, plus 4) left of
the ticks' right end. `.bdot.new` runs `dot-in` (scale 0 to 1, 180 ms) and one `dot-halo`
(600 ms); `.bdot.gone` fades over 160 ms; reduced motion turns both off.

The rail draws the three dots' card from `ButterBookmarks.card(bookmarks, { earlier: true }, zh)`
(`{ single, meta, rows, visible, label, stale, warn, tag, wait }`): the meta line (`wait` while
earlier messages load for one of its rows), then the same rows as a tick's card, without the
question and its divider. The three dots' name is `ButterBookmarks.moreLabel(hint, bookmarks, zh)`.
A tick whose question holds bookmarks (#70) shows the question's own card with them under the
question, from `ButterBookmarks.questionCard(question, bookmarks, at, zh)` (`{ text, single, rows,
visible, stale, warn, tag, group }`): the question card's meta line and text (`text`, cut at 400
characters, clamped to two lines), then a row per bookmark with a 5 px dot (`--dot`), its stale tag in
a list, or one row of up to three lines with the stale footer (`warn`). The card is 280 px wide, a
`group` named `group`, and takes the pointer and focus. Both cards stay open while the pointer crosses
the gap onto them and while it heads left within the card's height across other ticks. Its top is put on a whole pixel. The tick's name
is `ButterBookmarks.tickLabel(question, bookmarks, zh)`. ArrowLeft on the tick enters the card;
ArrowRight or Escape and a keyboard jump return focus to the tick; when its last bookmark is deleted
the card closes and focus, if it was in the card, goes back to the tick.
Keyboard: the arrow keys walk the earlier-history dots and the ticks, one stop per question;
ArrowLeft on a tick or the three dots enters its card, arrows move between rows, Enter jumps, Tab
reaches a row's ×, Delete removes the row, and ArrowRight or Escape returns to the tick or the three
dots. A dot whose last bookmark is deleted fades out over 160 ms (at once under reduced motion). × on
a row is the only way to remove a bookmark.

Every save and every remove shows the notification (`bookmarks/notice.js`, #77), whatever the layout
switch and `layoutConsent` say: `bookmarks/content.js`'s `create` is the only save path (the
Bookmark cell and the shortcut) and its `remove` the rail's ×. "Bookmark saved" (create answered
`created: true`) and "Bookmark removed" carry Undo: a save's Undo sends `butter-bookmark-delete` and
drops the bookmark from the page's list; a remove's Undo sends the stored bookmark back to
`butter-bookmark-create`, whose key comes from its anchor fields, so the same bookmark returns with
its original time and dot. "Already bookmarked" (`created: false`) has none. While `bookmarkNotice`
isn't `'acknowledged'` a save shows the expanded card with the privacy text and Got it, which
writes `bookmarkNotice: 'acknowledged'` into the `butter` settings, once per browser profile; Undo
or a remove replacing it leaves it unacknowledged. The card shows only in the tab that acted, and
Butter paused or the rail off puts it away.

## Ask in branch handoff API

Runtime messages from content scripts to the service worker (`branch/worker.js`), serialized on one
queue. Rows live in `chrome.storage.session` under `butterBranch.<id>` as `{ at, tab, job }`.

| Request `type` | Fields | Response |
|---|---|---|
| `butter-branch-put` | `id` (UUID), `job: { original, title?, quote, question }` | `{ ok: true }`, or `{ error: 'invalid' }` when the sender's tab doesn't show `original` |
| `butter-branch-claim` | `id` | `{ job }` once; then `{ missing: true }`. `{ error: 'expired' }` after 60 s, `{ error: 'sender' }` from the original tab or another conversation (the row is deleted either way) |

The settings key is `opts.branch` (on unless `false`); there is no popup row or status group yet.

## Popup settings and status

The four switches map to `container + cv + throttle` (streaming), `older + seek` (scrolling),
`rail`, and `layout`. A switch is on only when all its keys are on; toggling writes every key
in that group. Normalization defaults the new `seek` key to true and preserves saved values
and unknown settings. All settings continue to apply live.

The master status says working when the active tab's content script answers, open a chat when
no receiver answers, and paused when disabled. Feature probes have neutral internal evidence
until exercised; neutral evidence has no popup badge. Exercised failures are merged by the
worker into `chrome.storage.session.butterFailures`, keyed by group and failed feature. Switching
chats or disabling a setting preserves them; successful engagement of the failed feature removes
its record. Browser shutdown clears session records. The worker serializes probe merges so
concurrent tabs cannot overwrite each other's failures.

Send pre-jump is in `rail/rail.js` but its existing `beforeSend` handler does not test `railOff`;
it continues independently of the rail setting. Latest-question prediction belongs to the rail
presentation and is hidden with it. These behaviors are unchanged.

The popup uses the layout runtime API above, retries the same request three times, and retains
the same UUID when retrying clear. Clear confirms inline and shows completion for two seconds.
Usage uses decimal KB/MB and the 50,000,000-byte payload cap. Layout-off still deletes saved
layouts through the existing worker listener. See `design/icon/REGENERATING.md` for icon regeneration
and [`design/palette.md`](../design/palette.md) for the popup and consent card's colours, type
and contrast ratios.
