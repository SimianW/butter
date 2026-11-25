// lab/harness/seek-live-page.mjs `startLab` over a fake lab (#171 review L1): it writes Butter's
// settings only when the caller asks for Smoother scrolling, and then hands back the restore.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startLab } from '../lab/harness/seek-live-page.mjs';

const QUICK = { LAB_SETTLE_MS: '0' }; // no wait for a browser that is not there

// A lab whose `bin/lab restart-browser` does nothing, one ChatGPT tab, and Butter as its first
// extension. `opened` lists the extension pages a run opened; `writes` the settings it stored.
function fakeLab() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'butter-fake-lab-'));
  fs.mkdirSync(path.join(root, 'bin'));
  fs.writeFileSync(path.join(root, 'bin/lab'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  const opened = [],
    writes = [];
  let stored = { opts: { seek: false, older: false }, defaultsVersion: 2 };
  const chat = { url: () => 'https://chatgpt.com/c/x', close: async () => {} };
  const context = {
    pages: () => [chat],
    newPage: async () => ({
      goto: async (url) => opened.push(url),
      close: async () => {},
      // Runs the extension-page function with a fake chrome.storage.
      evaluate: async (fn, arg) => {
        globalThis.chrome = {
          storage: {
            local: {
              get: async () => ({ butter: structuredClone(stored) }),
              set: async ({ butter }) => writes.push((stored = structuredClone(butter))),
              remove: async () => writes.push((stored = undefined)),
            },
          },
        };
        try {
          return await fn(arg);
        } finally {
          delete globalThis.chrome;
        }
      },
    }),
  };
  const L = {
    root: () => root,
    cdpVersion: async () => true,
    connect: async () => ({ browser: { close: async () => {} }, context }),
    sendGuard: async () => () => {},
    browserArgs: () => ({ extensions: ['/fake/butter'] }),
  };
  return { L, lab: { id: 9 }, opened, writes, stored: () => stored };
}

test('startLab writes no settings unless the caller asks for Smoother scrolling', async () => {
  const f = fakeLab();
  const run = await startLab(f.L, f.lab, QUICK, '/fake/butter');
  assert.equal(run.restoreOptions ?? null, null, 'nothing to restore');
  assert.deepEqual(f.opened, [], 'no extension page opened');
  assert.deepEqual(f.writes, [], 'no settings written');
});

test('with scrolling, startLab switches Smoother scrolling on and its restore puts it back', async () => {
  const f = fakeLab();
  const run = await startLab(f.L, f.lab, QUICK, '/fake/butter', { scrolling: true });
  assert.deepEqual(f.stored().opts, { seek: true, older: true });
  assert.equal(await run.restoreOptions(), true);
  assert.deepEqual(f.stored().opts, { seek: false, older: false });
  // No extension, nothing written even when asked.
  const g = fakeLab();
  assert.equal(
    (await startLab(g.L, g.lab, QUICK, '', { scrolling: true })).restoreOptions ?? null,
    null,
  );
  assert.deepEqual(g.writes, []);
});
