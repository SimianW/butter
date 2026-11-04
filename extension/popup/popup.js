const I = {
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  scroll: '<path d="M12 2v20"/><path d="m8 18 4 4 4-4"/><path d="m8 6 4-4 4 4"/>',
  list: '<path d="M3 12h.01"/><path d="M3 18h.01"/><path d="M3 6h.01"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M8 6h13"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
};
const svg = (k) => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;
const T = {
  zh: {
    on: '启用 Butter',
    st: {
      ok: '已在当前对话生效',
      away: '打开一个 ChatGPT 对话即可生效',
      paused: '已暂停 · ChatGPT 按原样运行',
    },
    label: '让 ChatGPT 更顺',
    warn: '<b>问题导航条暂时不可用。</b>ChatGPT 可能更新了页面，恢复后 Butter 会自动继续。',
    groups: [
      ['zap', '回答生成时更顺', '长回答输出时页面不卡'],
      ['scroll', '长对话滚动更顺', '拖动滚动条时先显示预览，松手再加载'],
      ['list', '问题导航条', '右侧列出你问过的问题，点一下就跳过去'],
      ['db', '记住长对话的布局', '再次打开时跳转更快，会占用一些存储空间'],
    ],
    pending: '还没开启 · 打开开关即表示同意',
    clear: '清除',
    confirm: '确定清除全部？',
    cancel: '取消',
    cleared: '已清除',
    bad: '暂不可用',
    log: '更新日志',
  },
  en: {
    on: 'Enable Butter',
    st: {
      ok: 'Working in this chat',
      away: 'Open a ChatGPT chat to start',
      paused: 'Paused · ChatGPT runs as is',
    },
    label: 'Make ChatGPT smoother',
    warn: '<b>The question rail is unavailable for now.</b> ChatGPT may have changed its page; Butter resumes on its own.',
    groups: [
      ['zap', 'Smoother streaming', 'Long answers stream without lag'],
      ['scroll', 'Smoother scrolling', 'Drag the scrollbar to preview; it loads when you let go'],
      ['list', 'Question rail', 'Your questions on the right; click one to jump'],
      ['db', 'Remember long-chat layouts', 'Faster jumps when you come back; uses some storage'],
    ],
    pending: 'Not on yet · turning it on means you agree',
    clear: 'Clear',
    confirm: 'Clear all?',
    cancel: 'Cancel',
    cleared: 'Cleared',
    bad: 'Unavailable',
    log: 'Changelog',
  },
};
// y = 1.25 is the centre line of the card's 2.5 px bottom border; the outline leaves and rejoins it horizontally.
const D =
  'M0 1.25 C8 1.25 11 3 12 8 C13 13 14.5 15 17 15 C19.5 15 21 13 21.5 10 C22 7.5 23.5 6 26 6 C28.5 6 30 8 30 12 C30 18 31.5 21.5 35 21.5 C38.5 21.5 40 18.5 40 14 C40 7 44 1.25 52 1.25';
const drip = `<svg class="drip" viewBox="0 0 56 24" aria-hidden="true">
  <rect x="7" y="-0.5" width="38" height="3.2" style="fill:var(--butter)"/>
  <path d="${D} Z" style="fill:var(--butter)"/>
  <path d="${D}" style="fill:none;stroke:var(--edge)" stroke-width="2.5" stroke-linecap="round"/>
  <circle class="drip-hi" cx="33" cy="16" r="1.6" fill="#fff"/></svg>`;

