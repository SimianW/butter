// The live lab for a bookmarks-live run, moved unchanged from the single script: a byte-for-byte
// copy of the extension (snap cannot read hidden worktrees) under ~/snap/chromium/common/ with its
// tree digest checked, the lab lock (and the perf lock for the matrix), the Bookmark shortcut
// written into the lab profile (matrix only), the browser restarted with only that copy, the lab's
// send guard plus a counter of blocked mutations, and the worker's probes (storage reads, bookmark
// messages, commands).
//
// Each cleanup is registered with the runner's `defer` right after what it undoes, so that they run
// last-in first-out in the old order, also when setup throws halfway: mouse up → fallback bookmark
// clear → browser.close → stop the browser and restore the shortcuts → L.restore → L.release → rm
// the copy → save the summary (registered first, by harness.mjs). Each records its result in
// `summary.cleanup`.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { storeOps } from './store.mjs';

const requireThat = (v, label) => {
  if (!v) throw new Error(label);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const digestTree = async (dir) => {
  const files = (await fs.readdir(dir, { recursive: true, withFileTypes: true }))
    .filter((x) => x.isFile())
    .map((x) => path.relative(dir, path.join(x.parentPath, x.name)))
    .sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(f);
    h.update(await fs.readFile(path.join(dir, f)));
  }
  return h.digest('hex');
};

