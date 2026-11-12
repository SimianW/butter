// The rail's DOM adapter (extension/rail/rail.js) over a fake DOM: jump cancellation, and wiring
// that needs elements (the send pre-jump installed, seek, the dots' fade-out, keyboard focus, the
// card's grace and Escape). What the rail shows is tested through its model (test/rail-model and
// rail-card .test.mjs); its modules through their own interfaces (test/rail-turns, rail-trip,
// rail-jump, rail-card-dom and pre-jump .test.mjs).
import assert from 'node:assert/strict';
import test from 'node:test';
import { FakeElement } from './helpers/rail-dom.mjs';
import { conversation, setup } from './helpers/rail-boot.mjs';

for (const cancel of ['wheel', 'keyboard', 'send', 'new click']) {
  test(`${cancel} invalidates a pending jump before it can settle or pin its old target`, async () => {
    const nav = setup();
    const click = (index) =>
      nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[index] });
    click(2); // close mounted turn: waits for scrollend, then settles and follows
    assert.equal(nav.scroller.scrollTop, nav.turns[2].top - 64);
    if (cancel === 'wheel') nav.scroller.emit('wheel');
    else if (cancel === 'keyboard')
      nav.window.emit('keydown', { key: 'PageDown', target: nav.scroller });
    else if (cancel === 'send')
      nav.send({
        type: 'send',
        conv: conversation,
        parent: 'q4',
        item: { id: 'new', q: 'New question' },
      });
    else click(4);
    nav.turns[2].top = 800;
    nav.scroller.scrollTop = 700; // user's scroll, or the newer jump's position
    nav.scroller.emit('scrollend');
    // Drain the async glide/steady continuations without using wall-clock timers.
    for (let i = 0; i < 80; i++) {
      nav.frame();
      await Promise.resolve();
    }
    const expected = cancel === 'new click' ? nav.turns[4].top - 64 : 700;
    assert.equal(nav.scroller.scrollTop, expected);
    nav.turns[2].top += 200;
    nav.resize(nav.turns[2]); // a stale follow observer must not re-align the cancelled target
    assert.equal(nav.scroller.scrollTop, expected);
    if (cancel === 'new click') {
      nav.turns[4].top += 100;
      nav.resize(nav.turns[4]);
      assert.equal(
        nav.scroller.scrollTop,
        nav.turns[4].top - 64,
        'only the newest jump stays pinned',
      );
    }
  });
}

test("a scroll key aimed at the rail itself doesn't cancel a pending jump", async () => {
  const nav = setup();
  nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[2] });
  assert.equal(nav.scroller.scrollTop, nav.turns[2].top - 64);
  nav.window.emit('keydown', { key: 'ArrowDown', target: nav.host }); // the rail's own arrows
  nav.turns[2].top = 800; // the target moves before the glide ends
  nav.scroller.scrollTop = 700;
  nav.scroller.emit('scrollend');
  for (let i = 0; i < 80; i++) {
    nav.frame();
    await Promise.resolve();
  }
  assert.equal(nav.scroller.scrollTop, 800 - 64, 'the jump goes on and settles on its target');
});

test('a wheel on the chat during a trip ends the trip: the chat and the placeholder come back', async () => {
  const nav = setup({ count: 40, nested: true });
  nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[35] }); // far: a trip
  const warp = nav.select('.warp'),
    content = nav.scroller.children[0];
  const json = (x) => JSON.stringify(x.keyframes);
  assert.equal(content.name, 'content');
  assert.equal(warp.style.visibility, 'visible', 'the trip departed');
  assert.ok(nav.ticks()[35].classList.contains('busy'), 'its tick blinks');
  const [fadeOut] = content.animations;
  assert.equal(json(fadeOut), '[{"opacity":1},{"opacity":0}]');
  nav.scroller.emit('wheel');
  assert.equal(nav.ticks()[35].classList.contains('busy'), false);
  assert.equal(fadeOut.cancelled, true);
  assert.equal(json(content.animations.at(-1)), '[{"opacity":0},{"opacity":1}]');
  assert.equal(json(warp.animations.at(-1)), '[{"opacity":1},{"opacity":0}]');
  await new Promise((r) => setImmediate(r)); // the placeholder's fade-out finishes
  assert.equal(warp.style.visibility, 'hidden');
});

