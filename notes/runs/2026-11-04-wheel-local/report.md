> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter: local fast wheel scrolling, Butter off vs on (lab measurement)

Measured 2026-11-04 03:56–04:58 UTC, Xvfb lab, Chromium (snap), 60 Hz software display. Measurement only; no product code changed.

## Verdict

**Yes, local fast wheel scrolling is measurably worse with Butter on, and the cause is not `content-visibility` itself. It is `seek/layout-cache-main.js` re-recording turn geometry every time a block crosses the content-visibility relevance boundary.**

- **Butter on vs no extension, same burst:**
  - frames whose main-thread work exceeds 16.7 ms: **18.3 % vs 15.7 %**;
  - dropped rAF frames: **23 vs 17**, about +35 %;
  - rAF p95: **49.9 vs 33.4 ms**;
  - Butter's own script per frame at p95: **19.0 vs 1.9 ms**;
  - total script in the 6.3 s burst: **714 vs 63 ms**.
  - The master switch (`master-off`) brings everything back to the no-extension level: 15.3 %, 20 dropped, script 64 ms.
- **`content-visibility` makes rendering cheaper, not dearer.** Comparing on with none:
  - per-frame rendering p95 is **16.0 vs 28.6 ms**;
  - Paint is **160 vs 459 ms**.
  - The lead's hypothesis is wrong in its mechanism, but `cv` is the trigger: `stream/containment.css` makes blocks fire `contentvisibilityautostatechange`.
- **The isolating arm** is a lab-only probe, identical to the product except that the layout-cache `flush()` drops its batch. On vs no-flush, otherwise identical, with `cv` on:
  - frames > 16.7 ms: **17.4 % → 7.3 %**;
  - dropped frames: **25 → 11**;
  - script p95 per frame: **19.9 → 2.1 ms**;
  - extension JS: **697 → 0 ms**.
  - With the flush gone, Butter on scrolls better than no extension: **7.3 % vs 15.7 %** of frames over 16.7 ms.
- **Product arm `cv-off`** gives the same improvement, at 8.1 % and 6 dropped, because without the `cv` CSS the state-change events stop. That throws away the rendering win, though, and is not the fix.
- **Not the cause:**
  - **The history rail.** `rail-off` measured 17.7 %, 24.5 dropped, the same as on.
  - **The seek and rail wheel and scroll listeners.** All are passive, and together they cost under 3 ms of JS per burst: `rail.js` `endOpening` 1.4 ms, `cancelJump` 0.4 ms, `preview-main.js` about 1.5 ms.
  - **Layout-cache ResizeObserver work outside `flush`.** All other extension JS together, including the anonymous `layout-cache-main.js` calls, costs 11–14 ms per burst.

### What 165 Hz changes (per-frame main-thread work)
- **Share of frames over 6.06 ms:** about the same in on (26.9 %), none (26.6 %) and master-off (24.2 %). In every arm, the roughly 25 % of frames that do real work exceed a 165 Hz budget.
- **The difference is how far over budget they go:**
  - p95 frame work is about 25–27 ms with the layout-cache flush running, against **17.3 ms** with it dropped;
  - script alone adds a ~19 ms p95 slice in on, against ~2 ms elsewhere.
  - At 165 Hz, that slice alone is about 3 frame budgets.
- **Frames over 8.3 ms (120 Hz):** on 25.8 %, none 25.0 %, probe-on-noflush 20.6 %, cv-off 19.2 %.

### Mechanism (from code, matching the trace)
`extension/seek/layout-cache-main.js:492-503` registers a capture-phase `contentvisibilityautostatechange` listener on `document`. Every block that becomes un-skipped queues its whole turn. The rAF `flush()` (line 582) then runs `record()` on the turn (line 594): `getBoundingClientRect` on the turn, its row and **every** `ITEMS` element, `getComputedStyle` via `styleKey`, plus `querySelectorAll` over the blocks.

Fast back-and-forth scrolling crosses the relevance boundary constantly, so the trace shows:
- 33–45 `flush` calls per burst, totalling **586–812 ms**, inside rAF callbacks, across all 19 valid on, rail-off and probe-on runs;
- forced layouts: `LayoutCount` **43 vs 0**, Layout **~90 ms**, RecalcStyle **52 vs 11 ms**;
- 48k–64k `Document::UpdateStyleAndLayout` entries per burst, against 0 (and one run with 5.4k) in cv-off.

`record()` is gated only by `data-butter-disabled` (the master switch), not by the `seek` or `layout` settings. Its disk write (`persistence.record`) is gated by layout consent, but the measuring is not. So, by code reading and not measured here, users who never granted layout consent pay the same cost.

## Setup
- **Product:**
  - repo `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`, commit `2bc372fc26c8d25147c91b48b4304224dcdba748`, clean worktree;
  - `extension/` version 0.1.0-alpha.10 (0.1.0.10), copied unchanged to `~/snap/chromium/common/butter-wheel-local`;
  - per-file sha256 in `build-sha256.txt`, `diff -r` identical.
- **Probe:** `probe-ext/` is the same tree with one added line at the top of `flush()` in `seek/layout-cache-main.js`: `if (document.documentElement?.hasAttribute('data-wl-noflush')) { pending.clear(); return; }`. The harness sets that attribute only in the `*-noflush` arms. Without the attribute it behaves like the product, so probe-on equals on, and the numbers confirm it.
- **Fixture:** `<chat>`. Every valid run had 13 virtualizer entries, scrollHeight 312,913 (cv on) or 313,212 (cv off or none), and the same middle turn `<id>`.
- **Window and display:**
  - window 1440×1000 via `Browser.setWindowBounds`, viewport 1440×913, scroller 1367×913;
  - classic scrollbars, normal flags, no `LAB_FLAGS`.
