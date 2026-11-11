// The earlier-history driver (#51 addendum, #72): reading the rail's three dots, the dot beside them
// and their card, and acting as a reader does on them. The earlier scenarios declare `scene` (the
// chat opens with questions 8 to 12; each earlier page, served 300 ms after it is asked for, brings
// two more), and store rows made with `seed`.
import { answer, row, TURNS } from './fixture.mjs';

export const FIRST = 7;
export const scene = { first: FIRST, pageDelay: 300 };
export const HINT = 'Earlier questions are not loaded yet. Click to load them.';
// A whole-paragraph bookmark on block `para` of question `turn`'s answer, stored under message `msgId`.
export const seed = (turn, para, time, msgId = answer(turn)) => row(turn, para, { time, msg: msgId });
// Question 11's bookmark, among the loaded questions; question 3's, in earlier history; four in
// earlier history under questions 2, 4 and 5.
export const LATEST = seed(10, 0, 100),
  A = seed(2, 2, 1),
  LIST = [seed(1, 0, 1), seed(1, 2, 2), seed(3, 0, 3), seed(4, 2, 4)];

export function earlier({ page, open, serve, seedStore }) {
  // The rail: the three dots (their row, the leftmost one's left edge, their name), the dot beside
  // them (#72), the questions' dots with their ticks' names, and the card.
  const state = () =>
    page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        more = root.querySelector('.more'),
        mr = more.getBoundingClientRect(),
        dotsY = mr.top + mr.height / 2,
        dotsLeft = more.querySelector('i').getBoundingClientRect().left;
      const rect = (el) => {
        const q = el.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height, top: q.top, right: q.right };
      };
      const bars = [...root.querySelectorAll('.tick .bar')],
        all = [...root.querySelectorAll('.bdot:not(.gone)')],
        beside = more.hidden ? null : all.find((el) => Math.abs(rect(el).y - dotsY) <= 0.6);
      // The questions' bookmark dots (#71), each with its tick's name.
      const dots = all
        .filter((el) => el !== beside)
        .map((el) => {
          const r = rect(el),
            bar = bars.find((b) => Math.abs(rect(b).y - r.y) <= 0.6);
          return { ...r, cls: el.className, label: bar?.parentElement.getAttribute('aria-label') ?? null };
        });
      const card = root.querySelector('.card'),
        bmc = root.querySelector('.bmc'),
        a = root.activeElement,
        cs = getComputedStyle(card);
      return {
        more: !more.hidden,
        moreRect: rect(more),
        moreLabel: more.getAttribute('aria-label'),
        dotsY,
        dotsLeft,
        busy: more.classList.contains('busy'),
        dotsDot: beside && {
          ...rect(beside),
          cls: beside.className,
          color: getComputedStyle(beside).backgroundColor,
          ring: getComputedStyle(beside).boxShadow,
          pe: getComputedStyle(beside).pointerEvents,
          hidden: beside.getAttribute('aria-hidden'),
          tag: beside.tagName,
          tabIndex: beside.tabIndex,
        },
        dots,
        ticks: bars.map((b) => rect(b).y),
        card: {
          shown: card.classList.contains('show') && +cs.opacity > 0.5,
          bm: card.classList.contains('qb'),
          inert: card.inert,
          pe: cs.pointerEvents,
          role: card.getAttribute('role'),
          label: card.getAttribute('aria-label'),
          meta: root.querySelector('.card > .meta').textContent,
          text: getComputedStyle(root.querySelector('.card > .text')).display === 'none' ? null : root.querySelector('.card > .text').textContent,
          w: card.getBoundingClientRect().width,
          warn: bmc.querySelector('.warn')?.textContent ?? null,
          why: bmc.querySelectorAll('.why').length,
          flags: bmc.querySelectorAll('svg.flag').length,
          rows: !card.classList.contains('qb') ? [] : [...bmc.querySelectorAll('.it')].map((it) => ({
            text: it.querySelector('.tx').textContent,
            dot: !!it.querySelector('.go > .dot:first-child'),
            lines: Math.round(it.querySelector('.tx').getBoundingClientRect().height / parseFloat(getComputedStyle(it.querySelector('.tx')).lineHeight)),
            wait: it.classList.contains('wait'),
            spin: !!it.querySelector('.wspin'),
            del: it.querySelector('.x')?.getAttribute('aria-label') ?? null,
            ...rect(it),
          })),
          rect: rect(card),
        },
        active: a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null,
      };
    });
  // The dot beside question `turn`'s tick (0 = the chat's first question), among those loaded.
  // A landing near the top loads one more page, as ChatGPT does: count from the loaded ticks.
  const under = (s, turn) => {
    const i = turn - (TURNS - s.ticks.length);
    return i >= 0 && s.dots.find((m) => Math.abs(m.y - s.ticks[i]) <= 0.6);
  };
  // Records marks growing in and fading out, in the rail's own layer.
  const record = () =>
    page.evaluate(() => {
      const box = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.marks');
      globalThis.fxMarks = { gone: 0, grown: 0 };
      new MutationObserver((ms) => {
        for (const m of ms) {
          if (m.type === 'attributes' && m.target.classList.contains('gone')) fxMarks.gone++;
          for (const n of m.addedNodes) if (n.classList?.contains('new')) fxMarks.grown++;
        }
      }).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    });
  const recorded = () => page.evaluate(() => globalThis.fxMarks);
  const fromTop = (turn, k) =>
    page.evaluate(
      ([id, k]) => {
        const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`)?.children[k];
        return el ? el.getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top : null;
      },
      [answer(turn), k],
    );
  // Waits until the bookmarked paragraph has sat 64 px below the scroller's top for a moment.
  const landed = async (turn, k, ms = 30000) => {
    const end = Date.now() + ms;
    let ok = 0,
      y = null;
    while (Date.now() < end && ok < 4) {
      y = await fromTop(turn, k);
      ok = y != null && Math.abs(y - 64) <= 3 ? ok + 1 : 0;
      await page.waitForTimeout(250);
    }
    return { landed: ok >= 4, y };
  };
  const openEarlier = async (theme, marks, rows = null) => {
    serve({ pages: 0 });
    if (rows) await seedStore(rows, { clear: true });
    await open(theme);
    await page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === n, marks, { timeout: 5000 });
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    return state();
  };
  // The pointer onto the three dots, then (`row`) across onto that row of their card.
  const hoverDots = async (row = null) => {
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    let s = await state();
    if (!s.more) return s;
    await page.mouse.move(s.moreRect.x - 10, s.dotsY, { steps: 4 });
    await page.waitForTimeout(350);
    s = await state();
    if (row === null || !s.card.rows[row]) return s;
    await page.mouse.move(s.card.rows[row].x - 40, s.card.rows[row].y, { steps: 10 });
    await page.waitForTimeout(250);
    return state();
  };
  const tab = async (cls) => {
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 10 && !(await state()).active?.cls.startsWith(cls); k++) await page.keyboard.press('Tab');
    return (await state()).active;
  };
  return { state, under, record, recorded, fromTop, landed, openEarlier, hoverDots, tab };
}
