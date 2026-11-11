// The matrix suite's first scenarios (#57, seam 3), in run order: load the fixture, the empty-arm
// drags, the message ids, the two bookmarks, the bookmarked-arm drags and the jumps after and during
// a drag. The phases and checks are the single script's.
import { BOOKMARK_SCRIPTS } from './drag.mjs';
import { all, loaded, stored, target } from './needs.mjs';
import { requireThat } from './page.mjs';

const reps = () => +(process.env.REPS || 3);

export const loadFixture = {
  name: 'load-fixture',
  description: 'opens the lab fixture, loads its earlier history and picks two long paragraphs of a mounted answer; the store starts empty',
  async run(t) {
    const { page, rec, check, info, net } = t,
      s = rec.summary;
    await t.open();
    s.initial = { ...(await t.railState()), ...(await t.barGeometry()) };
    info('initial', s.initial);
    rec.phase = 'load-earlier';
    s.history = await t.loadEarlier();
    info('history', s.history);
    rec.phase = 'pick-targets';
    s.structure = await page.evaluate(() =>
      [...document.querySelectorAll('[data-turn-key]')].map((t) => ({
        assistant: t.querySelectorAll('[data-message-author-role="assistant"]').length,
        ids: t.querySelectorAll('[data-message-author-role="assistant"][data-message-id]').length,
        markdown: t.querySelectorAll('[data-markdown-text-style="assistant-message"]').length,
        paragraphs: t.querySelectorAll('p').length,
        messageIds: t.querySelectorAll('[data-message-id]').length,
      })),
    );
    info('structure', s.structure);
    s.target = await t.installTargets();
    s.answerAncestors = await page.evaluate(() => {
      let el = document.querySelector(`[data-turn-key="${__bookmarkLive.turn}"]`).querySelector(__bookmarkLive.answer);
      const rows = [];
      for (let i = 0; el && i < 5; i++, el = el.parentElement) rows.push({ tag: el.tagName, attributes: [...el.attributes].map((a) => a.name) });
      return rows;
    });
    await check('real long fixture loaded', s.history.after.ticks > s.initial.ticks && !s.history.after.more, {
      initialTicks: s.initial.ticks,
      totalTicks: s.history.after.ticks,
      earlierPages: net.earlierPages,
    });
    requireThat((await t.storedCount()) === 0, 'unique unpacked install unexpectedly has bookmarks');
  },
};

export const dragEmpty = {
  name: 'drag-empty',
  description: 'REPS (3) held native scrollbar drags with no bookmarks: no turn mounts, storage reads, bookmark messages or bookmark work',
  precondition: all(loaded, stored(0)),
  async run(t) {
    for (let i = 1; i <= reps(); i++) await t.drag('empty', i);
  },
};

export const messageIds = {
  name: 'message-ids',
  description: "re-picks a mounted target (a seek can virtualize it away); the answers' selection message ids match the conversation API's by SHA-256",
  precondition: loaded,
  async run(t) {
    const { page, rec, check, net } = t;
    // A native seek can virtualize the original answer away. Reacquire a real mounted target.
    rec.summary.target = await t.installTargets();
    await Promise.all([...net.apiPending]);
    const identity = await page.evaluate(
      async (hashes) => {
        const known = new Set(hashes);
        const roots = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
        let checked = 0,
          matched = 0;
        const hash = async (id) =>
          [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(id)))].map((n) => n.toString(16).padStart(2, '0')).join('');
        for (const root of roots) {
          const id = root.closest('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id');
          if (!id) continue;
          checked++;
          if (known.has(await hash(id))) matched++;
        }
        const t = window.__bookmarkLive;
        const root = document.querySelector(`[data-turn-key="${t.turn}"]`).querySelector(t.answer);
        const id = root.closest('[data-chatgpt-selection-message-id]')?.getAttribute('data-chatgpt-selection-message-id');
        return { checked, matched, targetMatched: !!id && known.has(await hash(id)) };
      },
      [...net.apiHashes],
    );
    await check(
      'live selection message ids match conversation API by SHA-256',
      identity.checked > 0 && identity.checked === identity.matched && identity.targetMatched,
      { ...identity, apiPages: net.apiPages, assistantApiMessages: net.apiHashes.size },
    );
  },
};

