const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/seek/core-main.js');

// Known literals cover the exact trust guard, including stored geometry's height exception.
test('layout rejection codes explain the model guard without weakening it', () => {
  const good = { sw: 931, rowH: 4887, items: [{ top: 0, h: 26 }] };
  for (const [record, height, sw, expected] of [
    [null, 4887.265625, 931, 'no-record'],
    [{ ...good, items: [] }, 4887, 931, 'no-items'],
    [good, 4887, 916, 'sw-mismatch'],
    [good, 0, 931, 'no-measured'],
    [good, 4800, 931, 'height-mismatch'],
    [good, 4887.265625, 931, null],
    [good, 4889, 931, null],
    [good, 4889.01, 931, 'height-mismatch'],
    [{ ...good, fromStorage: true }, 0, 931, null],
    [{ ...good, fromStorage: true }, 0, 916, 'sw-mismatch'],
    [good, 4887, undefined, null],
  ]) {
    assert.equal(core.layoutReason(record, height, sw), expected);
    const model = core.buildModel({
      ids: ['synthetic'],
      measured: { synthetic: height },
      records: { synthetic: record },
      texts: {},
      scrollHeight: 5000,
      gap: 12,
      sw,
    });
    assert.equal(model[0].layout, expected === null);
  }
});
