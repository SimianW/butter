// #57 / #51, seam 3. Existing live fixture only: never fill a composer or send a prompt.
// EXT=<this checkout>/extension node lab/harness/bookmarks-live.mjs
// MODE=wash runs only the landing wash check (#69, #74): see washRun below. It needs no perf lock
// and no shortcut binding.
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
// Match bookmarks/content.js blocksOf: list items count individually, in document order.
const BLOCKS = ':scope > :not(ul, ol), :scope > :is(ul, ol) > li';
const source = path.resolve(process.env.EXT || path.join(repo, 'extension'));
const out =
  process.env.OUT ||
  path.join(repo, `notes/runs/${new Date().toISOString().slice(0, 10)}-bookmarks-live`);
const WASH = process.env.MODE === 'wash';
const summary = {
  // TESTED_HEAD: the commit of a copy run on the lab host without its .git.
  testedHead:
    process.env.TESTED_HEAD ||
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  mode: WASH ? 'wash' : 'matrix',
  platform: 'Linux',
  startedUtc: new Date().toISOString(),
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
  const picked = await page.evaluate((blocks) => {
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
    const paras = [...a.querySelectorAll(blocks)]
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.tagName === 'P' && b.textContent.trim().length > 60);
    if (paras.length < 2) return null;
    window.__bookmarkLive = {
      turn: t.dataset.turnKey,
      paras: paras.slice(0, 2).map(({ i }) => i),
      answer,
      blocks,
    };
    return { turnOrdinalMounted: turns.indexOf(t), paragraphs: window.__bookmarkLive.paras };
  }, BLOCKS);
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
        b = m?.querySelector(t.answer)?.querySelectorAll(t.blocks)[t.paras[which]];
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
async function bookmarkParagraph(tooltipCheck = 'hover button tooltip reads Bookmark') {
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
  if (shown) {
    await page.locator('chatgpt-butter-bookmark button.show').hover();
    await page.waitForTimeout(200);
    const tooltip = await page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-bookmark').shadowRoot;
      return {
        labelStartsBookmark: r
          .querySelector('button')
          .getAttribute('aria-label')
          .startsWith('Bookmark: '),
        labelHasText:
          r.querySelector('button').getAttribute('aria-label').length > 'Bookmark: '.length,
        tooltipIsBookmark: r.querySelector('.tip span').textContent === 'Bookmark',
        tooltipVisible: getComputedStyle(r.querySelector('.tip')).opacity === '1',
      };
    });
    await check(tooltipCheck, Object.values(tooltip).every(Boolean), tooltip);
    await page.locator('chatgpt-butter-bookmark button.show').click();
  }
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
      b = document
        .querySelector(`[data-turn-key="${t.turn}"]`)
        .querySelector(t.answer)
        .querySelectorAll(t.blocks)[t.paras[1]];
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
async function listItemBox(scroll = false) {
  const box = await targetBox(0, scroll);
  if (!box) return null;
  return page.evaluate((box) => {
    const t = window.__bookmarkLive;
    const answer = document.querySelector(`[data-turn-key="${t.turn}"]`)?.querySelector(t.answer);
    const item = answer.querySelectorAll(t.blocks)[t.paras[0]];
    const list = item.parentElement;
    const offsetFromListStart = item.getBoundingClientRect().top - list.getBoundingClientRect().top;
    return {
      ...box,
      isListItem: item.matches('li') && list.matches('ul, ol') && list.parentElement === answer,
      itemOrdinal: [...list.children].indexOf(item),
      offsetFromListStart,
      listTop: box.top - offsetFromListStart,
      // A jump to the list's start cannot satisfy this placement for the chosen later item.
      landsOnItem: box.inView && Math.abs(box.top - 64) <= 8 && offsetFromListStart > 24,
    };
  }, box);
}
async function listItemMatrix() {
  phase = 'pick-list-item';
  await loadEarlier();
  const picked = await page.evaluate((blocks) => {
    const answer =
      ':is([data-markdown-text-style="assistant-message"]:not(:has([class*="DilResponseRoot"])), [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"])';
    let lists = 0,
      items = 0,
      maxMeasuredOffset = 0,
      target = null;
    for (const turn of document.querySelectorAll('[data-turn-key]')) {
      for (const a of turn.querySelectorAll(answer)) {
        const paragraphs = [...a.querySelectorAll(blocks)];
        for (const list of a.querySelectorAll(':scope > ul, :scope > ol')) {
          lists++;
          for (const [ordinal, item] of [...list.children].entries()) {
            if (!item.matches('li')) continue;
            items++;
            const offset = item.getBoundingClientRect().top - list.getBoundingClientRect().top;
            if (
              ordinal > 0 &&
              item.textContent.trim().length > 0 &&
              offset > Math.max(24, maxMeasuredOffset)
            ) {
              maxMeasuredOffset = offset;
              target = {
                turn: turn.dataset.turnKey,
                paras: [paragraphs.indexOf(item)],
                answer,
                blocks,
              };
            }
          }
        }
      }
    }
    if (target) window.__bookmarkLive = target;
    return {
      lists,
      items,
      maxMeasuredOffset,
      targetFound: !!target,
      paragraph: target?.paras[0] ?? null,
    };
  }, BLOCKS);
  summary.listFixture = picked;
  if (picked.lists === 0) {
    summary.skipped = ['list item matrix: no top-level list in mounted fixture answers'];
    console.log('SKIP list item matrix: no top-level list in mounted fixture answers');
    return;
  }
  await check(
    'real fixture has a later top-level list item for distinct landing',
    picked.targetFound,
    picked,
  );
  requireThat(picked.targetFound, 'no distinct later list item available');
  await worker.evaluate(
    (target) => {
      globalThis.liveTarget = target;
    },
    await page.evaluate(() => window.__bookmarkLive),
  );
  phase = 'bookmark-list-item';
  await bookmarkParagraph('list item tooltip and accessible name match');
  const stored = await storedCount();
  const item = await listItemBox();
  const anchor = await worker.evaluate(async () => {
    const db = await new Promise((ok, no) => {
      const r = indexedDB.open('butter-layouts-v1');
      r.onsuccess = () => ok(r.result);
      r.onerror = no;
    });
    try {
      const records = await new Promise((ok, no) => {
        const r = db.transaction('bookmarks').objectStore('bookmarks').getAll();
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      const hash = async (id) =>
        [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))]
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('');
      globalThis.liveListRecords = records;
      return {
        matchingParagraph: records.length === 1 && records[0].para === liveTarget.paras[0],
        matchingQuestion: records.length === 1 && records[0].ask === (await hash(liveTarget.turn)),
        validFirstLine:
          records.length === 1 &&
          Number.isInteger(records[0].line) &&
          records[0].line > 0 &&
          records[0].line <= [...records[0].excerpt].length,
      };
    } finally {
      db.close();
    }
  });
  await check(
    'list item button saves its individual paragraph with ask and line',
    stored === 1 && item?.isListItem && Object.values(anchor).every(Boolean),
    { stored, ...anchor, ...item },
  );
  phase = 'jump-list-item';
  await page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(
      (s) => s.clientHeight > 0,
    );
    s.scrollTop += 1200;
  });
  await jump(0);
  await waitLanding();
  const landed = await listItemBox();
  await check(
    'list item jump lands on the item instead of the list start',
    landed?.landsOnItem,
    landed || { mounted: false },
  );
  phase = 'reload-list-item';
  await open();
  await restoreTargets();
  const cold = { ...(await railState()), targetMounted: !!(await targetBox(0)) };
  await jump(0);
  await waitLanding();
  const reloaded = await listItemBox();
  // Original anchors remain private in worker/page memory; return only equality checks.
  const records = await worker.evaluate(() => liveListRecords);
  const resolved = await page.evaluate(async (records) => {
    const t = window.__bookmarkLive;
    const a = document.querySelector(`[data-turn-key="${t.turn}"]`)?.querySelector(t.answer);
    const b = a?.querySelectorAll(t.blocks)[t.paras[0]];
    const id = a
      ?.closest('[data-chatgpt-selection-message-id]')
      ?.getAttribute('data-chatgpt-selection-message-id');
    const hash =
      id &&
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
    const flat = (text) => text.replace(/\s+/g, ' ').trim();
    const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
    return {
      matchingMessageAndExcerpt:
        records.length === 1 &&
        hash === records[0].msg &&
        !!b &&
        flat(b.textContent).includes([...flat(records[0].excerpt)].slice(0, 40).join('')),
      staleMarks: r.querySelectorAll('.mark.stale:not(.gone)').length,
    };
  }, records);
  await jump(0);
  await waitLanding();
  await page.locator('chatgpt-butter-nav .mark:not(.gone)').first().focus();
  await page.keyboard.press('ArrowLeft');
  await page.waitForTimeout(2800);
  const staleRows = await page
    .locator(
      'chatgpt-butter-nav .bmc .it.stale, chatgpt-butter-nav .bmc.stale, chatgpt-butter-nav .bmc .why, chatgpt-butter-nav .bmc .warn',
    )
    .count();
  await check(
    'list item resolves live and lands on the same item after reload',
    reloaded?.landsOnItem &&
      resolved.matchingMessageAndExcerpt &&
      resolved.staleMarks === 0 &&
      staleRows === 0 &&
      (await storedCount()) === 1,
    { cold, ...reloaded, ...resolved, staleRows },
  );
  const remaining = await deleteMarks();
  await check(
    'card delete removes list item test bookmark',
    remaining === 0 && (await railState()).marks === 0,
    { remaining, marks: (await railState()).marks },
  );
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
      if (
        ['locate', 'jump', 'jumpTo', 'earlierJump', 'landOff', 'targetTop', 'glide'].includes(
          f.functionName,
        )
      )
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
// Only geometry and comparisons with public Butter labels leave the page. Accessible segment
// names and bookmark rows include excerpts, so their raw text must never enter the evidence.
async function earlierSegmentState() {
  return page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
      more = root.querySelector('.more'),
      dots = more.getBoundingClientRect(),
      marks = [...root.querySelectorAll('.mark:not(.gone)')],
      earlier = marks.filter((m) => /earlier question/i.test(m.getAttribute('aria-label'))),
      b = earlier[0]?.getBoundingClientRect(),
      color = earlier[0] && getComputedStyle(earlier[0]).backgroundColor,
      dark = root.host.hasAttribute('data-dark');
    return {
      marks: marks.length,
      earlierMarks: earlier.length,
      loadedMarks: marks.length - earlier.length,
      moreVisible: !more.hidden,
      offsetBelowDotsPx: b ? +(b.top + b.height / 2 - dots.top - dots.height / 2).toFixed(2) : null,
      widthPx: b?.width ?? null,
      heightPx: b?.height ?? null,
      butterColor: !!color && color === (dark ? 'rgb(227, 199, 102)' : 'rgb(251, 224, 122)'),
    };
  });
}
async function checkEarlierSegment(label) {
  await page.mouse.move(10, 300);
  await page.waitForTimeout(400);
  const s = await earlierSegmentState();
  await check(
    `earlier bookmarks sit under dots and not a loaded tick (${label})`,
    s.marks === 1 &&
      s.earlierMarks === 1 &&
      s.loadedMarks === 0 &&
      s.moreVisible &&
      Math.abs(s.offsetBelowDotsPx - 5) <= 0.1 &&
      s.widthPx === 8 &&
      s.heightPx === 2 &&
      s.butterColor,
    s,
  );
}
async function hoverEarlierCard(count, label) {
  const mark = page.locator('chatgpt-butter-nav .mark:not(.gone)').first();
  const box = await mark.boundingBox();
  requireThat(box, 'earlier segment missing');
  // The rail's pointer geometry handles the 2 px segment; move to its actual centre.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(700);
  const card = await page.evaluate((count) => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
      card = root.querySelector('.card'),
      meta = root.querySelector('.bmc .meta span');
    const expected =
      count === 1 ? 'Bookmark · earlier question' : `Earlier questions · ${count} bookmarks`;
    return {
      shown: card.classList.contains('show'),
      correctMeta: meta?.textContent === expected,
      correctAccessibleName: card.getAttribute('aria-label') === expected,
      rows: root.querySelectorAll('.bmc .go, .bmc .one').length,
      staleRows: root.querySelectorAll('.bmc .it.stale, .bmc.stale, .bmc .why').length,
      singleExplanation:
        root.querySelector('.bmc .warn')?.textContent ===
        "This question isn't loaded yet. Clicking loads earlier messages first.",
    };
  }, count);
  await check(
    `hover earlier segment shows ${count}-bookmark card (${label})`,
    card.shown &&
      card.correctMeta &&
      card.correctAccessibleName &&
      card.rows === count &&
      card.staleRows === 0 &&
      (count !== 1 || card.singleExplanation),
    card,
  );
}
async function watchEarlierLoading() {
  await page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
    const s = (window.__earlierLoading = {
      sawLoadingMeta: false,
      sawSpinner: false,
      sawBusyDots: false,
    });
    const observe = () => {
      s.sawLoadingMeta ||=
        root.querySelector('.bmc .meta span')?.textContent === 'Loading earlier questions…';
      s.sawSpinner ||= !!root.querySelector('.bmc .wspin');
      s.sawBusyDots ||= root.querySelector('.more').classList.contains('busy');
    };
    s.observer = new MutationObserver(observe);
    s.observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
  });
}
// ---- MODE=wash (#69 "The landing wash", #74). On the real fixture chat, in light and in dark
// theme: a paragraph, a selection inside another paragraph, and a table are bookmarked with the
// hover button, then each is jumped to from its question's card, starting about 2500 px away. The
// fixtures hold no code block (none of their answers has one, checked on 2026-11-10), so the table
// stands for the blocks the wash covers whole; the fixture harness covers code blocks. Checked on
// ChatGPT's own markup: the boxes sit on the bookmarked text's lines (the table's one box 3 px
// around it), the text keeps its colour under them, there is no bubble flash, and when the chat
// scrolls during the hold the boxes follow their text while ChatGPT's header and composer show no
// butter over it. Only numbers and booleans leave the page; the targets stay in page and worker
// memory. ChatGPT's theme is its own client setting (localStorage `theme`); it is put back.
const WASH_HOST = 'chatgpt-butter-wash';
const ANSWER =
  ':is([data-markdown-text-style="assistant-message"]:not(:has([class*="DilResponseRoot"])), [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"])';
