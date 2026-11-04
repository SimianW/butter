Review scope: working tree against HEAD 9d6cad4fe890a8c523731ed20f261e754d966832, including both untracked files. No repository changes were made. Read AGENTS.md, docs/how-it-works.md, docs/history-rail.md, docs/development.md, lab/README.md, docs/benchmarks.md, implementation, diffs, and tests. The user explicitly required independent work, so no delegation was used.

Candidate findings awaiting browser fixture measurements:

1. Width rules are not guarded by width in CSS (extension/butter-height-cache.js:40-44); JS invalidates them only after ResizeObserver delivery (extension/butter-cv.js:99-105). A sidebar/column change and remount in one React commit can force layout before the callback. Unlike viewport changes it does not generate the window resize listener. The app can measure the old fallback at the new width.
2. Cache identity omits assistant response/revision (extension/butter-cv.js:129; extension/butter-height-cache.js:37-43). Regenerate/branch selection can change content while preserving the question's turn key. Old fallback rules remain across in_progress and return as soon as complete matches. Block index, tag and first class do not distinguish revisions.
3. Conversation isolation exists in JS maps but not CSS (extension/butter-height-cache.js:37-44). Different conversation caches can emit identical selectors and overwrite each other for shared turn IDs; widths need not match. stateFor also uses current location for old hidden scroller insertions (extension/butter-cv.js:25), splitting a scroller across cache states on SPA navigation.
4. A new chat's fallback key is the scroller element itself (extension/butter-cv.js:25,39); disconnected-target cleanup removes watched/columns but never removes this Map key (89-90), retaining the detached subtree until cache eviction. The four-state cap bounds count, not detached subtree size.
5. A queued turn-mark frame can run after conversation eviction (extension/butter-cv.js:32-33,56-67). It observes the still-connected hidden element after watched ownership is deleted. Once detached, cleanup cannot find it to unobserve it. Deterministic VM fixture reproduces this orphan observer target. Narrow race; lower severity.

Other investigations (not yet promoted to findings):
- sizes queued for the 1 s flush are revalidated only for connection, so they can outlive completion/math state and a width round trip. The VM demonstrates the bookkeeping, but a visible production consequence independent of findings 1/2 is not established.
- The pre-jump listener runs before an Enter-consuming popup can cancel the event; it also ignores defaultPrevented. The VM demonstrates the event path; a live popup failure is unconfirmed. Do not confuse this with the specified modifier/IME/empty/disabled filtering, which the tests cover.
- No persistent storage or extension-initiated network requests were added.
- CSS.escape is used for actual selector construction; the unit test's local escape stub is narrower but is not shipped.
- The new height-cache tests execute the cache class and mock mathReady only; they do not run butter-cv.js, ResizeObserver, MutationObserver, the delayed flush, or real CSS matching.
