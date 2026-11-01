// Experimental Blink workaround: cache simple descendant attribute :has() conditions.
// Keep selector specificity and update only conditions whose attribute matches can change.
// Text edits alone cannot change whether an ancestor contains e.g. [data-expanded-composer].
(() => {
  const conditions = new Map(), byAttribute = new Map(), seen = new WeakMap();
  const stats = globalThis.__turboTyping = { rules: 0, conditions: 0, refreshes: 0 };
  const condition = (selector, direct) => {
    const key = (direct ? '> ' : '') + selector;
    if (conditions.has(key)) return conditions.get(key);
    const attr = /^\[([^\s~|^$*=\]]+)/.exec(selector)?.[1];
    if (!attr) return null;
    const c = { selector, direct, marker: `data-turbo-has-${conditions.size}`, marked: new Set() };
    conditions.set(key, c);
    if (!byAttribute.has(attr)) byAttribute.set(attr, new Set());
    byAttribute.get(attr).add(c); stats.conditions = conditions.size;
    return c;
  };
  Object.defineProperty(stats, 'verify', { value: () => {
    let errors = 0;
    for (const c of conditions.values()) {
      const expected = new Set();
      for (const el of document.querySelectorAll(c.selector))
        for (let p = el.parentElement; p; p = c.direct ? null : p.parentElement) expected.add(p);
      const actual = new Set(document.querySelectorAll(`[${c.marker}]`));
      for (const el of expected) if (!actual.has(el)) errors++;
      for (const el of actual) if (!expected.has(el)) errors++;
    }
    return { conditions: conditions.size, errors };
  } });
  const refresh = c => {
    const next = new Set();
    for (const el of document.querySelectorAll(c.selector)) {
      for (let p = el.parentElement; p; p = c.direct ? null : p.parentElement) next.add(p);
    }
    for (const el of c.marked) if (!next.has(el)) el.removeAttribute(c.marker);
    for (const el of next) if (!c.marked.has(el)) el.setAttribute(c.marker, '');
    c.marked = next; stats.refreshes++;
  };
  const walk = rules => {
    for (const rule of rules) {
      if (rule.cssRules) walk(rule.cssRules);
      if (!rule.selectorText || seen.get(rule) === rule.selectorText) continue;
      const text = rule.selectorText.replace(/:has\((>\s*)?(\[[^\]\n]+\])\)/g, (whole, child, selector) => {
        const c = condition(selector, !!child); return c ? `[${c.marker}]` : whole;
      });
      if (text !== rule.selectorText) { rule.selectorText = text; stats.rules++; }
      seen.set(rule, rule.selectorText);
    }
  };
  let observer;
  const patch = () => {
    const before = conditions.size;
    for (const sheet of document.styleSheets) { try { walk(sheet.cssRules); } catch {} }
    // Newly encountered conditions must have their initial truth values before the next paint.
    if (conditions.size !== before) for (const c of conditions.values()) refresh(c);
    observer?.disconnect();
    observer = new MutationObserver(records => {
      const dirty = new Set(); let sheets = false;
      const inspect = node => {
        if (node.nodeType !== 1) return;
        const visit = el => {
          if (el.matches('style,link[rel="stylesheet"]')) sheets = true;
          for (const a of el.attributes) for (const c of byAttribute.get(a.name) ?? []) dirty.add(c);
        };
        visit(node); for (const el of node.querySelectorAll('*')) visit(el);
      };
      for (const r of records) {
        if (r.type === 'attributes') for (const c of byAttribute.get(r.attributeName) ?? []) dirty.add(c);
        else { for (const n of r.addedNodes) inspect(n); for (const n of r.removedNodes) inspect(n); }
      }
      if (sheets) patch();
      for (const c of dirty) refresh(c);
    });
    observer.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: [...byAttribute.keys()] });
  };
  document.addEventListener('load', e => { if (e.target.matches?.('link[rel="stylesheet"]')) patch(); }, true);
  patch();
})();
