> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Height cache implementation and measurement

Measured 2026-11-01 on headed Chromium 156.0.8078.47, CDP 9222. Base is HEAD `9d6cad4fe890a8c523731ed20f261e754d966832`. Pre-jump is HEAD plus the original uncommitted nav change. Cache is the working implementation, with the same pre-jump. No version bump or commit.

## Send measurements

Three independent reloads per row. Cold means full history has just loaded; warm additionally traverses the entire chat with the original warm driver. Every send starts at scrollTop 1900. The local SSE answer is held for 15 seconds, beyond the measured placement. Trigger to final uses the last scroll event; frame statistics use that same interval. LoAF and forced style/layout identify `DIV.onkeydown`. Values are medians except frame max, which is the worst frame across the three runs. Landing lists show every distinct value.

| Variant | State | Trigger to final, s (range) | Keydown LoAF / handler, ms | Forced style/layout, ms | Frame p95 / max, ms | Final scrollTop | Question top, px |
|---|---|---:|---:|---:|---:|---|---|
| base | cold | 9.534 (9.314–10.036) | 512.6 / 493.8 | 303.8 | 2083.4 / 2549.9 | 309381 | 3517 |
| base | warm | 11.094 (11.079–11.759) | 358.8 / 343.4 | 183.7 | 2983.2 / 3066.5 | 312626 | 272 |
| prejump | cold | 2.658 (2.615–2.702) | 2081.5 / 1984.0 | 1352.6 | 100.0 / 2116.5 | 312443, 312595, 312613 | 292, 315 |
| prejump | warm | 2.667 (2.459–2.802) | 2095.6 / 2003.6 | 1285.8 | 100.0 / 2199.9 | 312626 | 272 |
| cache | cold | 1.815 (1.733–1.831) | 1226.8 / 1204.3 | 508.0 | 83.3 / 1216.6 | 312654 | 272 |
| cache | warm | 1.545 (1.531–1.546) | 964.8 / 934.2 | 442.1 | 83.3 / 950.0 | 312634, 312644 | 254, 272 |

The cache meets the timing target: median 1.815 s cold and 1.545 s warm, versus 2.658 s and 2.667 s with pre-jump alone. All cold cache runs and two warm runs place the question at 272 px. One warm cache run lands 18 px higher (254 px); exact pixel identity is not established. It is still fully visible, and avoids the large placeholder-height landing errors. Absolute scrollTop also varies with the final scroller height. The cause of the remaining 18 px landing variation was not isolated.

## Implementation and changes to the initial design

- Content-box heights stay in tab memory, keyed by conversation, turn key, full child index (including wide-block positions), and exact column width. Wide blocks, unknown heights, and streaming answer wrappers cannot use cached block rules. Four conversations, 64 turns and 8192 blocks per conversation bound retained data and rules.
- The stylesheet exists before React remounts the content. Its rules target unmarked elements. Marked elements keep Chrome’s native remembered sizes. A skipped remount keeps its rule until it renders, so adding a seen mark cannot restore a 120 px placeholder.
- Blocks are marked before their parent turn, with the turn delayed one animation frame. This lets ResizeObserver capture each block’s native content-box size under containment before its parent skips. Measurements and changed turn groups are batched once per second. Observer targets are released when the virtualizer removes them.
- KaTeX readiness checks both the block itself and its descendants. A `data-math-source` block can initially measure 26 px while its final rendered height is much larger. Math blocks and their turn wait for typesetting before the first seen mark. Subsequent resize and typesetting notifications refresh measurements.
- The existing first block class is part of each positional selector. Display-math spans then use their own class bucket rather than competing with the many inner KaTeX spans. Broad `:has()` on every block and a CSS-scope experiment were rejected for excessive style cost. Whole-turn state gates use direct wrapper children.
- Column ResizeObserver invalidates old widths; the window resize handler removes the old sheet immediately during the gap before new column measurements. Returning to a previous width also starts without cached heights.
- The original pre-jump source and its tests are preserved. `docs/how-it-works.md` describes both changes. README, changelog and version fields are untouched.

## Regression checks

