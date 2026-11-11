// Butter's selection pill (selection/pill.js, #77) and selecting text in an answer, driven as a
// reader does, for any harness: the fixture QAs and the live checks. It reads only Butter's own
// elements and the page's DOM; whatever belongs to one page (ChatGPT's "Ask ChatGPT" button, where
// an answer's paragraphs are) comes in as CSS.
//
// `butterDriver({ page, native })` binds it to a page. `native` is the CSS of ChatGPT's own "Ask
// ChatGPT" box while it shows, which `pill()` reports beside Butter's for comparison (null: not
// read).
//
// An element is `{ css, within, index }`: the `index`-th (default 0) match of `css` inside the
// first match of `within` (default: the document), so `css` may start with `:scope >`.

const PILL = 'chatgpt-butter-pill';

export function butterDriver({ page, native = null }) {
  // The pill: its box and look (background, radius, shadow), Butter's cells in order (id, name,
  // key hint, text, divider, background, icon only, box), the label under it, and ChatGPT's own box
  // and look when `native` is given.
  const pill = () =>
    page.evaluate(
      ([host, nativeCss]) => {
        const root = document.querySelector(host)?.shadowRoot,
          el = root?.querySelector('.pill'),
          shown = !!el && getComputedStyle(el).display !== 'none';
        const box = (e) => e && e.getBoundingClientRect().toJSON();
        const look = (e) => {
          const s = getComputedStyle(e);
          return { bg: s.backgroundColor, radius: s.borderTopLeftRadius, shadow: s.boxShadow };
        };
        const tip = root?.querySelector('.tip');
        const tipShown = !!tip && getComputedStyle(tip).display !== 'none';
        const nat = nativeCss ? document.querySelector(nativeCss) : null;
        return {
          shown,
          inBody: document.querySelector(host)?.parentNode === document.body,
          box: shown ? box(el) : null,
          css: shown ? look(el) : null,
          native: box(nat),
          nativeCss: nat && look(nat),
          cells: shown
            ? [...el.querySelectorAll('button')].map((b) => ({
                id: b.dataset.cell,
                name: b.getAttribute('aria-label'),
                keys: b.getAttribute('aria-keyshortcuts'),
                text: b.textContent.trim(),
                divider: getComputedStyle(b).borderLeftWidth,
                bg: getComputedStyle(b).backgroundColor,
                icon: !!b.querySelector('svg') && !b.textContent.trim(),
                ...box(b),
              }))
            : [],
          tip: tipShown
            ? {
                text: tip.querySelector('span').textContent,
                kbd: tip.querySelector('kbd').textContent,
                kbdShown: getComputedStyle(tip.querySelector('kbd')).display !== 'none',
                ...box(tip),
              }
            : null,
          // The old hover button's layer must be gone (#77).
          hoverButton: !!document.querySelector('chatgpt-butter-bookmark'),
        };
      },
      [PILL, native],
    );
  // Cell `id`'s button ('branch', 'bookmark'), as a locator.
  const cell = (id) => page.locator(`${PILL} button[data-cell="${id}"]`);
  // Hover cell `id` for `wait` ms (its label shows after 300); returns the pill then, or null when
  // the pill doesn't show that cell.
  const hoverCell = async (id, wait = 350) => {
    const c = (await pill()).cells.find((x) => x.id === id);
    if (!c) return null;
    await page.mouse.move(c.left + c.width / 2, c.top + c.height / 2, { steps: 3 });
    await page.waitForTimeout(wait);
    return pill();
  };
  // Select all of an element's text.
  const selectContents = (el) =>
    page.evaluate(
      ([{ css, within, index = 0 }]) => {
        const r = document.createRange();
        r.selectNodeContents((within ? document.querySelector(within) : document).querySelectorAll(css)[index]);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      },
      [el],
    );
  // Select from offset `start` in element `from`'s first text node to offset `end` in element
  // `to`'s.
  const selectText = (from, start, to, end) =>
    page.evaluate(
      ([from, start, to, end]) => {
        const node = ({ css, within, index = 0 }) => (within ? document.querySelector(within) : document).querySelectorAll(css)[index].firstChild;
        const r = document.createRange();
        r.setStart(node(from), start);
        r.setEnd(node(to), end);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      },
      [from, start, to, end],
    );
  const clearSelection = () => page.evaluate(() => getSelection().removeAllRanges());
  // Select by dragging the mouse along one line, from `x1` to `x2` at `y`, as a reader does: live
  // ChatGPT shows its own "Ask ChatGPT" only for a real pointer selection.
  const dragAcross = async ({ x1, x2, y }) => {
    await page.mouse.move(x1, y);
    await page.mouse.down();
    await page.mouse.move(x2, y, { steps: 10 });
    await page.mouse.up();
  };
  return { pill, cell, hoverCell, selectContents, selectText, clearSelection, dragAcross };
}