// The send pre-jump's rules are in test/pre-jump.test.mjs; here, that the rail installs it on the
// visible scroller, and that the rail switch doesn't control it.
test('the rail installs the send pre-jump, which works with the rail switched off', () => {
  const nav = setup();
  nav.document.documentElement.setAttribute('data-butter-off', 'rail');
  nav.document.emit('butter-settings');
  nav.window.dispatch('keydown', { key: 'Enter', target: nav.composer });
  assert.equal(nav.scroller.scrollTop, 3200);
  nav.scroller.scrollTop = 0;
  nav.window.dispatch('click', { target: nav.sendButton });
  assert.equal(nav.scroller.scrollTop, 3200);
});

test('seek state lights only the previewed question and uses the existing instant card and busy tick', () => {
  const nav = setup();
  nav.seek({ state: 'dragging', id: 'q1', n: 2, total: 5, unseen: true });
  nav.flush();
  assert.equal(nav.select('.meta').textContent, 'Question 2 of 5 · not opened yet');
  assert.equal(nav.select('.text').textContent, 'Question 1');
  assert.ok(nav.select('.rail').classList.contains('hot'));
  assert.ok(nav.select('.cardpos').classList.contains('instant'));
  assert.deepEqual(
    nav.geometry().map((x) => x[1]),
    [0.28, 1, 0.28, 0.28, 0.28],
  );
  nav.seek({ state: 'loading', id: 'q1', n: 2, total: 5 });
  nav.flush();
  assert.equal(nav.select('.meta').textContent, 'Loading question 2…');
  assert.equal(nav.select('.meta').firstChild.className, 'spin');
  assert.ok(nav.ticks()[1].classList.contains('busy'));
  nav.seek({ state: 'idle' });
  nav.flush();
  assert.equal(nav.ticks()[1].classList.contains('busy'), false);
  nav.advanceClock(1000);
  nav.runTimers();
  nav.flush();
  assert.equal(nav.select('.card').classList.contains('show'), false);
  assert.equal(nav.select('.rail').classList.contains('hot'), false);
});

test('seek card follows live language changes and ignores state from a different conversation', () => {
  const nav = setup();
  nav.seek({ state: 'dragging', id: 'q2', n: 3, total: 5 });
  nav.flush();
  nav.document.documentElement.setAttribute('data-butter-lang', 'zh');
  nav.document.emit('butter-settings');
  nav.flush();
  assert.equal(nav.select('.meta').textContent, '第 3 / 5 个问题');
  nav.seek({ conv: 'other', state: 'loading', id: 'q0', n: 1, total: 5 });
  nav.flush();
  assert.equal(nav.select('.meta').textContent, '第 3 / 5 个问题');
});

// The adapter applies what the model returns: CSS values, names, the three dots, the card's
// looks, the dots' looks, and each wave frame's tick styles.
test('the rail draws the model: host CSS, tick names, the three dots hidden, card and dot looks, wave frames', () => {
  const nav = setup({ count: 4 });
  nav.setMarks({ q1: [true], q2: [false] });
  const rail = nav.select('.rail'),
    card = nav.select('.card'),
    st = nav.host.style;
  assert.deepEqual([st['--y'], st['--pitch'], st['--r']], ['368px', '14px', '212px']);
  const label = nav.ticks()[1].getAttribute('aria-label');
  assert.equal(label, 'Question 1 · Bookmark: Bookmark 0 (answer changed)');
  assert.equal(nav.select('.more').hidden, true);
  assert.deepEqual(
    nav.dots().map((d) => d.stale),
    [true, false],
  ); // q1 all stale: hollow
  rail.emit('pointerenter');
  rail.emit('pointermove', { clientX: 5, clientY: 368 + 10 + 1.5 * 14 }); // tick 1's centre
  nav.frame();
  const bar = nav.ticks()[1].firstChild;
  assert.deepEqual([bar.style.transform, bar.style.opacity], ['scale(1.375, 1.140)', '0.449']);
  assert.deepEqual([card.inert, card.classList.contains('qb')], [false, true]);
  rail.emit('pointermove', { clientX: 5, clientY: 368 + 10 + 0.5 * 14 }); // tick 0: no bookmarks
  assert.deepEqual([card.inert, card.classList.contains('qb')], [true, false]);
});

