// Loaded by the extension worker. Ask in branch handoff: the original tab puts a job, the new tab
// claims it once. Jobs live in chrome.storage.session (memory only, never written to disk) and
// expire after ButterBranch.TTL. One queue serializes puts, claims and pruning.
(() => {
  const handoff = ButterBranch.handoff(chrome.storage.session);
  let queue = Promise.resolve();
  const serial = (fn) => (queue = queue.catch(() => {}).then(fn));
  // No alarms permission: prune whenever the worker wakes and on every put or claim.
  serial(() => handoff.prune(Date.now()));
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id) return;
    // Close tab on the failure card. A tab may close only itself; no "tabs" permission needed.
    if (message?.type === 'butter-branch-close' && sender.tab?.id !== undefined) {
      chrome.tabs.remove(sender.tab.id).then(
        () => respond({ ok: true }),
        () => respond({ error: 'close' }),
      );
      return true;
    }
    if (!['butter-branch-put', 'butter-branch-claim'].includes(message?.type)) return;
    serial(async () => {
      await handoff.prune(Date.now());
      if (message.type === 'butter-branch-put')
        return handoff.put(message.id, message.job, sender, Date.now());
      const { origin, ...result } = await handoff.claim(message.id, sender, Date.now());
      // The original tab keeps its question box open until it hears how the hand-over went.
      if (origin !== undefined)
        chrome.tabs
          .sendMessage(origin, {
            type: result.job ? 'butter-branch-claimed' : 'butter-branch-unclaimed',
            id: message.id,
          })
          .catch(() => {});
      return result;
    }).then(respond, () => respond({ error: 'storage' }));
    return true;
  });
})();
