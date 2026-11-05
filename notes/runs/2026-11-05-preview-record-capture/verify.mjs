import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';

const owner = 'butter-8302ad9c-diagnostic';
const lab = { ...L.getLab(1), owner };
assert.equal(L.lockStatus(1)[0].owner, owner, 'hold the documented lab lock');
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
const source = fs.readFileSync('notes/diagnostics/capture-preview-record.js', 'utf8');
let popup, original;
const result = [];
try {
  const page =
    context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) ||
    (await context.newPage());
  const errors = [];
  page.on('pageerror', (error) => errors.push(error));
  await page.goto(L.fixture(lab, 'math12'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(
    () => document.querySelector('[data-turn-key]') && globalThis.__butterLayoutCache,
  );
  const extensionId = createHash('sha256')
    .update('/home/simon/snap/chromium/common/butter-8302ad9c')
    .digest('hex')
    .slice(0, 32)
    .replace(/[0-9a-f]/g, (digit) => String.fromCharCode(97 + parseInt(digit, 16)));
  popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup/popup.html`);
  original = await popup.evaluate(() => chrome.storage.local.get('butter'));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Runtime.enable');
  // copy() asks the DevTools frontend to write the clipboard. With no frontend attached,
  // capture that real command-line API event rather than replacing copy() with a stub.
  // A private attribute VALUE canary; names are allowed, values must never leave the page.
  await page.evaluate(() =>
    document
      .querySelectorAll('[data-markdown-text-style="assistant-message"]')
      .forEach((node) =>
        node.setAttribute('data-diagnostic-canary', 'PRIVATE_ATTRIBUTE_VALUE_8302ad9c'),
      ),
  );
  const ready = await page.waitForFunction(
    () => {
      const t = document.querySelector('[data-turn-key]');
      return !!__butterLayoutCache.get(t.dataset.turnKey)?.items.length;
    },
    null,
    { timeout: 60000 },
  );
  await ready.dispose();
  async function run(label, expression, action) {
    const copyRequest = once(cdp, 'Runtime.inspectRequested', {
      signal: AbortSignal.timeout(30000),
    });
    void copyRequest.catch(() => {}); // Keep cleanup reachable if the separate console wait fails.
    await page.evaluate(() =>
      document
        .querySelectorAll('[data-turn-key]')
        .forEach((node) =>
          node.setAttribute('data-diagnostic-canary', 'PRIVATE_ATTRIBUTE_VALUE_8302ad9c'),
        ),
    );
    const copied = page.waitForEvent('console', {
      predicate: (msg) =>
        msg.text() === 'Butter diagnostic JSON copied. Only share the clipboard JSON.',
      timeout: 30000,
    });
    const evaluated = await cdp.send('Runtime.evaluate', {
      expression,
      includeCommandLineAPI: true,
      userGesture: true,
    });
    assert.equal(evaluated.exceptionDetails, undefined, 'snippet has no synchronous error');
    if (action) await action();
    await copied;
    assert.equal(errors.length, 0, 'no page errors during capture');
    const [copyEvent] = await copyRequest;
    assert.equal(copyEvent.hints.copyToClipboard, true);
    const raw = copyEvent.object.value;
    assert.equal(typeof raw, 'string', 'actual copy() requested clipboard JSON');
    const data = JSON.parse(raw);
    assert.ok(data.memory?.items.length);
    assert.equal(data.dom.mounted, true);
    assert.ok(
      data.dom.turn.some((node) => node.dataAttributeNames.includes('data-diagnostic-canary')),
    );
    for (const item of data.memory.items) {
      for (const key of [
        'kind',
        'height',
        'top',
        'textLength',
        'math',
        'fallback',
        'estimate',
        'source',
        'flags',
      ])
        assert.ok(key in item);
    }
    const allowedStrings = new Set([
      'measured',
      'restored',
      'persisted',
      'user',
      'display-math',
      'paragraph',
      'heading',
      'code',
      'table',
      'list',
      'separator',
      'block',
      'active-preview-update',
      'explicit-index',
      'disabled',
      'found',
      'not-found',
      'bridge-timeout',
      'account-unavailable',
      'conversation-unavailable',
      'load-failed',
      'auto',
      'visible',
      'hidden',
    ]);
    const inspect = (value, path = []) => {
      if (typeof value === 'string') {
        const parent = path.at(-2),
          key = path.at(-1);
        assert.ok(
          allowedStrings.has(value) ||
            key === 'tag' ||
            ['classes', 'dataAttributeNames'].includes(parent),
          `unexpected string field: ${path.join('.')}`,
        );
        assert.ok(!/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9-]{20,}|https?:\/\/|[a-f0-9]{64}/i.test(value));
      } else if (value && typeof value === 'object')
        for (const [key, child] of Object.entries(value)) inspect(child, [...path, key]);
    };
    inspect(data);
    const privacy = await page.evaluate((raw) => {
      const walker = document.createTreeWalker(
        document.querySelector('.thread-scroll-container'),
        NodeFilter.SHOW_TEXT,
      );
      let checked = 0;
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const text = node.textContent.trim();
        if (text.length < 16) continue;
        checked++;
        if (raw.includes(text) || raw.includes(JSON.stringify(text).slice(1, -1)))
          return { ok: false, checked };
      }
      return {
        ok: !raw.includes('PRIVATE_ATTRIBUTE_VALUE_8302ad9c') && !raw.includes(location.href),
        checked,
      };
    }, raw);
    assert.equal(privacy.ok, true, 'no page text, URL or attribute value');
    assert.ok(privacy.checked > 0);
    fs.writeFileSync(`notes/runs/2026-11-05-preview-record-capture/${label}.json`, raw + '\n');
    const row = {
      label,
      turnIndex: data.turnIndex,
      memorySource: data.memory.source,
      items: data.memory.items.length,
      domElements: data.dom.turn.length,
      previewActive: data.preview.active,
      renderedItems: data.preview.renderedItems.length,
      persistedStatus: data.persisted.status,
      persistedRecords: data.persisted.records.length,
      privacyCheckedTextNodes: privacy.checked,
      privacy: 'pass',
    };
    result.push(row);
    console.log(JSON.stringify(row));
    return data;
  }
  // Existing consent may be pending/off. Exercise disabled explicitly, then restore exactly.
  await popup.evaluate(async () => {
    const { butter = {} } = await chrome.storage.local.get('butter');
    await chrome.storage.local.set({
      butter: { ...butter, layoutConsent: 'pending', opts: { ...butter.opts, layout: false } },
    });
  });
  await page.waitForTimeout(300);
  const explicit = await run(
    'explicit',
    source.replace('const TURN_INDEX = null;', 'const TURN_INDEX = 0;'),
  );
  assert.equal(explicit.persisted.status, 'disabled');
  // Real saved records, created by Butter itself from this lab chat, then a reload/read.
  await popup.evaluate(async () => {
    const { butter = {} } = await chrome.storage.local.get('butter');
    await chrome.storage.local.set({
      butter: { ...butter, layoutConsent: 'granted', opts: { ...butter.opts, layout: true } },
    });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const t = document.querySelector('[data-turn-key]');
    return t && __butterLayoutCache?.get(t.dataset.turnKey)?.items.length;
  });
  await page.evaluate(() =>
    document
      .querySelectorAll('[data-markdown-text-style="assistant-message"]')
      .forEach((node) =>
        node.setAttribute('data-diagnostic-canary', 'PRIVATE_ATTRIBUTE_VALUE_8302ad9c'),
      ),
  );
  await page.evaluate(async () => {
    __butterLayoutCache.flushMeasurements();
    await __butterLayoutCache.flush();
  });
  await page.waitForFunction(() => __butterLayoutCache.dump().entries > 0, null, {
    timeout: 60000,
  });
  const saved = await run(
    'saved',
    source.replace('const TURN_INDEX = null;', 'const TURN_INDEX = 0;'),
  );
  assert.equal(saved.persisted.status, 'found');
  assert.ok(
    saved.persisted.records.every(
      (r) =>
        r.source === 'persisted' &&
        r.items.every((i) => i.textLength === null && i.flags.textLengthUnavailable),
    ),
  );
  // Native scrollbar drag, no synthetic seek events or replacement recorder.
  await page.evaluate(() => {
    document.querySelector('.thread-scroll-container').scrollTop = 0;
  });
  await page.waitForTimeout(500);
  await run('armed-drag', source, async () => {
    const geometry = await page.evaluate(() => {
      const sc = document.querySelector('.thread-scroll-container'),
        r = sc.getBoundingClientRect();
      return {
        x: r.right - 3,
        y: r.top + ((sc.scrollTop + sc.clientHeight / 2) / sc.scrollHeight) * sc.clientHeight,
      };
    });
    await page.mouse.move(geometry.x, geometry.y);
    await page.mouse.down();
    await page.mouse.move(geometry.x, geometry.y + 3, { steps: 3 });
  });
  await page.mouse.up();
  fs.writeFileSync(
    'notes/runs/2026-11-05-preview-record-capture/checks.json',
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    'PASS: actual DevTools copy(), explicit index, native armed drag, persisted records, privacy allowlist and page-text checks.',
  );
} finally {
  if (popup && original) {
    await popup.evaluate(async (saved) => {
      if (Object.hasOwn(saved, 'butter')) await chrome.storage.local.set(saved);
      else await chrome.storage.local.remove('butter');
    }, original);
  }
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}
