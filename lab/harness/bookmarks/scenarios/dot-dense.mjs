// A very long chat, as the #69 mockup's `s-dense-light` draws it: 22 questions 5 px apart, question
// 16 being read, 3 px dots, and the all-stale dot solid at 45 % (ticks too close for a ring); shot
// at three times its size and compared with the panel when BUTTER_BOOKMARKS_DOT_MOCKUP is set.
import { goneRow, row } from '../fixture.mjs';
import { panels } from '../mockup.mjs';

// A live bookmark on block `para` of question `turn`'s answer, and a stale one (its paragraph no
// longer holds its text).
const live = (turn, time, para = 0) => row(turn, para, { time }),
  gone = (turn, time) => goneRow(turn, { time });

const LIGHT_DOT = 'rgb(211, 158, 16)';

export default {
  name: 'dot-dense',
  description: "A 22-question chat 5 px apart: 3 px dots, the all-stale one solid at 45 %; #69's s-dense-light",
  scene: { tail: 40, turns: 22, css: `.thread-scroll-container { height: 342px; transform: scaleY(${341.42 / 342}); transform-origin: 0 0 }` },
  store: [live(3, 1), live(4, 2), gone(9, 3), live(15, 4), live(18, 5)],
  async run(qa) {
    const { open, dotCount, rail, dotBeside, check, readAt, lit } = qa;
    const mockup = panels(qa);
    // (e) A very long chat: 22 questions 5 px apart, question 16 being read. The scroller's box, just
    // over 212 + 22 x 5 / .85 px tall, gives a pitch of 5 px, as the mockup draws it: layout floors
    // each tick's height to 1/64 px, and rounds a fractional height, which a vertical scale avoids.
    // At this pitch a tick's top is on half a pixel, which Chrome snaps a device pixel lower at three
    // times the size than the mockup's 3x drawing in CSS px: each tick's own box is left out of the
    // comparison. The mockup draws question 10's dot (all its bookmarks stale, 3 px across) with a
    // ring; #69 decides it solid at 45 % (a 1 px ring can't be drawn under 4 px), so that dot is left
    // out too. The other dots are compared.
    await open('light');
    await dotCount(5);
    await readAt(15);
    const r = await rail();
    const pitch = (r.ticks.at(-1).y - r.ticks[0].y) / 21,
      faint = dotBeside(r, 9);
    check('a very long chat: ticks 5 px apart, dots 3 px across, question 16 alone lit', Math.abs(pitch - 5) < 0.01 && r.dots.length === 5 &&
      [3, 4, 9, 15, 18].every((i) => dotBeside(r, i)?.w === 3) && JSON.stringify(lit(r)) === '[[15,21]]', { pitch, lit: lit(r), d: r.dots.map((d) => d.w) });
    check('ticks too close for a ring: the all-stale dot is solid at 45 %', faint && !faint.cls.includes('stale') && faint.cls.includes('faint') &&
      faint.color === LIGHT_DOT && Math.abs(faint.opacity - 0.45) < 0.001, { faint });
    const top = r.ticks[0].y - 10.5;
    await mockup.strip('s-dense-light', [
      ...mockup.ticksOut(r, 10.5),
      { x: Math.floor((faint.left - (r.ticks[0].right + 6) + 154 / 3 - 1) * 3), y: Math.floor((faint.y - top - faint.h / 2 - 1) * 3), w: 3 * (faint.w + 2) + 1, h: 3 * (faint.h + 2) + 1 },
    ]);
    await mockup.match();
  },
};
