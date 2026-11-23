// MAIN world: the opt-in seek diagnostics' session serializer (clean), a pure function of a
// release session. Classic script, loaded before seek/preview-main.js, whose __seekDump calls it.
globalThis.__butterSeekDiagnostics = () => {
  // Opt-in diagnostics return timing, counts and geometry only; never chat text.
  const clean = (a) =>
    a && {
      kind: a.kind,
      reason: a.reason,
      canceled: !!a.canceled,
      start: a.start,
      pressAt: a.pressAt,
      end: a.end,
      dispatched: a.dispatched,
      readable: a.readable,
      timedOut: a.timedOut,
      pressToActivateMs: a.start - a.pressAt,
      releaseToCommitMs: a.dispatched ? a.dispatched - a.end : null,
      releaseToReadableMs: a.readable ? a.readable - a.end : null,
      semantic:
        a.semantic &&
        (({ attempts, matched, fallback, clamped, lastError, anchorVisible, previewY }) => ({
          attempts,
          matched,
          fallback,
          clamped,
          lastError,
          anchorVisible,
          previewY,
        }))(a.semantic),
      textFallback: a.textFallback,
      startTop: a.startTop,
      realTop: a.realTop,
      landingErrorPx: a.landingErrorPx,
      turnTopErrorPx: a.turnTopErrorPx,
      retargets: a.retargets,
      finds: a.finds,
      coalescing: a.release?.dump(),
      commitRetarget: a.commitRetarget,
      alignmentCorrection: a.alignmentCorrection,
      swap: a.swap,
      swapError: a.swapError,
      destination: a.destination && {
        turn: a.destination.index,
        top: Math.round(a.destination.top),
        offset: Math.round(a.destination.offset),
        known: a.destination.known,
        stored: a.prep.model[a.destination.index]?.stored,
        layout: a.destination.layout,
      },
      model: {
        stored: a.prep.storedTurns,
        turns: a.prep.model.length,
        known: a.prep.knownTurns,
        layout: a.prep.layoutTurns,
        items: a.prep.flat.length,
        prepMs: a.prep.prepMs,
        gap: a.prep.gap,
      },
      insetTop: a.insetTop,
      insetBottom: a.insetBottom,
      hostRect: a.hostRect,
    };
  return { clean };
};
