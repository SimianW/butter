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
| `extension/branch/ui.js`, `extension/branch/content.js` | Shadow-root UI (button, question box, overlay, line) and the glue for both tabs. |
| `extension/branch/worker.js` | Loaded by the service worker: handoff jobs in `chrome.storage.session`. |
| `extension/bookmarks/model.js` | Bookmarks, pure: the excerpt rule, identity (`key`), the stored allowlist (`clean`), grouping by question in answer order, a selection's anchor (`anchor`), the shortcut's top paragraph (`topParagraph`), the tooltip's key hint (`keyHint`), resolution to live or stale (`resolve`, `matches`, `pale`), the rail segment's offset, what the rail's hover card lists (`card`) and the segment's accessible name (`label`). |
| `extension/bookmarks/content.js` | Bookmarks on the page: the hover button (paragraph, selection or remove), the shortcut, the store client, and the marks handed to the rail (`ButterRail.setMarks`). |
| `extension/bookmarks/worker.js` | Loaded by the service worker: the `bookmarks` object store and its runtime messages, and the `bookmark` command relayed to its tab. |
| `extension/bookmarks/notice.js` | The first bookmark notice: shown after the first save, Undo deletes that bookmark, Got it sets `bookmarkNotice: 'acknowledged'` in settings. |
| `extension/consent/card.js` | `ButterCard`, the shell the layout consent card and the bookmark notice share: look, font, position, motion, and stacking when both show. |
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

