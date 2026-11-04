> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Seek preview capture: coverage after fast scrolls, long answers, fresh-formula inflation

2026-11-04. Repo `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`, HEAD `2bc372f`.

- Nothing was committed, pushed or version-bumped.
- The uncommitted changes from the three earlier tasks are kept (math-height, partial guard, wheel fix), except the wheel fix's scroll-quiet gate, which this task replaces.
- Lab2 only. Screenshots and raw data contain account UI and chat text; keep them private.

## Root causes and evidence

### 1. Coverage regression after a fast scroll
The wheel fix measured only after 250 ms without `scroll` or `wheel` events. A turn seen only while scrolling was cv-skipped by the time scrolling stopped, so its deferred measure was rejected as `skipped`. Its lab report has the evidence; this run reproduces it in the trial round.

### 2. Long answers never recorded (`zero-block`)
**Cause:** ChatGPT wraps widgets in long answers in a `<div class="contents">` with `display: contents`:
- in math9 Q6, a "learning block" card;
- in math9 Q1, a horizontal card row.

The div is a direct child of the markdown root, so it counts as a block. It has no box, so the ResizeObserver never reports a size. `contentH.get(b) ?? 0` is therefore 0, and every snapshot of that turn is rejected as `zero-block`. Nothing re-queues the turn afterwards.

**Evidence:**
- **The diagnostic build** (`raw/zero-dbg-math9.json`, `raw/contents-math9.json`, `h/zero.mjs`, `h/contents.mjs`): the only block without a size was `DIV.contents`, with `display: contents`, `rectH: 0` and observed `null`. It is registered and observed, but never notified.
- **Earlier send logs:** HEAD fresh Q1 (`<id>`) logged `zero-block 4` and then nothing more. That turn holds the card-row `contents` div.
- **Ruled out:**
  - **The 200-entry style cap:** it only affects style reuse.
  - **ResizeObserver registration:** the block was registered.
  - **cv skipping:** skipped blocks report their remembered size or 120 px, never 0.

### 3. Inflated first record for fresh answers (152 px)
**Cause:** $152 = 120 + 2 \cdot 16$ px. That is Butter's `contain-intrinsic-size: auto 120px` placeholder plus the display span's `padding-block: 16px`.

The chain:
1. ChatGPT does not scroll with a streaming answer. After the send, the page stayed at `scrollTop` 0, so most of a long answer arrives below the fold.
2. `containment.css` skips blocks of an in-progress answer at once, before they ever render.
3. `offscreen.js` saw the placeholder 120 > 0 from its ResizeObserver and marked them `data-butter-seen`.
4. So they stayed skipped at 120 px after the answer completed.

**Evidence:**
- **A never-rendered clone** of a display span (`raw/clone-placeholder.json`) measures 152.0 px. Its ResizeObserver reports 120, and `contentvisibilityautostatechange` fires with `skipped=true` at insertion.
- **The live send with the debug build** (`raw/fresh-dbg-t01.json`):
  - **At completion:** 318 of 507 blocks were unmarked, and 180 were at 152 px.
  - **0.6 s later:** all were marked, and the first record had 180 items at exactly 152 px.
  - **11 minutes later:** still 180 at 152 px, because nothing scrolled there.

  So the inflation is not a 3 s transient: it lasts until the user scrolls to those blocks. In the earlier report, the "re-measure after 3 s" was the drag harness scrolling there.
- **The HEAD send** (`raw/fresh-on-t01.json`): 193 live blocks at 152 px after completion, and no record at all (`zero-block` 5).

## Design
1. **No scroll-quiet gate; idle slices** (`layout-cache-main.js`).
   - Every queued turn is measured in `requestIdleCallback` only.
   - A measure is a job:
     - `begin` makes the cheap checks and collects the item list;
     - `step` reads 24 items per slice while `deadline.timeRemaining() > 1` ms;
     - `finish` validates and merges.
   - A job is dropped when its turn is skipped or disconnected; the existing reveal rule re-queues it.
   - A job restarts when the turn is queued again mid-job, tracked by a per-turn change counter.
   - Item tops are taken relative to the row rect, which is re-read on each slice, so slices stay consistent.
   - A seek press (`prepare`) and `flushMeasurements` still finish everything synchronously.
   - The `scroll` and `wheel` listeners are removed.
