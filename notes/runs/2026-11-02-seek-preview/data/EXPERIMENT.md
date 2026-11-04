# THROWAWAY — native-thumb seek preview

This is a feasibility instrument, not a Butter release or approved product UI.
The assessment and evidence are in `../report.md`.

Base: released `79774e7`, version `0.1.0-alpha.9` / `0.1.0.9`.
Load this directory as an unpacked Chrome extension and reload ChatGPT. In the
shared lab, use the supplied `phase.sh` so the lock and restoration apply; Snap
Chromium requires the copy under `~/snap/chromium/common/`.

Added files: `seek-preview.js` and the prior experimental
`remount-prototype.js`. The manifest loads them in the MAIN world at
document_start. `butter-nav-main.js` dispatches its already-parsed conversation
response to the preview collector. No additional HTTP request is made.

On a calibrated Linux classic scrollbar thumb press, freeze a numeric turn map,
suppress capture-phase scroll delivery to ChatGPT, and display at most 2600
characters of recorded answer markdown plus the question. On release, deliver
one synthetic scroll notification at the browser's final native scrollTop and
keep the preview visible while the real window settles. The pre-read height
cache is copied unchanged from the prior remount experiment.

Known boundaries:

- Native scrollbar arrow/minimum-thumb metrics are calibrated to this Linux
  Chromium lab. Overlay scrollbars deliberately pass through. macOS is unproven.
- Measured geometry is read off the critical path from a private React hook
  shape, with ResizeObserver sizes and text-weighted estimates as fallbacks.
  Missing shape does not make an estimate accurate.
- Within-answer markdown character fractions are an approximation, not a
  layout-preserving text renderer. The semantic-anchor audit exposes the error.
- Scroll suppression cannot freeze ResizeObserver, streaming or already-started
  work. New conversation data cancels the stand-in.
- The numeric cache guard inherits the prior prototype's content-width,
  hidden-copy ownership and regeneration limitations. No release safety claim.
- All state is in memory. Two conversation datasets and 128 numeric turn-size
  entries are retained. No detached real turns or cloned answer trees are kept.
- `window.__seekDump()` provides timings and state for the lab; it contains
  private conversation text and must stay local.

Rebuild: `python3 (not archived)` (this overwrites extension
copies; preserve this file afterward). Run one native screen:

```bash
FORCE_FULL=1 WARM=1 RUN=best-warm-fast-screen TRACE=1 \
  bash (not archived) best \
  node (not archived) best fast
```

The lab harness uses captured history and two fail-closed write guards. Never
send a real message while reproducing this experiment.
