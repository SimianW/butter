// The landing wash's driver (#73, #74): jumping to a bookmark from its row (the one place that knows
// how a tick's card, or the earlier-history card, opens), recording every frame of the wash, its
// phases, its boxes against the bookmarked text's own rectangles, and its listeners. `wseed` makes
// the wash scenarios' store rows; PARA, SEL and STALE are the bookmarks most of them start from.
import { answer, row } from './fixture.mjs';

export const WASH = 'chatgpt-butter-wash';
// A bookmark on block `para` of question `turn`'s answer (blocks: p, h3, p, p, p, p, li, li), from
// `start` to `end` (the whole block by default) of `text` (that block's text by default).
export const wseed = (turn, para, start = 0, end = null, text = undefined) =>
  row(turn, para, { start, end: end ?? undefined, text, time: Date.now() + para });
export const T = 4,
  PARA = wseed(T, 2), // a whole paragraph, four lines
  SEL = wseed(T, 4, 20, 150), // a selection of about two lines in another one
  STALE = wseed(8, 2); // question 9's third paragraph, which the wash scenario's scene edits

export function washDriver({ open, context, page, dotCount, rail, PARAS, shots, png }) {
  const sc = '.thread-scroll-container';
  // A DevTools session on the page, opened when `listeners` first needs it.
  let cdp = null;

  // ---- Helpers. Only `rowJump` knows how a question's bookmark card opens.
  const openChat = async (theme, marks = 2) => {
    await open(theme);
    await dotCount(marks);
  };
  // Opens question `turn`'s card from its tick (#70: the tick's card holds its bookmarks), crosses
  // the gap onto the row that holds `b`'s excerpt and clicks it. The pointer stays on the tick's
  // row (its dot, #71, takes no pointer).
  const rowJump = async (turn, b) => {
    await page.mouse.move(5, 300);
    await page.waitForTimeout(150);
    const t = (await rail()).ticks[turn];
    await page.mouse.move(t.x, t.y, { steps: 4 });
    await page.waitForTimeout(350);
    const at = await page.evaluate((text) => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        e = [...root.querySelectorAll('.card.qb.show .bmc .go')].find((x) => x.textContent.includes(text)),
        q = e?.getBoundingClientRect();
      return q && { x: q.left + Math.min(q.width / 2, 60), y: q.top + q.height / 2 };
    }, b.excerpt.slice(0, 40));
    await page.mouse.move(at.x, at.y, { steps: 12 });
    await page.waitForTimeout(300);
    await page.mouse.click(at.x, at.y);
    await page.mouse.move(5, 300);
  };
  // Opens the earlier-history card from its dots and clicks the row that holds `b`'s excerpt.
  const earlierRowJump = async (b) => {
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    const at = await page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        q = root.querySelector('.more').getBoundingClientRect();
      return { x: q.right - 4, y: q.top + q.height / 2 };
    });
    await page.mouse.move(at.x, at.y, { steps: 4 });
    await page.waitForTimeout(350);
    const row = await page.evaluate((text) => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        e = [...root.querySelectorAll('.card.show .bmc .go')].find((x) => x.textContent.includes(text)),
        q = e?.getBoundingClientRect();
      return q && { x: q.left + Math.min(q.width / 2, 60), y: q.top + q.height / 2 };
    }, b.excerpt.slice(0, 40));
    await page.mouse.move(row.x, row.y, { steps: 10 });
    await page.waitForTimeout(200);
    await page.mouse.click(row.x, row.y);
  };
  // Records every frame from now: the wash's boxes and how far each is filled, the layer's opacity,
  // the scroller's position and any bubble flash; and nodes added inside the answers.
  const record = () =>
    page.evaluate(([WASH, sc]) => {
      const R = (window.__wash = { frames: [], added: 0, clicks: [], stop: false });
      const fill = (s) => {
        if (s === 'none') return 1;
        const m = /inset\(([^)]*)\)/.exec(s);
        if (!m) return 1;
        const p = m[1].split(' ');
        const right = p[1] ?? p[0];
        return right.endsWith('%') ? 1 - parseFloat(right) / 100 : parseFloat(right) === 0 ? 1 : 0;
      };
      const mo = new MutationObserver((ms) => {
        for (const m of ms) R.added += [...m.addedNodes].filter((n) => n.nodeType === 1 || n.nodeType === 3).length;
      });
      for (const a of document.querySelectorAll('[data-markdown-text-style]')) mo.observe(a, { childList: true, subtree: true });
      addEventListener('click', () => R.clicks.push(performance.now()), true);
      const loop = (t) => {
        const host = document.querySelector(WASH),
          div = host?.shadowRoot.querySelector('div');
        R.frames.push({
          t,
          host: !!host,
          op: div ? +getComputedStyle(div).opacity : 0,
          boxes: div ? [...div.querySelectorAll('i')].map((i) => fill(getComputedStyle(i).clipPath)) : [],
          // Each box's own opacity: a block's box fades in (#74), a line's sweeps.
          iop: div ? [...div.querySelectorAll('i')].map((i) => +getComputedStyle(i).opacity) : [],
          top: document.querySelector(sc).scrollTop,
          flash: !!document.querySelector('[data-butter-flash]'),
        });
        if (!R.stop) requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }, [WASH, sc]);
  const recorded = () => page.evaluate(() => ((window.__wash.stop = true), window.__wash));
  // The phases of the first wash in a recording, in ms.
  const phases = (R) => {
    const f = R.frames,
      i0 = f.findIndex((x) => x.host && x.boxes.length);
    if (i0 < 0) return { washed: false, flash: f.some((x) => x.flash), added: R.added };
    const t0 = f[i0].t,
      full = f.find((x, i) => i >= i0 && x.boxes.length && x.boxes.every((v) => v > 0.999) && x.iop.every((v) => v > 0.999)),
      fading = f.find((x, i) => i >= i0 && x.host && x.op < 0.999),
      end = f.find((x, i) => i > i0 && !x.host);
    // When each line starts and ends filling, in reading order.
    const lines = f[i0].boxes.map((_, k) => ({
      start: f.find((x, i) => i >= i0 && x.boxes[k] > 0.001)?.t - t0,
      full: f.find((x, i) => i >= i0 && x.boxes[k] > 0.999)?.t - t0,
    }));
    const around = f.filter((x) => x.t >= t0 - 50 && x.t <= t0 + 600).map((x) => x.top);
    return {
      washed: true,
      lines: f[i0].boxes.length,
      first: f[i0].boxes,
      firstOpacity: f[i0].iop,
      // Never cut by a sweep: every box drawn whole on every frame.
      swept: f.some((x, i) => i >= i0 && x.boxes.some((v) => v < 0.999)),
      sweep: full ? Math.round(full.t - t0) : null,
      hold: full && fading ? Math.round(fading.t - full.t) : null,
      fade: fading && end ? Math.round(end.t - fading.t) : null,
      order: lines.every((l, k) => !k || (l.start >= lines[k - 1].start && lines[k - 1].full <= l.start + 17)),
      moved: Math.max(...around) - Math.min(...around),
      flash: f.some((x) => x.flash),
      added: R.added,
      t0,
      startedAfterClick: R.clicks.length ? Math.round(t0 - R.clicks.at(-1)) : null,
    };
  };
  const washHost = () => page.evaluate((WASH) => !!document.querySelector(WASH), WASH);
  const waitWash = () => page.waitForFunction((WASH) => document.querySelector(WASH)?.shadowRoot.querySelector('i'), WASH, { timeout: 15000 });
  // The wash's boxes now, and the lines of the bookmark's text measured here: each line's text
  // rectangles joined, 2 px above and below. They match within 1 px when it covers its range only.
  const coverage = (b) =>
    page.evaluate(([WASH, id, b, PARAS]) => {
      const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[b.para];
      // The range from its offsets in the paragraph's text (the mockup's chat has a span in it).
      const r = document.createRange(),
        w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(), at = 0; n; at += n.data.length, n = w.nextNode()) {
        if (b.start >= at && b.start < at + n.data.length) r.setStart(n, b.start - at);
        if (b.end > at && b.end <= at + n.data.length) r.setEnd(n, b.end - at);
      }
      const lines = [];
      for (const q of r.getClientRects()) {
        if (!q.width) continue;
        const l = lines.find((x) => Math.abs(x.top - q.top) < 4);
        if (l) ((l.left = Math.min(l.left, q.left)), (l.right = Math.max(l.right, q.right)));
        else lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
      }
      const host = document.querySelector(WASH),
        boxes = host ? [...host.shadowRoot.querySelectorAll('i')].map((i) => i.getBoundingClientRect()) : [];
      const want = lines.map((l) => ({ left: l.left, right: l.right, top: l.top - 2, bottom: l.bottom + 2 }));
      const ok = boxes.length === want.length && boxes.every((q, k) => ['left', 'right', 'top', 'bottom'].every((s) => Math.abs(q[s] - want[k][s]) <= 1));
      const clip = host?.shadowRoot.querySelector('div').getBoundingClientRect(),
        s = host && getComputedStyle(host),
        box = boxes[0],
        hit = box && document.elementFromPoint(box.left + 10, box.top + box.height / 2);
      return {
        ok,
        boxes: boxes.map((q) => [q.left, q.top, q.width, q.height].map(Math.round)),
        want: want.map((q) => [q.left, q.top, q.right - q.left, q.bottom - q.top].map(Math.round)),
        // Rounded at the range's start and end only, as one highlight broken across lines.
        radius: host && [...host.shadowRoot.querySelectorAll('i')].map((i) => getComputedStyle(i).borderRadius).join(' / '),
        color: host && getComputedStyle(host.shadowRoot.querySelector('i')).backgroundColor,
        blend: s?.mixBlendMode,
        pointer: s?.pointerEvents,
        clipTop: clip && Math.round(clip.top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top),
        through: !!hit && el.contains(hit),
        inAnswer: !!el.closest('article').querySelector(WASH),
      };
    }, [WASH, answer(b.turn), b, PARAS]);
  // Listeners on the chat scroller (scroll) and the window (resize), by CDP, as Butter's content
  // scripts added them (their own world: DevTools lists a world's listeners only from inside it).
  const butterWorld = async () => {
    cdp ??= await context.newCDPSession(page);
    const contexts = [];
    const on = (e) => contexts.push(e.context);
    cdp.on('Runtime.executionContextCreated', on);
    await cdp.send('Runtime.enable');
    await cdp.send('Runtime.disable');
    cdp.off('Runtime.executionContextCreated', on);
    return contexts.findLast((c) => c.auxData?.type === 'isolated' && c.origin.startsWith('chrome-extension://') && c.auxData.isDefault === false)?.id;
  };
  const listeners = async () => {
    const contextId = await butterWorld();
    const of = async (expression, type) => {
      const { result } = await cdp.send('Runtime.evaluate', { expression, contextId });
      const { listeners } = await cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId });
      return listeners.filter((l) => l.type === type).length;
    };
    return { world: !!contextId, scroll: await of(`document.querySelector('${sc}')`, 'scroll'), resize: await of('window', 'resize') };
  };
  // A code block's or a table's wash (#74): one box, 3 px beyond the block's drawn box (`sel` in
  // its paragraph), its corners the block's own radius plus those 3 px.
  const blockCoverage = (b, sel) =>
    page.evaluate(([WASH, id, para, PARAS, sel]) => {
      const block = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[para],
        el = block.matches(sel) ? block : block.querySelector(sel),
        q = el.getBoundingClientRect(),
        radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
      const host = document.querySelector(WASH),
        boxes = host ? [...host.shadowRoot.querySelectorAll('i')] : [],
        box = boxes[0]?.getBoundingClientRect(),
        want = { left: q.left - 3, top: q.top - 3, right: q.right + 3, bottom: q.bottom + 3 },
        corners = boxes[0] && getComputedStyle(boxes[0]).borderRadius;
      return {
        ok: boxes.length === 1 && ['left', 'top', 'right', 'bottom'].every((k) => Math.abs(box[k] - want[k]) <= 1) && corners === `${radius + 3}px`,
        boxes: boxes.length,
        box: box && [box.left, box.top, box.width, box.height].map(Math.round),
        want: [want.left, want.top, want.right - want.left, want.bottom - want.top].map(Math.round),
        corners,
        blockRadius: radius,
        color: boxes[0] && getComputedStyle(boxes[0]).backgroundColor,
        blend: host && getComputedStyle(host).mixBlendMode,
      };
    }, [WASH, answer(b.turn), b.para, PARAS, sel]);
  // The text's own colour under the wash: the darkest (light theme) or lightest (dark theme) pixel
  // inside the first box, from a screenshot.
  const textUnder = async (theme) => {
    const box = await page.evaluate((WASH) => {
      const q = document.querySelector(WASH).shadowRoot.querySelector('i').getBoundingClientRect();
      return { x: Math.round(q.left) + 2, y: Math.round(q.top) + 3, width: Math.round(q.width) - 4, height: Math.round(q.height) - 6 };
    }, WASH);
    const file = `${shots}/wash-text-${theme}.png`;
    await page.screenshot({ path: file, clip: box });
    return page.evaluate(async ([src, dark]) => {
      const i = new Image();
      await new Promise((r) => ((i.onload = r), (i.src = src)));
      const c = new OffscreenCanvas(i.width, i.height),
        g = c.getContext('2d');
      g.drawImage(i, 0, 0);
      const d = g.getImageData(0, 0, i.width, i.height).data;
      let best = null;
      for (let k = 0; k < d.length; k += 4) {
        const v = d[k] + d[k + 1] + d[k + 2];
        if (!best || (dark ? v > best.v : v < best.v)) best = { v, rgb: [d[k], d[k + 1], d[k + 2]] };
      }
      return best.rgb;
    }, [await png(file), theme === 'dark']);
  };
  return { sc, openChat, rowJump, earlierRowJump, record, recorded, phases, washHost, waitWash, coverage, listeners, blockCoverage, textUnder };
}