// Page-side helpers, installed after every load (no eval: ChatGPT's page has a CSP). Targets are
// `window.__wash`: the answer's turn key and the paragraph indices, kept in the page only.
const installKit = () =>
  page.evaluate(() => {
    const SKIP = 'button,script,style,.katex-mathml';
    const sc = () =>
      [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
    // A paragraph's text runs, as bookmarks/content.js counts them.
    const nodes = (b) => {
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT),
        out = [];
      let at = 0;
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.parentElement?.closest(SKIP)) continue;
        out.push({ n, start: at });
        at += n.data.length;
      }
      return out;
    };
    const block = (kind) => {
      const W = window.__wash,
        a = document.querySelector(`[data-turn-key="${W.turn}"]`)?.querySelector(W.answer);
      return (
        a?.querySelectorAll(W.blocks)[
          kind === 'paragraph' ? W.para : kind === 'selection' ? W.sel.para : W.table
        ] ?? null
      );
    };
    const tableOf = (b) => (b.matches('table') ? b : b.querySelector('table'));
    window.__wk = {
      sc,
      // Picks, among the mounted answers (latest first), one with two long paragraphs and a table.
      pick(blocks, answer) {
        for (const t of [...document.querySelectorAll('[data-turn-key]')].reverse()) {
          const a = t.querySelector(answer);
          if (!a) continue;
          const bs = [...a.querySelectorAll(blocks)];
          const ps = bs
            .map((b, i) => ({ b, i }))
            .filter(({ b }) => b.tagName === 'P' && b.textContent.replace(/\s+/g, ' ').length > 160);
          const table = bs.findIndex((b) => !!tableOf(b));
          if (ps.length < 2 || table < 0) continue;
          // The selection: about 110 characters of a plain run of text in the second paragraph,
          // from and to a non-space character (a selection's ends are trimmed).
          const long = nodes(ps[1].b).find(
            (x) => x.n.data.length >= 90 && !x.n.parentElement.closest('.katex, code, a'),
          );
          if (!long) continue;
          const d = long.n.data;
          let s = 5,
            e = Math.min(d.length, 115);
          while (s < e && /\s/.test(d[s])) s++;
          while (e > s && /\s/.test(d[e - 1])) e--;
          const sel = { para: ps[1].i, start: long.start + s, end: long.start + e };
          window.__wash = { turn: t.dataset.turnKey, answer, blocks, para: ps[0].i, sel, table };
          return {
            paragraph: ps[0].i,
            selectionParagraph: sel.para,
            selectionCharacters: sel.end - sel.start,
            table,
            tableNested: !bs[table].matches('table'),
          };
        }
        return null;
      },
      // Scrolls target `kind` to `y` px below the scroller's top.
      show(kind, y) {
        const b = block(kind),
          s = sc();
        if (b) s.scrollTop += b.getBoundingClientRect().top - s.getBoundingClientRect().top - y;
        return !!b;
      },
      // A point on the target's first line.
      point(kind) {
        const r = block(kind)?.getBoundingClientRect();
        return r && { x: r.left + Math.min(150, r.width / 2), y: r.top + Math.min(12, r.height / 2) };
      },
      select() {
        const W = window.__wash,
          ns = nodes(block('selection')),
          at = (o) => ns.findLast((x) => x.start <= o),
          p = at(W.sel.start),
          q = at(W.sel.end - 1),
          r = document.createRange();
        r.setStart(p.n, W.sel.start - p.start);
        r.setEnd(q.n, W.sel.end - q.start);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      },
      // The lines the bookmarked text has now, 2 px above and below (the wash's boxes when they
      // are right); for the table, its box (cut to a viewport that scrolls it) 3 px around it.
      expected(kind) {
        const b = block(kind);
        if (!b) return [];
        const t = tableOf(b);
        if (kind === 'table' && t) {
          const q = t.getBoundingClientRect();
          let { left, right } = q;
          for (let k = t.parentElement; k && b.contains(k); k = k.parentElement)
            if (getComputedStyle(k).overflowX !== 'visible') {
              const v = k.getBoundingClientRect();
              left = Math.max(left, v.left);
              right = Math.min(right, v.right);
            }
          return [{ left: left - 3, right: right + 3, top: q.top - 3, bottom: q.bottom + 3 }];
        }
        const W = window.__wash,
          [from, to] = kind === 'selection' ? [W.sel.start, W.sel.end] : [0, Infinity],
          r = document.createRange(),
          lines = [];
        for (const { n, start } of nodes(b)) {
          const f = Math.max(from, start),
            e = Math.min(to, start + n.data.length);
          if (f >= e) continue;
          r.setStart(n, f - start);
          r.setEnd(n, e - start);
          for (const q of r.getClientRects()) {
            if (!(q.width > 0 && q.height > 0)) continue;
            const mid = (q.top + q.bottom) / 2,
              l = lines.at(-1);
            if (l && mid >= l.top && mid <= l.bottom) {
              l.left = Math.min(l.left, q.left);
              l.right = Math.max(l.right, q.right);
              l.top = Math.min(l.top, q.top);
              l.bottom = Math.max(l.bottom, q.bottom);
            } else lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
          }
        }
        return lines.map((l) => ({ ...l, top: l.top - 2, bottom: l.bottom + 2 }));
      },
      // The wash now: its boxes, clip, blend and colour, and ChatGPT's header bottom (the fixed or
      // sticky box over the scroller's top) and composer top.
      now(WASH) {
        const host = document.querySelector(WASH),
          r = sc().getBoundingClientRect();
        let h = document.elementFromPoint(r.left + r.width / 2, Math.max(0, r.top) + 8);
        while (h && !['fixed', 'sticky'].includes(getComputedStyle(h).position)) h = h.parentElement;
        const composer = document
          .querySelector('form:has([contenteditable="true"])')
          ?.getBoundingClientRect();
        const box = (q) => ({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
        const i = host?.shadowRoot.querySelector('i');
        return {
          shown: !!host,
          boxes: host
            ? [...host.shadowRoot.querySelectorAll('i')].map((i) => box(i.getBoundingClientRect()))
            : [],
          clip: host ? box(host.shadowRoot.querySelector('div').getBoundingClientRect()) : null,
          blend: host ? getComputedStyle(host).mixBlendMode : null,
          pointer: host ? getComputedStyle(host).pointerEvents : null,
          color: i ? getComputedStyle(i).backgroundColor : null,
          headerBottom: h ? h.getBoundingClientRect().bottom : null,
          scrollerTop: r.top,
          composerTop: composer?.top ?? null,
          scrollTop: sc().scrollTop,
          flash: !!document.querySelector('[data-butter-flash]'),
        };
      },
    };
  });
