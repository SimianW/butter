// ---- Citations: a selection that spans ChatGPT's citation tags (the source pill after a sentence,
// holding an icon <svg> and a favicon <img>), or starts or ends inside one, gets Ask in branch as
// the same text without the tag would; the quote never holds the tag's label (source name, "+1"),
// on the plain-text path and on the formula path, and the sent message keeps the sentence on one
// quoted line (Chrome's own selection text puts a line break where each tag was). A plain image in
// a reply still gets no cell.
import assert from 'node:assert/strict';
import { butter, chipOf, HOST, inShadow, settle } from '../driver.mjs';
import { CITE } from '../fixture.mjs';

// Within #cite: the text spans before, between and after the tags; the first tag's source name.
const text = (index) => ({ css: '#cite > span:not(.contents)', index });
const tagName = { css: '#cite [data-testid="chatgpt-citation"] .truncate' };

export default {
  name: 'citations',
  description: 'A selection spanning, starting or ending in a citation tag gets Ask in branch and quotes no tag label, with or without a formula, on one line when sent; a plain image still gets no cell',
  scene: 'cite=1&math=1',
  async run({ open, context, pass, MATH }) {
    const page = await open();
    // The box's quote for the current selection; null when the pill has no Ask in branch cell.
    const quoteOf = async (at) => {
      await settle(page);
      try {
        await chipOf(page).waitFor({ timeout: 2_000 });
      } catch {
        return null;
      }
      await chipOf(page).click();
      await inShadow(page, '.qpop').waitFor();
      const quote = await page.evaluate((host) => document.querySelector(host).shadowRoot.querySelector('.q span').textContent, HOST);
      await inShadow(page, 'textarea').press('Escape');
      await page.waitForFunction((host) => !document.querySelector(host)?.shadowRoot?.querySelector('.qpop'), HOST);
      await butter(page).clearSelection();
      await settle(page);
      assert.ok(!quote.includes(CITE.name) && !quote.includes(CITE.more) && !quote.includes('Wikipedia'), `${at}: no tag label in ${JSON.stringify(quote)}`);
      return quote;
    };
    const cases = [
      // From "battery" across the first tag into " It charges".
      ['spanning a tag', [text(0), 4, text(1), 11], 'battery lasts all day. It charges'],
      // Across both tags, into " Sources".
      ['spanning two tags', [text(0), 4, text(2), 8], 'battery lasts all day. It charges in an hour. Sources'],
      // From "battery" into the middle of the tag's source name.
      ['ending inside a tag', [text(0), 4, tagName, 4], 'battery lasts all day.'],
      // From the middle of the tag's source name into " It charges".
      ['starting inside a tag', [tagName, 4, text(1), 11], 'It charges'],
    ];
    for (const [at, [from, start, to, end], want] of cases) {
      await butter(page).selectText(from, start, to, end);
      assert.equal(await quoteOf(at), want, `${at}: Ask in branch, with the text alone as its quote`);
    }
    // Wholly inside the tag's source name: no text of the reply, so no Ask in branch.
    await butter(page).selectText(tagName, 1, tagName, 4);
    assert.equal(await quoteOf('inside a tag'), null, 'inside a tag: no Ask in branch');
    // The formula path: from "error" across the formula and the tag into " Then".
    await butter(page).selectText({ css: '#cite-math > span', index: 0 }, 4, { css: '#cite-math > span:not(.contents)', index: 3 }, 5);
    assert.equal(await quoteOf('formula and tag'), `error falls as $${MATH.rate}$ per step. Then`, 'formula and tag: Ask in branch, formula as LaTeX');
    // The formula path, ending inside the tag.
    await butter(page).selectText({ css: '#cite-math > span', index: 0 }, 4, { css: '#cite-math [data-testid="chatgpt-citation"] .truncate' }, 3);
    assert.equal(await quoteOf('formula, ending in a tag'), `error falls as $${MATH.rate}$ per step.`, 'formula, ending inside a tag: Ask in branch');
    pass('citations: spanning, starting or ending in a tag gets Ask in branch; the quote has no tag label on either path');
    // Sent: the quote across both tags is one line, as the text reads without them.
    await butter(page).selectText(text(0), 4, text(2), 8);
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).click();
    await inShadow(page, 'textarea').fill('Why?');
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await inShadow(dest, '.line').waitFor();
    // The composer reads line breaks back as blank lines (see the formulas scenario).
    const lines = (m) => m.split('\n').filter((line) => line.trim() !== '' && line.trim() !== '>');
    const sent = await dest.evaluate(() => fixture.sent.map((m) => m.text));
    assert.equal(sent.length, 1, 'sent once');
    assert.deepEqual(lines(sent[0]), ['> battery lasts all day. It charges in an hour. Sources', 'Why?'], 'sent quote: one line, no tag label');
    await dest.close();
    pass('citations: the sent quote across two tags is one line with no tag label');
    // A plain image still excludes the selection; the same paragraph's text alone does not.
    await butter(page).selectText({ css: '#image > span' }, 0, { css: '#image > span' }, 9);
    assert.equal(await quoteOf('text beside an image'), 'The chart', 'text beside an image: Ask in branch');
    await butter(page).selectText({ css: '#image > span' }, 4, { css: '#image > span', index: 1 }, 6);
    assert.equal(await quoteOf('an image'), null, 'a selection across an image: no Ask in branch');
    await page.close();
    pass('citations: a plain image in the selection still gets no Ask in branch');
  },
};
