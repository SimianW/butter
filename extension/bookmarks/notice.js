// ISOLATED world. The bookmark notification (#77): one card at top right on every save and every
// remove, both of which go through the bookmark session (bookmarks/session.js: `create` for the
// Bookmark cell and the shortcut, `remove` for × on a rail card). "Bookmark saved", "Bookmark
// removed" or "Already bookmarked", the bookmark's first words on one line, and Undo (none when it
// was already bookmarked). It only presents: Undo runs the action the session handed over, which
// writes the store. The small card leaves 4 s after it shows; the pointer on it or focus inside it holds
// it, and it leaves 4 s after both are gone. A new card replaces the current one at once, and a
// replaced card's Undo does nothing. The card never takes focus and is announced politely.
// The first save ever (#56) shows the card expanded with what Butter keeps, the privacy link and
// Got it, until Got it, which is kept in settings as `bookmarkNotice: 'acknowledged'`, once per
// browser profile. Undo leaves it unacknowledged, so the next save expands again. Independent of
// the layout switch and `layoutConsent`; shown only while bookmarks are on (Butter, the rail and
// Bookmarks).
// The card is consent/card.js's shell, placed top right.
(() => {
  const T = {
    zh: {
      saved: '书签已保存',
      removed: '已移除书签',
      already: '已有此书签',
      d: 'Butter 只保存你标记内容的前三行，存在这台电脑上，不上传任何东西。在导航条的书签卡片上点 × 可删除一个，也可以在 Butter 弹窗里全部清除。',
      link: '隐私政策',
      undo: '撤销',
      ok: '知道了',
    },
    en: {
      saved: 'Bookmark saved',
      removed: 'Bookmark removed',
      already: 'Already bookmarked',
      d: 'Butter keeps the first three lines of what you bookmark, on this computer only. Nothing is uploaded. Remove one with the × on its card in the rail, or clear them all in the Butter popup.',
      link: 'Privacy policy',
      undo: 'Undo',
      ok: 'Got it',
    },
  };
  const LIFE = 4000; // ms the small card shows once nothing holds it
  const MARK =
    '<path d="M4 2.5h8a.5.5 0 0 1 .5.5v10.6a.3.3 0 0 1-.48.24L8 10.9l-4.02 2.94a.3.3 0 0 1-.48-.24V3a.5.5 0 0 1 .5-.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>';
  const ICON = {
    on: `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">${MARK}</svg>`,
    off: `<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">${MARK}<path d="M2.5 2.5l11 11" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  };
  // The approved mockup's card (#77): the consent card's tokens, its own padding and parts.
  const CSS = `
.card.note { padding: 10px 8px 10px 10px; border-radius: 14px; }
.card.note.first { padding: 12px 14px 12px 12px; }
.row { display: flex; align-items: center; gap: 10px; }
.ic { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex: none; background: var(--butter); color: #1b170f; }
.removed .ic { background: var(--track); color: var(--ink-2); }
.ic svg { width: 17px; height: 17px; }
.saved .ic path, .already .ic path { fill: #1b170f; }
.tx { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.tx b { font-size: 14px; font-weight: 700; line-height: 1.35; }
.ex { font-size: 12px; font-weight: 500; line-height: 1.5; color: var(--ink-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.removed .ex { text-decoration: line-through; }
.note button { padding: 6px 12px; flex: none; }
.row button { background: var(--track); color: var(--ink); }
.row button:hover { background: color-mix(in srgb, var(--track) 85%, var(--ink)); }
.first .d a { margin-left: 4px; }
.first .btns { margin-top: 10px; }
.first .btns button.yes { background: var(--butter); color: #1b170f; }
`;
  let butter,
    current = null, // the card showing: { id, kind, bookmark, undo, first }
    serial = 0,
    busy = false,
    timer = 0,
    pointer = false, // the pointer is on the card
    focus = false; // focus is inside it
  const settings = () => ButterStatus.normalize(butter);
  const seen = () => butter?.bookmarkNotice === 'acknowledged';
  const card = ButterCard(
    'chatgpt-butter-bookmark-notice',
    (e) => {
      if (!e.isTrusted || busy) return;
      const button = e.target.closest('button[data-notice]');
      const it = current;
      // A replaced card's buttons do nothing.
      if (!button || !it || button.dataset.card !== String(it.id)) return;
      busy = true;
      (button.dataset.notice === 'undo' ? undo(it) : acknowledge())
        .catch(() => {})
        .finally(() => (busy = false));
    },
    { top: true, css: CSS },
  );
  const leave = () => {
    clearTimeout(timer);
    current = null;
    card.hide(true);
  };
  // The small card's 4 s, from now, unless something holds it. The expanded card stays.
  const arm = () => {
    clearTimeout(timer);
    if (current && !current.first && !pointer && !focus) timer = setTimeout(leave, LIFE);
  };
  let held = false;
  const hold = () => {
    if (held) return;
    held = true;
    const host = card.host;
    host.addEventListener('pointerenter', () => {
      pointer = true;
      arm();
    });
    host.addEventListener('pointerleave', () => {
      pointer = false;
      arm();
    });
    host.addEventListener('focusin', () => {
      focus = true;
      arm();
    });
    // Focus moving between the card's own controls is retargeted to the host.
    host.addEventListener('focusout', (e) => {
      focus = e.relatedTarget === host;
      arm();
    });
  };

  // The session's Undo: a save's deletes that bookmark, a remove's stores it again (same key, same
  // time).
  async function undo(it) {
    leave();
    await it.undo?.();
  }
  async function acknowledge() {
    leave();
    // Re-read so a simultaneous change in the popup or another tab is kept.
    const { butter: now } = await chrome.storage.local.get('butter');
    if (now?.bookmarkNotice === 'acknowledged') return;
    await chrome.storage.local.set({ butter: { ...now, bookmarkNotice: 'acknowledged' } });
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.butter) return;
    butter = changes.butter.newValue;
    const s = settings();
    // Got it in another tab puts the expanded card away; small cards keep their time.
    if (!ButterStatus.bookmarksOn(s) || (seen() && current?.first)) leave();
  });
  const loaded = chrome.storage.local.get('butter').then((r) => {
    if (butter === undefined) butter = r.butter;
  });

  async function show(kind, bookmark, undo) {
    await loaded;
    const s = settings();
    if (!ButterStatus.bookmarksOn(s) || !document.documentElement) return;
    const t = T[s.lang],
      first = kind === 'saved' && !seen(),
      id = ++serial;
    current = { id, kind, bookmark, undo, first };
    const undoButton = (cls = '') =>
      `<button type="button"${cls} data-notice="undo" data-card="${id}">${t.undo}</button>`;
    const head = `<span class="ic">${ICON[kind === 'removed' ? 'off' : 'on']}</span><span class="tx"><b>${t[kind]}</b><span class="ex"></span></span>`;
    const el = card.set(
      s.lang,
      first
        ? `<div class="row">${head}</div><p class="d">${t.d}${card.policy(s.lang, t.link)}</p><div class="btns">${undoButton()}<button type="button" class="yes" data-notice="ok" data-card="${id}">${t.ok}</button></div>`
        : `<div class="row">${head}${kind === 'already' ? '' : undoButton()}</div>`,
    );
    el.className = `card note ${kind}${first ? ' first' : ''}`;
    // Page text, never markup: the bookmark's first words on one line.
    el.querySelector('.ex').textContent = (bookmark.excerpt || '').replace(/\s+/g, ' ').trim();
    hold();
    card.show();
    arm();
  }
  globalThis.ButterBookmarkNotice = {
    // A bookmark was just created. `undo()` deletes it again.
    saved: (bookmark, undo) => show('saved', bookmark, undo),
    // A save found the same bookmark already stored.
    already: (bookmark) => show('already', bookmark),
    // A bookmark was deleted (× on its rail card). `undo()` stores it again.
    removed: (bookmark, undo) => show('removed', bookmark, undo),
  };
})();
