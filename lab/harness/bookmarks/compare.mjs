// Pixel comparison of two PNG screenshots, for the mockup checks.
import fs from 'node:fs/promises';

export const png = async (file) => `data:image/png;base64,${(await fs.readFile(file)).toString('base64')}`;

// Share of pixels that differ by more than 24 in any channel (as consent-qa.mjs measures it).
// `radius`: the images are a card's own box with that corner radius; the corners outside it (the
// page and the shadow behind the card, which differ between the two) are left out.
// With `plain` ([a's page, b's page] without the drawing under test), pixels where those two
// already differ (the pages' own text drawn a pixel apart) are masked: `ratio` is over the rest,
// `strict` over all, `masked` the share masked. `masks`: boxes { x, y, w, h } in the images' pixels
// that are left out too. `near`: a pixel also matches when one of `b`'s within 1 px of it does (for
// marks drawn on fractions of a pixel).
export async function compare(page, a, b, { radius = 0, plain = null, masks = [], near = false } = {}) {
  return page.evaluate(
    async ([a, b, radius, plain, masks, near]) => {
      const load = (src) =>
        new Promise((r) => {
          const i = new Image();
          i.onload = () => r(i);
          i.src = src;
        });
      const [x, y, ...pl] = await Promise.all([a, b, ...(plain ?? [])].map(load));
      if (x.width !== y.width || x.height !== y.height) return { size: [x.width, x.height, y.width, y.height] };
      const data = (img) => {
        const c = new OffscreenCanvas(img.width, img.height),
          g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        return g.getImageData(0, 0, img.width, img.height).data;
      };
      const p = data(x),
        q = data(y),
        [u, v] = pl.map(data);
      const w = x.width,
        h = x.height,
        out = (i, j) => {
          const dx = Math.max(0, radius - (i + 0.5), i + 0.5 - (w - radius)),
            dy = Math.max(0, radius - (j + 0.5), j + 0.5 - (h - radius));
          return dx > 0 && dy > 0 && Math.hypot(dx, dy) > radius - 1;
        };
      const off = (p, q, k) => Math.max(Math.abs(p[k] - q[k]), Math.abs(p[k + 1] - q[k + 1]), Math.abs(p[k + 2] - q[k + 2])) > 24;
      let n = 0,
        px = 0,
        all = 0,
        masked = 0;
      const boxed = (i, j) => masks.some((m) => i >= m.x && i < m.x + m.w && j >= m.y && j < m.y + m.h);
      for (let k = 0; k < p.length; k += 4) {
        const i = (k / 4) % w,
          j = Math.floor(k / 4 / w);
        if (radius && out(i, j)) continue;
        if (masks.length && boxed(i, j)) continue;
        px++;
        let d = off(p, q, k);
        // `near`: a pixel matches when one of b's within 1 px of it does.
        if (d && near)
          for (let dj = -1; dj <= 1 && d; dj++)
            for (let di = -1; di <= 1 && d; di++) {
              const o = 4 * ((j + dj) * w + i + di);
              if (i + di >= 0 && i + di < w && j + dj >= 0 && j + dj < h)
                d = Math.max(Math.abs(p[k] - q[o]), Math.abs(p[k + 1] - q[o + 1]), Math.abs(p[k + 2] - q[o + 2])) > 24;
            }
        all += d;
        if (u && off(u, v, k)) masked++;
        else n += d;
      }
      return u ? { ratio: n / (px - masked), strict: all / px, masked: masked / px } : { ratio: n / px, pixels: n };
    },
    [await png(a), await png(b), radius, plain && (await Promise.all(plain.map(png))), masks, near],
  );
}
