// Isolated world, document_start. Absence of off markers means on while storage loads.
(() => {
  const { keys, normalize, classify } = ButterStatus;
  let settings = normalize(),
    root;
  let path = '',
    chatSince = 0,
    streamSince = 0,
    cvSince = 0;
  const apply = () => {
    const html = document.documentElement;
    if (!html) return;
    if (root !== html) {
      root = html;
      new MutationObserver(apply).observe(root, {
        attributes: true,
        attributeFilter: ['data-butter-off', 'data-butter-lang', 'data-butter-disabled'],
      });
    }
    html.toggleAttribute('data-butter-disabled', !settings.enabled);
    const off = keys.filter((k) => !settings.enabled || !settings.opts[k]).join(' ');
    if (off) {
      if (html.getAttribute('data-butter-off') !== off) html.setAttribute('data-butter-off', off);
    } else if (html.hasAttribute('data-butter-off')) html.removeAttribute('data-butter-off');
    if (html.getAttribute('data-butter-lang') !== settings.lang)
      html.setAttribute('data-butter-lang', settings.lang);
    document.dispatchEvent(new CustomEvent('butter-settings'));
  };
  // Also handles replacement of <html>; only direct document children are observed.
  new MutationObserver(apply).observe(document, { childList: true });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.butter) {
      settings = normalize(changes.butter.newValue);
      apply();
    }
  });
  chrome.storage.local.get('butter').then((value) => {
    settings = normalize(value.butter);
    apply();
  });
  apply();

  // Facts a feature in this tab reports when they happen (Ask in branch: a confirmed failure or a
  // made branch). Recorded at once and only then, since the tab may close before the popup asks;
  // replaying them in later probes would let an old outcome overwrite a newer one from another tab.
  const record = (states) => chrome.runtime.sendMessage({ type: 'butter-status-record', states });
  globalThis.ButterSettings = {
    report(key, fact) {
      return record(classify({ [key]: fact }, settings)).catch(() => {});
    },
  };

  const mainFacts = () => {
    const facts = {};
    const receive = (e) => {
      try {
        Object.assign(facts, JSON.parse(e.detail));
      } catch {}
    };
    document.addEventListener('butter-status-response', receive);
    document.dispatchEvent(new CustomEvent('butter-status-request'));
    document.removeEventListener('butter-status-response', receive);
    return facts;
  };
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'butter-status') return;
    const now = performance.now();
    if (path !== location.pathname) {
      path = location.pathname;
      chatSince = streamSince = cvSince = 0;
    }
    const visible = (el) => {
      if (!el.getClientRects().length) return false;
      const box = el.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    };
    const scroller = [...document.querySelectorAll('.thread-scroll-container')].find(visible);
    const scope = scroller || document;
    const turns = [
      ...scope.querySelectorAll('[data-turn-key], [data-testid^="conversation-turn-"]'),
    ].filter(visible);
    const wrapper = [
      ...scope.querySelectorAll('div.\\[container-type\\:inline-size\\].min-h-full'),
    ].find(visible);
    // The elements stream/containment.css skips, with its selectors: the markdown root's children
    // except the Dil source wrapper, and a Dil response root's children.
    const column = '[data-markdown-text-style="assistant-message"]';
    const keep = ':not([data-wide-block]):not([class*="TableFrame-"])';
    const blocks = [
      `${column} > :not([data-dil-source-message-id])`,
      `${column} [class*="DilResponseRoot"] > *`,
    ];
    const cv = scope.querySelector(
      [
        '[data-turn-key][data-butter-seen]',
        ...blocks.map((b) => `${b}[data-butter-seen]${keep}`),
        ...blocks.map((b) => `[data-talvt-turn-state="in_progress"] ${b}${keep}`),
      ].join(', '),
    );
    const streaming = !!scope.querySelector('[data-talvt-turn-state="in_progress"]');
    streamSince = streaming ? streamSince || now : 0;
    chatSince = turns.length ? chatSince || now : 0;
    cvSince = turns.length ? cvSince || now : 0;
    const main = mainFacts();
    const host = document.querySelector('chatgpt-butter-nav');
    const railReady = !!host?.shadowRoot?.querySelector('.tick');
    const railExpected = /\/c\/[0-9a-f-]{36}/.test(path) && turns.length > 0;
    const facts = {
      container: {
        exercised: turns.length > 0,
        engaged: !!wrapper && getComputedStyle(wrapper).containerType === 'normal',
        failed: !wrapper || getComputedStyle(wrapper).containerType !== 'normal',
      },
      cv: {
        exercised: !!cvSince && now - cvSince > 3000,
        engaged: !!cv && getComputedStyle(cv).contentVisibility === 'auto',
        failed: true,
      },
      throttle: {
        exercised: !!streamSince && now - streamSince > 2000 && main.throttle?.configured,
        engaged: main.throttle?.engaged,
        failed: main.throttle?.available === false || main.throttle?.matched === false,
      },
      older: main.older,
      seek: main.seek,
      layout: main.layout,
      rail: {
        exercised: railExpected && now - chatSince > 5000,
        engaged: !!main.rail?.parsed && railReady,
        failed: !main.rail?.parsed,
      },
    };
    const states = classify(facts, settings);
    record(states).then(
      (failures) => respond({ states, failures }),
      () => respond({ states }),
    );
    return true;
  });
})();
