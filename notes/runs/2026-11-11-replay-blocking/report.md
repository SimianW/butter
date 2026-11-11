# Streaming replay blocking control

**The completed control supports H3: Butter regressed after released alpha.11.** On today's same page and host, alpha.11 has about 13–14 seconds of LoAF blocking while current main has about 66–67 seconds, under both methods. The expected fast-old/slow-main separation holds with matching selectors and active Butter counters. The control itself did not isolate the responsible change; the follow-up [Bisect](#bisect) identifies commit `4780e17`. No extension code was changed.

| Ranked hypothesis | Prediction | Observed test and verdict |
|---|---|---|
| H1: DOM changes broke stream selectors | Inner thread wrapper stays inline-size or streaming state disappears; alpha.11 and main both become slow. | Not supported. The original selector matches two roots globally; the visible inner wrapper computes normal with either extension; every midpoint has one in_progress turn and active skipping/counters. Alpha.11 remains fast. The intentionally retained outer container is present in fast and slow arms. |
| H2: shorter readiness / idle typing caused the jump | Both extension builds are fast under M1 and slow under M2. | Not supported. Alpha.11 remains fast and main remains slow under both. Small window/readiness differences remain measurable, but do not approach the roughly 55-second historical discrepancy. |
| H3: regression after alpha.11 | Under an identical method, alpha.11 is near the old low-blocking behavior and main is near 66 seconds, with selectors matching in both. | Supported under both methods with three repetitions per build per method. The observed blocking separation is about fivefold; this concerns total blocking, not replay wall duration, which remains about 122 seconds for all arms. |
| H4: environment changed | No-extension blocking moves far from 76.4 seconds. | Not supported as the explanation of this jump. No-extension medians are about 71–72 seconds (roughly 5–8% lower); browser/kernel/OS/CPU/software GPU match, and alpha.11 is still fast on the same changed ChatGPT asset set. |

A code/page interaction can still contribute to the regression; this control rejects the specific missing-selector mechanism, not every possible interaction with ChatGPT's current page. The earlier #92 acceptance comparison already found its two heads equal; this run does not attribute the regression to #92.


Both methods and all three builds completed $n=3$ each, in rotating interleaved orders. The old aborted run and its no-extension observation remain excluded. The control stage changed no extension code and performed no bisection; the authorized follow-up is below. Raw captures stay local; this publication contains sanitized reports and numeric JSON.

## Builds and method

- None: empty extension list, verified from `chrome://version` each repetition.
- Released alpha.11: `37a2b4536d0c47c5f3b9997ad2ab4772f89ab2c3`; exact release ZIP SHA-256 `8cc5476fdd0ac4748aa2b726dd0a1c1308f0b7ec6a63c3bd19dbd77c1f57a3ef`. Fresh empty unpacked directory; source/staging byte checks.
- Current main: `2f2412706c318e2592c081e13436cee8e1af80c6`; fresh `git archive origin/main extension` after fetch.
- Frozen history SHA-256 `359b4fe33317cb357e4f6646f3dc443dd6338241e53897039349c23fa239d345`; recording SHA-256 `36b773bf0733ff3f4df3856157834243bfdcf886af1fbc2f0600631d251ca05c`.
- Every replay: 189 local SSE chunks; full expected answer SHA-256 `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68`. Zero completed ChatGPT network writes and zero escaped replay POSTs. Denials mean protection worked; counts and sanitized path templates are in `data/denials.json`.
- Extension-local/session storage cleared before each repetition, then seeded with `{butter:{enabled:true,layoutConsent:'granted',opts:{layout:true}}}`. Both versions normalize this shape; omitted feature switches default on. None skips extension seeding and rail/CV preflight, while auth, fixture history and send guard remain mandatory.
- Actual order per method: none1 → a11-1 → main1 → a11-2 → main2 → none2 → main3 → none3 → a11-3. M1 completed before M2; no parallel timing work.

