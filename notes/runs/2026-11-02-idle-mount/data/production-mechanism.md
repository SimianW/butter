# MV3 mechanism and its boundaries

This experiment loads as a normal unpacked MV3 extension. The manifest adds three packaged MAIN-world scripts at document_start: factory-hook.js, component-pins.js and idle-mount.js. No debugger permission, CDP interception, fetch rewriting, eval, Function constructor or remote replacement script is required by the prototype. CDP and fetch replays are measurement infrastructure only.

The app in this session uses ESM Rspack chunks (`export const __rspack_esm_ids`, `__webpack_modules__`). No webpack chunk-push global was exposed. Its runtime nevertheless registers module factories through ordinary property assignment. A temporary, nonenumerable Object.prototype setter for the pinned module ID `if6d` observes that assignment. It substitutes a **locally packaged** factory only on exact Function.prototype.toString equality with the captured original. The replacement changes four overscan sites and passes the owning controller to the shared updater. The setter removes itself after a successful match; a 30-second timeout removes it when no matching factory arrives. Every nonmatching assignment creates the native own property unchanged. Existing prototype properties are respected.

Each controller gets its committed scroller in a WeakMap. Initial, missing, hidden, nonowned and disabled instances receive the original overscan of two. Only the active adapter-owned visible scroller may receive the expanded overscan, and only during the hidden streaming arm. This is necessary to keep a true hidden-DOM arm retained when the app processes send placement and changing turn keys. A global URL check or merely raising every overscan site is insufficient.

For idle growth, the adapter finds the virtualizer above an actual active-scroller turn, checks the **exact packaged component source**, the entry keys, one state queue, one native scroll-state ref, and the layout arrays. It dispatches through that queue and updates the native ref just as the pinned native updater does. Only one turn is added. Leaving the ref stale was directly caught: a subsequent scroll discarded the apparent retention. Native scrolling and send placement APIs are retained. The transition experiment obtains the renderer's currentDispatcherRef from a minimal DevTools rendezvous and follows this version's synchronous startTransition bookkeeping (T and S). This remains a private React dependency, not a public React API.

The original and replacement component sources are packaged in component-pins.js. Unknown source, state shape, entry identity or transition internals prevents growth. The whole captured factory is only about 30 kB, but bundling a private minified module and exact pins costs roughly 120 kB of experimental code and creates substantial maintenance work.

## Tested failure behavior

`mechanism-tests.mjs` verifies exact-factory substitution, unchanged pass-through for an unknown factory, timeout cleanup when the ID never registers, hidden/missing controller fallback, CV-off fallback, and controller scoping. Live browser audits record assignments=1, matched=true, called=true. The temporary prototype hook is absent after matching. Per-phase copies under builds-used preserve the exact loaded code.

## Failure modes

- A changed module ID, delayed loading beyond 30 seconds, different source, or null-prototype registration table misses the hook. The original module runs. A changed component source disables the state adapter as well.
- A changed dependency or renderer ABI can invalidate semantics even when superficial state shapes look similar. Exact source pins reduce this risk; they do not create a supported API. New upstream builds require renewed testing and repackaging.
- The transient prototype setter affects one property name on all ordinary objects until cleanup. Nonenumerability and exact source comparison limit its reach. It is still broader than a supported module-loader callback and is a maintenance risk.
- A real DevTools extension already present can prevent capturing the renderer before it is injected. The experiment declines unavailable transitions; it does not replace an existing hook. Loading this minimal hook may conflict with a later DevTools installer. This needs explicit compatibility work before release.
- A React commit is synchronous. Input can cancel future growth and prevent an updater that has not run, but cannot preempt a commit already in progress. A transition may also have begun rendering before input arrives. The measurements demonstrate that this distinction matters.
- Whole-turn size is unbounded. The prototype refuses expansion when more than 24 entries exist and uses a 300,000-active-element budget with a 50,000-element reserve before a step. The reserve is conservative, **not a guaranteed byte-memory or per-turn node bound**. It cannot count an uncreated giant turn. Huge chats remain on native behavior; they are not promised whole-conversation retention.
- Correctness fallback for unknown geometry is native layout, which retains its latency. No guessed per-block heights are shipped in extension-best.

This establishes an implementable MV3 mechanism, not a recommendation to release it. The performance and lifecycle results decide that question separately.

## Whole-conversation scope

The adapter expands native **loaded entries**. It does not bypass pagination or synthesize missing history. The lab loads all 12 questions using the captured successful GET responses before timing. A newly opened chat with only its newest page loaded will grow only that page until native earlier-history loading occurs. Automatically loading arbitrary unloaded history is not implemented or claimed as seamless; earlier page insertion itself was measured as a large-task source in the prior reports. The experiment therefore fails both the latency target and an unrestricted “all server history without prior loading” interpretation.

## Quiet streaming follow-up

The final driver avoids selecting/inspecting the scroller during an established stream: it checks completion with a scoped attribute query and returns immediately. It still performs explicit diagnostic audits when dump() is requested. The factory helper registers controller identity in the committed updater but returns the native budget before reading scroller visibility unless an expanded hidden-stream arm actually needs it. `streamFastSkips` counts this path. Original polling-shrink and quiet-shrink replays are separate arms, with separate exact build copies. These changes do not subdivide mount commits or solve the CV blanking problem.

If a previously expanded instance later becomes unrecognizable, the adapter refuses unsafe state edits. That is the correct fail-closed behavior for page correctness, but it cannot promise immediate memory eviction of an unknown private state shape. Tested navigation cleanup is reported separately; it is not a universal guarantee across future app changes.
