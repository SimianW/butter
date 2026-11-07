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
    if (
      sender.id !== chrome.runtime.id ||
      !['butter-branch-put', 'butter-branch-claim'].includes(message?.type)
    )
      return;
    serial(async () => {
      await handoff.prune(Date.now());
      return message.type === 'butter-branch-put'
        ? handoff.put(message.id, message.job, sender, Date.now())
        : handoff.claim(message.id, sender, Date.now());
    }).then(respond, () => respond({ error: 'storage' }));
    return true;
  });
})();
