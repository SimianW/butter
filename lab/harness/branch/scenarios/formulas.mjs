// ---- Formulas: a selection across text and KaTeX formulas, ending partway into one, quotes each
// formula whole as its LaTeX source; the box shows that quote and Enter sends it.
import assert from 'node:assert/strict';
import { butter, chipOf, HOST, inShadow, settle } from '../driver.mjs';

export default {
  name: 'formulas',
  description: 'A selection across text and KaTeX formulas, ending partway into one, quotes each formula as its LaTeX source, in the box and in the sent message',
  scene: 'math=1',
  async run({ open, context, capture, log, pass, MATH }) {
    const page = await open();
    // From "descent with step" to "O(" of O(1/k): partway into the formula.
    await butter(page).selectText({ css: '#math-before' }, 9, { css: '#math-after .katex-html .mord', index: 1 }, 1);
    await chipOf(page).waitFor();
    await settle(page);
    const quote = `descent with step $${MATH.inline}$:\n\n$$${MATH.display}$$\n\nconverges at rate $${MATH.rate}$`;
    await capture(page, 'formula-button', 1280, 'light');
    await chipOf(page).click();
    await inShadow(page, '.qpop').waitFor();
    await settle(page);
    const shown = await page.evaluate((host) => {
      const q = document.querySelector(host).shadowRoot.querySelector('.q span');
      return { text: q.textContent, oneLine: q.scrollHeight <= q.clientHeight + 1 };
    }, HOST);
    assert.equal(shown.text, quote.replace(/\s+/g, ' '), 'box shows the LaTeX quote');
    assert.ok(shown.oneLine, 'box quote on one line');
    await capture(page, 'formula-question', 1280, 'light');
    await inShadow(page, 'textarea').fill('Why this rate?');
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await inShadow(dest, '.line').waitFor();
    const sent = await dest.evaluate(() => fixture.sent.map((m) => m.text));
    const lines = (s) => s.split('\n').filter((line) => line.trim() !== '' && line.trim() !== '>');
    log(`INFO formula message as sent: ${JSON.stringify(sent[0])}`);
    assert.equal(sent.length, 1, 'sent once');
    assert.deepEqual(
      lines(sent[0]),
      lines(`${quote.split('\n').map((l) => `> ${l}`).join('\n')}\n\nWhy this rate?`),
      'sent message quotes the LaTeX source, line by line',
    );
    assert.ok(sent[0].includes(`> $$\\begin{aligned}`), 'display math starts its own quoted line');
    await dest.close();
    await page.close();
    pass('formulas: text + partial formula selection quotes LaTeX, one-line box quote, sent');
  },
};
