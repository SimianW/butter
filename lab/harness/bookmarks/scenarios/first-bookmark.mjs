// The first bookmark ever (#56, #77): the notification expanded with the privacy text at top right
// (12 px below the header, 8 px left of the rail, 300 px, Butter's font), staying past 4 s, the
// pending consent card staying bottom right apart from it; Undo deletes the bookmark and its dot,
// and the next save expands it again (light and dark, English and Chinese, with layout consent
// pending, declined, granted and switched off). Got it leaves only the small card on a third save
// and after a reload; the pointer on the card holds it.
const TURN = 6,
  PARA = 3;

export default {
  name: 'first-bookmark',
  description: 'The first bookmark ever (#56, #77): the expanded card, consent pending beside it, Undo, Got it, then the small card',
  settings: { bookmarkNotice: undefined },
  async run(qa) {
    const { open, stored, rail, page, shots, check, waitNote, noteCard, pressNote, worker, settings, bookmark } = qa;
    const consentCard = () =>
      page.evaluate(() => {
        const host = document.querySelector('chatgpt-butter-consent');
        if (!host || host.hidden) return null;
        const r = host.shadowRoot.querySelector('.card').getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, z: getComputedStyle(host).zIndex };
      });
    const acknowledged = () =>
      worker.evaluate(() => chrome.storage.local.get('butter').then(({ butter }) => butter.bookmarkNotice));
    const COPY = {
      en: {
        title: 'Bookmark saved',
        body: 'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove one with the × on its card in the rail, or clear them all in the Butter popup.Privacy policy',
        href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.md',
        buttons: ['Undo', 'Got it'],
      },
      zh: {
        title: '书签已保存',
        body: 'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 可删除一个，也可以在 Butter 弹窗里全部清除。隐私政策',
        href: 'https://github.com/SimianW/butter/blob/main/PRIVACY.zh-CN.md',
        buttons: ['撤销', '知道了'],
      },
    };
    for (const [i, run] of [
      { theme: 'light', lang: 'en', butter: {}, consent: 'declined' },
      { theme: 'dark', lang: 'en', butter: { layoutConsent: 'pending' }, consent: 'pending' },
      { theme: 'light', lang: 'zh', butter: { lang: 'zh', layoutConsent: 'granted', opts: { layout: true } }, consent: 'granted' },
      { theme: 'dark', lang: 'zh', butter: { lang: 'zh', layoutConsent: 'granted', opts: { layout: false } }, consent: 'layouts off' },
    ].entries()) {
      const name = `${run.theme} ${run.lang}, consent ${run.consent}`;
      await settings({ ...run.butter, bookmarkNotice: undefined });
      await open(run.theme);
      const save = await bookmark(TURN, PARA);
      check(`first bookmark (${name}): nothing before the save`, !(await noteCard()).shown);
      await save.click();
      await waitNote(COPY[run.lang].title);
      const n = await noteCard();
      const c = COPY[run.lang];
      check(`first bookmark (${name}): the expanded card, with the approved copy`,
        n.shown && n.kind.includes('first') && n.title === c.title && n.body === c.body && n.href === c.href &&
          JSON.stringify(n.buttons) === JSON.stringify(c.buttons) && n.lang === (run.lang === 'zh' ? 'zh-CN' : 'en') &&
          n.excerpt.length > 0 && n.oneLine,
        n);
      check(`first bookmark (${name}): top right, 12 px below the header and 8 px left of the rail, 300 px, Butter's font`,
        n.width === 300 && Math.round(n.top) === 64 && Math.round(1400 - n.right) === n.railInset + 60 && n.z === '19' &&
          n.font.includes('ButterConsentNunito'),
        { top: n.top, right: 1400 - n.right, railInset: n.railInset, width: n.width, z: n.z });
      if (run.consent === 'pending') {
        await page.waitForSelector('chatgpt-butter-consent[data-visible]', { state: 'attached', timeout: 5000 });
        await page.waitForTimeout(400);
        const [m, k] = [await noteCard(), await consentCard()];
        check(`first bookmark (${name}): the consent card stays bottom right, apart from the notification`,
          k && m.shown && Math.round(1400 - k.right) === 30 && Math.round(900 - k.bottom) >= 82 && m.bottom < k.top,
          { notice: m, consent: k });
      }
      if (i === 0) {
        await page.waitForTimeout(4500);
        check('the expanded card does not leave by itself', (await noteCard()).shown);
      }
      const shot = await noteCard();
      await page.screenshot({
        path: `${shots}/notice-${run.theme}-${run.lang}.png`,
        clip: { x: Math.round(shot.left) - 8, y: Math.round(shot.top) - 8, width: 316 + 60, height: Math.round(shot.bottom - shot.top) + 16 },
      });
      check(`first bookmark (${name}): the save drew its dot`, (await rail()).dots.length === 1);
      if (i < 3) {
        await pressNote('undo');
        await page
          .waitForFunction(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === 0, null, { timeout: 5000 })
          .catch(() => {});
        await page.waitForTimeout(300);
        const after = await noteCard();
        check(`first bookmark (${name}): Undo deletes the bookmark, its dot goes, the card goes unacknowledged`,
          (await stored()).length === 0 && (await rail()).dots.length === 0 && !after.shown &&
            (await acknowledged()) === undefined,
          { stored: (await stored()).length, dots: (await rail()).dots.length, after: after.shown });
      } else {
        await pressNote('ok');
        await page.waitForTimeout(400);
        check(`first bookmark (${name}): Got it keeps the bookmark and records the acknowledgement`,
          !(await noteCard()).shown && (await stored()).length === 1 && (await rail()).dots.length === 1 &&
            (await acknowledged()) === 'acknowledged');
      }
    }
    // A third save, and one after a reload: the small card only.
    await settings({ lang: 'en' });
    await open('light');
    const third = await bookmark(TURN, 0);
    await third.click();
    await waitNote('Bookmark saved');
    let small = await noteCard();
    check('after Got it, a save shows the small card', small.shown && !small.kind.includes('first') && JSON.stringify(small.buttons) === '["Undo"]' &&
      (await stored()).length === 2, small);
    await open('light');
    const fourth = await bookmark(2, 0);
    await fourth.click();
    await waitNote('Bookmark saved');
    small = await noteCard();
    check('after Got it and a reload, the small card again', small.shown && !small.kind.includes('first') && (await stored()).length === 3, small);
    // The pointer on the card holds it; it leaves 4 s after the pointer goes.
    await page.mouse.move((small.left + small.right) / 2 - 60, (small.top + small.bottom) / 2, { steps: 4 });
    await page.waitForTimeout(4500);
    const held = (await noteCard()).shown;
    await page.mouse.move(700, 600, { steps: 4 });
    await page.waitForTimeout(2000);
    const stillThere = (await noteCard()).shown;
    await page.waitForTimeout(2600);
    check('the pointer on the card holds it; it leaves 4 s after the pointer goes', held && stillThere && !(await noteCard()).shown,
      { held, stillThere });
  },
};