| Variable | M1: recovered November 4 stream scenario | M2: PR #92 acceptance adapter |
|---|---|---|
| Driver provenance | `stream.mjs`, SHA-256 `d1e58f61c93139d32603964f5d09414efe200c052340a00d8be9460670422991` before path adaptation | `bench-live.mjs`, SHA-256 `0249f58a22ce0c92703a198af7551849f31254ac938680ebe1061dc4b1235630` |
| Readiness before replay | Composer visible → 8 s; `full()` waits for a visible scroller with a turn → 2 s; theme pin → 5 s; scroll to bottom → 1.5 s. Fixed waits total 16.5 s, plus page/render/automation time. | Composer visible → 8 s; theme pin and auth/rail/CV/fixture preflight; scroll to bottom → 1.5 s. Then separate idle typing. |
| “Fully settled” readiness | No long-task or pending-math readiness in recovered stream scenario. That check is in the separate `nonstream.mjs` opening scenario. | No long-task/pending-math check. |
| Idle input before replay | None. | 54 letters at 80 ms per letter, 250 ms wait, then clear. |
| Scroller and composer | Visible `.thread-scroll-container`; visible `.ProseMirror`. | Same. Excluded #92 pilots used the hidden first scroller. |
| Wheel schedule | While streaming, 3 × 250 px, 30 ms between wheel acknowledgements, every 1500 ms; alternating direction. Serial CDP acknowledgements determine actual cadence. | Same. |
| Streaming typing | Two ten-letter bursts at one-third/two-thirds scheduled replay time, 120 ms spacing; ten Backspaces each; 250 ms driver poll. | Same. |
| Recording and replay timing | Same 189 chunks; initial 300 ms; inter-chunk thinking gaps capped at 1500 ms; local SSE fetch response; full answer textContent SHA-256. | Same bytes, schedule and replay hook. |
| LoAF/frame window | Observers start before Enter; stop after stream completion, 3 s tail wait, answer hashing and fixture check. First frame discarded; no replay-bound filtering. | LoAF start times / frame timestamps filtered to replay start through end; key listener letters/Backspace only while streaming. Attribution aggregation still covers the whole observer window. |
| Key filtering | All keydowns while replay active, including non-letter modifier events. | Letters/Backspace only. |
| History routing | Frozen `math-nine.json` plural conversation GET fulfilled; singular conversation GET denied; fixture identity observer; WebSockets closed and service-worker bypass. | Same frozen body and isolation; equivalent fixture observer. |
| 50 ms history page delay | Only inside `if(paged)` in `fixtures.mjs`; stream calls `history(ctx,'math-nine')` without paging, so **no delay**. | No delay. |
| Consent/storage | alpha.11 popup helper updates `butter.enabled`, `butter.layoutConsent='granted'`, `butter.opts.layout=true`; unrelated existing options historically preserved. This control clears task-extension local/session storage each repetition, then seeds the documented build-native shape. | Clears extension local/session storage then sets `{butter:{enabled:true,layoutConsent:'granted',opts:{layout:true}}}`. Same shape works in both source versions; omitted feature keys normalize to on. None skips the seed and Butter rail/CV checks. |
| Browser flags | Historical classic phase: normal lab flags, selected extension only; no extra flag. | Normal lab flags plus `--disable-extensions-except=<selected extension>`; none has no extra flag. |
| Viewport/theme | Headed Xvfb; 1440 × 1000 CSS px, light media and pinned light DOM attributes. | Same. |
| Restart/startup | Each control run restarts browser, waits for CDP and 3 s. Historical startup wrapper also waited 3 s. | Same control startup; original adapter additionally waits 3 s after CDP is reachable. |
| Control-only observation | Auth/send guard, storage seed, environment capture, before/after Butter stats and replay duration, saved raw observer arrays; no extension source changes. Existing M1 fixture routing and scenario retained. | Same observations; original #92 safety checks retained. |


## Selector probes

The same probe runs immediately before Enter and at the first driver poll with at least half the chunks sent. It enumerates computed non-normal containers inside the visible scroller plus ancestors through `main`, counts classic/Dil/turn-state/Butter attributes globally and visibly, counts auto-skipped answer-root children, and captures `data-butter-off` and `__butterStats`. [Every non-normal container, class and subtree count](containers.md); all numeric per-run probes are in `data/runs.json`.

