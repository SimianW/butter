# Measurement contract (declared before lab runs)

- Control is the exact `79774e7` extension, alpha.9. The required fetch/checkout
  found that origin/main had advanced to alpha.10; source is archived by commit
  to avoid silently changing the control. No tracked extension file is edited.
- All browser phases acquire the shared directory lock, identify the owner and
  retry at 60-second intervals. Each phase restarts the specified original
  extension and original chat before releasing its own lock.
- The native drag schedule presses the actual calibrated classic thumb via CDP,
  then sends 60 moves over 1.2 seconds (fast) or 120 over 12 seconds (slow).
  Dispatches are not serialized behind main-thread stalls. Actual command send
  and acknowledgment times are retained.
- Warm means full-history traversal, two rAFs per 0.9 viewport, followed by a
  return to scrollTop 1800. This is explicit preparation, not a free initial
  state. Cold means fresh history setup without that full traversal.
- Mount/unmount identity batches are observed DOM window commits, a proxy for
  React window changes. They do not count all React render/commit work. Tasks
  can begin before a mutation callback arrives. Held, release-crossing and
  recovery intervals are reported separately to avoid reclassifying a late
  commit as free work.
- Held frame statistics use complete rAF intervals contained between physical
  native press submission and release submission. The frame crossing release
  and maximum through recovery are separate columns. LoAF blocking and long
  task durations are separate metrics.
- Preview JS time is synchronous work in each scroll handler. Event-to-rAF-plus-
  task is a timing proxy. A tiny colored reference and 12-bit update stamp in
  the preview permit independent identification in CDP JPEG captures. Presented
  latency applies only to captured updates; missing/coalesced updates are
  disclosed. Neither source establishes every physical display refresh.
- Release-to-readable is measured from physical mouse-release submission to
  three quiet frames with real turn content beneath the center of the scroller.
  The stand-in's own reveal criterion also waits for mounted destination/math
  and stable scroll position; these two criteria are reported independently.
- Numeric landing error compares the frozen turn top plus selected pixel offset
  with actual final geometry. A second semantic audit matches a nearby source
  text anchor into a real answer block and measures its distance from the
  viewport top. Accurate numeric landing does not certify excerpt fidelity.
- Streaming uses the existing 189-chunk, approximately 122-second fail-closed
  recording, with original timing and long pauses capped at 1.5 seconds. All
  chunks and the final answer fingerprint must match. Three control and three
  best-F repetitions measure median loafBlockMs. A concurrent native-drag
  replay is a separate edge screen, not pooled with ordinary streaming.
- Preview data memory is a serialization-based UTF-16 storage estimate plus
  numeric geometry. Whole renderer heap/DOM after GC is reported separately;
  it cannot isolate the preview's allocator cost from React/browser caches.
- Screen gates: preview input latency p95 at most 100 ms, no moving frame over
  50 ms, no window mounts while held, one final destination change, correct
  recovery, no multi-second input freeze on release, and no more than a 10%
  increase in median ordinary streaming blocking as a preliminary screen.
  Three sequential repetitions are descriptive, not significance tests.
- macOS overlay scrollbars, real OS pointer cancellation, trackpad hardware,
  arbitrary widths/media/branches, and deployment resilience need separate
  evidence. Synthetic lifecycle probes are labeled separately from native input.
