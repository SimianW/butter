// Shared, pure settings normalization and probe classification. No browser APIs here.
(() => {
  const keys = ['container', 'cv', 'throttle', 'older', 'rail', 'seek', 'layout'];
  const normalize = (value) => ({
    ...value,
    enabled: value?.enabled !== false,
    opts: {
      ...value?.opts,
      ...Object.fromEntries(keys.map((k) => [k, value?.opts?.[k] !== false])),
    },
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
                : 'idle',
        ];
      }),
    );
  };
  const groups = {
    streaming: ['container', 'cv', 'throttle'],
    scrolling: ['older', 'seek'],
    rail: ['rail'],
    layout: ['layout'],
  };
  const groupOn = (value, group) => groups[group].every((k) => normalize(value).opts[k]);
  const toggleGroup = (value, group) => {
    const next = normalize(value),
      on = !groupOn(value, group);
    for (const key of groups[group]) next.opts[key] = on;
    return next;
  };
  // Keep evidence per failed feature inside each group. An unrelated success cannot erase it.
  const updateFailures = (previous = {}, states = {}) => {
    const next = {};
    for (const [group, members] of Object.entries(groups)) {
      const failed = { ...previous[group] };
      for (const key of members) {
        if (states[key] === 'fail') failed[key] = true;
        else if (states[key] === 'ok') delete failed[key];
      }
      if (Object.keys(failed).length) next[group] = failed;
    }
    return next;
  };
  const masterState = (value, connected) =>
    !normalize(value).enabled ? 'paused' : connected ? 'ok' : 'away';
  globalThis.ButterStatus = {
    keys,
    groups,
    normalize,
    classify,
    groupOn,
    toggleGroup,
    updateFailures,
    masterState,
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterStatus;
})();
