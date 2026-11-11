// Ask in branch fixture QA. Real MV3 extension (content scripts + worker) over the synthetic
// ChatGPT-like page in branch-fixture.mjs. No ChatGPT requests: every chatgpt.com request is
// fulfilled locally, and the run fails if anything else is requested.
// Covers: mockup states 1–5, cancel via ×, Cancel and Esc, each failure type and its card's
// buttons, status reporting, pop-up blocked and a failed hand-over, and the ready and unsure lines
// taking ChatGPT's disclaimer row (covering it until they go) and the ready line's hiding when the
// reply appears.
// Run: npm ci && node lab/harness/branch-qa.mjs
// SHOTS=<dir> overrides the screenshot directory.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureHtml, ORIGINAL, BRANCH, QUOTE, LATEST, MATH } from './branch-fixture.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const shots =
  process.env.SHOTS || path.join(repo, 'notes/runs/2026-11-07-ask-in-branch-29/screenshots');
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
// Ask in branch's cell in the selection pill (selection/pill.js, #77).
const PILL = 'chatgpt-butter-pill';
const chipOf = (page) => page.locator(`${PILL} button[data-cell="branch"]`);
const open = async (query = '', width = 1280, route = `/c/${ORIGINAL}`) => {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: 800 });
  await page.goto(`https://chatgpt.com${route}?${query}`);
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
// `chip`: the pill's box while it shows (null when hidden), `cell`: Ask in branch's cell in it.
const rects = (page) =>
  page.evaluate((host) => {
    const box = (el) => el && el.getBoundingClientRect().toJSON();
    const nativeEl = document.querySelector('.native:not([hidden]) > div');
    const pill = document.querySelector(host)?.shadowRoot?.querySelector('.pill');
    const cell = pill?.querySelector('[data-cell="branch"]');
    const visible = !!cell && getComputedStyle(pill).display !== 'none';
    const css = (el, keys) => el && Object.fromEntries(keys.map((k) => [k, getComputedStyle(el)[k]]));
    const keys = ['borderTopLeftRadius', 'backgroundColor', 'boxShadow'];
    return {
      native: box(nativeEl),
      chip: visible ? box(pill) : null,
      cell: visible ? box(cell) : null,
      cellBg: visible ? getComputedStyle(cell).backgroundColor : null,
      nativeCss: css(nativeEl, keys),
      chipCss: visible ? css(pill, keys) : null,
      name: cell?.getAttribute('aria-label') ?? null,
      icon: !!cell?.querySelector('svg') && !cell.textContent.trim(),
    };
  }, PILL);
const settle = (page) => page.waitForTimeout(150);
// The ready line, ChatGPT's disclaimer text (null when the fixture has none) and the composer.
const lineGeometry = (page) =>
  page.evaluate((host) => {
    const box = (el) => el?.getBoundingClientRect().toJSON() || null;
    return {
      line: box(document.querySelector(host)?.shadowRoot?.querySelector('.line')),
      disclaimer: box(document.querySelector('.disclaimer > div')),
      composer: box(document.querySelector('.composer')),
    };
  }, HOST);
