// The lab harnesses' scenario runner (lab/harness/runner/index.mjs), run with fake scenarios: no
// browser. A scenario or a setup that throws, or a run with no checks, must fail the run and say so;
// cleanup runs even when the summary can't be written.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runScenarios } from '../lab/harness/runner/index.mjs';

const harness = async () => ({
  start: async (_scenario, check) => ({ check }),
  report: () => ({}),
});

// Runs `scenarios` with the runner's output captured. `summary: false` points the summary into a
// directory that doesn't exist, so that writing it fails.
async function run(scenarios, { setup = harness, summary = true } = {}) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-runner-'));
  const file = summary ? path.join(dir, 'summary.json') : path.join(dir, 'missing', 'summary.json');
  const lines = [],
    log = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try {
    const ok = await runScenarios({ scenarios, setup, summary: file, verbose: false });
    console.log = log;
    const results = summary ? JSON.parse(await fs.readFile(file, 'utf8')).results : null;
    return { ok, results, lines };
  } finally {
    console.log = log;
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

test('a run with no checks fails and says that no checks ran', async () => {
  const { ok, results, lines } = await run([{ name: 'empty', run: () => {} }]);
  assert.equal(ok, false);
  assert.deepEqual(results, []);
  assert.equal(lines.at(-1), 'FAIL: no checks ran');
});

test('a setup that throws is a failing "setup threw" result in the summary', async () => {
  const setup = async () => {
    throw new Error('no browser');
  };
  const { ok, results, lines } = await run(
    [{ name: 'a', run: ({ check }) => check('a works', true) }],
    { setup },
  );
  assert.equal(ok, false);
  assert.deepEqual(results, [{ name: 'setup threw', pass: false, error: 'no browser' }]);
  assert.match(lines.at(-1), /^FAIL: 1 of 1 checks failed; threw: setup$/);
});

test('cleanup runs, and the run fails, when the summary cannot be written', async () => {
  let cleaned = 0;
  const setup = async (defer) => {
    defer(async () => cleaned++);
    return harness();
  };
  const { ok, lines } = await run([{ name: 'a', run: ({ check }) => check('a works', true) }], {
    setup,
    summary: false,
  });
  assert.equal(cleaned, 1);
  assert.equal(ok, false);
  assert.ok(lines.some((l) => l.startsWith('FAIL summary not written: ')));
});

test('a scenario whose skip() gives a reason is reported and not started', async () => {
  const started = [];
  const setup = async () => ({
    start: async (scenario, check) => (started.push(scenario.name), { check }),
    report: () => ({}),
  });
  const { ok, results, lines } = await run(
    [
      { name: 'a', skip: () => 'no mockup', run: ({ check }) => check('a works', true) },
      { name: 'b', skip: () => null, run: ({ check }) => check('b works', true) },
    ],
    { setup },
  );
  assert.equal(ok, true);
  assert.deepEqual(started, ['b']);
  assert.deepEqual(results, [{ name: 'b works', pass: true }]);
  assert.ok(lines.includes('skip a: no mockup'));
});

test('a skipped scenario is named in the summary and on the last line', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-runner-'));
  const file = path.join(dir, 'summary.json'),
    lines = [],
    log = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try {
    const ok = await runScenarios({
      scenarios: [
        { name: 'a', skip: () => 'no mockup', run: ({ check }) => check('a works', true) },
        { name: 'b', run: ({ check }) => check('b works', true) },
        { name: 'c', skip: () => 'no display', run: ({ check }) => check('c works', true) },
      ],
      setup: harness,
      summary: file,
      verbose: false,
    });
    console.log = log;
    assert.equal(ok, true);
    assert.deepEqual(JSON.parse(await fs.readFile(file, 'utf8')).skipped, ['a', 'c']);
    assert.equal(lines.at(-1), '1 checks passed; skipped: a, c');
  } finally {
    console.log = log;
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('a skip() that throws fails that scenario, and the next one still runs', async () => {
  const { ok, results, lines } = await run([
    {
      name: 'a',
      skip: () => {
        throw new Error('no fixture');
      },
      run: ({ check }) => check('a works', true),
    },
    { name: 'b', run: ({ check }) => check('b works', true) },
  ]);
  assert.equal(ok, false);
  assert.deepEqual(results, [
    { name: 'a threw', pass: false, error: 'no fixture' },
    { name: 'b works', pass: true },
  ]);
  assert.match(lines.at(-1), /^FAIL: 1 of 2 checks failed; threw: a$/);
});

test('an unmet precondition skips its scenario after start, with its reason, and the next one runs', async () => {
  const started = [];
  const setup = async () => ({
    start: async (scenario, check) => (started.push(scenario.name), { check, stored: 0 }),
    report: () => ({}),
  });
  const { ok, results, lines } = await run(
    [
      {
        name: 'a',
        precondition: async (t) =>
          t.stored === 2 ? null : `needs 2 stored bookmarks, has ${t.stored}`,
        run: ({ check }) => check('a works', true),
      },
      { name: 'b', precondition: async () => null, run: ({ check }) => check('b works', true) },
    ],
    { setup },
  );
  assert.equal(ok, true);
  assert.deepEqual(started, ['a', 'b']);
  assert.deepEqual(results, [{ name: 'b works', pass: true }]);
  assert.ok(lines.includes('skip a: needs 2 stored bookmarks, has 0'));
  assert.equal(lines.at(-1), '1 checks passed; skipped: a');
});

test('a precondition that throws fails that scenario, and the next one still runs', async () => {
  const { ok, results } = await run([
    {
      name: 'a',
      precondition: async () => {
        throw new Error('page gone');
      },
      run: ({ check }) => check('a works', true),
    },
    { name: 'b', run: ({ check }) => check('b works', true) },
  ]);
  assert.equal(ok, false);
  assert.deepEqual(results, [
    { name: 'a threw', pass: false, error: 'page gone' },
    { name: 'b works', pass: true },
  ]);
});

test('onThrow replaces the stack and message of a throw, in a scenario and in setup', async () => {
  const secret = 'private chat text';
  const described = [];
  const onThrow = (e, name) => (described.push(name), `phase=${name} error=${e.name}`);
  for (const [setup, name] of [
    [harness, 'a'],
    [
      async () => {
        throw new TypeError(secret);
      },
      'setup',
    ],
  ]) {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-runner-'));
    const file = path.join(dir, 'summary.json'),
      lines = [],
      log = console.log;
    console.log = (...a) => lines.push(a.join(' '));
    try {
      const ok = await runScenarios({
        scenarios: [
          {
            name: 'a',
            run: () => {
              throw new TypeError(secret);
            },
          },
        ],
        setup,
        summary: file,
        verbose: true,
        onThrow,
      });
      console.log = log;
      const text = await fs.readFile(file, 'utf8');
      assert.equal(ok, false);
      assert.ok(!text.includes(secret), 'summary');
      assert.ok(!lines.join('\n').includes(secret), 'console');
      assert.ok(lines.includes(`FAIL ${name} threw: phase=${name} error=TypeError`));
      assert.deepEqual(JSON.parse(text).results, [
        { name: `${name} threw`, pass: false, error: `phase=${name} error=TypeError` },
      ]);
    } finally {
      console.log = log;
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
  assert.deepEqual(described, ['a', 'setup']);
});
