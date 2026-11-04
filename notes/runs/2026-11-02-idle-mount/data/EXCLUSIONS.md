# Excluded setup/attribution samples

- `hidden-screen/rep-1.json`: old state-only adapter had stale native scroll-state ref. `before.nodes=107726`, only nine document turns before send; it had already discarded full retention. Its 6922 ms blocking is not hidden retention evidence. End-transition observation was also late. Kept only as a diagnosed failed setup.
- `control-grown-fast-r1` through `r3`: early complete-history shortcut had unmeasured geometry and moved the requested top anchor before drag. Replaced with calibrated first-to-last drags. They do reproduce some virtualizer costs, but are excluded from final comparisons.
- `screen-transition.json`: source exploration before updating native state ref. Per-commit latency is real; not a valid promise of retention through subsequent scrolling. Replaced by corrected three-run `growth-transition-r*`.
- `screen-staged` and `screen-staged-v2`: deliberately stopped after target failures. `staged-pruned.json` and `staged-v2-pruned.json` are the captured active prefixes; no full-growth completion, streaming, or final-geometry claim.
- `stream-hidden-screen` first attempt: CDP not ready after browser launch (ECONNREFUSED). No replay started; phase restored correctly. Phase runner now waits for CDP readiness.

Growth runs with FORCE_FULL=1 are deliberately cold mount-cost probes. Total document height initially contains estimates and can grow as turns are measured; these are not calibrated drag samples. Report that geometry change as a cold limitation.

The true hidden-retention arm is retained as one valid failure screen, with subsequent repeats deliberately pruned after 43,993 ms blocking versus 5,804 ms control median. See hidden-pruning.md. The complete-matrix exit 143 records that intentional stop; shrink and follow-up phases resumed separately.

The display-none streaming arm completed one valid 189-chunk screen (17,797 ms blocking and 939.7 ms worst key), over three times the control median. Remaining repeats, send and lifecycle cells are pruned after that failure.

The first growth-deferred-transition-screen was deployed before its refreshed callsite pin: stats.deferred is empty and no refStacks diagnostic was included. It is excluded as a deferred-mechanism test (its cache/transition timing remains a duplicate attribution screen). A corrected source-pinned rerun is required and recorded separately.

The first lifecycle run completed eviction/hiding/cap/settings probes but its post-switch readiness assertion required data-turn-key in the short original chat. The visible composer was ready; the virtualizer-only assertion timed out. The phase restored normally. A corrected run saves intermediate probes and waits for the editor on the target short chat.

The refreshed deferred trial growth-deferred-transition-corrected also stayed fail-closed: its recorded stack is now 396705.4bac22fd0d.js:43:528606, while the exact observed previous source was 396705.d90cd7b3ef.js:43:528586. ChatGPT changed the neighboring bundle during this session. No deferral is credited to that trial. The final rerun accepts only those two observed pins, with completion/cache/identity/width guards unchanged.

The corrected lifecycle probe verified SPA departure and memory release, but its router call used an absolute URL and landed on the home page. Its isolated transitions/settings/memory values remain valid; it is not credited as chat-to-chat navigation. A separate pathname-based probe asserts the exact original conversation ID and checks cached scroller counts.
