// First seam: actual rail modules over the shared fake DOM. Models compositor autoscroll
// between layout notifications after a completed rail jump. No product code is changed.
import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from './helpers/rail-boot.mjs';

for (const input of ['wheel', 'middle']) {
  test(`${input} scrolling after a rail jump keeps downward progress through resize notifications`, async () => {
    const nav = setup({ nested: true });
    nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[2] });
    nav.scroller.emit('scrollend');
    for (let i = 0; i < 100; i++) {
      nav.frame();
      await Promise.resolve();
    }
    const start = nav.scroller.scrollTop;
    assert.equal(start, nav.turns[2].top - 64, 'the rail jump has landed');
    if (input === 'wheel') nav.scroller.emit('wheel');
    else {
      // Middle press is on answer content, not on the native scrollbar.
      const event = {
        button: 1,
        buttons: 4,
        pointerType: 'mouse',
        clientX: 500,
        target: nav.turns[2],
      };
      nav.scroller.emit('pointerdown', event);
      nav.scroller.emit('mousedown', event);
      nav.scroller.emit('pointermove', event);
      nav.scroller.emit('mousemove', event);
    }
    const samples = [];
    for (let i = 0; i < 6; i++) {
      // The browser's autoscroll moves down; a neighbouring block then finishes layout.
      nav.scroller.scrollTop += 80;
      const before = nav.scroller.scrollTop;
      nav.resize(nav.turns[2]);
      samples.push({ before, after: nav.scroller.scrollTop });
    }
    console.log(`${input}: ${JSON.stringify(samples)}`);
    assert.ok(
      nav.scroller.scrollTop >= start + 6 * 80,
      `downward scrolling must not be reset by the old rail pin; start=${start}, final=${nav.scroller.scrollTop}`,
    );
  });
}
