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

  // A selection the button may act on: text inside one assistant reply (not an editable or a
  // formula), in a saved conversation, since only saved conversations can be branched.
  const qualifies = ({ text: selected, start, end, identity: id, editable } = {}) =>
    text(selected) && !!start && start === end && !editable && saved(id);

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
      if (expired(row, now)) return { error: 'expired' };
      if (sender?.tab?.id === row.tab || senderIdentity(sender) !== row.job.original)
        return { error: 'sender' };
      return { job: row.job };
    },
    async prune(now) {
      const rows = await storage.get(null);
      const keys = Object.keys(rows).filter((k) => k.startsWith(PREFIX) && expired(rows[k], now));
      if (keys.length) await storage.remove(keys);
    },
  });

  globalThis.ButterBranch = {
    TTL,
    formatMessage,
    identity,
    saved,
    isBranch,
    validJob,
    qualifies,
    jobId,
    handoff,
  };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterBranch;
})();
