# Veil acceptance, stage D3: what `window.find` pays on held blocks, and the stored-layout check (#177), 2026-11-25

**Questions.**

1. Stage D ([summary](../stage-D/summary.md)) found the veil's (`e5f480e`) first `window.find` on a held block
   at 930–948 ms, against 96–104 ms on head (`547fa0a`, `main` before the veil). Its second call took
   241–251 against 82–84 ms, and its third was equal. Is the veil's extra time the deferred first style and
   layout of held blocks (and their fonts) that the [u2 trace](../u2-trace/report.md) found after a jump, or
   something else? This part is diagnosis only.
2. The spec's stored-layout check: after a stored layout is restored on the veil build, do 0 answer blocks
   compute opacity 0? And are the stored options put back exactly as found?

**Answers.**

1. **Yes: the veil's extra time is deferred first layout of the held blocks, then a font relayout.** The text
   search itself costs the same on both builds.
   - **First call:** the veil's call holds one `Layout` of **1,359.9 ms**, against **101.8 ms** on head. It
     adds **36,222** layout objects (head 2,067) and makes **27,819** style resolutions (head 1,945). Chromium
     unlocks and lays out every veiled block that the search walks through. The veil's call starts with
     **9,463** layout objects, head's with **43,053**: the veil had never laid out about 33,600 objects of the
     answer that head laid out at completion.
   - **Fonts:** the same layout first needs three math web fonts (woff2, VeryHigh priority, not from cache).
     The call requests them 855–1,139 ms in. It does not wait for them: they arrive 32–129 ms after the call
     returns. Their arrival brings 8,001 "Fonts" style invalidations (MathML and KaTeX) and 134 "Fonts changed"
     layout invalidations. Head's trace has no font load and no font invalidation at all.
   - **Second call:** it holds a **205.8 ms** `Layout` (687 dirty roots, 5,922 style resolutions, 0 objects
     added). Head's is 6.7 ms (102 roots, 68 resolutions). Nothing new is added, and the fonts invalidated
     the math the first call laid out. So this is the font relayout of the off-screen blocks, deferred until
     the next forced update. The trace does not label a dirty root by its cause, so that link is inferred,
     not shown.
   - **Third call:** 2.0 ms of layout on veil, 2.3 ms on head.
   - **What is not layout:** the time outside `Layout` is the same on both builds, 85–96 ms per call.
   - **Nothing else:** inside any call, no other event reaches 5 ms on either build.
2. **0 answer blocks computed opacity 0 after a restored layout** (0 of 175 samples, 8 turns restored), and
   the options were put back exactly as found in all 3 loads. Four caveats:
   - **Restore never ran by itself.** On this ChatGPT the stored layout was never restored on its own. In
     two loads, 1 and 6 rows were stored, and after the reload there were 0 restores and 0 misses. The cache
     restores only when ChatGPT reads `clientWidth` on a user bubble's text, and the page no longer makes that
     read. The third load made that read from the harness, so Butter's own `restore()` ran on the real stored
     records. The veil does not touch this path (`seek/` and `storage/` are the same in both builds), so this
     is a finding about the stored-layout feature on `main`, not about the veil.
   - **The veil attribute appeared briefly.** In 8 samples a just-restored block carried `data-butter-veil`
     and still computed opacity 1, and the next sample no longer had it. That is the spec's stylesheet guard
     at work: outside a streaming turn, opacity 0 also needs `data-butter-unrendered`. The script's own
     stricter check, `stored-layout-cv-not-veiled`, fails on the attribute alone.
   - **Small coverage.** At most 1 restored turn and 1 restored block were mounted in any sample.
   - **Part of the chat only.** The pass after the reload covered scrollTop 50,607–67,696 of a chat about
     68,600 px tall, not all of it.

Commands are in [commands.md](commands.md). The tables below come from [find-calls.jsonl](find-calls.jsonl)
(made by [trace-find.py](trace-find.py)) and [stored-layout.jsonl](stored-layout.jsonl). The per-run lines
are in the `*.log` files. Raw traces and run JSON stay local, in
`~/.local/share/chatgpt-lab/captures/veil-accept/stage-D3/`.

## Part 1: one traced pair (head, veil)

- **Settings:** stage D's `ats12 PHASES=stream UX=u4 U4_FINDS=3 OPTS={"rail":true,"bookmark":true}`, with
  these added:
  - `TRACE_AT=124600 TRACE_SPAN=14000`, with u2-trace's `TRACE_CATS` (invalidation tracking, frame, V8 CPU
    profiler);
  - `TAIL_MS=30000`, because the harness starts and stops a trace only while it ticks, and by default it
    stops ticking 5 s after completion, before u4 starts at about +16.5 s.
- **Locating the calls:** the probe now records each `window.find` call's start in page time (`at`, a
  one-line change to `lab/harness/stream-ux-probe.mjs`). `trace-find.py` cuts the trace at `[at, at + ms]`
  through the `lab-trace-start` mark. All 6 calls fell inside the traces, which started 120.3–120.5 s after
  Enter.
