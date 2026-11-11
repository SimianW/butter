// The branch harness's `start` (lab/harness/branch/harness.mjs), driven with a fake Chromium
// launcher: no browser. Each scenario must start with only its own blank page open, the previous
// scenario's tabs closed before its settings and session storage are reset, and with its declared
// scene served to every page it opens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { launchBranch } from '../lab/harness/branch/harness.mjs';

// A persistent context with one blank page, as Chromium opens it. `events` records each page closed
// and each call into the worker (every reset step goes through it), in order; `served` the URL and
// page of each request the route answered.
function fakeChromium() {
  const events = [],
    open = [],
    served = [];
  let n = 0,
    handler = null;
  const newPage = async () => {
    const page = {
      id: `page${++n}`,
      async close() {
        events.push(`close ${page.id}`);
        open.splice(open.indexOf(page), 1);
      },
      async setViewportSize() {},
      // Load `url` through the harness's route, as Chromium would.
      async goto(url) {
        await handler({
          request: () => ({ url: () => url }),
          fulfill: async ({ body }) => served.push({ url, body }),
          abort: async () => {},
        });
      },
      locator: () => ({ waitFor: async () => {} }),
    };
    open.push(page);
    return page;
  };
  const context = {
    grantPermissions: async () => {},
    route: async (_pattern, fn) => (handler = fn),
    newPage,
    pages: () => [...open],
  };
  const worker = {
    async evaluate() {
      events.push('worker');
    },
  };
  const launch = async () => {
    await newPage();
    return { context, worker, errors: [] };
  };
  return { launch, context, events, open, served };
}

test("start closes the previous scenario's pages before resetting, and serves its scene", async () => {
  const shots = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-branch-start-'));
  try {
    const chromium = fakeChromium();
    const { start } = await launchBranch({
      shots,
      defer: () => {},
      launch: chromium.launch,
      verbose: false,
    });

    const first = await start({ scene: 'stream=3000' }, () => {});
    assert.equal(chromium.open.length, 1, 'only the first scenario’s blank page is open');
    const tab = await first.open('theme=dark');
    assert.equal(chromium.open.length, 2);

    const mark = chromium.events.length;
    const second = await start({}, () => {});
    assert.equal(chromium.open.length, 1, 'only the second scenario’s blank page is open');
    const since = chromium.events.slice(mark);
    const closed = since.indexOf(`close ${tab.id}`);
    assert.ok(
      closed >= 0 && closed < since.indexOf('worker'),
      `the tab closes before any reset (events: ${since.join(', ')})`,
    );

    await second.open();
    // The scene's parameters are added at the route, to that scenario's pages only: `stream` marks
    // the latest reply in progress.
    const streaming = (p) => p.body.includes('data-talvt-turn-state="in_progress"');
    assert.deepEqual(chromium.served.map(streaming), [true, false]);
    assert.match(chromium.served[0].body, /data-theme="dark"/);
  } finally {
    await fs.rm(shots, { recursive: true, force: true });
  }
});
