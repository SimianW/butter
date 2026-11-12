// An answer that streamed in this tab (#51). The user sends question 13 here: the rail hears the
// send (a `butter-nav` 'send', as history/conversation-main.js reports it) and the turn mounts with
// an answer no page GET lists. A bookmark on its paragraph 2 stays live after ChatGPT's virtualizer
// unmounts the turn and the bookmarks refresh, and its row still lands on that paragraph once the
// turn mounts again.
import { answer, CONV, question, sha, TURNS } from '../fixture.mjs';

export default {
  name: 'streamed',
  description: "An answer streamed in this tab (#51): its bookmark stays live while the virtualizer unmounts the turn, and its row lands",
  async run(qa) {
    const { page, check, open, stored, rail, dotBeside, dotCount, staleCard, hoverTick, ontoRow, toTop, questionTop, block, bookmark, QUESTION, turnHtml } = qa;

    const SENT = TURNS,
      SENT_PARA = 2;
    await open('light');
    await page.evaluate(
      ([conv, parent, id, q, turn]) => {
        document.dispatchEvent(new CustomEvent('butter-nav', { detail: JSON.stringify({ type: 'send', conv, parent, item: { id, q } }) }));
        document.querySelector('.content').insertAdjacentHTML('beforeend', turn);
      },
      [CONV, answer(TURNS - 1), question(SENT), QUESTION(SENT), turnHtml(SENT)],
    );
    await page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick').length === n, TURNS + 1, { timeout: 5000 });
    await page.waitForTimeout(400);
    const sentMark = await bookmark(SENT, SENT_PARA);
    await sentMark.click();
    await dotCount(1);
    await page.waitForTimeout(800);
    const sentRows = await stored();
    check('streamed here: the sent question\'s answer, not in any page GET, takes a bookmark under question 13',
      sentRows.length === 1 && sentRows[0].msg === sha(answer(SENT)) && sentRows[0].ask === sha(question(SENT)) &&
        sentRows[0].turn === SENT && sentRows[0].para === SENT_PARA && !!dotBeside(await rail(), SENT), { stored: sentRows.map(({ turn, para }) => ({ turn, para })) });
    // Scrolled away, the virtualizer swaps the turn for a placeholder of its height, as ChatGPT
    // keeps only the turns around the view. When the placeholder nears the view the turn mounts
    // again 700 ms later: rendering a far turn takes ChatGPT a second or more (rail/jump.js),
    // so the page's re-check 600 ms after the click runs while the turn is still out.
    await toTop();
    const unmounted = await page.evaluate((id) => {
      const sc = document.querySelector('.thread-scroll-container'),
        turn = document.querySelector(`[data-turn-key="${id}"]`),
        hole = document.createElement('div');
      hole.style.height = `${turn.offsetHeight}px`;
      hole.style.marginBottom = '24px';
      turn.replaceWith(hole);
      const io = new IntersectionObserver(
        (es) => {
          if (!es.some((e) => e.isIntersecting)) return;
          io.disconnect();
          setTimeout(() => hole.replaceWith(turn), 700);
        },
        { root: sc, rootMargin: '200px 0px' },
      );
      io.observe(hole);
      return !document.querySelector(`[data-turn-key="${id}"]`);
    }, question(SENT));
    // The pointer reaching the rail re-checks the bookmarks (bookmarks/content.js `toRail`); then the
    // card is read afresh.
    await hoverTick(SENT);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(400);
    await hoverTick(SENT);
    const sentCard = await staleCard(),
      sentRail = await rail(),
      sentDot = dotBeside(sentRail, SENT),
      stillOut = await page.evaluate((id) => !document.querySelector(`[data-turn-key="${id}"]`), question(SENT));
    check('streamed here, unmounted: the dot stays solid, not "answer changed"',
      unmounted && stillOut && sentDot && !sentDot.cls.includes('stale') && sentDot.opacity === 1 && !sentRail.ticks[SENT].label.endsWith('(answer changed)'),
      { unmounted, stillOut, dot: sentDot, label: sentRail.ticks[SENT].label });
    check('streamed here, unmounted: its card is live, with no "answer changed" or footer',
      sentCard.shown && !sentCard.stale && sentCard.name === 'Bookmark · question 13 of 13' && sentCard.warn === null, { name: sentCard.name, warn: sentCard.warn });
    // The row's click mounts the turn again on the way and lands on the bookmarked paragraph.
    const sentOn = await ontoRow(0);
    await page.mouse.click(sentOn.rows[0].x - 40, sentOn.rows[0].y);
    await page.waitForTimeout(3500);
    const remounted = await page.evaluate((id) => !!document.querySelector(`[data-turn-key="${id}"]`), question(SENT)),
      sentAt = remounted ? (await block(SENT, SENT_PARA)).fromTop : null,
      sentQuestion = remounted ? await questionTop(SENT) : null;
    check('streamed here, unmounted: clicking its row lands on the bookmarked paragraph, not the question',
      remounted && Math.abs(sentAt - 64) <= 3, { remounted, fromTop: sentAt, question: sentQuestion });
  },
};
