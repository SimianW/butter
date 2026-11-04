> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter: the layout-cache re-measure no longer runs while you wheel-scroll (fix and lab re-measure)

2026-11-04, repo `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`, HEAD `2bc372f`.
Not committed and no version bump. The working tree also holds `butter-partial-guard`'s uncommitted changes. I left them as they were.

## Verdict
On the same fast local wheel burst, the fixed build now scrolls **better than no extension**. With the final tree:
- frames over 16.7 ms: **5.7 %**, against 18.8 % for HEAD and 15.2 % for none;
- dropped frames: **14**, against 21.5 and 16;
- script per frame at p95: **1.9 ms**, against 18.6 and 1.4.

The burst does **0** layout-cache records, against 37–40 on HEAD. Layout-cache JS falls from about 680 ms to about 5 ms per burst.

**The trade-off:** a turn only seen *during* scrolling is not measured until it is seen at rest. The middle turn was recorded and preview-ready in every run, but fewer turns hold a record overall (details below).

## Design and why
1. **No redundant re-measure on reveal.** `contentvisibilityautostatechange` re-queues a turn only if it is `stale` or if `verified.get(turn) !== turns.get(key)`.
   - **Stale** means it was queued (by DOM change, ResizeObserver, resize or theme) and no record has succeeded since.
   - **The `verified` mismatch** means this element's last successful record was evicted or replaced, for example by an adopted storage record.
   - **Why that is enough:**
     - a message or block change is a mutation inside the turn;
     - a size change is a ResizeObserver entry;
     - a width or theme change runs `resetStyles`.
     All of these already mark the turn stale.
   - **Cost:** O(1), with no DOM access.
   - **Why not a DOM-based check:** my first version compared the record with the live turn through `matchesLive` (message, block count, `mathReady`, width). The lab caught it costing about 2 ms per event on a 625-block math turn, 1.7 s per burst, worse than HEAD (attempt 2 below). I removed that version and its `core-main.js` helper; `core-main.js` now carries only the other task's changes.
   - **Validation:** a skipped re-measure keeps the previous entry, which `validateSnapshot` already accepted. Nothing bypasses it, and every record still goes through `mergeRecord`.
2. **Measuring never runs while scrolling.**
   - `queue()` schedules `requestIdleCallback(flush, {timeout: 1000})`.
   - `flush()` measures only if 250 ms have passed since the last `scroll` or `wheel` event (passive capture listeners on `document`) and no seek drag is active. Otherwise a timer re-checks.
   - The seek preview's press-time `prepare()` first measures anything still pending. This happens at press time, which is not on a scroll frame.
3. **`restore()` honours `cv`.**
   - It does nothing when `data-butter-off` contains `cv`, or when Butter is disabled.
   - Turning cv off live strips the inline `content-visibility` and `contain-intrinsic-size` that restore set on mounted turns, using a MutationObserver on `data-butter-off` and `data-butter-disabled`.
   - Inline cv is not essential to correctness. It is only cv's remount optimisation, and `contain-intrinsic-size` does nothing without it.
4. **Optional gate (done):** `record()` measures nothing when `seek`, `cv` and `layout` are all off, or when Butter is disabled.
   - The gate needs all three off: restore (cv) also uses the records, and `layout` sits in `data-butter-off` whenever consent is pending or declined.
   - When the gate opens again, live turns are re-queued.
5. **Row observation (found in the lab).**
   - The record's `rowH` is the row's height. Without a re-measure on every reveal, the record went stale when the row grew outside `[data-turn-key]`: by 52 px, consistently, on turn `<id>`.
   - The ResizeObserver now also watches each turn's row. A remounted turn in a reused row takes that row over, and removal cleans it up.
   - **What the lab showed:** this queues the re-measure, but in `final-r3` that measure ran with the turn cv-skipped off-screen, was rejected as `skipped`, and the record stays stale until the turn is seen at rest. The preview's existing `|rowH − measured| ≤ 2` check rejects the stale layout, so that question previews from its start instead of drawing wrong geometry.

## Diff summary (my changes only)
- **`extension/seek/layout-cache-main.js`:**
  - new `stale` and `verified` state;
  - `offList`, `disabled`, `cvOff` and `needed` helpers;
  - the reveal check in the cv listener;
  - the `QUIET` scroll-quiet scheduler: `schedule`, `flush`, and `measure` (split from the old `flush`);
  - `record()` gated by `needed()`, and on success it clears `stale` and sets `verified`;
  - `restore()` gated by `cvOff()`;
  - `unrestore` plus a MutationObserver on the off attributes;
  - row observation in `watch()` and the removal loop;
  - `flushMeasurements` now calls `measure()`, and `prepare` measures pending turns.
  - The other task's `revealing` and `recheck` hunks in this file are untouched.
