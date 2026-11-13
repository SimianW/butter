// First agreed seam: the complete rail over rail-boot's fake DOM and manual clock.
// A virtualizer reserves each row's height independently of its mounted content. The cold
// first turn has only its initial content; the warm control has its full allocated height.
// Only rows within the viewport + 200 px mount. No scroll is rejected or reset by the fixture.
import assert from 'node:assert/strict';
import test from 'node:test';
import { setup } from './helpers/rail-boot.mjs';
import { FakeElement } from './helpers/rail-dom.mjs';

async function clickSecondQuestion({ warm, renderAfterMs = Infinity }) {
  const nav = setup({ count: 3, nested: true });
  const tops = [100, 11917, 26713];
  const heights = [11817, 14796, 2777];
  const box = nav.turns[0].parentElement;
  let top = 0,
    rendered = warm;
  nav.scroller.scrollHeight = 29490;
  const rows = [];
  for (const [i, turn] of nav.turns.entries()) {
    const row = new FakeElement();
    row.style.height = `${heights[i]}px`;
    row.getBoundingClientRect = () => ({
      top: tops[i] - top,
      bottom: tops[i] + heights[i] - top,
      height: heights[i],
    });
    turn.remove();
    row.append(turn);
    box.append(row);
    rows.push(row);
    turn.top = tops[i];
    turn.getBoundingClientRect = () => ({
      top: tops[i] - top,
      bottom: tops[i] + (i === 0 && !rendered ? 800 : heights[i]) - top,
    });
    if (i > 0) {
      row.remove();
      row.isConnected = turn.isConnected = false;
    }
  }
  const writes = [];
  // This replaces only the virtualizer: mounting follows the actual reserved row bounds,
  // not Butter's estimate. The rail itself (including measure/estimate/retarget) is unchanged.
  Object.defineProperty(nav.scroller, 'scrollTop', {
    get: () => top,
    set(value) {
      top = Math.max(0, Math.min(nav.scroller.scrollHeight - nav.scroller.clientHeight, value));
      writes.push(top);
      for (const [i, turn] of nav.turns.entries()) {
        const inWindow =
          tops[i] < top + nav.scroller.clientHeight + 200 && tops[i] + heights[i] > top - 200;
        if (inWindow && !turn.isConnected) {
          rows[i].isConnected = turn.isConnected = true;
          box.append(rows[i]);
          nav.mount(turn);
        } else if (!inWindow && turn.isConnected) {
          rows[i].remove();
          rows[i].isConnected = turn.isConnected = false;
        }
      }
    },
  });
  assert.equal(nav.turns[1].isConnected, false, 'the clicked question starts unmounted');
  nav.select('.rail').emit('click', { detail: 0, target: nav.ticks()[1] });
  let releasedAfterMs = null;
  for (let i = 0; i < 800; i++) {
    if (i * 16 >= renderAfterMs) rendered = true;
    nav.runTimers();
    nav.frame();
    await new Promise((resolve) => setImmediate(resolve));
    if (releasedAfterMs == null && nav.select('.warp').style.visibility === 'hidden')
      releasedAfterMs = (i + 1) * 16;
  }
  const target = nav.turns[1];
  return {
    releasedAfterMs,
    mounted: target.isConnected,
    targetTop: target.isConnected ? target.getBoundingClientRect().top : null,
    scrollTop: top,
    busy: nav.ticks()[1].classList.contains('busy'),
    warp: nav.select('.warp').style.visibility,
    writes,
  };
}

for (const scenario of [
  { name: 'fully rendered', warm: true },
  { name: 'partial, then rendered after 1200 ms', warm: false, renderAfterMs: 1200 },
  { name: 'partial', warm: false },
]) {
  test(`a rail click lands on the unmounted next question with ${scenario.name} source content`, async () => {
    const result = await clickSecondQuestion(scenario);
    console.log(JSON.stringify({ scenario: scenario.name, ...result }));
    assert.ok(
      result.mounted && Math.abs(result.targetTop - 64) <= 2,
      `jump did not land on clicked question 2 within 12.8 seconds: mounted=${result.mounted}, targetTop=${result.targetTop}, scrollTop=${result.scrollTop}`,
    );
  });
}
