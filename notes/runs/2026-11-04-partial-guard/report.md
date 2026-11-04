> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Seek preview: never record a partly revealed answer

Worktree `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`. Nothing was committed, pushed or version-bumped. Built on top of the previous `math-height` fix, which is kept.

## Chosen signal: ChatGPT's own reveal state (`AdaptiveStreaming`)

### Evidence from ChatGPT's code

Source: saved bundle `(not archived)`, modules `cWXs` and `hSWQ`.

- The markdown wrapper computes `d = isStreaming && (animate ?? true) && !reducedMotion`.
- It passes `adaptiveStreaming: d` to the renderer. The renderer adds the class `AdaptiveStreaming-uuYOZc` to the markdown root only when `d` is true.
- The same wrapper renders through the reveal component `hSWQ` with `enabled: d`. That component draws the revealed prefix `M.text` only when `C = enabled && !w && tabVisible`. Otherwise it draws the full `text`.
- `C` implies `d`. So **whenever partial text is drawn, the class is present.** Without the class, the full answer is drawn.
- The turn's `data-talvt-turn-state` is a separate signal. It can read `complete` while the renderer is still revealing, which is the hole that let partial snapshots through.

### Evidence from the lab

Read-only probes covered 101 settled answers in 4 chats:

| Chat | Settled answers |
|---|---:|
| math chat A | 12 |
| <prompt text> math fixture | 8 |
| code/table chat (7 code blocks, 6 tables) | 5 |
| long prose chat (tables, blockquotes, headings, lists) | 76 |

- **`AdaptiveStreaming` on a settled answer:** 0 of 101.
- **Any `FadeIn` span:** 0 of 101. There were no other reveal markers either; the only non-cursor class matched was `horizontal-scroll-fade-mask`, a table scroller.
- **Every turn:** `data-talvt-turn-state=complete`.
- **Expected false positives of the guard on settled answers:** 0 of 101.

### Why not the text-length signal (2)

The ratio is lean text length over roughly stripped markdown length, whitespace removed.

