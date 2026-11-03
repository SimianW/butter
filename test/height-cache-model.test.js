// Unit tests: height-cache recording rules, restore gate, coverage, preview model, re-target.
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/seek/core-main.js');

const base = { conv: 'c1', complete: true, mathReady: true, skipped: false, h: 5000, rowH: 5000, w: 768, vw: 1600, sw: 1243, msg: 'm1' };
const items = [{ top: 100, h: 60, left: 245, w: 768, text: 'q' }, { top: 190, h: 32, left: 245, w: 768, text: 'h1' }];

test('v1 failure: a turn seen before its blocks existed is not cached as zero blocks', () => {
  const r1 = core.mergeRecord(null, { ...base, blocks: [], items: [] }, 1);
  assert.equal(r1.entry, null); assert.equal(r1.reason, 'no-blocks');
  const r2 = core.mergeRecord(r1.entry, { ...base, blocks: [32, 26, 52], items }, 2);
  assert.equal(r2.reason, null); assert.deepEqual(r2.entry.blocks, [32, 26, 52]); assert.ok(r2.changed);
});
test('a snapshot with any zero-size block never replaces an authoritative record', () => {
  const good = core.mergeRecord(null, { ...base, blocks: [32, 26, 52], items }, 1).entry;
  const r = core.mergeRecord(good, { ...base, blocks: [32, 0, 52], items }, 2);
  assert.equal(r.reason, 'zero-block'); assert.equal(r.entry, good); assert.ok(!r.changed);
});
test('incomplete, math-pending and content-visibility-skipped snapshots keep the previous record', () => {
  const good = core.mergeRecord(null, { ...base, blocks: [10], items }, 1).entry;
  for (const [patch, why] of [[{ complete: false }, 'incomplete'], [{ mathReady: false }, 'math-pending'], [{ skipped: true }, 'skipped'], [{ h: 0 }, 'zero-turn']]) {
    const r = core.mergeRecord(good, { ...base, blocks: [10], items, ...patch }, 2);
    assert.equal(r.reason, why); assert.equal(r.entry, good);
  }
});
test('refresh after math typesetting replaces sizes and keeps the removed flag', () => {
  const first = core.mergeRecord(null, { ...base, h: 4000, blocks: [10, 20], items }, 1).entry;
  first.removed = true;
  const r = core.mergeRecord(first, { ...base, h: 4300, blocks: [10, 320], items }, 2);
  assert.ok(r.changed); assert.equal(r.entry.h, 4300); assert.equal(r.entry.removed, true); assert.equal(r.entry.records, 2);
});
test('a record from another conversation is replaced, not merged', () => {
  const other = core.mergeRecord(null, { ...base, conv: 'c0', blocks: [5], items }, 1).entry; other.removed = true;
  const r = core.mergeRecord(null, { ...base, blocks: [7], items }, 2);
  assert.equal(r.entry.removed, false); assert.equal(r.entry.conv, 'c1'); void other;
});
test('restore gate', () => {
  const e = { ...core.mergeRecord(null, { ...base, blocks: [10, 20, 30], items }, 1).entry, removed: true };
  const live = { conv: 'c1', vw: 1600, complete: true, msg: 'm1', mathReady: true, blockCount: 3 };
  assert.equal(core.canRestore(e, live), null);
  assert.equal(core.canRestore(e, { ...live, blockCount: 2 }), 'block-count');
  assert.equal(core.canRestore(e, { ...live, msg: 'm2' }), 'identity');
  assert.equal(core.canRestore(e, { ...live, vw: 1200 }), 'width');
  assert.equal(core.canRestore({ ...e, removed: false }, live), 'not-removed');
  assert.equal(core.canRestore(null, live), 'no-entry');
});
test('coverage reports which destination turns would miss', () => {
  const good = core.mergeRecord(null, { ...base, blocks: [10], items }, 1).entry;
  const map = { a: good, b: { ...good, blocks: [] }, c: { ...good, vw: 900 } };
  const cov = core.coverage(k => map[k], ['a', 'b', 'c', 'd'], { conv: 'c1', vw: 1600 });
  assert.deepEqual(cov.covered, ['a']);
  assert.deepEqual(cov.missing.map(m => m.why), ['no-blocks', 'width', 'no-entry']);
});

