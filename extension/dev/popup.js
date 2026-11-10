// Dev build only: the popup's DEV tag and one-row dev card. The dev zip's popup.html loads this
// before popup.js, whose render() puts ButterDevPopup.render()'s markup in its passive slot. This
// script never appends nodes itself (patch() would remove them); it re-renders through render().
(() => {
  const KEY = 'butterDev';
  const I = {
    check: '<path d="M20 6 9 17l-5-5"/>',
    folder:
      '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
    plus: '<path d="M12 10v6"/><path d="M9 13h6"/><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>',
    camera:
      '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
  const T = {
    en: {
      round: (round, bugs) => `Round ${round} · ${bugs} ${bugs === 1 ? 'bug' : 'bugs'}`,
      idle: 'Not recording',
      recording: 'Recording the last 30 s',
      saved: 'Saved',
      save: 'Save bug snapshot',
      open: 'Open round folder',
      next: 'New round',
    },
    zh: {
      round: (round, bugs) => `第 ${round} 轮 · ${bugs} 个 bug`,
      idle: '未在记录',
      recording: '正在记录最近 30 秒',
      saved: '已保存',
      save: '保存 bug 快照',
      open: '打开本轮文件夹',
      next: '新一轮',
    },
  };
  const SAVED_MS = 4000;
  let state = { round: 1, bugs: 0 },
    // Chrome's actual binding for save-bug; empty when none is set (Linux and Windows by default).
    shortcut = '',
    chat = false,
    // The file name of a save made while this popup is open, shown for about 4 s.
    savedFile = '',
    savedTimer;
  const update = () => globalThis.render?.();
  const normalize = (value) => ({
    round: Number.isInteger(value?.round) && value.round >= 1 ? value.round : 1,
    bugs: Number.isInteger(value?.bugs) && value.bugs >= 0 ? value.bugs : 0,
    file: typeof value?.file === 'string' ? value.file : '',
    download: Number.isInteger(value?.download) ? value.download : null,
  });

  function render(lang) {
    const t = T[lang] || T.en,
      saved = !!savedFile;
    const lead = saved
      ? icon('check')
      : `<span class="rec ${chat ? '' : 'idle'}" role="img" aria-label="${chat ? t.recording : t.idle}"></span>`;
    // The live region holds only the text, so screen readers hear "Saved bug-04_….json" or the count.
    const message = saved
      ? `<span class="vh">${t.saved} </span><b class="fn">${savedFile}</b>`
      : chat
        ? t.round(state.round, state.bugs)
        : t.idle;
    // Just saved hides the icon buttons but keeps their wrapper, so the save button keeps its
    // place under patch() and is not replaced (a replaced button would drop keyboard focus).
    const buttons = `<span class="ibs"${saved ? ' hidden' : ''}><button class="ib" data-dev="open" title="${t.open}" aria-label="${t.open}">${icon('folder')}</button><button class="ib" data-dev="new-round" title="${t.next}" aria-label="${t.next}">${icon('plus')}</button></span>`;
    const card = `<div class="card dev"><div class="strip ${chat || saved ? '' : 'idle'}"><span class="lead">${lead}</span><span class="msg" role="status">${message}</span><span class="sp"></span>${buttons}<button class="btn snap" data-dev="save" ${chat ? '' : 'disabled'} title="${t.save}" aria-label="${t.save}">${icon('camera')}${shortcut ? `<kbd>${shortcut}</kbd>` : ''}</button></div></div>`;
    return { tag: '<span class="devtag">DEV</span>', card };
  }
  globalThis.ButterDevPopup = { render };

  function showSaved(file) {
    savedFile = file;
    clearTimeout(savedTimer);
    savedTimer = setTimeout(() => {
      savedFile = '';
      update();
    }, SAVED_MS);
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[KEY]) return;
    const next = normalize(changes[KEY].newValue),
      before = normalize(changes[KEY].oldValue);
    state = next;
    // A new file (from this button or the shortcut) shows as just saved; New round clears it.
    if (next.file && next.file !== before.file) showSaved(next.file);
    else if (!next.file) savedFile = '';
    update();
  });

  async function poll() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const reply = await chrome.tabs.sendMessage(
        tab.id,
        { type: 'butter-dev-ping' },
        { frameId: 0 },
      );
      chat = reply?.chat === true;
    } catch {
      chat = false; // no Butter content script: not a ChatGPT tab
    }
    update();
  }
  async function openFolder() {
    // Before the round's first save its folder does not exist yet: open Downloads, where
    // butter-diag/ lives, instead.
    const { download } = state;
    const [item] = download === null ? [] : await chrome.downloads.search({ id: download });
    if (item?.exists) chrome.downloads.show(download);
    else chrome.downloads.showDefaultFolder();
  }
  document.getElementById('popup').addEventListener('click', async (e) => {
    const target = e.target.closest('[data-dev]');
    if (!target || target.disabled) return;
    const action = target.dataset.dev;
    if (action === 'open') return openFolder();
    if (action === 'new-round') {
      await chrome.runtime.sendMessage({ type: 'butter-dev-new-round' });
      return;
    }
    if (action === 'save') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await chrome.runtime.sendMessage({ type: 'butter-dev-save', tabId: tab.id });
    }
  });

  Promise.all([chrome.storage.local.get(KEY), chrome.commands.getAll()]).then(
    ([local, commands]) => {
      state = normalize(local[KEY]);
      // Chrome's text for the binding (Alt+Shift+B, or ⌥⇧B on a Mac), escaped for the markup.
      shortcut = (commands.find((c) => c.name === 'save-bug')?.shortcut || '').replace(
        /[&<>"]/g,
        (c) => `&#${c.charCodeAt(0)};`,
      );
      update();
      poll();
    },
  );
  const timer = setInterval(poll, 1000);
  addEventListener('pagehide', () => {
    clearInterval(timer);
    clearTimeout(savedTimer);
  });
})();
