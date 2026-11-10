import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const popup = new URL('../extension/popup/', import.meta.url);

// The drip SVG sits at the bottom of the card's padding box, so y = 0 is the top of the card's
// bottom border. A butter rect hides that border where the drip's outline has left it.
test('the drip hides the card border across its whole width and stays off the shadow', async () => {
  const js = await readFile(new URL('popup.js', popup), 'utf8');
  const css = await readFile(new URL('popup.css', popup), 'utf8');
  const border = Number(css.match(/\.master \{[^}]*?border: ([\d.]+)px solid/)[1]);

  const d = js.match(/const D =\s*'([^']+)'/)[1];
  const nums = d.match(/-?[\d.]+/g).map(Number);
  const [startX, startY] = nums.slice(0, 2);
  const [endX, endY] = nums.slice(-2);
  assert.equal(startY, border / 2, 'outline leaves along the border centre line');
  assert.equal(endY, border / 2, 'outline rejoins along the border centre line');

  const drip = js.match(/const drip = `([\s\S]*?)`;/)[1];
  const [x, y, width, height] = ['x', 'y', 'width', 'height'].map((k) =>
    Number(drip.match(new RegExp(`<rect[^>]*\\b${k}="(-?[\\d.]+)"`))[1]),
  );
  assert.ok(
    x <= startX,
    `rect starts at x=${x}, after the outline leaves the border at x=${startX}`,
  );
  assert.ok(
    x + width >= endX,
    `rect ends at x=${x + width}, before the outline rejoins at x=${endX}`,
  );
  assert.ok(y <= 0, 'rect covers the top of the border');
  assert.ok(y + height > border / 2, 'rect overlaps the drip fill, so no seam shows between them');
  assert.ok(
    y + height <= border,
    `rect reaches y=${y + height}, onto the card shadow below the border`,
  );
});