The original thread selector matches two roots globally (visible plus hidden). With either extension loaded, the inner thread wrapper computes normal; without extension it remains inline-size. A footer and the outer `MainContentFrame-sss8BP` ancestor retain inline-size in all arms. The outer ancestor is shared by fast and slow extension results; its presence alone does not explain their difference.

Counts below are ranges across the six matrix repetitions per build (three per method), within the visible scroller. Global counts and full state-value distributions are retained in numeric data. All extension off markers were empty.

| Build | Probe | Original selector globally | Turns | Answer roots | Dil roots | in_progress | Seen | Unrendered | Auto answer blocks | Butter published |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| none | before | 2 | 5 | 5 | 0 | 0–0 | 0 | 0 | 0 | absent |
| none | mid | 2 | 4 | 4 | 0 | 1–1 | 0 | 0 | 0 | absent |
| a11 | before | 2 | 5 | 5 | 0 | 0–0 | 2055–2932 | 0 | 2050–2927 | 0–0 |
| a11 | mid | 2 | 4 | 4 | 0 | 1–1 | 1421–1864 | 172–174 | 1600–2041 | 147–148 |
| main | before | 2 | 5 | 5 | 0 | 0–0 | 2932 | 0 | 2927 | 0–0 |
| main | mid | 2 | 4 | 4 | 0 | 1–1 | 1861–1862 | 174–175 | 2041 | 140–142 |

Probe cost is measured for each capture. Scanning computed styles in content-visibility subtrees can force expensive work; pre-Enter probes can appear in M1's LoAF duration window even though their start precedes Enter. These frames must not be confused with streaming freezes. Midpoint probes occur within the replay. No metric is adjusted or probe-overlapping frame silently removed; raw requested windows are preserved. The requested total blocking uses LoAF blockingDuration, while longest LoAF uses duration. The separately labeled `data/probe-sensitivity.json` records overlap counts, overlap blocking and longest LoAF outside probe intervals; these diagnostics do not replace the requested primary metrics.

## Blocking per cell, milliseconds

| Method | None | alpha.11 | Main |
|---|---|---|---|
| M1 | 72444 [71781–73140], $n=3$ | 13966 [12982–17146], $n=3$ | 66707 [66149–66955], $n=3$ |
| M2 | 70628 [69877–71169], $n=3$ | 12772 [12428–12990], $n=3$ | 66408 [66272–67236], $n=3$ |

## Other metric medians [min–max]

Every cell has $n=3$. Longest LoAF includes the required selector probes.

| Metric | Method | None | alpha.11 | Main |
|---|---|---:|---:|---:|
| Longest LoAF ms (includes probes) | M1 | 2737 [2697–2744] | 6660 [6621–6703] | 9052 [9028–9110] |
| Longest LoAF ms (includes probes) | M2 | 1362 [1355–1410] | 2381 [2311–2438] | 4017 [3956–4072] |
| LoAF count | M1 | 404 [403–406] | 375 [371–377] | 317 [314–323] |
| LoAF count | M2 | 389 [386–393] | 367 [367–377] | 329 [320–331] |
| Frame p95 ms | M1 | 283.2 [266.7–283.3] | 50.1 [50–66.7] | 250 [249.9–250.1] |
| Frame p95 ms | M2 | 283.4 [283.3–283.4] | 50 [50–50.1] | 266.7 [266.6–266.7] |
| Replay duration ms | M1 | 121771 [121771–121782] | 121771 [121770–121772] | 121804 [121771–121809] |
| Replay duration ms | M2 | 121771 [121771–121791] | 121771 [121770–121771] | 121784 [121773–121794] |
| Key max ms | M1 | 322 [271.2–395.1] | 303.8 [281.6–310.1] | 651 [632.2–654] |
| Key max ms | M2 | 379.9 [308–416.1] | 281.8 [281.3–290.6] | 702.9 [690.7–714.7] |
| Key p95 ms | M1 | 281.5 [271–289.5] | 278.7 [276.4–303.8] | 629.8 [624.1–636.4] |
| Key p95 ms | M2 | 309.7 [289.7–351] | 265 [256.5–270.6] | 672.5 [662.1–685] |

