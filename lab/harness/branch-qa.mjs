// Ask in branch fixture QA. Real MV3 extension (content scripts + worker) over the synthetic
// ChatGPT-like page in branch-fixture.mjs. No ChatGPT requests: every chatgpt.com request is
// fulfilled locally, and the run fails if anything else is requested.
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
  process.env.SHOTS || path.join(repo, 'notes/runs/2026-11-07-ask-in-branch-27/screenshots');
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-branch-qa-'));
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  channel: 'chromium',
  viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`],
});
const errors = [],
  foreign = [];
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  if (url.hostname !== 'chatgpt.com') {
    foreign.push(url.href);
    return route.abort();
  }
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
    // Settings key off: a shown button leaves at once, with no reload; none appears; on again: back.
    await select(page);
    await inShadow(page, '.chip').waitFor();
    await settings({ opts: { branch: false } });
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'shown chip leaves live when the setting turns off');
    await page.evaluate(() => getSelection().removeAllRanges());
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
    await settings({});
    pass('Simplified Chinese strings and title; spinner still under reduced motion');
  }
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
assert.deepEqual(errors, [], 'page errors');
assert.deepEqual(foreign, [], 'non-ChatGPT requests');
pass(`${files.length} screenshots in ${path.relative(repo, shots)}; no page errors; no requests left the fixture`);
