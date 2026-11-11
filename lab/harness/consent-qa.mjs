// Consent card fixture QA. Real MV3 extension over a synthetic ChatGPT-like page: every
// chatgpt.com request is fulfilled locally and the run fails if anything else is requested.
// Renders the pending "remember layouts" card in light/English and dark/Chinese, compares each
// with the approved mockup panel (#35: consent-light-en-after, consent-dark-zh-after), and checks
// the dark shadow, the secondary button's hover and the 3 px deep-butter focus ring.
// Run: npm ci && BUTTER_CONSENT_MOCKUP=<1-Mockup.html> node lab/harness/consent-qa.mjs
// SHOTS=<dir> sets the screenshot directory (default /tmp/butter-consent-qa).
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const mockup = process.env.BUTTER_CONSENT_MOCKUP;
assert.ok(mockup, 'Set BUTTER_CONSENT_MOCKUP to the approved #35 mockup');
const shots = process.env.SHOTS || '/tmp/butter-consent-qa';
await fs.mkdir(shots, { recursive: true });
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'butter-consent-qa-'));
// Wider than the card's 760 px small-screen rule, so the card keeps its 300 px width.
const viewport = { width: 1000, height: 700 };
const context = await chromium.launchPersistentContext(profile, {
  headless: true,
  channel: 'chromium',
  viewport,
  args: [
    `--disable-extensions-except=${repo}/extension`,
    `--load-extension=${repo}/extension`,
    // The card fades on its own compositing layer, which draws grayscale text; the panel would
    // otherwise get LCD text, and every glyph edge would count as a difference.
    '--disable-lcd-text',
  ],
});
const errors = [],
  foreign = [];
context.on('page', (p) => p.on('pageerror', (e) => errors.push(e.message)));

