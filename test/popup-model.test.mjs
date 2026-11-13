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
  assert.equal('usageFill' in model, false, 'the usage bar is gone');
});
test('a non-zero size under 1 KB reads 1 KB, never 0 KB, for both stores', () => {
  assert.equal(model.formatUsage({ conversations: 1, bytes: 120 }), '1 chat, about 1 KB');
  assert.equal(model.formatBookmarks({ count: 2, bytes: 120 }), '2 saved, about 1 KB');
  assert.equal(model.formatBookmarks({ count: 2, bytes: 499 }, 'zh'), '已保存 2 个，约 1 KB');
  assert.equal(model.formatBookmarks({ count: 0, bytes: 0 }), '0 saved, about 0 KB');
});
test('the bookmarks saved line in both languages', () => {
  assert.equal(model.formatBookmarks({ count: 12, bytes: 4_200 }), '12 saved, about 4 KB');
  assert.equal(model.formatBookmarks({ count: 1, bytes: 380 }), '1 saved, about 1 KB');
  assert.equal(model.formatBookmarks({ count: 12, bytes: 4_200 }, 'zh'), '已保存 12 个，约 4 KB');
  assert.equal(model.formatBookmarks({ count: 900, bytes: 310_000 }), '900 saved, about 0.3 MB');
});
test('the confirm question names the count, singular for one, in both languages', () => {
  const q = model.confirmQuestion;
  assert.equal(q('bookmarks', 12), 'Clear 12 bookmarks?');
  assert.equal(q('bookmarks', 1), 'Clear 1 bookmark?');
  assert.equal(q('layouts', 14), 'Clear 14 saved layouts?');
  assert.equal(q('layouts', 1), 'Clear 1 saved layout?');
  assert.equal(q('bookmarks', 12, 'zh'), '清除 12 个书签？');
  assert.equal(q('layouts', 14, 'zh'), '清除 14 个对话的已保存布局？');
});
test('a storage row’s second line, in priority order', () => {
  const line = model.storageLine;
  const base = { clear: 'idle', available: true, count: 3, needsRail: true };
  assert.equal(line({ ...base, clear: 'done', available: false }), 'cleared');
  assert.equal(line({ ...base, available: false }), 'unavailable');
  assert.equal(line({ ...base, clear: 'error' }), 'unavailable');
  assert.equal(line(base), 'saved');
  assert.equal(line({ ...base, count: 0 }), 'rail');
  assert.equal(line({ ...base, count: 0, needsRail: false }), 'description');
  // While it asks, the row is the question instead.
  assert.equal(line({ ...base, clear: 'confirm' }), 'confirm');
  assert.equal(line({ ...base, clear: 'clearing' }), 'confirm');
});
test('each store has its own clear machine', () => {
  let bookmarks = 'idle',
    layouts = 'idle';
  bookmarks = model.clearFlow(bookmarks, 'ask');
  assert.deepEqual([bookmarks, layouts], ['confirm', 'idle']);
  layouts = model.clearFlow(layouts, 'ask');
  bookmarks = model.clearFlow(bookmarks, 'cancel');
  assert.deepEqual([bookmarks, layouts], ['idle', 'confirm']);
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
test('store calls retry the same clear id three times and surface exhausted errors', async () => {
  const request = { version: 1, type: 'butter-layout-clear', requestId: 'fixed' },
    calls = [];
  assert.deepEqual(
    await model.storeRequest(async (req) => {
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
    model.storeRequest(async () => {
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
