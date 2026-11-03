// Shared, pure settings normalization and probe classification. No browser APIs here.
(() => {
  const keys = ['container', 'cv', 'throttle', 'older', 'rail'];
  const normalize = (value) => ({
    enabled: value?.enabled !== false,
    opts: Object.fromEntries(keys.map((k) => [k, value?.opts?.[k] !== false])),
    lang: value?.lang === 'zh' ? 'zh' : 'en',
  });
  const classify = (facts = {}, value) => {
    const settings = normalize(value);
    return Object.fromEntries(
      keys.map((k) => {
        const f = facts[k] || {};
        return [
          k,
          !settings.enabled || !settings.opts[k]
            ? 'off'
            : f.engaged
              ? 'ok'
              : f.exercised && f.failed
                ? 'fail'
                : 'wait',
        ];
      }),
    );
  };
  globalThis.ButterStatus = { keys, normalize, classify };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterStatus;
})();
