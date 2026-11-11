// The live chat page, read and driven as the single script did: the rail's state, the native
// scrollbar's thumb, waiting for a landing, opening the lab fixture, loading earlier history, the
// target paragraphs, jumping from a question's card, and bookmarking with the selection pill.
//
// The selection pill comes from the Butter driver (../driver/butter.mjs): its Bookmark cell, the
// pill's cells, a whole paragraph selected. Selecting part of a paragraph stays here: the text run
// and its offsets are found in the page, where the target's anchors stay.
//
// Targets: `window.__bookmarkLive` holds the answer's turn key and paragraph ordinals in the page,
// and the worker keeps a copy across reloads (`liveTarget`). Only ordinals and geometry come back
// to the summary; the turn key passes through Node only to address the paragraph for the driver.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { butterDriver } from '../driver/butter.mjs';

const harnessDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Match page/reader.js paragraphsOf: list items count individually, in document order.
export const BLOCKS = ':scope > :not(ul, ol), :scope > :is(ul, ol) > li';
export const ANSWER =
  ':is([data-markdown-text-style="assistant-message"]:not(:has([class*="DilResponseRoot"])), [data-markdown-text-style="assistant-message"] [class*="DilResponseRoot"])';
export const requireThat = (v, label) => {
  if (!v) throw new Error(label);
};