- **Per run:**
  1. write settings through the extension's popup page with `chrome.storage.local.set`;
  2. load the chat fresh;
  3. scroll to the top until entries and height are stable three times;
  4. set the scroller to the middle and wait 3 s;
  5. reader pass with CDP wheel, ±100 px every 40 ms: down 3 viewports, up 6, down 3;
  6. wait 2.5 s for the `seen` marks, which flush after 1 s;
  7. reset to the exact middle and wait 3 s;
  8. measure the burst.
- **Safety:** a Playwright route aborted every non-GET/HEAD/OPTIONS request (`logs/blocked.jsonl`: telemetry, `rgstr`, `conversation/init`/`prepare` and similar). Nothing was sent or written.

### Arms and observed `<html data-butter-off>`
| arm | session | settings (`chrome.storage.local.butter`) | observed `data-butter-off` | other observed |
|---|---|---|---|---|
| none | no extension loaded | – | absent | no rail; 0 `cv:auto`; container `inline-size` |
| master-off | current build | `enabled:false`, all opts true, consent granted | `container cv throttle older rail seek layout`, plus `data-butter-disabled` | no rail; 0 `cv:auto` |
| on | current build | `enabled:true`, all 7 opts true, `layoutConsent:'granted'` (every group on) | absent | rail; 2688/2816 `cv:auto`; container `normal` |
| cv-off | current build | as on, `opts.cv=false` only | `cv` | 1020/2816 still `cv:auto`, set inline by layout-cache `restore()` (`layout-cache-main.js:813-817`), which ignores the cv setting |
| rail-off | current build | as on, `opts.rail=false` only | `rail` | no rail |
| probe-on / probe-on-noflush | probe build | as on | absent | noflush: `data-wl-noflush` set after load |
| probe-cvoff / probe-cvoff-noflush | probe build | as cv-off | `cv` | noflush: 0 `cv:auto` (nothing restored) |

**Important lab finding:** `butter-blank-head` is **not** a no-Butter baseline. It is Butter 0.1.0-alpha.7 (`turbo.css` with `content-visibility` and the container override, `turbo-nav.js` rail, throttle). I therefore used **no extension at all** for the none arm. The lab was still restored to blank-head as instructed.

### Order (interleaved)
- **Block A** (no extension): warmA, none-r1…r3.
- **Block B** (current build): warmB, then 5 rounds of the 4 arms, rotated each round.
- **Block C** (no extension): warmC, none-r4…r6.
- **Probe phase** (separate lock hold): warmP, then 5 rounds of the 4 probe arms, rotated.

Warm-up runs are kept raw but excluded from the stats. `rail-off-r4` is excluded because its history load stopped at 6 entries, a different page state; its raw values are kept.

### Wheel script (identical for every run; `sequence.json`, generator `seq.mjs`)
- **Format:** CDP `Input.dispatchMouseEvent` `type:'mouseWheel'` at (45 % across, 50 % down) of the scroller, deltaX 0.
- **Timing:** 102 events on a 16 ms grid, 6 s total, deterministic PRNG seed 20261103.
- **Segments:** 8 segments of 0.5–1.0 s alternating direction. Each fires a burst of 6–15 events with |deltaY| 120–399 until it reaches a target of 1–2.5 viewports either side of the middle, then idles until the segment ends. Fast flicks back and forth.
- **Planned and observed extent:** −2277 to +1902 px around the middle, observed identically in every run. Total travel 25,987 px.
- **Send timing:** worst send lag across all runs 5.3 ms; typically under 0.5 ms.
- **Segments (start ms, duration, direction, end offset):** (0,621,+,1675) (621,720,−,−1782) (1341,518,+,1295) (1859,984,−,−2277) (2843,782,+,1367) (3625,976,−,−1802) (4601,854,+,1902) (5455,760,−,−1787).

### Metrics
- **Per-frame main-thread work (trace).**
  - Categories: `devtools.timeline`, `disabled-by-default-devtools.timeline`, `disabled-by-default-devtools.timeline.frame`, `v8.execute`, `benchmark`, `toplevel`, `blink`.
  - A frame is the interval between consecutive `BeginMainThreadFrame` events on the tab's `CrRendererMain`, within [first main-thread wheel `EventDispatch`, +6.3 s].
  - Work is the union length of:
    - rendering events: UpdateLayoutTree, Layout, PrePaint, Paint, Layerize, Commit, UpdateLayer, IntersectionObserver compute, HitTest;
    - script events: FunctionCall, EvaluateScript, EventDispatch, TimerFire, FireAnimationFrame, RunMicrotasks, FireIdleCallback, GC.
  - "all-tasks" is the union of `RunTask`. See `frames.py`; per-frame arrays are in `frames.json`.
- **Frame intervals:** page `requestAnimationFrame` timestamps over the same 6.3 s. Dropped means an interval more than 2× the median (median 16.7 ms everywhere).
- **Long tasks:**
  - `PerformanceObserver('longtask')`;
  - trace `RunTask` ≥ 50 ms.
- **`Performance.getMetrics` deltas across the burst:** LayoutCount, RecalcStyleCount, LayoutDuration, RecalcStyleDuration, ScriptDuration, TaskDuration.
- **Compositor `DrawFrame` counts and intervals:** reported, but see the caveats.

## Results per arm: median [min–max], n

Units in ms unless marked %. "frame work" = per-frame main-thread rendering+script (trace). Excluded: rail-off-r4 (fixture state).

