// Tunables. Benchmarks override this file per variant.
window.__butterConfig = {
  // Minimum gap between visible text updates of a streaming answer, in ms. ChatGPT publishes on
  // every animation frame (~60/s); each publish re-renders the answer and restyles the page.
  smoothMs: 250,
};
// EXPERIMENT: make ChatGPT's visibility sampler bail out (it skips when checkVisibility is missing).
Element.prototype.checkVisibility = undefined;
