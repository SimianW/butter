// Tunables. Benchmarks override this file per variant.
window.__butterConfig = {
  // Minimum gap between visible text updates of a streaming answer, in ms. ChatGPT publishes on
  // every animation frame (~60/s); each publish re-renders the answer and restyles the page.
  smoothMs: 250,
  // Turns per page when ChatGPT loads earlier messages (it asks for 10). Each page is inserted and
  // laid out in one task that blocks typing; smaller pages keep each block shorter, at the cost of
  // more requests when scrolling back through a long chat. 0 leaves ChatGPT's requests unchanged.
  olderPageTurns: 2,
};

// Persistent geometry and semantic landing; no source text is stored.
globalThis.__butterLayoutOptions = { storage: true };