| metric | none | master-off | on | cv-off | rail-off | probe-on | probe-on-noflush | probe-cvoff | probe-cvoff-noflush |
|---|---|---|---|---|---|---|---|---|---|
| frame work p50 ms | 0.2 [0.2–0.2] n=6 | 0.2 [0.2–0.2] n=5 | 0.5 [0.5–0.5] n=5 | 0.3 [0.3–0.3] n=5 | 0.5 [0.5–0.5] n=4 | 0.5 [0.5–0.5] n=5 | 0.5 [0.5–0.5] n=5 | 0.3 [0.3–0.3] n=5 | 0.2 [0.2–0.2] n=5 |
| frame work p95 ms | 29.8 [29.1–32.6] n=6 | 32.3 [29.6–32.6] n=5 | 25.2 [25.0–26.0] n=5 | 22.8 [22.2–23.3] n=5 | 25.4 [24.9–30.0] n=4 | 26.5 [25.5–26.6] n=5 | 17.3 [16.8–17.5] n=5 | 22.1 [19.5–22.6] n=5 | 29.9 [29.7–30.6] n=5 |
| frame work max ms | 157.3 [44.1–204.3] n=6 | 61.0 [46.2–164.9] n=5 | 118.1 [36.7–154.9] n=5 | 131.4 [34.9–151.9] n=5 | 37.2 [35.5–38.2] n=4 | 38.0 [28.0–224.8] n=5 | 228.1 [21.6–258.0] n=5 | 117.7 [30.5–148.2] n=5 | 70.7 [47.9–201.7] n=5 |
| frames >6.06 ms (165 Hz) % | 26.6 [24.5–28.4] n=6 | 24.2 [23.1–27.3] n=5 | 26.9 [25.9–29.0] n=5 | 19.9 [17.6–20.6] n=5 | 25.9 [25.2–26.1] n=4 | 24.8 [24.3–29.4] n=5 | 24.8 [23.6–26.0] n=5 | 19.8 [19.0–22.1] n=5 | 23.8 [22.9–24.8] n=5 |
| frames >8.3 ms (120 Hz) % | 25.0 [23.0–27.5] n=6 | 23.0 [21.8–25.6] n=5 | 25.8 [24.7–26.8] n=5 | 19.2 [17.6–20.0] n=5 | 24.5 [23.9–25.0] n=4 | 24.5 [23.0–27.4] n=5 | 20.6 [20.3–21.2] n=5 | 19.3 [18.7–21.7] n=5 | 23.3 [22.0–24.8] n=5 |
| frames >16.7 ms (60 Hz) % | 15.7 [14.9–16.0] n=6 | 15.3 [13.7–17.5] n=5 | 18.3 [16.5–18.8] n=5 | 8.1 [6.5–8.7] n=5 | 17.7 [17.1–18.6] n=4 | 17.4 [16.6–19.1] n=5 | 7.3 [6.0–7.6] n=5 | 7.2 [5.6–8.1] n=5 | 14.7 [13.4–16.5] n=5 |
| frame rendering p95 ms | 28.6 [28.0–30.5] n=6 | 30.9 [28.6–31.4] n=5 | 16.0 [15.5–16.9] n=5 | 21.7 [21.3–21.8] n=5 | 15.8 [15.6–16.0] n=4 | 16.0 [15.5–16.5] n=5 | 15.8 [15.7–16.1] n=5 | 20.8 [19.1–21.4] n=5 | 29.0 [28.6–29.4] n=5 |
| frame script p95 ms | 1.9 [1.5–2.1] n=6 | 1.4 [1.2–2.3] n=5 | 19.0 [18.8–19.4] n=5 | 1.4 [1.2–1.5] n=5 | 19.3 [18.9–19.4] n=4 | 19.9 [19.3–20.6] n=5 | 2.1 [2.0–2.2] n=5 | 1.4 [1.2–1.7] n=5 | 1.4 [1.2–1.8] n=5 |
| frame all-tasks >6.06 ms % | 27.9 [25.7–29.3] n=6 | 25.5 [23.6–29.2] n=5 | 28.9 [27.5–31.8] n=5 | 21.6 [18.8–22.3] n=5 | 27.8 [27.6–28.0] n=4 | 27.6 [25.7–33.0] n=5 | 28.2 [25.4–28.4] n=5 | 21.0 [19.3–23.9] n=5 | 25.4 [23.9–26.1] n=5 |
| main frames (BMF) | 323.0 [317.0–334.0] n=6 | 314.0 [308.0–326.0] n=5 | 316.0 [304.0–321.0] n=5 | 345.0 [333.0–352.0] n=5 | 320.0 [312.0–326.0] n=4 | 313.0 [303.0–322.0] n=5 | 331.0 [327.0–339.0] n=5 | 348.0 [346.0–357.0] n=5 | 320.0 [314.0–326.0] n=5 |
| rAF p50 ms | 16.7 [16.7–16.7] n=6 | 16.7 [16.7–16.7] n=5 | 16.7 [16.7–16.7] n=5 | 16.7 [16.7–16.7] n=5 | 16.7 [16.7–16.7] n=4 | 16.7 [16.7–16.7] n=5 | 16.7 [16.7–16.7] n=5 | 16.7 [16.7–16.7] n=5 | 16.7 [16.7–16.7] n=5 |
| rAF p95 ms | 33.4 [33.3–33.4] n=6 | 33.4 [33.4–33.4] n=5 | 49.9 [49.9–50.0] n=5 | 33.3 [33.3–33.3] n=5 | 41.7 [33.4–50.0] n=4 | 50.0 [49.9–50.0] n=5 | 33.3 [33.3–33.4] n=5 | 33.3 [33.3–33.3] n=5 | 33.4 [33.3–33.4] n=5 |
| rAF max ms | 141.7 [50.0–200.0] n=6 | 83.4 [83.4–183.3] n=5 | 116.7 [50.1–150.1] n=5 | 100.0 [50.0–166.7] n=5 | 66.6 [50.1–66.7] n=4 | 66.7 [50.1–200.0] n=5 | 216.7 [50.1–266.6] n=5 | 100.0 [33.4–133.3] n=5 | 83.4 [83.4–200.0] n=5 |
| rAF frames | 325.0 [319.0–336.0] n=6 | 316.0 [310.0–328.0] n=5 | 317.0 [305.0–322.0] n=5 | 346.0 [334.0–353.0] n=5 | 322.0 [313.0–327.0] n=4 | 315.0 [305.0–323.0] n=5 | 333.0 [329.0–343.0] n=5 | 349.0 [347.0–358.0] n=5 | 321.0 [316.0–328.0] n=5 |
| dropped (>2x median) | 17.0 [16.0–19.0] n=6 | 20.0 [18.0–21.0] n=5 | 23.0 [22.0–32.0] n=5 | 6.0 [4.0–9.0] n=5 | 24.5 [23.0–27.0] n=4 | 25.0 [24.0–32.0] n=5 | 11.0 [9.0–17.0] n=5 | 4.0 [3.0–7.0] n=5 | 13.0 [11.0–20.0] n=5 |
| missed vsyncs | 53.0 [42.0–59.0] n=6 | 62.0 [50.0–68.0] n=5 | 61.0 [56.0–73.0] n=5 | 32.0 [25.0–44.0] n=5 | 56.0 [51.0–65.0] n=4 | 63.0 [55.0–73.0] n=5 | 45.0 [35.0–49.0] n=5 | 29.0 [20.0–31.0] n=5 | 57.0 [50.0–62.0] n=5 |
| long tasks n (PO) | 0.0 [0.0–3.0] n=6 | 1.0 [0.0–4.0] n=5 | 0.0 [0.0–2.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–1.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 1.0 [0.0–1.0] n=5 |
| long tasks total ms (PO) | 0.0 [0.0–175.0] n=6 | 50.0 [0.0–234.0] n=5 | 0.0 [0.0–172.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–61.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 50.0 [0.0–52.0] n=5 |
| long tasks n (trace) | 1.0 [0.0–4.0] n=6 | 1.0 [0.0–5.0] n=5 | 1.0 [0.0–3.0] n=5 | 1.0 [0.0–1.0] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–3.0] n=5 | 1.0 [1.0–2.0] n=5 | 1.0 [0.0–1.0] n=5 | 1.0 [0.0–2.0] n=5 |
| long tasks total ms (trace) | 172.4 [0.0–325.0] n=6 | 50.8 [0.0–392.8] n=5 | 132.8 [0.0–238.3] n=5 | 111.2 [0.0–147.9] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–313.8] n=5 | 226.8 [162.1–304.9] n=5 | 115.2 [0.0–144.3] n=5 | 50.8 [0.0–231.9] n=5 |
| main busy ms (trace) | 2371 [2157–2449] n=6 | 2595 [2229–2806] n=5 | 2510 [2433–2613] n=5 | 2036 [1765–2048] n=5 | 2417 [2334–2527] n=4 | 2358 [2304–2806] n=5 | 2095 [1997–2184] n=5 | 1984 [1767–2128] n=5 | 2412 [2359–2523] n=5 |
| DrawFrame n | 118.5 [109.0–124.0] n=6 | 119.0 [114.0–121.0] n=5 | 135.0 [128.0–142.0] n=5 | 122.0 [118.0–122.0] n=5 | 135.0 [125.0–139.0] n=4 | 137.0 [129.0–139.0] n=5 | 136.0 [124.0–142.0] n=5 | 124.0 [121.0–127.0] n=5 | 121.0 [110.0–122.0] n=5 |
| DrawFrame p95 ms | 348.4 [247.4–366.5] n=6 | 310.4 [225.7–333.6] n=5 | 241.1 [204.5–382.6] n=5 | 318.8 [224.0–359.4] n=5 | 235.1 [224.0–333.3] n=4 | 303.9 [220.5–335.5] n=5 | 235.4 [185.8–319.5] n=5 | 255.3 [189.2–421.5] n=5 | 258.7 [249.7–373.7] n=5 |
| DrawFrame max ms | 520.4 [492.7–600.0] n=6 | 530.7 [512.5–599.7] n=5 | 567.4 [523.9–600.1] n=5 | 580.4 [493.5–600.3] n=5 | 526.5 [486.6–580.2] n=4 | 505.0 [503.0–600.3] n=5 | 600.3 [519.0–617.0] n=5 | 596.8 [534.8–600.4] n=5 | 566.4 [481.9–613.2] n=5 |
| LayoutCount | 0.0 [0.0–0.0] n=6 | 0.0 [0.0–0.0] n=5 | 43.0 [40.0–47.0] n=5 | 0.0 [0.0–0.0] n=5 | 44.5 [43.0–47.0] n=4 | 42.0 [42.0–46.0] n=5 | 55.0 [51.0–58.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 |
| RecalcStyleCount | 13.5 [8.0–15.0] n=6 | 10.0 [2.0–13.0] n=5 | 52.0 [48.0–59.0] n=5 | 8.0 [4.0–12.0] n=5 | 57.0 [55.0–62.0] n=4 | 52.0 [51.0–55.0] n=5 | 69.0 [65.0–76.0] n=5 | 9.0 [8.0–13.0] n=5 | 8.0 [6.0–13.0] n=5 |
| LayoutDuration ms | 0.0 [0.0–0.0] n=6 | 0.0 [0.0–0.0] n=5 | 91.4 [87.3–93.7] n=5 | 0.0 [0.0–0.0] n=5 | 92.7 [89.6–99.9] n=4 | 91.4 [89.6–100.9] n=5 | 116.0 [100.5–129.3] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 |
| RecalcStyleDuration ms | 11.5 [6.5–14.4] n=6 | 8.3 [1.8–11.3] n=5 | 52.3 [48.7–55.1] n=5 | 6.5 [3.5–10.5] n=5 | 53.9 [53.1–55.8] n=4 | 51.4 [49.5–53.5] n=5 | 57.5 [53.7–60.4] n=5 | 8.0 [6.6–11.4] n=5 | 7.9 [4.9–11.6] n=5 |
| ScriptDuration ms | 62.7 [57.9–72.8] n=6 | 64.2 [56.1–74.9] n=5 | 713.8 [651.0–811.5] n=5 | 63.1 [59.3–67.1] n=5 | 780.8 [713.1–880.9] n=4 | 748.3 [682.5–834.5] n=5 | 70.1 [65.4–76.5] n=5 | 63.3 [60.4–63.9] n=5 | 59.8 [56.6–64.0] n=5 |
| TaskDuration ms | 2427 [2214–2509] n=6 | 2680 [2314–2889] n=5 | 2572 [2497–2676] n=5 | 2098 [1838–2124] n=5 | 2479 [2398–2599] n=4 | 2420 [2365–2866] n=5 | 2145 [2056–2233] n=5 | 2049 [1828–2188] n=5 | 2499 [2424–2601] n=5 |
| scroll travel px | 25987 [25987–25987] n=6 | 25987 [25987–25987] n=5 | 25987 [25987–25987] n=5 | 25987 [25987–25987] n=5 | 25987 [25987–25987] n=4 | 25987 [25987–25987] n=5 | 25987 [25987–25987] n=5 | 25987 [25987–25987] n=5 | 25987 [25987–25987] n=5 |
| trace Paint ms | 459.3 [400.8–502.6] n=6 | 422.5 [383.9–476.2] n=5 | 160.3 [153.2–171.0] n=5 | 343.0 [325.9–365.9] n=5 | 165.6 [153.8–169.5] n=4 | 162.3 [161.3–165.6] n=5 | 172.2 [163.9–177.6] n=5 | 322.1 [307.4–338.7] n=5 | 403.3 [368.5–501.1] n=5 |
| trace PrePaint ms | 0.0 [0.0–26.7] n=6 | 0.0 [0.0–0.0] n=5 | 181.1 [170.8–185.6] n=5 | 0.0 [0.0–0.0] n=5 | 183.9 [178.7–189.3] n=4 | 175.1 [172.3–188.6] n=5 | 224.9 [202.0–231.4] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 |
| trace Layerize ms | 114.6 [102.2–119.5] n=6 | 107.1 [94.1–115.5] n=5 | 0.0 [0.0–0.0] n=5 | 96.6 [93.9–100.3] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–76.9] n=5 | 97.0 [87.5–105.5] n=5 | 109.8 [92.7–117.2] n=5 |
| trace UpdateLayoutTree ms | 0.0 [0.0–0.0] n=6 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 |
| trace Layout ms | 0.0 [0.0–0.0] n=6 | 0.0 [0.0–0.0] n=5 | 89.0 [0.0–92.5] n=5 | 0.0 [0.0–0.0] n=5 | 92.1 [89.1–99.4] n=4 | 89.9 [0.0–100.3] n=5 | 115.4 [100.0–128.7] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 |
| trace FunctionCall:extension ms | 0.0 [0.0–0.0] n=6 | 0.0 [0.0–0.0] n=5 | 660.2 [597.9–752.5] n=5 | 0.0 [0.0–0.0] n=5 | 726.2 [661.8–824.4] n=4 | 696.7 [631.7–779.9] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 |
| trace EventDispatch:scroll ms | 0.0 [0.0–30.5] n=6 | 21.8 [0.0–27.3] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 21.7 [0.0–29.3] n=5 |
| trace EventDispatch:wheel ms | 0.0 [0.0–0.0] n=6 | 26.7 [0.0–29.6] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–30.1] n=5 | 0.0 [0.0–0.0] n=4 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–0.0] n=5 | 0.0 [0.0–31.3] n=5 | 26.6 [0.0–26.8] n=5 |