export const bookmarkParagraph = {
  name: 'bookmark-paragraph',
  description: "selects the first target paragraph whole and clicks the pill's Bookmark cell: one bookmark stored",
  precondition: all(loaded, target, stored(0)),
  async run(t) {
    await t.bookmarkParagraph();
    await t.check('paragraph button saves one bookmark', (await t.storedCount()) === 1, {
      stored: await t.storedCount(),
      marks: (await t.railState()).marks,
    });
  },
};

export const bookmarkSelection = {
  name: 'bookmark-selection',
  description: 'selects 30 characters of the second target and presses the real Alt+Shift+M: two bookmarks stored (if not, checks that none is left)',
  precondition: all(loaded, target),
  async run(t) {
    const { check, worker } = t;
    const selectionCharacters = await t.bookmarkSelection();
    await check('selection saved through real Alt+Shift+M', (await t.storedCount()) === 2, {
      stored: await t.storedCount(),
      selectionCharacters,
      commands: await worker.evaluate(() => liveProbe.commands),
      marks: (await t.railState()).marks,
    });
    // The later scenarios need both bookmarks, and are skipped without them.
    if ((await t.storedCount()) !== 2)
      await check('test bookmarks cleaned up', (await t.storedCount()) === 0, { remaining: await t.storedCount() });
  },
};

export const dragBookmarked = {
  name: 'drag-bookmarked',
  description: 'REPS held drags with the two bookmarks, then the matched comparison with the empty arm: the same zero work in both',
  precondition: all(loaded, stored(2)),
  async run(t) {
    for (let i = 1; i <= reps(); i++) await t.drag('bookmarked', i);
    const { drags } = t.rec.summary;
    const empty = drags.filter((d) => d.arm === 'empty');
    const marked = drags.filter((d) => d.arm === 'bookmarked');
    await t.check(
      'matched drag comparison with bookmarks versus empty',
      empty.length === marked.length &&
        empty.length > 0 &&
        [...empty, ...marked].every(
          (d) =>
            d.held &&
            d.bookmarkCoverageScripts === BOOKMARK_SCRIPTS.length &&
            d.mounts === 0 &&
            d.additions === 0 &&
            d.storage.reads === 0 &&
            d.storage.messages === 0 &&
            Object.values(d.bookmarkWork).every((n) => n === 0),
        ),
      {
        emptyRuns: empty.length,
        bookmarkedRuns: marked.length,
        emptyP95FrameMs: empty.map((d) => d.p95FrameMs),
        bookmarkedP95FrameMs: marked.map((d) => d.p95FrameMs),
      },
    );
  },
};

export const jumpAfterDrag = {
  name: 'jump-after-drag',
  description: "jumps to the selection bookmark from its question's card after a drag: the text lands in view",
  precondition: all(loaded, target, stored(2)),
  async run(t) {
    await t.beginJumpProbe();
    await t.jump(1);
    await t.waitLanding();
    await t.endJumpProbe('after-drag');
    const after = await t.targetBox(1);
    await t.check('selection card jump after drag lands on text', after?.inView, after || { mounted: false });
  },
};

export const jumpDuringDrag = {
  name: 'jump-during-drag',
  description: 'asks for the paragraph bookmark with the keyboard while the native thumb is held: the text is in view after release',
  precondition: all(loaded, target, stored(2)),
  async run(t) {
    const { page } = t;
    await t.startDrag();
    const heldBefore = await page.evaluate(() => __seekDump.held);
    await t.beginJumpProbe();
    await t.jump(0, true);
    await page.waitForTimeout(1500);
    const during = await t.targetBox(0),
      heldAfterActivation = await page.evaluate(() => __seekDump.held);
    await page.mouse.up();
    await t.waitSeekSettled();
    await t.waitLanding();
    await t.endJumpProbe('during-drag');
    const released = await t.targetBox(0);
    await t.check('paragraph jump requested during native drag lands on text', heldBefore && released?.inView, {
      heldBefore,
      heldAfterActivation,
      visibleWhileHeld: !!during?.inView,
      visibleAfterRelease: !!released?.inView,
      textTopAfterRelease: released?.top ?? null,
    });
  },
};