async function pickWashTargets() {
  return page.evaluate(([blocks, answer]) => window.__wk.pick(blocks, answer), [BLOCKS, ANSWER]);
}
const showTarget = (kind, y = 200) => page.evaluate(([k, y]) => window.__wk.show(k, y), [kind, y]);
const targetPoint = (kind) => page.evaluate((k) => window.__wk.point(k), kind);
const expectedBoxes = (kind) => page.evaluate((k) => window.__wk.expected(k), kind);
const washNow = () => page.evaluate((WASH) => window.__wk.now(WASH), WASH_HOST);
// Bookmarks target `kind` with the hover button: the paragraph or the table whole, or the
// selection made in it.
async function washBookmark(kind) {
  const before = await storedCount();
  await showTarget(kind);
  await page.waitForTimeout(1500);
  if (kind === 'selection') await page.evaluate(() => window.__wk.select());
  const at = await targetPoint(kind);
  requireThat(at, `${kind} target unmounted`);
  await page.mouse.move(10, 300);
  await page.mouse.move(at.x, at.y, { steps: 3 });
  await page.waitForTimeout(900);
  const button = page.locator('chatgpt-butter-bookmark button.show');
  requireThat(await button.count(), `no hover button on the ${kind}`);
  await button.click();
  await page.waitForTimeout(1200);
  await page.evaluate(() => getSelection().removeAllRanges());
  return (await storedCount()) === before + 1;
}
const within = (got, want, px = 1) =>
  got.length === want.length &&
  got.every((g, k) => ['left', 'right', 'top', 'bottom'].every((s) => Math.abs(g[s] - want[k][s]) <= px));
