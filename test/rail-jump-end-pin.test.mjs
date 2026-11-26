// Issue #171: a rail jump to one of the first questions of a long chat reached the question, and
// ChatGPT then pulled the chat back to its end. ChatGPT keeps an end pin: while it is set and the
// transcript grows, it scrolls the chat to its end (the end pull). A script's scrollTop write never
// clears it; the reader's own scroll away from the end does. On the real page questions 0-2 grow a
// moment after they mount, so a jump to them from a chat that still follows its end was pulled back,
// three rounds, and ended `lost` at the chat's end (notes/runs/2026-11-24-rail-jump-pin/report.md).
// The turn tracker and the jump run over the fake virtualizer in test/helpers/rail-virtualizer.mjs
// with the fake of ChatGPT's end pin (test/helpers/chatgpt-end-pin.mjs).
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { BOTTOM, CLIENT, TOPS, setup } from './helpers/rail-virtualizer.mjs';

const { createRailTrace } = createRequire(import.meta.url)('../extension/dev/rail-trace.js');

const TOP_INSET = 64; // a jumped-to question lands this far below the scroller's top
const AFTER = 4000; // ms watched after the jump ends: every growth of the mounted turns has come
const BUSY = 600; // ChatGPT renders a turn it mounted for this long: a frame every 50 ms

// The chat with ChatGPT's end pin (`opts` go to setup); `before(t)` puts it where the jump starts.
// Then `go(t)` starts the jump; `growAt`: ms after the click at which ChatGPT's transcript grows
// once more (a turn that was already mounted). Steps until the jump has ended and AFTER more ms have
// passed; returns when it ended (ms after the click, or null), the dev build's rail trace `events`
// and the scrollTop of each frame since the click (`tops`).
async function jump({ before = () => {}, go, growAt = null, ms = 20000, ...opts }) {
  const events = [];
  let now = () => 0;
  const tracer = createRailTrace({
    emit: (type, fields) => events.push({ type, ...fields }),
    now: () => now(),
  });
  const t = setup({ trace: tracer.trace, endPin: true, ...opts });
  now = t.now;
  let mountedAt = -Infinity;
  t.mounted(() => (mountedAt = t.now()));
  await t.run(500);
  await before(t);
  const clicked = t.now();
  void go(t);
  let ended = null;
  const tops = [];
  while (t.now() - clicked < ms) {
    t.frameMs = t.now() < mountedAt + BUSY ? 50 : 16;
    await t.run(t.frameMs);
    tops.push(t.scroller.scrollTop);
    if (growAt != null && t.now() - clicked >= growAt) {
      growAt = null;
      t.pin.grew();
    }
    if (ended == null && !t.st.flying && t.trip.tok == null) ended = t.now() - clicked;
    if (ended != null && t.now() - clicked > ended + AFTER) break;
  }
  const outcome = events.filter((e) => e.type === 'rail-end').at(-1)?.outcome;
  return { t, ended, events, outcome, tops };
}

// Question `i` sits `off` px below its landing spot's top inset, and the rail still pins it.
const shows = ({ t, ended, outcome }, i, off = 0) => {
  const el = t.els[i];
  assert.ok(
    el.isConnected && el.getBoundingClientRect().top === TOP_INSET - off && t.st.pinned,
    `the chat is at scrollTop ${t.scroller.scrollTop}, not on question ${i} ` +
      `(${TOPS[i] - TOP_INSET + off}); the jump ended ${ended} ms after the click, ${outcome}; ` +
      `pulled to the end ${t.pin.pulls} times; writes: ${t.writes.join(', ')}`,
  );
  assert.equal(outcome, 'landed');
};

const of = (r, type) => r.events.filter((e) => e.type === type);

test('a jump from the chat end to question 0 lands on it and stays there once it has grown', async () => {
  const r = await jump({ go: (t) => t.jump.go(0) });
  shows(r, 0);
  assert.equal(r.t.pin.pinned, false, "ChatGPT's end pin was cleared");
  assert.deepEqual(
    of(r, 'rail-jump').map((e) => [e.jump, e.leave]),
    [[1, true]],
    'the bug file says the jump showed the leave gesture',
  );
});

for (const i of [1, 2])
  test(`a jump from the chat end to question ${i} lands on it and stays there`, async () => {
    shows(await jump({ go: (t) => t.jump.go(i) }), i);
  });

test('a jump from the top, where the reader scrolled, lands on question 2 and stays there', async () => {
  const r = await jump({ before: (t) => t.wheel(-120, 0), go: (t) => t.jump.go(2) });
  shows(r, 2);
  assert.equal(of(r, 'rail-jump')[0].leave, false, 'a jump toward the end shows no leave gesture');
});

