// Real extension page + real storage/worker. Only the active-tab probe is forced for design states.
// Separate headless Chromium: this never touches the shared lab browser. Then the dev build's
// popup (#46) in its own profile; see devPopup() at the end.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { repo } from './runner/chromium.mjs';
import { evidenceShot } from './runner/shot.mjs';
import { liveRegions, mockupComparer } from './popup/mockup.mjs';
import { POPUP_HEIGHT, checkFixedHeight, checkFooterStill, checkFreshInstall, checkPages, experimentalCases, experimentalPanels, seedStores } from './popup/experimental.mjs';
const shots = process.env.BUTTER_SHOTS || '/tmp/butter-popup-build';
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-popup-qa-'));
const browser = await chromium.launchPersistentContext(profile, {
  headless: true, channel: 'chromium',
  viewport: { width: 360, height: 900 },
  args: [`--disable-extensions-except=${repo}/extension`, `--load-extension=${repo}/extension`],
});
const errors = [], requests = [], files = [], comparisons = [], heights = {}, liveRects = {}, cleanup = [];
const { compareMockup, compareFigures } = mockupComparer({ browser, shots, profile, heights, liveRects, errors });
// BUTTER_REDESIGN_MOCKUP=<#35 Mockup.html> compares built states with the mockup's panels on the
// BUTTER_REDESIGN_SIDE (`before` or `after`, default `after`). Panel key -> built state. Historical
// and report-only: that mockup draws the single-page popup from before #158, so its panels no
// longer match; BUTTER_EXPERIMENTAL_MOCKUP is the current visual check.
const redesignMockup = process.env.BUTTER_REDESIGN_MOCKUP, redesignSide = process.env.BUTTER_REDESIGN_SIDE || 'after';
assert.ok(['before', 'after'].includes(redesignSide), `BUTTER_REDESIGN_SIDE must be before or after, not ${redesignSide}`);
const redesignStates = {
  default: '13-en-branch-on-light', paused: '10-en-paused-light', 'rail-fault': '19-en-rail-fault-light',
  'layouts-pending': '20-en-layouts-pending-light', 'clear-confirm': '21-en-clear-confirm-light',
  'branch-off': '14-en-branch-off-light', 'branch-fault': '15-en-branch-failed-light',
  dark: '13-en-branch-on-dark', zh: '16-zh-branch-on-light',
};
// Panels that cannot match, with the reason; they are still measured and reported.
const redesignExcluded = {};
// BUTTER_EXPERIMENTAL_MOCKUP=<#158's experimental-page.html> compares the in-scope panels
// (popup/experimental.mjs) and copies each matched panel's built state to <shots>/panels/<id>.png.
const experimentalMockup = process.env.BUTTER_EXPERIMENTAL_MOCKUP;
try {
  const worker = browser.serviceWorkers()[0] || await browser.waitForEvent('serviceworker');
  const popupUrl = worker.url().replace('/storage/layout-worker.js', '/popup/popup.html');
  const page = await browser.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => requests.push(r.url()));
  await page.goto(popupUrl);
  await page.waitForSelector('.master');
  await page.evaluate(() => {
    chrome.tabs.query = async () => [{ id: 1 }];
    chrome.tabs.sendMessage = async () => {
      if (!globalThis.fixtureConnected) throw new Error('No receiver');
      return { states: {} };
    };
  });
  // A fresh profile is a real install (#158): the rail and Bookmarks start off, and no card shows.
  const fresh = await checkFreshInstall(browser, worker);
  // Initialize the database through its public API before seeding.
  await page.evaluate(async () => {
    await chrome.storage.local.set({ butter: { layoutConsent: 'granted' } });
    await refreshAll();
  });
  let cases = [
    // A state's `page` is the popup page it shows (main unless it says experimental, #158); the
    // rail and Bookmarks are on unless it is `fresh` or its `opts` say otherwise.
    ['01-normal', {}], ['02-problem', { broken: true, page: 'experimental' }], ['03-away', { away: true }],
    ['04-paused', { paused: true }], ['05-confirm', { clear: 'confirm', page: 'experimental' }], ['06-cleared', { clear: 'done', page: 'experimental' }],
    ['07-normal', {}], ['08-problem', { broken: true, page: 'experimental' }], ['09-en-memory-off', { lang: 'en', memory: false, page: 'experimental' }],
    ['10-en-paused', { lang: 'en', paused: true }], ['11-melt', { animation: true }], ['12-melt', { animation: true }],
    // Ask in branch (#30): on, off and failed in both languages; refs are panels of the approved mockup.
    ['13-en-branch-on', { lang: 'en' }], ['14-en-branch-off', { lang: 'en', branch: false }],
    ['15-en-branch-failed', { lang: 'en', broken: 'branch' }], ['16-zh-branch-on', { lang: 'zh' }],
    ['17-zh-branch-off', { lang: 'zh', branch: false }], ['18-zh-branch-failed', { lang: 'zh', broken: 'branch' }],
    // English states for the #35 redesign panels.
    ['19-en-rail-fault', { lang: 'en', broken: true, page: 'experimental' }], ['20-en-layouts-pending', { lang: 'en', consent: 'pending', page: 'experimental' }],
    ['21-en-clear-confirm', { lang: 'en', clear: 'confirm', page: 'experimental' }],
    // The consent note in Chinese, for the fixed height (05 covers the Chinese clear confirmation).
    ['22-zh-layouts-pending', { lang: 'zh', consent: 'pending', page: 'experimental' }],
    // The main page's worst case: every group on it that can fail has failed (the rail's fault
    // shows on the Experimental page; its worst cases are 31, 32, 51 and 52).
    ['23-en-all-faults-pending', { lang: 'en', consent: 'pending', broken: ['streaming', 'scrolling', 'rail', 'branch'] }],
    ['24-zh-all-faults-pending', { lang: 'zh', consent: 'pending', broken: ['streaming', 'scrolling', 'rail', 'branch'] }],
    // The Experimental row and page (#158), in both languages.
    ...experimentalCases,
  ];
  if (process.env.BUTTER_CASES) cases = cases.filter(([name]) => process.env.BUTTER_CASES.split(',').includes(name.slice(0, 2)));
  const mockup = process.env.BUTTER_MOCKUP;
  let ref;
  if (mockup) {
    ref = await browser.newPage();
    let source = await fs.readFile(mockup, 'utf8');
    source = source.replace(/<link[^>]*fonts.googleapis[^>]*>/, '');
    const font = async name => `data:font/woff2;base64,${(await fs.readFile(`${repo}/extension/popup/fonts/${name}.woff2`)).toString('base64')}`;
    source = source.replace('</style>', `@font-face{font-family:'Bagel Fat One';src:url('${await font('bagel-wordmark')}')}@font-face{font-family:'Nunito';src:url('${await font('nunito-latin')}');font-weight:500 900}.popup{box-shadow:none}</style>`);
    await ref.setContent(source); await ref.evaluate(() => document.fonts.ready);
  }
  for (const [name, config] of cases) for (const color of ['light', 'dark']) {
    await page.bringToFront();
    await page.emulateMedia({ colorScheme: color, reducedMotion: 'no-preference' });
    await seedStores(worker, config.saved ? 12 : 0);
    await page.evaluate(async config => {
      for (const st of Object.values(stores)) { clearTimeout(st.timer); st.clear = 'idle'; }
      fixtureConnected = !config.away;
      const value = ButterStatus.normalize({ layoutConsent: config.fresh ? undefined : config.consent || 'granted', enabled: !config.paused && !config.animation, lang: config.lang || 'zh', opts: { layout: config.memory !== false, branch: config.branch !== false, rail: !config.fresh, bookmark: !config.fresh, ...config.opts } });
      const broken = config.broken === true ? ['rail'] : [config.broken || []].flat();
      await chrome.storage.session.set({ butterFailures: Object.fromEntries(broken.map(k => [k, { [k]: true }])) });
      await chrome.storage.local.set({ butter: value });
      await poll();
      await refreshAll();
      if (document.querySelector('.page').dataset.page !== (config.page || 'main')) go(config.page || 'main');
      document.activeElement?.blur();
    }, config);
    if (config.clear) {
      await page.locator(`[data-store="${config.store || 'layouts'}"][data-clear="ask"]`).click();
      if (config.clear === 'done') {
        await page.locator('[data-store="layouts"][data-clear="confirm"]').click();
        await page.waitForFunction(() => stores.layouts.clear === 'done');
        // Hold the transient success state only for its design screenshot. The live smoke checks the real 2s timeout.
        await page.evaluate(() => clearTimeout(stores.layouts.timer));
        assert.equal((await page.evaluate(() => chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-usage' })) ).bytes, 0);
      }
    }
    await page.waitForTimeout(350);
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    await page.evaluate(() => document.activeElement?.blur());
    assert.equal(await page.locator('body').evaluate(e => e.scrollWidth), 360);
    // The main page: the master and three rows; the Experimental page: three rows. The question
    // replaces its row.
    const main = (config.page || 'main') === 'main';
    assert.equal(await page.locator('[role="switch"]').count(), (main ? 4 : 3) - (config.clear === 'confirm' ? 1 : 0));
    assert.equal(await page.locator('.page').getAttribute('data-page'), config.page || 'main');
    // The store popup has no dev script, so its slot renders nothing.
    assert.equal(await page.locator('.devtag, .card.dev').count(), 0, `${name}-${color} shows the dev card`);
    if (main) {
      assert.equal(await page.locator('[data-switch="branch"]').getAttribute('aria-checked'), String(config.branch !== false));
      assert.equal(await page.locator('.row.bad [data-switch="branch"]').count(), [config.broken].flat().includes('branch') ? 1 : 0);
      // The Experimental row counts the experimental switches that are on, and shows no fault.
      const on = await page.evaluate(() => ButterStatus.experimental.filter(k => ButterStatus.groupOn(prefs, k)).length);
      assert.equal(await page.locator('.exp-row .cnt').textContent(), on ? (config.lang === 'en' ? `${on} on` : `已开启 ${on} 项`) : '');
    } else assert.equal(await page.locator('.card.exp').count(), 1);
    assert.ok(!/待验证|Not yet checked/.test(await page.locator('body').innerText()));
    // With two or more faults on the page showing, every faulted row's short text fits on one line.
    if (await page.locator('.row.bad').count() > 1) for (const [text, lines] of await page.locator('.row.bad .d').evaluateAll(list => list.map(e => {
      // The fault text's own lines: a faulted storage row's Clear may wrap after it.
      const r = document.createRange(); r.selectNodeContents(e.matches('[role="status"]') ? e : e.querySelector('[role="status"]'));
      return [r.toString(), new Set([...r.getClientRects()].map(x => Math.round(x.top))).size];
    })))
      assert.equal(lines, 1, `${name}-${color}: "${text}" wraps to ${lines} lines`);
    const metrics = () => ['.hd', '.master', '.card', '.row', '.note', '.ft'].map(selector => {
      const e = document.querySelector(selector), r = e?.getBoundingClientRect();
      return { selector, top: r?.top, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
    });
    const builtMetrics = await page.evaluate(metrics);
    const file = `${shots}/${name}-${color}.png`;
    await evidenceShot(page, file, { target: page.locator('#popup') }); files.push(file);
    // Every state, faults included, is the fixed height with nothing overflowing it.
    heights[`${name}-${color}`] = await checkFixedHeight(page, `${name}-${color}`);
    liveRects[`${name}-${color}`] = await page.evaluate(liveRegions);
    if (config.animation) {
      await page.locator('[data-switch="master"]').click();
      const frame = await page.evaluate(async () => {
        await new Promise(requestAnimationFrame);
        const a = document.querySelector('.drip').getAnimations()[0];
        if (a) { a.pause(); a.currentTime = 150; }
        return { duration: a?.effect.getTiming().duration, transform: getComputedStyle(document.querySelector('.drip')).transform };
      });
      assert.equal(frame.duration, 300);
      await evidenceShot(page, `${shots}/${name}-${color}-mid.png`, { target: page.locator('#popup'), animations: 'allow' });
      await page.evaluate(() => document.querySelector('.drip').getAnimations().forEach(a => a.finish()));
      await page.waitForTimeout(320);
      await evidenceShot(page, `${shots}/${name}-${color}-on.png`, { target: page.locator('#popup') });
    }
    if (ref && Number(name.slice(0, 2)) <= 12) {
      const index = Number(name.slice(0, 2)) - 1;
      await ref.bringToFront();
      await ref.evaluate(({ index, color }) => {
        // Place the reference at the same pixel origin; figure captions otherwise introduce subpixel offsets.
        document.body.innerHTML = popup({ ...figs[index][2], dark: color === 'dark' });
        document.getAnimations().forEach(a => a.finish());
      }, { index, color });
      const reference = `${shots}/reference-${name}-${color}.png`;
      await evidenceShot(ref, reference, { target: ref.locator('.popup').first() });
      const referenceMetrics = await ref.locator('.popup').first().evaluate(el => {
        const base = el.getBoundingClientRect().top;
        return ['.hd', '.master', '.card', '.row', '.note', '.ft'].map(selector => {
          const e = el.querySelector(selector), r = e?.getBoundingClientRect();
          return { selector, top: r ? r.top - base : undefined, height: r?.height, font: e && getComputedStyle(e).font, lineHeight: e && getComputedStyle(e).lineHeight };
        });
      });
      comparisons.push({ name, color, built: builtMetrics, reference: referenceMetrics });
    }
  }
  const redesignRefs = redesignMockup
    ? await compareMockup(redesignMockup, Object.entries(redesignStates).map(([key, state]) => [`${key}-${redesignSide}`, state, redesignExcluded[`${key}-${redesignSide}`]]), `Redesign mockup (#35), ${redesignSide} panels (historical, report-only)`)
    : [];
  const experimentalRefs = experimentalMockup
    // Only the panels whose state this run built (BUTTER_CASES may leave some out).
    ? await compareFigures(experimentalMockup, Object.entries(experimentalPanels).filter(([, state]) => heights[state]), 'Experimental page mockup (#158), in-scope panels')
    : [];
  // One screenshot of the real popup per panel, named by the panel's id.
  await fs.mkdir(`${shots}/panels`, { recursive: true });
  for (const [panel, state] of Object.entries(experimentalPanels))
    if (heights[state]) await fs.copyFile(`${shots}/${state}.png`, `${shots}/panels/${panel}.png`);
  // The branch switch writes only its own key.
  await page.bringToFront();
  // The last case may leave the clear flow open; the live checks start from idle, on the main page.
  await page.evaluate(async () => {
    for (const st of Object.values(stores)) { clearTimeout(st.timer); st.clear = 'idle'; }
    await chrome.storage.local.set({ butter: ButterStatus.normalize({ layoutConsent: 'granted', lang: 'en', opts: { rail: true, bookmark: true } }) });
    go('main');
  });
  await page.locator('[data-switch="branch"]').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.branch === false);
  assert.equal((await page.evaluate(() => chrome.storage.local.get('butter'))).butter.opts.rail, true);
  await page.locator('[data-switch="branch"]').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.branch === true);
  // Each row is a label around its switch: a click on its description toggles exactly that group.
  await page.locator('.exp-row').click();
  const opts = async () => (await page.evaluate(() => chrome.storage.local.get('butter'))).butter.opts;
  const railRow = page.locator('.row', { has: page.locator('[data-switch="rail"]') });
  const beforeRow = await opts();
  await railRow.locator('.d').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.rail === false);
  assert.deepEqual(await opts(), { ...beforeRow, rail: false });
  assert.equal(await page.locator('[data-switch="rail"]').getAttribute('aria-checked'), 'false');
  await railRow.locator('.n').click();
  await page.waitForFunction(async () => (await chrome.storage.local.get('butter')).butter.opts.rail === true);
  assert.deepEqual(await opts(), beforeRow);
  await page.locator('.back').click();
  // Every switch stays a named button with its checked state and stable hook.
  for (const e of await page.locator('[role="switch"]').evaluateAll(list => list.map(e => ({ tag: e.tagName, name: e.getAttribute('aria-label'), checked: e.getAttribute('aria-checked'), key: e.dataset.switch }))))
    assert.ok(e.tag === 'BUTTON' && e.name && /^(true|false)$/.test(e.checked) && e.key, JSON.stringify(e));
  // Pausing and resuming leave the popup's height and the master switch where they were.
  const geometry = async () => {
    await page.evaluate(() => document.getAnimations().forEach(a => a.finish()));
    return page.evaluate(() => {
      const r = document.querySelector('[data-switch="master"]').getBoundingClientRect();
      return { height: document.getElementById('popup').offsetHeight, master: [r.left, r.top, r.width, r.height] };
    });
  };
  const resumed = await geometry();
  await page.locator('[data-switch="master"]').click();
  await page.waitForFunction(() => document.querySelector('.card.paused'));
  assert.deepEqual(await geometry(), resumed, 'pausing moved the popup');
  await page.locator('[data-switch="master"]').click();
  await page.waitForFunction(() => !document.querySelector('.card.paused'));
  assert.deepEqual(await geometry(), resumed, 'resuming moved the popup');
  // Cancel is non-destructive; language, focus, master motion and reduced motion work live.
  await page.bringToFront();
  await page.getByRole('button', { name: 'EN', exact: true }).click();
  await page.keyboard.press('Tab');
  await page.locator('[data-switch="master"]').focus();
  assert.equal(await page.locator('[data-switch="master"]').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
  const before = await page.locator('[data-switch="master"]').getAttribute('aria-checked');
  await page.keyboard.press('Space');
  assert.notEqual(await page.locator('[data-switch="master"]').getAttribute('aria-checked'), before);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.drip').evaluate(e => getComputedStyle(e).transitionDuration), '0s');
  assert.equal(await page.locator('.tg').first().evaluate(e => getComputedStyle(e).transitionDuration), '0s');
  await page.getByRole('button', { name: '中文', exact: true }).focus();
  assert.equal(await page.locator('.lang').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
  await page.evaluate(async () => {
    await chrome.storage.session.set({ butterFailures: { streaming: { cv: true }, branch: { branch: true } } });
    prefs.enabled = true; render();
  });
  // Each broken group explains itself in its own row; nothing is aggregated elsewhere.
  await page.waitForFunction(() => document.querySelectorAll('.row.bad').length === 2);
  // Two faults: each row carries the short one-line text.
  const fault = 'Unavailable; resumes on its own.';
  assert.deepEqual(await page.locator('.row.bad').evaluateAll(list => list.map(e => [e.querySelector('[data-switch]').dataset.switch, e.querySelector('.d').textContent, e.querySelector('.d').getAttribute('role')])),
    [['streaming', fault, 'status'], ['branch', fault, 'status']]);
  await page.evaluate(async () => {
    const next = await chrome.runtime.sendMessage({ type: 'butter-status-record', states: { cv: 'ok', branch: 'ok' } });
    failures = next; render();
  });
  assert.equal(await page.locator('.row.bad').count(), 0);
  // The Experimental page: swap, focus, motion, and its survival across polling and language.
  await page.evaluate(() => document.activeElement?.blur());
  await checkPages(page);
  const footerTop = await checkFooterStill(page);
  await page.locator('.exp-row').click();
  // Clear and Cancel work from the Experimental page, with focus moving as on the main page.
  await page.locator('[data-store="layouts"][data-clear="ask"]').click();
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.clear), 'confirm');
  await page.locator('[data-store="layouts"][data-clear="cancel"]').click();
  assert.equal(await page.locator('[data-store="layouts"][data-clear="ask"]').count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement?.dataset.clear), 'ask');
  assert.deepEqual(errors, []);
  assert.deepEqual(requests.filter(url => /^https?:/.test(url)), []);
  await page.evaluate(async () => {
    await chrome.runtime.sendMessage({ version: 1, type: 'butter-layout-clear', requestId: crypto.randomUUID() });
    await chrome.storage.local.clear(); await chrome.storage.session.clear();
  });
  const dev = process.env.BUTTER_DEV === '0' ? null : await devPopup();
  await fs.writeFile(`${shots}/geometry.json`, JSON.stringify(comparisons, null, 2));
  await fs.writeFile(`${shots}/heights.json`, JSON.stringify({ heights, redesignRefs, experimentalRefs, fresh, devRefs: dev?.refs ?? [], devRows: dev?.rows ?? {} }, null, 2));
  await fs.writeFile(`${shots}/screenshots.json`, JSON.stringify({ popupUrl, files, errors, remoteRequests: [] }, null, 2));
  // Fail only after every panel has been compared and reported; #35's and #32's are report-only.
  const experimentalMismatched = experimentalRefs.filter(r => r.ok !== true);
  assert.equal(experimentalMismatched.length, 0, `${experimentalMismatched.length} of ${experimentalRefs.length} panels differ from the Experimental page mockup: ${experimentalMismatched.map(r => r.skipped ? `${r.panel} (skipped: ${r.skipped})` : `${r.panel} (${r.built}/${r.reference} px, ${(r.ratio * 100).toFixed(3)}%)`).join('; ')}`);
  console.log(`PASS: ${files.length} full 360px state screenshots (${cases.length} store states × light/dark${dev ? `, ${dev.states} dev states` : ''}), every one ${POPUP_HEIGHT} px with nothing overflowing, the footer at y ${footerTop} on both pages, mid-swap and with the privacy note gone, melt frames, branch switch, pause without layout shift, in-row faults, a fresh install with the rail and Bookmarks off and no card, the Experimental page's swap, focus and motion, ${experimentalRefs.filter(r => r.ok).length} of ${experimentalMockup ? experimentalRefs.length : Object.keys(experimentalPanels).length} Experimental page mockup matches${experimentalMockup ? '' : ' (BUTTER_EXPERIMENTAL_MOCKUP not set)'}, ${redesignRefs.length} redesign-mockup panels compared (historical, report-only)${dev ? `, ${dev.refs.length} dev-mockup panels compared (historical, report-only), dev card actions` : ''}, real worker usage/clear, keyboard, focus, reduced motion; no errors or network requests.`);
} finally {
  await browser.close(); await fs.rm(profile, { recursive: true, force: true });
  for (const dir of cleanup) await fs.rm(dir, { recursive: true, force: true });
}

