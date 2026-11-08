// ISOLATED world. The first bookmark notice (#56): right after a bookmark is saved, by the hover
// button or the shortcut (both go through bookmarks/content.js's create), say what Butter keeps,
// with Undo. It shows until "Got it", which is kept in settings as `bookmarkNotice: 'acknowledged'`,
// once per browser profile. Undo deletes the bookmark just saved and leaves the notice
// unacknowledged, so the next bookmark shows it again. Independent of the layout switch and
// `layoutConsent`. The card is consent/card.js, the consent card's shell.
(() => {
  const T = {
    zh: {
      t: '书签已保存',
      d: 'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 即可删除。',
      link: '隐私政策',
      undo: '撤销',
      ok: '知道了',
    },
    en: {
      t: 'Bookmark saved',
      d: 'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove a bookmark with the × on its card in the rail.',
      link: 'Privacy policy',
      undo: 'Undo',
      ok: 'Got it',
    },
  };
  let butter,
    latest = null, // { bookmark, undone } for the bookmark the notice is about
    busy = false;
  const seen = () => butter?.bookmarkNotice === 'acknowledged';
  const card = ButterCard('chatgpt-butter-bookmark-notice', (e) => {
    if (!e.isTrusted || busy) return;
    const choice = e.target.closest('button[data-notice]')?.dataset.notice;
    if (!choice) return;
    busy = true;
    (choice === 'undo' ? undo() : acknowledge()).catch(() => {}).finally(() => (busy = false));
  });
  // The store's delete message, retried like bookmarks/content.js's other requests.
  async function undo() {
    const it = latest;
    latest = null;
    card.hide(true);
    if (!it) return;
    const { account, conv, key } = it.bookmark;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await chrome.runtime.sendMessage({
          version: 1,
          type: 'butter-bookmark-delete',
          account,
          conv,
          key,
        });
        if (r && r.error !== 'bookmark-storage') {
          if (r.deleted) it.undone?.();
          return;
        }
      } catch {}
    }
  }
  async function acknowledge() {
    latest = null;
    card.hide(true);
    // Re-read so a simultaneous change in the popup or another tab is kept.
    const { butter: now } = await chrome.storage.local.get('butter');
    if (now?.bookmarkNotice === 'acknowledged') return;
    await chrome.storage.local.set({ butter: { ...now, bookmarkNotice: 'acknowledged' } });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.butter) return;
    butter = changes.butter.newValue;
    if (seen() || !ButterStatus.normalize(butter).enabled) {
      latest = null;
      card.hide(true);
    }
  });
  const loaded = chrome.storage.local.get('butter').then((r) => {
    if (butter === undefined) butter = r.butter;
  });
  globalThis.ButterBookmarkNotice = {
    // A bookmark was just created (not found already stored). `undone` runs once Undo deleted it.
    async saved(bookmark, undone) {
      await loaded;
      const settings = ButterStatus.normalize(butter);
      if (seen() || !settings.enabled || !document.documentElement) return;
      latest = { bookmark, undone };
      const t = T[settings.lang];
      card.fill(
        settings.lang,
        t.t,
        t.d,
        t.link,
        `<button type="button" data-notice="undo">${t.undo}</button><button type="button" class="yes" data-notice="ok">${t.ok}</button>`,
      );
      card.show();
    },
  };
})();