test('a takeover during a trip from the chat end lands on the second question and stays there', async () => {
  const r = await jump({
    go: async (t) => {
      void t.jump.go(1);
      await t.run(100);
      return t.jump.go(0);
    },
  });
  assert.deepEqual(
    of(r, 'rail-jump').map((e) => e.path),
    ['trip', 'takeover'],
  );
  shows(r, 0);
});

test('a bookmark jump from the chat end lands on the bookmarked text and stays there', async () => {
  const mark = { land: () => 300 };
  shows(await jump({ go: (t) => t.jump.bookmark(0, mark, {}) }), 0, 300);
});

test('a click on the three dots from the chat end shows the first question and stays there', async () => {
  shows(await jump({ hasPrev: true, go: (t) => t.jump.earlier(null, false) }), 0);
});

test('with reduced motion a jump from the chat end lands on question 0 and stays there', async () => {
  shows(await jump({ reduced: true, go: (t) => t.jump.go(0) }), 0);
});

test('a jump to the last question, landing at the chat end, leaves following the end as it was', async () => {
  const r = await jump({ scrollHeight: TOPS[3] - TOP_INSET + CLIENT, go: (t) => t.jump.go(3) });
  assert.equal(r.t.scroller.scrollTop, TOPS[3] - TOP_INSET, 'the chat is at its end');
  assert.equal(r.t.pin.pinned, true, "ChatGPT's end pin is still set");
  r.t.grow(500); // the answer streams on
  assert.equal(r.t.scroller.scrollTop, TOPS[3] - TOP_INSET + 500, 'the chat follows its end');
  assert.equal(of(r, 'rail-jump')[0].leave, false);
});

test('with no jump the end pin stays set and the chat follows the growth', async () => {
  const t = setup({ endPin: true });
  await t.run(3000);
  t.grow(500);
  await t.run(100);
  assert.equal(t.pin.pinned, true);
  assert.equal(t.scroller.scrollTop, BOTTOM + 500);
});

test("the reader's own scroll back to the chat end after a jump sets the end pin again", async () => {
  const { t } = await jump({ go: (t) => t.jump.go(0) });
  assert.equal(t.pin.pinned, false, 'control: the jump cleared the end pin');
  t.wheel(120, BOTTOM);
  await t.run(100);
  assert.equal(t.pin.pinned, true);
  t.grow(500);
  assert.equal(t.scroller.scrollTop, BOTTOM + 500, 'the chat follows its end again');
});

test("the leave gesture does not stop its own jump; the reader's scrollbar press still does", async () => {
  const r = await jump({ go: (t) => t.jump.go(0) });
  assert.deepEqual(of(r, 'rail-cancel'), [], 'the jump was not cancelled');
  const own = await jump({
    go: async (t) => {
      void t.jump.go(0);
      await t.run(100);
      t.scroller.emit('pointerdown', { button: 0, pointerType: 'mouse', clientX: 995 });
    },
  });
  assert.deepEqual(
    of(own, 'rail-cancel').map((e) => e.cause),
    ['scrollbar'],
  );
});

test('a glide from the chat end lands on its question as a smooth scroll and stays there', async () => {
  const r = await jump({ go: (t) => t.jump.go(3), growAt: 300 });
  assert.equal(r.events.find((e) => e.type === 'rail-jump')?.path, 'glide');
  shows(r, 3);
  const passed = new Set(r.tops.filter((top) => top > TOPS[3] - TOP_INSET && top < 6526));
  assert.ok(
    passed.size >= 5,
    `the chat went to question 3 in ${passed.size} steps, not as a smooth scroll: ${r.tops.slice(0, 30)}`,
  );
});

// The glide's cutoff: a mounted question less than 1.5 viewports away. The chat's end is put 1638 px
// (1.5 * CLIENT) below question 3's landing spot, plus `px`; the jump starts there, at the end.
const atCutoff = async (px) => {
  const end = TOPS[3] - TOP_INSET + CLIENT * 1.5 + px;
  const r = await jump({ scrollHeight: end + CLIENT, go: (t) => t.jump.go(3) });
  assert.equal(of(r, 'rail-jump')[0].leave, true, 'the jump showed the leave gesture');
  shows(r, 3);
  return of(r, 'rail-jump')[0].path;
};

test("the glide's cutoff is read before the leave gesture's 1 px step", async () => {
  assert.equal(await atCutoff(-1), 'glide', 'control: 1 px inside the cutoff the jump glides');
  assert.equal(await atCutoff(0), 'trip', 'exactly at the cutoff the jump takes the trip');
});