// `L`: the lab library (lib/lab.mjs); `source`: the extension to install; `fixture`: the lab
// fixture's name. Returns what every scenario drives: { L, lab, browser, context, page, worker, cdp }.
export async function launchLive({ L, mode, source, fixture, record, defer }) {
  const WASH = mode === 'wash';
  const { summary } = record,
    cleanup = summary.cleanup;
  let lab, browser, page, worker, originalCommands;
  async function stopBrowser() {
    const running = L.browserArgs(lab);
    if (!running) return;
    try {
      process.kill(running.pid, 'SIGTERM');
    } catch (e) {
      if (e.code !== 'ESRCH') throw e;
    }
    for (let i = 0; i < 100; i++) {
      const stat = await fs.readFile(`/proc/${running.pid}/stat`, 'utf8').catch(() => null);
      if (!stat || /\) Z /.test(stat)) return;
      await pause(100);
    }
    throw new Error('browser did not stop');
  }
  async function writeCommands(commands) {
    const file = path.join(lab.profile, 'Default/Preferences');
    const prefs = JSON.parse(await fs.readFile(file, 'utf8'));
    prefs.extensions ||= {};
    if (commands === undefined) delete prefs.extensions.commands;
    else prefs.extensions.commands = commands;
    await fs.writeFile(file + '.bookmarks57', JSON.stringify(prefs));
    await fs.rename(file + '.bookmarks57', file);
  }

  const scratch = await fs.mkdtemp(path.join(os.homedir(), 'snap/chromium/common/butter-bookmarks-live-'));
  defer(() => record.cleanup('scratch', () => fs.rm(scratch, { recursive: true, force: true })));
  await fs.cp(source, path.join(scratch, 'extension'), { recursive: true });
  const extension = path.join(scratch, 'extension');
  summary.extensionTreeSha256 = await digestTree(source);
  requireThat(summary.extensionTreeSha256 === (await digestTree(extension)), 'extension copy differs');
  lab = L.acquire('auto', {
    owner: WASH ? 'butter-74-bookmarks-live-wash' : 'butter-57-bookmarks-live-4',
    needsFixture: fixture,
    wait: 60,
    perf: !WASH,
  });
  defer(() =>
    record.cleanup('release', () => {
      const released = L.release(lab);
      cleanup.labLockReleased = released.lab_released;
      cleanup.perfLockReleased = released.perf_released;
      record.info('lab and perf locks released', {});
    }),
  );
  defer(() =>
    record.cleanup('restore', async () => {
      const restored = await L.restore(lab, { log: () => {} });
      cleanup.restored = restored.ok;
      cleanup.composerEmpty = restored.composer === '';
      cleanup.oneHomeTab = restored.pages.length === 1;
      cleanup.defaultExtensions = JSON.stringify(restored.browser.extensions) === JSON.stringify(lab.defaultExtensions);
      record.info('lab restored', cleanup);
    }),
  );
  record.info('acquired fixture lab and perf lock', {});
  await stopBrowser();
  if (!WASH) {
    originalCommands = {
      value: JSON.parse(await fs.readFile(path.join(lab.profile, 'Default/Preferences'), 'utf8')).extensions?.commands,
    };
    defer(() =>
      record.cleanup('shortcuts', async () => {
        await stopBrowser();
        await writeCommands(originalCommands.value);
        cleanup.shortcutsRestored = true;
      }),
    );
  }
  const extensionId = [...createHash('sha256').update(extension).digest('hex').slice(0, 32)]
    .map((h) => String.fromCharCode(97 + parseInt(h, 16)))
    .join('');
  if (!WASH)
    await writeCommands({
      ...originalCommands.value,
      'linux:Alt+Shift+M': { command_name: 'bookmark', extension: extensionId, global: false },
    });
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], {
    env: {
      ...process.env,
      LAB_ID: String(lab.id),
      LAB_EXTENSIONS: extension,
      LAB_FLAGS: `--disable-extensions-except=${extension}`,
    },
    stdio: 'pipe',
  });
  for (let i = 0; i < 60 && !(await L.cdpVersion(lab)); i++) await pause(500);
  const connected = await L.connect(lab);
  browser = connected.browser;
  const { context } = connected;
  defer(() => record.cleanup('browser', () => browser.close().catch(() => {})));
  summary.chromium = browser.version();
  await L.sendGuard(context, lab);
  summary.sendGuard = { enabled: true, sendAttempts: 0, blockedMutations: 0 };
  await context.route('**/*', (route) => {
    const r = route.request(),
      u = new URL(r.url());
    if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method()) && (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))) {
      summary.sendGuard.blockedMutations++;
      if (/^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$/.test(u.pathname)) summary.sendGuard.sendAttempts++;
    }
    return route.fallback();
  });
  worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  const store = storeOps(worker);
  defer(() =>
    record.cleanup('fallback clear', async () => {
      // Failure cleanup: the new extension origin is task-owned; no normal lab data is touched.
      cleanup.remainingBeforeFallback = await store.count().catch(() => null);
      await store.clear();
      cleanup.remainingAfterFallback = await store.count();
    }),
  );
  await worker.evaluate(() => {
    globalThis.liveProbe = { reads: 0, messages: 0, commands: 0 };
    chrome.runtime.onMessage.addListener((m) => {
      if (m?.type?.startsWith('butter-bookmark-')) liveProbe.messages++;
    });
    chrome.commands.onCommand.addListener((c) => {
      if (c === 'bookmark') liveProbe.commands++;
    });
    for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype])
      for (const name of ['get', 'getAll', 'getAllKeys', 'getKey', 'count', 'openCursor', 'openKeyCursor']) {
        const original = proto[name];
        if (!original) continue;
        proto[name] = function (...args) {
          liveProbe.reads++;
          return original.apply(this, args);
        };
      }
    const get = chrome.storage.local.get.bind(chrome.storage.local);
    chrome.storage.local.get = (...args) => {
      liveProbe.reads++;
      return get(...args);
    };
    return chrome.storage.local.set({
      butter: { enabled: true, lang: 'en', layoutConsent: 'declined' },
    });
  });
  summary.shortcut = await worker.evaluate(async () => (await chrome.commands.getAll()).find((c) => c.name === 'bookmark')?.shortcut);
  requireThat(WASH || summary.shortcut === 'Alt+Shift+M', 'bookmark shortcut unavailable');
  page = context.pages()[0] || (await context.newPage());
  defer(() => record.cleanup('mouse up', () => !page.isClosed() && page.mouse.up().catch(() => {})));
  for (const other of context.pages()) if (other !== page) await other.close();
  const cdp = await context.newCDPSession(page);
  return { L, lab, browser, context, page, worker, cdp, store };
}
