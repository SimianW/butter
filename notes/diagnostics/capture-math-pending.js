// Paste in DevTools Console, context: top. Counts only; no text, IDs, URLs.
// For each mounted turn: formulas whose [data-math-source] has no .katex (what keeps a record
// "math-pending"), what they contain instead, and whether the blocks holding them are
// currently content-visibility skipped.
(() => {
  const sc = [...document.querySelectorAll('.thread-scroll-container')].find(
    (s) => s.clientHeight > 0,
  );
  const turns = [...(sc || document).querySelectorAll('[data-turn-key]')];
  const out = turns.map((t, index) => {
    const all = [...t.querySelectorAll('[data-math-source]')];
    const missing = all.filter((e) => !e.querySelector('.katex'));
    const kinds = {};
    for (const e of missing) {
      const k = e.querySelector('.katex-error')
        ? 'katex-error'
        : e.querySelector('math')
          ? 'mathml-only'
          : e.querySelector('.katex-display, .katex-html')
            ? 'katex-parts-no-root'
            : e.childElementCount === 0
              ? e.textContent.trim()
                ? 'raw-text'
                : 'empty'
              : 'other:' + [...e.children].map((c) => c.tagName.toLowerCase()).join(',');
      kinds[k] = (kinds[k] || 0) + 1;
    }
    let skippedBlocks = 0;
    for (const e of missing) {
      for (let p = e.parentElement; p && p !== t; p = p.parentElement)
        if (getComputedStyle(p).contentVisibility === 'auto' && p.style.contentVisibility) {
          skippedBlocks++;
          break;
        }
    }
    return {
      index,
      formulas: all.length,
      withoutKatex: missing.length,
      kinds,
      missingInsideCvBlock: skippedBlocks,
      displayMissing: missing.filter((e) => e.closest('.katex-display') || e.tagName === 'DIV')
        .length,
    };
  });
  const json = JSON.stringify({ schema: 1, turns: out }, null, 2);
  console.log(json);
  try {
    copy(json);
  } catch {}
  return out;
})();
