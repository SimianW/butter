import test from 'node:test';
import assert from 'node:assert/strict';
import core from '../extension/seek/core-main.js';
import seekMeta from '../extension/seek/seek-meta.js';

test('seek card describes seen, unseen and loading questions in both UI languages', () => {
  assert.equal(seekMeta(false, 7, 14, 'dragging'), 'Question 7 of 14');
  assert.equal(seekMeta(false, 3, 14, 'dragging', true), 'Question 3 of 14 · not opened yet');
  assert.equal(seekMeta(false, 7, 14, 'loading'), 'Loading question 7…');
  assert.equal(seekMeta(true, 7, 14, 'dragging'), '第 7 / 14 个问题');
  assert.equal(seekMeta(true, 3, 14, 'dragging', true), '第 3 / 14 个问题 · 还没打开过');
  assert.equal(seekMeta(true, 7, 14, 'loading'), '正在加载第 7 个问题…');
});
const turns = [
  { id: 'first', index: 0, top: 0, h: 1000, known: true, layout: true },
  { id: 'second', index: 1, top: 1000, h: 2000, known: true, layout: false },
];
test('the question below the header owns the card even when the raw scrollTop is in the preceding turn', () => {
  assert.equal(core.previewQuestion(turns, 960, 52).id, 'second');
  assert.equal(core.previewQuestion(turns, 940, 52).id, 'first');
  assert.equal(core.previewQuestion([], 0, 52), null);
});
test('an unmeasured layout lands at turn start below the header, even with a known row height', () => {
  const destination = core.landing(core.previewQuestion(turns, 1700, 52), 52, 4000);
  assert.equal(destination.id, 'second');
  assert.equal(destination.top, 948);
  assert.equal(destination.offset, -52);
});
test('a measured destination preserves its pixel offset and all landings respect scroll bounds', () => {
  assert.equal(core.landing(core.previewQuestion(turns, 400, 52), 52, 4000).top, 400);
  assert.equal(
    core.landing({ ...core.previewQuestion(turns, 1700, 52), turnTop: 20 }, 52, 4000).top,
    0,
  );
  assert.equal(core.landing(core.previewQuestion(turns, 1700, 52), 52, 700).top, 700);
  assert.equal(core.landing(null, 52, 4000), null);
});

test('each content-script file is assigned to one world so Chrome does not deduplicate the MAIN bootstrap', async () => {
  const { readFile } = await import('node:fs/promises');
  const manifest = JSON.parse(
    await readFile(new URL('../extension/manifest.json', import.meta.url), 'utf8'),
  );
  const worlds = new Map();
  for (const script of manifest.content_scripts)
    for (const path of script.js) {
      const world = script.world ?? 'ISOLATED';
      if (worlds.has(path))
        assert.equal(worlds.get(path), world, `${path} must not cross content-script worlds`);
      worlds.set(path, world);
    }
  assert.equal(worlds.get('seek/core-main.js'), 'MAIN');
  assert.equal(worlds.get('seek/seek-meta.js'), 'ISOLATED');
});

// The normal rail observes the turn element against -92px / -180px root margins.
test('preview rail excludes a preceding tail above the lit band and the composer strip', () => {
  const rows = [
    { id: 'tail', index: 0, top: 0, h: 1070 },
    { id: 'reading', index: 1, top: 1082, h: 720 },
    { id: 'composer', index: 2, top: 1830, h: 1000 },
  ];
  assert.deepEqual(
    core.previewLitQuestions(rows, 1000, 1000).map((t) => t.id),
    ['reading'],
  );
});
test('preview rail lights all turns crossing the normal band, using turn rather than row bounds', () => {
  const rows = [
    { id: 'above', top: 0, h: 1095, litTop: 0, litH: 1090 },
    { id: 'one', top: 1095, h: 300, litTop: 1100, litH: 290 },
    { id: 'two', top: 1407, h: 500, litTop: 1410, litH: 490 },
  ];
  assert.deepEqual(
    core.previewLitQuestions(rows, 1000, 1000).map((t) => t.id),
    ['one', 'two'],
  );
  assert.deepEqual(core.previewLitQuestions([], 0, 1000), []);
});
test('preview card names the lit question filling most of the band, not the earliest lit one', () => {
  const rows = [
    { id: 'tail', index: 2, top: 0, h: 1120 },
    { id: 'reading', index: 3, top: 1120, h: 2000 },
  ];
  const lit = core.previewLitQuestions(rows, 1000, 1000);
  assert.deepEqual(
    lit.map((t) => t.id),
    ['tail', 'reading'],
  );
  assert.equal(core.previewCardQuestion(lit, 1000, 1000).id, 'reading');
  assert.equal(core.previewCardQuestion([], 1000, 1000), null);
});