## Every run (raw; also in results.json)

| run | arm | work p50 | work p95 | work max | >6.06% | >8.3% | >16.7% | rend p95 | script p95 | rAF p50 | rAF p95 | rAF max | dropped | LT n/ms (PO) | LT n/ms (trace) | LayoutCount | RecalcStyleCount | LayoutDur ms | RecalcDur ms | ScriptDur ms | data-butter-off | valid |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| warmA | none | 0.2 | 29.4 | 128.5 | 24.2 | 22.4 | 13.9 | 27.2 | 1.9 | 16.7 | 33.4 | 133.3 | 12 | 1/51 | 2/178 | 0 | 15 | 0 | 12.9 | 61.1 | None | True |
| none-r1 | none | 0.2 | 30.6 | 204.3 | 24.5 | 23.0 | 15.7 | 28.9 | 1.6 | 16.7 | 33.4 | 200 | 19 | 0/0 | 1/201 | 0 | 8 | 0 | 6.5 | 57.9 | None | True |
| none-r2 | none | 0.2 | 29.4 | 168.9 | 28.4 | 27.1 | 15.8 | 28.0 | 2.1 | 16.7 | 33.4 | 183.3 | 17 | 1/50 | 2/214 | 0 | 15 | 0 | 14.1 | 64.1 | None | True |
| none-r3 | none | 0.2 | 32.6 | 157.8 | 25.2 | 23.3 | 14.9 | 30.5 | 1.9 | 16.7 | 33.4 | 133.3 | 18 | 3/175 | 4/325 | 0 | 8 | 0 | 7.1 | 72.8 | None | True |
| warmB | on | 0.5 | 26.2 | 144.1 | 28.4 | 27.1 | 20.0 | 16.7 | 19.8 | 16.7 | 49.9 | 133.3 | 27 | 0/0 | 1/142 | 43 | 57 | 94.5 | 56.3 | 725.2 | None | True |
| cv-off-r1 | cv-off | 0.3 | 22.8 | 131.4 | 19.9 | 19.9 | 7.9 | 21.8 | 1.4 | 16.7 | 33.3 | 100 | 5 | 0/0 | 1/105 | 0 | 12 | 0 | 10.5 | 59.3 | 'cv' | True |
| rail-off-r1 | rail-off | 0.5 | 24.9 | 37.7 | 25.2 | 24.2 | 17.1 | 16.0 | 18.9 | 16.7 | 49.9 | 66.7 | 23 | 0/0 | 0/0 | 43 | 56 | 89.6 | 54.1 | 713.1 | 'rail' | True |
| master-off-r1 | master-off | 0.2 | 32.6 | 59.6 | 25.6 | 25.0 | 17.3 | 31.4 | 1.8 | 16.7 | 33.4 | 83.4 | 21 | 0/0 | 0/0 | 0 | 13 | 0 | 11.3 | 74.9 | 'container cv throttle older rail seek layout' | True |
| on-r1 | on | 0.5 | 25.2 | 36.7 | 29.0 | 26.8 | 16.5 | 15.5 | 19.0 | 16.7 | 49.9 | 66.6 | 23 | 0/0 | 0/0 | 45 | 59 | 89.5 | 55.1 | 713.8 | None | True |
| rail-off-r2 | rail-off | 0.5 | 25.1 | 35.5 | 26.1 | 23.9 | 17.8 | 15.7 | 19.3 | 16.7 | 33.4 | 50.1 | 23 | 0/0 | 0/0 | 43 | 55 | 92.2 | 53.1 | 754.3 | 'rail' | True |
| master-off-r2 | master-off | 0.2 | 29.7 | 61.0 | 23.1 | 21.8 | 13.7 | 28.6 | 1.4 | 16.7 | 33.4 | 83.4 | 20 | 1/50 | 1/51 | 0 | 9 | 0 | 8.3 | 72.3 | 'container cv throttle older rail seek layout' | True |
| on-r2 | on | 0.5 | 25.6 | 37.6 | 25.9 | 24.7 | 18.4 | 15.6 | 18.9 | 16.7 | 50 | 50.1 | 28 | 0/0 | 0/0 | 47 | 58 | 93.0 | 54.8 | 799.1 | None | True |
| cv-off-r2 | cv-off | 0.3 | 23.3 | 148.6 | 20.1 | 19.2 | 8.7 | 21.8 | 1.4 | 16.7 | 33.3 | 166.7 | 9 | 0/0 | 1/136 | 0 | 6 | 0 | 5.0 | 67.1 | 'cv' | True |
| master-off-r3 | master-off | 0.2 | 32.3 | 159.4 | 24.2 | 22.9 | 15.3 | 30.9 | 1.2 | 16.7 | 33.4 | 183.3 | 18 | 4/234 | 5/393 | 0 | 2 | 0 | 1.8 | 62.9 | 'container cv throttle older rail seek layout' | True |
| on-r3 | on | 0.5 | 26.0 | 118.1 | 26.3 | 24.7 | 18.8 | 16.9 | 19.4 | 16.7 | 50 | 116.7 | 32 | 2/172 | 3/238 | 43 | 51 | 93.7 | 52.3 | 811.5 | None | True |
| cv-off-r3 | cv-off | 0.3 | 22.2 | 34.9 | 17.6 | 17.6 | 6.5 | 21.3 | 1.2 | 16.7 | 33.3 | 50 | 4 | 0/0 | 0/0 | 0 | 11 | 0 | 9.9 | 61.2 | 'cv' | True |
| rail-off-r3 | rail-off | 0.5 | 30.0 | 36.6 | 26.0 | 25.0 | 18.6 | 15.9 | 19.4 | 16.7 | 50 | 66.6 | 26 | 0/0 | 0/0 | 46 | 58 | 93.1 | 53.7 | 880.9 | 'rail' | True |
| on-r4 | on | 0.5 | 25.2 | 154.9 | 26.9 | 26.0 | 18.3 | 16.4 | 19.0 | 16.7 | 49.9 | 150.1 | 22 | 0/0 | 1/146 | 40 | 48 | 87.3 | 48.7 | 676.3 | None | True |
| cv-off-r4 | cv-off | 0.3 | 22.5 | 151.9 | 19.3 | 18.7 | 8.1 | 21.5 | 1.5 | 16.7 | 33.3 | 133.3 | 8 | 0/0 | 1/148 | 0 | 8 | 0 | 6.5 | 66.2 | 'cv' | True |
| rail-off-r4 | rail-off | 0.5 | 24.1 | 41.7 | 28.1 | 27.2 | 19.1 | 15.6 | 17.7 | 16.7 | 33.5 | 66.7 | 21 | 0/0 | 0/0 | 52 | 106 | 118.9 | 126.5 | 805.7 | 'rail' | False |
| master-off-r4 | master-off | 0.2 | 32.4 | 164.9 | 27.3 | 25.6 | 17.5 | 31.0 | 2.3 | 16.7 | 33.4 | 149.9 | 21 | 1/50 | 2/213 | 0 | 13 | 0 | 11.3 | 64.2 | 'container cv throttle older rail seek layout' | True |
| cv-off-r5 | cv-off | 0.3 | 23.0 | 112.3 | 20.6 | 20.0 | 8.4 | 21.7 | 1.4 | 16.7 | 33.3 | 100 | 6 | 0/0 | 1/111 | 0 | 4 | 0 | 3.5 | 63.1 | 'cv' | True |
| rail-off-r5 | rail-off | 0.5 | 25.7 | 38.2 | 25.8 | 24.8 | 17.6 | 15.6 | 19.2 | 16.7 | 33.4 | 66.6 | 27 | 0/0 | 0/0 | 47 | 62 | 99.9 | 55.8 | 807.4 | 'rail' | True |
| master-off-r5 | master-off | 0.2 | 29.6 | 46.2 | 23.3 | 23.0 | 13.8 | 28.6 | 1.3 | 16.7 | 33.4 | 83.4 | 18 | 1/50 | 1/51 | 0 | 10 | 0 | 8.2 | 56.1 | 'container cv throttle older rail seek layout' | True |
| on-r5 | on | 0.5 | 25.0 | 142.2 | 27.4 | 25.8 | 17.3 | 16.0 | 18.8 | 16.7 | 49.9 | 133.4 | 22 | 0/0 | 1/133 | 42 | 52 | 91.4 | 50.3 | 651.0 | None | True |
| warmC | none | 0.2 | 29.3 | 45.6 | 22.2 | 21.0 | 14.1 | 28.5 | 1.4 | 16.7 | 33.3 | 66.7 | 16 | 0/0 | 0/0 | 0 | 10 | 0 | 8.2 | 58.6 | None | True |
| none-r4 | none | 0.2 | 29.8 | 144.6 | 28.1 | 25.7 | 15.3 | 28.4 | 1.9 | 16.7 | 33.3 | 116.7 | 16 | 0/0 | 1/138 | 0 | 13 | 0 | 11.8 | 63.0 | None | True |
| none-r5 | none | 0.2 | 29.8 | 44.1 | 24.8 | 24.2 | 15.7 | 28.8 | 1.5 | 16.7 | 33.4 | 50 | 16 | 0/0 | 0/0 | 0 | 15 | 0 | 14.4 | 62.3 | None | True |
| none-r6 | none | 0.2 | 29.1 | 156.7 | 28.1 | 27.5 | 16.0 | 28.1 | 1.8 | 16.7 | 33.4 | 150 | 17 | 0/0 | 1/144 | 0 | 14 | 0 | 11.3 | 61.4 | None | True |
| warmP | probe-on | 0.5 | 26.4 | 166.5 | 26.4 | 24.8 | 18.5 | 16.6 | 20.1 | 16.7 | 49.9 | 183.3 | 22 | 1/97 | 2/252 | 43 | 43 | 95.3 | 42.8 | 780.6 | None | True |
| p-probe-on-noflush-r1 | probe-on-noflush | 0.5 | 16.8 | 233.4 | 23.6 | 20.3 | 6.0 | 15.7 | 2.1 | 16.7 | 33.3 | 216.7 | 11 | 0/0 | 2/305 | 51 | 65 | 100.5 | 53.7 | 65.4 | None | True |
| p-probe-cvoff-r1 | probe-cvoff | 0.3 | 22.4 | 130.5 | 19.8 | 19.3 | 7.5 | 21.1 | 1.7 | 16.7 | 33.3 | 133.3 | 5 | 0/0 | 1/119 | 0 | 13 | 0 | 11.4 | 63.9 | 'cv' | True |
| p-probe-cvoff-noflush-r1 | probe-cvoff-noflush | 0.2 | 29.9 | 183.9 | 23.8 | 23.4 | 13.8 | 28.9 | 1.5 | 16.7 | 33.4 | 150 | 13 | 1/51 | 2/208 | 0 | 8 | 0 | 7.9 | 59.8 | 'cv' | True |
| p-probe-on-r1 | probe-on | 0.5 | 26.6 | 38.0 | 24.3 | 23.0 | 16.9 | 16.0 | 20.2 | 16.7 | 49.9 | 66.7 | 27 | 0/0 | 0/0 | 43 | 55 | 90.4 | 52.6 | 747.9 | None | True |
| p-probe-cvoff-r2 | probe-cvoff | 0.3 | 22.1 | 117.7 | 22.1 | 21.3 | 7.2 | 20.6 | 1.4 | 16.7 | 33.3 | 100 | 4 | 0/0 | 1/115 | 0 | 8 | 0 | 6.6 | 60.4 | 'cv' | True |
| p-probe-cvoff-noflush-r2 | probe-cvoff-noflush | 0.2 | 30.1 | 47.9 | 23.8 | 23.2 | 14.9 | 29.3 | 1.2 | 16.7 | 33.4 | 83.4 | 15 | 0/0 | 0/0 | 0 | 8 | 0 | 6.7 | 58.9 | 'cv' | True |
| p-probe-on-r2 | probe-on | 0.5 | 26.6 | 168.7 | 29.4 | 27.4 | 19.1 | 16.5 | 20.6 | 16.7 | 49.9 | 166.6 | 32 | 0/0 | 2/226 | 42 | 52 | 91.4 | 53.5 | 763.7 | None | True |
| p-probe-on-noflush-r2 | probe-on-noflush | 0.5 | 17.0 | 21.6 | 24.5 | 21.2 | 6.8 | 15.8 | 2.0 | 16.7 | 33.3 | 50.1 | 9 | 0/0 | 1/162 | 55 | 67 | 116.0 | 54.4 | 70.1 | None | True |
| p-probe-cvoff-noflush-r3 | probe-cvoff-noflush | 0.2 | 29.7 | 201.7 | 22.9 | 22.0 | 13.4 | 28.6 | 1.4 | 16.7 | 33.4 | 200 | 13 | 1/52 | 2/232 | 0 | 6 | 0 | 4.9 | 56.6 | 'cv' | True |
| p-probe-on-r3 | probe-on | 0.5 | 25.5 | 35.2 | 24.5 | 23.2 | 16.6 | 16.1 | 19.3 | 16.7 | 50 | 50.1 | 24 | 0/0 | 0/0 | 42 | 52 | 93.5 | 51.4 | 682.5 | None | True |
| p-probe-on-noflush-r3 | probe-on-noflush | 0.5 | 17.4 | 258.0 | 25.2 | 20.6 | 7.3 | 16.1 | 2.0 | 16.7 | 33.3 | 266.6 | 10 | 0/0 | 2/303 | 57 | 73 | 123.4 | 58.5 | 71.1 | None | True |
| p-probe-cvoff-r3 | probe-cvoff | 0.3 | 21.8 | 32.3 | 19.6 | 18.8 | 5.6 | 20.8 | 1.2 | 16.7 | 33.3 | 33.5 | 3 | 0/0 | 0/0 | 0 | 8 | 0 | 6.7 | 63.3 | 'cv' | True |
| p-probe-on-r4 | probe-on | 0.5 | 26.5 | 224.8 | 27.5 | 26.1 | 19.0 | 15.8 | 19.9 | 16.7 | 50 | 200 | 25 | 1/61 | 3/314 | 46 | 53 | 100.9 | 50.5 | 834.5 | None | True |
| p-probe-on-noflush-r4 | probe-on-noflush | 0.5 | 17.5 | 228.1 | 26.0 | 21.1 | 7.6 | 15.8 | 2.1 | 16.7 | 33.4 | 216.7 | 17 | 0/0 | 1/227 | 58 | 76 | 129.3 | 60.4 | 76.5 | None | True |
| p-probe-cvoff-r4 | probe-cvoff | 0.3 | 19.5 | 30.5 | 19.0 | 18.7 | 5.7 | 19.1 | 1.2 | 16.7 | 33.3 | 33.4 | 3 | 0/0 | 0/0 | 0 | 9 | 0 | 8.0 | 60.9 | 'cv' | True |
| p-probe-cvoff-noflush-r4 | probe-cvoff-noflush | 0.2 | 29.9 | 54.9 | 24.5 | 23.3 | 14.7 | 29.0 | 1.4 | 16.7 | 33.3 | 83.4 | 11 | 1/50 | 1/51 | 0 | 11 | 0 | 9.7 | 64.0 | 'cv' | True |
| p-probe-on-noflush-r5 | probe-on-noflush | 0.5 | 17.3 | 214.3 | 24.8 | 20.5 | 7.6 | 16.1 | 2.2 | 16.7 | 33.3 | 216.7 | 13 | 0/0 | 1/205 | 54 | 69 | 111.1 | 57.5 | 67.8 | None | True |
| p-probe-cvoff-r5 | probe-cvoff | 0.3 | 22.6 | 148.2 | 21.7 | 21.7 | 8.1 | 21.4 | 1.7 | 16.7 | 33.3 | 133.3 | 7 | 0/0 | 1/144 | 0 | 10 | 0 | 8.5 | 63.4 | 'cv' | True |
| p-probe-cvoff-noflush-r5 | probe-cvoff-noflush | 0.2 | 30.6 | 70.7 | 24.8 | 24.8 | 16.5 | 29.4 | 1.8 | 16.7 | 33.4 | 83.4 | 20 | 0/0 | 0/0 | 0 | 13 | 0 | 11.6 | 61.5 | 'cv' | True |
| p-probe-on-r5 | probe-on | 0.5 | 25.7 | 28.0 | 24.8 | 24.5 | 17.4 | 15.5 | 19.7 | 16.7 | 50 | 66.7 | 24 | 0/0 | 0/0 | 42 | 51 | 89.6 | 49.5 | 748.3 | None | True |

