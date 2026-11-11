// The matrix suite after the jumps, in run order: from a reload with only the chat's tail loaded,
// a bookmark in earlier history is reached by its card row and by the keyboard; both bookmarks then
// resolve live; and the card's delete controls remove them. The phases and checks are the single
// script's.
import { all, loaded, stored, target } from './needs.mjs';

// Each click path starts from a fresh content-script/rail instance with only the tail loaded.
const unloaded = (route) => ({
  name: `unloaded-${route}`,
  description:
    route === 'row'
      ? "reloads (the bookmarked answer unloaded): the earlier dot and its 2-bookmark card, then the card's second row loads earlier pages and lands on the text"
      : 'reloads again: the same, through the earlier-history dots and the keyboard (ArrowLeft, Enter on the first row)',
  precondition: all(loaded, target, stored(2)),
  async run(t) {
    const { page, rec, check, net } = t;
    rec.phase = `reload-unloaded-${route}`;
    await t.open();
    await t.restoreTargets();
    const cold = {
      ...(await t.railState()),
      stored: await t.storedCount(),
      targetMounted: !!(await t.targetBox(0)),
      earlierPagesBefore: net.earlierPages,
    };
    await check(`reload before ${route} click leaves earlier answer unloaded`, !cold.targetMounted && cold.more && cold.stored === 2, cold);
    await t.checkEarlierSegment(route);
    await t.hoverEarlierCard(2, route);
    rec.phase = `jump-unloaded-${route}`;
    await t.beginJumpProbe();
    await t.watchEarlierLoading();
    if (route === 'row') {
      // Choose the newer selection; the keyboard route below picks the first row.
      await page.locator('chatgpt-butter-nav .bmc .go').nth(1).click();
    } else {
      // Dots are decorative (#71). Enter the earlier-history card from its real button,
      // then activate its first bookmark with the keyboard (#70, #72).
      await (await t.markedControl()).focus();
      await page.keyboard.press('ArrowLeft');
      await page.keyboard.press('Enter');
    }
    await t.waitLanding();
    await t.endJumpProbe(`unloaded-${route}`);
    const landed = await t.targetBox(route === 'row' ? 1 : 0);
    const loading = await page.evaluate(() => {
      __earlierLoading.observer.disconnect();
      const { sawLoadingMeta, sawSpinner, sawBusyDots } = __earlierLoading;
      return { sawLoadingMeta, sawSpinner, sawBusyDots };
    });
    const moved = await t.earlierSegmentState();
    await check(
      `${route} click loads earlier pages and lands on requested text`,
      !cold.targetMounted && net.earlierPages > cold.earlierPagesBefore && landed?.inView,
      {
        earlierPages: net.earlierPages - cold.earlierPagesBefore,
        targetMounted: !!landed,
        inView: !!landed?.inView,
        textTop: landed?.top ?? null,
        ...loading,
      },
    );
    await check(
      `segment moves from dots to loaded question after ${route} click`,
      moved.marks === 1 && moved.earlierMarks === 0 && moved.loadedMarks === 1,
      moved,
    );
    // Keep the remainder of the matrix meaningful if the product's automatic load fails.
    if (!landed) {
      await t.loadEarlier();
      await t.jump(0);
      await t.waitLanding();
    }
  },
});

export const unloadedRow = unloaded('row');
export const unloadedKeyboard = unloaded('keyboard');

export const resolve = {
  name: 'resolve',
  description: "both stored bookmarks resolve live on the reloaded chat (message, excerpt, question, first line); their card shows no answer-changed row",
  precondition: all(loaded, target, stored(2)),
  async run(t) {
    const { page, worker } = t;
    await t.restoreTargets();
    const records = await worker.evaluate(async () => {
      const db = await new Promise((ok, no) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      try {
        return await new Promise((ok, no) => {
          const r = db.transaction('bookmarks').objectStore('bookmarks').getAll();
          r.onsuccess = () => ok(r.result.map(({ msg, para, excerpt, ask, line }) => ({ msg, para, excerpt, ask, line })));
          r.onerror = no;
        });
      } finally {
        db.close();
      }
    });
    const resolution = await page.evaluate(async (records) => {
      const t = window.__bookmarkLive;
      const answer = document.querySelector(`[data-turn-key="${t.turn}"]`)?.querySelector(t.answer);
      const id = answer?.closest('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id');
      const hex = (buf) => [...new Uint8Array(buf)].map((n) => n.toString(16).padStart(2, '0')).join('');
      const hash = id && hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)));
      const askHash = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t.turn)));
      const flat = (text) => text.replace(/\s+/g, ' ').trim();
      let matched = 0;
      for (const b of records) {
        const block = answer?.querySelectorAll(t.blocks)[b.para];
        if (hash === b.msg && block && flat(block.textContent).includes([...flat(b.excerpt)].slice(0, 40).join(''))) matched++;
      }
      return {
        targetMounted: !!answer,
        records: records.length,
        matchingMessagesAndExcerpts: matched,
        matchingQuestions: records.filter((b) => b.ask === askHash).length,
        validFirstLines: records.filter((b) => Number.isInteger(b.line) && b.line > 0 && b.line <= [...b.excerpt].length).length,
      };
    }, records);
    await (await t.markedControl()).focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(2800);
    const live = await page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
      return {
        marks: r.querySelectorAll('.bdot:not(.gone)').length,
        staleMarks: r.querySelectorAll('.bdot.stale:not(.gone)').length,
        cardRows: r.querySelectorAll('.bmc .go, .bmc .one').length,
        staleRows: r.querySelectorAll('.bmc .it.stale, .bmc.stale, .bmc .why, .bmc .warn').length,
      };
    });
    await t.check(
      'reload resolves both bookmarks live without answer changed',
      resolution.targetMounted &&
        resolution.matchingMessagesAndExcerpts === 2 &&
        resolution.matchingQuestions === 2 &&
        resolution.validFirstLines === 2 &&
        (await t.storedCount()) === 2 &&
        live.marks === 1 &&
        live.staleMarks === 0 &&
        live.cardRows === 2 &&
        live.staleRows === 0,
      { ...live, ...resolution },
    );
  },
};

export const remove = {
  name: 'delete',
  description: "removes the selection bookmark with its card's ×; after a reload the earlier dot and its 1-bookmark card; then removes the other",
  precondition: all(loaded, target, stored(2)),
  async run(t) {
    const { page, check } = t;
    // Reopen after the resolution probe: asynchronous rail updates may have dismissed the card.
    await page.mouse.move(10, 300);
    await (await t.markedControl()).focus();
    await page.keyboard.press('ArrowLeft');
    // The remove button is shown only on its hovered/focused row.
    await page.locator('chatgpt-butter-nav .bmc .go').last().focus();
    // Delete one through its loaded card, then check the single-bookmark earlier card on reload.
    await page.locator('chatgpt-butter-nav .bmc .x').last().click();
    await page.waitForTimeout(700);
    await check('card delete removes selection bookmark', (await t.storedCount()) === 1, { remaining: await t.storedCount() });
    await t.open();
    await t.restoreTargets();
    await t.checkEarlierSegment('single');
    await t.hoverEarlierCard(1, 'single');
    const remaining = await t.deleteMarks();
    await check('card delete removes both test bookmarks', remaining === 0, { remaining, marks: (await t.railState()).marks });
  },
};