- prejump rail, six alternate early/late jumps: median 4616.5 ms; range 4287.6–4985.8 ms; every question top 64 px. This is an equivalent live-rail check to the jump-latency harness, retaining the current extension instead of its historical staging logic.
- prejump normal-width full-chat upward scroll: 78 steps, 0 anchor errors over 20 px, worst 0.0 px, idle drift 0.0 px. The check uses the same anchor-coordinate error as `qa.mjs`; normal width covers the entire chat. The resized check takes 80 steps after a replay answer.
- prejump upward scroll after resize: 80 steps, 8 anchor errors over 20 px, worst 271.0 px, idle drift 0.0 px. The check uses the same anchor-coordinate error as `qa.mjs`; normal width covers the entire chat. The resized check takes 80 steps after a replay answer.
- prejump near: before/capture/after scrollTop 312080 / 312080 / 312626; 1 local replay(s), 24 scroll events; question top 272 px.
- prejump shift: before/capture/after scrollTop 1900 / 1900 / 1900; 0 local replay(s), 0 scroll events; question top n/a px.
- prejump resized-send: before/capture/after scrollTop 1900 / 308025 / 313198; 1 local replay(s), 26 scroll events; question top 345 px.
- cache rail, six alternate early/late jumps: median 2756.0 ms; range 2387.1–3333.6 ms; every question top 64 px. This is an equivalent live-rail check to the jump-latency harness, retaining the current extension instead of its historical staging logic.
- cache normal-width full-chat upward scroll: 78 steps, 0 anchor errors over 20 px, worst 5.0 px, idle drift 0.0 px. The check uses the same anchor-coordinate error as `qa.mjs`; normal width covers the entire chat. The resized check takes 80 steps after a replay answer.
- cache upward scroll after resize: 80 steps, 8 anchor errors over 20 px, worst 238.0 px, idle drift 0.0 px. The check uses the same anchor-coordinate error as `qa.mjs`; normal width covers the entire chat. The resized check takes 80 steps after a replay answer.
- cache near: before/capture/after scrollTop 312082 / 312082 / 312628; 1 local replay(s), 26 scroll events; question top 272 px.
- cache shift: before/capture/after scrollTop 1900 / 1900 / 1900; 0 local replay(s), 0 scroll events; question top n/a px.
- cache resized-send: before/capture/after scrollTop 1900 / 311298 / 313251; 1 local replay(s), 25 scroll events; question top 325 px.

The resize changes the column from 768 px to 640 px. Exact results above distinguish existing virtualizer corrections from any additional cache regression.

## Observer and stylesheet overhead

Across send plus local replay completion, observer/flush deltas were: ResizeObserver 11 calls / 7.8 ms; MutationObserver 20 calls / 28.2 ms; flush 6 calls / 13.1 ms; skip events 1719 calls / 1.2 ms. Scan time is included in MutationObserver time. Over the whole run, maximum RO/MO/flush callback times were 5.0 / 18.7 / 9.3 ms. The final sheet contained 5715 rules in 13 turn groups. These are absolute callback costs, rather than an incremental comparison to the old observer.

`overhead-after-prep` (instrumented staging copy only):

```json
{
  "stats": {
    "scan": {
      "calls": 1455,
      "ms": 43.40000081062317,
      "max": 5.5
    },
    "mutationObserver": {
      "calls": 62,
      "ms": 50.89999985694885,
      "max": 12
    },
    "flush": {
      "calls": 12,
      "ms": 70.80000019073486,
      "max": 9.299999952316284
    },
    "resizeObserver": {
      "calls": 44,
      "ms": 58.09999942779541,
      "max": 5
    },
    "skipEvent": {
      "calls": 6437,
      "ms": 5.499999523162842,
      "max": 0.3000001907348633
    }
  },
  "sheet": [
    {
      "groups": 11,
      "rules": 5057
    }
  ]
}
```

`overhead-after-send` (instrumented staging copy only):

```json
{
  "stats": {
    "scan": {
      "calls": 2194,
      "ms": 62.600000858306885,
      "max": 5.5
    },
    "mutationObserver": {
      "calls": 82,
      "ms": 79.10000014305115,
      "max": 18.699999809265137
    },
    "flush": {
      "calls": 18,
      "ms": 83.90000081062317,
      "max": 9.299999952316284
    },
    "resizeObserver": {
      "calls": 55,
      "ms": 65.89999890327454,
      "max": 5
    },
    "skipEvent": {
      "calls": 8156,
      "ms": 6.700000047683716,
      "max": 0.3000001907348633
    }
  },
  "sheet": [
    {
      "groups": 13,
      "rules": 5715
    }
  ]
}
```

