// Page world. Feeds the history rail (butter-nav.js) with the conversation's messages, read from the
// responses ChatGPT fetches anyway; the extension makes no requests of its own. ChatGPT loads a
// long chat in pages, newest first, and keeps only about five turns in the DOM, so the DOM alone
// can't list the questions. Events go to the isolated world as JSON strings on `butter-nav`.
(() => {
  const MARK = Symbol.for('chatgpt-butter.nav-installed');
  if (window[MARK]) return;
  window[MARK] = true;

  // GET .../conversations/<id> (newest page) and .../conversations/<id>/messages?before=... (older).
  const PAGE = /\/backend-api\/conversations?\/([0-9a-f-]{36})(\/messages)?(?:\?|$)/;
  const SEND = /\/backend-api\/(?:f\/)?conversation(?:\?|$)/;
  const emit = msg => document.dispatchEvent(new CustomEvent('butter-nav', { detail: JSON.stringify(msg) }));

  // `q` is set only for questions the user sees in the thread; other messages keep their place so
  // an edit's parent can be found.
  const item = m => {
    const c = m?.content;
    let q = null;
    if (m?.author?.role === 'user' && !m.metadata?.is_visually_hidden_from_conversation &&
        (c?.content_type === 'text' || c?.content_type === 'multimodal_text')) {
      q = (c.parts ?? []).filter(p => typeof p === 'string').join('\n').trim() || (c.parts?.length ? '[image]' : null);
    }
    return { id: m.id, q };
  };

  const parsed = new Set();
  let olderSeen = false, olderEngaged = false;
  let statusPath = location.pathname;
  const syncStatus = () => {
    if (statusPath !== location.pathname) { statusPath = location.pathname; olderSeen = olderEngaged = false; }
  };
  // ChatGPT may wrap fetch again and still delegate to us: report observed engagement, not identity.
  document.addEventListener('butter-status-request', () => {
    syncStatus();
    const conv = /\/c\/([0-9a-f-]{36})/.exec(location.pathname)?.[1];
    document.dispatchEvent(new CustomEvent('butter-status-response', { detail: JSON.stringify({
      older: { exercised: olderSeen, engaged: olderEngaged, failed: olderSeen && !olderEngaged },
      rail: { parsed: parsed.has(conv) },
    }) }));
  });

  const onPage = (conv, before, j) => {
    let msgs = j.messages;
    if (!msgs && j.mapping) {   // older single-object format: walk the current branch up from its tip
      msgs = [];
      for (let n = j.mapping[j.current_node]; n; n = j.mapping[n.parent]) if (n.message) msgs.push(n.message);
      msgs.reverse();
    }
    if (!Array.isArray(msgs)) return;
    parsed.add(conv);
    emit({ type: 'page', conv, before, hasPrev: !!j.page_info?.has_previous_page, items: msgs.filter(m => m?.id).map(item) });
  };

  const onSend = body => {
    const b = JSON.parse(body);
    const m = b.messages?.[0];
    if (m?.author?.role !== 'user') return;   // regenerate etc.
    emit({ type: 'send', conv: b.conversation_id ?? null, parent: b.parent_message_id ?? null, item: item(m) });
  };

  // Smaller pages of earlier messages (config.js `olderPageTurns`): ChatGPT lays each page out in one
  // long task, during which the composer can't take input. Only lowers an existing `num_turns`.
  const older = (input, init) => {
    if (document.documentElement?.getAttribute('data-butter-off')?.split(' ').includes('older')) return input;
    const n = window.__butterConfig?.olderPageTurns;
    if (!(n > 0)) return input;
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url ?? '';
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (method !== 'GET' || !PAGE.exec(raw)?.[2]) return input;
    const url = new URL(raw, location.href);
    if (!(+url.searchParams.get('num_turns') > n)) return input;
    syncStatus(); olderSeen = true;
    url.searchParams.set('num_turns', String(n));
    const result = input instanceof Request ? new Request(url.href, input) : url.href;
    olderEngaged = true;
    return result;
  };

  const of = window.fetch;
  window.fetch = function (input, init) {
    try { input = older(input, init); } catch {}
    const res = of.call(this, input, init);
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url ?? '';
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const m = method === 'GET' && PAGE.exec(url);
      if (m) res.then(r => r.ok ? r.clone().json() : null).then(j => j && onPage(m[1], !!m[2], j)).catch(() => {});
      else if (method === 'POST' && typeof init?.body === 'string' && SEND.test(url)) onSend(init.body);
    } catch {}
    return res;
  };
})();
