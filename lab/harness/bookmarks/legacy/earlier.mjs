// Temporary legacy scenario, moved as it was from bookmarks-qa.mjs: it still changes the fixture
// scene (`page$`) itself. A later PR gives it a declared starting scene.
import path from 'node:path';

// 12. Earlier history (#51 addendum). After a reload a long chat lists only its latest questions; a
// bookmark whose question is earlier sits on the rail's earlier-history dots until its answer is
// loaded. The fixture opens with questions 8 to 12; each earlier page brings two more.
export async function earlierSection(qa) {
  const { open, sha, CONV, answer, PARAGRAPH, seedStore, page, TURNS, page$, settings, check, requests, stored, QUESTION, regen, question, shots, context } = qa;
  const ACCOUNT = sha('user-fixture'),
    CONV_HASH = sha(CONV);
  // A whole-paragraph bookmark on block `para` of question `turn`'s answer (blocks: p, h3, p, p, p, p, li, li).
  const eseed = (turn, para, time, msgId = answer(turn)) => {
    const text = PARAGRAPH(turn, para === 0 ? 0 : para - 1);
    return { account: ACCOUNT, conv: CONV_HASH, msg: sha(msgId), turn, para, start: 0, end: text.length, excerpt: text.slice(0, 120).trim(), time };
  };
  const reseed = (rows) => seedStore(rows, { clear: true });
  const FIRST = 7,
    LATEST = eseed(10, 0, 100);
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
  const openEarlier = async (theme, rows, marks) => {
    page$.first = FIRST;
    page$.pages = 0;
    await reseed(rows);
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
  const LIGHT_DOT = 'rgb(211, 158, 16)',
    HINT = 'Earlier questions are not loaded yet. Click to load them.';
  const tab = async (cls) => {
    await page.evaluate(() => document.activeElement?.blur());
    for (let k = 0; k < 10 && !(await state()).active?.cls.startsWith(cls); k++) await page.keyboard.press('Tab');
    return (await state()).active;
  };
  await settings({ bookmarkNotice: 'acknowledged' });
  page$.pageDelay = 300;
  const A = eseed(2, 2, 1);

  // (a) At rest: the earlier bookmark's dot beside the three dots, the loaded one beside its tick.
  let s = await openEarlier('light', [A, LATEST], 2);
  check('earlier: the chat opens with its latest 5 questions and the earlier-history dots', s.ticks.length === 5 && s.more, { ticks: s.ticks.length });
  const d = s.dotsDot;
  check("earlier: a 4 px dot on the three dots' row, its right edge 4 px left of the leftmost, solid #d39e10",
    !!d && d.w === 4 && d.h === 4 && Math.abs(d.y - s.dotsY) <= 0.5 && Math.abs(d.right - (s.dotsLeft - 4)) <= 0.5 &&
      d.color === LIGHT_DOT && d.ring === 'none' && !d.cls.includes('stale'), { d, dotsY: s.dotsY, dotsLeft: s.dotsLeft });
  check('earlier: the dot takes no pointer events, is not focusable and is hidden from the accessibility tree',
    d?.pe === 'none' && d.hidden === 'true' && d.tag === 'I' && d.tabIndex === -1, { d });
  check('earlier: the loaded question\'s bookmark is a dot beside its tick (question 11), and no other', !!under(s, 10) && s.dots.length === 1 && !under(s, 9) && !under(s, 8),
    { dots: s.dots.map((m) => m.y), ticks: s.ticks });
  check("earlier: the three dots keep their name and append the earlier label with the bookmark's text",
    s.moreLabel === `${HINT} · Bookmark · earlier question: ${A.excerpt}`, { label: s.moreLabel });
  // Scrolling the loaded part reads nothing and loads no page.
  const before = await requests();
  await page.mouse.move(700, 500);
  for (let k = 0; k < 3; k++) {
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
  check('earlier: scrolling reads no bookmarks and loads no page', JSON.stringify(await requests()) === JSON.stringify(before) && page$.pages === 0,
    { before, after: await requests(), pages: page$.pages });

  // (b) Hovering the three dots: the single card. Moving onto it keeps it; a click on its row loads
  // earlier pages until the answer mounts.
  s = await hoverDots();
  check('earlier: hovering the three dots shows "Bookmark · earlier question", a row starting with the dot, and the footer',
    s.card.shown && s.card.bm && !s.card.inert && s.card.pe === 'auto' && s.card.role === 'group' && s.card.label === 'Bookmark · earlier question' &&
      s.card.meta === 'Bookmark · earlier question' && s.card.text === null && s.card.flags === 0 && s.card.rows.length === 1 &&
      s.card.rows[0].text === A.excerpt && s.card.rows[0].dot && s.card.rows[0].lines <= 3 && s.card.rows[0].del === `Delete bookmark: ${A.excerpt}` &&
      s.card.warn === "This question isn't loaded yet. Clicking loads earlier messages first.", { card: s.card });
  await record();
  s = await hoverDots(0);
  check('earlier: moving onto the card keeps it open', s.card.shown && s.card.bm, { shown: s.card.shown });
  await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
  await page.waitForTimeout(150);
  s = await state();
  check('earlier: while loading, the card stays with "Loading earlier questions…", a spinner for its × and blinking dots',
    s.card.shown && s.card.meta === 'Loading earlier questions…' && s.card.rows[0]?.spin && !s.card.rows[0].del && s.busy, { card: s.card, busy: s.busy });
  let l = await landed(2, 2);
  s = await state();
  let rec = await recorded();
  check('earlier: the click loads earlier pages until the answer mounts and lands on the text', l.landed && page$.pages === 3, { ...l, pages: page$.pages });
  check("earlier: the bookmark moves to its real tick (question 3), its dot growing in; the dot beside the three dots fades out; the card goes on landing",
    !s.dotsDot && s.more && !!under(s, 2) && rec.grown >= 1 && rec.gone >= 1 && !s.card.shown && s.moreLabel === HINT, { rec, dots: s.dots.length, label: s.moreLabel });

  // (c) The list, a row's click, and what is left on the three dots afterwards.
  const LIST = [eseed(1, 0, 1), eseed(1, 2, 2), eseed(3, 0, 3), eseed(4, 2, 4)];
  s = await openEarlier('light', [...LIST, LATEST], 2);
  s = await hoverDots();
  check('earlier: several: "Earlier questions · 4 bookmarks", oldest first, each row starting with the dot, 280 px',
    s.card.shown && s.card.meta === 'Earlier questions · 4 bookmarks' && s.card.flags === 0 && s.card.rows.every((r) => r.dot && r.lines === 1) &&
      Math.abs(s.card.w - 280) < 0.5 && JSON.stringify(s.card.rows.map((r) => r.text)) === JSON.stringify(LIST.map((b) => b.excerpt)) &&
      s.moreLabel === `${HINT} · Earlier questions · 4 bookmarks: ${LIST.map((b) => b.excerpt).join('; ')}`, { card: s.card, label: s.moreLabel });
  await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
  await page.mouse.move(s.card.rows[3].x, s.card.rows[3].y, { steps: 4 });
  await page.mouse.click(s.card.rows[3].x - 40, s.card.rows[3].y);
  await page.waitForTimeout(150);
  s = await state();
  check('earlier: the clicked row\'s × turns into a spinner, the others keep theirs',
    s.card.shown && s.card.meta === 'Loading earlier questions…' && s.card.rows[3]?.wait && s.card.rows[3].spin && !s.card.rows[3].del &&
      s.card.rows.slice(0, 3).every((r) => r.del && !r.spin) && s.busy, { rows: s.card.rows });
  l = await landed(4, 2);
  await page.mouse.move(700, 300);
  await page.waitForTimeout(300);
  s = await state();
  check('earlier: a row\'s click lands on that bookmark after two pages', l.landed && page$.pages === 2, { ...l, pages: page$.pages });
  check('earlier: the loaded ones move to questions 4 and 5; question 2\'s two stay on the three dots',
    !!under(s, 3) && !!under(s, 4) && !!s.dotsDot && s.moreLabel.startsWith(`${HINT} · Earlier questions · 2 bookmarks: `), { label: s.moreLabel });
  // × deletes that bookmark; the card stays with the other.
  s = await hoverDots(0);
  const x0 = await page.evaluate(() => {
    const r = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.bmc .it .x').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  await page.mouse.move(x0.x, x0.y, { steps: 3 });
  await page.mouse.click(x0.x, x0.y);
  await page.waitForTimeout(400);
  s = await state();
  check('earlier: × deletes that bookmark; the card stays with the other, now the single card',
    !(await stored()).some((b) => b.turn === 1 && b.para === 0) && s.card.shown && s.card.meta === 'Bookmark · earlier question' && s.card.rows.length === 1 &&
      s.card.rows[0].text === LIST[1].excerpt && !!s.dotsDot, { card: s.card });

  // (d) Escape while loading puts the card away; the loading goes on and lands.
  await record();
  s = await hoverDots(0);
  await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
  await page.waitForTimeout(150);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const escaped = await state();
  l = await landed(1, 2);
  s = await state();
  rec = await recorded();
  // Question 2 lands at the chat's top, where the fixture loads the last page too.
  check('earlier: Escape closes the card but the loading goes on and lands', !escaped.card.shown && l.landed && page$.pages >= 3, { shown: escaped.card.shown, ...l, pages: page$.pages });
  check('earlier: none left on the three dots: the dot beside them goes', !s.dotsDot && !!under(s, 1), { rec });

  // (e) Keyboard alone: the three dots, their card's rows; Enter loads and lands.
  s = await openEarlier('light', [eseed(3, 2, 1), eseed(6, 0, 2), LATEST], 2);
  let f = await tab('more');
  await page.waitForTimeout(250);
  s = await state();
  check('earlier: focusing the three dots shows their card', f?.cls.startsWith('more') && s.card.shown && s.card.meta === 'Earlier questions · 2 bookmarks', { f, card: s.card.meta });
  await page.keyboard.press('ArrowDown');
  const next = (await state()).active;
  await page.keyboard.press('ArrowUp');
  s = await state();
  check('earlier: ArrowDown goes from the three dots straight to the first tick, ArrowUp back',
    next?.cls.startsWith('tick') && next.label.startsWith(QUESTION(FIRST)) && s.active?.cls.startsWith('more'), { next, active: s.active });
  await page.keyboard.press('ArrowLeft');
  const entered = (await state()).active;
  await page.keyboard.press('ArrowDown');
  s = await state();
  check('earlier: ArrowLeft enters the card on its first row, ArrowDown moves to the next row',
    entered?.cls === 'go' && entered.text === PARAGRAPH(3, 1).slice(0, 120).trim() && s.active?.cls === 'go' && s.active.text === PARAGRAPH(6, 0).slice(0, 120).trim(), { entered, active: s.active });
  await page.keyboard.press('ArrowRight');
  const back = (await state()).active;
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  l = await landed(6, 0);
  s = await state();
  check('earlier: ArrowRight returns to the three dots; Enter on a row loads and lands; focus moves to question 7\'s tick, beside its dot',
    back?.cls.startsWith('more') && l.landed && page$.pages === 1 && s.active?.cls.startsWith('tick') && !!under(s, 6) && under(s, 6).label === s.active.label &&
      s.moreLabel === `${HINT} · Bookmark · earlier question: ${PARAGRAPH(3, 1).slice(0, 120).trim()}`, { back, ...l, active: s.active, pages: page$.pages });

  // (f) Reduced motion, keyboard alone: the last bookmark on the three dots moves to its tick, which
  // shows its dot without growing in; the dot beside the three dots goes without fading. Escape
  // while its messages load puts the card away; the loading goes on.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await record();
  await tab('more');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
  const loading = await state();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const away = await state();
  l = await landed(3, 2);
  s = await state();
  rec = await recorded();
  const moved = await page.evaluate(() => [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot')].map((el) => el.getAnimations().length));
  check('earlier: keyboard alone, Escape while loading puts the card away and the loading goes on',
    loading.card.shown && loading.card.meta === 'Loading earlier questions…' && !away.card.shown && away.busy && l.landed, { loading: loading.card.meta, away: away.card.shown, ...l });
  check('earlier: under reduced motion the moved dot shows without growing and the dot beside the three dots goes without fading',
    s.more && !s.dotsDot && !!under(s, 3) && rec.gone === 0 && moved.every((n) => n === 0), { rec, moved, more: s.more });
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  // (f2) Clicking the three dots still loads earlier messages; without bookmarks in earlier history
  // they show their hint card.
  s = await openEarlier('light', [LATEST], 1);
  s = await hoverDots();
  check("earlier: no bookmarks in earlier history: no dot beside the three dots, which show today's hint card",
    !s.dotsDot && s.card.shown && !s.card.bm && s.card.inert && s.card.role === 'tooltip' && s.card.text === HINT && s.moreLabel === HINT, { card: s.card });
  s = await openEarlier('light', [A, LATEST], 2);
  s = await hoverDots();
  const ticks0 = s.ticks.length;
  await page.mouse.click(s.moreRect.x - 10, s.dotsY);
  for (let k = 0; k < 40 && (await state()).ticks.length === ticks0; k++) await page.waitForTimeout(250);
  s = await state();
  check('earlier: clicking the three dots loads earlier messages (also when they hold bookmarks)', page$.pages >= 1 && s.ticks.length > ticks0,
    { pages: page$.pages, ticks: [ticks0, s.ticks.length] });
  // That trip goes on loading: leave the page, so that no page of it counts in the next part.
  await page.goto('about:blank');

  // (g) A bookmark whose message is gone from the whole conversation: on the three dots while
  // history is unloaded, then today's stale bookmark once it is all loaded, landing at its question.
  s = await openEarlier('light', [eseed(2, 0, 1, regen(2))], 1);
  check('earlier: an unknown message waits on the three dots, live', !!s.dotsDot && !s.dotsDot.cls.includes('stale'));
  s = await hoverDots(0);
  await page.mouse.click(s.card.rows[0].x - 40, s.card.rows[0].y);
  let q = null;
  for (let k = 0; k < 120; k++) {
    await page.waitForTimeout(250);
    q = await page.evaluate((id) => {
      const el = document.querySelector(`[data-turn-key="${id}"]`);
      return el && el.getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top;
    }, question(2));
    if (page$.pages >= 4 && q != null && Math.abs(q - 64) <= 3) break;
  }
  await page.waitForTimeout(600);
  s = await state();
  check('earlier: once all is loaded and the message isn\'t there, it is stale under its question and the click opened that question',
    !s.more && page$.pages === 4 && under(s, 2)?.cls.includes('stale') && q != null && Math.abs(q - 64) <= 3, { q, pages: page$.pages, more: s.more });

  // (g2) Question 10's answer was regenerated (the new one is the conversation's current version)
  // while earlier history is unloaded. A bookmark stored with its question (`ask`) is stale under
  // that loaded question (#55); one stored without it keeps going on the three dots, as before.
  page$.regen.add(9);
  s = await openEarlier('light', [{ ...eseed(9, 0, 1), ask: sha(question(9)) }, eseed(9, 2, 2)], 2).catch(() => state());
  check('earlier: a regenerated answer\'s bookmark is stale under its loaded question; one stored without its question is on the three dots',
    !!under(s, 9)?.cls.includes('stale') && !!s.dotsDot && s.dots.length === 1, { dots: s.dots.map((m) => m.cls), beside: s.dotsDot?.cls });
  page$.regen.delete(9);

  // (h) Screenshots of each mockup state, light and dark, English and Chinese, desktop and narrow.
  // The rail shows when the chat is at least 560 px wide: 600 px is the narrowest it draws at.
  const strings = {
    en: { one: 'Bookmark · earlier question', foot: "This question isn't loaded yet. Clicking loads earlier messages first.", many: 'Earlier questions · 4 bookmarks', wait: 'Loading earlier questions…' },
    zh: { one: '书签 · 更早的问题', foot: '这个问题还没加载。点击会先加载更早的消息。', many: '更早的问题 · 4 个书签', wait: '正在加载更早的问题…' },
  };
  const shoot = async (name) => {
    const vw = page.viewportSize().width,
      s = await state(),
      w = Math.min(vw, 420),
      top = Math.max(0, Math.min(s.card.shown ? s.card.rect.top : Infinity, s.dotsY - 12, s.ticks[0] - 12) - 30),
      bottom = Math.max(s.card.shown ? s.card.rect.top + s.card.rect.h : 0, s.ticks.at(-1)) + 30;
    await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: vw - w, y: top, width: w, height: bottom - top } });
  };
  for (const [width, size] of [[1400, 'desktop'], [600, 'narrow']])
    for (const lang of ['en', 'zh'])
      for (const theme of ['light', 'dark']) {
        const tag = `${theme}-${lang}-${size}`,
          t = strings[lang];
        await page.setViewportSize({ width, height: 900 });
        await settings({ lang, bookmarkNotice: 'acknowledged' });
        page$.pageDelay = 300;
        await openEarlier(theme, [A, LATEST], 2);
        await shoot(`earlier-rest-${tag}`);
        s = await hoverDots();
        await shoot(`earlier-single-${tag}`);
        const single = s.card;
        page$.pageDelay = 2500;
        await openEarlier(theme, [...LIST, LATEST], 2);
        s = await hoverDots();
        await page.mouse.move(s.card.rows[0].x, s.card.rows[0].y, { steps: 10 });
        await page.mouse.move(s.card.rows[1].x, s.card.rows[1].y, { steps: 4 });
        await page.waitForTimeout(200);
        await shoot(`earlier-list-${tag}`);
        const list = (await state()).card;
        await page.mouse.click(s.card.rows[3].x - 40, s.card.rows[3].y);
        await page.waitForTimeout(400);
        await shoot(`earlier-loading-${tag}`);
        const loading = (await state()).card;
        l = await landed(4, 2);
        await page.mouse.move(Math.min(700, width / 2), 300);
        await page.waitForTimeout(300);
        await shoot(`earlier-landed-${tag}`);
        s = await state();
        check(`earlier (${tag}): every state draws, with its strings`,
          single.meta === t.one && single.warn === t.foot && list.meta === t.many && loading.meta === t.wait && loading.rows[3]?.spin &&
            l.landed && !!s.dotsDot && !!under(s, 4), { single: single.meta, list: list.meta, loading: loading.meta, landed: l.landed });
      }
  // Under 560 px of chat the rail doesn't draw at all (unchanged).
  await page.setViewportSize({ width: 390, height: 844 });
  await settings({ lang: 'en', bookmarkNotice: 'acknowledged' });
  page$.first = FIRST;
  await reseed([A, LATEST]);
  await page.goto(`https://chatgpt.com/c/${CONV}`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${shots}/earlier-rest-light-en-mobile390.png` });
  check('earlier: at 390 px the rail stays off, as before', !(await page.evaluate(() => document.querySelector('chatgpt-butter-nav')?.hasAttribute('data-on'))));
  await page.setViewportSize({ width: 1400, height: 900 });

  // The mockup's panels next to them, when given.
  if (process.env.BUTTER_BOOKMARKS_EARLIER_MOCKUP) {
    const mock = await context.newPage({ viewport: { width: 1400, height: 900 } });
    await mock.goto(`file://${path.resolve(process.env.BUTTER_BOOKMARKS_EARLIER_MOCKUP)}`);
    await mock.click('[data-mode="clean"]');
    const names = ['before', 'rest', 'single', 'list', 'loading', 'landed'];
    for (const lang of ['en', 'zh']) {
      await mock.click(`[data-lang="${lang}"]`);
      const figs = mock.locator('figure .page');
      for (let k = 0; k < (await figs.count()); k++)
        await figs.nth(k).screenshot({ path: `${shots}/mockup-earlier-${names[k % 6]}-${k < 6 ? 'light' : 'dark'}-${lang}.png` });
    }
    await mock.close();
  }
  page$.first = 0;
  page$.pageDelay = 0;
  await reseed([]);
}