2. **Unchanged recorded turns stay unmeasured.**
   - The O(1) reveal rule is kept.
   - **New adoption rule:** a remounted element for a recorded message reuses the record without measuring when all of these match the record:
     - message id;
     - `innerWidth`;
     - turn content height (from ResizeObserver);
     - block count;
     - row height.

     It costs one `querySelector`, one `querySelectorAll` and one row rect.
3. **Box-less blocks.** A block or item whose rect is empty and which has no client rects (`display: contents`) takes the union of its children's boxes, for both its block size and its item geometry.
4. **Placeholders are never marked and never recorded.**
   - **`offscreen.js`** tracks `contentvisibilityautostatechange`. A block that is skipped at flush time is not marked; it waits. It is re-observed when:
     - it un-skips (comes into view), or
     - its turn leaves `in_progress`, which needs a new attribute filter on `data-talvt-turn-state`. The streaming rule then no longer skips it, so it renders at its real size and is marked one second later.
   - **The layout cache** rejects a snapshot as the new reason `placeholder` when a block is skipped, unmarked and still has `content-visibility: auto`. Blocks that `restore()` sized from a record are exempt. A stale entry from a skipped set is cleared through `getComputedStyle`.

## Diff summary
`git diff --stat` for this task plus the earlier ones: 7 files, +854 −93, and a new `test/offscreen.test.js`. The full diff is in `builds/final-tree.diff`.

- **`extension/seek/layout-cache-main.js`:**
  - `record`, `measure`, `flush`, `QUIET` and the scroll listeners are replaced by `schedule`, `work`, `run`, `begin`, `step`, `finish`, `adopt`, `box`, `boxless`, `placeholder` and `reject`;
  - new `changes` WeakMap;
  - `applied` is moved up;
  - new stat `adopted`.
- **`extension/seek/core-main.js`:** `validateSnapshot` returns `'placeholder'`, and its comment says so.
- **`extension/stream/offscreen.js`:** new `skipped` and `waiting` sets, a cv listener, completion handling in the MutationObserver, and `waiting` cleared when cv is switched off.
- **`docs/how-it-works.md`:** the recording paragraph covers placeholders, `display: contents`, idle slices and adoption; the table row for `offscreen.js` says when blocks are marked.
- **Tests:**
  - **`test/height-cache-dom.test.js`:** 8 new tests. The two scroll-quiet tests are replaced: the gate is gone, and the seek-press test now waits for idle time.
  - **`test/seek-fallback.test.js`:** 1 new core test.
  - **`test/offscreen.test.js`:** new, 3 tests.

## Tests
**Red:** the new tests run against a copy of HEAD plus the starting working tree (`test-red.txt`, `red-start/`): 33 tests, 24 pass, 9 fail.
```
✖ a turn first seen while the page scrolls is recorded in idle slices while it is rendered
✖ a turn that is skipped part-way through its measure stops being read
✖ a remounted copy of a recorded, unchanged turn adopts its record without measuring
✖ a widget block with no box of its own gets its children's size
✖ a block skipped before it ever rendered is not recorded at its placeholder size
✖ a snapshot holding a never-rendered placeholder block is not authoritative
✖ a streamed block skipped before it rendered is not marked at its placeholder size
✖ a skipped streamed block is marked once it comes into view and renders
✖ the seek preview press measures turns still waiting for idle time
```
These guard tests pass both before and after: changed part-way, remounted with a changed size, skipped but marked, and a rendered block marked.

**Green** (`test-green.txt`):
- `node --test` reports 188 tests: 188 pass, 0 fail.
- `npm run format:check` reports "All matched files use Prettier code style!".
- `python3 scripts/check-version.py` reports "OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree."
- `git diff --check` is clean.

## Lab: wheel jank and coverage
**Harness:** the wheel-fix harness adapted to lab2 (`wheel.mjs`, `phase.sh`, `frames.py`, `summarize.py`), with the same `sequence.json`.
- **Fixture:** math12 (12 questions); window 1440×1000; CDP 9223.
- **Runs:** a fresh browser session per run, arms interleaved and rotated, n = 5 each.
- **Settings:** all Butter options at their defaults (storage holds only `layoutConsent: granted`), with `older` on. There were **0 × 429s** in every run, so no fallback was needed.
- **Arms:**
  - `on`: HEAD `2bc372f`, from `git archive`;
  - `final`: this tree. The `sha256` lists are in `builds/`.
