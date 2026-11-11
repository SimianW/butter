// Chromium with the unpacked Butter extension, for fixture harnesses: a throwaway profile, the
// extension's service worker, and every page error collected (and printed with its stack and page).
// Headed when an X display is set (so xtest-keys.py can type real shortcuts), headless otherwise.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const headed = !!process.env.DISPLAY;

// `defer(fn)` registers a cleanup (the runner's); the context and profile go with it.
// `args` are added to Chromium's; `options` to launchPersistentContext's.
export async function launchButter({ defer, name = 'butter-qa', viewport = { width: 1400, height: 900 }, args = [], options = {} }) {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), `${name}-`));
  defer(() => fs.rm(profile, { recursive: true, force: true }));
  const context = await chromium.launchPersistentContext(profile, {
    headless: !headed,
    channel: 'chromium',
    viewport,
    args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`, ...args],
    ...options,
  });
  defer(() => context.close());
  const errors = [];
  context.on('page', (p) =>
    p.on('pageerror', (e) => {
      errors.push(e.message);
      console.log(`page error on ${new URL(p.url()).pathname}: ${e.stack}`);
    }),
  );
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  return { context, worker, errors };
}
