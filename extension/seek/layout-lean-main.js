// MAIN world: lean text, the text the seek preview draws for a preview item, and the
// computed-style map its items reuse as inline CSS. Classic script, loaded before
// seek/layout-cache-main.js, which calls the factory once and clears the style map on resize and
// theme changes (resetStyles). Reads no page structure.
globalThis.__butterLayoutLean = () => {
  // Lean text for the preview: TeX source for math, list bullets, no buttons/SVG. Capped.
  const CAP = 4000;
  const BLOCKY = /^(P|LI|H[1-6]|PRE|TR|BLOCKQUOTE|DIV|UL|OL|TABLE|THEAD|TBODY|SECTION|FIGURE)$/;
  function lean(el, readRows = true) {
    let out = '';
    const math = [];
    let spatial = false;
    const walk = (n, inline = false, widget = false) => {
      if (out.length > CAP) return;
      if (n.nodeType === 3) {
        out += inline ? n.data.replace(/\s+/g, ' ') : n.data;
        return;
      }
      if (n.nodeType !== 1) return;
      const tag = n.tagName;
      if (tag === 'BUTTON' || tag === 'svg' || tag === 'STYLE' || tag === 'SCRIPT' || tag === 'IMG')
        return;
      const cls = n.classList;
      if (cls.contains('katex-display') || cls.contains('katex')) {
        const tex =
          n.querySelector('annotation')?.textContent ||
          n.closest('[data-math-source]')?.getAttribute('data-math-source') ||
          // HTML-only KaTeX may keep the source inside the outer display wrapper.
          n.querySelector('[data-math-source]')?.getAttribute('data-math-source') ||
          '';
        const display = cls.contains('katex-display');
        const start = out.length;
        out += tex;
        math.push({ start, end: out.length, display, element: n });
        return;
      }
      if (tag === 'BR') {
        out += inline ? ' ' : '\n';
        return;
      }
      widget ||= n.hasAttribute('data-client-defined-widget');
      // Widgets can use block elements as cells. Keep their visual rows as text, without
      // reproducing the card UI. Single-child grids also wrap code editors; those stay ordinary
      // blocks so each .cm-line keeps its newline. Never read descendants of a skipped item.
      if (widget && !inline && n.children.length > 1 && tag === 'DIV') {
        const display = readRows && getComputedStyle(n).display;
        if (!readRows) spatial = true;
        if (display === 'grid' || display === 'flex') {
          spatial = true;
          const cells = [...n.children]
            .map((cell) => ({ cell, r: cell.getBoundingClientRect() }))
            .filter(({ r }) => r.width && r.height);
          const overlaps = (a, b) => a.top < b.top + b.height && b.top < a.top + a.height;
          // Column layouts wrap entire card sections too. Recurse normally through those,
          // otherwise a nested grid (or code editor) would lose its own row boundaries.
          if (cells.some(({ r }, i) => i > 0 && overlaps(r, cells[i - 1].r))) {
            if (out && !out.endsWith('\n')) out += '\n';
            let row;
            for (const { cell, r } of cells) {
              const before = out.length;
              if (row) out += overlaps(r, row) ? '  ' : '\n';
              const start = out.length;
              walk(cell, true, widget);
              if (out.length === start) out = out.slice(0, before);
              else row = r;
            }
            if (!out.endsWith('\n')) out += '\n';
            return;
          }
        }
      }
      const block = !inline && BLOCKY.test(tag);
      if (block && out && !out.endsWith('\n')) out += '\n';
      if (inline && BLOCKY.test(tag) && out && !/\s$/.test(out)) out += ' ';
      if (tag === 'LI') out += '• ';
      for (let c = n.firstChild; c; c = c.nextSibling)
        walk(c, inline || tag === 'TD' || tag === 'TH', widget);
      if (tag === 'TD' || tag === 'TH') out += '  ';
      if (block && !out.endsWith('\n')) out += '\n';
    };
    walk(el);
    const trim = out.length - out.trimStart().length;
    const text = out.trim().slice(0, CAP);
    return {
      text,
      spatial,
      math: math
        .map((m) => ({ ...m, start: m.start - trim, end: m.end - trim }))
        .filter((m) => m.start >= 0 && m.end <= text.length),
    };
  }
  // One computed-style read per distinct element class; reused by the preview as inline CSS.
  const styles = new Map();
  function styleKey(el) {
    const key = el.tagName + '.' + el.className;
    if (!styles.has(key)) {
      const c = getComputedStyle(el);
      styles.set(key, {
        id: styles.size,
        css: `font:${c.fontStyle} ${c.fontWeight} ${c.fontSize}/${c.lineHeight} ${c.fontFamily};padding:${c.paddingTop} ${c.paddingRight} ${c.paddingBottom} ${c.paddingLeft};border-radius:${c.borderRadius};background:${c.backgroundColor};color:${c.color};text-align:${c.textAlign}`,
      });
      while (styles.size > 200) styles.delete(styles.keys().next().value);
    }
    return styles.get(key).css;
  }

  return { lean, styleKey, clearStyles: () => styles.clear() };
};
