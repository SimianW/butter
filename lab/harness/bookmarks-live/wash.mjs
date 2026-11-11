// The wash suite (MODE=wash; #69 "The landing wash", #74), in run order. On the real fixture chat,
// in light and in dark theme: a paragraph, a selection inside another paragraph, and a table are
// bookmarked with the Bookmark cell, then each is jumped to from its question's card, starting
// about 2500 px away. The fixtures hold no code block (none of their answers has one, checked on
// 2026-11-10), so the table stands for the blocks the wash covers whole; the fixture harness covers
// code blocks. Checked on ChatGPT's own markup: the boxes sit on the bookmarked text's lines (the
// table's one box 3 px around it), the text keeps its colour under them, there is no bubble flash,
// and when the chat scrolls during the hold the boxes follow their text while ChatGPT's header and
// composer show no butter over it. Only numbers and booleans leave the page; the targets stay in
// page and worker memory. The dark pass switches ChatGPT's <html data-theme> on the page; the
// harness reloads the chat at the end, which puts ChatGPT's own theme back.
import { all, loaded, stored } from './needs.mjs';
import { ANSWER, BLOCKS, requireThat } from './page.mjs';
import { WASH_HOST, clipOfBox, comparePixels, installKit, within } from './wash-kit.mjs';

const pickWashTargets = (page) => page.evaluate(([blocks, answer]) => window.__wk.pick(blocks, answer), [BLOCKS, ANSWER]);
const showTarget = (page, kind, y = 200) => page.evaluate(([k, y]) => window.__wk.show(k, y), [kind, y]);
const targetPoint = (page, kind) => page.evaluate((k) => window.__wk.point(k), kind);
const expectedBoxes = (page, kind) => page.evaluate((k) => window.__wk.expected(k), kind);
const washNow = (page) => page.evaluate((WASH) => window.__wk.now(WASH), WASH_HOST);
// Target `kind` ('paragraph' or 'table') as the Butter driver's element.
const washElement = async (page, kind) => {
  const W = await page.evaluate(() => window.__wash);
  return { within: `[data-turn-key="${W.turn}"] ${W.answer}`, css: W.blocks, index: kind === 'paragraph' ? W.para : W.table };
};
// Bookmarks target `kind` with the selection pill's Bookmark cell (#77): the paragraph or the
// table selected whole, or the selection made in it.
async function washBookmark(t, kind) {
  const { page, butter } = t;
  const before = await t.storedCount();
  await showTarget(page, kind);
  await page.waitForTimeout(1500);
  const at = await targetPoint(page, kind);
  requireThat(at, `${kind} target unmounted`);
  await page.mouse.move(10, 300);
  if (kind === 'selection') await page.evaluate(() => window.__wk.select());
  else await butter.selectContents(await washElement(page, kind));
  const button = butter.cell('bookmark');
  await button.waitFor({ timeout: 3000 }).catch(() => {});
  requireThat((await butter.pill()).cells.some((c) => c.id === 'bookmark'), `no Bookmark cell for the ${kind}`);
  await button.click();
  await page.waitForTimeout(1200);
  await butter.clearSelection();
  return (await t.storedCount()) === before + 1;
}
// One jump: from about 2500 px below the target, through its question's card (its row `rank` in
// answer order), then the checks above. `edge`: 'header' scrolls the washed text under the header
// during the hold, 'composer' behind the composer, null just scrolls 80 px.
async function washJump(t, theme, kind, rank, edge) {
  const { page } = t;
  t.rec.phase = `wash-${theme}-${kind}`;
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
  const held = await washNow(page),
    want = await expectedBoxes(page, kind);
  const dark = theme === 'dark',
    first = held.boxes[0];
  // The text under the wash now, and the same pixels once it has gone (below).
  const inkClip = first && clipOfBox(first, held.view, 3),
    inkTop = held.scrollTop,
    inkDuring = inkClip && (await page.screenshot({ clip: inkClip }));
  // Scroll during the hold.
  let dy = 80;
  // The top edge the wash may paint to: the header's bottom, or the scroller's top below it.
  const edgeTop = (w) => Math.max(0, w.headerBottom ?? w.scrollerTop);
  if (edge === 'header' && first) dy = first.top - (edgeTop(held) - 10);
  if (edge === 'composer' && held.boxes.length && held.composerTop)
    dy = held.boxes.at(-1).bottom - (held.composerTop + 10);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(350);
  const moved = await washNow(page),
    wantMoved = await expectedBoxes(page, kind);
  // The header's or the composer's band over the washed text's columns, during and after.
  const span = held.boxes.length && {
    left: Math.min(...moved.boxes.map((b) => b.left)),
    right: Math.max(...moved.boxes.map((b) => b.right)),
  };
  const band =
    edge === 'header'
      ? span && { ...span, top: Math.max(0, edgeTop(moved) - 24), bottom: edgeTop(moved) }
      : edge === 'composer'
        ? span && moved.composerTop && { ...span, top: moved.composerTop, bottom: moved.composerTop + 24 }
        : null;
  const bandClip = band && clipOfBox(band, moved.view),
    bandDuring = bandClip && (await page.screenshot({ clip: bandClip }));
  await page.waitForFunction((WASH) => !document.querySelector(WASH), WASH_HOST, { timeout: 6000 }).catch(() => {});
  const bandAfter = bandClip && (await page.screenshot({ clip: bandClip }));
  const frames = await page.evaluate(() => ((window.__washRec.stop = true), window.__washRec.frames));
  const gone = !(await washNow(page)).shown;
  // Back where the ink was read, for the same pixels without the wash.
  await page.evaluate((top) => (window.__wk.sc().scrollTop = top), inkTop);
  await page.waitForTimeout(500);
  const inkAfter = inkClip && (await page.screenshot({ clip: inkClip }));
  const ink = inkDuring && comparePixels(inkDuring, inkAfter, dark),
    bandStat = bandClip && comparePixels(bandDuring, bandAfter, dark);
  const name = kind === 'table' ? 'a table' : `a ${kind}`;
  const numbers = (q) => q.map((b) => [b.left, b.top, b.right - b.left, b.bottom - b.top].map(Math.round));
  await t.check(`wash ${theme}: ${name} is washed on its own lines${kind === 'table' ? ' (one box 3 px around the table)' : ''}`,
    held.shown && within(held.boxes, want),
    { boxes: held.boxes.length, expected: want.length, maxOffPx: held.boxes.length === want.length ? Math.max(...held.boxes.flatMap((g, k) => ['left', 'right', 'top', 'bottom'].map((s) => Math.round(Math.abs(g[s] - want[k][s]) * 10) / 10))) : null });
  await t.check(`wash ${theme}: ${name}: Butter's layer, ${dark ? 'lightened' : 'multiplied'}, in the wash colour, no pointer events, no bubble flash`,
    held.blend === (dark ? 'lighten' : 'multiply') && held.pointer === 'none' &&
      held.color === (dark ? 'rgba(227, 199, 102, 0.3)' : 'rgba(251, 224, 122, 0.62)') && !frames.some((f) => f.flash),
    { blend: held.blend, pointer: held.pointer, flash: frames.some((f) => f.flash) });
  await t.check(`wash ${theme}: ${name}: the text keeps its colour under the wash`,
    !!ink && ink.ink[0].every((v, k) => Math.abs(v - ink.ink[1][k]) <= 16),
    { inkDuring: ink?.ink[0], inkAfter: ink?.ink[1] });
  await t.check(`wash ${theme}: ${name}: scrolled ${Math.round(dy)} px during the hold, the boxes follow the text`,
    moved.shown && Math.abs(moved.scrollTop - held.scrollTop) > 20 && within(moved.boxes, wantMoved),
    { scrolled: Math.round(moved.scrollTop - held.scrollTop), boxes: moved.boxes.length, expected: wantMoved.length });
  if (edge) {
    // The wash reaches the edge (no unwashed strip of visible text) and paints nothing past it.
    const reach =
      !!moved.clip &&
      (edge === 'header'
        ? Math.abs(moved.clip.top - edgeTop(moved)) <= 1
        : Math.abs(moved.clip.bottom - moved.composerTop) <= 1);
    const under = moved.boxes.some((b) => (edge === 'header' ? b.top < edgeTop(moved) : b.bottom > moved.composerTop));
    await t.check(`wash ${theme}: ${name}: with the washed text under ChatGPT's ${edge}, the wash reaches the ${edge} and no butter shows on it`,
      !!bandStat && bandStat.differ < 0.002 && reach && under,
      { differ: bandStat?.differ ?? null, reach, under, clipTop: Math.round(moved.clip?.top ?? -1), clipBottom: Math.round(moved.clip?.bottom ?? -1),
        headerBottom: moved.headerBottom && Math.round(moved.headerBottom), composerTop: moved.composerTop && Math.round(moved.composerTop),
        scrollerTop: Math.round(moved.scrollerTop) });
  }
  await t.check(`wash ${theme}: ${name}: gone after the hold and fade`, gone, {});
  t.rec.summary.wash.push({ theme, kind, boxes: numbers(held.boxes).length, dy: Math.round(dy) });
}
// Clicks the earlier-history dots until the whole chat is loaded (a click may load one page).
async function loadAll(t) {
  const { page } = t;
  for (let k = 0; k < 40; k++) {
    const s = await t.railState();
    if (!s.more) return true;
    await page.evaluate(() =>
      document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more:not([hidden])')?.click(),
    );
    await page
      .waitForFunction(
        (n) => {
          const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
          return r.querySelector('.more').hidden || r.querySelectorAll('.tick').length > n;
        },
        s.ticks,
        { timeout: 60000 },
      )
      .catch(() => {});
    await page.waitForTimeout(2000);
  }
  return !(await t.railState()).more;
}