## Caveats
- **Display.** The lab runs Xvfb at 60 Hz with software compositing. rAF intervals cannot show anything below 16.7 ms, and the absolute frame rate is not the user's. The 165 Hz and 120 Hz figures come from per-frame main-thread work in the trace, not from frames actually shown at that rate.
- **Main-thread work vs what the user sees.** Wheel scrolling is compositor-driven, so main-thread work does not stall scrolling by itself. With `content-visibility`, however, content that just became relevant can only appear after a main-thread lifecycle, and Butter's flush runs inside the same rAF.
- **Compositor `DrawFrame` intervals** (p95 200–380 ms, about 120–140 frames per burst) are dominated by software raster in Xvfb. They overlap across all arms, so I don't draw conclusions from them.
- **Hit testing.** Without `cv`, hit testing is about 1.1 s per burst (CDP wheel events plus synthetic mouse-move over a 100k-node page). With `cv`, skipped subtrees are not hit-tested. This favours `cv` here; real mice also hit-test on wheel.
- **Layout consent.** The on arm had `layoutConsent: 'granted'` ("every group on"). That layout-cache measuring also runs without consent is from code reading only, not measured.
- **Cold-geometry restores in cv-off.** In the product cv-off arm, 1020 elements still had inline `content-visibility: auto` from layout-cache `restore()`, so cv-off is not "no cv". In probe-cvoff-noflush there were none. That arm's figures sit close to none: 14.7 % > 16.7 ms, 13 dropped. So the container and other Butter parts, with neither cv nor the flush, are roughly neutral.
- **`seen` counts.** In the on arm, 1670 targets were marked `data-butter-seen`; in no-flush, all 2688. I did not look into why. It does not change the conclusion: cv-auto was 2688/2816 in both.
- **Long tasks.** The ≥ 50 ms tasks in every arm are mostly V8 major GCs (checked in `none-r4` and `p-probe-on-noflush-r2`: MajorGC 138 and 162 ms). They are noise across arms; each probe-on-noflush run happened to catch one near the end of the window.
- **Sessions.** none runs come from separate browser sessions, blocks A and C bracketing B. Extension arms share one session per phase. probe-on reproduces on: 17.4 vs 18.3 %, 25 vs 23 dropped. Load average was 0.6–2.6 throughout.
- **Request blocking.** All non-GET requests were aborted (telemetry, `rgstr`, `conversation/init`/`prepare`), equally in every arm.

