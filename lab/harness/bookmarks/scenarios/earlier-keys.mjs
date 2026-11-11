// Earlier history by keyboard alone (#72): focusing the three dots shows their card, ArrowDown goes
// straight to the first tick and ArrowUp back, ArrowLeft enters the card, ArrowRight returns, Enter
// on a row loads and lands with focus on its question's tick. Under reduced motion the moved dot
// shows without growing and the one beside the three dots goes without fading; Escape while loading
// puts the card away and the loading goes on.
import { earlier, FIRST, HINT, LATEST, scene, seed as eseed } from '../earlier.mjs';

export default {
  name: 'earlier-keys',
  description: "Earlier history by keyboard alone: the three dots' card, arrows, Enter loads and lands; reduced motion, Escape while loading",
  scene,
  store: [eseed(3, 2, 1), eseed(6, 0, 2), LATEST],
  async run(qa) {
    const { page, check, QUESTION, PARAGRAPH, pages } = qa;
    const { state, under, record, recorded, landed, openEarlier, tab } = earlier(qa);
    let s, l, rec;
    // (e) Keyboard alone: the three dots, their card's rows; Enter loads and lands.
    s = await openEarlier('light', 2);
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
      back?.cls.startsWith('more') && l.landed && pages() === 1 && s.active?.cls.startsWith('tick') && !!under(s, 6) && under(s, 6).label === s.active.label &&
        s.moreLabel === `${HINT} · Bookmark · earlier question: ${PARAGRAPH(3, 1).slice(0, 120).trim()}`, { back, ...l, active: s.active, pages: pages() });

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
  },
};
