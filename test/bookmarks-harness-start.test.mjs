// The bookmarks harness's `start` (lab/harness/bookmarks/harness.mjs), driven with a fake Chromium
// launcher: no browser. Each scenario must start with only its own page open: `start` closes the
// pages the previous scenario left (its page, and any other it opened before it threw), and closes
// them before it resets anything, so that no old page sees the reset settings, layouts or store.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

// Headless, so that launching doesn't type a key through xtest-keys.py.
delete process.env.DISPLAY;
const { launchBookmarks } = await import('../lab/harness/bookmarks/harness.mjs');

// A persistent context with one blank page, as Chromium opens it. `events` records each page closed
// and each call into the worker (every reset step goes through it), in order.
function fakeChromium() {
  const events = [],
    open = [];
  let n = 0;
  const newPage = async () => {
    const page = {
      id: `page${++n}`,
      async close() {
        events.push(`close ${page.id}`);
        open.splice(open.indexOf(page), 1);
      },
    };
    open.push(page);
    return page;
  };
  const context = { route: async () => {}, newPage, pages: () => [...open] };
  const worker = {
    url: () => 'chrome-extension://fake/background.js',
    async evaluate() {
      events.push('worker');
      // Read by the Bookmark command's key check; the other steps ignore what they get back.
      return [{ name: 'bookmark', shortcut: 'Alt+Shift+M' }];
    },
  };
  const launch = async () => {
    await newPage();
    return { context, worker, errors: [] };
  };
  return { launch, context, events, open };
}

test("start closes the previous scenario's pages, including one left after a throw, before resetting", async () => {
  const shots = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-harness-start-'));
  try {
    const chromium = fakeChromium();
    const { start } = await launchBookmarks({
      markup: 'fixture',
      shots,
      defer: () => {},
      launch: chromium.launch,
      verbose: false,
    });

    let mark = chromium.events.length;
    const first = await start({}, () => {});
    assert.deepEqual(chromium.open, [first.page], 'only the first scenario’s page is open');
    assert.equal(
      chromium.events.slice(mark).indexOf('close page1'),
      0,
      'the launch page closes before any reset',
    );

    // The first scenario opens a second page (a mockup, say) and throws before closing it.
    const extra = await chromium.context.newPage();
    assert.equal(chromium.open.length, 2);

    mark = chromium.events.length;
    const second = await start({}, () => {});
    assert.deepEqual(chromium.open, [second.page], 'only the second scenario’s page is open');
    const since = chromium.events.slice(mark);
    const firstReset = since.indexOf('worker');
    for (const p of [first.page, extra]) {
      const closed = since.indexOf(`close ${p.id}`);
      assert.ok(closed >= 0, `${p.id} is closed`);
      assert.ok(
        closed < firstReset,
        `${p.id} is closed before the first reset step (events: ${since.join(', ')})`,
      );
    }
  } finally {
    await fs.rm(shots, { recursive: true, force: true });
  }
});
