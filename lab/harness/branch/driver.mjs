// The Ask in branch driver for the branch fixture: Butter's question box, working and failure cards
// and the ready line (all in Butter's chatgpt-butter-branch layer), and what the fixture page
// recorded. Each helper takes the page it reads, since a scenario drives the original tab and the
// new one. The selection pill and text selection come from the shared driver (../driver/butter.mjs),
// bound to the fixture's "Ask ChatGPT" box.
import assert from 'node:assert/strict';
import { butterDriver } from '../driver/butter.mjs';

export const HOST = 'chatgpt-butter-branch';
// The fixture's "Ask ChatGPT" box while it shows.
const NATIVE = '.native:not([hidden]) > div';
// extension/branch/run.js TIMING: one menu step, and the verification window.
export const TIMING_STEP = 4_000,
  TIMING_VERIFY = 15_000;
export const butter = (page) => butterDriver({ page, native: NATIVE });
export const inShadow = (page, selector) => page.locator(`${HOST} ${selector}`);
// Ask in branch's cell in the selection pill (selection/pill.js, #77).
export const chipOf = (page) => butter(page).cell('branch');
// Select all of the element `selector` matches first (the quote by default).
export const select = (page, selector = '#quote') => butter(page).selectContents({ css: selector });
// `chip`: the pill's box while it shows Ask in branch (null when hidden), `cell`: that cell's box;
// `chipCss` and `nativeCss`: the pill's and ChatGPT's box's look (background, radius, shadow).
export const rects = async (page) => {
  const p = await butter(page).pill(),
    cell = p.cells.find((c) => c.id === 'branch');
  return {
    native: p.native,
    chip: cell ? p.box : null,
    cell: cell ?? null,
    cellBg: cell?.bg ?? null,
    nativeCss: p.nativeCss,
    chipCss: cell ? p.css : null,
    name: cell?.name ?? null,
    icon: !!cell?.icon,
  };
};
export const settle = (page) => page.waitForTimeout(150);
// The ready line, ChatGPT's disclaimer text (null when the fixture has none) and the composer.
export const lineGeometry = (page) =>
  page.evaluate((host) => {
    const box = (el) => el?.getBoundingClientRect().toJSON() || null;
    return {
      line: box(document.querySelector(host)?.shadowRoot?.querySelector('.line')),
      disclaimer: box(document.querySelector('.disclaimer > div')),
      composer: box(document.querySelector('.composer')),
    };
  }, HOST);
// The line's box equals the disclaimer's, within 1 px.
export const assertCovers = (g, at) => {
  assert.ok(g.disclaimer && g.line, `${at}: line and disclaimer ${JSON.stringify(g)}`);
  for (const k of ['left', 'top', 'width', 'height'])
    assert.ok(Math.abs(g.line[k] - g.disclaimer[k]) <= 1, `${at}: line ${k} ${JSON.stringify(g)}`);
};
// What the line looks like over the disclaimer, and what a click at the disclaimer's centre hits.
export const lineLook = (page) =>
  page.evaluate((host) => {
    const line = document.querySelector(host)?.shadowRoot?.querySelector('.line');
    const disc = document.querySelector('.disclaimer > div');
    const r = disc.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const css = (el) => el && getComputedStyle(el);
    const parts = line && [line.querySelector('svg'), line.querySelector('.xs')].map((el) => el.getBoundingClientRect());
    return {
      hit: hit === document.querySelector(host) ? 'butter' : disc.contains(hit) || hit?.contains(disc) ? 'disclaimer' : hit?.className,
      line: line && {
        row: line.classList.contains('row'),
        background: css(line).backgroundColor,
        fontSize: css(line).fontSize,
        lineHeight: css(line).lineHeight,
        color: css(line).color,
        icon: css(line.querySelector('svg')).color,
        iconSize: parts[0].width,
        xSize: parts[1].width,
        gap: css(line).columnGap,
        text: line.querySelector('.t').textContent,
        title: line.title,
        oneRow: line.querySelector('.t').scrollHeight <= line.querySelector('.t').clientHeight + 1,
        truncated: line.querySelector('.t').scrollWidth > line.querySelector('.t').clientWidth,
        // The icon, text and × as one group: its centre against the line's.
        offCentre: (parts[0].left + parts[1].right) / 2 - (line.getBoundingClientRect().left + line.getBoundingClientRect().right) / 2,
        err: css(line).getPropertyValue('--err').trim(),
      },
      disclaimer: { fontSize: css(disc).fontSize, lineHeight: css(disc).lineHeight, color: css(disc).color },
      pageBackground: css(document.body).backgroundColor,
    };
  }, HOST);
// Resolves once the original tab's question box has closed.
export const boxClosed = (page) =>
  page.waitForFunction((host) => !document.querySelector(host)?.shadowRoot?.querySelector('.qpop'), HOST);
// What the fixture recorded in a tab: its route, sends, branches and menu presses, the composer's
// text, and whether "Branch in new chat" is open.
export const destState = (dest) =>
  dest.evaluate(() => ({
    path: decodeURIComponent(location.pathname),
    sent: fixture.sent.length,
    branched: fixture.branchedFrom.length,
    presses: fixture.morePresses,
    composer: document.querySelector('.ProseMirror').innerText.trim(),
    newChatItem: [...document.querySelectorAll('[role=menuitem]')].some((el) => el.textContent === 'Branch in new chat'),
  }));
// The failure card's cause sentence per fixture failure type.
export const CAUSES = {
  more: 'Couldn’t find the latest reply’s “More actions” button. Nothing was sent.',
  branch: 'Couldn’t find ChatGPT’s “Branch conversation” menu. Nothing was sent.',
  newchat: 'Couldn’t find ChatGPT’s “Branch in new chat” menu. Nothing was sent.',
  identity: 'The tab didn’t move to a new chat. Nothing was sent.',
  load: 'This chat didn’t finish loading. Nothing was sent.',
};
export const heading = (dest) => inShadow(dest, '.card h3').innerText();
// The working card per the mockup (state 3): 400 px wide, centred, 250 px from the top at
// 800 px height; the scrim covers the whole page, header included (user decision).
export const cardGeometry = (dest) =>
  dest.evaluate((host) => {
    const root = document.querySelector(host).shadowRoot;
    return {
      card: root.querySelector('.card').getBoundingClientRect().toJSON(),
      scrim: root.querySelector('.scrim').getBoundingClientRect().toJSON(),
      width: innerWidth,
    };
  }, HOST);
