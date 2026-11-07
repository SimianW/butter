// Ask in branch: pure rules shared by the content scripts, the worker and node --test.
// No browser APIs here.
(() => {
  const formatMessage = (quote, question) =>
    `${String(quote)
      .trim()
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => `> ${line}`)
      .join('\n')}\n\n${String(question).trim()}`;

  const text = (s) => typeof s === 'string' && !!s.trim();

  // Conversation identity: a saved `/c/<uuid>` or an unsaved native branch
  // `/c/local-chatgpt:<uuid>` (URL-encoded in the route). Anything else is unreadable (null).
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const validIdentity = (id) =>
    typeof id === 'string' && UUID.test(id.replace(/^local-chatgpt:/, ''));
  const identity = (url) => {
    try {
      const parsed = new URL(url);
      if (parsed.origin !== 'https://chatgpt.com') return null;
      const segment = /\/c\/([^/]+)\/?$/.exec(parsed.pathname)?.[1];
      const id = decodeURIComponent(segment || '').toLowerCase();
      return validIdentity(id) ? id : null;
    } catch {
      return null;
    }
  };
  const saved = (id) => validIdentity(id) && !id.startsWith('local-chatgpt:');
  const isBranch = (current, original) =>
    validIdentity(current) && validIdentity(original) && current !== original;

  // ChatGPT's labels, English and Simplified Chinese, as seen on the live page (2026-11-07).
  // Structural cues (roles, icons, attributes) are tried first; labels are the fallback.
  const exact = (...names) => new RegExp(`^(?:${names.join('|')})$`);
  const labels = {
    nativeAsk: exact(
      'Ask ChatGPT',
      '询问 ChatGPT',
      '询问ChatGPT',
      '问问 ChatGPT',
      '向 ChatGPT 提问',
    ),
    sideChat: exact('Ask in side chat', '在侧边聊天中提问'),
    workComposer: exact('Work with ChatGPT', '使用 ChatGPT Work'),
    more: exact('More actions', '更多操作'),
    branch: exact('Branch conversation', '创建对话分支'),
    newChat: exact('Branch in new chat', '在新聊天中创建分支'),
  };

  // Menus and buttons as page.js describes them: { popup, icons: [href], label, testid }.
  // Each role names its structural match and its label fallback. "Branch in new chat" has no icon
  // or test id, so only its exact label (on a leaf item) identifies it, never its position: its
  // sibling is "Branch into Work mode".
  const hasIcon = (it, name) => (it.icons || []).some((href) => String(href).includes(name));
  const ROLES = {
    more: {
      shape: (it) => it.testid === 'message-more-button' || hasIcon(it, 'icon-ellipsis-horizontal'),
      label: (it) => labels.more.test(it.label),
    },
    branch: {
      shape: (it) => it.popup && hasIcon(it, 'icon-branch'),
      label: (it) => it.popup && labels.branch.test(it.label),
    },
    newchat: { shape: () => false, label: (it) => !it.popup && labels.newChat.test(it.label) },
  };
  const pick = (items, role) => {
    const r = ROLES[role];
    return items.find(r.shape) || items.find(r.label) || null;
  };

  // Work/Codex mode, from page.js facts: composer = { placement, chat } (the composer form's
  // data-composer-placement and data-chatgpt-composer attributes), label = the composer's
  // aria-label, sideChat = ChatGPT's selection toolbar offers "Ask in side chat".
  const isWorkMode = ({ composer, label, sideChat } = {}) =>
    !!(composer?.placement && !composer.chat) ||
    labels.workComposer.test(label || '') ||
    !!sideChat;

  const temporaryUrl = (url) => {
    try {
      return new URL(url).searchParams.get('temporary-chat') === 'true';
    } catch {
      return false;
    }
  };

  // Why the button stays hidden on this page, or null. Only saved Chat-mode conversations where
  // ChatGPT offers a branch action qualify. branchAction null means unknown (e.g. the only reply
  // is still streaming and has no actions yet), which doesn't hide the button.
  const hiddenReason = ({ identity: id, temporary, work, branchAction } = {}) => {
    if (temporary) return 'temporary';
    if (!saved(id)) return 'unsaved';
    if (work) return 'work';
    if (branchAction === false) return 'no-branch-action';
    return null;
  };

  // A selection the button may act on: text inside one assistant reply (not an editable or a
  // formula), on a page where ChatGPT can make a branch (page = facts from page.js).
  const qualifies = ({ text: selected, start, end, identity: id, excluded, page } = {}) =>
    text(selected) &&
    !!start &&
    start === end &&
    !excluded &&
    !!page &&
    hiddenReason({ ...page, identity: id }) === null;

  // Handoff: the original tab hands { original, title, quote, question } to the worker, which
  // keeps it in session storage until the new tab claims it once. Short-lived on purpose.
  const TTL = 60_000;
  const PREFIX = 'butterBranch.';
  const JOB_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  const validJob = (job) =>
    !!job &&
    saved(job.original) &&
    text(job.quote) &&
    text(job.question) &&
    (job.title === undefined || typeof job.title === 'string');
  const senderIdentity = (sender) => identity(sender?.url || sender?.tab?.url);
  const jobId = (hash) => {
    const id = /^#butter-branch=([0-9a-f-]{36})$/.exec(hash || '')?.[1];
    return id && JOB_ID.test(id) ? id : null;
  };
  const expired = (row, now) =>
    !Number.isFinite(row?.at) || row.at > now || now - row.at >= TTL || !validJob(row.job);
  const handoff = (storage) => ({
    async put(id, job, sender, now) {
      if (!JOB_ID.test(id || '') || !validJob(job) || senderIdentity(sender) !== job.original)
        return { error: 'invalid' };
      const { original, title, quote, question } = job;
      await storage.set({
        [PREFIX + id]: { at: now, tab: sender?.tab?.id, job: { original, title, quote, question } },
      });
      return { ok: true };
    },
    async claim(id, sender, now) {
      if (!JOB_ID.test(id || '')) return { error: 'invalid' };
      const key = PREFIX + id,
        row = (await storage.get(key))[key];
      if (!row) return { missing: true };
      await storage.remove(key);
      // origin: the tab that put the job, so it can learn whether the hand-over happened.
      const origin = row.tab;
      if (expired(row, now)) return { error: 'expired', origin };
      if (sender?.tab?.id === row.tab || senderIdentity(sender) !== row.job.original)
        return { error: 'sender', origin };
      return { job: row.job, origin };
    },
    async prune(now) {
      const rows = await storage.get(null);
      const keys = Object.keys(rows).filter((k) => k.startsWith(PREFIX) && expired(rows[k], now));
      if (keys.length) await storage.remove(keys);
    },
  });

  // Run failures that say the feature itself is broken (ChatGPT changed its menus or routes, or
  // Butter hit a page error), as opposed to a reply that is still being written.
  const CONFIRMED = new Set(['more', 'branch', 'newchat', 'identity', 'load', 'error']);
  const confirmedFailure = (cause) => CONFIRMED.has(cause);

  globalThis.ButterBranch = {
    TTL,
    confirmedFailure,
    formatMessage,
    identity,
    saved,
    isBranch,
    validJob,
    qualifies,
    hiddenReason,
    temporaryUrl,
    isWorkMode,
    labels,
    pick,
    jobId,
    handoff,
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterBranch;
})();
