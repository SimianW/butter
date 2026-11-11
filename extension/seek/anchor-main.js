// Shared DOM audit and semantic-anchor selection. Never returns text in the swap diagnostic.
// The swap audit reads a turn's preview items through the page reader, page/reader-main.js.
(() => {
  const ANCHOR = /[\p{Script=Han}]{8,}|[A-Za-z][A-Za-z ,]{24,}/gu;
  function boxes(root, needle) {
    if (!root || !needle) return [];
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT),
      nodes = [];
    let text = '';
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      if (n.parentElement?.closest('button,script,style,.katex-mathml')) continue;
      nodes.push({ n, start: text.length, end: text.length + n.data.length });
      text += n.data;
    }
    const out = [];
    let from = 0;
    while (from < text.length) {
      const i = text.indexOf(needle, from);
      if (i < 0) break;
      const a = nodes.find((x) => x.end > i),
        b = nodes.find((x) => x.end >= i + needle.length);
      if (a && b) {
        const r = document.createRange();
        r.setStart(a.n, i - a.start);
        r.setEnd(b.n, i + needle.length - b.start);
        const q = r.getClientRects()[0];
        if (q)
          out.push({
            top: q.top,
            bottom: q.bottom,
            left: q.left,
            right: q.right,
            width: q.width,
            height: q.height,
          });
      }
      from = i + needle.length;
    }
    return out;
  }
  function needles(el, H, limit = 3) {
    if (!el || el.hidden) return [];
    const box = el.getBoundingClientRect(),
      viewport = { top: H.y, bottom: H.y + H.height, left: H.x, right: H.x + H.width },
      out = [],
      seen = new Set();
    for (const m of el.textContent.matchAll(ANCHOR)) {
      const needle = m[0].slice(0, 24);
      if (seen.has(needle)) continue;
      seen.add(needle);
      for (const r of boxes(el, needle))
        if (__butterLayoutCheck.visibleRect(r, box, viewport)) {
          out.push({ needle, y: r.top });
          break;
        }
      if (out.length >= limit) break;
    }
    return out;
  }
  globalThis.__butterAnchorTextBoxes = boxes;
  globalThis.__butterAnchorVisibleNeedles = needles;
  globalThis.__butterAnchorVisibleSwap = (a) => {
    const s = a.sc,
      H = a.hostRect,
      sr = s.getBoundingClientRect(),
      items = [],
      anchors = [],
      realItems = new Map();
    let missingReal = 0;
    const page = globalThis.__butterPageReader;
    for (const [i, el] of a.rendered) {
      const f = a.prep.flat[i],
        t = a.prep.model[f.turn],
        py = sr.top + f.abs - (a.previewTop ?? a.lastTop);
      if (py < H.y || py > H.y + H.height - 20) continue;
      if (!realItems.has(t.id)) {
        const te = s.querySelector(`[data-turn-key="${CSS.escape(t.id)}"]`);
        realItems.set(t.id, te ? [...page.previewItemsIn(te)] : null);
      }
      const real = realItems.get(t.id)?.[f.index];
      if (!real) continue;
      const rr = real.getBoundingClientRect();
      items.push({ err: Math.round(py - rr.top), hMatch: Math.abs(rr.height - f.h) <= 2 });
      if (anchors.filter((x) => x.mode === 'layout').length < 3)
        for (const n of needles(el, H, 1)) {
          const rs = boxes(real, n.needle);
          if (!rs.length) {
            missingReal++;
            continue;
          }
          const y = rs.reduce((x, r) =>
            Math.abs(r.top - n.y) < Math.abs(x.top - n.y) ? r : x,
          ).top;
          anchors.push({ err: Math.round(n.y - y), mode: 'layout', previewVisible: true });
        }
    }
    const est = document.querySelector('butter-seek-preview')?.shadowRoot.querySelector('.est');
    const primary = needles(est, H, 3);
    if (est && !est.hidden && a.estTurn) {
      const te = s.querySelector(`[data-turn-key="${CSS.escape(a.estTurn)}"]`);
      if (te)
        for (const n of primary) {
          const rs = boxes(te, n.needle);
          if (!rs.length) {
            missingReal++;
            continue;
          }
          const y = rs.reduce((x, r) =>
            Math.abs(r.top - n.y) < Math.abs(x.top - n.y) ? r : x,
          ).top;
          anchors.push({ err: Math.round(n.y - y), mode: 'estimate', previewVisible: true });
        }
    }
    const signed = items.map((x) => x.err).sort((a, b) => a - b),
      abs = items.map((x) => Math.abs(x.err)).sort((a, b) => a - b);
    return {
      items: items.length,
      itemErrSignedMedian: signed[signed.length >> 1] ?? null,
      itemErrSpread: signed.length ? signed.at(-1) - signed[0] : null,
      itemErrMedian: abs[abs.length >> 1] ?? null,
      itemErrMax: abs.at(-1) ?? null,
      hMatch: items.filter((x) => x.hMatch).length,
      anchors,
      visibleEstimatedCandidates: primary.length,
      missingReal,
      visibilityChecked: true,
    };
  };
})();