- **Trial round:** round 0, excluded from the table. Every run held 12 entries.

Median [min–max]:

| metric | none | on (HEAD) | final |
|---|---|---|---|
| frames > 6.06 ms % | 22.1 [20.7–23.2] | 29.4 [28.2–29.9] | 23.8 [23.0–25.4] |
| frames > 8.3 ms % | 22.1 [20.7–23.1] | 27.5 [25.5–27.9] | 22.4 [20.9–23.6] |
| frames > 16.7 ms % | 16.5 [15.3–17.0] | 19.8 [18.4–20.8] | **10.2** [9.6–11.4] |
| dropped (> 2× median) | 9 [8–11] | 23 [21–26] | 17 [15–20] |
| script per frame p95 ms | 1.1 [1.0–1.2] | 18.0 [17.4–18.2] | **1.5** [1.5–1.8] |
| layout-cache JS per burst ms | 0 | 683.7 [544.0–705.6] | **4.5** [4.3–4.7] |
| all extension JS per burst ms | 0 | 687.1 [547.6–709.0] | 12.7 [12.4–12.9] |
| records made during burst | – | 39 [32–42] | 0 [0–0] |
| records counter since load | – | 176 [168–177] | 8 [7–10] |
| valid records after reader pass | – | 5 [5–6] | 7 [6–8] |
| mounted turns covered after reader pass | – | 3/5 | 5/5 [4–5] |
| valid records after burst + 2 s | – | 5 [5–6] | 7 [6–8] |
| mounted turns covered after burst | – | 3/5 | 5/5 [4–5] |
| turns seen during burst, covered | – | 1/1 | 1/1 |
| LayoutCount | 0 | 44 [40–48] | 49 [47–50] |
| rAF p95 ms | 33.3 | 49.9 [33.4–50.0] | 33.4 |

The full table is in `table.md` and `logs/summary.txt`.

**Frames:**
- **Against HEAD:** the final build is better on every frame metric.
- **Against no extension:**
  - **better** on frames over 16.7 ms (10.2 % against 16.5 %);
  - **worse** on dropped frames (17 against 9) and slightly worse on frames over 6.06 ms.

  It is not better than none on every metric, unlike the earlier lab1 measurement of the wheel fix.

**Long tasks:**
- `final-r4` and `final-r5` each had one trace long task of about 235–239 ms.
- Extension JS in those runs was 12–13 ms per burst, so it is not the extension.
- The layout cache made 0 records during every burst.

**Extension JS cost:**
- 4.5 ms of layout-cache JS per burst, about 1,028 calls: the O(1) cv listener.
- About 4.4 ms of `offscreen.js` JS, now also listening for cv events.

**Coverage:** the final build covers all mounted turns; HEAD covers 3 of 5.
- **HEAD:** its 5 valid records are short, because math12 has `display: contents` turns that HEAD can never record.
- **Seen turns:** the metric is weak on this fixture. Its turns are about 30k px tall, so the burst brings only 1 new turn into view.

**Functional walk with the final build** (`raw/walk-final-*.json`): load the fixture, then rest 1.5 s per 0.9 viewport from top to bottom.

| fixture | turns recorded | `zero-block` | items at 152 px |
|---|---|---|---|
| math9 | 9/9, including Q1 `<id>`, Q5 `<id>` and Q6 `<id>` | 0 | 0 |
| math12 | 12/12, including the long Q2 (27.8k characters) and Q8 (30.1k characters) | 0 | 0 |
| ats12 | 12/12 (6 adopted remounts) | 0 | 0 |

**Largest single measuring step:** `recordMax` was 49 ms on math9 and 69 ms on math12, and 91.6 ms in a wheel run's load phase. That is `begin` plus a forced layout: the cheap checks and `querySelectorAll` are not sliced. This happens only while loading or opening a chat, never during the measured bursts.