## Probe-overlap sensitivity

The primary numbers above remain unchanged. The following diagnostic excludes any LoAF intersecting a probe interval when computing the longest remaining LoAF. Overlap is conservative and does not assign all time in that frame to the probe. Required probe frames are long but contribute zero blocking in the extension arms.

| Method | Build | Longest outside probes ms, median [min–max] | Overlap blocking ms range |
|---|---|---:|---:|
| M1 | none | 2737 [2697–2744] | 0–0 |
| M1 | a11 | 805 [727–853] | 0–0 |
| M1 | main | 1560 [1538–1564] | 0–0 |
| M2 | none | 1362 [1355–1410] | 0–0 |
| M2 | a11 | 709 [689–723] | 0–0 |
| M2 | main | 1536 [1530–1556] | 0–0 |

## Every run

All rows have 189 chunks, matching answer SHA-256, zero completed ChatGPT writes and zero replay escapes. Denials show fetch / route counts; they are not added together as unique attempted requests.

| Run | loafBlockMs | loafMaxMs | loafCount | frame p95 ms | replay duration ms | keyMax ms | keyP95 ms | Denials fetch / route |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| M1-none-1 | 72444 | 2737 | 404 | 283.2 | 121781.5 | 395.1 | 289.5 | 45 / 3 |
| M1-a11-1 | 13966 | 6621 | 377 | 50.1 | 121771.0 | 303.8 | 278.7 | 46 / 4 |
| M1-main-1 | 66955 | 9028 | 317 | 250 | 121808.9 | 651 | 629.8 | 46 / 1 |
| M1-a11-2 | 12982 | 6660 | 371 | 50 | 121772.0 | 281.6 | 276.4 | 46 / 3 |
| M1-main-2 | 66707 | 9110 | 314 | 250.1 | 121771.1 | 632.2 | 624.1 | 46 / 3 |
| M1-none-2 | 73140 | 2744 | 406 | 283.3 | 121770.8 | 271.2 | 271 | 46 / 1 |
| M1-main-3 | 66149 | 9052 | 323 | 249.9 | 121803.6 | 654 | 636.4 | 46 / 3 |
| M1-none-3 | 71781 | 2697 | 403 | 266.7 | 121770.6 | 322 | 281.5 | 45 / 2 |
| M1-a11-3 | 17146 | 6703 | 375 | 66.7 | 121770.5 | 310.1 | 303.8 | 49 / 3 |
| M2-none-1 | 70628 | 1410 | 386 | 283.4 | 121771.3 | 416.1 | 351 | 46 / 2 |
| M2-a11-1 | 12990 | 2438 | 367 | 50.1 | 121770.4 | 281.3 | 256.5 | 46 / 2 |
| M2-main-1 | 66272 | 4072 | 331 | 266.7 | 121794.4 | 714.7 | 685 | 46 / 2 |
| M2-a11-2 | 12772 | 2381 | 377 | 50 | 121771.0 | 290.6 | 265 | 45 / 1 |
| M2-main-2 | 67236 | 4017 | 320 | 266.7 | 121772.6 | 690.7 | 662.1 | 49 / 1 |
| M2-none-2 | 71169 | 1355 | 389 | 283.4 | 121771.4 | 308 | 289.7 | 49 / 2 |
| M2-main-3 | 66408 | 3956 | 329 | 266.6 | 121783.6 | 702.9 | 672.5 | 46 / 2 |
| M2-none-3 | 69877 | 1362 | 393 | 283.3 | 121791.2 | 379.9 | 309.7 | 46 / 2 |
| M2-a11-3 | 12428 | 2311 | 367 | 50 | 121770.7 | 281.8 | 270.6 | 45 / 2 |

