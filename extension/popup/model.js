// Pure popup formatting and confirmation state. No browser APIs.
(() => {
  // Any non-zero size under 1 KB reads "1 KB": the line never claims nothing is saved.
  const formatSize = (bytes) =>
    bytes >= 100_000
      ? `${(bytes / 1_000_000).toFixed(1)} MB`
      : `${bytes > 0 ? Math.max(1, Math.round(bytes / 1000)) : 0} KB`;
  // Saved layouts: "14 chats, about 3.4 MB".
  const formatUsage = ({ conversations = 0, bytes = 0 } = {}, lang = 'en') =>
    lang === 'zh'
      ? `${conversations} 个对话，约 ${formatSize(bytes)}`
      : `${conversations} ${conversations === 1 ? 'chat' : 'chats'}, about ${formatSize(bytes)}`;
  // Bookmarks: "12 saved, about 4 KB".
  const formatBookmarks = ({ count = 0, bytes = 0 } = {}, lang = 'en') =>
    lang === 'zh'
      ? `已保存 ${count} 个，约 ${formatSize(bytes)}`
      : `${count} saved, about ${formatSize(bytes)}`;
  // The confirm row's question for `store` ('bookmarks' or 'layouts'); `n` is chats for layouts.
  const confirmQuestion = (store, n, lang = 'en') => {
    if (lang === 'zh')
      return store === 'bookmarks' ? `清除 ${n} 个书签？` : `清除 ${n} 个对话的已保存布局？`;
    const noun = store === 'bookmarks' ? 'bookmark' : 'saved layout';
    return `Clear ${n} ${noun}${n === 1 ? '' : 's'}?`;
  };
  // What a storage row shows, in priority order: the question while it asks; "Cleared" for 2 s
  // after a clear; "Unavailable" when usage can't be read or the clear failed; the saved line
  // and Clear; "Needs the question rail" (`needsRail`: Bookmarks on, the rail off); else the
  // description.
  const storageLine = ({ clear = 'idle', available = true, count = 0, needsRail = false }) =>
    clear === 'confirm' || clear === 'clearing'
      ? 'confirm'
      : clear === 'done'
        ? 'cleared'
        : !available || clear === 'error'
          ? 'unavailable'
          : count > 0
            ? 'saved'
            : needsRail
              ? 'rail'
              : 'description';
  // The manifest's version_name as written, for example 0.1.0-alpha.15.
  const versionLabel = (version) => version;
  // One machine per storage row.
  const clearFlow = (state, event) =>
    ({
      idle: { ask: 'confirm' },
      confirm: { cancel: 'idle', confirm: 'clearing' },
      clearing: { success: 'done', error: 'error' },
      done: { timeout: 'idle' },
      error: { ask: 'confirm' },
    })[state]?.[event] ?? state;
  // Retry the identical request: a new id on retry would clear what was saved since.
  async function storeRequest(send, request) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await send(request);
        if (!result || result.error) throw new Error(result?.error || 'storage');
        return result;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  }
  globalThis.ButterPopup = {
    formatUsage,
    formatBookmarks,
    confirmQuestion,
    storageLine,
    versionLabel,
    clearFlow,
    storeRequest,
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterPopup;
})();
