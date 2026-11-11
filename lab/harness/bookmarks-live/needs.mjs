// Preconditions of live scenarios. A live run can't reset or seed (no store writes, no fixture
// edits), so a scenario declares what it needs from the ones before it, and is skipped with the
// reason when that is missing: `ONLY=<a later scenario>` alone gives a clean skip, never a crash.
// Each reads only the live page and the run's own store, and returns why the scenario can't run
// now, or null. A full run fails on a skip (harness.mjs), unless the need returns
// `{ why, expected: true }`: the fixture itself lacks what the scenario needs.

// The lab fixture's chat is open, with Butter's rail on it.
export const loaded = async (t) => ((await t.railState()).ticks ? null : 'the fixture chat is not loaded');
// Exactly `n` bookmarks are stored (the run's install starts with none).
export const stored = (n) => async (t) => {
  const k = await t.storedCount();
  return k === n ? null : `needs ${n} stored test bookmark${n === 1 ? '' : 's'}, has ${k}`;
};
// The page and the worker hold the target paragraphs (load-fixture, message-ids).
export const target = async (t) => ((await t.hasTarget()) ? null : 'no target paragraphs picked');
// The first unmet one of `needs`.
export const all =
  (...needs) =>
  async (t) => {
    for (const need of needs) {
      const why = await need(t);
      if (why) return why;
    }
    return null;
  };
