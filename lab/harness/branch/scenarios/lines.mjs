// ---- Ready and unsure lines and ChatGPT's disclaimer (on the composer's top edge, as live): the
// line takes the disclaimer's row, covering it with the page's background and its type; × brings
// the disclaimer back. Unsure: ChatGPT's Send button stays disabled past Butter's 3 s wait.
// With no disclaimer, the line sits in its own row 8 px above the composer.
import assert from 'node:assert/strict';
import { assertCovers, HOST, inShadow, lineGeometry, lineLook } from '../driver.mjs';

const UNSURE = 'Not sent: couldn’t confirm this is a new branch.';
const READY = 'Branched from “Explain Corpus Meaning” · original unchanged';

export default {
  name: 'lines',
  description: "The ready and unsure lines cover ChatGPT's disclaimer (1280/390 px, light/dark): opaque, its type, centred, × brings it back; without a disclaimer, 8 px above the composer",
  async run({ open, ask, capture, log, pass }) {
    for (const theme of ['light', 'dark'])
      for (const width of [1280, 390])
        for (const kind of ['ready', 'unsure']) {
          const at = `${kind} ${width}px ${theme}`;
          const page = await open(`theme=${theme}`, width);
          const dest = await ask(page, { width, fixture: kind === 'unsure' ? 'senddelay=60000' : '' });
          await inShadow(dest, `.line.${kind}`).waitFor({ timeout: 30_000 });
          await dest.waitForTimeout(250);
          assertCovers(await lineGeometry(dest), at);
          const look = await lineLook(dest);
          const l = look.line;
          assert.equal(look.hit, 'butter', `${at}: the disclaimer's centre hits Butter's line`);
          assert.ok(l.row, `${at}: row mode`);
          assert.equal(l.background, look.pageBackground, `${at}: opaque page background`);
          assert.equal(l.fontSize, look.disclaimer.fontSize, `${at}: disclaimer's font size`);
          assert.equal(l.lineHeight, look.disclaimer.lineHeight, `${at}: disclaimer's line height`);
          assert.equal(l.color, look.disclaimer.color, `${at}: --fg2, the fixture's disclaimer colour`);
          assert.deepEqual([l.iconSize, l.xSize, l.gap], [14, 20, '6px'], `${at}: icon, × and gap`);
          assert.equal(l.text, kind === 'unsure' ? UNSURE : READY, `${at}: text`);
          assert.equal(l.title, l.text, `${at}: full text as title`);
          assert.ok(l.oneRow, `${at}: one row`);
          assert.ok(Math.abs(l.offCentre) <= 1, `${at}: icon, text and × centred ${l.offCentre}`);
          if (kind === 'unsure') {
            const err = await dest.evaluate((host) => {
              const probe = document.createElement('i');
              probe.style.color = getComputedStyle(document.querySelector(host).shadowRoot.querySelector('.line')).getPropertyValue('--err');
              document.body.append(probe);
              const c = getComputedStyle(probe).color;
              probe.remove();
              return c;
            }, HOST);
            assert.equal(l.icon, err, `${at}: --err icon`);
            assert.equal(await dest.evaluate(() => fixture.sent.length), 0, `${at}: nothing sent`);
          }
          await capture(dest, `line-${kind}`, width, theme);
          log(`INFO ${at}: ${JSON.stringify({ ...l, err: undefined })}${l.truncated ? ' (truncated)' : ''}`);
          // × removes the line; the disclaimer is visible again.
          await inShadow(dest, '.line .xs').click();
          assert.equal(await inShadow(dest, '.line').count(), 0, `${at}: × removes the line`);
          assert.equal((await lineLook(dest)).hit, 'disclaimer', `${at}: disclaimer visible again`);
          if (theme === 'dark' && kind === 'unsure') await capture(dest, `line-closed`, width, theme);
          await dest.close();
          await page.close();
        }
    {
      const page = await open('nodisclaimer=1');
      const dest = await ask(page);
      await inShadow(dest, '.line').waitFor();
      await dest.waitForTimeout(250);
      const g = await lineGeometry(dest);
      assert.equal(g.disclaimer, null);
      assert.equal(Math.round(g.composer.top - g.line.bottom), 8, 'no disclaimer: line 8 px above composer');
      const fallback = await inShadow(dest, '.line').evaluate((el) => ({
        row: el.classList.contains('row'),
        fontSize: getComputedStyle(el).fontSize,
        left: el.getBoundingClientRect().left,
        width: el.getBoundingClientRect().width,
      }));
      assert.deepEqual(
        fallback,
        { row: false, fontSize: '13.5px', left: g.composer.left, width: g.composer.width },
        "no disclaimer: own row spanning the composer, today's font size",
      );
      await capture(dest, 'line-ready-nodisclaimer', 1280, 'light');
      await dest.close();
      await page.close();
    }
    pass('ready and unsure lines cover the disclaimer at 1280/390 light/dark, opaque, its type, × brings it back; 8 px above the composer without one');
  },
};
