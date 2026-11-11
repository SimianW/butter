// The landing wash's measuring kit (#69, #74), moved from the single script: the page-side helpers
// (`window.__wk`, installed after every load; no eval: ChatGPT's page has a CSP) and the pixel
// comparison of two screenshots. Targets are `window.__wash`: the answer's turn key and the
// paragraph indices, kept in the page only (and in the worker across reloads).
import zlib from 'node:zlib';
import { requireThat } from './page.mjs';

export const WASH_HOST = 'chatgpt-butter-wash';
export const installKit = (page) =>
  page.evaluate(() => {
    const SKIP = 'button,script,style,.katex-mathml';
    const sc = () =>
      [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
    // A paragraph's text runs, as bookmarks/content.js counts them.
    const nodes = (b) => {
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT),
        out = [];
      let at = 0;
      for (let n = w.nextNode(); n; n = w.nextNode()) {
        if (n.parentElement?.closest(SKIP)) continue;
        out.push({ n, start: at });
        at += n.data.length;
      }
      return out;
    };
    const block = (kind) => {
      const W = window.__wash,
        a = document.querySelector(`[data-turn-key="${W.turn}"]`)?.querySelector(W.answer);
      return (
        a?.querySelectorAll(W.blocks)[
          kind === 'paragraph' ? W.para : kind === 'selection' ? W.sel.para : W.table
        ] ?? null
      );
    };
    const tableOf = (b) => (b.matches('table') ? b : b.querySelector('table'));
    window.__wk = {
      sc,
      // Picks, among the mounted answers (latest first), one with two long paragraphs and a table.
      pick(blocks, answer) {
        for (const t of [...document.querySelectorAll('[data-turn-key]')].reverse()) {
          const a = t.querySelector(answer);
          if (!a) continue;
          const bs = [...a.querySelectorAll(blocks)];
          const ps = bs
            .map((b, i) => ({ b, i }))
            .filter(({ b }) => b.tagName === 'P' && b.textContent.replace(/\s+/g, ' ').length > 120);
          const table = bs.findIndex((b) => !!tableOf(b));
          if (ps.length < 2 || table < 0) continue;
          // The selection: about 110 characters of a plain run of text in the second paragraph,
          // from and to a non-space character (a selection's ends are trimmed).
          const long = nodes(ps[1].b).find(
            (x) => x.n.data.length >= 90 && !x.n.parentElement.closest('.katex, code, a'),
          );
          if (!long) continue;
          const d = long.n.data;
          let s = 5,
            e = Math.min(d.length, 115);
          while (s < e && /\s/.test(d[s])) s++;
          while (e > s && /\s/.test(d[e - 1])) e--;
          const sel = { para: ps[1].i, start: long.start + s, end: long.start + e };
          window.__wash = { turn: t.dataset.turnKey, answer, blocks, para: ps[0].i, sel, table };
          return {
            paragraph: ps[0].i,
            selectionParagraph: sel.para,
            selectionCharacters: sel.end - sel.start,
            table,
            tableNested: !bs[table].matches('table'),
          };
        }
        return null;
      },
      // Scrolls target `kind` to `y` px below the scroller's top.
      show(kind, y) {
        const b = block(kind),
          s = sc();
        if (b) s.scrollTop += b.getBoundingClientRect().top - s.getBoundingClientRect().top - y;
        return !!b;
      },
      // A point on the target's first line.
      point(kind) {
        const r = block(kind)?.getBoundingClientRect();
        return r && { x: r.left + Math.min(150, r.width / 2), y: r.top + Math.min(12, r.height / 2) };
      },
      // The selection target: `__wash.sel`'s characters, across the paragraph's text runs. (A
      // whole paragraph or table is selected with the Butter driver's selectContents.)
      select() {
        const W = window.__wash,
          ns = nodes(block('selection')),
          at = (o) => ns.findLast((x) => x.start <= o),
          p = at(W.sel.start),
          q = at(W.sel.end - 1),
          r = document.createRange();
        r.setStart(p.n, W.sel.start - p.start);
        r.setEnd(q.n, W.sel.end - q.start);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
      },
      // The lines the bookmarked text has now, 2 px above and below (the wash's boxes when they
      // are right); for the table, its box (cut to a viewport that scrolls it) 3 px around it.
      expected(kind) {
        const b = block(kind);
        if (!b) return [];
        const t = tableOf(b);
        if (kind === 'table' && t) {
          const q = t.getBoundingClientRect();
          let { left, right } = q;
          for (let k = t.parentElement; k && b.contains(k); k = k.parentElement)
            if (getComputedStyle(k).overflowX !== 'visible') {
              const v = k.getBoundingClientRect();
              left = Math.max(left, v.left);
              right = Math.min(right, v.right);
            }
          return [{ left: left - 3, right: right + 3, top: q.top - 3, bottom: q.bottom + 3 }];
        }
        const W = window.__wash,
          [from, to] = kind === 'selection' ? [W.sel.start, W.sel.end] : [0, Infinity],
          r = document.createRange(),
          lines = [];
        for (const { n, start } of nodes(b)) {
          const f = Math.max(from, start),
            e = Math.min(to, start + n.data.length);
          if (f >= e) continue;
          r.setStart(n, f - start);
          r.setEnd(n, e - start);
          for (const q of r.getClientRects()) {
            if (!(q.width > 0 && q.height > 0)) continue;
            const mid = (q.top + q.bottom) / 2,
              l = lines.at(-1);
            if (l && mid >= l.top && mid <= l.bottom) {
              l.left = Math.min(l.left, q.left);
              l.right = Math.max(l.right, q.right);
              l.top = Math.min(l.top, q.top);
              l.bottom = Math.max(l.bottom, q.bottom);
            } else lines.push({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
          }
        }
        return lines.map((l) => ({ ...l, top: l.top - 2, bottom: l.bottom + 2 }));
      },
      // The wash now: its boxes, clip, blend and colour, and ChatGPT's header bottom (the fixed or
      // sticky box over the scroller's top) and composer top.
      now(WASH) {
        const host = document.querySelector(WASH),
          r = sc().getBoundingClientRect();
        // Null when the chat's own content shows at the scroller's top (no header over it).
        let h = document.elementFromPoint(r.left + r.width / 2, Math.max(0, r.top) + 1);
        while (h && h !== sc() && !['fixed', 'sticky'].includes(getComputedStyle(h).position))
          h = h.parentElement;
        if (h === sc()) h = null;
        const composer = document
          .querySelector('form:has([contenteditable="true"])')
          ?.getBoundingClientRect();
        const box = (q) => ({ left: q.left, right: q.right, top: q.top, bottom: q.bottom });
        const i = host?.shadowRoot.querySelector('i');
        return {
          shown: !!host,
          boxes: host
            ? [...host.shadowRoot.querySelectorAll('i')].map((i) => box(i.getBoundingClientRect()))
            : [],
          clip: host ? box(host.shadowRoot.querySelector('div').getBoundingClientRect()) : null,
          blend: host ? getComputedStyle(host).mixBlendMode : null,
          pointer: host ? getComputedStyle(host).pointerEvents : null,
          color: i ? getComputedStyle(i).backgroundColor : null,
          headerBottom: h ? h.getBoundingClientRect().bottom : null,
          scrollerTop: r.top,
          composerTop: composer?.top ?? null,
          scrollTop: sc().scrollTop,
          view: { width: innerWidth, height: innerHeight },
          flash: !!document.querySelector('[data-butter-flash]'),
        };
      },
    };
  });

export const within = (got, want, px = 1) =>
  got.length === want.length &&
  got.every((g, k) => ['left', 'right', 'top', 'bottom'].every((s) => Math.abs(g[s] - want[k][s]) <= px));
// Pixel statistics of two screenshots of one region, decoded here (a second tab would put the
// chat in the background, where Chrome draws no frames): `differ`, the share of pixels differing
// by more than 24 in a channel; `ink`, the darkest (light) or lightest (dark) pixel of each.
// Decodes Chrome's PNGs: 8-bit RGB or RGBA, not interlaced.
export function decodePng(buf) {
  let at = 8,
    width = 0,
    height = 0,
    type = 0;
  const idat = [];
  while (at < buf.length) {
    const len = buf.readUInt32BE(at),
      kind = buf.toString('latin1', at + 4, at + 8),
      body = buf.subarray(at + 8, at + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      requireThat(body[8] === 8 && body[12] === 0, 'unexpected PNG format');
      type = body[9];
    } else if (kind === 'IDAT') idat.push(body);
    at += 12 + len;
  }
  const bpp = type === 6 ? 4 : 3,
    raw = zlib.inflateSync(Buffer.concat(idat)),
    stride = width * bpp,
    out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)],
      row = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0,
        b = y ? out[(y - 1) * stride + x] : 0,
        c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      const p = a + b - c,
        pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const v = [row[x], row[x] + a, row[x] + b, row[x] + ((a + b) >> 1), row[x] + pr][f];
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, bpp, data: out };
}
export function comparePixels(a, b, dark) {
  const p = decodePng(a),
    q = decodePng(b);
  requireThat(p.width === q.width && p.height === q.height, 'screenshots differ in size');
  const ink = (m) => {
    let best = null;
    for (let k = 0; k < m.data.length; k += m.bpp) {
      const v = m.data[k] + m.data[k + 1] + m.data[k + 2];
      if (!best || (dark ? v > best.v : v < best.v)) best = { v, rgb: [m.data[k], m.data[k + 1], m.data[k + 2]] };
    }
    return best.rgb;
  };
  let n = 0;
  for (let k = 0, j = 0; k < p.data.length; k += p.bpp, j += q.bpp)
    if (Math.max(...[0, 1, 2].map((c) => Math.abs(p.data[k + c] - q.data[j + c]))) > 24) n++;
  return { differ: n / (p.width * p.height), ink: [ink(p), ink(q)] };
}
// A box as a screenshot clip, `pad` px inside it and cut to the window; null when nothing is left.
export const clipOfBox = (q, view, pad = 0) => {
  const x = Math.max(0, Math.round(q.left) + pad),
    y = Math.max(0, Math.round(q.top) + pad),
    right = Math.min(view.width, Math.round(q.right) - pad),
    bottom = Math.min(view.height, Math.round(q.bottom) - pad);
  return right - x >= 2 && bottom - y >= 2 ? { x, y, width: right - x, height: bottom - y } : null;
};
