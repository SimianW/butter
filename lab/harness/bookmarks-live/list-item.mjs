// The matrix suite's last scenario: a later item of a top-level list, bookmarked on its own, lands
// on the item and not on the list's start, before and after a reload. Its precondition picks the
// item (with the whole history loaded) and records `listFixture`; a fixture without a top-level list
// skips it, as the single script did ("SKIP list item matrix").
import { all, loaded, stored } from './needs.mjs';
import { ANSWER, BLOCKS, requireThat } from './page.mjs';

async function listItemBox(t, scroll = false) {
  const box = await t.targetBox(0, scroll);
  if (!box) return null;
  return t.page.evaluate((box) => {
    const t = window.__bookmarkLive;
    const answer = document.querySelector(`[data-turn-key="${t.turn}"]`)?.querySelector(t.answer);
    const item = answer.querySelectorAll(t.blocks)[t.paras[0]];
    const list = item.parentElement;
    const offsetFromListStart = item.getBoundingClientRect().top - list.getBoundingClientRect().top;
    return {
      ...box,
      isListItem: item.matches('li') && list.matches('ul, ol') && list.parentElement === answer,
      itemOrdinal: [...list.children].indexOf(item),
      offsetFromListStart,
      listTop: box.top - offsetFromListStart,
      // A jump to the list's start cannot satisfy this placement for the chosen later item.
      landsOnItem: box.inView && Math.abs(box.top - 64) <= 8 && offsetFromListStart > 24,
    };
  }, box);
}

// Loads earlier history and picks, among the mounted answers' top-level lists, the later item
// furthest below its list's start: the page's target from then on.
async function topLevelList(t) {
  t.rec.phase = 'pick-list-item';
  await t.loadEarlier();
  const picked = await t.page.evaluate(
    ([blocks, answer]) => {
      let lists = 0,
        items = 0,
        maxMeasuredOffset = 0,
        target = null;
      for (const turn of document.querySelectorAll('[data-turn-key]')) {
        for (const a of turn.querySelectorAll(answer)) {
          const paragraphs = [...a.querySelectorAll(blocks)];
          for (const list of a.querySelectorAll(':scope > ul, :scope > ol')) {
            lists++;
            for (const [ordinal, item] of [...list.children].entries()) {
              if (!item.matches('li')) continue;
              items++;
              const offset = item.getBoundingClientRect().top - list.getBoundingClientRect().top;
              if (ordinal > 0 && item.textContent.trim().length > 0 && offset > Math.max(24, maxMeasuredOffset)) {
                maxMeasuredOffset = offset;
                target = { turn: turn.dataset.turnKey, paras: [paragraphs.indexOf(item)], answer, blocks };
              }
            }
          }
        }
      }
      if (target) window.__bookmarkLive = target;
      return { lists, items, maxMeasuredOffset, targetFound: !!target, paragraph: target?.paras[0] ?? null };
    },
    [BLOCKS, ANSWER],
  );
  t.rec.summary.listFixture = picked;
  t.listPicked = picked;
  // The fixture lacks one: an expected skip, which a full run passes with (needs.mjs).
  return picked.lists === 0 ? { why: 'no top-level list in mounted fixture answers', expected: true } : null;
}

export const listItem = {
  name: 'list-item',
  description: 'bookmarks a later top-level list item with the Bookmark cell: saved as its own paragraph, its jump lands on the item, before and after a reload; then removed',
  precondition: all(loaded, stored(0), topLevelList),
  async run(t) {
    const { page, worker, rec, check } = t,
      picked = t.listPicked;
    await check('real fixture has a later top-level list item for distinct landing', picked.targetFound, picked);
    requireThat(picked.targetFound, 'no distinct later list item available');
    await t.keepTarget();
    rec.phase = 'bookmark-list-item';
    await t.bookmarkParagraph('list item: the Bookmark cell is named Bookmark selection');
    const stored = await t.storedCount();
    const item = await listItemBox(t);
    const anchor = await worker.evaluate(async () => {
      const db = await new Promise((ok, no) => {
        const r = indexedDB.open('butter-layouts-v1');
        r.onsuccess = () => ok(r.result);
        r.onerror = no;
      });
      try {
        const records = await new Promise((ok, no) => {
          const r = db.transaction('bookmarks').objectStore('bookmarks').getAll();
          r.onsuccess = () => ok(r.result);
          r.onerror = no;
        });
        const hash = async (id) =>
          [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))].map((n) => n.toString(16).padStart(2, '0')).join('');
        globalThis.liveListRecords = records;
        return {
          matchingParagraph: records.length === 1 && records[0].para === liveTarget.paras[0],
          matchingQuestion: records.length === 1 && records[0].ask === (await hash(liveTarget.turn)),
          validFirstLine: records.length === 1 && Number.isInteger(records[0].line) && records[0].line > 0 && records[0].line <= [...records[0].excerpt].length,
        };
      } finally {
        db.close();
      }
    });
    await check('list item button saves its individual paragraph with ask and line', stored === 1 && item?.isListItem && Object.values(anchor).every(Boolean), {
      stored,
      ...anchor,
      ...item,
    });
    rec.phase = 'jump-list-item';
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
      s.scrollTop += 1200;
    });
    await t.jump(0);
    await t.waitLanding();
    const landed = await listItemBox(t);
    await check('list item jump lands on the item instead of the list start', landed?.landsOnItem, landed || { mounted: false });
    rec.phase = 'reload-list-item';
    await t.open();
    await t.restoreTargets();
    const cold = { ...(await t.railState()), targetMounted: !!(await t.targetBox(0)) };
    await t.jump(0);
    await t.waitLanding();
    const reloaded = await listItemBox(t);
    // Original anchors remain private in worker/page memory; return only equality checks.
    const records = await worker.evaluate(() => liveListRecords);
    const resolved = await page.evaluate(async (records) => {
      const t = window.__bookmarkLive;
      const a = document.querySelector(`[data-turn-key="${t.turn}"]`)?.querySelector(t.answer);
      const b = a?.querySelectorAll(t.blocks)[t.paras[0]];
      const id = a?.closest('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id');
      const hash =
        id && [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))].map((n) => n.toString(16).padStart(2, '0')).join('');
      const flat = (text) => text.replace(/\s+/g, ' ').trim();
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
      return {
        matchingMessageAndExcerpt: records.length === 1 && hash === records[0].msg && !!b && flat(b.textContent).includes([...flat(records[0].excerpt)].slice(0, 40).join('')),
        staleMarks: r.querySelectorAll('.bdot.stale:not(.gone)').length,
      };
    }, records);
    await t.jump(0);
    await t.waitLanding();
    await (await t.markedControl()).focus();
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(2800);
    const staleRows = await page
      .locator('chatgpt-butter-nav .bmc .it.stale, chatgpt-butter-nav .bmc.stale, chatgpt-butter-nav .bmc .why, chatgpt-butter-nav .bmc .warn')
      .count();
    await check(
      'list item resolves live and lands on the same item after reload',
      reloaded?.landsOnItem && resolved.matchingMessageAndExcerpt && resolved.staleMarks === 0 && staleRows === 0 && (await t.storedCount()) === 1,
      { cold, ...reloaded, ...resolved, staleRows },
    );
    const remaining = await t.deleteMarks();
    await check('card delete removes list item test bookmark', remaining === 0 && (await t.railState()).marks === 0, {
      remaining,
      marks: (await t.railState()).marks,
    });
  },
};
