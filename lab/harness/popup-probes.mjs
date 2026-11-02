// A ChatGPT-origin fixture runs the real content scripts without ChatGPT requests.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.connectOverCDP('http://127.0.0.1:9222');
const context = browser.contexts()[0];
const fixture = await context.newPage();
const url = 'https://chatgpt.com/c/00000000-0000-0000-0000-000000000008?butter_fixture=1';
await context.route(url, route => route.fulfill({ status: 200, contentType: 'text/html', body: `<!doctype html><html><body>
<div class="thread-scroll-container" style="width:900px;height:900px;overflow:auto">
<div class="[container-type:inline-size] min-h-full" style="container-type:inline-size">
<article data-turn-key="fixture"><div data-user-message-bubble>Fixture question</div>
<div data-markdown-text-style="assistant-message"><p>Fixture answer</p></div></article>
</div></div></body></html>` }));
await fixture.goto(url);
const popup = await context.newPage(); await popup.goto('chrome://extensions');
const id = await popup.evaluate(() => new Promise(r => chrome.developerPrivate.getExtensionsInfo({}, rows => r(rows.find(x => x.name === 'Butter for ChatGPT').id))));
await popup.goto(`chrome-extension://${id}/popup.html`); await fixture.bringToFront();
const tabId = await popup.evaluate(async () => (await chrome.tabs.query({ active: true, currentWindow: true }))[0].id);
const status = () => popup.evaluate(id => chrome.tabs.sendMessage(id, { type: 'butter-status' }).then(x => x.states), tabId);
await popup.evaluate(() => chrome.storage.local.remove('butter'));
const initial = await status(); assert.equal(initial.container, 'ok'); assert.equal(initial.throttle, 'wait'); assert.equal(initial.older, 'wait');
console.log('PASS: real content script reports unexercised throttle/older as wait.');
await fixture.evaluate(() => document.querySelector('.min-h-full').className = 'changed-selector');
assert.equal((await status()).container, 'fail');
console.log('PASS: observed turns with a missing wrapper selector report fail.');
await fixture.evaluate(() => document.querySelector('article').setAttribute('data-talvt-turn-state', 'in_progress'));
await status();
await fixture.waitForTimeout(2300);
assert.equal((await status()).throttle, 'fail');
console.log('PASS: a streaming turn observed for over 2 seconds without a matching smoother reports fail.');
await fixture.waitForTimeout(3000);
const later = await status(); assert.equal(later.rail, 'fail'); assert.equal(later.cv, 'ok');
console.log('PASS: missing conversation data after 5 seconds reports rail fail; marked content reports cv ok.');
await popup.evaluate(() => chrome.storage.local.set({ butter: { enabled: false } }));
await fixture.waitForFunction(() => document.documentElement.getAttribute('data-butter-off')?.split(' ').length === 5);
assert.ok(Object.values(await status()).every(s => s === 'off'));
console.log('PASS: missing storage defaults on; master off overrides every fixture status.');
await popup.evaluate(() => chrome.storage.local.remove('butter'));
const away = await context.newPage(); await away.goto('about:blank'); await away.bringToFront();
await popup.evaluate(() => poll());
assert.equal(await popup.locator('.big').textContent(), 'Open a ChatGPT chat');
console.log('PASS: a real tab without a content-script receiver shows the away state.');
await away.close();
await context.unroute(url); await fixture.close(); await popup.close(); await browser.close();