// ---- preview model / alignment ----
const texts = { a: { q: 'qa', answer: 'x'.repeat(100) }, b: { q: 'qb', answer: 'y'.repeat(5000) }, c: { q: 'qc', answer: 'z'.repeat(300) } };
test('model: measured heights + anchor give exact row tops; layout is used only when cache height matches', () => {
  const records = { b: { rowH: 3000, sw: 1243, items: [{ top: 40, h: 50 }, { top: 120, h: 26 }] }, c: { rowH: 999, sw: 1243, items: [{ top: 0, h: 10 }] } };
  const m = core.buildModel({ ids: ['a', 'b', 'c'], measured: { a: 500, b: 3000, c: 800 }, records, texts, scrollHeight: 4300, gap: 0, anchor: { id: 'b', top: 520 }, sw: 1243 });
  assert.deepEqual(m.map(t => t.top), [20, 520, 3520]);
  assert.deepEqual(m.map(t => t.layout), [false, true, false]); // c: cached 999 vs measured 800
  const flat = core.flatten(m);
  const it = flat.find(f => f.turn === 1 && f.index === 1);
  assert.equal(it.abs, 520 + 120); // the preview draws this block exactly where the real one sits
  const w = core.windowAt(flat, 560, 100, 0).map(i => flat[i]);
  assert.ok(w.some(f => f.turn === 1 && f.index === 0) && w.some(f => f.turn === 1 && f.index === 1));
  assert.ok(!w.some(f => f.turn === 2));
});
test('model: unmeasured turns share the remaining height by text weight', () => {
  const m = core.buildModel({ ids: ['a', 'b', 'c'], measured: { a: 500 }, records: {}, texts, scrollHeight: 10500, gap: 0, sw: 1243 });
  assert.equal(m[0].h, 500); assert.ok(m[1].h > m[2].h); assert.equal(Math.round(m[1].h + m[2].h), 10000);
  assert.ok(!m[1].known && !m[1].layout);
});
test('mapTop finds the turn and offset', () => {
  const m = core.buildModel({ ids: ['a', 'b'], measured: { a: 100, b: 200 }, records: {}, texts, scrollHeight: 312, gap: 12, sw: 1 });
  assert.deepEqual([core.mapTop(m, 50).index, core.mapTop(m, 50).offset], [0, 50]);
  assert.deepEqual([core.mapTop(m, 150).index, core.mapTop(m, 150).offset], [1, 38]);
});
test('retarget: corrects height drift above a measured destination (v1 layoutCheck miss: +2936 px)', () => {
  const r = core.retarget({ known: true, frozenTurnTop: 200344, actualTurnTop: 203280, offset: 5614, height: 14875, scrollTop: 205958, maxScroll: 215000 });
  assert.equal(r.to, 203280 + 5614); assert.equal(r.drift, 2936);
  assert.equal(core.retarget({ known: true, frozenTurnTop: 100, actualTurnTop: 102, offset: 0, height: 10, scrollTop: 100, maxScroll: 1e6 }), null);
  assert.equal(core.retarget({ known: false, frozenTurnTop: 100, actualTurnTop: 900, offset: 0, height: 10, scrollTop: 100, maxScroll: 1e6 }), null);
  assert.equal(core.retarget({ known: true, frozenTurnTop: 100, actualTurnTop: 900, offset: 50, height: 10, scrollTop: 100, maxScroll: 500 }).to, 500);
});
test('non-finite dimensions are not authoritative',()=>{
 for(const value of [Infinity,NaN]){
  assert.equal(core.validateSnapshot({...base,h:value,blocks:[20],items}),'zero-turn');
  assert.equal(core.validateSnapshot({...base,blocks:[value],items}),'zero-block');
 }
});
test('same outer window with a resized chat scroller cannot restore old widths',()=>{
 const e={...core.mergeRecord(null,{...base,blocks:[10],items},1).entry,removed:true};
 assert.equal(core.canRestore(e,{conv:'c1',vw:1600,sw:900,complete:true,msg:'m1',mathReady:true,blockCount:1}),'width');
});
