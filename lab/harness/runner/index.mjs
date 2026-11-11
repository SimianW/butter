// The scenario runner shared by Butter's lab harnesses: which scenarios run, what a run prints, the
// summary it leaves, and cleanup that always happens. A harness hands it its scenarios, in run
// order, and a `setup` that builds what every scenario starts from.
//
// A scenario is { name, description, run(t) }, plus whatever its harness reads from it (a starting
// scene, settings, store rows). `t` is what the harness's `start(scenario, check)` returns. An
// optional `skip()` returns why the scenario can't run here (a missing mockup, say): it is then
// reported as skipped and not started, and named in the summary's `skipped` and on the last line.
//
// Selection: `ONLY=a,b` runs those scenarios (in registry order); unset runs all. `--list` prints
// each scenario's name and description. An unknown name or argument exits with status 2.
// Output: a FAIL line for each failing check, and one line per scenario with its counts and time;
// `VERBOSE=1` also prints every passing check, as `ok   <name> <detail>`. A run with no checks fails.
import fs from 'node:fs/promises';

// Parses `--list` and `ONLY`. Returns the selected scenarios, or exits: after printing the list,
// or with status 2 on an unknown name or argument.
export function select(scenarios, { argv = process.argv.slice(2), env = process.env } = {}) {
  const names = scenarios.map((s) => s.name);
  const unknownArgs = argv.filter((a) => a !== '--list');
  if (unknownArgs.length) fail(`unknown argument: ${unknownArgs.join(' ')} (only --list is accepted)`);
  if (argv.includes('--list')) {
    const width = Math.max(...names.map((n) => n.length));
    for (const s of scenarios) console.log(`${s.name.padEnd(width)}  ${s.description}`);
    process.exit(0);
  }
  if (!env.ONLY) return scenarios;
  const wanted = env.ONLY.split(',').map((n) => n.trim()).filter(Boolean);
  const unknown = wanted.filter((n) => !names.includes(n));
  if (unknown.length || !wanted.length)
    fail(`unknown scenario in ONLY: ${unknown.join(', ') || '(empty)'}; known: ${names.join(', ')} (--list describes them)`);
  return scenarios.filter((s) => wanted.includes(s.name));
}

function fail(message) {
  console.error(message);
  process.exit(2);
}

// Runs `scenarios` in order and writes `summary` ({ results, skipped, ...report() }) whatever happens.
// `setup(defer)` builds the harness: it returns { start(scenario, check) → t, report() → {} } and
// registers its cleanups with `defer(fn)`; they run last-in first-out, after the summary is
// written (or failed to be). A scenario that throws, in `skip()` too, is reported and the next one
// still runs; a
// `setup` that throws is a failing `setup threw` result. Resolves to true when at least one check
// ran, every check passed, nothing threw, the summary was written and `report()`'s arrays (errors,
// foreign requests) are empty.
export async function runScenarios({ scenarios, setup, summary, verbose = !!process.env.VERBOSE }) {
  const results = [],
    cleanups = [],
    crashed = [],
    skipped = [];
  let scenario = null;
  const check = (name, pass, detail = {}) => {
    results.push({ name, pass: !!pass, ...detail });
    if (verbose || !pass)
      console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${Object.keys(detail).length ? ' ' + JSON.stringify(detail) : ''}`);
  };
  let harness = null,
    report = {},
    unwritten = null;
  try {
    harness = await setup((fn) => cleanups.push(fn));
    for (scenario of scenarios) {
      const from = results.length,
        began = Date.now();
      try {
        const skip = scenario.skip?.();
        if (skip) {
          skipped.push(scenario.name);
          console.log(`skip ${scenario.name}: ${skip}`);
          continue;
        }
        await scenario.run(await harness.start(scenario, check));
      } catch (e) {
        crashed.push(scenario.name);
        console.log(`FAIL ${scenario.name} threw: ${e.stack}`);
        results.push({ name: `${scenario.name} threw`, pass: false, error: e.message });
      }
      const mine = results.slice(from),
        failed = mine.filter((r) => !r.pass).length,
        secs = Math.round((Date.now() - began) / 1000);
      const bad = failed || crashed.includes(scenario.name);
      console.log(`${bad ? 'FAIL' : 'pass'} ${scenario.name}: ${mine.length - failed}/${mine.length} checks passed${crashed.includes(scenario.name) ? ', then threw' : ''} (${secs} s)`);
    }
    scenario = null;
  } catch (e) {
    // Only `setup` throws here: each scenario's own throw, in `skip()`, `start` or `run`, is caught
    // above.
    const name = scenario?.name ?? 'setup';
    crashed.push(name);
    console.log(`FAIL ${name} threw: ${e.stack}`);
    results.push({ name: `${name} threw`, pass: false, error: e.message });
  } finally {
    try {
      report = harness?.report() ?? {};
      const lists = Object.entries(report).filter(([, v]) => Array.isArray(v));
      if (verbose || lists.some(([, v]) => v.length)) console.log(lists.map(([k, v]) => `${k} ${JSON.stringify(v)}`).join(' '));
      if (summary) await fs.writeFile(summary, JSON.stringify({ results, skipped, ...report }, null, 2));
    } catch (e) {
      unwritten = e;
      console.log(`FAIL summary not written: ${e.message}`);
    }
    for (const fn of cleanups.reverse()) await Promise.resolve().then(fn).catch((e) => console.log(`cleanup failed: ${e.message}`));
  }
  const ok =
    !crashed.length && !unwritten && results.length > 0 && results.every((r) => r.pass) && Object.values(report).every((v) => !Array.isArray(v) || !v.length);
  const failed = results.filter((r) => !r.pass).length;
  const why = [crashed.length && `threw: ${crashed.join(', ')}`, unwritten && 'summary not written'].filter(Boolean).join('; ');
  const skips = skipped.length ? `; skipped: ${skipped.join(', ')}` : '';
  console.log(
    (ok
      ? `${results.length} checks passed`
      : !results.length
        ? `FAIL: no checks ran${why ? `; ${why}` : ''}`
        : `FAIL: ${failed} of ${results.length} checks failed${why ? `; ${why}` : ''}`) + skips,
  );
  return ok;
}