- **Same blocks as stage D:** 429, 440 and 450, with flags 15 on veil and 12 on head. Every call found and
  selected its text inside the block. Both runs exited 0: veil 13 PASS, head 12 PASS, 0 FAIL.
- **Tracing slows both builds:** head's first call took 195.7 ms (untraced in stage D: 96–104 ms), and the
  veil's took 1,460.2 ms (930–948 ms). The traced gap (+1,264 ms) is larger than stage D's (+835 ms), most
  likely because invalidation tracking emits one event for each of the 36,222 added objects. The pattern
  over the three calls is the same as stage D's.

### Per call

"Layout" lists each `Layout` event as dirty/total objects at its start, with its ms. "Resolve" counts
`StyleResolver::ResolveStyle`, "added" counts "Added to layout" invalidations, and "DisplayLock" counts
style invalidations of that kind. Style passes (`UpdateLayoutTree`) were 0.2–0.4 ms in every call: the style
work runs inside `Layout`, as Chromium unlocks each `content-visibility: auto` subtree.

| Build | Call | Block | ms | Layout (dirty/total, ms) | Layout ms | Resolve | Added | DisplayLock | Font loads | Not layout (ms) |
|---|---|---:|---:|---|---:|---:|---:|---:|---|---:|
| head | first | 429 | 195.7 | 62/43,053 101.8; 53/45,119 2.3; 39/45,119 2.2 | 106.3 | 1,945 | 2,067 | 6 | none | 89.4 |
| head | later 1 | 440 | 95.5 | 102/45,119 6.7; 39/45,119 2.3 | 9.0 | 68 | 0 | 67 | none | 86.5 |
| head | later 2 | 450 | 89.1 | 39/45,119 2.3 | 2.3 | 1 | 0 | 2 | none | 86.8 |
| veil | first | 429 | **1,460.2** | **626/9,463 1,359.9**; 53/45,119 2.1; 39/45,119 2.1 | **1,364.1** | **27,819** | **36,222** | 570 | 3 begun at +855.0, +930.7, +1,138.9 ms; all arrive after the call (+1,492.6, +1,493.2, +1,589.1) | 96.1 |
| veil | later 1 | 440 | **299.8** | **687/45,119 205.8**; 39/45,119 2.1 | **207.9** | **5,922** | 0 | 321 | none | 91.9 |
| veil | later 2 | 450 | 86.8 | 39/45,119 2.0 | 2.0 | 1 | 0 | 2 | none | 84.8 |

- **The objects added in the veil's first call** are KaTeX and MathML: `SPAN` 21,374, text 7,897, `mn` 1,200,
  `mo` 1,106, `mi` 901, `mrow` 679, `mstyle` 422, `mtd` 412. The call also removes 566 objects from layout.
  The objects head adds in its first call are of the same kinds, 2,067 in total. Some held blocks were never
  laid out on head either, but about 17 times fewer.
- **The object totals:** the veil's first layout starts at 9,463 objects, and the next one at 45,119, which
  is head's count after its own first call. The u2 trace showed the same jump (6,901 against 8,986 there).
- **CPU profile:** almost every sample inside a call is in the native `find` (veil 9,174 of 9,486 samples
  in the first call; head 1,255 of 1,283). The veil's first call also has 301 samples (about 46 ms) in the
  probe's `U.u4` frame (head 25). No trace event other than `Layout` accounts for them, and nothing else
  reached 5 ms.
- **Fonts:** the font requests are hashed CDN paths. The trace names no family, and nothing beyond the type,
  priority and cache state is kept here. As in the u2 trace, they are math faces that the newly laid-out
  math was the first to need.

### Between the first and the second call (veil)

- **Fonts arrive:** 32.4, 33.0 and 128.9 ms after the first call returns.
- **Invalidations:** 8,001 "Fonts" style invalidations and 134 "Fonts changed" layout invalidations follow.
- **Frames:** the next frames restyle for 79.0 ms (1,044 elements), 40.1 ms (1,045) and 15.9 ms (404). Their
  layouts stay under 1.7 ms: the invalidated blocks are off-screen and locked, so their relayout waits for
  the next forced update, which is the second `window.find`.
- **Head:** no font event and no "Fonts" invalidation in the whole trace, and 1.1–1.5 ms layouts between
  calls.

So the veil moves two costs that head pays at completion to the first `window.find` calls on the held
blocks: their first style and layout, and the relayout that the math fonts force. This is the same
mechanism as the u2 reveal gap. Because `window.find` lays out every veiled block it searches through, not
only the blocks coming into view, the bill here is larger: about 1.3 s traced, against 0.1 s for a u2 jump.

## Part 2: the stored-layout check (veil, `math12`)

The script is stage D's [stored-layout-check.mjs](stored-layout-check.mjs), copied here and fixed before
its first run:

