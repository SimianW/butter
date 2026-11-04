# Measurement definitions

The drag/stream schedules and analysis are copied from `(not archived)`. The requested base includes pre-jump and native-thumb hold. It is frozen from the specified worktree; historical retention controls are background only and are not pooled with this experiment's control.

- Native scrollbar drag: CDP minimum-thumb press, independently scheduled moves (60 over 1.2 s fast; 120 over 12 s slow), release, four-second recovery. No synthetic scroll event substitutes for input.
- Cold: fully paginated fresh navigation, without full viewport traversal. Warm: traverse the whole chat using the existing two-rAF-per-viewport schedule, then return to the start. Cold setup itself visits turns while loading history; it is not a zero-cache/unseen-everywhere state.
- Worst frame: maximum rAF interval including recovery. LoAF blocking: sum `blockingDuration`. These measure different things; a smooth animation rate does not prove absence of a single long stall.
- Forced layout: native trace `Layout` above 100 ms with a JS stack. The `clientWidth` timing wrapper preserves native values and logs only slow calls during drag probes. It is disabled for all streaming replays. Performance.getMetrics attribution under a JS getter wrapper can classify work differently, so native trace Layout events are authoritative for layout time.
- Blank duration: original low-ink crop heuristic, held between CDP screencast timestamps, not a count of every display refresh. Whitespace can be blank-looking; videos and contact sheets should accompany the numbers.
- Height corrections: every sampled `scrollHeight` change; ranges reported for measured input. Native-scroll backward steps are separately flagged, because compositor/main disagreement can occur with constant total height.
- Streaming: 189 original chunks, original replay timing with long pauses capped at 1.5 s, all chunks and answer hash checked. Three replays per measured arm; median LoAF blocking and largest keypress across those replays reported. A fresh full-history page is used for every repetition.
- Memory: independent reload/full-history/fixed-anchor/idle/forced-GC procedure; JS and embedder heap plus DOM counters. Differences in hidden-copy counts must be disclosed rather than interpreted as a cache memory saving. Drag-trace heap values are separate, not pooled into independent memory comparisons.
- Send: local fail-closed renderer replay, held 15 s for landing; independent browser-context write firewall. No real message. Compare server mapping/current node and user IDs before and after all replay phases.
- Rail: real extension click to first rail question after full history has loaded, from the bottom; assert near-top placement and no busy state. This supplements the copied deterministic fixture method with the actual long chat.

Run order is batched and uses a shared browser lab; observations are descriptive medians/ranges, not randomized causal confidence intervals. Every omitted metric is marked pruned/unmeasured, never zero.

The earliest control screen predates the added slow-width timing wrapper. Native trace, rAF, LoAF, input and blank probes are the same; later drag probes preserve the native width return and record only slow calls. The wrapper is disabled for every streaming replay.
