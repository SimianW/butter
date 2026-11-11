// The lab harnesses' scenario runner (lab/harness/runner/index.mjs), run with fake scenarios: no
// browser. A scenario that throws, or a run with no checks, must fail the run and say so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runScenarios } from '../lab/harness/runner/index.mjs';

const setup = async () => ({ start: async (_scenario, check) => ({ check }), report: () => ({}) });

async function run(scenarios) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-runner-'));
  const summary = path.join(dir, 'summary.json');
  try {
    const ok = await runScenarios({ scenarios, setup, summary, verbose: false });
    return { ok, results: JSON.parse(await fs.readFile(summary, 'utf8')).results };
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('a scenario that throws fails the run, lands in the summary, and the next one still runs', async () => {
  const { ok, results } = await run([
    {
      name: 'a',
      run: ({ check }) => {
        check('a works', true);
        throw new Error('boom');
      },
    },
    { name: 'b', run: ({ check }) => check('b works', true) },
  ]);
  assert.equal(ok, false);
  assert.deepEqual(results, [
    { name: 'a works', pass: true },
    { name: 'a threw', pass: false, error: 'boom' },
    { name: 'b works', pass: true },
  ]);
});

test('a run with no checks fails', async () => {
  const { ok, results } = await run([{ name: 'empty', run: () => {} }]);
  assert.equal(ok, false);
  assert.deepEqual(results, []);
});