Per-run before/after DOM nodes, turns and KaTeX, Butter stats, blockAdds, seenMarks, remount counts, and LoAF attribution (render style/layout, forced style/layout, script excluding forced layout) are in `data/runs.json`. DOM counts include ChatGPT's hidden root, as in the recovered driver. Method/frame/key metric definitions remain distinct as documented above; results are host-specific.

## Ablations

- Ablation A not run: the thread wrapper computes normal with both builds; the remaining large ancestor also occurs in the fast alpha.11 arm and is the intentionally retained outer container. The requested trigger was absent.
- Ablation B not run: the completed methods do not show a material within-build separation requiring the readiness control. Per-method values and ranges remain in the table; no extra timings were silently pooled.

## Environment and ChatGPT build

- Chromium 156.0.8078.47, official snap x86_64; read from `chrome://version` on each attempted arm. Same as November 4.
- Ubuntu 24.04.5 LTS; kernel `7.0.0-38-generic`; Intel Core i5-10400 at 2.90 GHz, 12 CPU threads. These match the historical environment capture.
- Headed Xvfb, 1440 × 1000 CSS viewport, light media/DOM theme; lab launch window is 1600 × 1000. No headless flag.
- GPU renderer: `ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5 (Core Profile) Mesa 25.2.8-0ubuntu0.24.04.2)`. GPU compositing/rasterization disabled in software; matches the archive.
- `chrome://version` command line, with private profile/endpoint values redacted: `/snap/chromium/3569/usr/lib/chromium-browser/chrome --password-store=basic --gtk-version=3 --disable-features=TFLiteLanguageDetectionEnabled --user-data-dir=<LAB_PROFILE> --remote-debugging-<REDACTED> --remote-debugging-<REDACTED> --no-first-run --no-default-browser-check --password-store=basic --window-position=0,0 --window-size=1600,1000 --ozone-platform=x11 --flag-switches-begin --flag-switches-end https://chatgpt.com/`. Alpha.11 additionally had the task-owned `--load-extension` path; no extra M1 flags. M2 retained #92's `--disable-extensions-except` flag.
- No explicit page build id was exposed. Today's public assets include `manifest-42f0cd0e.js`, `807489.7f5d47cb0e.js`, `633146.acefa13d1a.js`, `226913.27c93050ff.js` and `731863.e2c3850b56.js`; the [public bundle inventory](app-assets.md) retains all captured public app asset URLs.
- Historical raw LoAF captures retain source bundle basenames, not a complete app build manifest. They include `807489.43c08228d1.js`, `633146.2285f1d8aa.js`, `226913.d4efcaca8e.js` and `731863.0ff6d7d48b.js`. These changed suffixes establish a different observed app asset set, not the cause of the timing change. Older raw captures themselves also contain more than one revision of some bundles; this was not a fully pinned page build.



## Lock and cleanup

Owner `replay-blocking`, fixture `math12`. The first rerun lock was acquired 2026-11-11T20:55:30.259549+00:00. A user/tool interruption terminated the runner during the seventh replay; explicit restore and release succeeded before a new lock was acquired. Six completed valid samples were preserved; the unfinished seventh attempt is excluded and was rerun. The resumed matrix and any ablations used the second lock through final restore 2026-11-11T21:50:55.323772+00:00 and release 2026-11-11T21:50:55.438977+00:00. All restore/release commands exited 0. Exact window boundaries are in commands.md and numeric cleanup data. The coordinator evaluated the ablation triggers after the matrix and selected no eligible ablation before cleanup. Final lock status and checkout/build verification are exported as numeric data. No shared checkout branch, index or working-tree change. Task-owned Snap-readable build copies are removed after unloading; raw captures remain in the mode-700 temporary directory.


| Window | Acquire completed UTC | Restore completed UTC | Release completed UTC |
|---|---|---|---|
| First rerun | 2026-11-11T20:55:30.259549+00:00 | 2026-11-11T21:15:44.189587+00:00 | 2026-11-11T21:15:44.253556+00:00 |
| Resumed matrix | 2026-11-11T21:15:59.206131+00:00 | 2026-11-11T21:50:55.323772+00:00 | 2026-11-11T21:50:55.438977+00:00 |

