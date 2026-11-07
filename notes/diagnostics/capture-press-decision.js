// Paste in DevTools Console, context: top, AFTER pressing and releasing the scrollbar once.
// Reads only a frozen, privacy-safe summary. No DOM/cache reads, text, IDs, URLs or requests.
((copy) => {
  const dump = globalThis.__seekDump;
  if (!dump || !Object.getOwnPropertyDescriptor(dump, 'pressDecision')?.get)
    throw new Error(
      'Press diagnostics unavailable. Install the new test build and use context: top.',
    );
  if (globalThis.__butterSeeking?.())
    throw new Error('Release the scrollbar before running this capture.');
  const decision = dump.pressDecision;
  if (!decision)
    throw new Error('No prepared scrollbar press yet. Press, drag slightly, and release once.');
  const json = JSON.stringify(decision, null, 2);
  console.info(json);
  if (typeof copy === 'function') {
    copy(json);
    console.info('Butter press decision JSON copied. Share only that JSON.');
  }
  return decision;
})(typeof copy === 'function' ? copy : null);