// Preconditions: the page in `theme`, the kit installed, and a picked target (page and summary).
const themed = (theme) => async (t) =>
  (await t.page.evaluate(() => document.documentElement.getAttribute('data-theme'))) === theme ? null : `ChatGPT is not in ${theme} theme`;
const kit = async (t) => ((await t.page.evaluate(() => !!window.__wk)) ? null : 'the wash kit is not installed (the chat was not loaded whole)');
const picked = async (t) => (t.rec.summary.washTarget && (await t.page.evaluate(() => !!window.__wash)) ? null : 'no wash target picked');

// The theme switched on the page, checked, and the whole chat loaded.
const themePass = (theme) => ({
  name: `wash-theme-${theme}`,
  description: `loads the chat${theme === 'dark' ? ' again' : ''} in ${theme} theme${theme === 'dark' ? " (ChatGPT's <html data-theme> switched on the page)" : ''} and all of it through the earlier-history dots`,
  async run(t) {
    const { page, check, worker } = t;
    if (theme === 'light') {
      t.rec.phase = 'wash-open';
      await t.open();
      t.rec.phase = 'wash-theme-light';
    }
    await t.open();
    // ChatGPT draws its theme from <html data-theme>, set from the account's appearance
    // setting (on its server; checked on 2026-11-10). The lab accounts are in light theme: the
    // dark pass switches the attribute on the page, and ChatGPT's own dark styles follow.
    const look = await page.evaluate((theme) => {
      const html = document.documentElement;
      if (html.getAttribute('data-theme') !== theme) {
        html.setAttribute('data-theme', theme);
        if (html.hasAttribute('data-appearance-mode')) html.setAttribute('data-appearance-mode', theme);
      }
      const [r, g, b] = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number);
      return { background: [r, g, b], colorScheme: getComputedStyle(html).colorScheme, darkClass: html.classList.contains('dark') };
    }, theme);
    await page.waitForTimeout(500);
    const dark = look.background.reduce((t, v) => t + v, 0) < 3 * 96;
    await check(`wash ${theme}: ChatGPT shows its ${theme} theme`, dark === (theme === 'dark'), look);
    // The whole chat loaded, so that every question has its tick.
    await check(`wash ${theme}: the whole chat loads through the earlier-history dots`, await loadAll(t), {
      ticks: (await t.railState()).ticks,
    });
    await installKit(page);
    if (theme === 'dark') await page.evaluate((v) => (window.__wash = v), await worker.evaluate(() => globalThis.washTarget));
  },
});

