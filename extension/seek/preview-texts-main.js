// MAIN world: the conversation markdown the seek preview falls back on for turns without a layout
// record (texts), kept from ChatGPT's conversation data (butter-seek-data) and the sends since.
// Classic script, loaded before seek/preview-main.js, which calls the factory once, at the point
// where these listeners registered before the split, with its live state as getters.
globalThis.__butterPreviewTexts = ({ conv, event, finish, seekOutcome, active, pendingCommit }) => {
  const conversations = new Map();
  // ---- conversation markdown (estimate fallback for turns without a layout record) ----
  document.addEventListener('butter-seek-data', (e) => {
    const { conv: c, before, j } = e.detail;
    let msgs = j.messages;
    if (!msgs && j.mapping) {
      msgs = [];
      for (let n = j.mapping[j.current_node]; n; n = j.mapping[n.parent])
        if (n.message) msgs.push(n.message);
      msgs.reverse();
    }
    if (!Array.isArray(msgs)) return;
    msgs = msgs.map((m) => ({
      id: m.id,
      role: m.author?.role,
      channel: m.channel,
      recipient: m.recipient,
      hidden: m.metadata?.is_visually_hidden_from_conversation,
      text: (m.content?.parts || []).filter((x) => typeof x === 'string').join('\n'),
    }));
    let old = conversations.get(c) || { messages: [], hasPrev: false };
    if (before) {
      const have = new Set(old.messages.map((m) => m.id));
      msgs = msgs.filter((m) => !have.has(m.id)).concat(old.messages);
    }
    conversations.set(c, { messages: msgs, hasPrev: !!j.page_info?.has_previous_page });
    const source = texts(c).byId;
    queueMicrotask(() => globalThis.__butterLayoutCache?.setTexts(c, source));
    while (conversations.size > 2) conversations.delete(conversations.keys().next().value);
    if (active()?.conv === c) {
      event('data-during-hold', { before });
      finish('data-invalidation', false);
    } else if (pendingCommit()?.conv === c) {
      pendingCommit().release.invalidate('history-data');
      event('data-during-release');
    }
  });
  document.addEventListener('butter-nav', (e) => {
    let m;
    try {
      m = JSON.parse(e.detail);
    } catch {
      return;
    }
    if (m.type !== 'send') return;
    if (active() || pendingCommit()) finish('send-invalidation', false);
    const data = conversations.get(m.conv || conv());
    if (!data) return;
    const parent = data.messages.findIndex((x) => x.id === m.parent);
    if (parent >= 0) data.messages = data.messages.slice(0, parent + 1);
    data.messages.push({ id: m.item.id, role: 'user', text: m.item.q || '' });
  });
  document.addEventListener('butter-layout-account-ready', () => {
    const c = conv();
    if (conversations.has(c))
      queueMicrotask(() => globalThis.__butterLayoutCache?.setTexts(c, texts(c).byId));
  });
  document.addEventListener('butter-layout-account-change', () => {
    seekOutcome({});
    conversations.clear();
    if (active() || pendingCommit()) finish('account-invalidation', false);
  });
  document.addEventListener('butter-seek-write', (e) => {
    conversations.delete(e.detail.conv || conv());
    if (active() || pendingCommit()) finish('mutation-invalidation', false);
  });
  const texts = (c = conv()) => {
    const data = conversations.get(c),
      out = {};
    let current;
    for (const m of data?.messages || []) {
      if (m.hidden) continue;
      if (m.role === 'user') {
        current = { q: m.text, answer: '', msg: '', ids: [] };
        out[m.id] = current;
      } else if (
        current &&
        m.role === 'assistant' &&
        (!m.channel || m.channel === 'final') &&
        (!m.recipient || m.recipient === 'all')
      ) {
        current.answer += m.text + '\n';
        current.msg = m.id;
        current.ids.push(m.id);
      }
    }
    return { byId: out, hasPrev: !!data?.hasPrev };
  };
  return { texts };
};