// `xkeys(chord)` presses `chord` as real X input on the lab's display (xtest-keys.py).
export function livePage({ L, lab, page, worker, store, record, fixture }) {
  const { summary } = record;
  const butter = butterDriver({ page });
  const xkeys = (chord) =>
    execFileSync('python3', [path.join(harnessDir, 'xtest-keys.py'), chord, '700', '20'], {
      env: { ...process.env, DISPLAY: lab.display },
    });
  const railState = () =>
    page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
      return {
        ticks: r?.querySelectorAll('.tick').length || 0,
        marks: r?.querySelectorAll('.bdot:not(.gone)').length || 0,
        more: r ? !r.querySelector('.more').hidden : false,
        stale: r?.querySelectorAll('.bdot.stale').length || 0,
        busy: r?.querySelectorAll('.busy').length || 0,
      };
    });
  const barGeometry = () =>
    page.evaluate(() => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0),
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
        y: r.top + (s.scrollTop / (s.scrollHeight - s.clientHeight)) * (s.clientHeight - thumb) + thumb / 2,
      };
    });
  async function waitLanding() {
    await page.waitForFunction(
      () => {
        const r = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
        return r && !r.querySelector('.busy') && getComputedStyle(r.querySelector('.warp')).visibility === 'hidden';
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
        return dump && !window.__seekDump.held && !dump.pending && root && !root.querySelector('.seek-card');
      },
      null,
      { timeout: 70000 },
    );
  }
  async function open() {
    await page.goto('about:blank');
    await page.goto(L.fixture(lab, fixture), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
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
      await page.waitForFunction(() => document.querySelector('chatgpt-butter-nav')?.shadowRoot.querySelector('.more').hidden, null, { timeout: 90000 });
      await waitLanding();
    }
    return { before, after: await railState() };
  }
  async function installTargets() {
    // Keep raw anchors in page/worker memory only; the summary carries just paragraph ordinals.
    const picked = await page.evaluate(
      ([blocks, answer]) => {
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
        const paras = [...a.querySelectorAll(blocks)].map((b, i) => ({ b, i })).filter(({ b }) => b.tagName === 'P' && b.textContent.trim().length > 60);
        if (paras.length < 2) return null;
        window.__bookmarkLive = { turn: t.dataset.turnKey, paras: paras.slice(0, 2).map(({ i }) => i), answer, blocks };
        return { turnOrdinalMounted: turns.indexOf(t), paragraphs: window.__bookmarkLive.paras };
      },
      [BLOCKS, ANSWER],
    );
    requireThat(picked, 'no suitable real answer paragraphs');
    // Capture IDs privately in the worker across reload; never serialize them in the summary.
    await keepTarget();
    return picked;
  }
  // The page's target, kept in the worker for after a reload.
  const keepTarget = async () =>
    worker.evaluate(
      (v) => {
        globalThis.liveTarget = v;
      },
      await page.evaluate(() => window.__bookmarkLive),
    );
  async function restoreTargets() {
    await page.evaluate(
      (v) => {
        window.__bookmarkLive = v;
      },
      await worker.evaluate(() => liveTarget),
    );
  }
  // Whether the page, and the worker for after a reload, hold a target.
  const hasTarget = async () => (await page.evaluate(() => !!window.__bookmarkLive)) && worker.evaluate(() => !!globalThis.liveTarget);
  async function targetBox(which, scroll = false) {
    return page.evaluate(
      ([which, scroll]) => {
        const t = window.__bookmarkLive,
          m = document.querySelector(`[data-turn-key="${t.turn}"]`),
          b = m?.querySelector(t.answer)?.querySelectorAll(t.blocks)[t.paras[which]];
        if (!b) return null;
        const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
        if (scroll) s.scrollTop += b.getBoundingClientRect().top - s.getBoundingClientRect().top - 160;
        const r = b.getBoundingClientRect();
        return {
          top: r.top - s.getBoundingClientRect().top,
          bottom: r.bottom - s.getBoundingClientRect().top,
          x: r.left + Math.min(150, r.width / 2),
          y: r.top + Math.min(12, r.height / 2),
          height: r.height,
          inView: r.top >= Math.max(0, s.getBoundingClientRect().top) + 52 && r.top < s.getBoundingClientRect().bottom,
        };
      },
      [which, scroll],
    );
  }
  // Target paragraph `which` as the driver's element: the `which`-th ordinal's block in the answer.
  const targetElement = async (which) => {
    const t = await page.evaluate(() => window.__bookmarkLive);
    return { within: `[data-turn-key="${t.turn}"] ${t.answer}`, css: t.blocks, index: t.paras[which] };
  };
  // Selects the target paragraph whole, then clicks the selection pill's Bookmark cell beside
  // ChatGPT's "Ask ChatGPT" (#77; the hover button in the margin is gone).
  async function bookmarkParagraph(cellCheck = 'the Bookmark cell is named Bookmark selection') {
    await targetBox(0, true);
    await page.waitForTimeout(1800);
    const b = await targetBox(0);
    requireThat(b, 'target virtualized before selecting');
    await page.mouse.move(10, 300);
    await butter.selectContents(await targetElement(0));
    const cell = butter.cell('bookmark');
    await cell.waitFor({ timeout: 3000 }).catch(() => {});
    const shown = (await butter.pill()).cells.find((c) => c.id === 'bookmark');
    summary.paragraphAttempt = { inView: b.inView, bookmarkCellShown: shown ? 1 : 0 };
    if (shown) {
      await record.check(cellCheck, shown.name === 'Bookmark selection', {});
      await cell.click();
    }
    await page.waitForTimeout(800);
    // Button text is public Butter UI, never report surrounding page content.
    const gotIt = page.getByRole('button', { name: 'Got it', exact: true });
    if (await gotIt.count()) await gotIt.click();
  }
  // Selects characters 5–35 of the second target's first long text run, then presses the real
  // Alt+Shift+M. Returns the selection's length.
  async function bookmarkSelection() {
    await targetBox(1, true);
    await page.waitForTimeout(1800);
    const selected = await page.evaluate(() => {
      const t = window.__bookmarkLive,
        b = document.querySelector(`[data-turn-key="${t.turn}"]`).querySelector(t.answer).querySelectorAll(t.blocks)[t.paras[1]];
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
    xkeys('Alt+Shift+M');
    await page.waitForTimeout(1000);
    await butter.clearSelection();
    return selected;
  }
  // Bookmark dots are decorative (#71); the tick / earlier-dots button owns focus.
  async function markedControl() {
    const dot = page.locator('chatgpt-butter-nav .bdot:not(.gone)').first();
    await dot.waitFor({ state: 'attached', timeout: 10000 });
    const index = Number(await dot.getAttribute('data-q'));
    return index < 0 ? page.locator('chatgpt-butter-nav .more') : page.locator('chatgpt-butter-nav .tick').nth(index);
  }
  async function jump(which = 0, held = false) {
    const mark = await markedControl();
    if (held) {
      // One pointer cannot both hold a native thumb and click a card: activate with the keyboard.
      await mark.evaluate((el) => el.focus());
      await page.keyboard.press('ArrowLeft');
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
  async function deleteMarks() {
    // Exercise the card's real delete controls. Fallback cleanup only touches this fresh install.
    for (let i = 0; i < 4 && (await store.count()); i++) {
      if (!(await page.locator('chatgpt-butter-nav .bdot:not(.gone)').count())) break;
      const mark = await markedControl();
      await mark.focus();
      await page.keyboard.press('ArrowLeft');
      await page.waitForTimeout(300);
      const x = page.locator('chatgpt-butter-nav .x').first();
      if (!(await x.count())) break;
      await x.click();
      await page.waitForTimeout(700);
    }
    return store.count();
  }
  return {
    butter,
    xkeys,
    storedCount: store.count,
    railState,
    barGeometry,
    waitLanding,
    waitSeekSettled,
    open,
    loadEarlier,
    installTargets,
    keepTarget,
    restoreTargets,
    hasTarget,
    targetBox,
    bookmarkParagraph,
    bookmarkSelection,
    markedControl,
    jump,
    deleteMarks,
  };
}