The clean traced cache run's largest style recalc was 248.7 ms for 4027 elements. Its largest Layout was 72.7 ms. This includes React/remount work, not only sheet-update cost; no synchronous layout read is introduced by the cache. See trace JSON and callback telemetry for the limits of this attribution.

## Safety, verification, and reproduction

The original fail-closed fetch hook and browser firewall are retained in `run.mjs`. Only one local replay is accepted per send; Shift+Enter must accept none. All read-only server snapshots must agree byte-for-byte. The replay answer remains held through placement measurement. The final verification checks the empty composer, original URL, original `butter-blank-head` extension, and absence of replay/probe hooks.

```bash
cd ~/.t3/worktrees/butter/t3-54326eed
bash (not archived)
```

The script rebuilds all three snap-readable variants, measures three cold and three warm runs per variant, checks rail/scroll/resize/near/Shift+Enter, compares server snapshots, and restores the original browser in an EXIT trap. It uses `(not archived)` Playwright and the existing `t09.json` recording. Commands and their actual outputs are in `commands-and-output.md`; individual complete logs and JSON are beside this report.

## node --test

```text
✔ unknown sizes and widths cannot enable skipping; precise content-box sizes survive (1.739133ms)
✔ turn identities are escaped, independent, and late measurements replace old sizes (1.187482ms)
✔ a width change invalidates every previous key, including when returning to an old width (0.279648ms)
✔ turn and block limits evict whole oldest turns, including their stylesheet groups (0.339279ms)
✔ conversation caches never share a turn identity or a width invalidation (0.250046ms)
✔ a recorded class keeps display-math block selectors out of KaTeX descendant span buckets (0.237405ms)
✔ math readiness checks the answer block itself as well as descendant math sources (0.284635ms)
✔ hover wave stays within its targets when the frame timestamp predates kick() (8.556301ms)
✔ hover wave converges monotonically, stays finite across long frames, and stops at rest (9.280381ms)
✔ overlapping older pages deduplicate questions, and an empty final page hides the earlier button (1.315174ms)
✔ wheel invalidates a pending jump before it can settle or pin its old target (2.250107ms)
✔ keyboard invalidates a pending jump before it can settle or pin its old target (1.720528ms)
✔ send invalidates a pending jump before it can settle or pin its old target (1.765891ms)
✔ new click invalidates a pending jump before it can settle or pin its old target (1.842903ms)
✔ Enter pre-jumps a distant send but leaves the last viewport for ChatGPT (1.108749ms)
✔ click pre-jumps a distant send but leaves the last viewport for ChatGPT (1.170484ms)
✔ near-bottom sends and non-send key events preserve the thread position (4.439307ms)
✔ empty composers and disabled send buttons do not pre-jump (1.280999ms)
✔ the current composer submit button works without legacy IDs (1.033273ms)
raf throttle: all checks passed
✔ test/raf.test.mjs (37.000422ms)
ℹ tests 20
ℹ suites 0
ℹ pass 20
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 126.068492
```

## git diff --stat

```text
docs/how-it-works.md     |  15 ++--
 extension/butter-cv.js   | 182 +++++++++++++++++++++++++++++++++++++++++------
 extension/butter-nav.js  |  29 +++++++-
 extension/manifest.json  |   1 +
 test/butter-nav.test.mjs |  73 ++++++++++++++++++-
 5 files changed, 272 insertions(+), 28 deletions(-)
```

New untracked files, intentionally not staged: `extension/butter-height-cache.js` and `test/butter-height-cache.test.mjs`. Their contents are included in `final.diff`.

Verified final restoration:

```json
{
  "url": "<chat>",
  "composer": [
    ""
  ],
  "probe": false,
  "replay": false,
  "cacheSheets": 0,
  "extension": "~/snap/chromium/common/butter-blank-head"
}
```

All server snapshots match: 50 nodes and 12 user turns, with the same current node. Every measured send accepted exactly one local replay and zero escaped browser writes; Shift+Enter accepted none. `verification.log` records every assertion.
