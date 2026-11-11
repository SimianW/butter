// The rail schedules no animation frames while nothing moves: the wave and every other rail loop
// stop once they have settled. A DevTools session finds Butter's isolated world on the page and
// wraps its requestAnimationFrame there, counting only the calls whose stack comes from a /rail/
// script (other content scripts, such as the selection pill, may animate). Three idle windows of
// 2 s each must count none: after the chat has opened and settled; after a hover wave, the pointer
// gone from the rail; after a question jump has landed and settled. The wave itself, under the
// pointer, must count some, which shows the counter sees the rail's frames.
const IDLE_MS = 2000;
const WRAP = `(() => {
  if (globalThis.__railFrames) return true;
  const raf = globalThis.requestAnimationFrame;
  globalThis.__railFrames = { n: 0 };
  globalThis.requestAnimationFrame = function (callback) {
    if (/\\/rail\\//.test(new Error().stack)) __railFrames.n++;
    return raf.call(globalThis, callback);
  };
  return true;
})()`;

export default {
  name: 'rail-idle',
  description: 'The rail schedules no frames while idle: after the chat opens and settles, after a hover wave, after a jump lands',
  async run(qa) {
    const { page, check, open, rail, hoverTick, toTop, questionTop, TURNS } = qa;
    const cdp = await page.context().newCDPSession(page);
    const contexts = new Map();
    cdp.on('Runtime.executionContextCreated', ({ context }) => contexts.set(context.id, context));
    cdp.on('Runtime.executionContextDestroyed', ({ executionContextId }) => contexts.delete(executionContextId));
    cdp.on('Runtime.executionContextsCleared', () => contexts.clear());
    await cdp.send('Runtime.enable');
    const evaluate = (contextId, expression) =>
      cdp.send('Runtime.evaluate', { contextId, expression, returnByValue: true }).then((r) => r.result.value);
    await open('light');
    // Butter's isolated world: an extension origin, and the rail's own global in it.
    let butter = null;
    for (const c of contexts.values())
      if (c.auxData?.type === 'isolated' && c.origin.startsWith('chrome-extension://'))
        if (await evaluate(c.id, "typeof butterNavTurn === 'function'")) butter = c.id;
    check('rail-idle: the rail runs in an isolated world the session can reach', butter != null, {
      contexts: [...contexts.values()].map((c) => [c.auxData?.type, c.origin]),
    });
    if (butter == null) return;
    await evaluate(butter, WRAP);
    const frames = () => evaluate(butter, '__railFrames.n');
    const reset = () => evaluate(butter, '__railFrames.n = 0');
    const away = () => page.mouse.move(700, 400);
    const idle = async (when) => {
      await reset();
      await page.waitForTimeout(IDLE_MS);
      const n = await frames();
      check(`rail-idle: no frames for ${IDLE_MS / 1000} s ${when}`, n === 0, { frames: n });
    };

    // Opened: the opening prediction settles, the wave lights the band and stops.
    await away();
    await page.waitForTimeout(1500);
    await idle('after the chat opened and settled');

    // A hover wave, then the pointer away: the wave eases back to rest and stops.
    await reset();
    await hoverTick(Math.floor(TURNS / 2));
    const waving = await frames();
    check('rail-idle: the wave under the pointer schedules frames (the counter sees the rail)', waving > 0, { frames: waving });
    await away();
    await page.waitForTimeout(1200);
    await idle('after a hover wave, the pointer gone');

    // A jump to the last question from the top: it lands, settles and stays pinned without frames.
    await toTop();
    const t = (await rail()).ticks[TURNS - 1];
    await page.mouse.click(t.x, t.y);
    await away();
    await page.waitForFunction(
      () => {
        const r = document.querySelector('chatgpt-butter-nav').shadowRoot;
        return !r.querySelector('.busy') && getComputedStyle(r.querySelector('.warp')).visibility === 'hidden';
      },
      null,
      { timeout: 15000 },
    );
    await page.waitForTimeout(3000); // settling follows the question for up to 2 s
    const top = await questionTop(TURNS - 1),
      sc = await page.evaluate(() => {
        const s = document.querySelector('.thread-scroll-container');
        return { top: s.scrollTop, max: s.scrollHeight - s.clientHeight };
      });
    check('rail-idle: the jump landed on the last question', Math.abs(top - 64) <= 3 || Math.abs(sc.top - sc.max) <= 2, { top, sc });
    await idle('after a jump landed and settled');
    await cdp.detach();
  },
};
