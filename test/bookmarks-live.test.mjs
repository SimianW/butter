// bookmarks-live on the runner (lab/harness/bookmarks-live/), with a fake lab: no browser. A throw
// must leave its message out of summary.json and the console (its stack goes only to the private
// error file); the summary is written last, with the cleanup's results, even when setup throws
// halfway; and any later scenario run alone is skipped with its reason, not crashed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { runLive } from '../lab/harness/bookmarks-live/harness.mjs';
import { createRecord } from '../lab/harness/bookmarks-live/record.mjs';
import { suites } from '../lab/harness/bookmarks-live/scenarios.mjs';

const SECRET = 'private answer text at https://chatgpt.com/c/0123abcd-0000-4000-8000-000000000000';

// Runs `scenarios` through runLive with `launch(defer, record)`, capturing the console. Returns the
// result, the console lines, the summary and the error file (null when none was written).
async function live(scenarios, launch, mode = 'matrix') {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-live-'));
  const errorFile = path.join(dir, 'error.txt');
  const record = createRecord({
    out: path.join(dir, 'out'),
    mode,
    testedHead: 'test',
    errorFile,
    verbose: false,
  });
  const lines = [],
    log = console.log;
  console.log = (...a) => lines.push(a.join(' '));
  try {
    const ok = await runLive({
      scenarios,
      record,
      launch: (defer) => launch(defer, record),
      verbose: false,
    });
    console.log = log;
    const summary = await fs.readFile(path.join(dir, 'out', 'summary.json'), 'utf8');
    const error = await fs.readFile(errorFile, 'utf8').catch(() => null);
    const mode600 = error === null ? null : (await fs.stat(errorFile)).mode & 0o777;
    return { ok, lines, summary, error, mode600, record };
  } finally {
    console.log = log;
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('a live scenario that throws private text: only its phase and error class reach the summary and console', async () => {
  const launch = async (defer) => {
    defer(() => {});
    return {};
  };
  const { ok, lines, summary, error, mode600 } = await live(
    [
      {
        name: 'bookmark-paragraph',
        async run(t) {
          await t.check('the Bookmark cell is named Bookmark selection', true, { stored: 1 });
          t.rec.phase = 'bookmark-paragraph-click';
          throw new TypeError(SECRET);
        },
      },
      {
        name: 'delete',
        run: (t) => t.check('card delete removes both test bookmarks', true, { remaining: 0 }),
      },
    ],
    launch,
  );
  assert.equal(ok, false);
  assert.ok(
    !summary.includes('private answer text') && !summary.includes('chatgpt.com/c/'),
    summary,
  );
  assert.ok(
    !lines.join('\n').includes('private answer text') &&
      !lines.join('\n').includes('chatgpt.com/c/'),
    lines.join('\n'),
  );
  assert.ok(
    lines.includes('FAIL bookmark-paragraph threw: phase=bookmark-paragraph-click error=TypeError'),
    lines.join('\n'),
  );
  const s = JSON.parse(summary);
  assert.deepEqual(s.failure, { phase: 'bookmark-paragraph-click', kind: 'TypeError' });
  assert.deepEqual(
    s.checks.map((c) => [c.name, c.pass]),
    [
      ['the Bookmark cell is named Bookmark selection', true],
      ['card delete removes both test bookmarks', true],
    ],
  );
  // The stack is kept, privately, for the person running the lab.
  assert.ok(error.includes(SECRET) && error.includes('at '), error);
  assert.equal(mode600, 0o600);
});

test('setup throwing halfway: the cleanups run in reverse order and the summary written last holds their results', async () => {
  const order = [];
  // As lab.mjs registers them: release, then restore (which runs first); then setup throws.
  const launch = async (defer, { summary }) => {
    defer(() => {
      order.push('release');
      summary.cleanup.labLockReleased = true;
    });
    defer(async () => {
      order.push('restore');
      summary.cleanup.restored = true;
    });
    throw new Error(SECRET);
  };
  const { ok, lines, summary } = await live(
    [{ name: 'load-fixture', run: (t) => t.check('real long fixture loaded', true) }],
    launch,
  );
  const s = JSON.parse(summary);
  assert.equal(ok, false);
  assert.deepEqual(order, ['restore', 'release']);
  assert.deepEqual(s.cleanup, { restored: true, labLockReleased: true });
  assert.deepEqual(s.failure, { phase: 'setup', kind: 'Error' });
  assert.deepEqual(s.checks, []);
  assert.ok(s.finishedUtc);
  assert.ok(!summary.includes('private answer text'), summary);
  assert.ok(!lines.join('\n').includes('private answer text'), lines.join('\n'));
  assert.ok(lines.includes('FAIL setup threw: phase=setup error=Error'), lines.join('\n'));
});

// A fresh run's state: the lab's page not on the fixture (no rail), the run's store empty, no target.
const fresh = async () => ({
  railState: async () => ({ ticks: 0, marks: 0, more: false, stale: 0, busy: 0 }),
  storedCount: async () => 0,
  hasTarget: async () => false,
  page: { evaluate: async () => null },
});

for (const [mode, list] of Object.entries(suites))
  for (const scenario of list.filter((s) => s.precondition))
    test(`${mode}: ${scenario.name} alone is skipped with its reason, not run`, async () => {
      const { lines, summary } = await live([scenario], fresh, mode);
      assert.ok(
        lines.includes(`skip ${scenario.name}: the fixture chat is not loaded`),
        lines.join('\n'),
      );
      assert.ok(!lines.some((l) => l.includes('threw')), lines.join('\n'));
      assert.deepEqual(JSON.parse(summary).skipped, [
        `${scenario.name}: the fixture chat is not loaded`,
      ]);
    });

test('every scenario but the first of each suite and the dark theme pass declares a precondition', () => {
  const without = Object.values(suites)
    .flat()
    .filter((s) => !s.precondition)
    .map((s) => s.name);
  assert.deepEqual(without, ['load-fixture', 'wash-theme-light', 'wash-theme-dark']);
});

test('a precondition past "loaded" names what is missing', async () => {
  const loaded = async () => ({
    ...(await fresh()),
    railState: async () => ({ ticks: 12, marks: 0, more: false, stale: 0, busy: 0 }),
    hasTarget: async () => true,
    storedCount: async () => 1,
  });
  const later = suites.matrix.find((s) => s.name === 'drag-bookmarked');
  const { lines } = await live([later], loaded);
  assert.ok(
    lines.includes('skip drag-bookmarked: needs 2 stored test bookmarks, has 1'),
    lines.join('\n'),
  );
});