// Adapter wiring: the model's dots drawn, the fade-out's timer, the host hidden with the rail off.
test("a question's last bookmark deleted: its dot fades out over 160 ms; with the rail off, none", () => {
  const nav = setup({ count: 4 });
  nav.setMarks({ q1: [false] });
  nav.flush();
  assert.deepEqual(nav.dots(), [
    { q: 1, right: 16, center: 10 + 1.5 * 14, d: 4, hidden: 'true', stale: false, faint: false },
  ]);
  nav.setMarks({});
  const [gone] = nav.select('.marks').children;
  assert.ok(gone.classList.contains('gone'), 'fading');
  nav.advanceClock(160);
  nav.runTimers();
  assert.equal(nav.dots().length, 0);
  // The rail off (Butter paused turns it off too): the page script sends no bookmarks, and the
  // rail's host is hidden.
  nav.setMarks({ q2: [false] });
  nav.document.documentElement.setAttribute('data-butter-off', 'rail');
  nav.document.emit('butter-settings');
  nav.setMarks({});
  nav.advanceClock(160);
  nav.runTimers();
  nav.flush();
  assert.equal(nav.dots().length, 0);
  assert.equal(nav.host.style.display, 'none');
});

test('keyboard: ArrowLeft on the three dots enters their card; ArrowRight and Escape return; ArrowDown goes to the first tick', () => {
  const nav = setup({ count: 3, hasPrev: true });
  nav.setMarks({ '-1': [false, false], q0: [false] });
  const more = nav.select('.more'),
    ticks = nav.ticks(),
    key = (el, k, target) => el.emit('keydown', { key: k, target, preventDefault() {} });
  key(nav.select('.rail'), 'ArrowDown', more);
  assert.equal(FakeElement.focused, ticks[0], 'no stop between the three dots and the first tick');
  key(nav.select('.rail'), 'ArrowUp', ticks[0]);
  assert.equal(FakeElement.focused, more);
  key(nav.select('.rail'), 'ArrowLeft', more);
  const card = nav.select('.card');
  assert.ok(card.classList.contains('show'));
  assert.equal(card.getAttribute('aria-label'), 'Earlier questions · 2 bookmarks');
  const go = nav.select('.bmc').querySelectorAll('.go');
  assert.equal(FakeElement.focused, go[0], 'the first row');
  key(card, 'ArrowDown', go[0]);
  assert.equal(FakeElement.focused, go[1]);
  key(card, 'ArrowRight', go[1]);
  assert.equal(FakeElement.focused, more);
  key(nav.select('.rail'), 'ArrowLeft', more);
  key(card, 'Escape', nav.select('.bmc').querySelectorAll('.go')[0]);
  assert.equal(FakeElement.focused, more);
});

test("a left bookmark card goes after 200 ms unless the pointer comes back; Escape puts the dots' away", () => {
  const nav = setup({ count: 3, hasPrev: true });
  nav.setMarks({ '-1': [false], q1: [false] });
  const rail = nav.select('.rail'),
    shows = () => nav.select('.card').classList.contains('show'),
    key = (k, target) => rail.emit('keydown', { key: k, target, preventDefault() {} }),
    wait = (ms) => (nav.advanceClock(ms), nav.runTimers());
  key('ArrowLeft', nav.ticks()[1]);
  rail.emit('pointerleave');
  wait(150);
  rail.emit('pointerenter');
  wait(100);
  assert.ok(shows(), 'the pointer came back');
  rail.emit('pointerleave');
  wait(200);
  assert.deepEqual([shows(), rail.classList.contains('hot')], [false, false]);
  key('ArrowLeft', nav.select('.more'));
  assert.ok(shows());
  nav.window.emit('keydown', { key: 'Escape' }, 'capture');
  assert.equal(shows(), false);
});