const pat =
  '<svg aria-hidden="true" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg"><defs>    <linearGradient id="t1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff6cc"/><stop offset="1" stop-color="#fde487"/></linearGradient>    <linearGradient id="l1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fde07a"/><stop offset="1" stop-color="#f4c74a"/></linearGradient>    <linearGradient id="r1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f2c23a"/><stop offset="1" stop-color="#e0a227"/></linearGradient>    <clipPath id="c1"><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z"/></clipPath></defs><g transform="translate(0 6)" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="64" cy="90" rx="50" ry="7" fill="rgb(27 23 15 / .12)"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#r1)"/><g clip-path="url(#c1)"><path d="M0 0 L62 0 L62 128 L0 128 Z" fill="url(#l1)"/></g><path d="M19.65 37.97 Q14 40 19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="url(#t1)"/><path d="M21.5 46.5 L55.5 59.5" stroke="#fff" stroke-opacity=".45" stroke-width="2"/><path d="M69 60 L106.5 47" stroke="#fff" stroke-opacity=".35" stroke-width="2"/><path d="M19.6 42.1 L56.4 55.9 Q62 58 67.7 56 L108.3 41.96 M62 59.5 L62 85.5" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M19.65 37.97 Q14 40 14 46 L14 65 Q14 70 19.6 72.1 L56.4 85.9 Q62 88 67.7 86 L108.3 71.96 Q114 70 114 65 L114 46 Q114 40 108.35 37.97 L69.65 24.03 Q64 22 58.35 24.03 Z" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75 L42 47.25 L24 40.25 Z" fill="#fde487"/><path d="M24 43.75 C27 46.5 28.5 51 29.5 57 C30.5 63 37.5 64 38 58 C38.3 54 39.5 51.5 42 50.75" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08 L83 47.6 L72 51.2 Z" fill="#fde487"/><path d="M72 54.54 C74 56 74.5 58.5 75 61 C75.6 64 80.4 64 80.6 60.6 C80.8 57.5 81.2 53.8 83 51.08" fill="none" stroke="#1b170f" stroke-width="3"/><path d="M31.5 53 L32.3 57.5" stroke="#fff" stroke-width="2" stroke-opacity=".8"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85 L100 69.85 L84 75.4 Z" fill="#e8ad2e"/><path d="M84 80.4 C87 81.5 88.5 84 88.5 89 L88.5 97 A4.75 4.75 0 0 0 98 97 L98 82 C98 78.5 98.8 76 100 74.85" fill="none" stroke="#1b170f" stroke-width="5"/><path d="M91.6 86 L91.6 95.5" stroke="#fff" stroke-width="2.2" stroke-opacity=".85"/><path d="M25.5 41.2 C24 39.5 26 37.6 29 36.6 L39.5 32.8 C42.5 31.8 44.5 32.6 43.6 34.4 C43 35.6 41.6 36.3 40 36.9 L29.6 40.9 C27.8 41.6 26.4 41.9 25.5 41.2 Z" fill="#fff" fill-opacity=".92"/><circle cx="48" cy="32.2" r="1.9" fill="#fff" fill-opacity=".92"/></g></svg>';

const groupKeys = Object.keys(ButterStatus.groups);
let prefs = ButterStatus.normalize(),
  failures = {},
  connected = false,
  usage = { conversations: 0, bytes: 0 },
  usageAvailable = true,
  clearState = 'idle',
  clearTimer,
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
const switchButton = (key, on, name, small = false) =>
  `<button class="tg ${small ? 'sm' : ''} ${on ? 'on' : ''}" role="switch" aria-checked="${on}" aria-label="${name}" data-switch="${key}"></button>`;
