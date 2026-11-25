// Unmarked answer blocks of a streamed answer (#172), for stream-replay-live.mjs with UNMARKED=1.
// An unmarked block is an answer block that is neither data-butter-seen nor data-butter-unrendered
// after completion. REPORT lines only, never a verdict; nothing from the page's text is read
// (tags, data-* names, computed sizes and text lengths only).

const kindOf = r => `${r.tag} ${r.renderer}`;
const group = (rows, key) => {
  const m = new Map();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) || []), r]);
  return m;
};

// d: { n, seen, unrendered, rows, samples, removed, insertedAfterGone, gone } (unmarkedFinish).
export function unmarkedReport(d) {
  const kinds = [...group(d.rows, kindOf)];
  const lines = [];
  lines.push(`unmarked blocks after the window: ${d.rows.length} of ${d.n} (seen ${d.seen}, unrendered ${d.unrendered}); by kind: ${kinds.map(([k, rs]) => `${k} ${rs.length}`).join(', ') || 'none'}; positions (block index of ${d.n}): ${kinds.map(([k, rs]) => `${k} [${rs.map(r => r.idx).join(' ')}]`).join(', ') || '-'}`);
  const w = d.rows.filter(r => r.watched);
  lines.push(`why never queued: never watched ${d.rows.length - w.length}; watched, content box never above 0: ${w.filter(r => !r.ro.some(h => h > 0)).length}; watched, content box above 0 at some report: ${w.filter(r => r.ro.some(h => h > 0)).length}`);
  const vals = (rs, f) => [...new Set(rs.flatMap(f))].join('/');
  const sum = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
  for (const [k, rs] of kinds) {
    const ro = [...new Set(rs.flatMap(r => r.ro))].sort((a, b) => a - b);
    lines.push(`kind ${k}: computed height ${vals(rs, r => r.cssHeight)}, border-top ${vals(rs, r => r.borderTop)}, text length ${vals(rs, r => r.textLen)}, ResizeObserver content heights seen [${ro.join(' ')}], skipped events ${sum(rs, r => r.skipped)}, rendered events ${sum(rs, r => r.rendered)}, content-visibility after the window ${vals(rs, r => r.cvNow)}`);
  }
  lines.push(`unmarked block detail (index tag renderer display rect-height prev>next [data-*]): ${d.rows.map(r => `${r.idx} ${kindOf(r)} ${r.display} ${r.rectH} ${r.prev}>${r.next} [${(r.data || []).join(' ')}]`).join(', ')}`);
  lines.push(`same elements across the answer: ${Object.entries(d.sameTag || {}).map(([t, v]) => `${t} ${v.all} (marked ${v.marked})`).join(', ') || '-'}; marked blocks whose ResizeObserver content box was never above 0: ${d.markedNeverAbove0 ?? '-'}`);
  const ip = d.samples.filter(s => s.inProgress), out = ip.filter(s => s.candAuto < s.cand), after = d.samples.find(s => !s.inProgress && s.t >= (d.gone ?? Infinity));
  const range = ip.length ? `${Math.min(...ip.map(s => s.cand))}-${Math.max(...ip.map(s => s.cand))}` : '-';
  lines.push(`under the auto rules: ${ip.length} samples while in_progress, never-queued blocks ${range}, some not content-visibility auto in ${out.length}${out.length ? ` (first at ${out[0].t} ms: ${out[0].candAuto} of ${out[0].cand} auto)` : ''}; first sample after in_progress gone ${after ? `at ${after.t} ms: ${after.candAuto} of ${after.cand} auto` : '-'}`);
  const near = d.gone == null ? 0 : d.removed.filter(t => t >= d.gone && t <= d.gone + 2000).length;
  lines.push(`replaced: watched answer blocks removed ${d.removed.length} (${near} within 2 s after in_progress gone at ${d.gone ?? '-'} ms); blocks inserted after in_progress gone ${d.insertedAfterGone}`);
  return lines;
}