// The panel's page: white or #212121 background and a composer 16 px under the card. The composer
// carries ChatGPT's test id and sits above the card's default 82 px offset, so the card's composer
// avoidance puts the card 16 px above it, as in the panel.
const fixture = (theme, lang) => `<!doctype html><html lang="${lang}" class="${theme}"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;height:100%}body{font-family:system-ui,sans-serif;background:#fff}.dark body{background:#212121}
.composer{position:absolute;right:30px;bottom:100px;width:300px;height:52px;border-radius:26px;border:1px solid #e3e3e3;background:#fff;display:flex;align-items:center;padding:0 18px;color:#8f8f8f;font-size:14px;gap:10px}
.composer b{font-weight:400;font-size:20px;color:#5d5d5d}.dark .composer{background:#303030;border-color:#424242;color:#9b9b9b}.dark .composer b{color:#cdcdcd}
</style></head><body><div class="composer" data-testid="composer"><b>+</b> ${lang === 'zh' ? '询问 ChatGPT' : 'Ask ChatGPT'}</div></body></html>`;
let page$ = { theme: 'light', lang: 'en' };
await context.route('**/*', (route) => {
  const url = new URL(route.request().url());
  // The mockup, its panels and the extension's bundled font are local.
  if (['file:', 'data:', 'chrome-extension:'].includes(url.protocol)) return route.continue();
  if (url.hostname !== 'chatgpt.com') {
    foreign.push(url.href);
    return route.abort();
  }
  return route.fulfill({ contentType: 'text/html', body: fixture(page$.theme, page$.lang) });
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent('serviceworker'));

const png = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
// Share of pixels that differ by more than 24 in any channel.
async function compare(page, a, b) {
  return page.evaluate(
    async ([a, b]) => {
      const load = (src) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
      const [x, y] = await Promise.all([load(a), load(b)]);
      if (x.width !== y.width || x.height !== y.height)
        return { size: [x.width, x.height, y.width, y.height] };
      const data = (img) => {
        const c = new OffscreenCanvas(img.width, img.height),
          g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const p = data(x),
        q = data(y);
      let n = 0;
      for (let k = 0; k < p.length; k += 4)
        if (
          Math.max(
            Math.abs(p[k] - q[k]),
            Math.abs(p[k + 1] - q[k + 1]),
            Math.abs(p[k + 2] - q[k + 2]),
          ) > 24
        )
          n++;
      return { ratio: n / (p.length / 4) };
    },
    [await png(a), await png(b)],
  );
}

const mock = await context.newPage({ viewport: { width: 1600, height: 900 } });
await mock.goto(`file://${path.resolve(mockup)}`);
const results = [];
const deepButter = { light: 'rgb(242, 194, 58)', dark: 'rgb(201, 165, 63)' };
const track = { light: 'rgb(227, 218, 195)', dark: 'rgb(58, 51, 40)' };
try {
  for (const { theme, lang, panel } of [
    { theme: 'light', lang: 'en', panel: 'consent-light-en-after' },
    { theme: 'dark', lang: 'zh', panel: 'consent-dark-zh-after' },
  ]) {
    // Reference: the panel's own document at the page origin.
    const srcdoc = await mock
      .locator(`iframe[data-panel="${panel}"]`)
      .evaluate((f) => new Promise((r) => (f.srcdoc ? r(f.srcdoc) : f.addEventListener('load', () => r(f.srcdoc)))));
    const doc = path.join(profile, `${panel}.html`);
    await fs.writeFile(doc, srcdoc);
    const ref = await context.newPage({ viewport: { width: 360, height: 600 } });
    await ref.goto(`file://${doc}`);
    await ref.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
    const reference = `${shots}/${panel}.png`;
    const height = await ref.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
    await ref.screenshot({ path: reference, clip: { x: 0, y: 0, width: 360, height } });
    await ref.close();

    // Built: the real card on the fixture page, pending consent, in the panel's language.
    page$ = { theme, lang };
    await worker.evaluate((butter) => chrome.storage.local.set({ butter }), { enabled: true, lang });
    const page = await context.newPage();
    await page.goto('https://chatgpt.com/');
    await page.waitForSelector('chatgpt-butter-consent[data-visible]', { timeout: 5000 });
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 500))));
    // The panel's card starts on a whole pixel; raise the composer by the card's fraction so this
    // one does too (the card sits 16 px above the composer), then let the card reposition.
    const fraction = (await page.locator('chatgpt-butter-consent').boundingBox()).y % 1;
    await page.evaluate((f) => {
      document.querySelector('.composer').style.bottom = `${100 + f}px`;
      dispatchEvent(new Event('resize'));
    }, fraction);
    await page.waitForFunction(() => {
      const y = document.querySelector('chatgpt-butter-consent').getBoundingClientRect().y;
      return Math.abs(y - Math.round(y)) < 0.02;
    });
    const box = await page.locator('chatgpt-butter-consent').boundingBox();
    box.y = Math.round(box.y);
    const built = `${shots}/consent-${theme}-${lang}-built.png`;
    // The panel's frame: 30 px beside the card, 20 px above it, and through the 52 px composer to 14 px below.
    await page.screenshot({
      path: built,
      clip: { x: box.x - 30, y: box.y - 20, width: 360, height: Math.ceil(20 + box.height + 16 + 52 + 14) },
    });
    const diff = await compare(page, built, reference);
    results.push({ panel, built, reference, ...diff });
    console.log(JSON.stringify(results.at(-1)));

    const card = page.locator('chatgpt-butter-consent .card');
    const shadow = await card.evaluate((e) => getComputedStyle(e).boxShadow);
    if (theme === 'dark')
      assert.match(shadow, /rgba\(0, 0, 0, 0\.45\).*rgba\(0, 0, 0, 0\.3\)/, `dark shadow: ${shadow}`);
    const border = await card.evaluate((e) => getComputedStyle(e).borderTopWidth);
    // 1.5 px; Chromium snaps it to whole device pixels.
    assert.ok(parseFloat(border) <= 1.5, `the card has a hairline border, not an outline: ${border}`);

    // Hover on "No thanks" shows the track colour.
    await page.locator('chatgpt-butter-consent button[data-choice="no"]').hover();
    const hover = await page
      .locator('chatgpt-butter-consent button[data-choice="no"]')
      .evaluate((e) => getComputedStyle(e).backgroundColor);
    assert.equal(hover, track[theme], `${theme} secondary hover`);
    await page.mouse.move(0, 0);

    // Keyboard focus ring on the link and both buttons.
    for (const selector of ['a', 'button[data-choice="no"]', 'button[data-choice="yes"]']) {
      const el = page.locator(`chatgpt-butter-consent ${selector}`);
      await el.focus();
      await page.keyboard.press('Shift+Tab');
      await page.keyboard.press('Tab');
      const ring = await el.evaluate((e) => {
        const s = getComputedStyle(e);
        return {
          focus: e.matches(':focus-visible'),
          outline: `${s.outlineWidth} ${s.outlineStyle} ${s.outlineColor}`,
          offset: s.outlineOffset,
        };
      });
      assert.deepEqual(
        ring,
        { focus: true, outline: `3px solid ${deepButter[theme]}`, offset: '3px' },
        `${theme} ${selector} focus ring`,
      );
    }
    await page.close();
  }
  for (const r of results)
    assert.ok(r.ratio !== undefined && r.ratio < 0.001, `${r.panel} differs from the mockup: ${JSON.stringify(r)}`);
  assert.deepEqual(foreign, [], 'no requests outside the fixture');
  assert.deepEqual(errors, [], 'no page errors');
  console.log('consent-qa: ok');
} finally {
  await context.close();
  await fs.rm(profile, { recursive: true, force: true });
}