## Lab: the drag preview on long answers
- **Script:** `h/drag.mjs` holds the native thumb and steers until the `butter-seek-state` event reports the target question.
- **Holds:** 5, none showing "Preview text unavailable", and `unseen` was false in each (the question had recorded layout).

| hold | visible items | visible text (characters) |
|---|---|---|
| math9 Q1 | 16 | 571 |
| math9 Q5 | 20 | 289 |
| math9 Q6 | 19 | 508 |
| math12 Q2 | 18 | 431 |
| math12 Q8 | 17 | 381 |

- **Screenshots** (private): `shots/final-math9-q{1,5,6}.png`, `shots/final-math12-q{2,8}.png`. In `final-math9-q6.png`, the preview shows the answer's text and TeX lines with the "Question 6 of 9" card.

## Lab: fresh answers
Each send is the <prompt text> fixture's t01 question, in a new chat in project "<project>", with no scrolling (`h/fresh.mjs`).

| build | first record after completion | 152 px items in record | live 152 px blocks after 15 s | records | long tasks ±3 s of completion |
|---|---|---|---|---|---|
| debug (start tree) | 0.6 s | 180 | 180 (still 180 after 11 min) | 1 (inflated) | not recorded |
| on (HEAD) | none | – | 193 | 0 (`zero-block` 5) | 2,178 ms total, max 486 ms |
| final | 0.5 s | **0** | **0** | 1 (h 28,783 px) | 2,095 ms total, max 706 ms |

**What the final run shows:**
- **Placeholders replaced:** at completion, 538 of 546 blocks were unmarked, and 0.5 s later only 2. The placeholder blocks rendered and were measured at their real size; the first record had no 152 px items.
- **The long task at completion:** a 706 ms task ran at completion in the final run. HEAD's run had 453 and 486 ms tasks at the same point, and about the same total, so it looks like ChatGPT's own completion work.
- **One cost my change may add:** at completion, the blocks of the answer that never rendered now lay out once. With n = 1 per build I can't separate that cost from ChatGPT's own completion work.

## Messages sent
**3 of 6**, listed in `sends.jsonl`. All were sent in lab2, in new chats inside project "<prompt text>", as the fixture's t01 question:
1. `dbg-t01`, 07:33 UTC: `<chat>`
2. `final-t01`, 08:45 UTC: `…<chat>`
3. `on-t01`, 08:47 UTC: `…<chat>`

There were no 429s and no usage-cap text. Nothing in lab1 was touched. Apart from the sends, every connection used `L.sendGuard`, and there were no other API writes.

## Lab restored and locks released
- **`lab-restore` on its first real run:** it worked unchanged, so it needed no fix (`logs/restore.log`).
  - It saw `butter-capture-on` loaded and restarted the browser with no extension and no flags.
  - It left one tab at `<chat>` with the composer `""` and returned `ok: true`.
- **Locks:** `lab-lock release --lab 2 --owner butter-capture-fix` released the lab and perf locks. `lab-lock status` shows lab1, lab2 and perf all free.
- **Lock holds:** lab2 07:2x–08:13, then lab2 + perf 08:13–08:49.
- **Leftovers:**
  - **Staged copies:** `~/snap/chromium/common/butter-capture-{on,final,dbg}`, left for inspection; they can be removed.
  - **Extension storage:** in the lab2 profile, each build's storage holds `layoutConsent: granted` and may hold layout-worker rows. It is inert while those builds are unloaded.
- No `pgrep -f` was used.

## Files
- **Harness:**
  - lab2 tools: `h/common.mjs`, `zero.mjs`, `contents.mjs`, `cost.mjs`, `clone.mjs`, `fresh.mjs`, `walk.mjs`, `open.mjs`, `drag.mjs`, `peek.mjs`, `top.mjs`;
  - the adapted wheel benchmark: `wheel.mjs`, `phase.sh`, `frames.py`, `summarize.py`.
- **Data:** `raw/*.json`, `traces/*.json.gz`, `frames.json`, `results.json`, `table.md`, `logs/`.
- **Builds:** `builds/` (diffs, `sha256` lists).
- **Tests:** `test-red.txt`, `test-green.txt`.
- **Screenshots** (private): `shots/`.