// In the page (MAIN world, init script; dormant until arm()). It mirrors the marker
// (stream/offscreen.js): the same block selector applied to every added subtree, a ResizeObserver
// on each block from that moment (content box, as the marker's), and the content-visibility state
// events. sample() counts, in the last turn, the blocks no observer report has put above 0 and that
// carry no mark yet, and how many of them compute content-visibility auto.
export function installUnmarkedProbe() {
  if (window.__unm) return;
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const U = (window.__unm = { armed: false, recs: new Map(), removed: [], samples: [], goneAt: null, ip: false, insertedAfterGone: 0 });
  const now = () => performance.now();
  const lastTurn = () => { const t = document.querySelectorAll('[data-turn-key]'); return t[t.length - 1] || null; };
  const ro = new ResizeObserver(es => {
    for (const e of es) {
      const r = U.recs.get(e.target), h = Math.round(e.contentRect.height);
      if (r && r.ro.at(-1) !== h && r.ro.length < 20) r.ro.push(h);
    }
  });
  const watch = el => {
    if (U.recs.has(el)) return;
    U.recs.set(el, { t: now(), ro: [], skipped: 0, rendered: 0, gone: null });
    if (U.goneAt != null && lastTurn()?.contains(el)) U.insertedAfterGone++;
    ro.observe(el);
  };
  new MutationObserver(rs => {
    if (!U.armed) return;
    for (const r of rs) for (const n of r.addedNodes) {
      if (n.nodeType !== 1) continue;
      if (n.matches(BLOCKS)) watch(n);
      if (n.firstElementChild) n.querySelectorAll(BLOCKS).forEach(watch);
    }
  }).observe(document, { childList: true, subtree: true });
  document.addEventListener('contentvisibilityautostatechange', e => {
    const r = U.recs.get(e.target);
    if (r) r[e.skipped ? 'skipped' : 'rendered']++;
  }, true);
  const marked = el => el.hasAttribute('data-butter-seen') || el.hasAttribute('data-butter-unrendered');
  U.arm = () => { U.armed = true; const lt = lastTurn(); lt?.querySelectorAll(BLOCKS).forEach(watch); return U.recs.size; };
  U.sample = () => {
    const t = now(), ip = !!document.querySelector('[data-talvt-turn-state="in_progress"]'), lt = lastTurn();
    if (U.ip && !ip && U.goneAt == null) U.goneAt = t;
    U.ip = ip;
    let cand = 0, candAuto = 0;
    for (const [el, r] of U.recs) {
      if (!el.isConnected) { r.gone ??= t; continue; }
      if (!lt?.contains(el) || marked(el) || r.ro.some(h => h > 0)) continue;
      cand++;
      if (getComputedStyle(el).contentVisibility === 'auto') candAuto++;
    }
    U.samples.push({ t, inProgress: ip, cand, candAuto });
  };
  U.finish = () => {
    const lt = lastTurn(), blocks = lt ? [...lt.querySelectorAll(BLOCKS)] : [];
    const tag = el => el?.tagName.toLowerCase() ?? '-';
    const rows = [], sameTag = {};
    blocks.forEach((el, idx) => {
      if (marked(el)) return;
      const r = U.recs.get(el), cs = getComputedStyle(el);
      rows.push({ idx, tag: tag(el), renderer: el.parentElement?.matches('[class*="DilResponseRoot"]') ? 'dil' : 'classic', cssHeight: cs.height, borderTop: cs.borderTopWidth,
        textLen: el.textContent.length, watched: !!r, ro: r?.ro ?? [], skipped: r?.skipped ?? 0, rendered: r?.rendered ?? 0, cvNow: cs.contentVisibility, display: cs.display,
        rectH: Math.round(el.getBoundingClientRect().height * 10) / 10, prev: tag(el.previousElementSibling), next: tag(el.nextElementSibling),
        data: el.getAttributeNames().filter(n => n.startsWith('data-')), insertedAt: r?.t ?? null });
    });
    for (const t of new Set(rows.map(r => r.tag))) {
      const all = blocks.filter(b => tag(b) === t);
      sameTag[t] = { all: all.length, marked: all.filter(marked).length };
    }
    const markedNeverAbove0 = blocks.filter(b => marked(b) && U.recs.has(b) && !U.recs.get(b).ro.some(h => h > 0)).length;
    const removed = [...U.recs.values()].filter(r => r.gone != null).map(r => r.gone);
    return { n: blocks.length, seen: blocks.filter(b => b.hasAttribute('data-butter-seen')).length, unrendered: blocks.filter(b => b.hasAttribute('data-butter-unrendered')).length,
      rows, sameTag, markedNeverAbove0, samples: U.samples, removed, insertedAfterGone: U.insertedAfterGone, goneAt: U.goneAt, tracked: U.recs.size };
  };
}

// Page times to ms after Enter (z), then the report.
export function unmarkedFinish(raw, z, gone) {
  if (!raw) return { lines: ['unmarked probe: not installed in the page'], data: null };
  const rel = t => Math.round(t - z);
  const data = { ...raw, gone: gone ?? (raw.goneAt != null ? rel(raw.goneAt) : null), samples: raw.samples.map(s => ({ ...s, t: rel(s.t) })), removed: raw.removed.map(rel),
    rows: raw.rows.map(r => ({ ...r, insertedAt: r.insertedAt == null ? null : rel(r.insertedAt) })) };
  return { lines: [`unmarked probe: ${raw.tracked} blocks tracked from Enter`, ...unmarkedReport(data)], data };
}
