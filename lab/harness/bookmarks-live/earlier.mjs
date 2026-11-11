// Bookmarks in earlier history (#72), as the single script checked them on the live rail: the dot
// under the earlier-history dots, the card that hovering it opens, and what the loading shows.
// Only geometry and comparisons with public Butter labels leave the page. Accessible segment names
// and bookmark rows include excerpts, so their raw text must never enter the evidence.
export function liveEarlier({ page, record }) {
  const requireThat = (v, label) => {
    if (!v) throw new Error(label);
  };
  async function earlierSegmentState() {
    return page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        more = root.querySelector('.more'),
        dots = more.querySelector('i').getBoundingClientRect(),
        marks = [...root.querySelectorAll('.bdot:not(.gone)')],
        earlier = marks.filter((m) => Number(m.getAttribute('data-q')) === -1),
        b = earlier[0]?.getBoundingClientRect(),
        color = earlier[0] && getComputedStyle(earlier[0]).backgroundColor,
        dark = root.host.hasAttribute('data-dark');
      return {
        marks: marks.length,
        earlierMarks: earlier.length,
        loadedMarks: marks.length - earlier.length,
        moreVisible: !more.hidden,
        gapLeftOfDotsPx: b ? +(dots.left - b.right).toFixed(2) : null,
        offsetBelowDotsPx: b ? +(b.top + b.height / 2 - dots.top - dots.height / 2).toFixed(2) : null,
        widthPx: b?.width ?? null,
        heightPx: b?.height ?? null,
        butterColor: !!color && color === (dark ? 'rgb(227, 199, 102)' : 'rgb(211, 158, 16)'),
      };
    });
  }
  async function checkEarlierSegment(label) {
    await page.mouse.move(10, 300);
    await page.waitForTimeout(400);
    const s = await earlierSegmentState();
    await record.check(
      `earlier bookmarks sit under dots and not a loaded tick (${label})`,
      s.marks === 1 &&
        s.earlierMarks === 1 &&
        s.loadedMarks === 0 &&
        s.moreVisible &&
        Math.abs(s.offsetBelowDotsPx) <= 0.1 &&
        s.gapLeftOfDotsPx === 4 &&
        s.widthPx === 4 &&
        s.heightPx === 4 &&
        s.butterColor,
      s,
    );
  }
  async function hoverEarlierCard(count, label) {
    const mark = page.locator('chatgpt-butter-nav .bdot:not(.gone)').first();
    const box = await mark.boundingBox();
    requireThat(box, 'earlier segment missing');
    // The rail's pointer geometry handles the dot; move to its actual centre.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(700);
    const card = await page.evaluate((count) => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot,
        card = root.querySelector('.card'),
        meta = root.querySelector('.card > .meta');
      const expected = count === 1 ? 'Bookmark · earlier question' : `Earlier questions · ${count} bookmarks`;
      return {
        shown: card.classList.contains('show'),
        correctMeta: meta?.textContent === expected,
        correctAccessibleName: card.getAttribute('aria-label') === expected,
        rows: root.querySelectorAll('.bmc .go, .bmc .one').length,
        staleRows: root.querySelectorAll('.bmc .it.stale, .bmc.stale, .bmc .why').length,
        singleExplanation: root.querySelector('.bmc .warn')?.textContent === "This question isn't loaded yet. Clicking loads earlier messages first.",
      };
    }, count);
    await record.check(
      `hover earlier segment shows ${count}-bookmark card (${label})`,
      card.shown && card.correctMeta && card.correctAccessibleName && card.rows === count && card.staleRows === 0 && (count !== 1 || card.singleExplanation),
      card,
    );
  }
  async function watchEarlierLoading() {
    await page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
      const s = (window.__earlierLoading = { sawLoadingMeta: false, sawSpinner: false, sawBusyDots: false });
      const observe = () => {
        s.sawLoadingMeta ||= root.querySelector('.card > .meta')?.textContent === 'Loading earlier questions…';
        s.sawSpinner ||= !!root.querySelector('.bmc .wspin');
        s.sawBusyDots ||= root.querySelector('.more').classList.contains('busy');
      };
      s.observer = new MutationObserver(observe);
      s.observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    });
  }
  return { earlierSegmentState, checkEarlierSegment, hoverEarlierCard, watchEarlierLoading };
}