## Lab restoration and lock
- **Lock:**
  - the main phase took the lock at 03:56:24Z (owner `butter-wheel-local-3017047-…`) and released it at 04:30:59Z after restoring;
  - the probe phase took it at 04:30:59Z (owner `butter-wheel-probe-3048494-…`) and released it at 04:57:52Z after restoring.
- **Each restore** restarted the browser with `LAB_EXTENSIONS=~/snap/chromium/common/butter-blank-head`, no `LAB_FLAGS` (normal flags), and `--window-size=1600,1000`. It then opened `<chat>` and emptied the composer.
- **Final state** (`restored-browser.json`): one tab, that URL, composer `""`, and the run dir's `extensions` file pointing at blank-head.
- **Lock now:** `lock.d` is held by another task (`butter-partial-guard-…`), not by this one.
- **Cleanup:** my staging copies under `~/snap/chromium/common/butter-wheel-{local,probe}` were removed.
- **Nothing was sent** to ChatGPT, and no API writes were made.

## Files (private, under (not archived); do not publish)
- `results.json`: every run's raw record, including rAF series, scroll tops, long tasks, trace summary, per-frame stats and settings.
- `frames.json`: the per-frame arrays.
- `raw/*.json`: per-run records.
- `traces/*.json.gz`: full traces.
- `shots/*.png`: a screenshot before each burst.
- Logs: `logs/phase.log`, `logs/phase2.log`, `logs/blocked.jsonl`.
- Harness: `seq.mjs`, `wheel.mjs` (main matrix), `wheel2.mjs` (probe arms; same as `wheel.mjs` plus the noflush attribute), `phase.sh`, `phase2.sh`, `acquire.py`, `restore.mjs`, `frames.py`, `summarize.py`.
- Probe build: `probe-ext/`.
