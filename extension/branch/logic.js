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

  // The quote for a selection that touches formulas: the selected text, with every formula it
  // touches, even partly, written whole as its LaTeX source: `$…$` inline, `$$…$$` on its own line
  // for display math. Paragraphs are separated by a blank line, other blocks by a line break.
  // range: { startContainer, startOffset, endContainer, endOffset }, as a DOM Range. dom describes
  // the page's nodes, so this runs on any tree with nodeType, nodeName, data, childNodes and
  // parentNode:
  //   formula(el) → { tex, display } for a formula's element, else null;
  //   layout(el) → 'inline', 'line', 'paragraph', 'cell' or 'hidden';
  //   pre(el) → true when whitespace inside it is kept.
  // Returns null when a touched formula has no LaTeX source.
  const quoteOf = (range, dom) => {
    const isFormula = (n) => n.nodeType === 1 && !!dom.formula(n);
    // The outermost formula holding node, or null.
    const formulaOf = (node) => {
      let found = null;
      for (let n = node; n; n = n.parentNode) if (isFormula(n)) found = n;
      return found;
    };
    const ancestors = new Set();
    for (let n = range.startContainer; n; n = n.parentNode) ancestors.add(n);
    let root = range.endContainer;
    while (root && !ancestors.has(root)) root = root.parentNode;
    if (!root) return null;
    const outer = formulaOf(root);
    if (outer) root = outer.parentNode || outer;
    let pre = false;
    for (let n = root; n; n = n.parentNode) if (n.nodeType === 1 && dom.pre(n)) pre = true;

    // The subtree in document order: text, formulas, and line gaps where blocks start and end.
    const items = [],
      startOf = new Map(),
      endOf = new Map();
    const walk = (node, keep) => {
      startOf.set(node, items.length);
      if (node.nodeType === 3) items.push({ text: node.data, pre: keep });
      else if (node.nodeType === 1) {
        const formula = node !== root && dom.formula(node);
        if (formula) items.push({ formula });
        else if (node.nodeName === 'BR') items.push({ text: '\n', pre: true });
        else {
          const layout = dom.layout(node);
          if (layout !== 'hidden') {
            const gap = { paragraph: 2, line: 1 }[layout] || 0;
            const inner = keep || dom.pre(node);
            if (gap) items.push({ gap });
            for (const child of node.childNodes) walk(child, inner);
            if (gap) items.push({ gap });
            else if (layout === 'cell') items.push({ text: ' ', pre: false });
          }
        }
      }
      endOf.set(node, items.length);
    };
    walk(root, pre);

    // A boundary inside a formula moves out to take the whole formula.
    const point = (container, offset, end) => {
      const formula = formulaOf(container);
      if (formula) return { i: startOf.get(formula), off: end ? Infinity : 0 };
      if (container.nodeType === 3) return { i: startOf.get(container), off: offset };
      const child = container.childNodes[offset];
      return { i: child ? startOf.get(child) : endOf.get(container), off: 0 };
    };
    const a = point(range.startContainer, range.startOffset, false),
      b = point(range.endContainer, range.endOffset, true);

    let out = '',
      gap = 0;
    const put = (s, keep) => {
      if (!s) return;
      if (gap && out) {
        out = out.replace(/[ \t]+$/, '') + '\n'.repeat(gap);
        if (!keep) s = s.replace(/^[ \t]+/, '');
      } else if (!keep && /\s$/.test(out)) s = s.replace(/^[ \t]+/, '');
      gap = 0;
      out += s;
    };
    for (let i = a.i; i <= b.i && i < items.length; i++) {
      const it = items[i];
      if (it.gap) gap = Math.max(gap, it.gap);
      else if (it.text !== undefined) {
        const s = it.text.slice(i === a.i ? a.off : 0, i === b.i ? b.off : undefined);
        put(it.pre ? s : s.replace(/[ \t\n\r\f]+/g, ' '), it.pre);
      } else {
        if (i === b.i && b.off === 0) break;
        const { tex, display } = it.formula;
        if (!text(tex)) return null;
        if (!display) {
          put(`$${tex.trim().replace(/\s+/g, ' ')}$`, true);
          continue;
        }
        // A blank line would end the quoted math block, so blank lines go.
        const lines = tex
          .trim()
          .split(/\r\n?|\n/)
          .map((line) => line.trimEnd())
          .filter((line) => line.trim());
        gap = Math.max(gap, 1);
        put(`$$${lines.join('\n')}$$`, true);
        gap = 1;
      }
    }
    return out.trim();
  };

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
  // The tab's URL first: sender.url keeps the URL the document loaded with, so after ChatGPT
  // routes to another conversation (a sidebar click) it still names the previous one.
  const senderIdentity = (sender) => identity(sender?.tab?.url || sender?.url);
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

  // The ready line goes once ChatGPT's reply to the sent question starts to show: the last reply
  // on the page is one that wasn't there when Butter sent. known and now are keys of the page's
  // replies in page order (page.js replyKeys), so older turns loading above, or remounting, don't
  // count.
  const replyStarted = (known, now) => now.length > 0 && !known.includes(now.at(-1));

  globalThis.ButterBranch = {
    TTL,
    replyStarted,
    confirmedFailure,
    formatMessage,
    quoteOf,
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
