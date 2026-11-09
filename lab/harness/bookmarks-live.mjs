// #57 / #51, seam 3. Existing live fixture only: never fill a composer or send a prompt.
// EXT=<this checkout>/extension node lab/harness/bookmarks-live.mjs
// LAB_FIXTURE=math12, OUT=<notes/runs/date-bookmarks-live>, LAB_ROOT and REPS=3 are optional.
// The live lab library owns locking/restoration and the send guard. Snap cannot read hidden
// worktrees, so EXT is copied byte-for-byte to a unique, visible unpacked install, then removed.
// Output is an allowlist of numbers/booleans and public code labels. No text, IDs, URLs, shots,
// raw CDP coverage, exception messages or account settings are saved in the report.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const source = path.resolve(process.env.EXT || path.join(repo, 'extension'));
const out =
  process.env.OUT ||
  path.join(repo, `notes/runs/${new Date().toISOString().slice(0, 10)}-bookmarks-live`);
const summary = {
  testedHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  platform: 'Linux',
  checks: [],
  drags: [],
  cleanup: {},
};
let phase = 'setup',
  lab,
  browser,
  context,
  page,
  worker,
  cdp,
  scratch,
  originalCommands;
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
    await new Promise((r) => setTimeout(r, 100));
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
const save = async () => {
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
};
const check = async (name, pass, numbers = {}) => {
  summary.checks.push({ name, pass: !!pass, ...numbers });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${JSON.stringify(numbers)}`);
  await save();
};
const requireThat = (v, label) => {
  if (!v) throw new Error(label);
};
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
// Only this unique install's database is read. No stored record is returned to Node.
const storedCount = () =>
  worker.evaluate(async () => {
    const db = await new Promise((ok, no) => {
      const r = indexedDB.open('butter-layouts-v1');
      r.onsuccess = () => ok(r.result);
      r.onerror = no;
    });
    try {
      return await new Promise((ok, no) => {
        const r = db.transaction('bookmarks').objectStore('bookmarks').count();
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
    } finally {
      db.close();
    }
  });
const railState = () =>
  page.evaluate(() => {
    const r = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
    return {
      ticks: r?.querySelectorAll('.tick').length || 0,
      marks: r?.querySelectorAll('.mark:not(.gone)').length || 0,
      more: r ? !r.querySelector('.more').hidden : false,
      stale: r?.querySelectorAll('.mark.stale').length || 0,
      busy: r?.querySelectorAll('.busy').length || 0,
    };
  });
const barGeometry = () =>
  page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(
        (s) => s.clientHeight > 0,
      ),
      r = s.getBoundingClientRect();
    const gutter = s.offsetWidth - s.clientWidth,
      thumb = Math.max(20, s.clientHeight ** 2 / s.scrollHeight);
    return {
      x: r.right - (gutter ? gutter / 2 : 3),
      top: r.top,
      height: s.clientHeight,
      scrollHeight: s.scrollHeight,
      scrollTop: s.scrollTop,
      gutter,
      y:
        r.top +
        (s.scrollTop / (s.scrollHeight - s.clientHeight)) * (s.clientHeight - thumb) +
        thumb / 2,
    };
  });
async function waitLanding() {
  await page.waitForFunction(
    () => {
      const r = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
      return (
        r &&
        !r.querySelector('.busy') &&
        getComputedStyle(r.querySelector('.warp')).visibility === 'hidden'
      );
    },
    null,
    { timeout: 70000 },
  );
  await page.waitForTimeout(2000);
}
async function waitSeekSettled() {
  await page.waitForFunction(
    () => {
      const dump = window.__seekDump?.();
      const root = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
      return (
        dump &&
        !window.__seekDump.held &&
        !dump.pending &&
        root &&
        !root.querySelector('.seek-card')
      );
    },
    null,
    { timeout: 70000 },
  );
}
async function open() {
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, process.env.LAB_FIXTURE || 'math12'), {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page
    .locator('.thread-scroll-container:visible [data-turn-key]')
    .first()
    .waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await page.waitForFunction(() => !!window.__seekDump, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.bringToFront();
}
async function loadEarlier() {
  const before = await railState();
  if (before.more) {
    await page.locator('chatgpt-butter-nav .more').click();
    await page.mouse.move(10, 300);
    await page.waitForFunction(
      () => document.querySelector('chatgpt-butter-nav')?.shadowRoot.querySelector('.more').hidden,
      null,
      { timeout: 90000 },
    );
    await waitLanding();
  }
  return { before, after: await railState() };
}
async function installTargets() {
  // Keep raw anchors in page/worker memory only; the script carries just paragraph ordinals.
  const picked = await page.evaluate(() => {
    const answer =
      ':is([data-markdown-text-style="assistant-message"]:not(:has([class*="DilResponseRoot"])), [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"])';
    const turns = [...document.querySelectorAll('[data-turn-key]')];
    const suitable = turns.filter((t) => t.querySelectorAll(`${answer} > p`).length >= 2);
    const t =
      suitable.find((t) => {
        const b = t.getBoundingClientRect();
        return b.bottom > 80 && b.top < innerHeight - 100;
      }) || suitable[0];
    if (!t) return null;
    const a = t.querySelector(answer);
    if (!a) return null;
    const paras = [...a.children]
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.tagName === 'P' && b.textContent.trim().length > 60);
    if (paras.length < 2) return null;
    window.__bookmarkLive = {
      turn: t.dataset.turnKey,
      paras: paras.slice(0, 2).map(({ i }) => i),
      answer,
    };
    return { turnOrdinalMounted: turns.indexOf(t), paragraphs: window.__bookmarkLive.paras };
  });
  requireThat(picked, 'no suitable real answer paragraphs');
  // Capture IDs privately in the worker across reload; never serialize them in the summary.
  const target = await page.evaluate(() => window.__bookmarkLive);
  await worker.evaluate((v) => {
    globalThis.liveTarget = v;
  }, target);
  return picked;
}
async function restoreTargets() {
  await page.evaluate(
    (v) => {
      window.__bookmarkLive = v;
    },
    await worker.evaluate(() => liveTarget),
  );
}
async function targetBox(which, scroll = false) {
  return page.evaluate(
    ([which, scroll]) => {
      const t = window.__bookmarkLive,
        m = document.querySelector(`[data-turn-key="${t.turn}"]`),
        b = m?.querySelector(t.answer)?.children[t.paras[which]];
      if (!b) return null;
      const s = [...document.querySelectorAll('.thread-scroll-container')].find(
        (s) => s.clientHeight > 0,
      );
      if (scroll)
        s.scrollTop += b.getBoundingClientRect().top - s.getBoundingClientRect().top - 160;
      const r = b.getBoundingClientRect();
      return {
        top: r.top - s.getBoundingClientRect().top,
        bottom: r.bottom - s.getBoundingClientRect().top,
        x: r.left + Math.min(150, r.width / 2),
        y: r.top + Math.min(12, r.height / 2),
        height: r.height,
        inView:
          r.top >= Math.max(0, s.getBoundingClientRect().top) + 52 &&
          r.top < s.getBoundingClientRect().bottom,
      };
    },
    [which, scroll],
  );
}
async function bookmarkParagraph() {
  await targetBox(0, true);
  await page.waitForTimeout(1800);
  const b = await targetBox(0);
  requireThat(b, 'target virtualized before hover');
  await page.mouse.move(10, 300);
  await page.mouse.move(b.x, b.y);
  await page.waitForTimeout(800);
  const shown = await page.locator('chatgpt-butter-bookmark button.show').count();
  summary.paragraphAttempt = {
    inView: b.inView,
    hoverButtonShown: shown,
    hitTarget: await page.evaluate(
      ([x, y]) => !!document.elementFromPoint(x, y)?.closest('p'),
      [b.x, b.y],
    ),
  };
  if (shown) await page.locator('chatgpt-butter-bookmark button.show').click();
  await page.waitForTimeout(800);
  // Button text is public Butter UI, never report surrounding page content.
  const gotIt = page.getByRole('button', { name: 'Got it', exact: true });
  if (await gotIt.count()) await gotIt.click();
}
async function bookmarkSelection() {
  await targetBox(1, true);
  await page.waitForTimeout(1800);
  const selected = await page.evaluate(() => {
    const t = window.__bookmarkLive,
      b = document.querySelector(`[data-turn-key="${t.turn}"]`).querySelector(t.answer).children[
        t.paras[1]
      ];
    const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) if (n.data.trim().length >= 40) break;
    if (!n) return 0;
    const r = document.createRange();
    r.setStart(n, 5);
    r.setEnd(n, Math.min(35, n.length));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    return r.toString().length;
  });
  execFileSync('python3', [path.join(here, 'xtest-keys.py'), 'Alt+Shift+M', '700', '20'], {
    env: { ...process.env, DISPLAY: lab.display },
  });
  await page.waitForTimeout(1000);
  await page.evaluate(() => getSelection().removeAllRanges());
  return selected;
}
async function beginJumpProbe() {
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  await page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
    window.__jumpProbe = { clicks: [], keys: [], seekStates: [] };
    if (window.__jumpProbeInstalled) return;
    window.__jumpProbeInstalled = true;
    document.addEventListener('butter-seek-state', (e) => {
      const m = JSON.parse(e.detail);
      __jumpProbe.seekStates.push({
        state: m.state,
        targetEqualsBookmarkedQuestion: m.id === window.__bookmarkLive.turn,
        pointerHeld: window.__seekDump.held,
      });
    });
    root.addEventListener(
      'click',
      (e) => {
        const el = e.composedPath()[0];
        __jumpProbe.clicks.push({
          control: el.closest('.go') ? 'go' : el.closest('.mark') ? 'mark' : 'other',
          trusted: e.isTrusted,
          detail: e.detail,
        });
      },
      { capture: true },
    );
    root.addEventListener(
      'keydown',
      (e) => {
        if (['Enter', 'ArrowLeft'].includes(e.key))
          __jumpProbe.keys.push({
            key: e.key,
            control: e.target.matches('.mark') ? 'mark' : 'other',
            trusted: e.isTrusted,
          });
      },
      { capture: true },
    );
  });
}
async function endJumpProbe(label) {
  const coverage = (await cdp.send('Profiler.takePreciseCoverage')).result;
  await cdp.send('Profiler.stopPreciseCoverage');
  const calls = {};
  for (const script of coverage) {
    const kind = script.url.endsWith('/bookmarks/content.js')
      ? 'bookmark'
      : script.url.endsWith('/rail/rail.js')
        ? 'rail'
        : null;
    if (!kind) continue;
    for (const f of script.functions)
      if (['locate', 'jump', 'jumpTo', 'landOff', 'targetTop', 'glide'].includes(f.functionName))
        calls[`${kind}.${f.functionName}`] =
          (calls[`${kind}.${f.functionName}`] || 0) + (f.ranges[0]?.count || 0);
  }
  const result = {
    ...(await page.evaluate(() => window.__jumpProbe)),
    calls,
    paragraph: await targetBox(0),
    selection: await targetBox(1),
  };
  summary.jumpEvidence ||= {};
  summary.jumpEvidence[label] = result;
  console.log(`INFO jump ${label} ${JSON.stringify(result)}`);
}
async function jump(which = 0, held = false) {
  const mark = page.locator('chatgpt-butter-nav .mark:not(.gone)').first();
  if (held) {
    // One pointer cannot both hold a native thumb and click a card: activate with the keyboard.
    await mark.evaluate((el) => el.focus());
    await page.keyboard.press('Enter');
  } else {
    await mark.focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(400);
    const rows = page.locator('chatgpt-butter-nav .bmc .go, chatgpt-butter-nav .bmc .one');
    await rows.nth(which).waitFor({ state: 'visible', timeout: 10000 });
    await rows.nth(which).click();
  }
}
async function startDrag() {
  execFileSync('python3', [path.join(here, 'xtest-keys.py'), 'Shift', '700', '20'], {
    env: { ...process.env, DISPLAY: lab.display },
  });
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(
      (s) => s.clientHeight > 0,
    );
    s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.55;
  });
  await page.waitForTimeout(2500);
  const b = await barGeometry();
  await page.mouse.move(b.x, b.y);
  await page.mouse.down();
  await page.mouse.move(b.x, Math.min(b.top + b.height - 30, b.y + 60), { steps: 6 });
  await page.waitForTimeout(200);
  requireThat(await page.evaluate(() => window.__seekDump.held), 'native thumb hold not detected');
  return b;
}
async function drag(arm, repetition) {
  phase = `drag-${arm}-${repetition}`;
  const b = await startDrag();
  await cdp.send('Profiler.enable');
  await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
  await worker.evaluate(() => {
    liveProbe.reads = 0;
    liveProbe.messages = 0;
  });
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(
      (s) => s.clientHeight > 0,
    );
    window.__liveDrag = {
      mounts: 0,
      additions: 0,
      held: true,
      frames: [],
      start: performance.now(),
      updates: __seekDump().updateCount,
    };
    const state = __liveDrag;
    state.mo = new MutationObserver((rs) => {
      for (const r of rs)
        for (const n of r.addedNodes)
          if (n.nodeType === 1) {
            state.mounts +=
              (n.matches('[data-turn-key]') ? 1 : 0) + n.querySelectorAll('[data-turn-key]').length;
            state.additions += 1 + n.querySelectorAll('*').length;
          }
    });
    state.mo.observe(s, { childList: true, subtree: true });
    let last = performance.now();
    const frame = (t) => {
      if (state.done) return;
      state.frames.push(t - last);
      last = t;
      state.held &&= __seekDump.held;
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  for (const offset of [110, 160, 90, 40, 140, 60]) {
    await page.mouse.move(b.x, Math.min(b.top + b.height - 30, b.y + offset), { steps: 5 });
    await page.waitForTimeout(150);
  }
  const observation = await page.evaluate(() => {
    const s = __liveDrag;
    s.done = true;
    s.mo.disconnect();
    const f = s.frames.slice(1).sort((a, b) => a - b);
    return {
      mounts: s.mounts,
      additions: s.additions,
      held: s.held && __seekDump.held,
      updates: __seekDump().updateCount - s.updates,
      frames: f.length,
      p95FrameMs: Math.round((f[Math.floor(f.length * 0.95)] || 0) * 10) / 10,
      maxFrameMs: Math.round((f.at(-1) || 0) * 10) / 10,
    };
  });
  const coverage = (await cdp.send('Profiler.takePreciseCoverage')).result;
  await cdp.send('Profiler.stopPreciseCoverage');
  const critical = [
    'refresh',
    'paragraphs',
    'measure',
    'selection',
    'topBlock',
    'locate',
    'create',
    'remove',
    'show',
    'place',
  ];
  observation.bookmarkCoverageScripts = coverage.filter((s) =>
    s.url.endsWith('/bookmarks/content.js'),
  ).length;
  observation.bookmarkFunctionCalls = coverage
    .filter((s) => s.url.endsWith('/bookmarks/content.js'))
    .flatMap((s) => s.functions)
    .reduce((n, f) => n + (f.ranges[0]?.count || 0), 0);
  observation.bookmarkWork = Object.fromEntries(critical.map((n) => [n, 0]));
  for (const script of coverage.filter((s) => s.url.endsWith('/bookmarks/content.js')))
    for (const f of script.functions)
      if (critical.includes(f.functionName))
        observation.bookmarkWork[f.functionName] += f.ranges[0]?.count || 0;
  observation.storage = await worker.evaluate(() => ({
    reads: liveProbe.reads,
    messages: liveProbe.messages,
  }));
  await page.mouse.up();
  await waitSeekSettled();
  await waitLanding();
  summary.drags.push({ arm, repetition, ...observation });
  await check(
    `held drag ${arm} ${repetition}`,
    observation.bookmarkCoverageScripts === 1 &&
      observation.held &&
      observation.updates > 0 &&
      observation.mounts === 0 &&
      observation.storage.reads === 0 &&
      observation.storage.messages === 0 &&
      Object.values(observation.bookmarkWork).every((n) => n === 0),
    observation,
  );
}
async function deleteMarks() {
  // Exercise the card's real delete controls. Fallback cleanup only touches this fresh install.
  for (let i = 0; i < 4 && (await storedCount()); i++) {
    const mark = page.locator('chatgpt-butter-nav .mark:not(.gone)').first();
    if (!(await mark.count())) break;
    await mark.focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(300);
    const x = page.locator('chatgpt-butter-nav .x').first();
    if (!(await x.count())) break;
    await x.click();
    await page.waitForTimeout(700);
  }
  return storedCount();
}
try {
  scratch = await fs.mkdtemp(
    path.join(os.homedir(), 'snap/chromium/common/butter-bookmarks-live-'),
  );
  await fs.cp(source, path.join(scratch, 'extension'), { recursive: true });
  const extension = path.join(scratch, 'extension');
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
  summary.extensionTreeSha256 = await digestTree(source);
  requireThat(
    summary.extensionTreeSha256 === (await digestTree(extension)),
    'extension copy differs',
  );
  lab = L.acquire('auto', {
    owner: 'butter-57-bookmarks-live-2',
    needsFixture: process.env.LAB_FIXTURE || 'math12',
    wait: 60,
    perf: true,
  });
  console.log('PASS acquired fixture lab and perf lock');
  await stopBrowser();
  originalCommands = {
    value: JSON.parse(await fs.readFile(path.join(lab.profile, 'Default/Preferences'), 'utf8'))
      .extensions?.commands,
  };
  const extensionId = [...createHash('sha256').update(extension).digest('hex').slice(0, 32)]
    .map((h) => String.fromCharCode(97 + parseInt(h, 16)))
    .join('');
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
  ({ browser, context } = await L.connect(lab));
  summary.chromium = browser.version();
  await L.sendGuard(context, lab);
  summary.sendGuard = { enabled: true, sendAttempts: 0, blockedMutations: 0 };
  await context.route('**/*', (route) => {
    const r = route.request(),
      u = new URL(r.url());
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(r.method()) &&
      (u.hostname === 'chatgpt.com' || u.hostname.endsWith('.chatgpt.com'))
    ) {
      summary.sendGuard.blockedMutations++;
      if (/^\/backend-api\/(?:f\/)?conversation(?:\/prepare)?$/.test(u.pathname))
        summary.sendGuard.sendAttempts++;
    }
    return route.fallback();
  });
  worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
  await worker.evaluate(() => {
    globalThis.liveProbe = { reads: 0, messages: 0, commands: 0 };
    chrome.runtime.onMessage.addListener((m) => {
      if (m?.type?.startsWith('butter-bookmark-')) liveProbe.messages++;
    });
    chrome.commands.onCommand.addListener((c) => {
      if (c === 'bookmark') liveProbe.commands++;
    });
    for (const proto of [IDBObjectStore.prototype, IDBIndex.prototype])
      for (const name of [
        'get',
        'getAll',
        'getAllKeys',
        'getKey',
        'count',
        'openCursor',
        'openKeyCursor',
      ]) {
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
  summary.shortcut = await worker.evaluate(
    async () => (await chrome.commands.getAll()).find((c) => c.name === 'bookmark')?.shortcut,
  );
  requireThat(summary.shortcut === 'Alt+Shift+M', 'bookmark shortcut unavailable');
  page = context.pages()[0] || (await context.newPage());
  for (const other of context.pages()) if (other !== page) await other.close();
  cdp = await context.newCDPSession(page);
  let earlierPages = 0;
  const apiHashes = new Set(),
    apiPending = new Set();
  let apiPages = 0;
  // Consume only successful conversation API responses already requested by ChatGPT.
  // Raw response data never leaves this callback; only SHA-256 digests survive in memory.

  page.on('response', (r) => {
    const u = new URL(r.url());
    if (/\/messages$/.test(u.pathname) && u.searchParams.has('before') && r.ok()) earlierPages++;
    if (
      r.request().method() !== 'GET' ||
      !r.ok() ||
      !/\/backend-api\/conversations?\/[0-9a-f-]{36}(?:\/messages)?$/.test(u.pathname)
    )
      return;
    const pending = (async () => {
      const data = await r.json();
      const messages = data.messages || Object.values(data.mapping || {}).map((n) => n.message);
      for (const m of messages)
        if (m?.author?.role === 'assistant' && m.id)
          apiHashes.add(createHash('sha256').update(m.id).digest('hex'));
      apiPages++;
    })().catch(() => {});
    apiPending.add(pending);
    pending.finally(() => apiPending.delete(pending));
  });
  phase = 'load-fixture';
  await open();
  summary.initial = { ...(await railState()), ...(await barGeometry()) };
  console.log('INFO initial', JSON.stringify(summary.initial));
  phase = 'load-earlier';
  summary.history = await loadEarlier();
  console.log('INFO history', JSON.stringify(summary.history));
  phase = 'pick-targets';
  summary.structure = await page.evaluate(() =>
    [...document.querySelectorAll('[data-turn-key]')].map((t) => ({
      assistant: t.querySelectorAll('[data-message-author-role="assistant"]').length,
      ids: t.querySelectorAll('[data-message-author-role="assistant"][data-message-id]').length,
      markdown: t.querySelectorAll('[data-markdown-text-style="assistant-message"]').length,
      paragraphs: t.querySelectorAll('p').length,
      messageIds: t.querySelectorAll('[data-message-id]').length,
    })),
  );
  console.log('INFO structure', JSON.stringify(summary.structure));
  summary.target = await installTargets();
  summary.answerAncestors = await page.evaluate(() => {
    let el = document
      .querySelector(`[data-turn-key="${__bookmarkLive.turn}"]`)
      .querySelector(__bookmarkLive.answer);
    const rows = [];
    for (let i = 0; el && i < 5; i++, el = el.parentElement)
      rows.push({ tag: el.tagName, attributes: [...el.attributes].map((a) => a.name) });
    return rows;
  });
  await check(
    'real long fixture loaded',
    summary.history.after.ticks > summary.initial.ticks && !summary.history.after.more,
    { initialTicks: summary.initial.ticks, totalTicks: summary.history.after.ticks, earlierPages },
  );
  requireThat((await storedCount()) === 0, 'unique unpacked install unexpectedly has bookmarks');
  for (let i = 1; i <= +(process.env.REPS || 3); i++) await drag('empty', i);
  // A native seek can virtualize the original answer away. Reacquire a real mounted target.
  summary.target = await installTargets();
  await Promise.all([...apiPending]);
  const identity = await page.evaluate(
    async (hashes) => {
      const known = new Set(hashes);
      const roots = [
        ...document.querySelectorAll('[data-markdown-text-style="assistant-message"]'),
      ];
      let checked = 0,
        matched = 0;
      const hash = async (id) =>
        [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      for (const root of roots) {
        const id = root
          .closest('[data-chatgpt-selection-message-id]')
          ?.getAttribute('data-chatgpt-selection-message-id');
        if (!id) continue;
        checked++;
        if (known.has(await hash(id))) matched++;
      }
      const t = window.__bookmarkLive;
      const root = document.querySelector(`[data-turn-key="${t.turn}"]`).querySelector(t.answer);
      const id = root
        .closest('[data-chatgpt-selection-message-id]')
        ?.getAttribute('data-chatgpt-selection-message-id');
      return { checked, matched, targetMatched: !!id && known.has(await hash(id)) };
    },
    [...apiHashes],
  );
  await check(
    'live selection message ids match conversation API by SHA-256',
    identity.checked > 0 && identity.checked === identity.matched && identity.targetMatched,
    { ...identity, apiPages, assistantApiMessages: apiHashes.size },
  );
  phase = 'bookmark-paragraph';
  await bookmarkParagraph();
  await check('paragraph button saves one bookmark', (await storedCount()) === 1, {
    stored: await storedCount(),
    marks: (await railState()).marks,
  });
  phase = 'bookmark-selection';
  const selectionCharacters = await bookmarkSelection();
  await check('selection saved through real Alt+Shift+M', (await storedCount()) === 2, {
    stored: await storedCount(),
    selectionCharacters,
    commands: await worker.evaluate(() => liveProbe.commands),
    marks: (await railState()).marks,
  });
  if ((await storedCount()) !== 2) {
    for (const name of [
      'jump during native scrollbar drag',
      'jump after scrollbar drag',
      'reload and jump to unloaded earlier answer',
      'matched drag comparison with bookmarks versus empty',
    ]) {
      summary.checks.push({
        name,
        pass: false,
        status: 'blocked',
        reason: 'bookmark-creation-failed',
      });
      console.log(`BLOCKED ${name}: bookmark creation failed`);
    }
    await check('test bookmarks cleaned up', (await storedCount()) === 0, {
      remaining: await storedCount(),
    });
  } else {
    for (let i = 1; i <= +(process.env.REPS || 3); i++) await drag('bookmarked', i);
    const empty = summary.drags.filter((d) => d.arm === 'empty');
    const marked = summary.drags.filter((d) => d.arm === 'bookmarked');
    await check(
      'matched drag comparison with bookmarks versus empty',
      empty.length === marked.length &&
        empty.length > 0 &&
        [...empty, ...marked].every(
          (d) =>
            d.mounts === 0 &&
            d.additions === 0 &&
            d.storage.reads === 0 &&
            d.storage.messages === 0 &&
            Object.values(d.bookmarkWork).every((n) => n === 0),
        ),
      {
        emptyRuns: empty.length,
        bookmarkedRuns: marked.length,
        emptyP95FrameMs: empty.map((d) => d.p95FrameMs),
        bookmarkedP95FrameMs: marked.map((d) => d.p95FrameMs),
      },
    );
    phase = 'jump-after-drag';
    await beginJumpProbe();
    await jump(1);
    await waitLanding();
    await endJumpProbe('after-drag');
    const after = await targetBox(1);
    await check(
      'selection card jump after drag lands on text',
      after?.inView,
      after || { mounted: false },
    );
    phase = 'jump-during-drag';
    await startDrag();
    const heldBefore = await page.evaluate(() => __seekDump.held);
    await beginJumpProbe();
    await jump(0, true);
    await page.waitForTimeout(1500);
    const during = await targetBox(0),
      heldAfterActivation = await page.evaluate(() => __seekDump.held);
    await page.mouse.up();
    await waitSeekSettled();
    await waitLanding();
    await endJumpProbe('during-drag');
    const released = await targetBox(0);
    await check(
      'paragraph jump requested during native drag lands on text',
      heldBefore && released?.inView,
      {
        heldBefore,
        heldAfterActivation,
        visibleWhileHeld: !!during?.inView,
        visibleAfterRelease: !!released?.inView,
        textTopAfterRelease: released?.top ?? null,
      },
    );
    phase = 'reload-unloaded';
    await open();
    await restoreTargets();
    const cold = {
      ...(await railState()),
      stored: await storedCount(),
      targetMounted: !!(await targetBox(0)),
      earlierPagesBefore: earlierPages,
    };
    console.log('INFO cold', JSON.stringify(cold));
    await check(
      'reload leaves bookmarked earlier answer unloaded',
      !cold.targetMounted && cold.more,
      cold,
    );
    phase = 'jump-unloaded';
    await beginJumpProbe();
    await jump(0);
    await waitLanding();
    await endJumpProbe('unloaded');
    const coldLanding = await targetBox(0);
    await check(
      'unloaded bookmark jump loads earlier pages and lands on text',
      !cold.targetMounted && earlierPages > cold.earlierPagesBefore && coldLanding?.inView,
      {
        earlierPages: earlierPages - cold.earlierPagesBefore,
        targetMounted: !!coldLanding,
        inView: !!coldLanding?.inView,
        textTop: coldLanding?.top ?? null,
        ...(await railState()),
      },
    );
    // A failed unloaded jump cannot establish resolution. Load history through the existing
    // dots independently, then check the mounted original answer and card without altering it.
    if (!coldLanding) {
      await loadEarlier();
      await beginJumpProbe();
      await jump(0);
      await waitLanding();
      await endJumpProbe('after-manual-history');
    }
    await restoreTargets();
    const records = await worker.evaluate(async () => {
      const db = await new Promise((ok, no) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      try {
        return await new Promise((ok, no) => {
          const r = db.transaction('bookmarks').objectStore('bookmarks').getAll();
          r.onsuccess = () =>
            ok(r.result.map(({ msg, para, excerpt }) => ({ msg, para, excerpt })));
          r.onerror = no;
        });
      } finally {
        db.close();
      }
    });
    const resolution = await page.evaluate(async (records) => {
      const t = window.__bookmarkLive;
      const answer = document.querySelector(`[data-turn-key="${t.turn}"]`)?.querySelector(t.answer);
      const id = answer
        ?.closest('[data-chatgpt-selection-message-id]')
        ?.getAttribute('data-chatgpt-selection-message-id');
      const hash =
        id &&
        [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      const flat = (text) => text.replace(/\s+/g, ' ').trim();
      let matched = 0;
      for (const b of records) {
        const block = answer?.children[b.para];
        if (
          hash === b.msg &&
          block &&
          flat(block.textContent).includes([...flat(b.excerpt)].slice(0, 40).join(''))
        )
          matched++;
      }
      return {
        targetMounted: !!answer,
        records: records.length,
        matchingMessagesAndExcerpts: matched,
      };
    }, records);
    await page.locator('chatgpt-butter-nav .mark:not(.gone)').first().focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(2800);
    const live = await page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
      return {
        marks: r.querySelectorAll('.mark:not(.gone)').length,
        staleMarks: r.querySelectorAll('.mark.stale:not(.gone)').length,
        cardRows: r.querySelectorAll('.bmc .go, .bmc .one').length,
        staleRows: r.querySelectorAll('.bmc .it.stale, .bmc.stale, .bmc .why, .bmc .warn').length,
      };
    });
    await check(
      'reload resolves both bookmarks live without answer changed',
      resolution.targetMounted &&
        resolution.matchingMessagesAndExcerpts === 2 &&
        (await storedCount()) === 2 &&
        live.marks === 1 &&
        live.staleMarks === 0 &&
        live.cardRows === 2 &&
        live.staleRows === 0,
      { ...live, ...resolution },
    );
    phase = 'delete';
    const remaining = await deleteMarks();
    await check('card delete removes both test bookmarks', remaining === 0, {
      remaining,
      marks: (await railState()).marks,
    });
  }
} catch (e) {
  // Exception strings can contain live locators/text/URLs. Save only the phase and error class.
  await fs.writeFile('/tmp/butter-bookmarks-live-error.txt', e.stack || String(e), { mode: 0o600 });
  summary.failure = { phase, kind: e.name };
  console.log(`FAIL harness phase=${phase} error=${e.name}`);
  process.exitCode = 1;
} finally {
  try {
    if (page && !page.isClosed()) await page.mouse.up().catch(() => {});
    if (worker) {
      // Failure cleanup: the new extension origin is task-owned; no normal lab data is touched.
      summary.cleanup.remainingBeforeFallback = await storedCount().catch(() => null);
      await worker.evaluate(async () => {
        const db = await new Promise((ok, no) => {
          const r = indexedDB.open('butter-layouts-v1');
          r.onsuccess = () => ok(r.result);
          r.onerror = no;
        });
        try {
          await new Promise((ok, no) => {
            const tx = db.transaction('bookmarks', 'readwrite');
            tx.objectStore('bookmarks').clear();
            tx.oncomplete = ok;
            tx.onerror = no;
          });
        } finally {
          db.close();
        }
      });
      summary.cleanup.remainingAfterFallback = await storedCount();
    }
  } finally {
    if (browser) await browser.close().catch(() => {});
    try {
      if (lab) {
        if (originalCommands) {
          await stopBrowser();
          await writeCommands(originalCommands.value);
          summary.cleanup.shortcutsRestored = true;
        }
        const restored = await L.restore(lab, { log: () => {} });
        summary.cleanup.restored = restored.ok;
        summary.cleanup.composerEmpty = restored.composer === '';
        summary.cleanup.oneHomeTab = restored.pages.length === 1;
        summary.cleanup.defaultExtensions =
          JSON.stringify(restored.browser.extensions) === JSON.stringify(lab.defaultExtensions);
        console.log(`PASS lab restored ${JSON.stringify(summary.cleanup)}`);
      }
    } finally {
      if (lab) {
        const released = L.release(lab);
        summary.cleanup.labLockReleased = released.lab_released;
        summary.cleanup.perfLockReleased = released.perf_released;
        console.log('PASS lab and perf locks released');
      }
      if (scratch) await fs.rm(scratch, { recursive: true, force: true });
      await save();
    }
  }
}
if (summary.checks.some((x) => !x.pass)) process.exitCode = 1;
