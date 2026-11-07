// Ask in branch fixture QA. Real MV3 extension (content scripts + worker) over the synthetic
// ChatGPT-like page in branch-fixture.mjs. No ChatGPT requests: every chatgpt.com request is
// fulfilled locally, and the run fails if anything else is requested.
// Covers: mockup states 1–5, cancel via ×, Cancel and Esc, each failure type and its card's
// buttons, status reporting, pop-up blocked and a failed hand-over.
// Run: npm ci --prefix lab/harness && node lab/harness/branch-qa.mjs
// SHOTS=<dir> overrides the screenshot directory.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureHtml, ORIGINAL, BRANCH, QUOTE } from './branch-fixture.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots =
  process.env.SHOTS || path.join(repo, 'notes/runs/2026-11-07-ask-in-branch-28/screenshots');
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-branch-qa-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`],
  // Keep Chrome's pop-up blocker on, so the pop-up-blocked case is the real one.
  ignoreDefaultArgs: ['--disable-popup-blocking'],
});
await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
  origin: 'https://chatgpt.com',
});
const errors = [],
  foreign = [];
// Extra fixture parameters for pages loaded from now on (the new tab), e.g. "fail=newchat".
let extra = '';
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== 'chatgpt.com') {
    foreign.push(url.href);
    return route.abort();
  }
  for (const [k, v] of new URLSearchParams(extra)) url.searchParams.set(k, v);
  return route.fulfill({ contentType: 'text/html', body: fixtureHtml(url) });
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));
const settings = (value) =>
  worker.evaluate((butter) => chrome.storage.local.set({ butter }), {
    enabled: true,
    lang: 'en',
    layoutConsent: 'declined',
    ...value,
  });
await settings({});

const HOST = 'chatgpt-butter-branch';
// extension/branch/run.js TIMING: one menu step, and the verification window.
const TIMING_STEP = 4_000,
  TIMING_VERIFY = 15_000;
const inShadow = (page, selector) => page.locator(`${HOST} ${selector}`);
const open = async (query = '', width = 1280) => {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`https://chatgpt.com/c/${ORIGINAL}?${query}`);
  await page.locator('.ProseMirror').waitFor();
  return page;
};
const select = (page, selector = '#quote') =>
  page.locator(selector).evaluate((el) => {
    const r = document.createRange();
    r.selectNodeContents(el);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
  });
const rects = (page) =>
  page.evaluate((host) => {
    const box = (el) => el && el.getBoundingClientRect().toJSON();
    const nativeEl = document.querySelector('.native:not([hidden]) > div');
    const chip = document.querySelector(host)?.shadowRoot?.querySelector('.chip');
    const visible = chip && getComputedStyle(chip).display !== 'none';
    const css = (el, keys) => el && Object.fromEntries(keys.map((k) => [k, getComputedStyle(el)[k]]));
    const keys = ['height', 'borderTopLeftRadius', 'backgroundColor', 'boxShadow'];
    return {
      native: box(nativeEl),
      chip: visible ? box(chip) : null,
      nativeCss: css(nativeEl, keys),
      chipCss: visible ? css(chip, keys) : null,
      nativeFont: css(nativeEl?.querySelector('button'), ['fontSize']),
      chipFont: visible ? css(chip, ['fontSize']) : null,
    };
  }, HOST);
const settle = (page) => page.waitForTimeout(150);
const files = [];
const capture = async (page, state, width, theme) => {
  const file = `${state}-${width}-${theme}.png`;
  await page.screenshot({ path: path.join(shots, file), animations: 'disabled' });
  files.push(file);
};
const pass = (msg) => console.log(`PASS ${msg}`);
// Select the quote, open the box, type, press Enter; resolves with the new tab. `fixture` sets
// the new tab's extra fixture parameters.
const ask = async (page, { question = 'What does RAG mean here?', fixture = '', width } = {}) => {
  await select(page);
  await inShadow(page, '.chip').waitFor();
  await settle(page);
  await inShadow(page, '.chip').click();
  await inShadow(page, 'textarea').fill(question);
  extra = fixture;
  const next = context.waitForEvent('page');
  await inShadow(page, 'textarea').press('Enter');
  const dest = await next;
  extra = '';
  if (width) await dest.setViewportSize({ width, height: 800 });
  return dest;
};
const failures = async () =>
  (await worker.evaluate(() => chrome.storage.session.get('butterFailures'))).butterFailures || {};
