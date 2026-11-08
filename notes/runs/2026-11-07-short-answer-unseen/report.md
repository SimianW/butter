# Short citation answer: unseen-preview investigation

Baseline: `9e2435e`, extension `0.1.0-alpha.14` / `0.1.0.14`.
Production code is unchanged. No commit, PR, version change, or delegation.

The main bug was later diagnosed from Mac captures and fixed; see [Resolution](#resolution).

**The requested Control and Red completion criteria were not achieved.** The reported
missing-record failure did not reproduce in either live lab. There is no observed rejection
code for the affected Mac turn, no established root cause, and no honest failing regression
command to report. The live diagnostic check left in this worktree passes. A synthetic
fixture that forces one of the suggested rejection conditions would not establish this bug.

## Live evidence

Lab 2: loaded this checkout as an unpacked extension and created one controlled Chinese
web-search question. Its sole complete answer has nine web-citation pills, headings,
lists, a table, and a separator. After scrolling from top to bottom, a native scrollbar
press followed by a controlled scroll while the button stayed held activated the real
preview. A reload and a branch of that conversation were also checked.

The observed DOM uses the classic renderer, not `DilResponseRoot`. Citation pills are
`a[data-testid="chatgpt-citation"]`, with `aria-haspopup`, `aria-expanded`, `data-state`,
and an external link. The turn carries `data-talvt-turn-state="complete"`. The markdown
root's `AdaptiveStreaming-uuYOZc` class was present during generation and absent after
completion. No pending math sources were present. An identity selector matched.

Settled and fully seen recorder results:

```json
{
  "observed": true,
  "generating": false,
  "queued": false,
  "measuring": false,
  "attempted": true,
  "lastRejection": null
}
```

The accepted record has 45 measured blocks and 48 preview items. At the held press,
`layout: true`, `layoutReason: null`, `recordCount: 1`, `active: true`, and `notice: false`.
The recorded/current scroller widths agree, as do recorded and virtualizer row heights.
The ordinary chat and its branch both work. Sanitized branch evidence is in
[branch-control.json](branch-control.json).

After restarting with no extensions, the same conversation has one complete turn and
nine citation pills, with `cache: false` and `preview: false`; see
[no-extension.json](no-extension.json). This confirms the absence of Butter's surface,
but it cannot complete Control because the Butter-enabled case did not fail.

Lab 1: inspected 15 existing conversations read-only, including a single-turn answer
with 11 citation pills. The new check scrolled through that entire answer and pressed
the native scrollbar. Result: 26 measured blocks, 29 items, no rejections, accepted
layout, active preview, hidden notice. Full privacy-safe output is in
[live-check-lab1.txt](live-check-lab1.txt).

All 15 lab 1 discovery samples and the 12 lab 2 discovery samples used the classic
renderer. Some unrelated math chats reported `math-pending`; offscreen turns in longer
chats reported `skipped`. Neither is evidence of the reported fully read, short,
citation-bearing last-turn failure. Discovery alone sometimes read `queued: true` before
an attempt; those samples are not treated as missing-record reproductions.
[lab1-discovery.jsonl](lab1-discovery.jsonl) retains only counts, state values, and reason
codes. One final lab 2 discovery sample was overlapped by navigation to the controlled
chat and is excluded from conclusions.

Lab 2 was restored and released before the lab 1 investigation. Lab 1 was then restored
and released. Both restores verified an empty composer and the default extension list.
Lab 1 never sent a message. The controlled question and branch were created only in
lab 2, where this task explicitly authorized them. Raw DOM, local chat locations, and
temporary discovery drivers remain outside the repository in the lab's local captures
directory. No captured message text or identifiers are included here.

## Check left uncommitted

Path: `lab/harness/short-answer-unseen.mjs` (deleted with the fix; it never reproduced the bug, see
Resolution).

With the lab locked and an existing single-turn citation conversation loaded with Butter:

```sh
LAB_ID=1 LAB_OWNER=short-answer-unseen node lab/harness/short-answer-unseen.mjs
```

Actual exit: `0`. Final output:

```text
PASS fully read single citation answer has a record and no unseen notice
```

It uses the real recorder, real press preparation, and real preview notice. It does not
submit a message or navigate automatically. It verifies lock ownership, installs the
send guard, scrolls the complete answer, captures reason codes, and asserts a record,
accepted layout, and hidden notice. It releases the held mouse button on failure.
The caller restores/releases the lab after use. It is a live diagnostic check, not a
demonstrated red regression test; no unit/fixture reduction is justified yet.

## Confirmed fallback-text cause

`history/conversation-main.js:158` forwards the conversation response unchanged in the
`butter-seek-data` event. `preview-main.js:102` joins string `content.parts` without
normalizing citations or Markdown. `texts()` then concatenates final assistant messages
at `preview-main.js:166`.

When `question.layout` is false (`preview-main.js:437`), `render()` uses those history
strings. At `preview-main.js:478` it splits paragraphs, recognizes heading prefixes, and
removes bold markers. It does not remove citation component syntax or list prefixes.
`estimatedContent()` at `:414` handles math delimiters only; `content()` appends the
remaining text with `createTextNode()` at `:412`. Consequently both `<Cite .../>` and
`- ` survive literally. This is text output, not HTML execution.

An inline Node VM probe executed the actual two renderer functions with synthetic input.
Actual exit: `0`; actual output:

```json
{
  "input": "- Example <Cite refs={[\"synthetic\"]}/>",
  "renderedText": "- Example <Cite refs={[\"synthetic\"]}/>",
  "explanation": "citation markup and list marker both survive the actual estimatedContent() function"
}
```

This explains the side symptom independently of why a layout record was missing.

## Root cause and suggested fix

No main-bug root cause or minimal production fix is established. The available live
evidence does not justify weakening `complete()`, the reveal guard, math readiness,
nonzero block validation, or press-time geometry validation.

The relevant recording path remains `watch()` / generation parking, `begin()` at
`layout-cache-main.js:810`, snapshot validation at `core-main.js:179`, and `finish()` at
`layout-cache-main.js:970`. The live controls passed it. The per-turn `diagnostics()`
API at `layout-cache-main.js:1267` and the frozen press decision can distinguish recorder
failure from subsequent layout rejection on a failing page.

Required next evidence: run the existing privacy-safe readiness and press-decision
capture snippets on the affected Mac immediately after reproducing, plus a sanitized
DOM/fixture preserving the rejected state's structural attributes. The snippets are
`notes/diagnostics/capture-record-readiness.js` and
`notes/diagnostics/capture-press-decision.js`. Their actual rejection code should drive
the unit/fixture reduction and minimal fix. A screenshot's notice alone cannot identify
which guard failed, or prove that no record ever existed rather than being rejected at
press time.

For the independently confirmed fallback formatting issue, a small separate change
could normalize recognized citation tokens and list prefixes before text-only rendering.
It would improve fallback text but would not repair missing layout records. Not applied.

## Commands and actual results

Read `AGENTS.md`, `docs/bugfix.md`, `lab/README.md`, `notes/runs/README.md`, the live
lab README, and the `diagnosing-bugs` skill first. Routine `rg`, `cat`, `sed`, `nl`,
`tail`, and Git inspection selected the real recorder/preview seams and prior lab
drivers; their source findings are identified above. No glossary or ADR files were found
by the filename search.

| Command/action | Actual result |
| --- | --- |
| `git status --short` initially | Empty output: clean. |
| `git rev-parse --short HEAD` | `9e2435e`. |
| `npm ci --prefix lab/harness` | `added 2 packages, and audited 3 packages`; `found 0 vulnerabilities`. |
| `lab-lock acquire --lab 2 --owner short-answer-unseen --wait 1800` | `2`. |
| `LAB_ID=2 LAB_EXTENSIONS=<local checkout extension copy> lab restart-browser` | `chromium: stopped`, `chromium: started`. |
| Local `create-control.mjs` | `{"stage":"composer-ready","cache":true}`, `{"stage":"sent"}`. Its outdated assistant-role wait subsequently timed out; separate complete-state inspection succeeded. |
| Local `inspect-control.mjs`, ordinary conversation | `active: true`, `notice: false`, 45 blocks, 48 items, `lastRejection: null`, empty rejections. |
| Inline guarded reload probe | One complete turn, nine citation links, `lastRejection: null`, empty rejections, no adaptive-streaming nodes. |
| Inline branch action; local `inspect-control.mjs` | One complete turn, nine citations; accepted record and hidden notice. Full sanitized output in `branch-control.json`. |
| Local `scan.mjs` | 12 conversation samples; no short citation-bearing failure found. |
| Local `scan-citations.mjs` | Existing citation answers accepted when measured; some offscreen long-chat turns rejected as `skipped`. Final overlapped sample excluded. |
| `LAB_ID=2 LAB_EXTENSIONS= lab restart-browser`; guarded reload probe | `{"turns":1,"states":["complete"],"citationPills":9,"cache":false,"preview":false}`. |
| Lab 2 `L.restore()` then `L.release()` | `{"restored":true,"restarted":false,"composerEmpty":true,"extensions":0}`; `lab_released: true`. |
| `lab-lock acquire --lab 1 --owner short-answer-unseen --wait 1800` | `1`. |
| `LAB_ID=1 LAB_EXTENSIONS=<same local extension copy> lab restart-browser` | `chromium: stopped`, `chromium: started`. |
| Local `scan-lab1.mjs` | 15 existing conversations; classic renderer in all. Full sanitized output in `lab1-discovery.jsonl`. |
| `LAB_ID=1 LAB_OWNER=short-answer-unseen node lab/harness/short-answer-unseen.mjs` | Exit 0; `PASS fully read single citation answer has a record and no unseen notice`. |
| Inline Node VM renderer probe | Literal citation markup and list prefix survive, as shown above. |
| Lab 1 `L.restore()` then `L.release()` | `{"restored":true,"restarted":true,"composerEmpty":true,"extensions":1}`; `lab_released: true`. |
| `node --check lab/harness/short-answer-unseen.mjs` | Exit 0, no output. |
| `git diff --check` | Exit 0, no output. |
| `lab-lock status` after restoration | Lab 1, lab 2, and perf all `held: false`, `owner: null`. |

Setup failures, not red regressions: older inline/driver probes timed out waiting for
`#prompt-textarea` (the current composer is a contenteditable textbox without that ID).
The first controlled-chat driver later timed out waiting for
`[data-message-author-role="assistant"]`, although the answer had completed; the separate
turn-state probe and actual preview checks succeeded. A preliminary no-extension inline
probe referenced a Node binding in page context, then its corrected retry returned the
saved result. The preview browser's loopback noVNC navigation returned
`net::ERR_CONNECTION_REFUSED`; its host-address retry opened the noVNC login surface,
which exposes no ChatGPT DOM. Lab measurements used the requested lab CDP scripts.
The temporary preview tab was closed.

Final worktree additions: this sanitized report/evidence directory and the live harness
only. All remain uncommitted. **No main-bug red output exists from this run.**

## Resolution

The user's privacy-safe captures on macOS (alpha.14) found the cause after these lab runs.
Setup: a single-turn chat with one complete answer, scrolled all the way through, then a
scrollbar press.

- `capture-record-readiness`, at rest: the turn has a record with 29 items, 27 blocks,
  `rowH` 1896 and `sw` 766. The recorder's `lastRejection` is `null`, and the measured and
  live row heights are both 1896.
- `capture-press-decision`, at the next press: `fiberFound: true`, model length 1, scroller
  `sw` 766, `scrollHeight` 2086, `clientHeight` 975. Turn 0 is mounted, with
  `rowHeightAtPrepare` 1896 and record `rowH` 1896, `fromStorage: false`. But the
  virtualizer `measuredHeight` is 266, `modelHeight` 266, `layout: false`,
  `layoutReason: "height-mismatch"`, and the render is `unseen: true`.

Root cause: the record was correct and matched the live mounted row. ChatGPT's private
virtualizer height map still held a stale 266 for that row at press time, and the trust check
(`core.layoutReason`) compared the record only with that map. In the Linux labs the map stayed
correct, so the bug did not reproduce there.

Fix: for a turn whose row is mounted at press time, `prepare()` in
`extension/seek/preview-main.js` now passes the row's live rect height to `core.buildModel`
in place of the virtualizer value. The record is checked against that height, which also
becomes the turn's model height. Unmounted turns keep the virtualizer check unchanged. The
press decision still reports the virtualizer `measuredHeight`, and its `layoutReason` is the
same decision the model applied. Regression tests: `test/single-turn-unseen.test.js` (the
user's numbers: live 1896, record 1896, virtualizer 266 → layout accepted, model height 1896;
mismatching live rows and mismatching unmounted turns still fall back).

The fallback-text side symptom is fixed too: `core.fallbackText` drops `<Cite …/>` tags and
shows `-`/`*`/`+` list items as `•` bullets, still inserted as text nodes only
(`test/fallback-text.test.js`).