## Excluded attempts

The rerun also excluded one unfinished M1-main-3 attempt terminated by the user/tool interruption after its midpoint probe and 105 chunks at its last logged progress sample. No final metric record was written, so it contributes no timing statistic. A fresh repetition replaced it after explicit restore/release and reacquisition.

The initial task's CDP startup failure, write-guard preflight stop, and completed no-extension observation remain excluded. The excluded observation had 76890 ms total blocking, 2916 ms longest LoAF, 333.3 ms frame p95, 189 chunks and the expected hash, with zero completed writes but 46 fetch denials and three route denials. Under the original mistaken rule this was excluded; it is not reinstated or pooled into the rerun. Alpha.11's old attempt stopped before replay. Both old lock windows restored/released successfully. The corrected rule treats denial as expected and stops on completed writes, replay escapes, send-guard failure, expired auth or fixture mismatch.

## Control publication and privacy

The control publication parent was `a86d2905952a4a6b9ff7f92a038c89da459cda3f`; that stage made one new commit, fast-forward push to `t3/replay-blocking`, no PR. Only run report files and the README index row change. [Commands and redacted actual output](commands.md). Public [bundle inventory](app-assets.md). Numeric exports contain no strings/null leaves. Sanitized denial templates are published only after privacy scans; challenge path suffixes and IDs are replaced with `<id>`. Private identifiers, chat URLs, emails, tokens, private endpoints and captured prompt/answer text are excluded. Raw captures are never published.

## Bisect