- **`extension/seek/core-main.js`:** no change of mine; the `matchesLive` helper I added was reverted.
- **`test/height-cache-dom.test.js`:** the fixture exposes `listeners`, plus the helpers `recorded`, `cvState` and `layoutReady`, and 9 new tests.
- **`docs/how-it-works.md`:** one paragraph extending the restore sentence: deferral, reveal rule, cv gate and the all-off gate.
- `git diff --stat`, including the other task's work: 6 files, +456 −36. The full tree diff is in `builds/final-tree.diff`.

## Tests
Red: the final test file run against a HEAD `2bc372f` copy of `extension/` (`test-red-head.txt`; the two formula and revealing failures are the other task's tests):
```
✖ a recorded turn coming back into view is not measured again
✔ a reveal event on a recorded turn makes no DOM query        (guard: fails on my first version, not on HEAD)
✔ a turn that changed while skipped is measured again once it is back in view   (guard)
✖ measuring waits until scrolling has been quiet
✖ restore leaves content-visibility alone when the cv setting is off
✖ nothing is measured while seek, cv and layout are all off
✖ the seek preview press measures turns still waiting for the scroll to settle
✖ a row that grows outside its turn gets the turn measured again
```
Before any code change, the first three required tests also failed on the working tree with the other task's changes (`test-red.txt`: 12 tests, 9 pass, 3 fail).

Green, final tree:
- `node --test` reports 177 tests: 177 pass, 0 fail (`test-green.txt`).
- `npm run format:check` reports "All matched files use Prettier code style!".
- `python3 scripts/check-version.py` reports "OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree."

## Lab
**Same as the earlier report:** wheel script `sequence.json`, fixture `<id>`, window 1440×1000, normal flags, CDP trace metrics, and `frames.py` for per-frame stats.

**Arms:**
- `none`: no extension;
- `on`: HEAD `2bc372f` `extension/`;
- `fixed`: the working tree at attempt 4, before row observation;
- `final`: the final working tree.

Each arm has its own staged copy and `sha256` list in `builds/`.

**Deviations, all applied to every extension arm alike:**
- **A fresh browser session per run, with arms interleaved and rotated.** I dropped warm-ups to reduce requests.
- **`older: false` in on, fixed and final.** With `older` on, ChatGPT answered `429 Too many requests` to the paginated `conversations/…?num_turns=10` fetch. The chat then stopped at 5–10 of 13 entries in every Butter run of attempt 3, while none always reached 13. `older` is unrelated to the layout cache. All other options were on, with layout consent granted.
- **The history-load loop also waits for 13 entries,** capped at 60 iterations.

**Excluded runs:** `on-r2` and `fixed-r2` loaded 5 and 10 entries, so n = 4 for those arms. `final` is a separate confirmation block of 3 runs, run right after the interleaved block.

Median [min–max]:

| metric | none (n=5) | on, HEAD (n=4) | fixed (n=4) | final (n=3) |
|---|---|---|---|---|
| frames > 6.06 ms (165 Hz) % | 24.0 [23.0–24.9] | 26.7 [26.2–27.5] | 23.8 [23.5–26.2] | 23.8 [23.3–24.6] |
| frames > 8.3 ms (120 Hz) % | 23.4 [20.9–23.7] | 26.2 [24.9–26.3] | 19.5 [18.8–20.8] | 19.1 [18.1–19.8] |
| frames > 16.7 ms (60 Hz) % | 15.2 [14.4–15.9] | 18.8 [18.0–20.1] | **6.6** [4.7–8.1] | **5.7** [4.4–7.0] |
| dropped (> 2× median) | 16.0 [15–20] | 21.5 [19–24] | **15.5** [14–17] | **14.0** [12–16] |
| script per frame p95 ms | 1.4 [1.3–1.9] | 18.6 [18.2–19.2] | **2.0** [1.8–2.3] | **1.9** [1.7–2.1] |
| frame work p95 ms | 29.8 | 24.6 | 17.3 | 17.2 |
| rendering per frame p95 ms | 28.9 | 15.8 | 15.7 | 15.8 |
| rAF p95 ms | 33.4 [33.3–33.4] | 41.7 [33.4–50.0] | 33.3 [33.3–33.4] | 33.3 [33.3–33.4] |
| LayoutCount | 0 | 45.5 [44–50] | 52.0 [50–56] | 53.0 [51–56] |
| LayoutDuration ms | 0 | 96.1 | 108.9 | 110.7 |
| ScriptDuration ms | 57.4 | 738.7 | 67.9 | 69.2 |
| extension FunctionCall ms (trace) | 0 | 683.9 | 0.0 | 0.0 |
| Paint ms (trace) | 444.0 | 171.8 | 173.4 | 174.8 |

**`LayoutCount` did not fall.** It is 52–53 against 45.5 on HEAD. The layouts in the burst are the browser's own cv relevance and lifecycle layouts, not forced ones. That matches the earlier no-flush probe, which measured 55 against 43. The cost was the script: 680 ms per burst becomes about 5 ms of layout-cache JS, plus about 1.5 ms in the `scrolled` listener (about 140 calls).

### Seek preview records
Data comes from `__heightCacheDump()` and `__butterLayoutCache.coverage()/get()` after the burst plus 2 s. Preview-ready means items are present and |rowH − live row| ≤ 2 px, the preview's own test.

| | records during burst | records total since load | mounted turns covered | middle turn `<id>` |
|---|---|---|---|---|
| on (HEAD) | 37–40 | about 176–201 | 5/5 | recorded, 654 items, preview-ready |
| fixed | 0 | 7–10 | 3–5/5 | recorded, preview-ready, every run |
| final | 0 | 6–10 | 4/5, 3/5, 5/5 | recorded, preview-ready, every run |

**The cost of the fix:** turns seen only during the reader pass (continuous wheel scrolling every 40 ms, never 250 ms quiet) are cv-skipped by the time scrolling stops. They get no record until seen at rest. 5–8 deferred measures per run were rejected as `skipped`. In the preview, such a question shows its unmeasured form: it starts at the question, with a fade. In normal reading with pauses, a turn gets measured when you stop on it.
- **If wider coverage matters,** a follow-up could measure one pending turn per long idle period while it is still unskipped near the viewport. I did not do this.
- **Inline cv:** `inlineCv` (inline `content-visibility` from restore) is 543–1646 with cv on. I did not run a cv-off arm this time. The cv behaviour is covered by the unit test and by `restore()`'s guard.

### Attempts (raw data kept)
1. **`failed-attempt1/`:** the fixture returned "Could not load this ChatGPT conversation" (429). Aborted and restored.
2. **`attempt2/`:** the first fixed version, with `matchesLive` on every reveal: 0 records, but 1.7 s of extension JS per burst, script p95 40 ms and 20.7 % frames over 16.7 ms, worse than HEAD. That led to the O(1) check. 6 of 15 runs had partial history.
3. **`attempt3/`:** all 10 Butter runs had partial history (the `older` 429). That led to `older: false`.
4. **`raw/`:** the interleaved none, on and fixed block of attempt 4. The T3 server restart killed it during `none-r5`. My lock was still held, so I ran `none-r5` and `on-r5` under it, then restored. `phase4-finish.log` has those two.
5. **`raw/final-r*`:** the final-tree confirmation.

## Lab restored and lock released
- **Each phase** took `lock.d` with an atomic `mkdir` and an owner token, then waited for `butter-partial-guard` the first time (released 05:09). The lock was held only while measuring.
- **Lock holds:**
  - 05:09:59–05:11:18;
  - 05:11:34–05:18:34 (the probe; restore waited for the 429 to lift);
  - 05:28:47–05:59:09;
  - 06:00:43–06:37:30;
  - attempt 4 from about 06:40, killed with the lock held, then finished and released at 07:05:41;
  - 07:07:4x–07:12:18.
- **Final state, from `restored-browser.json` and the logs:**
  - `LAB_EXTENSIONS=~/snap/chromium/common/butter-blank-head`;
  - the `--load-extension` flag points at blank-head;
  - normal flags, `--window-size=1600,1000`;
  - one tab at `<chat>`;
  - composer `""`.
- **The lock** was released by me (`rm -r` after an owner check). At write time, `lock.d` is absent or held by another task.
- **Nothing was sent.** Every non-GET request was aborted by the Playwright route, and there were no API writes. The probes only read page state and response statuses.
- **The staged copies** `~/snap/chromium/common/butter-wheel-fix-{on,fixed,final}` are left for the lead's inspection and can be removed.

## Files
- **Results:** `results.json`, `frames.json`, `table.md`, `logs/summary-final.txt`;
- **Per run:** `raw/*.json`, including `seekBefore`, `seekAtEnd` and `seekAfter`;
- **Traces:** `traces/*.json.gz`;
- **Logs:** `logs/phase*.log`;
- **Builds:** `builds/`;
- **Harness:** `wheel.mjs`, `phase.sh`, `phase-final.sh`, `frames.py`, `summarize.py`, `acquire.py`, `restore.mjs`, `probe*.mjs`;
- **Tests:** `test-red.txt`, `test-red-head.txt`, `test-green.txt`.