const boxClosed = (page) =>
  page.waitForFunction(
    (host) => !document.querySelector(host)?.shadowRoot?.querySelector('.qpop'),
    HOST,
  );
const destState = (dest) =>
  dest.evaluate(() => ({
    path: decodeURIComponent(location.pathname),
    sent: fixture.sent.length,
    branched: fixture.branchedFrom.length,
    presses: fixture.morePresses,
    composer: document.querySelector('.ProseMirror').innerText.trim(),
    newChatItem: [...document.querySelectorAll('[role=menuitem]')].some(
      (el) => el.textContent === 'Branch in new chat',
    ),
  }));
const CAUSES = {
  more: 'Couldn’t find the latest reply’s “More actions” button. Nothing was sent.',
  branch: 'Couldn’t find ChatGPT’s “Branch conversation” menu. Nothing was sent.',
  newchat: 'Couldn’t find ChatGPT’s “Branch in new chat” menu. Nothing was sent.',
  identity: 'The tab didn’t move to a new chat. Nothing was sent.',
  load: 'This chat didn’t finish loading. Nothing was sent.',
};

try {
  // ---- 1 · Button: aligned with ChatGPT's own, styled like it, following it.
  for (const theme of ['light', 'dark']) {
    const page = await open(`theme=${theme}`);
    await select(page);
    await inShadow(page, '.chip').waitFor();
    await settle(page);
    let r = await rects(page);
    assert.equal(Math.round(r.chip.left - r.native.right), 4, 'chip sits 4 px right of native');
    assert.equal(Math.round(r.chip.top), Math.round(r.native.top), 'top edges aligned');
    assert.deepEqual(r.chipCss, r.nativeCss, 'same height, radius, background and shadow');
    assert.deepEqual(r.chipFont, r.nativeFont, 'same font size');
    // ChatGPT's button moves: Butter's follows.
    await page.evaluate(() => {
      fixture.nativeShift = 40;
      fixture.placeNative();
    });
    await settle(page);
    r = await rects(page);
    assert.equal(Math.round(r.chip.left - r.native.right), 4, 'chip follows a moved native');
    // ChatGPT's button hides: Butter's hides; it comes back with it.
    await page.evaluate(() => {
      fixture.nativeHidden = true;
      fixture.placeNative();
    });
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'chip hidden with native');
    await page.evaluate(() => {
      fixture.nativeHidden = false;
      fixture.placeNative();
    });
    await settle(page);
    assert.notEqual((await rects(page)).chip, null, 'chip back with native');
    // Not in a user message, and gone when the selection collapses.
    await select(page, '[data-message-author-role="user"]');
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'no chip on a user message');
    await page.evaluate(() => getSelection().removeAllRanges());
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'no chip without a selection');
    // Settings key off: no button, applied live; on again: back.
    await settings({ opts: { branch: false } });
    await select(page);
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'no chip when the setting is off');
    await settings({});
    await page.evaluate(() => getSelection().removeAllRanges());
    await select(page);
    await inShadow(page, '.chip').waitFor();
    await page.close();
    pass(`button ${theme}: 4 px gap, top aligned, mirrored style, follows/hides, setting`);
  }

  // ---- 2 · Question box: under the buttons, left-aligned, flips above, keys and draft.
  {
    const page = await open();
    await select(page);
    await inShadow(page, '.chip').waitFor();
    await settle(page);
    const nativeBefore = (await rects(page)).native;
    await inShadow(page, '.chip').click();
    const box = inShadow(page, '.qpop');
    await box.waitFor();
    await settle(page);
    const geo = () =>
      page.evaluate((host) => {
        const root = document.querySelector(host).shadowRoot;
        const r = (el) => el.getBoundingClientRect().toJSON();
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('#quote'));
        return {
          box: r(root.querySelector('.qpop')),
          chip: r(root.querySelector('.chip')),
          native: r(document.querySelector('.native > div')),
          sel: range.getBoundingClientRect().toJSON(),
          quoteLines: Math.round(
            root.querySelector('.q').getBoundingClientRect().height /
              parseFloat(getComputedStyle(root.querySelector('.q')).lineHeight),
          ),
          focused: root.activeElement?.tagName,
          pageSelection: getSelection().toString(),
          highlighted: CSS.highlights.has('butter-branch-quote'),
        };
      }, HOST);
    let g = await geo();
    console.log(`INFO page selection while the box is open: ${JSON.stringify(g.pageSelection)}`);
    assert.equal(Math.round(g.box.left), Math.round(nativeBefore.left), 'left-aligned with buttons');
    assert.equal(Math.round(g.box.top), Math.round(g.chip.bottom + 8), 'directly under buttons');
    assert.ok(g.box.top >= g.sel.bottom, 'does not cover the selection');
    assert.equal(g.quoteLines, 1, 'quote on one line');
    assert.equal(g.focused, 'TEXTAREA', 'question field focused');
    assert.ok(g.highlighted, 'quote stays highlighted');
    const input = inShadow(page, 'textarea');
    await input.type('What is RAG?');
    await input.press('Shift+Enter');
    await input.type('Briefly.');
    assert.equal(await input.inputValue(), 'What is RAG?\nBriefly.', 'Shift+Enter adds a line');
    await input.press('Escape');
    assert.equal(await box.count(), 0, 'Esc closes');
    assert.equal(await page.evaluate(() => getSelection().toString()), QUOTE, 'Esc restores the selection');
    await inShadow(page, '.chip').waitFor();
    await settle(page);
    await inShadow(page, '.chip').click();
    assert.equal(await input.inputValue(), 'What is RAG?\nBriefly.', 'draft kept after Esc');
    await page.mouse.click(1200, 400);
    assert.equal(await box.count(), 0, 'click outside closes');
    assert.equal(await page.evaluate(() => fixture.sent.length), 0, 'nothing sent here');
    await page.close();
    // Not enough room below the selection: the box flips above it.
    const low = await open('pad=470');
    await select(low);
    await inShadow(low, '.chip').waitFor();
    await settle(low);
    await inShadow(low, '.chip').click();
    await inShadow(low, '.qpop').waitFor();
    await settle(low);
    const flip = await low.evaluate((host) => {
      const root = document.querySelector(host).shadowRoot;
      const range = document.createRange();
      range.selectNodeContents(document.querySelector('#quote'));
      return {
        box: root.querySelector('.qpop').getBoundingClientRect().toJSON(),
        sel: range.getBoundingClientRect().toJSON(),
      };
    }, HOST);
    assert.ok(flip.box.bottom <= flip.sel.top - 8 + 0.5, 'flipped above the selection');
    assert.ok(flip.box.top >= 16, 'inside the viewport');
    await low.close();
    pass('question box: aligned under the buttons, one-line quote, keys, draft kept, flips above');
  }

  // ---- 3, 4 · New tab: overlay while branching, then verified branch, sent, line above composer.
  {
    const page = await open('slow=600&land=600');
    await select(page);
    await inShadow(page, '.chip').waitFor();
    await settle(page);
    await inShadow(page, '.chip').click();
    await inShadow(page, 'textarea').fill('What does RAG mean here?');
    const before = await page.evaluate(() => ({
      url: location.href,
      draft: document.querySelector('.ProseMirror').innerText,
      scroll: document.querySelector('.thread-scroll-container').scrollTop,
      title: document.title,
    }));
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await inShadow(dest, '.card').waitFor();
    assert.match(await inShadow(dest, '.card').innerText(), /Creating branch…[\s\S]*What does RAG mean here\?/);
    assert.equal(await dest.title(), 'Creating branch…', 'tab title while working');
    assert.ok(!dest.url().includes('butter-branch'), 'job id dropped from the URL');
    await inShadow(dest, '.line').waitFor();
    assert.equal(await inShadow(dest, '.card').count(), 0, 'overlay gone');
    assert.equal(
      await inShadow(dest, '.line .t').innerText(),
      'Branched from “Explain Corpus Meaning” · original unchanged',
    );
    const sent = await dest.evaluate(() => fixture.sent);
    assert.deepEqual(
      sent.map((m) => ({ ...m, text: m.text.replace(/\n{3,}/g, '\n\n').trim() })),
      [{ conv: BRANCH, text: `> ${QUOTE}\n\nWhat does RAG mean here?` }],
      'quote and question sent once, in the verified branch',
    );
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), ['m-latest'], 'latest reply');
    assert.equal(await dest.evaluate(() => fixture.workClicks), 0, 'never Work mode');
    assert.equal(await dest.title(), 'Branch · Explain Corpus Meaning', 'title restored');
    // Line placement: 8 px above the composer, spanning it.
    const place = await dest.evaluate((host) => {
      const line = document.querySelector(host).shadowRoot.querySelector('.line');
      return {
        line: line.getBoundingClientRect().toJSON(),
        composer: document.querySelector('.composer').getBoundingClientRect().toJSON(),
      };
    }, HOST);
    assert.equal(Math.round(place.composer.top - place.line.bottom), 8, 'line 8 px above composer');
    assert.equal(Math.round(place.line.left), Math.round(place.composer.left));
    assert.equal(Math.round(place.line.width), Math.round(place.composer.width));
    // The original tab's box closes once the new tab has claimed the job.
    await boxClosed(page);
    // Original tab unchanged.
    const after = await page.evaluate(() => ({
      url: location.href,
      draft: document.querySelector('.ProseMirror').innerText,
      scroll: document.querySelector('.thread-scroll-container').scrollTop,
      title: document.title,
    }));
    assert.deepEqual(after, before, 'original tab unchanged');
    assert.equal(await page.evaluate(() => fixture.sent.length), 0, 'nothing sent in the original');
    // The job was claimed once and is gone; reopening the link does nothing.
    const rows = await worker.evaluate(() => chrome.storage.session.get(null));
    assert.deepEqual(Object.keys(rows).filter((k) => k.startsWith('butterBranch.')), []);
    // The line stays after Butter's send and disappears after the user's own next send.
    await settle(dest);
    assert.equal(await inShadow(dest, '.line').count(), 1, 'line still shown');
    await dest.locator('.ProseMirror').click();
    await dest.keyboard.type('And fine-tuning?');
    await dest.locator('.send').click();
    await settle(dest);
    assert.equal(await inShadow(dest, '.line').count(), 0, 'line gone after the next send');
    await dest.close();
    await page.close();
    pass('new tab: overlay + title, latest reply branched, identity verified, sent once, line, original unchanged, job gone');
  }

  // ---- Cancel: ×, Cancel and Esc stop at once; no further menu press, nothing sent.
  for (const how of ['×', 'Cancel', 'Esc']) {
    const page = await open('slow=1500');
    const dest = await ask(page);
    await inShadow(dest, '.card').waitFor();
    if (how === '×') await inShadow(dest, '.card .x').click();
    else if (how === 'Cancel') await inShadow(dest, '.card .btn').click();
    else await dest.keyboard.press('Escape');
    assert.equal(await inShadow(dest, '.card').count(), 0, `${how}: card gone at once`);
    assert.equal(await inShadow(dest, '.scrim').count(), 0, `${how}: cover gone at once`);
    const atCancel = await destState(dest);
    await dest.waitForTimeout(TIMING_STEP + 500);
    const later = await destState(dest);
    assert.equal(later.presses, atCancel.presses, `${how}: a menu press after cancel`);
    assert.deepEqual(
      { ...later, presses: 0 },
      { path: `/c/${ORIGINAL}`, sent: 0, branched: 0, presses: 0, composer: '', newChatItem: false },
      `${how}: tab left on the original, nothing sent`,
    );
    assert.equal(await dest.title(), 'Explain Corpus Meaning', `${how}: title restored`);
    assert.equal(await inShadow(dest, '.line').count(), 0);
    assert.equal(await page.evaluate(() => fixture.sent.length), 0);
    await dest.close();
    await page.close();
  }
  assert.deepEqual(await failures(), {}, 'a cancel is not a failure');
  pass('cancel via ×, Cancel and Esc: card gone at once, no further menu press, nothing sent');

  // ---- Failure types: card per mockup state 5, only after the re-check, reported to status.
  // Each case also exercises one of the card's controls.
  for (const [fail, control] of [
    ['more', 'Esc'],
    ['branch', 'Close tab'],
    ['load', '×'],
    ['identity', 'Copy question'],
    ['newchat', 'Try again'],
  ]) {
    const page = await open();
    const dest = await ask(page, { fixture: `fail=${fail}` });
    await inShadow(dest, '.card').waitFor();
    const shownAt = Date.now();
    await inShadow(dest, '.card.err').waitFor({ timeout: 40_000 });
    assert.ok(Date.now() - shownAt >= 2_900, `${fail}: failure shown before the re-check`);
    const card = inShadow(dest, '.card.err');
    assert.equal(await card.locator('h3').innerText(), 'Couldn’t create branch');
    assert.equal(await card.locator('p').innerText(), CAUSES[fail], `${fail}: cause sentence`);
    assert.equal(await card.locator('.quoted').innerText(), 'What does RAG mean here?');
    assert.deepEqual(await card.locator('.btns .btn').allInnerTexts(), [
      'Close tab',
      'Copy question',
      'Try again',
    ]);
    assert.equal(await inShadow(dest, '.scrim').count(), 1, 'failure card has the cover');
    const state = await destState(dest);
    assert.equal(state.sent, 0, `${fail}: nothing sent`);
    assert.equal(state.composer, '', `${fail}: nothing typed`);
    assert.equal(state.path, `/c/${ORIGINAL}`);
    assert.equal(await page.evaluate(() => fixture.sent.length), 0);
    assert.deepEqual(await failures(), { branch: { branch: true } }, `${fail}: reported`);
    if (control === 'Esc' || control === '×') {
      if (control === 'Esc') await dest.keyboard.press('Escape');
      else await card.locator('.x').click();
      assert.equal(await inShadow(dest, '.card').count(), 0, `${control} closes the card`);
      assert.equal(await inShadow(dest, '.scrim').count(), 0, `${control} closes the cover`);
      assert.equal(dest.isClosed(), false, `${control} keeps the tab`);
      await dest.close();
    } else if (control === 'Close tab') {
      const closed = dest.waitForEvent('close');
      await card.getByText('Close tab').click();
      await closed;
    } else if (control === 'Copy question') {
      await card.getByText('Copy question').click();
      await card.getByText('Copied').waitFor();
      assert.equal(
        await dest.evaluate(() => navigator.clipboard.readText()),
        `> ${QUOTE}\n\nWhat does RAG mean here?`,
        'copies the formatted message',
      );
      await dest.close();
    } else {
      // ChatGPT's menu is back: Try again makes the branch, and the status failure clears.
      await dest.evaluate(() => (fixture.noNewChat = false));
      await card.getByText('Try again').click();
      await inShadow(dest, '.card:not(.err)').waitFor();
      await inShadow(dest, '.line').waitFor({ timeout: 20_000 });
      assert.deepEqual(
        (await dest.evaluate(() => fixture.sent)).map((m) => m.conv),
        [BRANCH],
        'sent once, in the branch',
      );
      assert.deepEqual(await failures(), {}, 'a later successful branch clears the failure');
      await dest.close();
    }
    await page.close();
    pass(`failure ${fail}: card after the re-check, cause shown, nothing sent, reported; ${control}`);
  }

  // ---- A branch that lands during the re-check is not a failure.
  {
    const page = await open();
    const dest = await ask(page, { fixture: `land=${TIMING_VERIFY + 1_000}` });
    let sawFailure = false;
    while (!(await inShadow(dest, '.line').count())) {
      sawFailure ||= (await inShadow(dest, '.card.err').count()) > 0;
      await dest.waitForTimeout(150);
    }
    assert.equal(sawFailure, false, 'failure card shown although the branch landed');
    assert.deepEqual((await dest.evaluate(() => fixture.sent)).map((m) => m.conv), [BRANCH]);
    await dest.close();
    await page.close();
    pass('branch landing during the re-check: ready, no failure card');
  }

  // ---- Pop-up blocked: no new tab; the box keeps the question and says why.
  {
    const page = await open();
    await select(page);
    await inShadow(page, '.chip').waitFor();
    await settle(page);
    await inShadow(page, '.chip').click();
    await inShadow(page, 'textarea').fill('What does RAG mean here?');
    const pages = context.pages().length;
    // Chrome's pop-up blocker doesn't stop window.open from an extension's content script, even
    // without a user gesture (checked with this harness). So the blocked case is simulated where
    // Butter calls it: window.open returns null in Butter's isolated world, as when blocked.
    const cdp = await context.newCDPSession(page);
    const worlds = [];
    cdp.on('Runtime.executionContextCreated', ({ context: c }) => worlds.push(c));
    await cdp.send('Runtime.enable');
    const butterWorld = worlds.find(
      (c) => c.auxData?.type === 'isolated' && c.origin.startsWith('chrome-extension://'),
    );
    assert.ok(butterWorld, "Butter's isolated world");
    const block = (on) =>
      cdp.send('Runtime.evaluate', {
        contextId: butterWorld.id,
        expression: on
          ? 'window.__open = window.open; window.open = () => null;'
          : 'window.open = window.__open;',
      });
    await block(true);
    await inShadow(page, 'textarea').press('Enter');
    await page.waitForTimeout(1_000);
    assert.equal(context.pages().length, pages, 'no new tab opened');
    assert.equal(await inShadow(page, 'textarea').inputValue(), 'What does RAG mean here?');
    assert.equal(
      await inShadow(page, '.foot span').first().innerText(),
      'Chrome blocked the new tab. Allow pop-ups for chatgpt.com, then try again.',
    );
    assert.equal(
      await inShadow(page, '.foot .reason').evaluate((el) => el.scrollWidth <= el.clientWidth),
      true,
      'the whole reason shows, not cut off',
    );
    const rows = await worker.evaluate(() => chrome.storage.session.get(null));
    assert.deepEqual(Object.keys(rows).filter((k) => k.startsWith('butterBranch.')), [], 'job dropped');
    await settle(page);
    await capture(page, 'blocked', 1280, 'light');
    // The question box still works once pop-ups are allowed.
    await block(false);
    await cdp.detach();
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await inShadow(dest, '.line').waitFor({ timeout: 20_000 });
    await boxClosed(page);
    await dest.close();
    await page.close();
    pass('pop-up blocked: no tab, question kept with the reason; a later Enter works');
  }

  // ---- Failed hand-over (the worker can't store the job): the new tab closes, the question stays.
  {
    await worker.evaluate(() => {
      const area = chrome.storage.session,
        set = area.set;
      globalThis.__set = set;
      area.set = (items) =>
        Object.keys(items).some((k) => k.startsWith('butterBranch.'))
          ? Promise.reject(new Error('fixture: storage refused'))
          : set.call(area, items);
    });
    const page = await open();
    const dest = await ask(page);
    await dest.waitForEvent('close', { timeout: 5_000 }).catch(() => {});
    assert.equal(dest.isClosed(), true, 'the empty new tab is closed');
    await inShadow(page, '.foot .reason').waitFor();
    assert.equal(
      await inShadow(page, '.foot .reason').innerText(),
      'Couldn’t hand your question to the new tab. Try again.',
    );
    assert.equal(await inShadow(page, 'textarea').inputValue(), 'What does RAG mean here?');
    await worker.evaluate(() => (chrome.storage.session.set = globalThis.__set));
    await page.close();
    pass('failed hand-over: new tab closed, question kept in the box with the reason');
  }

  // ---- Screenshots of mockup states 1–4, light and dark, 1280 and 800 px.
  for (const theme of ['light', 'dark'])
    for (const width of [1280, 800]) {
      const page = await open(`theme=${theme}&slow=1500&hold=60000`, width);
      await select(page);
      await inShadow(page, '.chip').waitFor();
      await page.locator('#quote').hover();
      await settle(page);
      await capture(page, 'button', width, theme);
      await inShadow(page, '.chip').click();
      await inShadow(page, 'textarea').fill('What does RAG mean here? How is it different from fine-tuning?');
      await settle(page);
      await capture(page, 'question', width, theme);
      const next = context.waitForEvent('page');
      await inShadow(page, 'textarea').press('Enter');
      const dest = await next;
      await dest.setViewportSize({ width, height: 800 });
      await inShadow(dest, '.card').waitFor();
      await settle(dest);
      await capture(dest, 'working', width, theme);
      await inShadow(dest, '.line').waitFor();
      await settle(dest);
      await capture(dest, 'ready', width, theme);
      await dest.close();
      await page.close();
      pass(`screenshots ${width}px ${theme}`);
    }

  // ---- State 5 screenshots: light and dark, 1280 and 800 px (the mockup's cause).
  for (const theme of ['light', 'dark'])
    for (const width of [1280, 800]) {
      const page = await open(`theme=${theme}`, width);
      const dest = await ask(page, {
        question: 'What does RAG mean here? How is it different from fine-tuning?',
        fixture: 'fail=newchat',
        width,
      });
      await inShadow(dest, '.card.err').waitFor({ timeout: 40_000 });
      await dest.locator('body').click({ position: { x: 5, y: 5 } }); // no focus ring in the shot
      await settle(dest);
      await capture(dest, 'failure', width, theme);
      await dest.close();
      await page.close();
    }
  pass('failure screenshots 1280/800 light/dark');

  // ---- Simplified Chinese (the mockup's language) and reduced motion.
  {
    await settings({ lang: 'zh' });
    const page = await open('slow=1500&hold=60000');
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await select(page);
    await inShadow(page, '.chip').waitFor();
    assert.equal(await inShadow(page, '.chip').innerText(), '在分支中问');
    await inShadow(page, '.chip').click();
    await inShadow(page, 'textarea').fill('这里的 RAG 具体指什么？和微调有什么区别？');
    assert.match(await inShadow(page, '.foot').innerText(), /在新标签页打开，这个对话不受影响[\s\S]*Esc[\s\S]*关闭/);
    await settle(page);
    await capture(page, 'question', 1280, 'light-zh');
    const next = context.waitForEvent('page');
    await inShadow(page, 'textarea').press('Enter');
    const dest = await next;
    await dest.emulateMedia({ reducedMotion: 'reduce' });
    await inShadow(dest, '.card').waitFor();
    assert.match(await inShadow(dest, '.card h3').innerText(), /正在创建分支…/);
    assert.equal(await dest.title(), '正在创建分支…');
    assert.equal(
      await inShadow(dest, '.spinner').evaluate((el) => getComputedStyle(el).animationName),
      'none',
      'no spinning with reduced motion',
    );
    await settle(dest);
    await capture(dest, 'working', 1280, 'light-zh');
    await inShadow(dest, '.line').waitFor();
    assert.equal(await inShadow(dest, '.line .t').innerText(), '分支自《Explain Corpus Meaning》· 原对话不变');
    await capture(dest, 'ready', 1280, 'light-zh');
    // ChatGPT saves the branch after the first send (local id → saved id): the line stays.
    await dest.evaluate(() => history.pushState({}, '', '/c/0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f01'));
    await dest.waitForTimeout(500);
    assert.equal(await inShadow(dest, '.line').count(), 1, 'line kept when the branch is saved');
    // Going to another chat (or a new one) in this tab: the line goes.
    await dest.evaluate(() => history.pushState({}, '', '/'));
    await dest.waitForTimeout(500);
    assert.equal(await inShadow(dest, '.line').count(), 0, 'line gone on another route');
    await dest.close();
    await page.close();
    // State 5 in Chinese, the mockup's own copy.
    const zh = await open();
    const failed = await ask(zh, {
      question: '这里的 RAG 具体指什么？和微调有什么区别？',
      fixture: 'fail=newchat',
    });
    await inShadow(failed, '.card.err').waitFor({ timeout: 40_000 });
    const card = inShadow(failed, '.card.err');
    assert.equal(await card.locator('h3').innerText(), '没能创建分支');
    assert.equal(
      await card.locator('p').innerText(),
      '找不到 ChatGPT 的 “Branch in new chat” 菜单。没有发送任何内容。',
    );
    assert.deepEqual(await card.locator('.btns .btn').allInnerTexts(), ['关闭标签页', '复制问题', '重试']);
    await failed.locator('body').click({ position: { x: 5, y: 5 } });
    await settle(failed);
    await capture(failed, 'failure', 1280, 'light-zh');
    await failed.close();
    await zh.close();
    await settings({});
    pass('Simplified Chinese strings and title; spinner still under reduced motion; zh failure card');
  }
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
assert.deepEqual(errors, [], 'page errors');
assert.deepEqual(foreign, [], 'non-ChatGPT requests');
pass(`${files.length} screenshots in ${path.relative(repo, shots)}; no page errors; no requests left the fixture`);