**First bad commit: `4780e17d5f043f9b6a8006f91c244426e7336476` (PR #24), “record real Dil response blocks and display math geometry”; actual parent `fec083e7c71a13a3d6fbd99142e3025e1da2aef0`.** The parent controls are 16341 and 12666 ms blocking; first-bad controls are 66616 and 67457 ms. Nine bisect replays isolated the commit; four interleaved controls confirm the separation. There were no intermediate results or skipped builds.

The leading mechanism is the new Dil-aware relational selector structure in `stream/containment.css`, especially the classic-answer fallback `[data-markdown-text-style="assistant-message"]:not(:has([class*="DilResponseRoot"]))`. The previous rules selected direct answer children. This commit adds `:is(...:not(:has(...)), ...)` to intrinsic-size, seen-block, streaming-block and unrendered-block rules, and introduces the same root expression in `stream/offscreen.js` and seek queries. On this fixture every probe reports zero Dil roots, so the negative `:has` fallback is exercised. Its descendant/class dependency can invalidate style on a large classic answer as streamed descendants change.

The evidence favors style invalidation cost over a missing selector or a disabled stream path: both builds match the original container selector, compute normal containment on the thread wrapper, retain one in_progress turn, have empty off markers, and skip comparable answer blocks with increasing Butter counters. The paired-control median render style/layout grows from 24297.4 to 68502.8 ms, compared with forced style/layout 2167.8 to 6383.3 ms and script time excluding forced layout 2290.0 to 4028.4 ms. The rendering increase is far larger than the script increase. These attribution components are measured over the recorder window and are not added together as a causal decomposition of blocking.

Commit-level attribution is confirmed. Attribution to the specific `:has` rules is the strongest reading, not a separately isolated rule-level result: the commit also changes offscreen target queries, seek/math geometry and settings probes. No selector ablation or extension-code edit was performed in this pass. Empty source URLs in LoAF records remain unavailable/anonymous; they cannot honestly be assigned to an extension function. The public ChatGPT manifest stayed `manifest-42f0cd0e.js` across the bisect captures.


The control was first published as `07584a1a2befee5f57f50ee09b0e69d336234ebd`. This follow-up uses that commit as parent. Good endpoint `37a2b45` matches the released alpha.11 ZIP byte for byte; known bad endpoint is `a100fd6` from the #92 control. Current main `2f24127` is also bad. First-parent extension-touching points matched the supplied list exactly. The bisect M2 driver, selector probes and guards are byte-identical to the control after output-path substitution; no scenario or extension code changes.

Classification: under 25000 ms good; over 50000 ms bad; any in-between point gets two additional replays and median classification, with an intermediate median treated as below the search target when locating the first point over 50000 ms. Budget used: 9 of 12 bisect slots plus 4 of 4 control slots. Skips: 0. No samples outside the budget are pooled.

### Bisect table

Internal branch commits have indices starting at 1000; control-only actual parents use 2000/2001 as needed. Index → SHA/PR mapping is explicit below; numeric leaves are in `data/bisect.json`.

| Index | SHA | PR | loafBlockMs per bisect rep | Verdict |
|---|---|---|---|---|
| 12 | `9f72525cf723715218b446f834177fef7360021e` | #60 | 65356 | bad |
| 6 | `0560ae56b3f0d469c12aff3ae1a9ea7fd18774d4` | #24 | 66358 | bad |
| 3 | `e4a4eb5b60db1d4a6f153ef2726e2bc564df2d2a` | #16 | 11829 | good |
| 4 | `cc12fe22d1f609ac739f6df240a92b02d74b8504` | #19 | 12783 | good |
| 5 | `482a427482720bb012e1bcb31eae6af1a8274c1d` | #22 | 12877 | good |
| 1005 | `c315410e80bcac8adf11a6572fd72b7e6991c443` | #24 | 63913 | bad |
| 1002 | `f5d6b9686bcdba1acf741ffe3ae0aaef21b0ee39` | #24 | 12882 | good |
| 1003 | `b5229ee18de3952777e659255bf67c23ae512e96` | #24 | 12947 | good |
| 1004 | `4780e17d5f043f9b6a8006f91c244426e7336476` | #24 | 65930 | bad |
| 2001 | `fec083e7c71a13a3d6fbd99142e3025e1da2aef0` | — | control only | good (controls) |

First bad merge: `0560ae56b3f0d469c12aff3ae1a9ea7fd18774d4` (#24). Final first bad commit: `4780e17d5f043f9b6a8006f91c244426e7336476`; actual parent: `fec083e7c71a13a3d6fbd99142e3025e1da2aef0`.

Extension diffstat:

```text
extension/seek/anchor-main.js       |  2 +-
 extension/seek/core-main.js         | 27 +++++++++++++++++++++++----
 extension/seek/layout-cache-main.js | 33 +++++++++++++++++++++++++++------
 extension/seek/layout-codec.js      |  4 ++--
 extension/seek/preview-main.js      |  4 ++--
 extension/shared/settings.js        |  5 ++++-
 extension/stream/containment.css    | 11 +++++++----
 extension/stream/offscreen.js       |  6 ++++--
 8 files changed, 70 insertions(+), 22 deletions(-)
```

### Interleaved controls

Order: parent → first bad → first bad → parent, within the same lock as all bisect points. Each row has 189 chunks, the expected answer SHA-256, zero completed network writes and zero escaped replay POSTs.

| Run | Build | loafBlockMs | Frame p95 ms | Key p95 ms |
|---|---|---:|---:|---:|
| control-i2001-r1 | parent | 16341 | 66.7 | 293.2 |
| control-i1004-r2 | first bad | 66616 | 266.7 | 695.7 |
| control-i1004-r3 | first bad | 67457 | 266.7 | 1220.3 |
| control-i2001-r4 | parent | 12666 | 50.1 | 252.5 |

### Paired-control Butter probes

Ranges across the two control runs per build; counts scoped to the visible scroller unless marked global.

| Build | Probe | Original selector globally | Turns / roots | Dil roots | in_progress | Seen | Unrendered | Auto blocks | Published |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|
| parent | before | 2 | 5 / 5 | 0 | 0 | 2932 | 0 | 2927 | 0 |
| parent | mid | 2 | 4 / 4 | 0 | 1 | 1864 | 172 | 2041 | 147 |
| bad | before | 2 | 5 / 5 | 0 | 0 | 2932 | 0 | 2927 | 0 |
| bad | mid | 2 | 4 / 4 | 0 | 1 | 1861–1862 | 174–175 | 2041 | 141 |

### Attribution comparison

Medians [min–max] across the two control replays per build. Values are milliseconds. Render style/layout and script attribution cover the original recorder window; primary blocking is replay-bounded M2. Script time below excludes forced style/layout. Probe costs remain included as in the control and do not change the scenario.

| Metric | Parent | First bad |
|---|---:|---:|
| loafBlockMs | 14503.5 [12666.0–16341.0] | 67036.5 [66616.0–67457.0] |
| renderSLMs | 24297.4 [22416.4–26178.5] | 68502.8 [68230.4–68775.2] |
| forcedSLMs | 2167.8 [2023.1–2312.4] | 6383.3 [6164.8–6601.8] |
| scriptMs | 2290.0 [2239.4–2340.6] | 4028.4 [3820.3–4236.6] |

Top LoAF script attributions, median ms per run. Total is script plus forced layout. Source basenames are resolved against public page resources or the archived extension; anonymous sources remain explicit. Curly-braced extension paths mark ambiguous duplicate basenames rather than guessed attribution. Numeric row indices map to `data/bisect-attribution.json`.

| Row | Source path | Function / invoker | Parent total | Bad total | Parent forced SL | Bad forced SL |
|---|---|---|---:|---:|---:|---:|
| 0 | `unavailable/anonymous` | `?` / `TimerHandler:setTimeout` | 2802.6 | 5391.9 | 1259.6 | 3458.3 |
| 1 | `/cdn/assets/200429.82d37d45f2.js` | `r` / `TimerHandler:setTimeout` | 326.3 | 1580.5 | 0.0 | 0.4 |
| 2 | `/cdn/assets/767086.e730a8ccb4.js` | `callback` / `ResizeObserverCallback` | 315.9 | 1311.2 | 300.6 | 1284.4 |
| 3 | `/cdn/assets/447351.496da706c3.js` | `?` / `DIV.onkeydown` | 674.2 | 1068.9 | 383.6 | 714.9 |
| 4 | `/cdn/assets/698524.1d78dbab32.js` | `r` / `DOMWindow.oninput` | 289.6 | 938.3 | 204.8 | 849.8 |
| 5 | `/cdn/assets/979380.94a5c47756.js` | `flushUserScrollDecay` / `FrameRequestCallback` | 0.0 | 75.8 | 0.0 | 75.6 |
| 6 | `/cdn/assets/646436.30c2553f0b.js` | `?` / `IDBRequest.onsuccess` | 21.8 | 35.5 | 0.0 | 0.0 |
| 7 | `/cdn/assets/299268.dcf716ef7a.js` | `?` / `FrameRequestCallback` | 19.9 | 0.0 | 19.1 | 0.0 |
| 8 | `/cdn/assets/767086.e730a8ccb4.js` | `?` / `DIV.onscroll` | 7.7 | 5.2 | 0.0 | 0.0 |
| 9 | `/cdn/assets/7078.5cd07a5c9b.js` | `?` / `EventTargetImpl.onclose` | 0.0 | 4.5 | 0.0 | 0.0 |

Before/half-stream counts, off markers, Butter counters, remounts, DOM counts and all denial counts are in each run's numeric record. Full local raw attr maps remain private. Storage normalization accepted the exact control seed at every tested point; `data/bisect.json` records per-build checks. Every build was archived into a new directory and compared byte-for-byte before staging, with a final pristine check after cleanup.

### Bisect lock, cleanup and publication

Fresh lab/perf lock owner replay-blocking, fixture math12: acquire completed 2026-11-11T22:55:52.644565+00:00; restore completed 2026-11-11T23:34:07.443005+00:00; release completed 2026-11-11T23:34:07.557087+00:00. Restore/release exit codes 0/0. The detached coordinator survived a conversation interruption without stopping the browser or changing this lock window. Raw captures remain local under `/tmp/replay-blocking-work/bisect/`. No shared branch, index or working-tree changes, no extension code changes, no PR. The follow-up privacy scan covers every published file and all JSON numeric leaves.