- **It can't be computed for 76 of 101 turns:** The long prose chat's turn keys don't match its user message IDs, so `texts[...]` is empty.
- **It would also skip the case we're fixing:**
  - An answer that just streamed isn't in Butter's conversation data yet; the send event adds only the question.
  - Chats with attachments (including the user's ATS chat) never reach `rows`, because of `unsupported-media-or-citations`.
- **Where it can be computed (25 turns):**

  | min | p10 | median | max | under 0.70 | under 0.80 |
  |---:|---:|---:|---:|---:|---:|
  | 0.67 | 0.95 | 1.00 | 1.02 | 1 | 2 |

  A 60–70 % threshold would already reject a settled answer (ATS `<id>`, ratio 0.67). It has no safety margin.

### Height signal (3): not added; data for the lead

The gap from the last markdown item's bottom to the row's bottom was **exactly 44 px on all 101 settled turns** (the action bar). So a check like "row bottom more than about 250 px below the last item" would be a clean backstop on these chats.

I did not add it, for two reasons:
- **It may never fire.** I couldn't confirm that a partial snapshot has a tall row: that needs a live stream, and sending is forbidden. If the row grows with the revealed text, the gap stays 44 px and the check is dead code.
- **It risks false positives.** Answers with non-markdown content after the text (generated images, widgets, source carousels) would trip it, and none of those were in the sample.

## Diff summary (my part)

Another task (`butter-wheel-fix`) edited the same worktree at the same time: idle/scroll-gated measuring, a `stale` set, `needed()`, and 6 tests. Those hunks are not mine, and I left them alone. `git diff` now shows both tasks' changes together.

- **`extension/seek/layout-cache-main.js`:**
  - New `revealing(t)`: `t.querySelector('[class*="AdaptiveStreaming"]')` (survives hash changes).
  - In `record()`, a complete turn that is still revealing is not measured. Its snapshot carries `revealing: true`.
  - On a `'revealing'` rejection, the turn is queued once more 500 ms later (`recheck` WeakSet).
    - **Why:** the class removal isn't observed (the MutationObserver only filters `data-talvt-turn-state` and `data-math-source`).
    - An answer already fully revealed may not resize or mutate again, so without the retry the turn could stay unrecorded.
- **`extension/seek/core-main.js`:** `validateSnapshot` returns `'revealing'` right after `'incomplete'`. As with other rejections:
  - `mergeRecord` keeps the previous record;
  - a later settled snapshot replaces it.

  `math-height` stays as an extra check.
- **`docs/how-it-works.md`:** the recording rule now names the reveal state.
- **`test/height-cache-dom.test.js`:**
  - The fixture's `querySelector` answers the `AdaptiveStreaming` selector from `c.revealing`.
  - New test: a partial snapshot with a 1,500 px row and one paragraph is not recorded (`rejected.revealing = 1`). After the reveal ends, the settled snapshot with both paragraphs is recorded (blocks `[52, 1250]`).
- **`test/seek-fallback.test.js`:** new core test. A partial snapshot gets `'revealing'` and no entry. The settled snapshot is accepted and replaces the rejected state. A later revealing snapshot keeps the settled entry.

## Test output

**Red:** the final tests, run against a copy of the tree with the guard removed (`(not archived)`):

```
✖ an answer ChatGPT is still revealing is not recorded until it settles
✖ a snapshot taken while ChatGPT reveals the answer is never authoritative
ℹ tests 20  ℹ pass 18  ℹ fail 2
  (DOM test: actual is a recorded entry with blocks [52], expected null;
   core test: actual null, expected 'revealing')
```

The "settled snapshot is accepted" assertion passes on its own even before the change, because the old code accepted everything. It runs inside these tests, after the assertions that fail.

**Green:** the current tree, including the other task's concurrent edits:

```
node --test            → tests 175, pass 175, fail 0   (167 + 2 mine + 6 from the concurrent task)
npm run format:check   → All matched files use Prettier code style!
python3 scripts/check-version.py → OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
git diff --check       → clean
```

`docs/how-it-works.md` isn't covered by `format:check`. Prettier already flagged it at HEAD.

**Incidental finding:** `core.mergeRecord(null, snap)` throws when `snap.conv` is undefined, because `prev?.conv === snap.conv` is true for `undefined === undefined`. The recorder always sets `conv`, so only tests can hit this. My test passes a `conv`, and I didn't change it.

## Lab

- **Lock:**
  - Acquired atomically via `acquire-lock.py` at 23:57 (owner `butter-partial-guard-3040759-…`), after waiting about an hour behind `butter-wheel-local-…`.
  - Released with `rm -r` at 00:09. The lock that exists now belongs to `butter-wheel-fix-3151775-…`.
- **Probes:** `probe.mjs`, `list.mjs`.
  - A route guard aborted every non-GET request.
  - Only GETs were made: `/api/auth/session`, `/backend-api/conversation(s)`.
  - Nothing was typed or sent.
  - Raw data: `probe-{ats,fixture,psd,outlook}.json`, `conv-*.json`.
  - A fifth probe ("<prompt text>") timed out waiting for the thread to load. It isn't counted.
- **Restored:**
  - Chromium was never restarted. It still runs with `--load-extension=~/snap/chromium/common/butter-blank-head` and no `--enable-features`.
  - The tab is `<chat>`, the composer is empty (`""`), and 1 page is open.

## Not verified

The live moment of a reveal can't be produced without sending a message. The class-presence logic comes from ChatGPT's source; the lab confirms only the settled side (no false positives).

Two unknowns remain:
- **Does `isStreaming` stay true unusually long after a live stream?** If it does, the newest answer stays unrecorded until it settles or remounts. The preview then falls back to the estimate for that answer, which is the intended safe direction.
- **Reduced motion or a hidden tab:** with reduced motion, `d` is false, so ChatGPT never reveals partially and nothing is rejected. With the tab hidden, the class can be present while the full text is drawn, so the guard rejects conservatively and the 500 ms recheck retries.
