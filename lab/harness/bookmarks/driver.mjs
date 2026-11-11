// The Butter driver for the bookmarks fixture: reading the rail, its dots and the tick's card, the
// selection pill and the bookmark notification, and acting as a reader does (select, hover, click a
// row, press the shortcut, jump). `driver({ page, worker, shots })` binds it to a scenario's page.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { headed, repo } from '../runner/chromium.mjs';
import { answer, question, PARAS } from './fixture.mjs';

// Presses `chord` as real X input (xtest-keys.py). The X pointer stays on the tab strip (screen y
// 20, above the page): over the page, its own moves would compete with the harness's hover.
// Without a window manager, keys go where the pointer is.
export const xkeys = (chord) =>
  execFileSync('python3', [path.join(repo, 'lab/harness/xtest-keys.py'), chord, '700', '20']);

export function driver({ page, worker, shots }) {
  // The rail: its ticks (each bar's box and its tick's name) and the bookmark dots beside them (#71),
  // also the one beside the earlier-history dots (#72).
  const rail = () =>
    page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
      const center = (el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, left: r.left, right: r.right };
      };
      return {
        ticks: [...root.querySelectorAll('.tick .bar')].map((b) => ({ ...center(b), label: b.parentElement.getAttribute('aria-label') })),
        dots: [...root.querySelectorAll('.bdot:not(.gone)')].map((el) => {
          const s = getComputedStyle(el);
          return {
            ...center(el),
            cls: el.className,
            color: s.backgroundColor,
            ring: s.boxShadow,
            radius: s.borderRadius,
            opacity: +s.opacity,
            pe: s.pointerEvents,
            hidden: el.getAttribute('aria-hidden'),
            tag: el.tagName,
            tabIndex: el.tabIndex,
          };
        }),
        visible: getComputedStyle(document.querySelector('chatgpt-butter-nav')).display !== 'none',
      };
    });
  // Question `turn`'s dot: on its tick's row, its right edge 4 px left of the tick's left end.
  const dotBeside = (r, turn) => {
    const t = r.ticks[turn];
    return t && r.dots.find((d) => Math.abs(d.y - t.y) <= 0.6 && Math.abs(d.right - (t.left - 4)) <= 0.6);
  };
  // Waits for `n` bookmark dots on the rail (fading ones not counted).
  const dotCount = (n, timeout = 5000) =>
    page.waitForFunction((n) => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot:not(.gone)').length === n, n, { timeout });
  // The card open on the rail, as the tick's card shows a question's bookmarks (#70): its name, role,
  // meta line and question, rows (`why` and `tag`: the row's "answer changed"), footer, the row box
  // and the focused element.
  const tickCard = () =>
    page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        c = root.querySelector('.card'),
        s = getComputedStyle(c),
        r = c.getBoundingClientRect(),
        text = c.querySelector(':scope > .text'),
        meta = c.querySelector(':scope > .meta'),
        box = root.querySelector('.bmc .rows'),
        a = root.activeElement;
      const rect = (el) => {
        const q = el.getBoundingClientRect();
        return { x: q.left + q.width / 2, y: q.top + q.height / 2, w: q.width, h: q.height };
      };
      return {
        shown: c.classList.contains('show') && +s.opacity > 0.5,
        merged: c.classList.contains('qb'),
        role: c.getAttribute('role'),
        name: c.getAttribute('aria-label'),
        inert: c.inert,
        pe: s.pointerEvents,
        meta: !meta || getComputedStyle(meta).display === 'none' ? null : meta.textContent,
        text: !text || getComputedStyle(text).display === 'none' ? null : text.textContent,
        textLines: text ? Math.round(text.getBoundingClientRect().height / parseFloat(getComputedStyle(text).lineHeight)) : null,
        rows: getComputedStyle(root.querySelector('.bmc')).display !== 'none'
          ? [...root.querySelectorAll('.bmc .it')].map((it) => {
              const tx = it.querySelector('.tx'),
                x = it.querySelector('.x'),
                dot = it.querySelector('.dot'),
                why = it.querySelector('.why')?.textContent ?? null;
              return {
                text: tx.textContent,
                lines: Math.round(tx.getBoundingClientRect().height / parseFloat(getComputedStyle(tx).lineHeight)),
                stale: it.classList.contains('stale'),
                why,
                tag: why,
                color: getComputedStyle(tx).color,
                dot: dot && { w: dot.getBoundingClientRect().width, bg: getComputedStyle(dot).backgroundColor, ring: getComputedStyle(dot).boxShadow },
                bg: getComputedStyle(it).backgroundColor,
                xShown: getComputedStyle(x).display !== 'none' && +getComputedStyle(x).opacity === 1,
                xLabel: x.getAttribute('aria-label'),
                ...rect(it),
                xAt: rect(x),
              };
            })
          : [],
        flags: root.querySelectorAll('.bmc .flag').length,
        warn: root.querySelector('.bmc .warn')?.textContent ?? null,
        box: box && { client: box.clientHeight, scroll: box.scrollHeight },
        rect: { x: r.left, y: r.top, w: r.width, h: r.height },
        active: a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null,
      };
    });
  // The tick's card as a stale bookmark shows it: `stale` when its single row is, `one` that row's
  // text, 40 px left of its centre.
  const staleCard = async () => {
    const c = await tickCard();
    return { ...c, stale: c.rows.length === 1 && c.rows[0].stale, one: c.rows[0] && { x: c.rows[0].x - 40, y: c.rows[0].y } };
  };
  // Hover question `turn`'s tick, on its row.
  const hoverTick = async (turn) => {
    await page.mouse.move(700, 300);
    await page.waitForTimeout(200);
    const t = (await rail()).ticks[turn];
    await page.mouse.move(t.x, t.y, { steps: 4 });
    await page.waitForTimeout(350);
    return t;
  };
  // From the tick across the gap onto row k of its card, the pointer resting on its text.
  const ontoRow = async (k) => {
    const c = await tickCard();
    await page.mouse.move(c.rows[k].x - 40, c.rows[k].y, { steps: 12 });
    await page.waitForTimeout(300);
    return tickCard();
  };
  // A wheel turn first: a user scroll ends the pin a jump leaves on its question.
  const toTop = async () => {
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, -1);
    await page.waitForTimeout(50);
    await page.evaluate(() => (document.querySelector('.thread-scroll-container').scrollTop = 0));
    await page.waitForTimeout(300);
  };
  // The rail's element that has focus: its class, name and text.
  const focused = () =>
    page.evaluate(() => {
      const a = document.querySelector('chatgpt-butter-nav')?.shadowRoot.activeElement;
      return a ? { cls: a.className, label: a.getAttribute('aria-label'), text: a.textContent } : null;
    });
  // Every bookmark dot in the rail's layer, fading ones too.
  const allDots = () => page.evaluate(() => document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.bdot').length);
  // The tick's card and the rail beside it, shot as `<shots>/<name>.png`.
  const shootCard = async (name) => {
    const c = await tickCard(),
      r = await rail();
    const y = Math.max(0, Math.min(c.rect.y, r.ticks[0].y) - 30);
    await page.screenshot({ path: `${shots}/${name}.png`, clip: { x: 1400 - 420, y, width: 420, height: Math.max(c.rect.y + c.rect.h, r.ticks.at(-1).y) - y + 30 } });
  };
  const railBox = () =>
    page.evaluate(() => {
      const r = document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.rail').getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height };
    });
  // Jump to question `turn` with its tick, then the pointer leaves: that question alone is lit (when
  // each answer runs past the view, as the dot scenarios' `tail` makes it).
  const readAt = async (turn) => {
    const t = await hoverTick(turn);
    await page.mouse.click(t.x, t.y);
    await page.waitForTimeout(3500);
    await page.mouse.move(700, 300);
    await page.waitForTimeout(1200);
  };
  // The lit ticks of rail `r`: [question, width] for each tick not at rest (12 px).
  const lit = (r) => r.ticks.map((t, i) => [i, Math.round(t.w * 10) / 10]).filter(([, w]) => w !== 12);
  const questionTop = (turn) =>
    page.evaluate(
      (id) => document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top,
      question(turn),
    );
  // The selection pill (#77): Butter's cells beside the fixture's "Ask ChatGPT", their names, key
  // hints and boxes, the pill's look, and the label under it.
  const pill = () =>
    page.evaluate(() => {
      const host = document.querySelector('chatgpt-butter-pill'),
        root = host?.shadowRoot,
        el = root?.querySelector('.pill'),
        shown = !!el && getComputedStyle(el).display !== 'none';
      const box = (e) => e && e.getBoundingClientRect().toJSON();
      const tip = root?.querySelector('.tip');
      const tipShown = !!tip && getComputedStyle(tip).display !== 'none';
      const native = document.querySelector('.fx-native:not([hidden]) > div');
      const s = el && getComputedStyle(el);
      return {
        shown,
        inBody: host?.parentNode === document.body,
        box: shown ? box(el) : null,
        css: shown ? { bg: s.backgroundColor, radius: s.borderTopLeftRadius, shadow: s.boxShadow } : null,
        native: box(native),
        nativeCss: native && { bg: getComputedStyle(native).backgroundColor, radius: getComputedStyle(native).borderTopLeftRadius, shadow: getComputedStyle(native).boxShadow },
        cells: shown
          ? [...el.querySelectorAll('button')].map((b) => ({
              id: b.dataset.cell,
              name: b.getAttribute('aria-label'),
              keys: b.getAttribute('aria-keyshortcuts'),
              text: b.textContent.trim(),
              divider: getComputedStyle(b).borderLeftWidth,
              ...box(b),
            }))
          : [],
        tip: tipShown
          ? { text: tip.querySelector('span').textContent, kbd: tip.querySelector('kbd').textContent, kbdShown: getComputedStyle(tip.querySelector('kbd')).display !== 'none', ...box(tip) }
          : null,
        // The old hover button's layer must be gone (#77).
        hoverButton: !!document.querySelector('chatgpt-butter-bookmark'),
      };
    });
  // The Bookmark cell, or null when the pill doesn't show it.
  const button = async () => {
    const p = await pill(),
      c = p.cells.find((x) => x.id === 'bookmark');
    return c ? { ...c, shown: true, x: c.left, y: c.top, w: c.width, h: c.height, pill: p } : null;
  };
  // Hover cell `id` long enough for its label; returns the pill with the label.
  const hoverCell = async (id, wait = 350) => {
    const c = (await pill()).cells.find((x) => x.id === id);
    if (!c) return null;
    await page.mouse.move(c.left + c.width / 2, c.top + c.height / 2, { steps: 3 });
    await page.waitForTimeout(wait);
    return pill();
  };
  // The bookmark notification (#77): its form, text, buttons and box.
  const noteCard = () =>
    page.evaluate(() => {
      const host = document.querySelector('chatgpt-butter-bookmark-notice');
      if (!host) return { shown: false };
      // Its place from the host: the card inside slides 16 px while it enters.
      const card = host.shadowRoot.querySelector('.card'),
        r = host.getBoundingClientRect(),
        ex = card.querySelector('.ex');
      return {
        shown: !host.hidden && host.hasAttribute('data-visible') && !host.inert,
        kind: card.className,
        role: card.getAttribute('role'),
        lang: card.lang,
        title: card.querySelector('.tx b')?.textContent ?? null,
        excerpt: ex?.textContent ?? null,
        oneLine: ex ? ex.scrollHeight <= parseFloat(getComputedStyle(ex).lineHeight) + 1 && getComputedStyle(ex).textOverflow === 'ellipsis' : null,
        struck: ex ? getComputedStyle(ex).textDecorationLine === 'line-through' : null,
        body: card.querySelector('.d')?.textContent ?? null,
        href: card.querySelector('a')?.getAttribute('href') ?? null,
        buttons: [...card.querySelectorAll('button')].map((b) => b.textContent),
        top: r.top,
        bottom: r.bottom,
        left: r.left,
        right: r.right,
        width: r.width,
        z: getComputedStyle(host).zIndex,
        font: getComputedStyle(card).fontFamily,
        bg: getComputedStyle(card).backgroundColor,
        color: getComputedStyle(card).color,
        transform: getComputedStyle(card).transform,
        focused: document.activeElement === host,
        railInset: globalThis.innerWidth - (document.querySelector('chatgpt-butter-nav')?.shadowRoot.querySelector('.rail')?.getBoundingClientRect().right ?? innerWidth),
      };
    });
  const waitNote = (title, timeout = 5000) =>
    page
      .waitForFunction(
        (title) => {
          const host = document.querySelector('chatgpt-butter-bookmark-notice');
          return host?.hasAttribute('data-visible') && !host.inert && host.shadowRoot.querySelector('.tx b')?.textContent === title;
        },
        title,
        { timeout },
      )
      .then(() => page.waitForTimeout(300)) // the 200 ms enter motion
      .catch(() => {});
  // Click the notification's `which` button ('undo' or 'ok').
  const pressNote = async (which) => {
    const at = await page.evaluate((which) => {
      const b = document
        .querySelector('chatgpt-butter-bookmark-notice')
        .shadowRoot.querySelector(`button[data-notice="${which}"]`)
        ?.getBoundingClientRect();
      return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 };
    }, which);
    if (at) await page.mouse.click(at.x, at.y);
    return !!at;
  };
  const block = (turn, k) =>
    page.evaluate(
      ([id, k, PARAS]) => {
        const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
        const r = el.getBoundingClientRect(),
          sc = document.querySelector('.thread-scroll-container').getBoundingClientRect();
        return { x: r.left, y: r.top, w: r.width, h: r.height, fromTop: r.top - sc.top };
      },
      [answer(turn), k, PARAS],
    );
  const scrollTo = (turn) =>
    page.evaluate((id) => {
      const sc = document.querySelector('.thread-scroll-container');
      sc.scrollTop += document.querySelector(`[data-turn-key="${id}"]`).getBoundingClientRect().top - 120;
    }, question(turn));
  // Select text in answer paragraphs: from `start` in paragraph k to `end` in paragraph k2.
  const select = (turn, k, start, k2, end) =>
    page.evaluate(
      ([id, k, start, k2, end, PARAS]) => {
        const blocks = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS);
        const r = document.createRange();
        r.setStart(blocks[k].firstChild, start);
        r.setEnd(blocks[k2].firstChild, end);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      },
      [answer(turn), k, start, k2, end, PARAS],
    );
  // Press the bookmark command's key as real input, with the X pointer parked on the header; without
  // a display, the worker relays the command to the tab as Chrome would.
  async function shortcut() {
    if (headed) xkeys('Alt+Shift+M');
    else
      await worker.evaluate(async () => {
        // Reading tab urls needs a permission Butter doesn't have: only the chat's tab listens.
        for (const tab of await chrome.tabs.query({ active: true }))
          await chrome.tabs.sendMessage(tab.id, { version: 1, type: 'butter-bookmark-shortcut' }).catch(() => {});
      });
    await page.waitForTimeout(600);
  }
  // Where a stored bookmark's text starts, in px below the scroller's top.
  const textTop = (turn, k, offset) =>
    page.evaluate(
      ([id, k, offset, PARAS]) => {
        const node = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k].firstChild;
        const r = document.createRange();
        r.setStart(node, offset);
        r.setEnd(node, offset + 1);
        return r.getClientRects()[0].top - document.querySelector('.thread-scroll-container').getBoundingClientRect().top;
      },
      [answer(turn), k, offset, PARAS],
    );
  // From the top of the chat, click row k of question `turn`'s card (its tick holds a dot) and wait
  // for the jump.
  async function jumpByRow(turn, k = 0) {
    await toTop();
    if (!dotBeside(await rail(), turn)) return false;
    await hoverTick(turn);
    const c = await tickCard();
    if (!c.merged || !c.rows[k]) return false;
    await ontoRow(k);
    await page.mouse.click(c.rows[k].x - 40, c.rows[k].y);
    await page.waitForTimeout(3500);
    return true;
  }

  // Select a whole paragraph (or with `keep` the selection already made), wait for the pill's
  // Bookmark cell, and hand back a click on it. `low`: the paragraph sits too far down its answer to
  // show after scrolling to its question; scroll it to 200 px instead.
  async function bookmark(turn, k, low = false, { keep = false } = {}) {
    if (low)
      await page.evaluate(
        ([id, k, PARAS]) => {
          const sc = document.querySelector('.thread-scroll-container');
          const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
          sc.scrollTop += el.getBoundingClientRect().top - 200;
        },
        [answer(turn), k, PARAS],
      );
    else if (!keep) await scrollTo(turn);
    await page.mouse.move(10, 10);
    await page.waitForTimeout(100);
    const b = await block(turn, k);
    if (!keep) await selectBlock(turn, k);
    await page
      .waitForFunction(() => !!document.querySelector('chatgpt-butter-pill')?.shadowRoot.querySelector('.pill[data-on] [data-cell="bookmark"]'), null, { timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(100);
    const kept = await button();
    return {
      first: b,
      b,
      kept,
      click: async () => {
        if (!kept) return;
        await page.mouse.click(kept.x + kept.w / 2, kept.y + kept.h / 2);
      },
    };
  }
  // Select paragraph k of question `turn`'s answer, all of it.
  const selectBlock = (turn, k) =>
    page.evaluate(
      ([id, k, PARAS]) => {
        const el = document.querySelector(`[data-fx-answer="${id}"] [data-markdown-text-style]`).querySelectorAll(PARAS)[k];
        const r = document.createRange();
        r.selectNodeContents(el);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      },
      [answer(turn), k, PARAS],
    );
  // Delete row k of question `turn`'s tick card with its ×, as the reader does.
  async function removeRow(turn, k = 0) {
    await toTop();
    await hoverTick(turn);
    const c = await ontoRow(k);
    if (!c.rows[k]) return false;
    await page.mouse.move(c.rows[k].xAt.x, c.rows[k].xAt.y, { steps: 3 });
    await page.mouse.click(c.rows[k].xAt.x, c.rows[k].xAt.y);
    await page.waitForTimeout(400);
    return true;
  }
  return {
    rail, dotBeside, dotCount, tickCard, staleCard, hoverTick, ontoRow, toTop, focused, allDots, shootCard, railBox, readAt, lit, questionTop, pill, button, hoverCell, noteCard, waitNote, pressNote, block, scrollTo, select, shortcut, textTop, jumpByRow, bookmark, selectBlock, removeRow,
  };
}