// ---- Dev build (#46): the DEV tag and the dev card ----
// Builds the dev zip (python3 scripts/package.py --dev) unless BUTTER_DEV_ZIP names one, loads it
// unpacked in its own headless profile, and captures the dev states. BUTTER_DEV_MOCKUP=<#32
// Mockup.html> (gh issue artifact download 32 1 -R SimianW/butter) compares the English and dark
// states with its dev-*-after panels; historical and report-only, since that mockup draws the
// single-page popup from before #158. BUTTER_DEV=0 skips the dev build.
async function devPopup() {
  const zip = process.env.BUTTER_DEV_ZIP || execFileSync('python3', [path.join(repo, 'scripts/package.py'), '--dev'], { encoding: 'utf8' }).split('\n')[0].trim();
  const unpacked = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-popup-dev-')); cleanup.push(unpacked);
  execFileSync('python3', ['-I', '-c', 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, unpacked]);
  const extension = path.join(unpacked, 'butter');
  const versionName = JSON.parse(await fs.readFile(path.join(extension, 'manifest.json'), 'utf8')).version_name;
  assert.match(versionName, /\+dev\.\d+$/);
  // Chrome does not assign Alt+Shift+B on Linux (it is the bookmarks-bar key), so seed the binding
  // chrome://extensions/shortcuts would save, as dev-capture-qa.mjs does. The id of an unpacked
  // extension is the SHA-256 of its path, first 32 hex digits mapped to a-p.
  const id = [...crypto.createHash('sha256').update(extension).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');
  const devProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-popup-dev-profile-')); cleanup.push(devProfile);
  const downloads = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-popup-dev-downloads-')); cleanup.push(downloads);
  await fs.mkdir(path.join(devProfile, 'Default'));
  await fs.writeFile(path.join(devProfile, 'Default', 'Preferences'), JSON.stringify({
    download: { default_directory: downloads, prompt_for_download: false },
    extensions: { commands: { 'linux:Alt+Shift+B': { command_name: 'save-bug', extension: id, global: false } } },
  }));
  const context = await chromium.launchPersistentContext(devProfile, {
    headless: true, channel: 'chromium',
    viewport: { width: 360, height: 900 },
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
    assert.match(worker.url(), /\/dev\/worker\.js$/);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(`dev: ${e.message}`));
    page.on('request', r => requests.push(r.url()));
    await page.goto(worker.url().replace('/dev/worker.js', '/popup/popup.html'));
    await page.waitForSelector('.card.dev');
    // The active tab is forced, as in the store run: a ChatGPT chat answers both the status probe
    // and the dev card's ping; anywhere else nothing answers.
    const fixtureTab = async () => page.evaluate(() => {
      globalThis.fixtureConnected = true;
      chrome.tabs.query = async () => [{ id: 1 }];
      chrome.tabs.sendMessage = async (_tab, message) => {
        if (!globalThis.fixtureConnected) throw new Error('No receiver');
        return message?.type === 'butter-dev-ping' ? { chat: true } : { states: {} };
      };
      globalThis.shown = [];
      chrome.downloads.show = id => shown.push(['show', id]);
      chrome.downloads.showDefaultFolder = () => shown.push(['default']);
    });
    await fixtureTab();
    // The saved lines are live data; the mockup comparison masks them, so they are not seeded here.
    const allFaults = ['streaming', 'scrolling', 'rail', 'branch'];
    // Name, config, colour scheme, and the #32 panel it must match (English and dark only).
    const devCases = [
      ['d1-en-recording', {}, 'light', 'dev-default-after'],
      ['d2-en-saved', { saved: true }, 'light', 'dev-saved-after'],
      ['d3-en-away', { away: true }, 'light', 'dev-away-after'],
      ['d1-en-recording', {}, 'dark', 'dev-dark-after'],
      ['d4-en-tallest', { consent: 'pending', broken: allFaults }, 'light', 'dev-worst-after'],
      ['d5-zh-recording', { lang: 'zh' }, 'light'],
      ['d6-zh-tallest', { lang: 'zh', consent: 'pending', broken: allFaults }, 'light'],
      // The rest in the other theme too: every dev state stays under the cap in both.
      ['d2-en-saved', { saved: true }, 'dark'], ['d3-en-away', { away: true }, 'dark'],
      ['d4-en-tallest', { consent: 'pending', broken: allFaults }, 'dark'],
      ['d5-zh-recording', { lang: 'zh' }, 'dark'],
      ['d6-zh-tallest', { lang: 'zh', consent: 'pending', broken: allFaults }, 'dark'],
    ];
    const panels = [], rows = {};
    for (const [name, config, color, panel] of devCases) {
      const state = `${name}-${color}`;
      await page.bringToFront();
      await page.emulateMedia({ colorScheme: color, reducedMotion: 'no-preference' });
      await page.evaluate(async config => {
        fixtureConnected = !config.away;
        const value = ButterStatus.normalize({ layoutConsent: config.consent || 'granted', lang: config.lang || 'en' });
        await chrome.storage.session.set({ butterFailures: Object.fromEntries((config.broken || []).map(k => [k, { [k]: true }])) });
        await chrome.storage.local.set({ butter: value, butterDev: { round: 2, bugs: 3 } });
        await poll();
        await refreshAll();
      }, config);
      // The dev card polls its tab once a second.
      await page.waitForFunction(away => !!document.querySelector('.strip.idle') === away, !!config.away, { timeout: 3000 });
      // Just saved: the worker records bug 4's file; the card shows it for about 4 s.
      if (config.saved) await page.evaluate(() => chrome.storage.local.set({ butterDev: { round: 2, bugs: 4, file: 'bug-04_21-14-03.json', download: 1 } }));
      await page.waitForTimeout(350);
      await page.evaluate(() => {
        document.getAnimations().forEach(a => { if (a.effect.getComputedTiming().endTime === Infinity) { a.pause(); a.currentTime = 0; } else a.finish(); });
        document.activeElement?.blur();
      });
      const row = await page.evaluate(() => {
        const box = e => e.getBoundingClientRect(), strip = document.querySelector('.strip'), s = box(strip);
        const inside = [...strip.children].every(c => { const r = box(c); return r.width === 0 || (r.left >= s.left - 0.5 && r.right <= s.right + 0.5); });
        const msg = document.querySelector('.msg');
        return {
          text: strip.innerText.replace(/\s+/g, ' ').trim(),
          height: s.height, inside, overflow: strip.scrollWidth > strip.clientWidth, truncated: msg.scrollWidth > msg.clientWidth,
          // The status text lines up with the other cards' row text.
          textLeft: box(msg).left, rowTextLeft: box(document.querySelector('.row .t')).left,
          tag: document.querySelector('.hd .word + .devtag')?.textContent, version: document.querySelector('.ver').textContent,
          snapDisabled: document.querySelector('[data-dev="save"]').disabled,
          iconButtons: [...document.querySelectorAll('.strip .ib')].filter(e => e.checkVisibility()).length,
        };
      });
      rows[state] = row;
      assert.equal(row.height, 36, `${state}: the dev row is ${row.height}px`);
      assert.ok(row.inside && !row.overflow && !row.truncated, `${state}: the dev row overflows: ${JSON.stringify(row)}`);
      assert.equal(row.textLeft, row.rowTextLeft, `${state}: status text is not in line with the row text`);
      assert.equal(row.tag, 'DEV');
      assert.equal(row.version, versionName);
      assert.equal(row.snapDisabled, !!config.away);
      assert.equal(row.iconButtons, config.saved ? 0 : 2);
      const expected = config.saved ? 'Saved bug-04_21-14-03.json Alt+Shift+B'
        : config.away ? (config.lang === 'zh' ? '未在记录 Alt+Shift+B' : 'Not recording Alt+Shift+B')
          : config.lang === 'zh' ? '第 2 轮 · 3 个 bug Alt+Shift+B' : 'Round 2 · 3 bugs Alt+Shift+B';
      // innerText skips the visually hidden "Saved " only if it is clipped; compare accessible text.
      assert.equal(row.text.replace(/^Saved\s*/, config.saved ? 'Saved ' : ''), expected, state);
      const file = `${shots}/${state}.png`;
      await evidenceShot(page, file, { target: page.locator('#popup') }); files.push(file);
      heights[state] = await checkFixedHeight(page, state);
      liveRects[state] = await page.evaluate(liveRegions);
      if (panel) panels.push([panel, state]);
    }
    // The store popup's main page plus the dev card's 46 px fill the fixed height exactly in the
    // tallest dev state (checkFixedHeight above).
    console.log('Dev states:');
    for (const [name, , color] of devCases) console.log(`  ${`${name}-${color}`.padEnd(24)} ${heights[`${name}-${color}`]} px  row "${rows[`${name}-${color}`].text}"`);
    const refs = process.env.BUTTER_DEV_MOCKUP ? await compareMockup(process.env.BUTTER_DEV_MOCKUP, panels, 'Dev mockup (#32), dev-*-after panels (historical, report-only)') : [];

    // ---- actions, keyboard, focus and motion ----
    await page.bringToFront();
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
    await page.evaluate(async () => {
      fixtureConnected = true;
      await chrome.storage.local.set({ butter: ButterStatus.normalize({ layoutConsent: 'granted', lang: 'en' }), butterDev: { round: 2, bugs: 3 } });
    });
    const strip = () => page.locator('.strip').innerText().then(t => t.replace(/\s+/g, ' ').trim());
    await page.waitForFunction(() => /Round 2 · 3 bugs/.test(document.querySelector('.strip').textContent));
    // The dot pulses at 1.6 s and stands still under reduced motion.
    assert.deepEqual(await page.locator('.rec').evaluate(e => [getComputedStyle(e).animationName, getComputedStyle(e).animationDuration]), ['rec', '1.6s']);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await page.locator('.rec').evaluate(e => getComputedStyle(e).animationName), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    // New round from the keyboard: the focus ring shows, the count resets, and a reopened popup
    // reads the new round back.
    await page.keyboard.press('Tab');
    await page.locator('[data-dev="new-round"]').focus();
    assert.equal(await page.locator('[data-dev="new-round"]').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Round 3 · 0 bugs/.test(document.querySelector('.strip').textContent));
    assert.deepEqual(await page.evaluate(() => chrome.storage.local.get('butterDev').then(r => r.butterDev)), { round: 3, bugs: 0 });
    await page.reload(); await page.waitForSelector('.card.dev'); await fixtureTab();
    await page.waitForFunction(() => /Round 3 · 0 bugs/.test(document.querySelector('.strip').textContent));
    // Open round folder before the round's first save: the round folder does not exist yet, so it
    // opens the Downloads folder.
    await page.locator('[data-dev="open"]').click();
    await page.waitForFunction(() => shown.length === 1);
    assert.deepEqual(await page.evaluate(() => shown), [['default']]);
    // The save button takes the shortcut's path through the real worker, with trigger "button".
    // Only the tab's snapshot reply is a fixture; the download is real.
    await worker.evaluate(() => {
      // Playwright stores downloads under its own names, so record the path the worker asks for.
      const download = chrome.downloads.download.bind(chrome.downloads);
      globalThis.asked = [];
      chrome.downloads.download = options => (asked.push(options.filename), download(options));
      globalThis.requests = [];
      chrome.tabs.sendMessage = async (tab, message) => {
        // The toast message (#45) that follows a completed download needs no reply here.
        if (message.type !== 'butter-dev-snapshot') return;
        requests.push([tab, message.request.trigger, message.request.round, message.request.bug]);
        return { snapshot: JSON.stringify({ kind: 'butter-diag', savedAt: new Date().toISOString() }) };
      };
    });
    const before = await page.locator('#popup').evaluate(e => e.offsetHeight);
    await page.keyboard.press('Tab'); // keyboard modality, so focus() shows the ring
    await page.locator('[data-dev="save"]').focus();
    assert.equal(await page.locator('[data-dev="save"]').evaluate(e => getComputedStyle(e).outlineStyle), 'solid');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /bug-01_\d\d-\d\d-\d\d\.json/.test(document.querySelector('.strip').textContent));
    assert.deepEqual(await worker.evaluate(() => requests), [[1, 'button', 3, 1]]);
    const saved = await page.evaluate(() => chrome.storage.local.get('butterDev').then(r => r.butterDev));
    assert.equal(saved.round, 3); assert.equal(saved.bugs, 1); assert.match(saved.file, /^bug-01_/);
    assert.deepEqual(await worker.evaluate(() => asked), [`butter-diag/round-3/${saved.file}`]);
    const [item] = await worker.evaluate(id => chrome.downloads.search({ id }), saved.download);
    assert.ok(item, 'the saved download exists');
    assert.equal(await page.locator('.strip .vh').textContent(), 'Saved ');
    assert.equal(await page.locator('.strip .ib:visible').count(), 0);
    assert.equal(await page.locator('[data-dev="save"]').isEnabled(), true);
    assert.equal(await page.locator('#popup').evaluate(e => e.offsetHeight), before, 'just saved changed the height');
    const focused = () => page.evaluate(() => document.activeElement?.dataset.dev);
    assert.equal(await focused(), 'save', 'a keyboard save moved focus off the save button');
    // After about 4 s the card counts again, and Open round folder shows the saved file.
    await page.waitForFunction(() => /Round 3 · 1 bug(?!s)/.test(document.querySelector('.strip').textContent), null, { timeout: 5000 });
    assert.equal(await focused(), 'save', 'the 4 s reset moved focus off the save button');
    await page.locator('[data-dev="open"]').click();
    await page.waitForFunction(() => shown.length === 2);
    assert.deepEqual(await page.evaluate(() => shown[1]), ['show', saved.download]);
    console.log(`Dev actions: New round -> "${'Round 3 · 0 bugs'}" (kept after reload), save -> butter-diag/round-3/${saved.file} (download ${item.state}), then "${await strip()}"`);
    return { refs, rows, states: devCases.length };
  } finally {
    await context.close();
  }
}
