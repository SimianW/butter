# Development

| Path | What |
|---|---|
| `extension/` | The extension. |
| `extension/popup/popup.html`, `extension/popup/popup.css`, `extension/popup/popup.js` | Single-page 360 px popup, bundled fonts, inline SVGs and translations: the master card and one card of six rows. The two storage rows, Bookmarks and Remember long-chat layouts, show what their store holds and a Clear button on their second line, each with its own clear machine. |
| `extension/popup/model.js` | The popup's pure parts (`ButterPopup`): size and saved-line formatting (a non-zero size under 1 KB reads 1 KB), the confirm question, a storage row's second line in priority order (`storageLine`), the clear machine (`clearFlow`) and the retried store request (`storeRequest`). |
| `extension/shared/status.js` | Pure settings migration, four-group mapping, probes and session-failure merging. |
| `extension/shared/settings.js` | Storage, live off markers and on-request page probes. |
| `extension/branch/logic.js` | Ask in branch, pure: message format, conversation identity, selection rule, one-time handoff jobs. |
| `extension/branch/run.js` | Ask in branch run in the new tab: state machine over an injected page adapter. |
| `extension/page/reader.js` | The page reader (`ButterPageReader`), isolated world: how Butter reads ChatGPT's answer structure. Bookmarks' answer roots (`answersIn`, `answerOf`: the markdown root, or the Dil response root inside it, with its message id from `data-message-id` or `data-chatgpt-selection-message-id`), their paragraphs (`paragraphsOf`, `paragraphOf`, `paragraphsIn`), turns (`turns`, `turnByKey`, `turnKeyOf`), Ask in branch's replies (`replyOf`, `replies`) and loose turn (`looseTurnOf`), and ChatGPT's "Ask ChatGPT" selection button (`nativeAsk`, `nativeBusy`, `nativeStyle`, `visible`, `labels`). Loads before `selection/pill.js`. |
| `extension/page/reader-main.js` | The page reader's MAIN-world adapter (`__butterPageReader`) for seek: the same contract as `page/reader.js` for the facts seek reads, with its own copy of the answer-root rule and the message-id attributes (no code is shared across worlds). Seek's blocks (`blocksIn`: an answer root's children except wide blocks, table frames and `hr`), the preview's items (`previewItemsIn`: question bubbles and every answer-root child), the markdown columns (`firstColumn`, `columnsIn`, `hasAnswer`) and a turn's message id (`turnMessageId`). Each runs the same queries on the element it is given as seek ran inline (one; `turnMessageId` up to two); none reads layout. Loads before `seek/core-main.js`. |
| `extension/branch/page.js` | ChatGPT DOM for Ask in branch: latest reply menu, composer, disclaimer row, reply keys; the real page adapter. |
| `extension/branch/ui.js`, `extension/branch/content.js` | Shadow-root UI (question box, overlay, line) and the glue for both tabs; the original tab's Ask in branch cell in the selection pill. |
| `extension/selection/pill.js` | The selection pill (`ButterPill`, #77): follows ChatGPT's "Ask ChatGPT" every frame (4 px right of it, flipped left without room, hidden with it and in Work mode, its resting look copied) and draws the registered cells in one pill, Ask in branch then Bookmark, with each cell's label 8 px below after 300 ms of hover. `register({ id, feature, icon, label, keys, shortcut, wants, activate, reset })` (`feature`: the switch in `data-butter-off`, or a list that must all be on; the Bookmark cell's is `['rail', 'bookmark']`), `update()`, `hold(range, { place, lost })` (Ask in branch's question box anchors where ChatGPT's button last was), `release()`, `hide()`. Loads before both features' scripts. |
| `extension/branch/worker.js` | Loaded by the service worker: handoff jobs in `chrome.storage.session`. |
| `extension/rail/conversations.js` | The rail's conversations (`ButterRailConversations`), pure: each conversation's messages oldest first, pages merged (`page`), sends (`send`), the list policy against the mounted turns (`reconcile`), and the items revision every new list takes. Loads before `rail/model.js`. |
| `extension/rail/wave.js` | The hover wave's progress (`ButterRailWave`), pure: each tick's scale and opacity kept with its question, one frame's easing toward the model's targets (the interval clamped to 0–64 ms), and whether a frame is still due. Loads before `rail/model.js`. |
| `extension/rail/model.js` | The rail presentation model (`ButterRailModel`), no DOM, timers or frames: it holds the conversations and the wave, and owns the questions as of the last render, the rail's geometry, what lights a tick (seek, opening, the jump's status, the lit band, pinned), the card (its kind, contents, place, held) and its key intents, the seek card, the bookmark dots and names, and the earlier wait (`synced`, `placed`). It returns plain data: the tick lines' styles, CSS values, dots to create, update, drop and place, the card to show. Loads before `rail/rail.js`. |
| `extension/rail/turns.js` | The turn tracker (`ButterRailTurns`), isolated world: privately owns the visible scroller (following ChatGPT's hidden kept copies) and its ResizeObserver, which gives the model the scroller's box; the mounted turns and their position and lit-band observers; each question's last-seen position, with `measure`, `estimate` and `retarget` for the jump; the reconcile with the conversation; `butterNavTurn`; and the user's scrolling (wheel, touch, the scrollbar, a middle-button press, scroll keys). It tells `rail.js` through callbacks (`changed`, `kick`, `sync`, `scrolled` with the input, `mounted`, `ignore`). Loads after `rail/model.js`. |
| `extension/rail/trip.js` | The trip (`ButterRailTrip`), isolated world: privately owns a far jump's trip (its jump's token, direction, the content's fade, the placeholder's fade-in and streaming loop) and its CSS fragment (`ButterRailTrip.CSS`); `depart`, `redirect`, `arrive`, `take`, `end` and `active` for the jump in `rail/jump.js`. |
| `extension/rail/readiness.js` | The readiness waits (`ButterRailReadiness`), isolated world, for the jump in `rail/jump.js`: `steady` (the target's top still for a span, kept aligned across a replacement of its element; also the settle after arrival), `quiet` (frames at a normal pace again), `nextPage` (ChatGPT's next earlier page) and `lost` (the target unmounted for 250 ms in a row). Each stops once the jump's `live()` is false. |
| `extension/rail/jump.js` | The jump (`ButterRailJump`), isolated world: privately owns the jump in progress (its token; the journey, a far jump's deadline and readiness that a takeover inherits; the pin and its ResizeObserver; the bookmark landing and wash; the busy tick's token; the earlier wait), the choice of glide or trip, the earlier page loop, the mount retries, and the rounds of mount tries and readiness waits (page, math, quiet frames, steady geometry), with a new round when ChatGPT unmounts the target again (at most two more). It reads the model's questions and marks and the turn tracker, publishes its status to the model (`journey`, `setActive`), drives the trip, and asks `rail.js` for the rail's own effects through a `view` (`kick`, `busy`, `wait`, `found`, and `trace`, the dev build's trace hook, given each step of a jump). `go(i)`, `bookmark(i, mark, b)`, `earlier(b?, keyboard?)`, `cancel(cause?)` and `observe(el)` (the turn tracker's `mounted`) are its interface. |
| `extension/rail/pre-jump.js` | The send pre-jump (`ButterPreJump`), isolated world: the capture-phase send detection (Enter, the send button), the jump to one screen above the end in the bubble phase or after the task, and the smoother scrolling switch it follows. Installed by `rail.js`; works with the rail off. |
| `extension/rail/style.js` | The rail's shadow-root CSS text (`ButterRailStyle`), a constant with the trip's fragment (`ButterRailTrip.CSS`) in it. Loads after `rail/trip.js`. |
| `extension/rail/card.js` | The card's DOM adapter (`ButterRailCard`), isolated world: privately owns the card's elements and patches them from the model's card (`hover`, `seekCard`, `refill`, `cardKey`): the tooltip, the bookmark rows (stale tag, the earlier row's spinner), the three dots' card clamp, `--cy` on a whole pixel, the 200 ms leave grace, the card's listeners and keys, and the page's Escape for the three dots' card. `rail.js` builds it in `build()` with the host, the rail and the card's elements and a `view` (`seek`, `jumpTo`, `remove`, `focusStop`, `cool`); `show(i)`, `enter(i)`, `seek(s)`, `unseek()`, `hide()`, `refill()`, `holds(el)`, `spans(y)`, `stay()`, `leave()` and `escape(e)` are its interface. |
| `extension/rail/rail.js` | The rail's DOM adapter: the shadow DOM built (its CSS from `rail/style.js`), the rail, ticks, three dots and dots patched from the model, frames only while the model says something moves, focus, and the rail switch and opening checks before a jump. It installs the turn tracker, the send pre-jump, the trip, the jump and the card (`rail/card.js`, once built). `ButterRail` (`WIDTH`, `inset()`, `setMarks`) is its interface; `butterNavTurn` is the turn tracker's (`rail/turns.js`). It calls the dev build's trace hook (`__butterRailTrace`, undefined in a store build) through a guarded `trace`, which the jump gets in its `view`, and hands it the model, the turn tracker and the bars once at start. |
| `extension/bookmarks/model.js` | Bookmarks, pure: the excerpt rule, identity (`key`), the stored allowlist (`clean`), grouping by question in answer order (and the earlier, unloaded history's group `EARLIER`), a selection's anchor (`anchor`), the shortcut's top paragraph (`topParagraph`), the tooltip's key hint (`keyHint`), resolution to live or stale (`resolve`, `matches`, `pale`), the rail's bookmark dot (`dotSize` from the pitch, `dotRight` from the tick's scale, `dotLook`: solid, hollow or faint), what the rail's hover card lists (`card`), what a tick's card holds when its question has bookmarks (`questionCard`), the bookmarks' accessible label (`label`), a tick's accessible name (`tickLabel`), the excerpt's first-line length (`firstLine`) and the Bookmark cell's `aria-keyshortcuts` (`ariaKeys`). |
| `extension/bookmarks/wash.js` | The landing wash, pure (`ButterWash`): one box per rendered line from a range's rectangles (`boxes`), a code block's or a table's one box (`blockBox`), and the sweep or a block's fade-in, the hold and the fade (`plan`). |
| `extension/bookmarks/client.js` | The bookmark worker's client (`ButterBookmarkStore`): `send`, which `content.js` hands to the bookmark session (one version-1 runtime message, retried up to three times on `bookmark-storage` or a closed port); `cleared(fn)`, called on the popup's Clear token; and `readKey`/`key`, the Bookmark command's key Chrome reports. |
| `extension/bookmarks/session.js` | The bookmark session (`ButterBookmarkSession`), isolated world, no DOM or `chrome.*`: a factory over injected adapters (the store, the hash, page facts, the bookmarks-off check (the rail or Bookmarks off, or Butter paused), the account request, `publish` toward the rail and `outcome` toward the notification). It owns the account and conversation in view, the list read once per (account, conversation) and again after it was unavailable, after bookmarks were off and after the popup's Clear (`cleared`), the raw ids behind hashed ones (kept across unmounts), staleness last seen in the tab, fresh dots and the earlier-to-loaded transfer, the supersession serial, seek deferral, the quiet re-check, and create, remove and their Undo. It publishes `{ revision, groups }` to `ButterRail.setMarks`. Loads after `client.js`. |
| `extension/bookmarks/content.js` | Bookmarks on the page: the Bookmark cell of the selection pill, the shortcut, the landing wash in its own layer, and the DOM the bookmark session works from: text nodes, line measuring, the selection's anchor, the top paragraph and `locate`. It builds the session over the page reader and `ButterBookmarkStore`, and turns page events (`butter-account`, `butter-seek-state`, `butter-settings`, clicks, the pointer or focus reaching the rail) into session calls. |
| `extension/bookmarks/worker.js` | Loaded by the service worker: the `bookmarks` object store and its runtime messages, and the `bookmark` command relayed to its tab. |
| `extension/bookmarks/notice.js` | The bookmark notification (#77), top right: "Bookmark saved", "Bookmark removed" or "Already bookmarked", the first words and Undo, which runs the action the bookmark session handed over (a save's deletes it, a remove's stores it again); it never writes the store itself; 4 s, held by the pointer or focus; the first save ever expands it with the privacy text and Got it, which sets `bookmarkNotice: 'acknowledged'` in settings. |
| `extension/consent/card.js` | `ButterCard`, the shell the layout consent card and the bookmark notification share: look, font, themes and motion; bottom-right cards stack, the `top` card (the notification) sits top right outside that stack. |
| `extension/dev/` | Dev build only, left out of the store and `--test` zips: `allowlist.js` (`ButterDevAllowlist`: the privacy filter's keys, event types and closed list of strings), `recorder.js` (pure bug-capture recorder and privacy filter), `sources.js` (the snapshot's `turns` and `usage`, read from the page with injected page objects), `recorder-main.js` (MAIN world, listens to the seek and layout-cache hooks and the rail trace, and builds the snapshot's `rail` part from the rail trace's answer and ChatGPT's turn order), `rail-trace.js` (isolated world, before `rail/rail.js`: the rail trace, which defines the rail's trace hook `__butterRailTrace`, turns a jump's steps into `rail-*` events and reads the rail's state and tick boxes; both go to `recorder-main.js` as document events), `content.js` (relays a snapshot request), `toast.js` (isolated world: the on-page "Bug N saved" toast the worker asks for once a file is written), `worker.js` (service worker: loads the store worker, handles the save-bug shortcut, the popup's save and New round, and the download), `popup.js` and `popup.css` (the popup's DEV tag and dev card, rendered through `popup.js`'s passive dev slot). |
| `docs/` | User docs, test report, media. |
| `results/` | Earlier published result tables, made by `lab/summarize.py`. |
| `lab/` | Test lab: browser launcher, replay benchmark and other harness scripts, ablation variants. |
| `notes/review.md` | Historical risk review of the early extension code. |
| `notes/runs/` | Curated lab reports and numeric results; private captures excluded. |
| `report/report.html` | One-page visual summary. |
| `scripts/package.py` | Builds `dist/butter-<version>.zip`; `--test <tag>` and `--dev` build numbered test zips. |
| `CHANGELOG.md` | Versions. |

The MAIN-world scripts retain their dependency order. `page/reader-main.js` comes first among the
page-reading scripts: seek's `layout-cache-main.js`, `anchor-main.js` and `preview-main.js` read
ChatGPT's answer structure through it, and `seek/core-main.js` holds no selector.
`seek/layout-codec.js` supplies the geometry wire format before `seek/layout-persistence-main.js`
(stored layout records) and `seek/layout-lean-main.js` (lean text), whose factories the single
`seek/layout-cache-main.js` calls; all consumers still run after it.
`seek/anchor-main.js` supplies semantic landing anchors as well as swap diagnostics.
`seek/preview-texts-main.js` (conversation markdown), `seek/landing-main.js` (the landing after a
release's commit) and `seek/seek-diagnostics-main.js` (the diagnostics' session serializer) load
right before `seek/preview-main.js`, which calls their factories.

## Tests

- Unit tests: `npm test` (runs `node --test 'test/**/*.test.{cjs,js,mjs}'`, so only the test files in `test/`, not its helpers or local files elsewhere; run `npm ci` first for `test/max-lines-caps.test.mjs`, and `npx playwright install --only-shell chromium` once for `test/page-reader-contract.test.mjs`, `test/stream-style-cost.test.mjs` and `test/chat-anchoring.test.mjs`; CI adds `--with-deps`).
- Page reader contract: `test/page-reader-contract.test.mjs` loads every `test/fixtures/page/*.html` in headless Chromium (Playwright, one browser for the file), injects each adapter listed in its `ADAPTERS` (`extension/page/reader.js`, isolated; `extension/page/reader-main.js`, MAIN) and runs each check written for a fact the adapter implements: message identity for both; answer roots, questions, paragraphs, replies, loose turns and every text node for the isolated reader; seek's blocks, preview items and markdown columns for the MAIN reader; all against the page's `data-expect-*` marks ([test/fixtures/page/README.md](../test/fixtures/page/README.md)). Run it alone with `node --test test/page-reader-contract.test.mjs`.
- Streaming style cost: `test/stream-style-cost.test.mjs` streams blocks into the last answer of a synthetic long chat (nine 300-block history answers) in headless Chromium, one per frame, with the real `extension/stream/containment.css` and `stream/offscreen.js`, and counts the elements restyled per update (the `elementCount` of `UpdateLayoutTree` trace events, a count that does not vary between runs). A containment selector that restyles a whole answer per insertion fails it ([notes/runs/2026-11-11-replay-blocking](../notes/runs/2026-11-11-replay-blocking/report.md)).
- Chat anchoring: `test/chat-anchoring.test.mjs` grows a turn above the view of a synthetic chat in headless Chromium with the real `extension/stream/containment.css`, and checks that the browser's scroll anchoring does not move the chat with Smoother streaming's `cv` setting on, and does with it off ([notes/runs/2026-11-16-wheel-jump-top](../notes/runs/2026-11-16-wheel-jump-top/cause.md)).
- Popup in the lab browser: `node lab/harness/popup-qa.mjs` uses an isolated headless Chromium to capture all 22 states in both themes at 360 px under `/tmp/butter-popup-build/` (set `BUTTER_MOCKUP` to also capture approved references, and `BUTTER_CASES=13,16` to run only those states).
- Popup storage rows (#108): `node lab/harness/popup-bookmarks-shots.mjs` shoots the real popup at 360 px for each panel of `mockups/popup-bookmarks.html` (plus paused and needs-rail), seeding synthetic bookmarks and layouts through the worker, and records each state's height in English and Chinese; `MOCKUP=mockups/popup-bookmarks.html` also compares every box with the mockup's (1 px tolerance). `OUT=<dir>` overrides the default `notes/runs/2026-11-13-popup-bookmarks/`.
  `BUTTER_REDESIGN_MOCKUP=<path>` compares the built states with the #35 redesign mockup
  (`gh issue artifact download 35 1 -R SimianW/butter`), and `BUTTER_REDESIGN_SIDE=before|after`
  (default `after`) picks its panels: default, paused, rail fault, layouts pending, clear confirm,
  branch off, branch fault, dark and Chinese, where that side has them. Each panel must match its
  state's height and differ in under 0.1% of pixels (by more than 24 in a channel), with the
  version label and the storage rows' saved lines masked; the run prints every panel's height and diff ratio,
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
  The fixture QA, `lab/harness/branch-qa.mjs`, loads the real extension in its own headless
  Chromium over the synthetic page in `lab/harness/branch/fixture.mjs` (no ChatGPT requests; query
  parameters such as `lang=zh`, `stream=<ms>`, `work` and `fail=<type>` select ChatGPT variants, each
  described where `fixtureHtml` reads it). Run `npm ci`, then
  `node lab/harness/branch-qa.mjs`. Its scenarios live in `lab/harness/branch/scenarios/`, listed
  in run order in `branch/scenarios.mjs`; each declares its start (fixture parameters, settings),
  and each scenario's `--list` description and file header are the reference for what it checks.
  - `--list` prints every scenario's name and description; `ONLY=<name>[,<name>…]` runs only those
    (an unknown name exits 2).
  - The run prints only failing checks and one line per scenario; `VERBOSE=1` prints every check
    and the measurements.
  - `SHOTS=<dir>` sets where the mockup-state screenshots and `summary.json` go; the default is
    `/tmp/butter-branch-qa/`. Set `SHOTS=notes/runs/2026-11-07-ask-in-branch-29/screenshots` to
    refresh that run's committed screenshots.

  `branch-live.mjs` is the live check: hold the lab lock, restart the lab browser with a
  snap-readable copy of `extension/`, then run it with `LAB_ID`, `LAB_OWNER` and
  `BRANCH_PATH='^/backend-api/conversation/new_branch$'` (the only request let past the send guard).
  `branch-live-edges.mjs` (same setup, `LANG_TAG=zh` with ChatGPT in Chinese) checks the streaming
  wait and the hidden-button cases on the live page; see its header for how the stream is held.
- Dev build bug capture: `test/dev-recorder.test.js` and `test/dev-sources.test.js` (`node --test`)
  cover the recorder and the `turns`/`usage` sources against planted page state,
  `test/dev-rail-trace.test.mjs` the rail trace over the whole rail (`test/helpers/rail-boot.mjs`
  with a virtualizer: a jump that lands, one whose target never mounts, a wheel that cancels, and
  the same scroll writes with the hook, without it and with a hook that throws), and
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
  relay and the key query), `test/bookmark-session.test.js` (the bookmark session through its
  interface, over an async in-memory store with held replies and planted pages: an account or chat
  switch mid-read, seek deferral, a streamed answer unmounted and its raw id and staleness kept, the
  earlier-to-loaded transfer, a duplicate save, delete and Undo, Undo after navigation, the
  published revision and the quiet check, an unavailable list read again, rail off),
  `test/bookmark-notice.test.js` (the notification, driven by the real session: the saved, removed and
  already-bookmarked cards in English and Chinese, the expanded first-bookmark card until Got it,
  Undo of a save and of a remove through the real store client and worker store, one store write per
  Undo, replacement and a stale Undo, the
  4 s lifetime held by the pointer or focus under fake timers, hiding when Butter or the rail goes
  off, its top-right place, independence from the layout switch and consent) and
  `test/selection-pill.test.js` (the selection pill: the cells shown for each switch combination,
  Work mode and no "Ask ChatGPT", their order and place, names and `aria-keyshortcuts`, activation on
  a primary pointerdown or a keyboard click, the label's 300 ms and switching, a held selection's
  anchor, and its host inside `<body>`) run under `node --test`, and
  the rail model's tests (below) check that each dot keeps its 4 px gap through every frame of the
  hover wave and stays inside the rail, shrinks and turns faint for close ticks, fades out when its
  last bookmark goes, and that the arrow stops are the ticks only; and, for earlier history (#72), the
  solid 4 px dot 4 px left of the three dots on their row, the three dots' name, their card (their
  hint card without bookmarks), and ArrowLeft into it with ArrowRight and Escape back. `test/bookmark-card.test.js` also covers the earlier card for one and several bookmarks and
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

  The live check, `lab/harness/bookmarks-live.mjs`, runs in the live lab and never sends a prompt:
  it takes the lab lock, keeps the send guard on and installs a fresh unpacked copy of `EXT`, as its
  header says. Its scenarios live in `lab/harness/bookmarks-live/`, in two suites listed in run
  order in `bookmarks-live/scenarios.mjs`:
  - the matrix (default; the perf lock, `LAB_FIXTURE=math12`, and the Bookmark shortcut set to
    Alt+Shift+M in the lab profile, restored after): held native scrollbar drags with and without
    bookmarks, a paragraph and a selection bookmarked, jumps after and during a drag and into
    unloaded earlier history, live resolution after a reload, delete, and a list item;
  - `MODE=wash` (no perf lock or shortcut; run it with `LAB_FIXTURE=demo-en12`, whose answers hold
    long paragraphs and tables): the landing wash on real ChatGPT markup in light and dark theme
    for a paragraph, a selection and a table bookmarked with the pill's Bookmark cell. No fixture
    answer holds a code block yet, so code blocks are checked in the fixture only.

  Run it with `EXT=<checkout>/extension node lab/harness/bookmarks-live.mjs` on the lab host:
  - `--list` prints both suites' scenarios with each one's mode; `ONLY=<name>[,<name>…]` runs only
    those of the current mode (an unknown name exits 2). `--list` and an unknown name need no lab;
    a run of known names takes the lab lock and restarts its browser like a full run.
  - A live scenario can't reset or seed: it runs on what the ones before it left, declares what it
    needs (the fixture loaded, two stored test bookmarks, a top-level list in the fixture) and is
    skipped with the reason when that is missing, so `ONLY=<a later scenario>` alone prints
    `skip <name>: <reason>`. Without `ONLY` a skip fails the run, except list-item's when the
    fixture has no top-level list.
  - The run prints only failing checks, one line per scenario and the cleanup's results;
    `VERBOSE=1` prints every check and the measurements.
  - `OUT=<dir>` sets where `summary.json` goes (default `notes/runs/<today>-bookmarks-live/`). It
    holds only numbers, booleans and public Butter labels; a throw's stack goes to
    `/tmp/butter-bookmarks-live-error.txt` (mode 0600) and the summary keeps only its phase and
    error class. The reports are in `notes/runs/` (the wash's first is
    `notes/runs/2026-11-10-bookmarks-wash-live/`).
- Version consistency: `python3 scripts/check-version.py`; packaging tests: `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- Review tier: `python3 scripts/review-tier.py [base]` (default `origin/main`) prints the tier from the changed files. CI workflows (`.github/workflows/`) and the gate's own scripts (`review-tier.py`, `check-pr-body.py`, `same-code.mjs`) are tier 2, even in a comment-only change, so weakening a check needs a tier 2 review. A `.js`, `.mjs`, `.cjs` or `.css` file changed only in comments and whitespace is tier 0 (CSS holding a backslash or `url(` is never treated so), and a manifest `content_scripts` change that only edits the entries' `js` and `css` lists (no file moved between entries) is tier 1. The JavaScript comparison runs `scripts/same-code.mjs` with espree, so run `npm ci` first. Its tests run with `python3 -m unittest discover -s scripts -p 'test_*.py'`.
- PR body: `PR_BODY="$(cat body.md)" python3 scripts/check-pr-body.py [base]` runs CI's `pr-body` check locally: the Review section's `- **Tier:** N` item, its `- **Verdict:** approved at <sha>` item (or `overridden by <user> at <sha>`, when the user ships a stuck review-loop) for tiers 1 and 2, and no tier 1 or 2 change after the reviewed commit, by the same rules (so a comment-only fix after the approval passes). CI's `pr-body` job runs the base branch's copy of the gate scripts (and its espree) against the PR head, so a PR that changes the gate is judged by the rules on the base branch, and its own version applies after merge. The job's log notes this in a `pr-body` notice.
- PR size: `python3 scripts/pr-size.py [base]` (default `origin/main`) prints the `size/` label CI sets on a PR and the code files it counted; the `SKIP_*` settings at the top of the script list what is left out.
- History rail: the rail presentation model runs under `node --test` with no DOM, through its
  interface: `test/rail-model.test.mjs` (the inset and when the rail shows, from one question; the
  one-question rail's single lit tick and its dot; history prepended during
  a wave keeping each tick with its question, what lights a tick — seek over opening over a flying jump
  over the lit band and pinned —, the opening snap, the rail turned off between frames, a frame older
  than the last kick, convergence and quiet at rest, the dots through every wave frame, dense and
  earlier-history dots, names, the fade-out, the tick under a y and the three dots' zone, the busy
  tick, the rail turning on at a 560 px chat, dense geometry, opening another chat forgetting the seek
  preview and the active question), `test/rail-card.test.mjs` (the card's kinds, contents
  and place, holding and leaving, the seek card, keys into and in a card, the card following a
  deletion, the earlier wait on the marks' items revision and `placed`, the 400-character cuts,
  `unshow`, a one-question chat's "1 / 1" card, its seek card and its single stop), both over
  `test/helpers/rail-model.mjs`, which drives the model as `rail.js` does;
  `test/rail-conversations.test.mjs` (pages, sends, reconciliation, revisions) and
  `test/rail-wave.test.mjs` (ticks keyed by question, the interval clamp, convergence).
  `test/rail.test.mjs` runs the real `rail.js` and its model in a fake DOM for what needs elements,
  booted by `test/helpers/rail-boot.mjs` (every `rail/` script in manifest order, planted turns, a
  manual clock):
  the rail drawing what the model returns (CSS values, names, the three dots, dots, a tick's line,
  the card's `inert`), the send pre-jump installed (and working with the rail off), jump
  cancellation, the jump's wiring (a far trip's busy tick, a remounted target followed, card rows'
  bookmark and earlier jumps with the three dots' blink, an earlier trip that finds its bookmark
  putting the dots' card away, held after a pointer trip, focus on its tick after a keyboard one),
  the seek card's wiring, the dots' fade-out timer, keyboard focus (the arrows on a one-question
  rail's only tick), and the card's leave grace and the page's Escape through the rail. The rail's
  modules run alone over the same fake DOM (`test/helpers/rail-dom.mjs`, with recording observers):
  `test/rail-turns.test.mjs` (the turn tracker: a hidden copy's scroller taking over, the lit band,
  `estimate`, `measure`, `retarget` dropping only unseen records, scroll detection and the scroll
  keys' filter, the reconcile debounce), `test/rail-trip.test.mjs` (the trip, with an `animate()`
  recorder: arrival restoring the content and hiding the placeholder only when no new trip started,
  redirect, `end(tok)`, reduced motion), `test/rail-jump.test.mjs` (the jump with a fake model
  recording its journey status, a fake turn tracker, a recording trip and a manual frame and timer
  clock: glide or trip, pin, follow and unpin in order, cancel mid-wait, a takeover inheriting the
  first click's deadline, a repeated click ignored, an earlier trip waiting for synced marks, a
  bookmark jump landing on its text and washed once stopped, or flashed when stale),
  `test/rail-card-dom.test.mjs` (the card's adapter over the real model with a recording `view`: row
  fills, single and list, the stale tag, the earlier row's spinner and the three dots' clamp, the
  refill keeping focus on the same row and going back when the card empties, the leave grace, the
  card's keys, the page's Escape and the seek patch) and
  `test/pre-jump.test.mjs` (the send pre-jump with a fake
  window: Enter and click, the bubble phase and its fallback, the 1.5-screen rule, the switches). bookmarks-qa's `rail-idle` scenario checks the performance floor in a browser: the rail
  schedules no animation frame for 2 s after the chat opens and settles, after a hover wave and after
  a jump lands (a DevTools session wraps `requestAnimationFrame` in Butter's isolated world and counts
  calls from `/rail/` scripts only, so `rail.js` and `jump.js` must look it up at call time). Fixtures that inject
  the rail into a page of their own load its scripts in manifest order from
  `lab/harness/rail-scripts.mjs` (`test/rail-scripts.test.mjs`: every `rail/` script in the
  manifest, `rail.js` last).
- History rail in the lab browser: `lab/harness/nav-jumps.mjs`, `nav-stream.mjs`,
  `nav-switch.mjs`, `nav-video.mjs`; `nav-earlier.mjs` (fixture for far-jump landing and the "earlier" dots, no ChatGPT requests), `nav-earlier-live.mjs` and `nav-settle.mjs` (same checks in an open ChatGPT tab).
  Far-jump timing: `jump-latency.mjs` (phase timings on a long chat), `jump-latency-edge.mjs`,
  `jump-latency-summary.mjs`; takeover deadline fixture: `nav-takeovers.mjs`.

## Formatting

Run `npm ci` to install the pinned development tools (Prettier, ESLint, and Playwright for
`lab/harness/`), then `npm run format` to format
`extension/**/*.{js,css,html,json}` and `test/**`. Use `npm run format:check` to check them.
`npm run lint` checks `extension/` and `test/` for undefined and unused names, and those plus `lab/harness/` for file length: at most 500 lines (blank lines and comments count), except the files capped at their current length in `eslint.config.mjs`, which may only shrink (ESLint; config in `eslint.config.mjs`). It skips every git-ignored folder and `.claude/`, where agent worktrees live; `test/check-scope.test.mjs` keeps its ignores in step with `.gitignore`.
`npm test` runs every `test/**/*.test.{cjs,js,mjs}` file, so name a new test file that way (`test/helpers/` holds shared code, not tests). It needs `npm ci`: the Playwright tests import Playwright, and `test/check-scope.test.mjs` and `test/max-lines-caps.test.mjs` import ESLint; the second fails when a capped file has shrunk below its cap or to 500 lines or fewer, so the cap is lowered or dropped.
`npm run check` runs every CI check in order (`npm test` needs `npx playwright install --only-shell chromium` once).
`npm ci` also installs a Husky pre-commit hook that formats staged files with Prettier (lint-staged, same globs as `format:check`) and runs `npm run lint` and `python3 scripts/check-version.py`; `git commit --no-verify` skips it.

## Runtime API

Runtime messages, settings and storage contracts: [runtime-api.md](runtime-api.md).

## Release

Packages, test builds and the dev build: [agents/releasing.md](agents/releasing.md). The dev card's runtime messages and storage: [runtime-api.md](runtime-api.md#dev-card).
