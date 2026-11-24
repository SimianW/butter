// Compares the popup states popup-qa.mjs built with an approved mockup's panels, by pixels and
// height. Two mockup shapes: `iframes` (each panel an iframe[data-panel] whose srcdoc is the panel,
// as #35's and #32's mockups) and `figures` (each panel a figure[id] whose .fr frame holds a
// data-state that the mockup's own popup(state) draws, as #158's experimental-page.html).
import path from 'node:path';
import fs from 'node:fs/promises';
import { evidenceShot } from '../runner/shot.mjs';

// The header version label, the storage rows' saved lines and their Clear show live data; every
// comparison masks them where either document draws them.
export const liveRegions = () =>
  [...document.querySelectorAll('.ver, .row .d > [role="status"], .row .d:has(.lk)')].map((e) => {
    const r = e.getBoundingClientRect();
    return [Math.floor(r.left), Math.floor(r.top), Math.ceil(r.right), Math.ceil(r.bottom)];
  });

// `heights[state]` and `liveRects[state]` come from the built states; `shots` holds each built
// state's `<state>.png`. Each panel must match its state's height and differ in under 0.1% of
// pixels (by more than 24 in a channel), with the live regions masked.
export function mockupComparer({ browser, shots, profile, heights, liveRects, errors }) {
  const png = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;
  // Share of unmasked pixels that differ by more than 24 in any channel. Each image is cut to its
  // measured height (an element screenshot rounds a fractional bottom up a row); area outside the
  // shorter one counts as different, so a height mismatch still yields a ratio.
  const ratio = async (page, built, reference, hb, hr, mask) =>
    page.evaluate(
      async ([a, b, ha, hb, mask]) => {
        const load = (src) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = src; });
        const data = (img, h) => { const c = new OffscreenCanvas(360, h), g = c.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, 360, h).data; };
        const [x, y] = await Promise.all([load(a), load(b)]), p = data(x, ha), q = data(y, hb), h = Math.max(ha, hb);
        let n = 0;
        for (let j = 0; j < h; j++) for (let i = 0; i < 360; i++) {
          if (mask.some(([l, t, r, b]) => i >= l && i < r && j >= t && j < b)) continue;
          if (j >= ha || j >= hb) { n++; continue; }
          const k = (j * 360 + i) * 4;
          if (Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24) n++;
        }
        return n / (360 * h);
      },
      [await png(built), await png(reference), hb, hr, mask],
    );
  const report = (title, rows) => {
    console.log(`${title}:`);
    for (const r of rows) console.log(`  ${r.panel.padEnd(24)} ${r.skipped ? `skipped: ${r.skipped}` : `${r.ok ? 'match' : 'DIFF '}  height ${r.built}/${r.reference} px  diff ${(r.ratio * 100).toFixed(3)}%`}${r.excluded ? `  (excluded: ${r.excluded})` : ''}`);
    return rows;
  };
  // Drops the panel's annotations and settles its animations before the reference shot.
  const settle = (page) =>
    page.evaluate(() => {
      // Infinite animations (the dev card's recording dot) hold their first frame.
      document.getAnimations().forEach((a) => { if (a.effect.getComputedTiming().endTime === Infinity) { a.pause(); a.currentTime = 0; } else a.finish(); });
      document.querySelectorAll('.mk, .mark').forEach((e) => { e.style.visibility = 'hidden'; });
    });
  // One panel against its built state: `draw(page)` puts the panel at the page origin and returns
  // its height.
  async function compare(page, row, draw) {
    if (!heights[row.state]) return { ...row, skipped: 'state not captured (BUTTER_CASES)' };
    row.built = heights[row.state];
    await page.emulateMedia({ colorScheme: row.state.endsWith('-dark') ? 'dark' : 'light', reducedMotion: 'no-preference' });
    row.reference = await draw(page);
    await page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));
    await settle(page);
    const reference = `${shots}/reference-${row.panel}.png`;
    await evidenceShot(page, reference, { target: { x: 0, y: 0, width: 360, height: row.reference } });
    const mask = [...liveRects[row.state], ...(await page.evaluate(liveRegions))];
    row.ratio = await ratio(page, `${shots}/${row.state}.png`, reference, row.built, row.reference, mask);
    row.ok = row.built === row.reference && row.ratio < 0.001;
    return row;
  }
  // [panel name, built state, excluded?] for a mockup whose panels are iframes.
  async function compareMockup(mockupFile, panels, title) {
    const rows = [];
    const mock = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    await mock.goto(`file://${path.resolve(mockupFile)}`);
    // The page script measures each panel on load and again up to 3 s later, once its fonts settle.
    await mock.waitForFunction(() => [...document.querySelectorAll('iframe[data-panel]')].every((f) => f.dataset.h));
    await mock.waitForTimeout(3200);
    const panel = await browser.newPage({ viewport: { width: 360, height: 900 } });
    panel.on('pageerror', (e) => errors.push(`mockup panel: ${e.message}`));
    for (const [name, state, excluded] of panels) {
      const frame = mock.locator(`iframe[data-panel="${name}"]`);
      const row = { panel: name, state, excluded };
      if (!(await frame.count())) { rows.push({ ...row, skipped: 'no panel on this side' }); continue; }
      // Render the panel's own document (placeholders already substituted) at the page origin;
      // inside the grid its frame sits at a subpixel offset.
      const doc = path.join(profile, `${name}.html`);
      await fs.writeFile(doc, await frame.getAttribute('srcdoc'));
      const reference = Number(await frame.getAttribute('data-h'));
      rows.push(await compare(panel, row, async (p) => { await p.goto(`file://${doc}`); return reference; }));
    }
    await mock.close(); await panel.close();
    return report(title, rows);
  }
  // [panel id, built state] for a mockup whose panels are figures drawn by its popup(state).
  async function compareFigures(mockupFile, panels, title) {
    const rows = [];
    const mock = await browser.newPage({ viewport: { width: 360, height: 900 } });
    mock.on('pageerror', (e) => errors.push(`mockup: ${e.message}`));
    await mock.goto(`file://${path.resolve(mockupFile)}`);
    const states = await mock.evaluate(() => Object.fromEntries([...document.querySelectorAll('figure[id]')].map((f) => [f.id, f.querySelector('.fr')?.dataset.state])));
    for (const [name, state] of panels) {
      const row = { panel: name, state };
      if (!states[name]) { rows.push({ ...row, skipped: 'no such panel in the mockup' }); continue; }
      // Draw the panel alone at the page origin, without the frame's zoom and annotations.
      rows.push(await compare(mock, row, (p) => p.evaluate((s) => {
        document.body.style.margin = '0';
        document.body.innerHTML = popup(JSON.parse(s));
        return document.querySelector('.pp').offsetHeight;
      }, states[name])));
    }
    await mock.close();
    return report(title, rows);
  }
  return { compareMockup, compareFigures };
}
