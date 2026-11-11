// Stale bookmarks (#55): regenerating a bookmarked answer in the fixture (in the page, then as the
// conversation's current version after a reload) and editing a bookmarked paragraph: the grey row
// with "answer changed", the hollow dot only when every bookmark under the question is stale, the
// stale single card with its footer, the jump landing at the question's start, a bookmark turning
// live again when the original version is switched back, Chinese, and light and dark screenshots
// of the stale cards (`card-stale-*`, `card-list-stale-*`; with BUTTER_BOOKMARKS_MOCKUP=<#51's
// 1-Mockup.html> also the mockup's `mockup-card-stale-*` and `mockup-card-list-*` next to them).
import { answer, EDITED, regen, REGENERATED, row } from '../fixture.mjs';
import { openMockup } from '../mockup.mjs';

// A whole-paragraph bookmark on block `para` of question `turn`'s answer.
const seed = (turn, para, time) => row(turn, para, { time });
// Question 10 holds one bookmark, question 7 three (blocks 0, 2 and 4).
const TURN = 6,
  LONE = 9;

export default {
  name: 'stale',
  description: 'Stale bookmarks (#55): regenerated and edited answers, hollow dots, grey rows, jumps, switching back, reload, Chinese',
  store: [seed(LONE, 0), seed(TURN, 0, 1), seed(TURN, 2, 2), seed(TURN, 4, 3)],
  async run(qa) {
    const { page, context, shots, check, open, settings, serve, answerAttrs, stored, rail, dotBeside, dotCount, staleCard, hoverTick, ontoRow, toTop, questionTop, block, shootCard: shoot } = qa;
    const staleState = staleCard;
    let c;

    // Questions 10's and 7's dots: hollow or solid, and their ticks' names.
    const LIGHT_DOT = 'rgb(211, 158, 16)';
    const dotsNow = async () => {
      const r = await rail(),
        at = (turn) => {
          const d = dotBeside(r, turn);
          return d ? { stale: d.cls.includes('stale'), bg: d.color, ring: d.ring, opacity: d.opacity, label: r.ticks[turn].label, x: d.x, y: d.y } : null;
        };
      return { lone: at(LONE), turn: at(TURN), count: r.dots.length };
    };
    const hollow = (d, color = LIGHT_DOT) => d?.stale && d.bg === 'rgba(0, 0, 0, 0)' && d.ring === `${color} 0px 0px 0px 1px inset` && d.opacity === 1;
    const solid = (d, color = LIGHT_DOT) => d && !d.stale && d.bg === color && d.opacity === 1;
    // A control in the fixture page that stands in for ChatGPT's regenerate, edit and version arrows:
    // a real click, as the user's click on ChatGPT's own button would be.
    const act = async (fn, turn) => {
      await page.evaluate(
        ([fn, turn, id, regenId, regenAttrs, regenHtml, editHtml]) => {
          let b = document.getElementById('fx');
          if (!b) {
            b = document.createElement('button');
            b.id = 'fx';
            b.textContent = 'fixture';
            b.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:10';
            document.body.append(b);
          }
          b.onclick = () => {
            globalThis.fxKept ??= {};
            const m = document.querySelector(`[data-fx-answer="${id}"]`);
            if (fn === 'regen') {
              // A new answer replaces the bookmarked one in its turn; the old one is kept for the arrows.
              const n = document.createElement('div');
              n.innerHTML = `<div ${regenAttrs}><div data-markdown-text-style="assistant-message" class="markdown prose">${regenHtml}</div></div>`;
              globalThis.fxKept[turn] = m;
              m.replaceWith(n.firstChild);
            } else if (fn === 'back') document.querySelector(`[data-fx-answer="${regenId}"]`).replaceWith(globalThis.fxKept[turn]);
            else if (fn === 'edit') m.querySelector('[data-markdown-text-style]').children[2].outerHTML = editHtml;
          };
        },
        [fn, turn, answer(turn), regen(turn), answerAttrs(regen(turn)), [0, 1, 2, 3].map((k) => `<p>${REGENERATED(turn, k)}</p>`).join(''), `<p>${EDITED(turn)}</p>`],
      );
      await page.mouse.click(20, 888);
      await page.waitForTimeout(900); // the page re-checks staleness 600 ms after a click
    };
    await open('light');
    await dotCount(2);
    await toTop();
    let seg = await dotsNow();
    check('stale: before any change, both dots are solid', solid(seg.lone) && solid(seg.turn), { seg });

    // Regenerate question 10's answer and edit paragraph 2 of question 7's, in the page.
    await act('regen', LONE);
    await act('edit', TURN);
    await page.mouse.move(700, 300);
    seg = await dotsNow();
    check('regenerated: the dot of a question whose only bookmark is stale turns hollow, a 1 px inner ring in its colour',
      hollow(seg.lone) && seg.lone.label.endsWith('(answer changed)'), { seg });
    check('edited: one stale bookmark of three keeps the dot solid', solid(seg.turn), { seg });
    check('nothing about staleness is stored', (await stored()).length === 4 && (await stored()).every((b) => !('stale' in b)));

    const muted = { light: 'rgb(143, 143, 143)', dark: 'rgb(163, 163, 163)' };
    await hoverTick(LONE);
    let st = await staleState();
    check('the stale single row: the card is named "Bookmark · answer changed", grey text, a hollow dot and the footer',
      st.shown && st.stale && st.name === 'Bookmark · answer changed' && st.rows[0].color === muted.light && st.rows[0].dot.bg === 'rgba(0, 0, 0, 0)' &&
        st.rows[0].why === null && st.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.", { name: st.name, rows: st.rows, warn: st.warn });
    await hoverTick(TURN);
    st = await staleState();
    check('the list: the edited paragraph\'s row is grey with "answer changed", the others are not',
      st.shown && st.rows.length === 3 && JSON.stringify(st.rows.map((r) => r.stale)) === '[false,true,false]' &&
        st.rows[1].why === 'answer changed' && st.rows[1].color === muted.light && st.rows[0].why === null && st.rows[0].color !== muted.light, { rows: st.rows });

    // A jump to a stale bookmark lands at the start of its question: from the single row, and a
    // click on the hollow dot's position opens the question too.
    await toTop();
    await hoverTick(LONE);
    st = await staleState();
    await page.mouse.move(st.one.x, st.one.y, { steps: 12 });
    await page.mouse.click(st.one.x, st.one.y);
    await page.waitForTimeout(3500);
    let atQuestion = await questionTop(LONE);
    check('clicking the stale bookmark lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    await toTop();
    const d10 = (await dotsNow()).lone;
    await page.mouse.move(d10.x, d10.y, { steps: 4 });
    await page.mouse.click(d10.x, d10.y);
    await page.waitForTimeout(3500);
    atQuestion = await questionTop(LONE);
    check("a click on the hollow dot's position opens its question", Math.abs(atQuestion - 64) <= 3, { atQuestion });
    // The edited row too; a live row still lands on its paragraph.
    await toTop();
    await hoverTick(TURN);
    c = await ontoRow(1);
    await page.mouse.click(c.rows[1].x - 40, c.rows[1].y);
    await page.waitForTimeout(3500);
    atQuestion = await questionTop(TURN);
    check('clicking the grey row lands at the start of its question', Math.abs(atQuestion - 64) <= 3, { atQuestion });
    await toTop();
    await hoverTick(TURN);
    c = await ontoRow(2);
    await page.mouse.click(c.rows[2].x - 40, c.rows[2].y);
    await page.waitForTimeout(3500);
    check('a live row next to it still lands on its paragraph', Math.abs((await block(TURN, 4)).fromTop - 64) <= 3, { fromTop: (await block(TURN, 4)).fromTop });

    // The original version switched back: live again.
    await toTop();
    await act('back', LONE);
    await page.mouse.move(700, 300);
    seg = await dotsNow();
    await hoverTick(LONE);
    st = await staleState();
    check('switched back to the original answer: the bookmark is live again, its dot solid', solid(seg.lone) &&
      !st.stale && st.name === 'Bookmark · question 10 of 12' && st.warn === null, { seg, st: st.name });

    // Regenerating every bookmarked answer under question 7 turns its dot hollow.
    await act('regen', TURN);
    await page.mouse.move(700, 300);
    seg = await dotsNow();
    check('all of question 7\'s bookmarks stale: now its dot is hollow too', hollow(seg.turn), { seg });

    // After a reload the regenerated answer is the conversation's version: the old message is gone
    // from the list, and the bookmark is still kept, stale, under question 10. Light and dark shots.
    serve({ regen: [LONE], edited: [TURN] });
    const staleShots = {};
    for (const theme of ['light', 'dark']) {
      await open(theme);
      await dotCount(2);
      await toTop();
      seg = await dotsNow();
      await hoverTick(LONE);
      const single = await staleState();
      await shoot(`card-stale-${theme}`);
      await hoverTick(TURN);
      const list = await staleState();
      await ontoRow(0);
      await shoot(`card-list-stale-${theme}`);
      staleShots[theme] = { seg, single, list };
    }
    for (const theme of ['light', 'dark']) {
      const { seg, single, list } = staleShots[theme];
      const dot = theme === 'dark' ? 'rgb(227, 199, 102)' : LIGHT_DOT;
      check(`after a reload (${theme}): the vanished message's bookmark is kept, stale, its dot hollow beside question 10`,
        hollow(seg.lone, dot) && single.stale && single.rows[0].color === muted[theme] &&
          single.warn === "This paragraph can't be found any more. Clicking opens question 10 instead.", { seg, single: single.name });
      check(`after a reload (${theme}): the edited row stays grey, its dot solid`,
        solid(seg.turn, dot) && JSON.stringify(list.rows.map((r) => r.stale)) === '[false,true,false]' && list.rows[1].color === muted[theme], { rows: list.rows });
    }
    check('after the reload, all four bookmarks are still stored', (await stored()).length === 4);

    // Chinese: the stale strings.
    await settings({ lang: 'zh', bookmarkNotice: 'acknowledged' });
    await open('light');
    await dotCount(2);
    await toTop();
    await hoverTick(LONE);
    const zhSingle = await staleState();
    await hoverTick(TURN);
    const zhList = await staleState();
    check('Chinese: "书签 · 回答已变化", its footer and the "回答已变化" row',
      zhSingle.name === '书签 · 回答已变化' && zhSingle.warn === '找不到这一段了。点击会跳到第 10 个问题的开头。' && zhList.rows[1].why === '回答已变化',
      { name: zhSingle.name, warn: zhSingle.warn, why: zhList.rows[1].why });

    // The #51 mockup's stale cards, when given, for a side-by-side look (its section 4 notice is
    // replaced by #77's notification, which the pill scenario shoots).
    if (process.env.BUTTER_BOOKMARKS_MOCKUP) {
      const mock = await openMockup(context, process.env.BUTTER_BOOKMARKS_MOCKUP);
      // Section 3's stale states, for a side-by-side look at card-stale-* and card-list-stale-*.
      await mock.click('#lang button[data-l="en"]');
      for (const theme of ['light', 'dark'])
        for (const [scene, name] of [['stale', 'card-stale'], ['list', 'card-list']])
          await mock
            .locator(`.frame${theme === 'dark' ? '.dark' : ':not(.dark)'}[data-scene="${scene}"]`)
            .screenshot({ path: `${shots}/mockup-${name}-${theme}.png` });
      await mock.close();
    }
  },
};
