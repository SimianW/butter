import test from 'node:test';
import assert from 'node:assert/strict';
import model from '../extension/popup/model.js';

test('usage formatting uses a comma, decimal cap units, one MB decimal and integer KB', () => {
  assert.equal(model.formatUsage({ conversations: 3, bytes: 1_200_000 }), '3 chats, about 1.2 MB');
  assert.equal(
    model.formatUsage({ conversations: 3, bytes: 1_200_000 }, 'zh'),
    '3 个对话，约 1.2 MB',
  );
  assert.equal(
    model.formatUsage({ conversations: 12, bytes: 8_400_000 }, 'zh'),
    '12 个对话，约 8.4 MB',
  );
  assert.equal(
    model.formatUsage({ conversations: 12, bytes: 8_400_000 }),
    '12 chats, about 8.4 MB',
  );
  assert.equal(model.formatUsage({ conversations: 1, bytes: 99_499 }), '1 chat, about 99 KB');
  assert.equal(model.formatUsage({ conversations: 1, bytes: 100_000 }), '1 chat, about 0.1 MB');
  assert.equal(model.formatUsage(), '0 chats, about 0 KB');
  assert.equal(model.usageFill(8_400_000), 16.8);
  assert.equal(model.usageFill(70_000_000), 100);
  assert.equal(model.usageFill(-1), 0);
});
test('clear requires explicit confirmation and holds completion until its timeout', () => {
  const flow = model.clearFlow;
  assert.equal(flow('idle', 'confirm'), 'idle');
  assert.equal(flow('idle', 'ask'), 'confirm');
  assert.equal(flow('confirm', 'cancel'), 'idle');
  assert.equal(flow('confirm', 'confirm'), 'clearing');
  assert.equal(flow('clearing', 'cancel'), 'clearing');
  assert.equal(flow('clearing', 'success'), 'done');
  assert.equal(flow('done', 'ask'), 'done');
  assert.equal(flow('done', 'timeout'), 'idle');
  assert.equal(flow('clearing', 'error'), 'error');
  assert.equal(flow('error', 'ask'), 'confirm');
});
test('layout calls retry the same clear id three times and surface exhausted errors', async () => {
  const request = { version: 1, type: 'butter-layout-clear', requestId: 'fixed' },
    calls = [];
  assert.deepEqual(
    await model.layoutRequest(async (req) => {
      calls.push(req);
      if (calls.length < 3) throw Error('closed port');
      return { bytes: 0, conversations: 0 };
    }, request),
    { bytes: 0, conversations: 0 },
  );
  assert.equal(calls.length, 3);
  assert.ok(calls.every((x) => x === request));
  let count = 0;
  await assert.rejects(
    model.layoutRequest(async () => {
      count++;
      return { error: 'layout-storage' };
    }, request),
    /layout-storage/,
  );
  assert.equal(count, 3);
});
test('version label is the manifest version_name as written', () => {
  assert.equal(model.versionLabel('0.1.0-alpha.15'), '0.1.0-alpha.15');
  assert.equal(model.versionLabel('0.1.0-alpha'), '0.1.0-alpha');
  assert.equal(model.versionLabel('0.1.0'), '0.1.0');
});
