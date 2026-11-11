# Real-DOM snapshot for the page reader's contract — 2026-11-11

**Result: captured, sanitized and checked.** Two consecutive mounted turns of the live lab's
`demo-en12` test chat are now `test/fixtures/page/live-snapshot.html`, the one real page among the
page reader's hand-written contract fixtures (PR #87). The page reader passes it, and dropping its
`data-chatgpt-selection-message-id` fallback fails it.

## Method

- Lab 2, fixture `demo-en12`, lock owner `page-snapshot` (`lab-lock acquire --lab auto --wait 1800
  --needs-fixture demo-en12`, got lab 2 at once). Read-only: Playwright over CDP into the lab
  browser with its own extension set, send guard installed before navigating. Nothing was typed,
  sent, regenerated or edited. The page's own background POSTs (37 in the final pass) were blocked
  by the guard as usual.
- Viewport 1599 × 912 CSS px. The two turns were scrolled into view, rendering settled, and each
  turn's `outerHTML` was taken with its real ancestor chain up to `.thread-scroll-container`
  (ancestors reduced to tag and attributes; no sidebar, header, composer or account UI). A
  `math12` turn was captured the same way but is not committed (1.1 MB; its structure adds only
  more display math).
- Sanitized before anything was written: every id-like value (`data-turn-key`,
  `data-chatgpt-selection-message-id`, `-conversation-id`, content-search keys, `id`, IDREFs, any
  UUID) mapped to a fake (`turn-N`, `msg-N`, `conv-N`, `id-N`), consistently; every text run and
  content attribute replaced by filler of the same length, keeping whitespace and punctuation;
  `href`/`src` to `#`; scripts, styles, image data and SVG path data removed; Butter's own
  `data-butter-*` attributes and `chatgpt-butter-*` elements removed. No raw DOM or id map was
  saved.
- Expectations (`data-expect-answer`, `-question`, `-para`, `-reply`, encoding in
  `test/fixtures/page/README.md`) were decided from the markup alone; no Butter script was loaded
  to decide them. A separate offline checker (Python's HTML parser) re-derived them: 74 599
  checks, 0 failures.
- To keep the repository small, each answer's tail was cut in Chromium (only trailing children of
  the answer root removed, so every kept paragraph keeps its ordinal): `msg-1` keeps its first 13
  blocks (heading, quote, display math, a list, a rule), `msg-2` its first 117, up to and
  including its first table. 763 KB → 204 KB.
- `lab-restore --lab 2 --owner page-snapshot`: `restored`, `ok: true`, composer empty, one page,
  home URL matched. `lab-lock release`: `{"lab": 2, "lab_released": true, "perf_released": false}`.

A first attempt from a machine without the lab browser took and released that machine's stale
lab lock, could not connect (`ECONNREFUSED`), and captured nothing.

## What the live markup shows

| | `demo-en12`, two turns (as captured) | committed (tails cut) |
|---|---:|---:|
| answers | 2 | 2 |
| paragraphs (`data-expect-para`) | 503 | 135 |
| tables | 5 | 1 |
| top-level lists | 4 | 2 |
| nested lists | 0 | 0 |

- Direct markdown: no `[class*="DilResponseRoot"]`, so the answer root is the
  `[data-markdown-text-style="assistant-message"]` element itself, which is also the reply.
- No `data-message-author-role` and no `data-message-id`: the message id comes only from the
  ancestor's `data-chatgpt-selection-message-id`, as `notes/runs/2026-11-08-bookmarks-live` found.
- Display math, headings, rules and table wrappers are answer-root children, so each is a
  paragraph; that is why there are more paragraphs than `<p>` elements (289 in the capture).
- No nested list in the five mounted turns inspected: nested lists stay covered by the
  hand-written `lists.html`.

## Contract run

`node --test test/page-reader-contract.test.mjs` with the snapshot: `isolated reader on
live-snapshot.html` passes all six checks (about 0.7 s). With the reader's message-id rule cut to
`[data-message-author-role="assistant"][data-message-id]`, it fails `answersIn` and the text-node
check, with `dil.html`, `lists.html` and `live-markup.html`.

## Privacy

Leak scan of the capture: 0 UUIDs, 0 `chatgpt.com/c/` URLs, 0 emails, 0 of both lab account
labels, 0 of the 15 original identities, 0 of the 5 804 original five-word phrases. Rechecked on
the committed file: 0 UUIDs, 0 `chatgpt.com`, 0 emails, 0 account labels, 0 Butter marks. The
capture and sanitizer scripts and the lab host's paths stay local.
