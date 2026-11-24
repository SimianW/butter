// Shared, pure settings normalization and probe classification. No browser APIs here.
(() => {
  const keys = [
    'container',
    'cv',
    'throttle',
    'older',
    'rail',
    'seek',
    'layout',
    'branch',
    'bookmark',
  ];
  // The experimental switches (the rail and Bookmarks) are on only when stored as true; layouts
  // also need consent. Every other switch is on unless stored false.
  const optIn = ['rail', 'bookmark'];
  const normalize = (value) => ({
    ...value,
    enabled: value?.enabled !== false,
    opts: {
      ...value?.opts,
      ...Object.fromEntries(
        keys.map((k) => [
          k,
          optIn.includes(k) ? value?.opts?.[k] === true : value?.opts?.[k] !== false,
        ]),
      ),
      layout: value?.layoutConsent === 'granted' && value?.opts?.layout !== false,
    },
    lang: value?.lang === 'zh' ? 'zh' : 'en',
    layoutConsent: ['granted', 'declined'].includes(value?.layoutConsent)
      ? value.layoutConsent
      : 'pending',
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
    branch: ['branch'],
    bookmarks: ['bookmark'],
    layout: ['layout'],
  };
  // The groups on the popup's Experimental page, in display order.
  const experimental = ['rail', 'bookmarks', 'layout'];
  const groupOn = (value, group) => groups[group].every((k) => normalize(value).opts[k]);
  // Bookmarks show on the page only while Butter, the question rail and Bookmarks are all on.
  // Off hides them; the saved ones are kept.
  const bookmarksOn = (value) => {
    const s = normalize(value);
    return s.enabled && s.opts.rail && s.opts.bookmark;
  };
  const toggleGroup = (value, group) => {
    const next = normalize(value),
      on = !groupOn(value, group);
    for (const key of groups[group]) next.opts[key] = on;
    if (group === 'layout' && on) next.layoutConsent = 'granted';
    return next;
  };
  // Once per install, from the service worker's install event: `value` is the stored settings,
  // `reason` the event's. Returns the settings to write, or undefined to write nothing.
  // A new install keeps the new defaults (the rail and Bookmarks off). The first update to this
  // version stores the rail and Bookmarks as the old rule read them (on unless stored false), so
  // an existing user's features stay as they were. The marker makes it run once.
  const DEFAULTS_VERSION = 1;
  const migrate = (value, reason) => {
    if (reason === 'install') return { ...value, defaultsVersion: DEFAULTS_VERSION };
    if (reason !== 'update' || value?.defaultsVersion >= DEFAULTS_VERSION) return undefined;
    const opts = { ...value?.opts };
    for (const key of optIn) opts[key] = value?.opts?.[key] !== false;
    return { ...value, opts, defaultsVersion: DEFAULTS_VERSION };
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
    bookmarksOn,
    experimental,
    toggleGroup,
    migrate,
    updateFailures,
    masterState,
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterStatus;
})();