// The jump (rail/jump.js) through the rail: the turn tracker's mounts reach its pin, and card rows
// start bookmark and earlier jumps whose busy dots the rail draws.
test('a remounted target stays pinned: the turn tracker hands new turns to the jump', async () => {
  const nav = setup();
  nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[2] });
  nav.scroller.emit('scrollend');
  for (let i = 0; i < 80; i++) {
    nav.frame();
    await Promise.resolve();
  }
  const el = new FakeElement('article');
  el.setAttribute('data-turn-key', 'q2');
  el.top = 500;
  el.getBoundingClientRect = () => ({ top: el.top - nav.scroller.scrollTop });
  nav.turns[2].remove();
  nav.scroller.append(el);
  nav.mount(el);
  nav.resize(el);
  assert.equal(nav.scroller.scrollTop, 500 - 64);
});

test("card rows jump: a tick's bookmark lands on it; the dots' bookmark blinks the dots until stopped", () => {
  const nav = setup({ count: 5, hasPrev: true });
  nav.setMarks({ '-1': [false], q3: [false] });
  const rail = nav.select('.rail'),
    more = nav.select('.more'),
    key = (el, k, target) => el.emit('keydown', { key: k, target, preventDefault() {} }),
    row = () => nav.select('.bmc').querySelectorAll('.go')[0];
  key(rail, 'ArrowLeft', nav.ticks()[3]);
  row().emit('click', { detail: 0 });
  assert.equal(nav.scroller.scrollTop, 400 - 64 + 30, 'a glide onto its text, 30 px into the turn');
  assert.equal(FakeElement.focused, nav.ticks()[3]);
  key(rail, 'ArrowLeft', more);
  row().emit('click', { detail: 0 });
  assert.ok(more.classList.contains('busy'), 'the dots blink while pages load');
  assert.equal(nav.select('.bmc').querySelectorAll('.wspin').length, 1, 'its row spins');
  nav.scroller.emit('wheel');
  assert.equal(more.classList.contains('busy'), false);
  assert.equal(nav.select('.bmc').querySelectorAll('.wspin').length, 0);
});

// An earlier trip from the dots' card finds its bookmark under a question that just loaded: the
// card goes away, held until the pointer comes back (a pointer trip), or focus moves to the
// bookmark's tick (a keyboard trip).
for (const keyboard of [false, true]) {
  test(`an earlier ${keyboard ? 'keyboard' : 'pointer'} trip that finds its bookmark puts the dots' card away${keyboard ? ' and focuses its tick' : ', held'}`, async () => {
    const nav = setup({ count: 3, hasPrev: true });
    nav.setMarks({ '-1': [false, false] }, nav.rev());
    const card = nav.select('.card'),
      rail = nav.select('.rail');
    rail.emit('keydown', { key: 'ArrowLeft', target: nav.select('.more'), preventDefault() {} });
    nav
      .select('.bmc')
      .querySelectorAll('.go')[0]
      .emit('click', { detail: keyboard ? 0 : 1 });
    const until = async (done) => {
      for (let i = 0; i < 300 && !done(); i++) {
        nav.frame();
        nav.runTimers();
        await new Promise((r) => setImmediate(r));
      }
      assert.ok(done());
    };
    await until(() => nav.scroller.scrollTop === 240 + 32); // leaves the paging band
    await until(() => nav.scroller.scrollTop === 0); // and asks for the page
    nav.send({
      type: 'page',
      conv: conversation,
      before: 'q0',
      hasPrev: true, // the other bookmark stays on the dots
      items: [{ id: 'p0', q: 'Earlier' }],
    });
    const el = new FakeElement('article');
    el.setAttribute('data-turn-key', 'p0');
    el.top = 0;
    el.getBoundingClientRect = () => ({ top: el.top - nav.scroller.scrollTop });
    nav.scroller.prepend(el);
    nav.mount(el);
    await until(() => nav.ticks().length === 4); // rendered: the marks can follow its revision
    assert.ok(card.classList.contains('show'), "the dots' card stays while pages load");
    nav.setMarks(
      { '-1': [{ key: '-1-1', stale: false }], p0: [{ key: '-1-0', stale: false }] },
      nav.rev(),
    );
    await until(() => !card.classList.contains('show'));
    if (keyboard) assert.equal(FakeElement.focused, nav.ticks()[0]);
    rail.emit('focusin', { target: nav.ticks()[1] }); // held: no card until the pointer comes back
    assert.equal(card.classList.contains('show'), keyboard);
  });
}
