# Method and interpretation

The frozen extension is `(not archived)`, copied unchanged to this task and to snap-readable `~/snap/chromium/common/butter-retention-control`. Browser: headed lab Chromium, software compositing, CDP 127.0.0.1:9222, 1600-by-1000 window; native scroller 912 px high, 1238 px content width, 20 px scrollbar gutter. No tracked Butter source is edited.

Every browser phase owns `~/.local/share/chatgpt-lab/run/lock.d`. Acquisition uses atomic mkdir; an occupied lock is rechecked every 60 seconds and is never broken. Cleanup restarts the original `butter-blank-head` build, opens the original chat, empties the composer, and releases only this task's lock. Later batch phases also wait 60 seconds outside the released lock so other waiters have a real handoff opportunity.

## History, input, and timing

The test chat must have 12 rail questions and no earlier page remaining. Older-history GETs replay the prior captured successful responses to avoid live pagination 429s. Every measured drag asserts full history and records the start/end scroll positions and height. The final guard requires 12 entries in the active virtualizer as well as 12 rail ticks and no previous page. One six-turn capture that slipped past a stale earlier rail-only check was excluded and rerun. The fully settled chat is 312992 px tall. Several valid cold samples have all 12 entries but start near 309750 px and correct by about 3240 px; the raw and exported results retain that drift. Those are not incomplete-history samples.

Native scrollbar input presses the actual minimum-size thumb near the scroller's right edge. Fast input schedules 60 moves over 1200 ms; slow input schedules 120 over 12000 ms, followed by release. Inputs are scheduled independently of main-thread acknowledgments. CDP backlog can therefore extend elapsed input beyond requested motion duration. A track click, short movement, or incomplete-history load does not qualify as a full-history drag.

Cold is a fresh navigation with full history loaded but no exhaustive traversal. Setup necessarily lays out the initial turns. Warm traverses the entire chat in 0.8-screen increments with two rAFs per step before the measured input. Each repetition starts from a new page navigation. Ordinary overscan six can grow to all 12 turns during that traversal: its warm measurements must not be called a strict finite retention cap.

Worst-frame statistics use rAF timestamp intervals through four-second recovery; input-only maxima are retained separately in raw analysis. LoAF blocking is summed blockingDuration, not total frame elapsed time. Chrome traces identify native Layout events over 100 ms and their JS forcing stacks. A large Layout without a recorded JS stack is kept separate from trace-identified forced layout. Probe and screencast overhead applies to all matched drag arms.

Screencast JPEGs are timestamped by CDP. Blankness uses the prior low-ink classifier in central content rectangle $(582,80)$–$(1338,780)$, density below 0.00015. Blank time holds a captured image until the next presentation timestamp. Counts are captured samples, not all 60-Hz display frames. Ordinary whitespace can fool a heuristic; promising clips/contact sheets are inspected. Sparse capture count alone is not a duration or a smoothness score.

## Replay and correctness

Streaming preserves the original benchmark: 189 recorded SSE chunks over 121.771 seconds, a 1500 ms cap on long model pauses, the same wheel/typing input, and the same text hash check. Expected answer SHA prefix is `043dc8afaf8d` (21448 text characters, 420 KaTeX roots). Each streaming arm has three repetitions unless explicitly labeled a failed/excluded setup.

All sends are local fetch replays. A browser-context network firewall additionally aborts upstream conversation/response/completion writes. The send-landing probe delays replayed generation for 15 seconds, so movement is measured before new answer text arrives. It checks one local interception, visible landing, completed replay, and blocked auxiliary prepare calls. No real conversation message is authorized or sent. Before/after read-only server snapshots compare node IDs, user IDs, and current node.

The hold arm uses actual mousedown in the native scrollbar gutter and mouseup/blur restoration, not an artificial harness-only activation. It marks retained turns and answer blocks CV-visible while held and marks newly mounted blocks as they arrive. Ordinary streaming benchmark input uses wheel/typing, so the hold flag remains off during those streaming replays. An already-regressing inactive-hold streaming result cannot establish good streaming while held; this distinction is explicit in the recommendation.

## Scoping and painting

`patch.mjs` intercepts a pinned ChatGPT bundle and validates four overscan sites. The shared state-update helper receives the virtualizer's controller identity. Only the committed scroll/resize callback resolves its stable getScrollElement callback and populates a WeakMap; render sites read the cached instance. Missing/hidden scrollers use overscan two. The first prototype called that callback during render and was rejected by ChatGPT; it is an excluded run.

Every valid arm audits all scrollers: visible/hidden, mounted turns, element count, and (where added) available React entries. Selecting overscan is not an eviction guarantee: the virtualizer preserves an old rendered range if it covers the new one. Hidden transitions require separate eviction/lifecycle handling. A naive strict replacement of that rule was unstable and rejected; see `strict-rejection.md`.

Paint-ahead uses IntersectionObserver rooted at the actual scroller, with one or three screen root margins. It observes both turn wrappers and individual answer blocks so a 30k-px turn does not imply eagerly painting every block. The final observer discovers inserted roots rather than rescanning the whole chat per mutation. Original exploratory IO captures are archived as `screen-v1-*` and excluded from final IO medians.

To isolate hidden-copy cost, overscan alone was insufficient: cached windows sometimes had only five mounted or available entries. The verified `hidden-direct` arm also forces the final computed render range to all available entries and refuses to replay unless a hidden instance has at least nine entries and mounts all of them. Fresh browser sessions reproduced 12 hidden and 12 active turns. The third valid sample supplies complete original captured GET history at initial load and calibrates active layout before measurement; height 312992 and 207410 active elements are mandatory preconditions. An uncalibrated complete-history setup had a different estimated height and was excluded before replay. The active instance has the same 207410 elements as active-only all; after replay it has 13 turns / 234449 elements. This is a diagnostic private-source intervention, not a shippable MV3 response-rewriting API.

## Memory and limits

Primary GC-normalized memory is measured without an active trace in paired expansion probes at the same near-top anchor, after complete history. GC runs before and after; report visible elements, CDP DOM counters, JS used heap, and embedder used heap. CDP DOM counters include detached nodes still retained by React/history caches; their delta need not equal added connected elements. The fixed-anchor result is not a global cap: warmed ordinary six retains all turns. Per-drag heap records collected while tracing are supplementary and are not substituted for these clean expansion values.

Samples are small, sequential rather than randomized, on one browser/session/host with software compositing. Report medians and observed ranges, not confidence intervals or precise causal percentages unsupported by the spread. Historical B1's exact mixture of hidden windows cannot be reconstructed from a new session. The controlled expanded-hidden versus active-only comparison addresses the mechanism; it does not turn a descriptive historical median difference into a precise causal decomposition.
