// Synthetic browser fixture. Run in a blank page, then call installRailFixture({source, meta, width}).
// Each install gets a fresh iframe so old rail observers/listeners cannot affect the next case.
globalThis.installRailFixture = async ({ source, meta, width = 1280, gutter = false }) => {
  document.body.style.margin = '0';
  document.querySelector('iframe')?.remove();
  const frame = document.createElement('iframe');
  frame.style.cssText = `display:block;border:0;width:${width}px;height:800px`;
  document.body.append(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><html><head><style>
    body { margin:0; color:#222; background:#fff; font:16px system-ui }
    .thread-scroll-container { height:800px; overflow-y:auto; scrollbar-gutter:${gutter ? 'stable' : 'auto'} }
    article { width:calc(100% - 180px); padding:70px 30px; box-sizing:border-box; height:1000px }
    h1 { font-size:24px } p { color:#666; line-height:1.8 }
  </style></head><body><main class="thread-scroll-container">
  ${Array.from({ length: 5 }, (_, i) => `<article data-turn-key="q${i}">
    <h1 data-user-message-bubble>Question ${i + 1}: synthetic scrollbar fixture</h1>
    ${'<p>Synthetic answer text for checking the rail and native scrollbar strip.</p>'.repeat(10)}
  </article>`).join('')}
  </main></body></html>`);
  doc.close();
  for (const content of [meta, source]) {
    const script = doc.createElement('script');
    script.textContent = content;
    doc.body.append(script);
  }
  for (const turn of doc.querySelectorAll('[data-turn-key]')) frame.contentWindow.butterNavTurn(turn);
  const sc = doc.querySelector('main');
  sc.scrollTop = 1000;
  globalThis.railFixture = { frame, doc, sc, presses: [] };
  doc.addEventListener('pointerdown', e => railFixture.presses.push({
    target: e.target.tagName,
    inner: e.composedPath()[0].className,
    isScroller: e.target === sc,
    trusted: e.isTrusted,
  }), true);
  for (let i = 0; i < 120 && !doc.querySelector('chatgpt-butter-nav[data-on]'); i++)
    await new Promise(resolve => requestAnimationFrame(resolve));
  return measureRailFixture();
};

globalThis.measureRailFixture = () => {
  const { doc, sc, presses } = railFixture;
  const host = doc.querySelector('chatgpt-butter-nav');
  if (!host?.hasAttribute('data-on')) return { visible: false };
  const root = host.shadowRoot, rail = root.querySelector('.rail');
  const r = rail.getBoundingClientRect(), s = sc.getBoundingClientRect();
  const tick = root.querySelectorAll('.tick')[2].getBoundingClientRect();
  const hits = [];
  for (const y of [r.top + 2, (tick.top + tick.bottom) / 2, r.bottom - 2])
    for (const gap of [1, 2, 6, 10]) {
      const target = doc.elementFromPoint(s.right - gap, y);
      const inner = target === host ? root.elementFromPoint(s.right - gap, y) : target;
      hits.push({ gap, y, target: target.tagName, inner: inner?.className, isScroller: target === sc });
    }
  const bounds = [...root.querySelectorAll('.rail, .pill, .tick, .more:not([hidden])')]
    .map(el => ({ element: el.className, right: el.getBoundingClientRect().right }));
  const card = root.querySelector('.card');
  return {
    visible: true, width: s.width, gutter: sc.offsetWidth - sc.clientWidth,
    rail: { left: r.left, right: r.right, width: r.width, top: r.top, bottom: r.bottom },
    clearance: s.right - r.right, bounds, hits, presses: [...presses],
    card: { shown: card.classList.contains('show'), gap: r.left - card.getBoundingClientRect().right,
      centerY: (card.getBoundingClientRect().top + card.getBoundingClientRect().bottom) / 2 },
    tick: { x: (tick.left + tick.right) / 2, y: (tick.top + tick.bottom) / 2 },
  };
};

globalThis.seekRailFixture = () => {
  railFixture.doc.dispatchEvent(new railFixture.frame.contentWindow.CustomEvent('butter-seek-state', {
    detail: JSON.stringify({ conv: null, state: 'dragging', id: 'q2', n: 3, total: 5, unseen: false }),
  }));
  return measureRailFixture();
};

globalThis.checkRailFixture = () => {
  const result = measureRailFixture();
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  check(result.visible, 'rail must be visible');
  check(result.clearance === (result.gutter ? result.gutter + 4 : 12), 'wrong scrollbar clearance');
  check(result.rail.width === 52, 'rail width changed');
  check(result.bounds.every(b => b.right <= result.width - 12), 'pointer bounds cover scrollbar strip');
  check(result.hits.every(h => h.isScroller), 'edge strip intercepts pointer hits');
  if (result.card.shown) {
    check(Math.abs(result.card.gap - 8) < 0.1, 'card must remain 8px beside rail');
    check(Math.abs(result.card.centerY - result.tick.y) < 0.1, 'card must align with hovered/seek tick');
  }
  return result;
};