// The line's box equals the disclaimer's, within 1 px.
const assertCovers = (g, at) => {
  assert.ok(g.disclaimer && g.line, `${at}: line and disclaimer ${JSON.stringify(g)}`);
  for (const k of ['left', 'top', 'width', 'height'])
    assert.ok(Math.abs(g.line[k] - g.disclaimer[k]) <= 1, `${at}: line ${k} ${JSON.stringify(g)}`);
};
// What the line looks like over the disclaimer, and what a click at the disclaimer's centre hits.
const lineLook = (page) =>
  page.evaluate((host) => {
    const line = document.querySelector(host)?.shadowRoot?.querySelector('.line');
    const disc = document.querySelector('.disclaimer > div');
    const r = disc.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const css = (el) => el && getComputedStyle(el);
    const parts = line && [line.querySelector('svg'), line.querySelector('.xs')].map((el) => el.getBoundingClientRect());
    return {
      hit: hit === document.querySelector(host) ? 'butter' : disc.contains(hit) || hit?.contains(disc) ? 'disclaimer' : hit?.className,
      line: line && {
        row: line.classList.contains('row'),
        background: css(line).backgroundColor,
        fontSize: css(line).fontSize,
        lineHeight: css(line).lineHeight,
        color: css(line).color,
        icon: css(line.querySelector('svg')).color,
        iconSize: parts[0].width,
        xSize: parts[1].width,
        gap: css(line).columnGap,
        text: line.querySelector('.t').textContent,
        title: line.title,
        oneRow: line.querySelector('.t').scrollHeight <= line.querySelector('.t').clientHeight + 1,
        truncated: line.querySelector('.t').scrollWidth > line.querySelector('.t').clientWidth,
        // The icon, text and × as one group: its centre against the line's.
        offCentre: (parts[0].left + parts[1].right) / 2 - (line.getBoundingClientRect().left + line.getBoundingClientRect().right) / 2,
        err: css(line).getPropertyValue('--err').trim(),
      },
      disclaimer: { fontSize: css(disc).fontSize, lineHeight: css(disc).lineHeight, color: css(disc).color },
      pageBackground: css(document.body).backgroundColor,
    };
  }, HOST);
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
  await chipOf(page).waitFor();
  await settle(page);
  await chipOf(page).click();
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
    await chipOf(page).waitFor();
    await settle(page);
    let r = await rects(page);
    assert.equal(Math.round(r.chip.left - r.native.right), 4, 'chip sits 4 px right of native');
    assert.equal(Math.round(r.chip.top), Math.round(r.native.top), 'top edges aligned');
    assert.equal(r.chip.height, 30, 'the pill is 30 px high');
    assert.equal(r.cell.width, r.chip.width === 30 ? 30 : 32, 'an icon cell: 32 px, or 30 alone');
    assert.deepEqual(r.chipCss, r.nativeCss, 'same radius, background and shadow as ChatGPT’s');
    assert.equal(r.icon, true, 'icon only');
    assert.equal(r.name, 'Ask in branch', 'the label is its accessible name');
    // ChatGPT's button hovered: it tints itself, square; Butter's keeps the resting look.
    const resting = r.chipCss;
    await page.hover('.native button');
    await settle(page);
    const tinted = await page.$eval('.native button', (b) => getComputedStyle(b).backgroundColor);
    assert.equal(tinted, 'rgba(255, 255, 255, 0.1)', 'fixture: native button shows its hover tint');
    assert.deepEqual((await rects(page)).chipCss, resting, 'native hovered: chip keeps its resting look');
    if (theme === 'light') await capture(page, 'button-native-hover', 1280, theme);
    // Butter's own hover: a lighter background, same shape and shadow (mockup state 1).
    await chipOf(page).hover();
    await settle(page);
    const own = await rects(page);
    assert.notEqual(own.cellBg, r.cellBg, 'cell hover changes its background');
    assert.deepEqual(own.chipCss, resting, 'cell hover keeps the pill’s radius, background and shadow');
    // Its label shows 8 px below the pill after 300 ms of hover.
    await page.waitForTimeout(350);
    const label = await page.evaluate((host) => {
      const root = document.querySelector(host).shadowRoot,
        tip = root.querySelector('.tip');
      return getComputedStyle(tip).display === 'none'
        ? null
        : { text: tip.textContent, top: tip.getBoundingClientRect().top, pill: root.querySelector('.pill').getBoundingClientRect().bottom };
    }, PILL);
    assert.equal(label?.text, 'Ask in branch', 'hover label');
    assert.equal(Math.round(label.top - label.pill), 8, 'label 8 px below the pill');
    await page.mouse.move(5, 790);
    await settle(page);
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
    await chipOf(page).waitFor();
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
    await chipOf(page).waitFor();
    await page.close();
    pass(`button ${theme}: 4 px gap, top aligned, mirrored style, follows/hides, setting`);
  }

  // ---- 2 · Question box: under the buttons, left-aligned, flips above, keys and draft.
  {
    const page = await open();
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    const { native: nativeBefore, chip: chipBefore } = await rects(page);
    await chipOf(page).click();
    const box = inShadow(page, '.qpop');
    await box.waitFor();
    const boxAtOpen = await box.evaluate((el) => el.getBoundingClientRect().toJSON());
    await settle(page);
    const geo = () =>
      page.evaluate((host) => {
        const root = document.querySelector(host).shadowRoot;
        const r = (el) => el.getBoundingClientRect().toJSON();
        const range = document.createRange();
        range.selectNodeContents(document.querySelector('#quote'));
        return {
          box: r(root.querySelector('.qpop')),
          chipShown:
            getComputedStyle(document.querySelector('chatgpt-butter-pill').shadowRoot.querySelector('.pill')).display !==
            'none',
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
    // While the box is open, Butter's button is hidden; the box stays where the buttons were.
    assert.equal(g.chipShown, false, 'button hidden while the box is open');
    assert.equal(Math.round(g.box.left), Math.round(nativeBefore.left), 'left-aligned with buttons');
    assert.equal(Math.round(g.box.top), Math.round(chipBefore.bottom + 8), 'directly under buttons');
    assert.deepEqual(
      [g.box.left, g.box.top],
      [boxAtOpen.left, boxAtOpen.top],
      'box does not move once the button is hidden',
    );
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
    await chipOf(page).waitFor({ timeout: 3000 });
    await settle(page);
    assert.notEqual((await rects(page)).chip, null, 'button back after Esc, with the selection');
    await chipOf(page).click();
    assert.equal(await input.inputValue(), 'What is RAG?\nBriefly.', 'draft kept after Esc');
    await settle(page);
    assert.equal((await rects(page)).chip, null, 'button hidden again with the box reopened');
    await page.mouse.click(1200, 400);
    assert.equal(await box.count(), 0, 'click outside closes');
    assert.equal(await page.evaluate(() => fixture.sent.length), 0, 'nothing sent here');
    // Keyboard: the cell takes focus and Enter opens the box at the same place, as a pointer does.
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).focus();
    await page.keyboard.press('Enter');
    await box.waitFor();
    await settle(page);
    const byKey = await geo();
    assert.equal(Math.round(byKey.box.left), Math.round(nativeBefore.left), 'keyboard: left-aligned with buttons');
    assert.equal(Math.round(byKey.box.top), Math.round(chipBefore.bottom + 8), 'keyboard: directly under buttons');
    assert.equal(byKey.focused, 'TEXTAREA', 'keyboard: question field focused');
    await inShadow(page, 'textarea').press('Escape');
    await page.close();
    // Not enough room below the selection: the box flips above it.
    const low = await open('pad=470');
    await select(low);
    await chipOf(low).waitFor();
    await settle(low);
    await chipOf(low).click();
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
    pass('question box: opened by pointer and by keyboard, button hidden while open, aligned under the buttons, one-line quote, keys, draft kept, button back after Esc, flips above');
  }

  // ---- Formulas: a selection across text and KaTeX formulas, ending partway into one, quotes
  // each formula whole as its LaTeX source; the box shows that quote and Enter sends it.
  {
    const page = await open('math=1');
    await page.evaluate(() => {
      const start = document.querySelector('#math-before').firstChild;
      const glyph = document.querySelectorAll('#math-after .katex-html .mord')[1].firstChild;
      const r = document.createRange();
      r.setStart(start, 9); // "descent with step"
      r.setEnd(glyph, 1); // "O(" of O(1/k): partway into the formula
      getSelection().removeAllRanges();
      getSelection().addRange(r);
    });
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
    console.log(`INFO formula message as sent: ${JSON.stringify(sent[0])}`);
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
  }

  // ---- 3, 4 · New tab: overlay while branching, then verified branch, sent, line above composer.
  {
    const page = await open('slow=600&land=600');
    await select(page);
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).click();
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
    // Line placement: on ChatGPT's disclaimer, checked in full below. The line appears as the sent
    // composer shrinks; let one 200 ms placement tick follow it.
    await dest.waitForTimeout(250);
    assertCovers(await lineGeometry(dest), 'new tab');
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
    assert.equal((await rects(page)).chip, null, 'button stays hidden while the box stays open');
    const rows = await worker.evaluate(() => chrome.storage.session.get(null));
    assert.deepEqual(Object.keys(rows).filter((k) => k.startsWith('butterBranch.')), []);
    // The line stays after Butter's send and disappears after the user's own next send.
    await settle(dest);
    assert.equal(await inShadow(dest, '.line').count(), 1, 'line still shown');
    await dest.locator('.ProseMirror').click();
    await dest.keyboard.type('And fine-tuning?');
    await dest.locator('.send:not(.stop)').click();
    await settle(dest);
    assert.equal(await inShadow(dest, '.line').count(), 0, 'line gone after the next send');
    await dest.close();
    await page.close();
    pass('new tab: overlay + title, latest reply branched, identity verified, sent once, line, original unchanged, job gone');
  }

  // ---- Ready and unsure lines and ChatGPT's disclaimer (on the composer's top edge, as live): the
  // line takes the disclaimer's row, covering it with the page's background and its type; × brings
  // the disclaimer back. Unsure: ChatGPT's Send button stays disabled past Butter's 3 s wait.
  // With no disclaimer, the line sits in its own row 8 px above the composer.
  const UNSURE = 'Not sent: couldn’t confirm this is a new branch.';
  const READY = 'Branched from “Explain Corpus Meaning” · original unchanged';
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
        console.log(`INFO ${at}: ${JSON.stringify({ ...l, err: undefined })}${l.truncated ? ' (truncated)' : ''}`);
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
      'no disclaimer: own row spanning the composer, today\'s font size',
    );
    await capture(dest, 'line-ready-nodisclaimer', 1280, 'light');
    await dest.close();
    await page.close();
  }
  pass('ready and unsure lines cover the disclaimer at 1280/390 light/dark, opaque, its type, × brings it back; 8 px above the composer without one');

  // ---- Ready line and ChatGPT's reply: the line stays while no reply has appeared, and goes once
  // the reply to Butter's question starts to show: a fade, or at once under reduced motion.
  // lineFrames: from the reply's start, the line's opacity each frame, then null once it is gone.
  const watchLine = (page) =>
    page.evaluate((host) => {
      window.lineFrames = [];
      const tick = () => {
        if (fixture.replied) {
          const line = document.querySelector(host)?.shadowRoot?.querySelector('.line');
          lineFrames.push(line ? Number(getComputedStyle(line).opacity) : null);
          if (!line) return (window.lineGoneAfter = performance.now() - fixture.replied);
        }
        requestAnimationFrame(tick);
      };
      tick();
    }, HOST);
  // placeholder: the send click mounts an empty reply at once (ChatGPT's "thinking" state), which
  // the reply's text fills later; the line still waits for that text.
  for (const [motion, held] of [
    ['no-preference', false],
    ['reduce', false],
    ['no-preference', true],
  ]) {
    const label = held ? `${motion} placeholder` : motion;
    const page = await open();
    const dest = await ask(page, { fixture: 'reply=2500' + (held ? '&placeholder' : '') });
    await dest.emulateMedia({ reducedMotion: motion });
    await inShadow(dest, '.line').waitFor();
    await watchLine(dest);
    await dest.waitForTimeout(1500);
    assert.equal(await dest.evaluate(() => fixture.replied), undefined, `${label}: no reply yet`);
    assert.equal(await inShadow(dest, '.line').count(), 1, `${label}: line stays while no reply`);
    if (held)
      assert.ok(
        await dest.evaluate(() => !!document.querySelector('[data-turn-key^="t-sent-"] .a')),
        'placeholder: the empty reply is mounted',
      );
    await dest.waitForFunction(() => fixture.replied);
    await dest
      .waitForFunction(() => window.lineGoneAfter !== undefined, null, { timeout: 2_000 })
      .catch(() => assert.fail(`${label}: line still shown 2 s after the reply showed`));
    const { frames, after } = await dest.evaluate(() => ({ frames: lineFrames, after: lineGoneAfter }));
    const faded = frames.some((o) => o !== null && o > 0 && o < 1);
    assert.ok(after < 700, `${label}: line gone ${Math.round(after)} ms after the reply showed`);
    assert.equal(faded, motion === 'no-preference', `${label}: fade ${JSON.stringify(frames)}`);
    console.log(`INFO ${label}: line gone ${Math.round(after)} ms after the reply showed`);
    await dest.close();
    await page.close();
  }
  {
    // No reply: the line stays; × hides it at once.
    const page = await open();
    const dest = await ask(page);
    await inShadow(dest, '.line').waitFor();
    await dest.waitForTimeout(3_000);
    assert.equal(await inShadow(dest, '.line').count(), 1, 'line stays while no reply');
    await inShadow(dest, '.line .xs').click();
    assert.equal(await inShadow(dest, '.line').count(), 0, '× hides the line at once');
    await dest.close();
    await page.close();
  }
  // Before and after the reply, light and dark, 1280 and 800 px.
  for (const theme of ['light', 'dark'])
    for (const width of [1280, 800]) {
      const page = await open(`theme=${theme}`, width);
      const dest = await ask(page, { fixture: 'reply=1500', width });
      await inShadow(dest, '.line').waitFor();
      await dest.waitForTimeout(250);
      await capture(dest, 'reply-before', width, theme);
      await dest.waitForFunction(() => fixture.replied);
      await inShadow(dest, '.line').waitFor({ state: 'detached' });
      await capture(dest, 'reply-after', width, theme);
      await dest.close();
      await page.close();
    }
  pass('ready line stays while no reply, goes as the reply shows (fade; at once under reduced motion); × at once');

  // Ask from the original tab; returns the new tab with Butter's card up.
  const askCard = async (page, question) => {
    const dest = await ask(page, question ? { question } : {});
    await inShadow(dest, '.card').waitFor();
    return dest;
  };
  const heading = (dest) => inShadow(dest, '.card h3').innerText();
  // The working card per the mockup (state 3): 400 px wide, centred, 250 px from the top at
  // 800 px height; the scrim covers the whole page, header included (user decision).
  const cardGeometry = (dest) =>
    dest.evaluate((host) => {
      const root = document.querySelector(host).shadowRoot;
      return {
        card: root.querySelector('.card').getBoundingClientRect().toJSON(),
        scrim: root.querySelector('.scrim').getBoundingClientRect().toJSON(),
        width: innerWidth,
      };
    }, HOST);

  // ---- Streaming: the button works while the latest reply is written; the new tab waits.
  {
    const page = await open('stream=5000&slow=300');
    // The latest reply is streaming in the original tab too: the button is still offered.
    assert.equal(await page.evaluate(() => fixture.streamEnded), undefined);
    const dest = await askCard(page);
    assert.equal(await heading(dest), 'Waiting for the reply to finish…');
    assert.equal(await dest.title(), 'Waiting for the reply to finish…', 'tab title while waiting');
    const g = await cardGeometry(dest);
    assert.equal(Math.round(g.card.width), 400);
    assert.equal(Math.round(g.card.top), 250);
    assert.equal(Math.round(g.card.left + g.card.width / 2), g.width / 2, 'centred');
    assert.equal(Math.round(g.scrim.top), 0, 'scrim covers the header too');
    assert.equal(Math.round(g.scrim.height), 800, 'scrim covers the full height');
    assert.equal(await dest.evaluate(() => fixture.branchedFrom.length), 0, 'no branch while streaming');
    // Then branches from the finished latest reply and sends there.
    await inShadow(dest, '.line').waitFor({ timeout: 20000 });
    assert.equal(await dest.evaluate(() => fixture.streamEnded), true);
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), ['m-latest']);
    assert.deepEqual(await dest.evaluate(() => fixture.branchedText), [LATEST], 'finished reply');
    const sent = await dest.evaluate(() => fixture.sent);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].conv, BRANCH);
    await dest.close();
    await page.close();
    pass('streaming: button offered, new tab waits (card per mockup, title), then branches the finished latest reply');
  }
  // Cancel while waiting, via #28's controls: the cover goes at once, nothing is branched or sent,
  // even after the stream ends.
  for (const how of ['×', 'Cancel', 'Esc']) {
    const page = await open('stream=3000');
    const dest = await askCard(page);
    assert.equal(await heading(dest), 'Waiting for the reply to finish…');
    if (how === '×') await inShadow(dest, '.card .x').click();
    else if (how === 'Cancel') await inShadow(dest, '.card .btn').click();
    else await dest.keyboard.press('Escape');
    assert.equal(await inShadow(dest, '.card').count(), 0, `${how}: card gone at once`);
    assert.equal(await inShadow(dest, '.scrim').count(), 0, `${how}: cover gone at once`);
    assert.equal(await dest.title(), 'Explain Corpus Meaning', `${how}: title restored`);
    await dest.waitForFunction(() => fixture.streamEnded === true);
    await dest.waitForTimeout(2500);
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), [], `${how}: never branched`);
    assert.equal(await dest.evaluate(() => fixture.morePresses), 0, `${how}: no menu press`);
    assert.deepEqual(await dest.evaluate(() => fixture.sent), [], `${how}: nothing sent`);
    assert.equal(await dest.evaluate(() => document.querySelector('.ProseMirror').innerText.trim()), '');
    await dest.close();
    await page.close();
  }
  assert.deepEqual(await failures(), {}, 'a cancel while waiting is not a failure');
  pass('streaming: ×, Cancel and Esc while waiting stop at once; nothing branched, typed or sent');

  // Turning Ask in branch off while the run waits stops it like a cancel.
  {
    const page = await open('stream=3000');
    const dest = await askCard(page);
    assert.equal(await heading(dest), 'Waiting for the reply to finish…');
    await settings({ opts: { branch: false } });
    await dest.waitForFunction(() => fixture.streamEnded === true);
    await dest.waitForTimeout(2500);
    assert.equal(await inShadow(dest, '.card').count(), 0, 'setting off: card gone');
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), [], 'setting off: never branched');
    assert.deepEqual(await dest.evaluate(() => fixture.sent), [], 'setting off: nothing sent');
    await settings({});
    await dest.close();
    await page.close();
  }
  assert.deepEqual(await failures(), {}, 'turning the setting off is not a failure');
  pass('streaming: turning Ask in branch off while waiting stops the run; nothing branched or sent');

  // ---- No button where ChatGPT can't branch. ChatGPT's own button is shown in each case, so
  // its absence is Butter's rule, not a missing anchor.
  {
    const cases = [
      ['Temporary Chat', 'temporary-chat=true'],
      ['Work mode', 'work=1'],
      ['Work mode (side chat in the toolbar only)', 'side=1'],
      ['no branch action', 'nobranch=1'],
      ['Work mode, Chinese UI', 'work=1&lang=zh'],
      ['unsaved branch', '', `/c/${encodeURIComponent(BRANCH)}`],
      ['unsaved new chat', '', '/'],
    ];
    for (const [name, query, route] of cases) {
      const page = await open(query, 1280, route);
      await select(page);
      await page.waitForFunction(() => !document.querySelector('.native').hidden);
      await page.waitForTimeout(400);
      assert.equal((await rects(page)).chip, null, `no button: ${name}`);
      await page.close();
    }
    // Control: the same fixture in Chat mode, Chinese UI, while the latest reply streams.
    for (const query of ['lang=zh', 'stream=60000']) {
      const page = await open(query);
      await select(page);
      await chipOf(page).waitFor({ timeout: 3000 });
      await page.close();
    }
    pass(`hidden: ${cases.map(([n]) => n).join(', ')}; shown in the Chat-mode controls`);
  }

  // ---- ChatGPT in Simplified Chinese (Butter in English): menus matched, flow completes.
  {
    const page = await open('lang=zh&slow=200');
    const dest = await askCard(page);
    await inShadow(dest, '.line').waitFor();
    assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), ['m-latest']);
    assert.equal(await dest.evaluate(() => fixture.workClicks), 0, 'never Work mode');
    const sent = await dest.evaluate(() => fixture.sent);
    assert.deepEqual(
      sent.map((m) => ({ ...m, text: m.text.replace(/\n{3,}/g, '\n\n').trim() })),
      [{ conv: BRANCH, text: `> ${QUOTE}\n\nWhat does RAG mean here?` }],
      'sent once via the Chinese "发送" button, in the verified branch',
    );
    await dest.close();
    await page.close();
    pass('Chinese ChatGPT menus: 更多操作 → 创建对话分支 → 在新聊天中创建分支; sent once in the branch');
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

  // ---- Cancel while sending: the branch is verified and filled, but ChatGPT's Send button
  // enables only 2.5 s later. The card stays, and Esc in that window sends nothing.
  {
    const page = await open();
    const dest = await ask(page, { fixture: 'senddelay=2500' });
    await dest.waitForFunction(
      () => document.querySelector('.ProseMirror').innerText.trim() && fixture.sent.length === 0,
    );
    assert.equal(await inShadow(dest, '.card').count(), 1, 'card kept while waiting for Send');
    await dest.keyboard.press('Escape');
    assert.equal(await inShadow(dest, '.card').count(), 0, 'card gone at once');
    assert.equal(await inShadow(dest, '.scrim').count(), 0, 'cover gone at once');
    await dest.waitForTimeout(2500 + 1000);
    assert.equal(await dest.evaluate(() => fixture.sent.length), 0, 'sent after Esc');
    assert.equal(await inShadow(dest, '.line').count(), 0, 'no ready line after cancel');
    await dest.close();
    await page.close();
  }
  assert.deepEqual(await failures(), {}, 'a cancel while sending is not a failure');
  pass('Esc while waiting for a delayed Send button: card gone, nothing sent');

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
      // ChatGPT's menu is back, but Ask in branch is off: Try again does nothing.
      await dest.evaluate(() => (fixture.noNewChat = false));
      await settings({ opts: { branch: false } });
      await card.getByText('Try again').click();
      await dest.waitForTimeout(3000);
      assert.deepEqual(await dest.evaluate(() => fixture.branchedFrom), [], 'retry while off: never branched');
      assert.equal(await dest.evaluate(() => fixture.sent.length), 0, 'retry while off: nothing sent');
      await settings({});
      // Back on: Try again makes the branch, and the status failure clears.
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
    await chipOf(page).waitFor();
    await settle(page);
    await chipOf(page).click();
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
    assert.equal((await rects(page)).chip, null, 'button stays hidden while the box stays open');
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
      await chipOf(page).waitFor();
      await page.locator('#quote').hover();
      await settle(page);
      await capture(page, 'button', width, theme);
      await chipOf(page).click();
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
      // The working card's waiting variant (latest reply still streaming).
      const streaming = await open(`theme=${theme}&stream=60000`, width);
      const waiting = await askCard(streaming, 'What does RAG mean here? How is it different from fine-tuning?');
      await waiting.setViewportSize({ width, height: 800 });
      await settle(waiting);
      assert.equal(await heading(waiting), 'Waiting for the reply to finish…');
      await capture(waiting, 'waiting', width, theme);
      await inShadow(waiting, '.card .btn').click();
      await waiting.close();
      await streaming.close();
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
      await dest.mouse.click(5, 5); // no focus ring in the shot (lands on the full-page cover)
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
    await chipOf(page).waitFor();
    assert.equal(await chipOf(page).getAttribute('aria-label'), '在分支中问', 'Chinese accessible name');
    await chipOf(page).click();
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
    // The unsure line in Chinese, in the disclaimer's row.
    {
      const p2 = await open();
      const unsure = await ask(p2, { fixture: 'senddelay=60000' });
      await inShadow(unsure, '.line.unsure').waitFor({ timeout: 30_000 });
      await unsure.waitForTimeout(250);
      assert.equal(await inShadow(unsure, '.line .t').innerText(), '未发送：无法确认这是新的分支。');
      assertCovers(await lineGeometry(unsure), 'zh unsure');
      await capture(unsure, 'line-unsure', 1280, 'light-zh');
      await unsure.close();
      await p2.close();
    }
    const streaming = await open('lang=zh&stream=60000');
    const waiting = await askCard(streaming, '这里的 RAG 具体指什么？和微调有什么区别？');
    assert.equal(await heading(waiting), '正在等待回复完成…');
    assert.equal(await waiting.title(), '正在等待回复完成…');
    await settle(waiting);
    await capture(waiting, 'waiting', 1280, 'light-zh');
    await inShadow(waiting, '.card .btn').click();
    await waiting.close();
    await streaming.close();
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
    await failed.mouse.click(5, 5); // lands on the full-page cover
    await settle(failed);
    await capture(failed, 'failure', 1280, 'light-zh');
    await failed.close();
    await zh.close();
    await settings({});
    pass('Simplified Chinese strings and title (creating and waiting); spinner still under reduced motion; zh failure card');
  }
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
assert.deepEqual(errors, [], 'page errors');
assert.deepEqual(foreign, [], 'non-ChatGPT requests');
pass(`${files.length} screenshots in ${path.relative(repo, shots)}; no page errors; no requests left the fixture`);
