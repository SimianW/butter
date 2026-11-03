import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const chat = context.pages().find(p => p.url().startsWith('https://chatgpt.com'));
const originalUrl = chat.url();
const href = await chat.locator('a[href*="/c/"]').first().getAttribute('href').catch(() => null);
console.log('Existing conversation available:', !!href);
if (!href) { await browser.close(); process.exit(0); }
await chat.goto(new URL(href, 'https://chatgpt.com').href);
await chat.locator('[data-turn-key]').first().waitFor({ timeout: 30000 });
const popup = await context.newPage();
await popup.goto('chrome://extensions');
const id = await popup.evaluate(() => new Promise(r => chrome.developerPrivate.getExtensionsInfo({}, rows => r(rows.find(x => x.name === 'Butter for ChatGPT').id))));
await popup.goto(`chrome-extension://${id}/popup/popup.html`);
await chat.bringToFront();
const tabId = await popup.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
const defaults = { enabled: true, opts: { container: true, cv: true, throttle: true, older: true, rail: true }, lang: 'en' };
const store = value => popup.evaluate(value => chrome.storage.local.set({ butter: value }), value);
const status = () => popup.evaluate(id => chrome.tabs.sendMessage(id, { type: 'butter-status' }), tabId);
await store(defaults);
await chat.waitForTimeout(1600);
console.log('Initial status:', await status());
const wrapper = chat.locator('div.\\[container-type\\:inline-size\\].min-h-full').filter({ visible: true }).first();
assert.equal(await wrapper.evaluate(e => getComputedStyle(e).containerType), 'normal');
await store({ ...defaults, opts: { ...defaults.opts, container: false } });
await chat.waitForFunction(() => document.documentElement.getAttribute('data-butter-off')?.includes('container'));
assert.notEqual(await wrapper.evaluate(e => getComputedStyle(e).containerType), 'normal');
console.log('PASS: container switch changes computed container-type live.');
await store({ ...defaults, opts: { ...defaults.opts, cv: false } });
await chat.waitForFunction(() => document.documentElement.getAttribute('data-butter-off') === 'cv');
assert.equal(await chat.locator('[data-turn-key]').filter({ visible: true }).first().evaluate(e => getComputedStyle(e).contentVisibility), 'visible');
await store(defaults);
await chat.waitForFunction(() => [...document.querySelectorAll('[data-turn-key][data-butter-seen]')].some(e => getComputedStyle(e).contentVisibility === 'auto'));
console.log('PASS: off-screen content switch changes computed content-visibility live.');
await store({ ...defaults, opts: { ...defaults.opts, rail: false } });
await chat.waitForFunction(() => document.querySelector('chatgpt-butter-nav')?.style.display === 'none');
assert.equal(await chat.locator('chatgpt-butter-nav').evaluate(e => e.inert), true);
await store({ ...defaults, lang: 'zh' });
await chat.waitForFunction(() => document.querySelector('chatgpt-butter-nav')?.shadowRoot.querySelector('nav').getAttribute('aria-label') === '对话中的问题');
assert.equal(await chat.locator('chatgpt-butter-nav').evaluate(e => e.style.display), '');
console.log('PASS: question rail hides, becomes inert, resumes, and changes language live.');
// Exercise the exact known callback locally without sending any ChatGPT message.
// Use a method so the callback's `this` matches ChatGPT's actual smoother.
const runSmoother = () => chat.evaluate(async () => {
  const s = { frame: null, count: 0, publish() { this.count++; }, arm() {
    if (this.frame == null) this.frame = requestAnimationFrame(() => { this.frame = void 0, this.publish() });
  } };
  for (let i = 0; i < 12; i++) { s.arm(); await new Promise(r => setTimeout(r, 20)); }
  if (s.frame != null) cancelAnimationFrame(s.frame);
  return s.count;
});
await store(defaults); await chat.waitForFunction(() => !document.documentElement.hasAttribute('data-butter-off'));
const onFrames = await runSmoother();
await store({ ...defaults, opts: { ...defaults.opts, throttle: false } });
await chat.waitForFunction(() => document.documentElement.getAttribute('data-butter-off') === 'throttle');
const offFrames = await runSmoother(); assert.ok(offFrames > onFrames, `${onFrames} vs ${offFrames}`);
console.log(`PASS: throttle switch live, local smoother published ${onFrames} on / ${offFrames} off.`);
// Intercept a synthetic older request in the browser; no request reaches ChatGPT.
const probeUrl = new URL(chat.url());
const conv = /\/c\/([0-9a-f-]{36})/.exec(probeUrl.pathname)?.[1];
assert.ok(conv);
const sizes = [];
await context.route('**/backend-api/conversations/*/messages?*butter_probe*', route => {
  sizes.push(new URL(route.request().url()).searchParams.get('num_turns'));
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
});
const fetchOlder = () => chat.evaluate(conv => fetch(`/backend-api/conversations/${conv}/messages?butter_probe=1&num_turns=10`).then(r => r.json()), conv);
await store(defaults); await chat.waitForFunction(() => !document.documentElement.hasAttribute('data-butter-off')); await fetchOlder();
await store({ ...defaults, opts: { ...defaults.opts, older: false } });
await chat.waitForFunction(() => document.documentElement.getAttribute('data-butter-off') === 'older'); await fetchOlder();
assert.deepEqual(sizes, ['2','10']);
console.log('PASS: older-page switch live, intercepted num_turns 2 on / 10 off.');
await context.unroute('**/backend-api/conversations/*/messages?*butter_probe*');
await store({ ...defaults, enabled: false });
await chat.waitForFunction(() => document.documentElement.getAttribute('data-butter-off')?.split(' ').length === 5);
assert.ok(Object.values((await status()).states).every(x => x === 'off'));
await chat.evaluate(() => document.documentElement.removeAttribute('data-butter-off'));
await chat.waitForFunction(() => document.documentElement.getAttribute('data-butter-off')?.split(' ').length === 5);
console.log('PASS: master switch disables all five; removed off marker is restored.');
await store(defaults); await chat.waitForTimeout(200);
const final = await status(); assert.equal(final.states.older, 'ok'); assert.equal(final.states.throttle, 'ok'); console.log('Final status:', final);
await popup.close(); await chat.goto(originalUrl); await browser.close();
