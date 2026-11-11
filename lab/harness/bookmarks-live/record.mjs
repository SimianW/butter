// What a bookmarks-live run leaves: `<out>/summary.json`, rewritten after every check and once more
// after the lab is restored and released, so that it holds the cleanup's results too.
//
// Privacy: the summary holds only numbers, booleans and public Butter labels. No exception message,
// stack, page text, URL or id enters it or the console. A throw's stack goes to `errorFile` (mode
// 0600, outside the repo), and the summary records only `failure: { phase, kind }` for the first
// one; `onThrow` is the runner's hook for that (runner/index.mjs), so the runner prints and stores
// the same `phase=… error=…` line instead of the stack and message.
//
// Fields, as before the runner: `checks` ({ name, pass, ...numbers }), `drags` and `wash` (the
// measurements per drag and per wash jump), `cleanup`, `failure`, `skipped` ("<scenario>: <reason>"
// for each scenario whose precondition was unmet), and whatever the scenarios store in `summary`.
import fs from 'node:fs/promises';
import path from 'node:path';

export function createRecord({ out, mode, testedHead, errorFile = '/tmp/butter-bookmarks-live-error.txt', verbose = !!process.env.VERBOSE }) {
  const summary = {
    testedHead,
    mode,
    platform: 'Linux',
    startedUtc: new Date().toISOString(),
    checks: [],
    drags: [],
    cleanup: {},
  };
  if (mode === 'wash') summary.wash = [];
  let current = null,
    stacks = 0;
  const record = {
    summary,
    // The step the run is in: a scenario's name, or a finer step inside it (`drag-empty-2`).
    phase: 'setup',
    // True once a cleanup step threw: the run then fails.
    cleanupFailed: false,
    async save() {
      await fs.mkdir(out, { recursive: true });
      await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
    },
    // A check, as the runner counts it, kept in `checks` and saved at once.
    async check(name, pass, numbers = {}) {
      summary.checks.push({ name, pass: !!pass, ...numbers });
      current?.(name, pass, numbers);
      await record.save();
    },
    // A measurement, printed with VERBOSE=1 (it is in the summary either way).
    info(label, value) {
      if (verbose) console.log(`INFO ${label} ${JSON.stringify(value)}`);
    },
    // The runner's `start`: the scenario's phase begins, and its checks count for it.
    start(scenario, check, t) {
      record.phase = scenario.name;
      current = check;
      return { ...t, check: record.check, info: record.info, rec: record };
    },
    skip(name, reason) {
      (summary.skipped ||= []).push(`${name}: ${reason}`);
    },
    // The runner's `onThrow`: the stack to `errorFile`, the phase and error class to the summary.
    async onThrow(e) {
      const text = `phase=${record.phase} error=${e?.name}`;
      await fs[stacks++ ? 'appendFile' : 'writeFile'](errorFile, `${text}\n${e?.stack || String(e)}\n`, { mode: 0o600 });
      summary.failure ??= { phase: record.phase, kind: e?.name };
      await record.save().catch(() => {});
      return text;
    },
    // A cleanup step that must not stop the ones after it: a throw is handled as above, without
    // touching `failure`, and printed as one line.
    async cleanup(label, fn) {
      try {
        await fn();
      } catch (e) {
        record.cleanupFailed = true;
        await fs[stacks++ ? 'appendFile' : 'writeFile'](errorFile, `cleanup ${label} error=${e?.name}\n${e?.stack || String(e)}\n`, { mode: 0o600 }).catch(() => {});
        console.log(`FAIL cleanup ${label} error=${e?.name}`);
      }
    },
    // The last cleanup: the finish time, the summary written once more, the cleanup in one line.
    async finish() {
      summary.finishedUtc = new Date().toISOString();
      await record.save();
      console.log(`cleanup ${JSON.stringify(summary.cleanup)}; summary.json in ${out}`);
    },
  };
  return record;
}