function usageRow(t) {
  if (clearState === 'confirm' || clearState === 'clearing')
    return `<span class="q">${t.confirm}</span><button class="pill danger" data-clear="confirm" ${clearState === 'clearing' ? 'disabled' : ''}>${t.clear}</button><button class="pill" data-clear="cancel" ${clearState === 'clearing' ? 'disabled' : ''}>${t.cancel}</button>`;
  const done = clearState === 'done',
    unavailable = !usageAvailable || clearState === 'error';
  return `<span class="jar"><i style="width:${done || unavailable ? 0 : ButterPopup.usageFill(usage.bytes)}%"></i></span><span role="status">${done ? t.cleared : unavailable ? t.bad : ButterPopup.formatUsage(usage, prefs.lang)}</span>${done ? '' : `<button class="pill" data-clear="ask">${t.clear}</button>`}`;
}
function warning(t, broken) {
  if (!broken.length) return '';
  let text;
  if (broken.length === 1 && broken[0] === 'rail') text = t.warn;
  else {
    const names = broken.map((k) => t.groups[groupKeys.indexOf(k)][1]);
    text =
      prefs.lang === 'zh'
        ? `<b>${names.join('、')}暂时不可用。</b>ChatGPT 可能更新了页面，恢复后 Butter 会自动继续。`
        : `<b>${names.join(' and ')} ${names.length === 1 ? 'is' : 'are'} unavailable for now.</b> ChatGPT may have changed its page; Butter resumes on its own.`;
  }
  return `<div class="warn" role="status">${svg('alert')}<span>${text}</span></div>`;
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
  const rows = t.groups
    .map(([ic, n, d], i) => {
      const key = groupKeys[i],
        bad = broken.includes(key),
        on = ButterStatus.groupOn(prefs, key);
      return `<div class="row ${bad ? 'broken' : ''}"><span class="ic" aria-hidden="true">${svg(ic)}</span><div class="t"><div class="n">${n}${bad ? `<span class="chip">${t.bad}</span>` : ''}</div><div class="d">${d}</div>${key === 'layout' && prefs.layoutConsent === 'pending' ? `<div class="pend"><i aria-hidden="true"></i>${t.pending}</div>` : ''}</div>${switchButton(key, on, n, true)}${key === 'layout' && on ? `<div class="use">${usageRow(t)}</div>` : ''}</div>`;
    })
    .join('');
  const html = `<div class="hd">${pat}<div><div class="word">Butter</div><a class="ver" target="_blank" rel="noopener" href="https://github.com/SimianW/butter/blob/main/CHANGELOG.md" title="${t.log}">${ButterPopup.versionLabel(chrome.runtime.getManifest().version_name)}</a></div><div class="hd-side"><span class="links"><a target="_blank" rel="noopener" href="https://github.com/SimianW/butter">GitHub</a></span><div class="lang" aria-label="${prefs.lang === 'zh' ? '语言' : 'Language'}"><button data-lang="zh" aria-pressed="${prefs.lang === 'zh'}" class="${prefs.lang === 'zh' ? 'on' : ''}">中文</button><button data-lang="en" aria-pressed="${prefs.lang === 'en'}" class="${prefs.lang === 'en' ? 'on' : ''}">EN</button></div></div></div>
    <div class="master ${paused ? 'off' : ''}"><div class="t"><div class="k">${t.on}</div><div class="s" role="status"><span class="dot ${state === 'away' ? 'hollow' : ''}"></span>${t.st[state]}</div></div>${switchButton('master', prefs.enabled, t.on)}${drip}</div>
    <div class="warning-slot">${warning(t, broken)}</div><div class="label">${t.label}</div><div class="list ${paused ? 'dim' : ''}">${rows}</div>`;
  const template = document.createElement('template');
  template.innerHTML = `<div>${html}</div>`;
  if (root.firstElementChild) patch(root.firstElementChild, template.content.firstElementChild);
  else root.append(template.content);
}
const layoutRequest = (request) =>
  ButterPopup.layoutRequest((message) => chrome.runtime.sendMessage(message), request);
async function refreshUsage() {
  if (!prefs.opts.layout) return;
  try {
    usage = await layoutRequest({ version: 1, type: 'butter-layout-usage' });
    usageAvailable = true;
  } catch {
    usageAvailable = false;
  }
  render();
}
async function clearLayouts() {
  clearState = ButterPopup.clearFlow(clearState, 'confirm');
  render();
  try {
    usage = await layoutRequest({
      version: 1,
      type: 'butter-layout-clear',
      requestId: crypto.randomUUID(),
    });
    usageAvailable = true;
    clearState = ButterPopup.clearFlow(clearState, 'success');
    clearTimer = setTimeout(() => {
      clearState = ButterPopup.clearFlow(clearState, 'timeout');
      refreshUsage();
    }, 2000);
  } catch {
    clearState = ButterPopup.clearFlow(clearState, 'error');
  }
  render();
}
let saveQueue = Promise.resolve();
root.addEventListener('click', (e) => {
  const target = e.target.closest('[data-switch], [data-lang], [data-clear]');
  if (!target) return;
  if (target.dataset.clear) {
    if (target.dataset.clear === 'confirm') {
      clearLayouts();
      return;
    }
    clearState = ButterPopup.clearFlow(clearState, target.dataset.clear);
    render();
    root.querySelector(`[data-clear="${clearState === 'confirm' ? 'confirm' : 'ask'}"]`)?.focus();
    return;
  }
  settingsRevision++;
  if (target.dataset.lang) prefs = { ...prefs, lang: target.dataset.lang };
  else if (target.dataset.switch === 'master') prefs = { ...prefs, enabled: !prefs.enabled };
  else {
    prefs = ButterStatus.toggleGroup(prefs, target.dataset.switch);
    if (target.dataset.switch === 'layout') {
      clearState = 'idle';
      clearTimeout(clearTimer);
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
    if (prefs.opts.layout) refreshUsage();
  }
  if (area === 'session' && changes.butterFailures) {
    failuresRevision++;
    failures = changes.butterFailures.newValue || {};
    render();
  }
  if (area === 'local' && changes.butterLayoutCleared) refreshUsage();
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
  refreshUsage();
});
const timer = setInterval(() => {
  poll();
  if (prefs.opts.layout && clearState === 'idle') refreshUsage();
}, 1000);
addEventListener(
  'pagehide',
  () => {
    clearInterval(timer);
    clearTimeout(clearTimer);
  },
  { once: true },
);
render();
