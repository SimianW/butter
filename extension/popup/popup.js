const I = {
  branch:
    '<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  scroll: '<path d="M12 2v20"/><path d="m8 18 4 4 4-4"/><path d="m8 6 4-4 4 4"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  bookmark: '<path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
};
const svg = (k, cls = '') =>
  `<svg ${cls ? `class="${cls}" ` : ''}viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const T = {
  zh: {
    on: '启用 Butter',
    st: {
      ok: '已在当前对话生效',
      away: '打开一个 ChatGPT 对话即可生效',
      paused: '已暂停，ChatGPT 按原样运行',
    },
    fault: '暂时不可用。ChatGPT 可能更新了页面，恢复后 Butter 会自动继续。',
    faultShort: '暂时不可用，Butter 会自动恢复。',
    groups: [
      ['zap', '回答生成时更顺', '长回答输出时页面不卡'],
      ['scroll', '长对话滚动更顺', '拖动滚动条先看预览，松手再加载'],
      ['list', '问题导航条', '右侧列出你问过的问题，点一下就跳过去'],
      ['branch', '在分支中问', '选中文字，在新分支里提问'],
      ['bookmark', '书签', '选中文字，标记位置，随时跳回'],
      ['db', '记住长对话的布局', '再次打开时跳转更快'],
    ],
    note: '打开前不会保存。Butter 只保存布局数字，不保存聊天内容，30 天后自动删除。',
    clear: '清除',
    undone: '无法撤销。',
    rail: '需要先打开问题导航条',
    cancel: '取消',
    cleared: '已清除',
    bad: '暂不可用',
    log: '更新日志',
    privacy: '隐私政策',
    policy: 'PRIVACY.zh-CN.md',
  },
  en: {
    on: 'Enable Butter',
    st: {
      ok: 'Working in this chat',
      away: 'Open a ChatGPT chat to start',
      paused: 'Paused. ChatGPT runs as is.',
    },
    fault: 'Unavailable for now. ChatGPT may have changed its page; Butter resumes on its own.',
    faultShort: 'Unavailable; resumes on its own.',
    groups: [
      ['zap', 'Smoother streaming', 'Long answers stream without lag'],
      ['scroll', 'Smoother scrolling', 'Preview while you drag the scrollbar'],
      ['list', 'Question rail', 'Click a question on the right to jump'],
      ['branch', 'Ask in branch', 'Select text, ask about it in a new branch'],
      ['bookmark', 'Bookmarks', 'Select text, mark the spot to jump back'],
      ['db', 'Remember long-chat layouts', 'Faster jumps when you come back'],
    ],
    note: 'Off until you turn it on. Butter saves layout numbers only, never chat text, and deletes them after 30 days. ',
    clear: 'Clear',
    undone: "This can't be undone.",
    rail: 'Needs the question rail',
    cancel: 'Cancel',
    cleared: 'Cleared',
    bad: 'Unavailable',
    log: 'Changelog',
    privacy: 'Privacy policy',
    policy: 'PRIVACY.md',
  },
};
// y = 1.25 is the centre line of the card's 2.5 px bottom border; the outline leaves and rejoins it horizontally.
// The rect hides the border above the outline from end to end; it stops above y = 2.5 so the card's 4 px shadow stays whole.
const D =
  'M0 1.25 C8 1.25 11 3 12 8 C13 13 14.5 15 17 15 C19.5 15 21 13 21.5 10 C22 7.5 23.5 6 26 6 C28.5 6 30 8 30 12 C30 18 31.5 21.5 35 21.5 C38.5 21.5 40 18.5 40 14 C40 7 44 1.25 52 1.25';
const drip = `<svg class="drip" viewBox="0 0 56 24" aria-hidden="true">
  <rect x="0" y="-0.5" width="52" height="2.5" style="fill:var(--butter)"/>
  <path d="${D} Z" style="fill:var(--butter)"/>
  <path d="${D}" style="fill:none;stroke:var(--edge)" stroke-width="2.5" stroke-linecap="round"/>
  <circle class="drip-hi" cx="33" cy="16" r="1.6" fill="#fff"/></svg>`;

const pat =
  '<svg aria-hidden="true" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><defs>    <linearGradient id="t1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset="1" stop-color="#fde487"/></linearGradient>    <linearGradient id="l1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde07a"/><stop offset="1" stop-color="#f4c74a"/></linearGradient>    <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c23a"/><stop offset="1" stop-color="#e0a227"/></linearGradient>    <clipPath id="c1"><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z"/></clipPath></defs><g transform="translate(0 6)" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="64" cy="90" rx="50" ry="7" fill="rgb(27 23 15 / .12)"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#r1)"/><g clip-path="url(#c1)"><path d="M0 0 L62 0 L62 128 L0 128 Z" fill="url(#l1)"/></g><path d="M19.65 37.97 Q14 40 19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#t1)"/><path d="M21.5 46.5 L55.5 59.5" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><path d="M69 60 L106.5 47" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="M19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 M62 59.5 L62 85.5" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75 L42 47.25 L24 40.25 Z" fill="#fde487"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08 L83 47.6 L72 51.2 Z" fill="#fde487"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M31.5 53 L32.3 57.5" stroke="#fff" stroke-width="2" stroke-opacity=".8"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85 L100 69.85 L84 75.4 Z" fill="#e8ad2e"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M91.6 86 L91.6 95.5" stroke="#fff" stroke-width="2.2" stroke-opacity=".85"/><path d="M25.5 41.2 C24 39.5 26 37.6 29 36.6 L39.5 32.8 C42.5 31.8 44.5 32.6 43.6 34.4 C43 35.6 41.6 36.3 40 36.9 L29.6 40.9 C27.8 41.6 26.4 41.9 25.5 41.2 Z" fill="#fff" fill-opacity=".92"/><circle cx="48" cy="32.2" r="1.9" fill="#fff" fill-opacity=".92"/></g></svg>';

const groupKeys = Object.keys(ButterStatus.groups);
// The two storage rows, each with its usage, whether it could be read, and its own clear machine
// (ButterPopup.clearFlow). `group` is its switch's group; `count` what its question names.
const stores = {
  bookmarks: {
    group: 'bookmarks',
    usage: { count: 0, bytes: 0 },
    available: true,
    clear: 'idle',
    timer: 0,
    count: (u) => u.count || 0,
    saved: (u, lang) => ButterPopup.formatBookmarks(u, lang),
    // Bookmarks are kept while off, so their usage shows whatever the switches say.
    shown: () => true,
    usageType: 'butter-bookmark-usage',
    clearType: 'butter-bookmark-clear',
  },
  layouts: {
    group: 'layout',
    usage: { conversations: 0, bytes: 0 },
    available: true,
    clear: 'idle',
    timer: 0,
    count: (u) => u.conversations || 0,
    saved: (u, lang) => ButterPopup.formatUsage(u, lang),
    // Switching layouts off deletes them: usage only while the switch is on.
    shown: () => prefs.opts.layout,
    usageType: 'butter-layout-usage',
    clearType: 'butter-layout-clear',
  },
};
const storeOf = (group) => Object.keys(stores).find((k) => stores[k].group === group);
let prefs = ButterStatus.normalize(),
  failures = {},
  connected = false,
  // Bumped by every live settings change, so a slower startup read cannot overwrite it.
  settingsRevision = 0,
  failuresRevision = 0;
const root = document.getElementById('popup');
const scheme = matchMedia('(prefers-color-scheme: dark)');
const theme = () => {
  root.classList.toggle('dark', scheme.matches);
  document.documentElement.classList.toggle('dark', scheme.matches);
};
scheme.addEventListener('change', theme);
theme();
const repo = 'https://github.com/SimianW/butter';
const switchButton = (key, on, name) =>
  `<button class="tg ${on ? 'on' : ''}" id="sw-${key}" role="switch" aria-checked="${on}" aria-label="${name}" data-switch="${key}"></button>`;
// A storage row's second line: the saved line and Clear, or what ButterPopup.storageLine picks.
// The text is a live region; Clear is a real button after it (a space and 8 px), outside the region.
function storageLine(t, name, description) {
  const st = stores[name],
    shown = st.shown(),
    count = shown ? st.count(st.usage) : 0,
    kind = ButterPopup.storageLine({
      clear: st.clear,
      available: !shown || st.available,
      count,
      needsRail: name === 'bookmarks' && !prefs.opts.rail && prefs.opts.bookmark,
    });
  const clear = `<button type="button" class="lk" data-clear="ask" data-store="${name}">${t.clear}</button>`;
  const text = {
    cleared: t.cleared,
    unavailable: t.bad,
    saved: st.saved(st.usage, prefs.lang),
    rail: t.rail,
    description,
  }[kind];
  // A failed clear offers Clear again while there is a count to name.
  const retry = kind === 'saved' || (kind === 'unavailable' && count > 0);
  return `<div class="d"><span role="status">${text}</span>${retry ? ` ${clear}` : ''}</div>`;
}
// While a storage row asks, the question replaces the whole row: no icon, no switch.
function askRow(t, name) {
  const st = stores[name],
    busy = st.clear === 'clearing' ? ' disabled' : '';
  return `<div class="row ask"><div class="t"><div class="n">${ButterPopup.confirmQuestion(name, st.count(st.usage), prefs.lang)}</div><div class="d">${t.undone}</div></div><button type="button" class="btn danger" data-clear="confirm" data-store="${name}"${busy}>${t.clear}</button><button type="button" class="btn" data-clear="cancel" data-store="${name}"${busy}>${t.cancel}</button></div>`;
}
// Preserve nodes so switches animate and keyboard focus survives live polling.
function patch(old, next) {
  if (old.nodeType !== next.nodeType || old.nodeName !== next.nodeName) {
    old.replaceWith(next.cloneNode(true));
    return;
  }
  if (old.nodeType === Node.TEXT_NODE) {
    if (old.data !== next.data) old.data = next.data;
    return;
  }
  for (const a of [...old.attributes]) if (!next.hasAttribute(a.name)) old.removeAttribute(a.name);
  for (const a of next.attributes)
    if (old.getAttribute(a.name) !== a.value) old.setAttribute(a.name, a.value);
  const before = [...old.childNodes],
    after = [...next.childNodes];
  after.forEach((n, i) => (before[i] ? patch(before[i], n) : old.append(n.cloneNode(true))));
  before.slice(after.length).forEach((n) => n.remove());
}
function render() {
  const t = T[prefs.lang],
    state = ButterStatus.masterState(prefs, connected),
    paused = state === 'paused';
  const broken = groupKeys.filter((k) => failures[k] && ButterStatus.groupOn(prefs, k) && !paused);
  document.documentElement.lang = prefs.lang === 'zh' ? 'zh-CN' : 'en';
  // A row is a label wrapping its switch, so a click anywhere on the row toggles that group.
  // A broken group says so in its own description, a live region so the change is announced.
  // With two or more broken groups each says it in one line, so the popup stays under 600 px.
  const fault = broken.length > 1 ? t.faultShort : t.fault;
  // Its `for` names the switch: a storage row also holds a Clear button, which must not be the
  // label's control, and a click on Clear does not toggle the row.
  const row = (i) => {
    const [ic, n, d] = t.groups[i],
      key = groupKeys[i],
      bad = broken.includes(key),
      store = storeOf(key);
    if (store && ButterPopup.storageLine({ clear: stores[store].clear }) === 'confirm')
      return askRow(t, store);
    const line =
      store && !bad
        ? storageLine(t, store, d)
        : `<div class="d" role="status">${bad ? fault : d}</div>`;
    return `<label class="row${bad ? ' bad' : ''}" for="sw-${key}">${svg(ic, 'ic')}<div class="t"><div class="n">${n}</div>${line}</div>${switchButton(key, ButterStatus.groupOn(prefs, key), n)}</label>`;
  };
  const privacy = `<a target="_blank" rel="noopener" href="${repo}/blob/main/${t.policy}">${t.privacy}</a>`;
  // The consent note closes the card, under the layouts row, while consent is pending.
  const note =
    !ButterStatus.groupOn(prefs, 'layout') && prefs.layoutConsent === 'pending'
      ? `<div class="note">${t.note}${privacy}</div>`
      : '';
  // Dev build only: dev/popup.js defines ButterDevPopup, and the store package leaves it out, so
  // this passive slot renders nothing there. Its markup goes through patch() like the rest.
  const dev = globalThis.ButterDevPopup?.render(prefs.lang) || {};
  const html = `<div class="hd">${pat}<div class="word">Butter</div>${dev.tag || ''}<a class="ver" target="_blank" rel="noopener" href="${repo}/blob/main/CHANGELOG.md" title="${t.log}">${ButterPopup.versionLabel(chrome.runtime.getManifest().version_name)}</a></div>
    <div class="master ${paused ? 'off' : ''}"><div class="t"><div class="k">${t.on}</div><div class="s" role="status">${t.st[state]}</div></div>${switchButton('master', prefs.enabled, t.on)}${drip}</div>
    <div class="card${paused ? ' paused' : ''}">${groupKeys.map((k, i) => row(i)).join('')}${note}</div>${dev.card || ''}
    <div class="ft"><a target="_blank" rel="noopener" href="${repo}">GitHub</a>${privacy}<div class="lang" aria-label="${prefs.lang === 'zh' ? '语言' : 'Language'}"><button data-lang="zh" aria-pressed="${prefs.lang === 'zh'}" class="${prefs.lang === 'zh' ? 'on' : ''}">中文</button><button data-lang="en" aria-pressed="${prefs.lang === 'en'}" class="${prefs.lang === 'en' ? 'on' : ''}">EN</button></div></div>`;
  const template = document.createElement('template');
  template.innerHTML = `<div>${html}</div>`;
  if (root.firstElementChild) patch(root.firstElementChild, template.content.firstElementChild);
  else root.append(template.content);
}
const storeRequest = (request) =>
  ButterPopup.storeRequest((message) => chrome.runtime.sendMessage(message), request);
async function refreshUsage(name) {
  const st = stores[name];
  if (!st.shown()) return;
  try {
    st.usage = await storeRequest({ version: 1, type: st.usageType });
    st.available = true;
  } catch {
    st.available = false;
  }
  render();
}
const refreshAll = () => Object.keys(stores).forEach(refreshUsage);
const flow = (st, event) => (st.clear = ButterPopup.clearFlow(st.clear, event));
// The same request id on every retry: the worker clears once per id.
async function clearStore(name) {
  const st = stores[name];
  flow(st, 'confirm');
  render();
  try {
    st.usage = await storeRequest({
      version: 1,
      type: st.clearType,
      requestId: crypto.randomUUID(),
    });
    st.available = true;
    flow(st, 'success');
    // "Cleared" for 2 s, then the row's description again.
    st.timer = setTimeout(() => {
      flow(st, 'timeout');
      refreshUsage(name);
    }, 2000);
  } catch {
    flow(st, 'error');
  }
  render();
}
let saveQueue = Promise.resolve();
root.addEventListener('click', (e) => {
  const target = e.target.closest('[data-switch], [data-lang], [data-clear]');
  if (!target) return;
  if (target.dataset.clear) {
    const name = target.dataset.store,
      st = stores[name];
    if (!st) return;
    if (target.dataset.clear === 'confirm') {
      clearStore(name);
      return;
    }
    flow(st, target.dataset.clear);
    render();
    // Focus goes to the red Clear when the question shows, and back to Clear after Cancel.
    const step = st.clear === 'confirm' ? 'confirm' : 'ask';
    root.querySelector(`[data-store="${name}"][data-clear="${step}"]`)?.focus();
    return;
  }
  settingsRevision++;
  if (target.dataset.lang) prefs = { ...prefs, lang: target.dataset.lang };
  else if (target.dataset.switch === 'master') prefs = { ...prefs, enabled: !prefs.enabled };
  else {
    prefs = ButterStatus.toggleGroup(prefs, target.dataset.switch);
    const st = stores[storeOf(target.dataset.switch)];
    if (st) {
      st.clear = 'idle';
      clearTimeout(st.timer);
    }
  }
  render();
  const value = structuredClone(prefs);
  saveQueue = saveQueue.catch(() => {}).then(() => chrome.storage.local.set({ butter: value }));
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.butter) {
    settingsRevision++;
    prefs = ButterStatus.normalize(changes.butter.newValue);
    render();
    refreshUsage('layouts');
  }
  if (area === 'session' && changes.butterFailures) {
    failuresRevision++;
    failures = changes.butterFailures.newValue || {};
    render();
  }
  if (area === 'local' && changes.butterLayoutCleared) refreshUsage('layouts');
  if (area === 'local' && changes.butterBookmarksCleared) refreshUsage('bookmarks');
});
let polling = false;
async function poll() {
  if (polling) return;
  polling = true;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    // A content-script response is the authority: tab URLs need extra permissions to read.
    const response = await chrome.tabs.sendMessage(tab.id, { type: 'butter-status' });
    connected = !!response?.states;
    if (response?.failures) failures = response.failures;
  } catch {
    connected = false;
  } finally {
    polling = false;
    render();
  }
}
const startupRevision = settingsRevision,
  startupFailures = failuresRevision;
Promise.all([
  chrome.storage.local.get('butter'),
  chrome.storage.session.get('butterFailures'),
]).then(([local, session]) => {
  if (settingsRevision === startupRevision) prefs = ButterStatus.normalize(local.butter);
  if (failuresRevision === startupFailures) failures = session.butterFailures || {};
  render();
  poll();
  refreshAll();
});
const timer = setInterval(() => {
  poll();
  for (const name of Object.keys(stores)) if (stores[name].clear === 'idle') refreshUsage(name);
}, 1000);
addEventListener(
  'pagehide',
  () => {
    clearInterval(timer);
    for (const st of Object.values(stores)) clearTimeout(st.timer);
  },
  { once: true },
);
render();