- **(a) No database created by the row count.** It counted rows with `indexedDB.open('butter-layouts-v1')`
  and no version. If the database was missing, that open would create an empty version-1 database, and the
  worker's version-2 upgrade would then skip creating `geometry`. The count now aborts that upgrade.
- **(b) Stop when rows exist.** It stops before changing anything when the store already has rows, because
  turning layouts off clears them all.
- **(c) Put-back order.** Writing `butter` back can start another clear, which writes `butterLayoutCleared`.
  The put-back now waits for that to settle before it writes `butterLayoutCleared` back.

After the first live run it gained (d) count-only diagnostics, (e) an upward pass after the reload, and
(f) `TRIGGER=1`, below.

| Run | Rows stored on first load | Samples after reload (load / pass) | Restored turns / blocks | Restore misses | Most answer blocks at opacity 0 | Most `data-butter-veil` / rendered veiled | Most inline-cv turns / blocks | Options put back |
|---|---:|---|---|---|---:|---|---|---|
| `veil-stored-layout` | 0 → 1 | 26 (24 / 1) | 0 / 0 | none | 0 | 0 / 0 | 0 / 0 | same as found, rows 0 |
| `veil-stored-layout-2` | 0 → 6 | 175 (24 / 150) | 0 / 0 | none | 0 | 0 / 0 | 0 / 0 | same as found, rows 0 |
| `veil-stored-layout-3` (`TRIGGER=1`) | 0 → 2 | 175 (24 / 150) | **8 / 8** | `no-entry` 174, `not-removed` 608 | **0** | 1 / 0 | 1 / 1 | same as found, rows 0 |

- **What was found and put back:** each run found `butter` absent, `butterLayoutCleared` absent and 0 rows.
  Each turned layouts on (`opts.layout`, `layoutConsent: granted`, rail and bookmark on). After the check it
  turned layouts off, so the worker cleared the rows, then removed both keys again. The end state equals the
  found state each time (`stored-layout-opts-put-back` PASS). The database's internal generation counter
  advanced with each clear, which is not a stored option.
- **Run 1: no restore.** Its pass jumped to the top, the page put the view back at the end (scrollTop
  117,911), and the pass stopped after one step. There was no restore at all.
- **Run 2: why there was no restore.** After the reload the persistence layer was ready and had read the 6
  rows (`entries` 6, `errors` 0). The cache counted 0 restores and 0 misses with 6 restore-hook targets in
  the page and `data-butter-off` absent, so `restore()` never ran. Its only caller is the `clientWidth`
  getter hook in `seek/layout-cache-main.js`. That hook calls `restore()` when the read is on an element in
  a user bubble whose first child is `.text-size-chat`, and ChatGPT made no such read during the load or the
  150-step pass (`hooks` 31 at load end, 73 at pass end).
- **Run 3: forcing the restore.** With `TRIGGER=1` the harness makes that read before each sample, so
  Butter's `restore()` ran. The restored turns are turns that remount as the view moves: 8 restores, each
  of 1 turn with 1 block. Those turns and blocks got inline `content-visibility: auto` with their stored
  sizes. In each of the 8 samples that came right after a restore, the restored block carried
  `data-butter-veil`, outside any streaming turn and with no `data-butter-unrendered`, and computed
  opacity 1. The veil check counted 0 rendered veiled blocks. The next sample had no veiled block.
- **The pass covered only part of the chat:** scrollTop 50,607–67,696 of a chat about 68,600 px tall. The
  page moved the view back down several times during it.

| Rule (#170) | Measured | Result |
|---|---|---|
| 0 answer blocks compute opacity 0 after a stored layout is restored | 0 of 175 samples, with 8 turns restored (run 3); 0 in runs 1–2, where nothing was restored | **PASS**, restore forced by the harness |
| Stored options put back exactly as found | `butter` and `butterLayoutCleared` absent before and after, rows 0, in all 3 runs | **PASS** |

The script's own verdicts in run 3:

- `stored-layout-restored`, `stored-layout-none-opacity0` and `stored-layout-opts-put-back`: PASS.
- `stored-layout-cv-not-veiled`: FAIL ("inline-cv blocks veiled 1, at opacity 0 0"). It checks the attribute,
  which is stricter than the spec's rule. Runs 1 and 2 FAIL `stored-layout-restored`, because nothing was
  restored.

## Budget

- **5 harness runs:** 2 traced u4 runs and 3 stored-layout loads.
- **Time:** 15 min 53 s from lock (22:55:30Z) to release (23:11:23Z), on lab 2 with the perf lock. Lab 2
  has both `ats12` and `math12`, so one lock covered both parts.
- **Budget limit:** the run budget is spent, so a load without the harness's read on head, and a
  whole-chat pass, were not run.

## Not done

- **The real find bar:** not measured. The spec asks for it before judging the `window.find` gap.
- **Head stored-layout load:** not run. It would show that stored layouts are not restored there either. The
  code is the same in both builds, so the expectation is the same.