// Pixel statistics of two screenshots of one region, in a blank tab of the lab browser:
// `differ`, the share of pixels differing by more than 24 in a channel; `ink`, the darkest (light)
// or lightest (dark) pixel of each.
let pixels = null;
async function comparePixels(a, b, dark) {
  pixels ??= await context.newPage();
  return pixels.evaluate(
    async ([a, b, dark]) => {
      const load = (src) =>
        new Promise((ok) => {
          const i = new Image();
          i.onload = () => ok(i);
          i.src = src;
        });
      const [x, y] = await Promise.all([a, b].map(load));
      const data = (i) => {
        const c = new OffscreenCanvas(i.width, i.height),
          g = c.getContext('2d');
        g.drawImage(i, 0, 0);
        return g.getImageData(0, 0, i.width, i.height).data;
      };
      const p = data(x),
        q = data(y);
      let n = 0;
      const ink = (d) => {
        let best = null;
        for (let k = 0; k < d.length; k += 4) {
          const v = d[k] + d[k + 1] + d[k + 2];
          if (!best || (dark ? v > best.v : v < best.v)) best = { v, rgb: [d[k], d[k + 1], d[k + 2]] };
        }
        return best.rgb;
      };
      for (let k = 0; k < p.length; k += 4)
        if (Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24) n++;
      return { differ: n / (p.length / 4), ink: [ink(p), ink(q)] };
    },
    [
      `data:image/png;base64,${a.toString('base64')}`,
      `data:image/png;base64,${b.toString('base64')}`,
      dark,
    ],
  );
}
const clipOfBox = (q, pad = 0) => ({
  x: Math.max(0, Math.round(q.left) + pad),
  y: Math.max(0, Math.round(q.top) + pad),
  width: Math.max(1, Math.round(q.right - q.left) - 2 * pad),
  height: Math.max(1, Math.round(q.bottom - q.top) - 2 * pad),
});
// One jump: from about 2500 px below the target, through its question's card (its row `rank` in
// answer order), then the checks above. `edge`: 'header' scrolls the washed text under the header
// during the hold, 'composer' behind the composer, null just scrolls 80 px.
async function washJump(theme, kind, rank, edge) {
  phase = `wash-${theme}-${kind}`;
  await page.evaluate(() => {
    const s = window.__wk.sc();
    s.scrollTop = Math.min(s.scrollHeight - s.clientHeight, s.scrollTop + 2500);
  });
  await page.waitForTimeout(1500);
  await page.mouse.move(10, 300);
  await page.waitForTimeout(250);
  const tick = await page.evaluate(() => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
      mid = (el) => {
        const q = el.getBoundingClientRect();
        return { x: q.right - 4, y: q.top + q.height / 2 };
      },
      dots = [...root.querySelectorAll('.bdot:not(.gone)')].map(mid);
    const bar = [...root.querySelectorAll('.tick .bar')].find((b) =>
      dots.some((d) => Math.abs(d.y - mid(b).y) <= 1),
    );
    return bar ? mid(bar) : null;
  });
  requireThat(tick, 'no tick with a bookmark dot');
  await page.mouse.move(tick.x, tick.y, { steps: 4 });
  await page.waitForTimeout(500);
  const row = await page.evaluate((rank) => {
    const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
      e = root.querySelectorAll('.card.show .bmc .go')[rank],
      q = e?.getBoundingClientRect();
    return q && { x: q.left + Math.min(q.width / 2, 60), y: q.top + q.height / 2 };
  }, rank);
  requireThat(row, 'no card row');
  await page.mouse.move(row.x, row.y, { steps: 12 });
  await page.waitForTimeout(250);
  // Every frame from the click: whether the wash shows, and any bubble flash.
  await page.evaluate((WASH) => {
    const R = (window.__washRec = { frames: [], stop: false });
    const loop = (t) => {
      R.frames.push({
        t,
        host: !!document.querySelector(WASH),
        flash: !!document.querySelector('[data-butter-flash]'),
      });
      if (!R.stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }, WASH_HOST);
  await page.mouse.click(row.x, row.y);
  // Off the text, over the chat's empty right side (wheel turns scroll the chat from there).
  const side = await page.evaluate(() => {
    const r = window.__wk.sc().getBoundingClientRect();
    return { x: r.right - 140, y: r.top + r.height / 2 };
  });
  await page.mouse.move(side.x, side.y);
  await page
    .waitForFunction((WASH) => document.querySelector(WASH)?.shadowRoot.querySelector('i'), WASH_HOST, {
      timeout: 60000,
    })
    .catch(() => {});
  await page.waitForTimeout(450); // past the sweep (or a block's fade-in), into the hold
  const held = await washNow(),
    want = await expectedBoxes(kind);
  const dark = theme === 'dark',
    first = held.boxes[0];
  // The text under the wash now, and the same pixels once it has gone (below).
  const inkClip = first && clipOfBox(first, 3),
    inkTop = held.scrollTop,
    inkDuring = inkClip && (await page.screenshot({ clip: inkClip }));
  // Scroll during the hold.
  let dy = 80;
  if (edge === 'header' && first) dy = first.top - ((held.headerBottom ?? held.scrollerTop + 52) - 10);
  if (edge === 'composer' && held.boxes.length && held.composerTop)
    dy = held.boxes.at(-1).bottom - (held.composerTop + 10);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(350);
  const moved = await washNow(),
    wantMoved = await expectedBoxes(kind);
  // The header's or the composer's band over the washed text's columns, during and after.
  const span = held.boxes.length && {
    left: Math.min(...moved.boxes.map((b) => b.left)),
    right: Math.max(...moved.boxes.map((b) => b.right)),
  };
  const band =
    edge === 'header'
      ? span && { ...span, top: Math.max(0, (moved.headerBottom ?? 52) - 24), bottom: moved.headerBottom ?? 52 }
      : edge === 'composer'
        ? span && moved.composerTop && { ...span, top: moved.composerTop, bottom: moved.composerTop + 24 }
        : null;
  const bandDuring = band && (await page.screenshot({ clip: clipOfBox(band) }));
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH_HOST, { timeout: 6000 }).catch(() => {});
  const bandAfter = band && (await page.screenshot({ clip: clipOfBox(band) }));
  const frames = await page.evaluate(() => ((window.__washRec.stop = true), window.__washRec.frames));
  const gone = !(await washNow()).shown;
  // Back where the ink was read, for the same pixels without the wash.
  await page.evaluate((top) => (window.__wk.sc().scrollTop = top), inkTop);
  await page.waitForTimeout(500);
  const inkAfter = inkClip && (await page.screenshot({ clip: inkClip }));
  const ink = inkDuring && (await comparePixels(inkDuring, inkAfter, dark)),
    bandStat = band && (await comparePixels(bandDuring, bandAfter, dark));
  const name = kind === 'table' ? 'a table' : `a ${kind}`;
  const numbers = (q) => q.map((b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round));
  await check(`wash ${theme}: ${name} is washed on its own lines${kind === 'table' ? ' (one box 3 px around the table)' : ''}`,
    held.shown && within(held.boxes, want),
    { boxes: held.boxes.length, expected: want.length, maxOffPx: held.boxes.length === want.length ? Math.max(...held.boxes.flatMap((g, k) => ['left', 'right', 'top', 'bottom'].map((s) => Math.round(Math.abs(g[s] - want[k][s]) * 10) / 10))) : null });
  await check(`wash ${theme}: ${name}: Butter's layer, ${dark ? 'lightened' : 'multiplied'}, in the wash colour, no pointer events, no bubble flash`,
    held.blend === (dark ? 'lighten' : 'multiply') && held.pointer === 'none' &&
      held.color === (dark ? 'rgba(227, 199, 102, 0.3)' : 'rgba(251, 224, 122, 0.62)') && !frames.some((f) => f.flash),
    { blend: held.blend, pointer: held.pointer, flash: frames.some((f) => f.flash) });
  await check(`wash ${theme}: ${name}: the text keeps its colour under the wash`,
    !!ink && ink.ink[0].every((v, k) => Math.abs(v - ink.ink[1][k]) <= 16),
    { inkDuring: ink?.ink[0], inkAfter: ink?.ink[1] });
  await check(`wash ${theme}: ${name}: scrolled ${Math.round(dy)} px during the hold, the boxes follow the text`,
    moved.shown && Math.abs(moved.scrollTop - held.scrollTop) > 20 && within(moved.boxes, wantMoved),
    { scrolled: Math.round(moved.scrollTop - held.scrollTop), boxes: moved.boxes.length, expected: wantMoved.length });
  if (band)
    await check(`wash ${theme}: ${name}: with the washed text under ChatGPT's ${edge}, no butter shows on the ${edge}`,
      bandStat.differ < 0.002 && moved.boxes.some((b) => (edge === 'header' ? b.top < band.bottom : b.bottom > band.top)),
      { differ: bandStat.differ, clipTop: Math.round(moved.clip?.top ?? -1), clipBottom: Math.round(moved.clip?.bottom ?? -1),
        headerBottom: moved.headerBottom && Math.round(moved.headerBottom), composerTop: moved.composerTop && Math.round(moved.composerTop),
        scrollerTop: Math.round(moved.scrollerTop) });
  await check(`wash ${theme}: ${name}: gone after the hold and fade`, gone, {});
  summary.wash.push({ theme, kind, boxes: numbers(held.boxes).length, dy: Math.round(dy) });
}
async function washRun() {
  summary.wash = [];
  await worker.evaluate(() =>
    chrome.storage.local.set({
      butter: { enabled: true, lang: 'en', layoutConsent: 'declined', bookmarkNotice: 'acknowledged' },
    }),
  );
  phase = 'wash-open';
  await open();
  const theme0 = await page.evaluate(() => localStorage.getItem('theme'));
  try {
    for (const theme of ['light', 'dark']) {
      phase = `wash-theme-${theme}`;
      await page.evaluate((t) => localStorage.setItem('theme', t), theme);
      await open();
      await installKit();
      const dark = await page.evaluate(() => document.documentElement.classList.contains('dark'));
      await check(`wash ${theme}: ChatGPT shows its ${theme} theme`, dark === (theme === 'dark'));
      if (theme === 'light') {
        phase = 'wash-pick';
        summary.washTarget = await pickWashTargets();
        await check('wash: a mounted answer holds two long paragraphs and a table', !!summary.washTarget, summary.washTarget ?? {});
        requireThat(summary.washTarget, 'no wash target');
        await worker.evaluate((v) => (globalThis.washTarget = v), await page.evaluate(() => window.__wash));
        phase = 'wash-bookmark';
        for (const kind of ['paragraph', 'selection', 'table'])
          await check(`wash: the hover button bookmarks the ${kind}`, await washBookmark(kind), { stored: await storedCount() });
      } else
        await page.evaluate((v) => (window.__wash = v), await worker.evaluate(() => globalThis.washTarget));
      await page.locator('chatgpt-butter-nav .bdot').first().waitFor({ state: 'attached', timeout: 20000 });
      // The card lists them in answer order.
      const t = summary.washTarget,
        order = [
          ['paragraph', t.paragraph],
          ['selection', t.selectionParagraph],
          ['table', t.table],
        ].sort((a, b) => a[1] - b[1]).map(([k]) => k);
      await washJump(theme, 'paragraph', order.indexOf('paragraph'), 'header');
      await washJump(theme, 'selection', order.indexOf('selection'), 'composer');
      await washJump(theme, 'table', order.indexOf('table'), null);
    }
  } finally {
    phase = 'wash-theme-restore';
    await page.evaluate((v) => (v == null ? localStorage.removeItem('theme') : localStorage.setItem('theme', v)), theme0);
    summary.cleanup.themeRestored = (await page.evaluate(() => localStorage.getItem('theme'))) === theme0;
    await pixels?.close();
  }
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
    owner: WASH ? 'butter-74-bookmarks-live-wash' : 'butter-57-bookmarks-live-4',
    needsFixture: process.env.LAB_FIXTURE || 'math12',
    wait: 60,
    perf: !WASH,
  });
  console.log('PASS acquired fixture lab and perf lock');
  await stopBrowser();
  if (!WASH) originalCommands = {
    value: JSON.parse(await fs.readFile(path.join(lab.profile, 'Default/Preferences'), 'utf8'))
      .extensions?.commands,
  };
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
  requireThat(WASH || summary.shortcut === 'Alt+Shift+M', 'bookmark shortcut unavailable');
  page = context.pages()[0] || (await context.newPage());
  for (const other of context.pages()) if (other !== page) await other.close();
  cdp = await context.newCDPSession(page);
  if (WASH) await washRun();
  else {
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
            d.held &&
            d.bookmarkCoverageScripts === 1 &&
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
    // Each click path starts from a fresh content-script/rail instance with only the tail loaded.
    for (const route of ['row', 'segment']) {
      phase = `reload-unloaded-${route}`;
      await open();
      await restoreTargets();
      const cold = {
        ...(await railState()),
        stored: await storedCount(),
        targetMounted: !!(await targetBox(0)),
        earlierPagesBefore: earlierPages,
      };
      await check(
        `reload before ${route} click leaves earlier answer unloaded`,
        !cold.targetMounted && cold.more && cold.stored === 2,
        cold,
      );
      await checkEarlierSegment(route);
      await hoverEarlierCard(2, route);
      phase = `jump-unloaded-${route}`;
      await beginJumpProbe();
      await watchEarlierLoading();
      if (route === 'row') {
        // Choose the newer selection, not the oldest bookmark selected by a segment click.
        await page.locator('chatgpt-butter-nav .bmc .go').nth(1).click();
      } else {
        // Segments inherit pointer-events:none from .marks. The rail deliberately routes the
        // underlying tick/dots click by pointer geometry; a locator click waits for a hit target
        // the segment never owns. Send the real pointer click at its visible centre instead.
        const b = await page.locator('chatgpt-butter-nav .mark:not(.gone)').boundingBox();
        requireThat(b, 'earlier segment missing before click');
        await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
      }
      await waitLanding();
      await endJumpProbe(`unloaded-${route}`);
      const landed = await targetBox(route === 'row' ? 1 : 0);
      const loading = await page.evaluate(() => {
        __earlierLoading.observer.disconnect();
        const { sawLoadingMeta, sawSpinner, sawBusyDots } = __earlierLoading;
        return { sawLoadingMeta, sawSpinner, sawBusyDots };
      });
      const moved = await earlierSegmentState();
      await check(
        `${route} click loads earlier pages and lands on requested text`,
        !cold.targetMounted && earlierPages > cold.earlierPagesBefore && landed?.inView,
        {
          earlierPages: earlierPages - cold.earlierPagesBefore,
          targetMounted: !!landed,
          inView: !!landed?.inView,
          textTop: landed?.top ?? null,
          ...loading,
        },
      );
      await check(
        `segment moves from dots to loaded question after ${route} click`,
        moved.marks === 1 && moved.earlierMarks === 0 && moved.loadedMarks === 1,
        moved,
      );
      // Keep the remainder of the matrix meaningful if the product's automatic load fails.
      if (!landed) {
        await loadEarlier();
        await jump(0);
        await waitLanding();
      }
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
            ok(
              r.result.map(({ msg, para, excerpt, ask, line }) => ({
                msg,
                para,
                excerpt,
                ask,
                line,
              })),
            );
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
      const askHash = [
        ...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t.turn))),
      ]
        .map((n) => n.toString(16).padStart(2, '0'))
        .join('');
      const flat = (text) => text.replace(/\s+/g, ' ').trim();
      let matched = 0;
      for (const b of records) {
        const block = answer?.querySelectorAll(t.blocks)[b.para];
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
        matchingQuestions: records.filter((b) => b.ask === askHash).length,
        validFirstLines: records.filter(
          (b) => Number.isInteger(b.line) && b.line > 0 && b.line <= [...b.excerpt].length,
        ).length,
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
        resolution.matchingQuestions === 2 &&
        resolution.validFirstLines === 2 &&
        (await storedCount()) === 2 &&
        live.marks === 1 &&
        live.staleMarks === 0 &&
        live.cardRows === 2 &&
        live.staleRows === 0,
      { ...live, ...resolution },
    );
    phase = 'delete';
    // Delete one through its loaded card, then check the single-bookmark earlier card on reload.
    await page.locator('chatgpt-butter-nav .bmc .x').last().click();
    await page.waitForTimeout(700);
    await check('card delete removes selection bookmark', (await storedCount()) === 1, {
      remaining: await storedCount(),
    });
    await open();
    await restoreTargets();
    await checkEarlierSegment('single');
    await hoverEarlierCard(1, 'single');
    const remaining = await deleteMarks();
    await check('card delete removes both test bookmarks', remaining === 0, {
      remaining,
      marks: (await railState()).marks,
    });
    await listItemMatrix();
  }
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
      summary.finishedUtc = new Date().toISOString();
      await save();
    }
  }
}
if (summary.checks.some((x) => !x.pass)) process.exitCode = 1;
