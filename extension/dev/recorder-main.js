// Dev build only. MAIN world, after seek/preview-main.js and dev/recorder.js: records the seek
// hooks' press, seek and release summaries for 30 s, and builds a snapshot when dev/content.js
// asks. Reads only Butter's own diagnostics (__seekDump); no page text, no requests.
(() => {
  const dump = globalThis.__seekDump;
  const recorder = ButterDevRecorder.createRecorder();
  if (dump) dump.tap = (type, fields) => recorder.record(type, fields, performance.now());

  document.addEventListener('butter-dev-snapshot-request', (e) => {
    let request;
    try {
      request = JSON.parse(e.detail);
    } catch {
      return;
    }
    const now = performance.now(),
      date = new Date();
    const snapshot = recorder.snapshot({
      now,
      date,
      bug: request.bug,
      round: request.round,
      version: request.version,
      trigger: request.trigger,
      sources: {
        pointerHeld: () => dump.held,
        settings: () => request.settings,
        pressDecision: () => dump.pressDecision,
        failures: () => request.failures,
      },
    });
    document.dispatchEvent(
      new CustomEvent('butter-dev-snapshot-response', {
        detail: ButterDevRecorder.serialize(snapshot),
      }),
    );
  });
})();