- Unit tests: `node --test` (runs `*.test.js` and `*.test.mjs`; no npm install needed).
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
  `side`, `nobranch` and `temporary-chat=true` select ChatGPT variants) and writes the mockup-state
  screenshots to `notes/runs/2026-11-07-ask-in-branch-29/screenshots/` (`SHOTS=` overrides).
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
- Bookmarks: `test/bookmark-model.test.js` (excerpt, identity, allowlist, grouping, segment offset),
  `test/bookmark-anchor.test.js` (a selection's anchor within one paragraph, across paragraphs and in
  CJK text, the viewport-top rule, the key hint), `test/bookmark-card.test.js` (the hover card's meta
  line, rows, five-row limit and names), `test/bookmark-stale.test.js` (live and stale resolution: a
  regenerated answer, an edited one, a vanished message, a version switched back; the all-stale
  segment; the stale card in both languages), `test/bookmark-store.test.js` (the worker store, the command
  relay and the key query) and `test/bookmark-notice.test.js` (the first bookmark notice: copy, Undo,
  Got it, independence from the layout switch and consent) run under `node --test`.
  `xvfb-run -a -s '-screen 0 1600x1000x24' node lab/harness/bookmarks-qa.mjs` loads the real
  extension in its own Chromium over a
  synthetic chat (every chatgpt.com request answered locally, including `/backend-api/me` and the
  conversation's messages; no ChatGPT requests): hover button timing and placement, saving a
  paragraph, the segment under its question, landing on the paragraph from the segment, reload,
  the filled button on a bookmarked paragraph, one read per conversation and none while scrolling,
  dark theme, and the rail off or Butter paused. Then the hover card: the single and list cards,
  moving onto the card, a jump from a row, × and the filled button deleting (the segment fading out,
  or going at once under reduced motion), keyboard-only jump and delete, and a reload; it shoots
  `card-single-*` and `card-list-*` in light and dark for comparison with the #51 mockup's section 3.
  Stale bookmarks: it regenerates a bookmarked answer and edits a bookmarked paragraph in the page,
  then serves the regenerated answer as the conversation's version and reloads; it checks the grey
  "answer changed" row, the pale segment only when every bookmark under the question is stale, the
  stale single card and its footer, jumps landing at the question's start, a switched-back version
  turning live again, and the Chinese strings, and shoots `card-stale-*` and `card-list-stale-*`
  (with the mockup set, also its `mockup-card-stale-*` and `mockup-card-list-*` to look at side by side).
  It also bookmarks a selection with the button and with the shortcut (across paragraphs too), the
  top paragraph with the shortcut and nothing selected, and nothing for a selection in a question,
  each landing on its text, and checks that the tooltip shows the key Chrome reports and no hint once
  the key is cleared in `chrome://extensions/shortcuts`. Under an X display it runs headed and
  presses the real key through XTest (`xtest-keys.py`); without one it runs headless and asks the
  worker to relay the command instead, which skips Chrome's key handling.
  It then drives the first bookmark notice in light and dark, English and Chinese:
  Undo removes the segment and the next save shows it again, it stacks above a pending consent card,
  and after Got it a third save and a reload show none. `BUTTER_BOOKMARKS_MOCKUP=<#51 mockup>`
  (`gh issue artifact download 51 1 -R SimianW/butter`) compares the four notices with section 4 (same
  size, under 0.1% of pixels differing). Screenshots and `summary.json` go to
  `/tmp/butter-bookmarks-qa/` (`SHOTS=` overrides).
- Version consistency: `python3 scripts/check-version.py`; packaging tests: `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- Review tier: `python3 scripts/review-tier.py [base]` (default `origin/main`) prints the tier from the changed files; its tests run with `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- PR body: `PR_BODY="$(cat body.md)" python3 scripts/check-pr-body.py [base]` runs CI's `pr-body` check locally: the tier line, the review line, and no tier 1 or 2 change after the reviewed commit.
- History rail in the lab browser: `lab/harness/nav-jumps.mjs`, `nav-stream.mjs`,
  `nav-switch.mjs`, `nav-video.mjs`; `nav-earlier.mjs` (fixture for far-jump landing and the "earlier" dots, no ChatGPT requests), `nav-earlier-live.mjs` and `nav-settle.mjs` (same checks in an open ChatGPT tab).
  Far-jump timing: `jump-latency.mjs` (phase timings on a long chat), `jump-latency-edge.mjs`,
  `jump-latency-summary.mjs`; takeover deadline fixture: `nav-takeovers.mjs`.

## Formatting

Run `npm ci` to install the pinned development formatter, then `npm run format` to format
`extension/**/*.{js,css,html,json}` and `test/**`. Use `npm run format:check` to check them.
`npm run lint` checks `extension/` and `test/` for undefined and unused names (ESLint; config in `eslint.config.mjs`).
`node --test` uses only Node built-ins and still runs without installing npm dependencies.

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
`{ account, conv, msg, turn, para, start, end, excerpt, time }` (see
[layout-storage-data.md](layout-storage-data.md#object-store-bookmarks-database-version-2)), and
stored ones also carry their `key`.

| Request `type` | Fields | Response |
|---|---|---|
| `butter-bookmark-list` | `account`, `conv` | `{ bookmarks }` for that conversation |
| `butter-bookmark-create` | `bookmark` | `{ bookmark, created }`; the same paragraph and range returns the existing one with `created: false` |
| `butter-bookmark-delete` | `account`, `conv`, `key` | `{ deleted }` |
| `butter-bookmark-key` | None | `{ shortcut }`: the key Chrome reports for the `bookmark` command, `''` when it has none |

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
`ButterRail.setMarks(conv, marks)`: a `Map` from question id to
`{ count, fresh, bookmarks, stale, land, remove }`, where `fresh` grows the segment in, `bookmarks` are the
question's bookmarks in answer order, each with its `stale` flag, `stale` is set when all of them are
stale (the segment shows at 40 % opacity), `land(turnElement, bookmark = bookmarks[0])` returns that
bookmark's offset below the turn's top for the rail's jump (or null to land on the question, as a
stale bookmark does), and `remove(bookmark)` deletes it from the store and sends the marks again.

Staleness (`ButterBookmarks.resolve`) is computed on the page and never stored. A bookmark is live
when its answer is rendered, its paragraph exists and that paragraph still contains the excerpt's
first 40 characters (about its first line). It is stale when the paragraph or its text changed (an
edited answer), when its question's turn is mounted with another answer (regenerated, or another
version shown), or when its message is no longer in a fully loaded conversation; a turn that isn't
mounted keeps the state last seen in the tab. The content script resolves on every rail render, about
0.6 s and 2.5 s after a click on the page (regenerate, edit and the version arrows are clicks), and
when the pointer or focus reaches the rail; never while a scrollbar drag is seeking. The card shows a
stale row grey with "answer changed", and a single stale bookmark with "Bookmark · answer changed",
grey text and a footer saying a click opens its question instead.

The rail draws the hover card for a segment from `ButterBookmarks.card(bookmarks, at, zh)`
(`{ single, meta, rows, visible, label, stale, warn, tag }`); the card takes the pointer while it shows bookmarks.
Keyboard: the arrow keys walk the ticks and, after a question's tick, its segment; ArrowLeft enters
the card, arrows move between rows, Enter jumps, Tab reaches a row's ×, Delete removes the row, and
ArrowRight or Escape returns to the segment. A segment whose last bookmark is deleted fades out over
160 ms (at once under reduced motion). The hover button shows filled on a paragraph that holds
bookmarks; clicking it removes all of them.

The first saved bookmark shows a notice (`bookmarks/notice.js`), whatever the layout switch and
`layoutConsent` say. Undo sends `butter-bookmark-delete` for that bookmark and leaves the notice
unacknowledged; Got it writes `bookmarkNotice: 'acknowledged'` into the `butter` settings, once per
browser profile. `bookmarks/content.js`'s `create` is the only save path, so the button and the
shortcut both reach it.

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