export const washPick = {
  name: 'wash-pick',
  description: 'scrolls down the chat until a mounted answer has two long paragraphs and a table: the targets',
  precondition: all(loaded, kit),
  async run(t) {
    const { page, check, worker } = t,
      s = t.rec.summary;
    // Down the chat a screen at a time until a mounted answer has the targets.
    await page.evaluate(() => (window.__wk.sc().scrollTop = 0));
    await page.waitForTimeout(1500);
    for (let k = 0; k < 150 && !(s.washTarget = await pickWashTargets(page)); k++) {
      const end = await page.evaluate(() => {
        const s = window.__wk.sc(),
          was = s.scrollTop;
        s.scrollTop += s.clientHeight * 0.8;
        return s.scrollTop === was;
      });
      if (end) break;
      await page.waitForTimeout(900);
    }
    await check('wash: a mounted answer holds two long paragraphs and a table', !!s.washTarget, s.washTarget ?? {});
    requireThat(s.washTarget, 'no wash target');
    await worker.evaluate((v) => (globalThis.washTarget = v), await page.evaluate(() => window.__wash));
  },
};

export const washBookmarks = {
  name: 'wash-bookmark',
  description: 'bookmarks the paragraph and the table (selected whole) and the selection with the Bookmark cell',
  precondition: all(loaded, kit, picked, stored(0)),
  async run(t) {
    for (const kind of ['paragraph', 'selection', 'table'])
      await t.check(`wash: the Bookmark cell bookmarks the ${kind}`, await washBookmark(t, kind), { stored: await t.storedCount() });
  },
};

// One target's jump in one theme: the paragraph scrolled under the header during the hold, the
// selection behind the composer, the table 80 px.
const EDGE = { paragraph: 'header', selection: 'composer', table: null };
const jump = (theme, kind) => ({
  name: `wash-${theme}-${kind}`,
  description: `${theme}: jumps to the ${kind} from its question's card; the wash on its lines, its look, the text's colour, scrolled during the hold${EDGE[kind] ? ` (under the ${EDGE[kind]})` : ''}, gone after`,
  precondition: all(loaded, themed(theme), kit, picked, stored(3)),
  async run(t) {
    await t.page.locator('chatgpt-butter-nav .bdot').first().waitFor({ state: 'attached', timeout: 20000 });
    // The card lists them in answer order.
    const w = t.rec.summary.washTarget,
      order = [
        ['paragraph', w.paragraph],
        ['selection', w.selectionParagraph],
        ['table', w.table],
      ]
        .sort((a, b) => a[1] - b[1])
        .map(([k]) => k);
    await washJump(t, theme, kind, order.indexOf(kind), EDGE[kind]);
  },
});

export const wash = [
  themePass('light'),
  washPick,
  washBookmarks,
  ...['paragraph', 'selection', 'table'].map((kind) => jump('light', kind)),
  themePass('dark'),
  ...['paragraph', 'selection', 'table'].map((kind) => jump('dark', kind)),
];
