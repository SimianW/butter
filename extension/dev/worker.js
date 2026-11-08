// Dev build only: the dev manifest's service worker. Loads the store worker unchanged, then
// handles the save-bug shortcut: ask the active ChatGPT chat for a snapshot and download it to
// Downloads/butter-diag/round-<N>/bug-<NN>_<HH-MM-SS>.json with no Save As prompt.
// importScripts paths resolve against this file, which sits at the same depth as storage/.
importScripts('../storage/layout-worker.js', 'recorder.js');
(() => {
  // Round state survives popup closes, tab switches and browser restarts.
  const KEY = 'butterDev';
  const roundState = async () => {
    const value = (await chrome.storage.local.get(KEY))[KEY];
    return {
      round: Number.isInteger(value?.round) && value.round >= 1 ? value.round : 1,
      bugs: Number.isInteger(value?.bugs) && value.bugs >= 0 ? value.bugs : 0,
    };
  };
  // A source the worker cannot read is passed on as unavailable, like a failing page source.
  const read = async (area, key, shape = (value) => value) => {
    try {
      return shape((await chrome.storage[area].get(key))[key]);
    } catch {
      return { unavailable: 'error' };
    }
  };
  // Service workers have no URL.createObjectURL; base64 keeps a ~1 MB file under Chrome's
  // 2 MB URL limit.
  const dataUrl = (text) => {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (let i = 0; i < bytes.length; i += 0x8000)
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return `data:application/json;base64,${btoa(binary)}`;
  };

  async function save(trigger, tab) {
    if (!tab?.id) [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab?.id) return { error: 'no-tab' };
    const { round, bugs } = await roundState();
    const bug = bugs + 1;
    const request = {
      bug,
      round,
      trigger,
      version: chrome.runtime.getManifest().version_name,
      settings: await read('local', 'butter', ButterStatus.normalize),
      failures: await read('session', 'butterFailures', (value) => value || {}),
    };
    let reply;
    try {
      reply = await chrome.tabs.sendMessage(
        tab.id,
        { type: 'butter-dev-snapshot', request },
        { frameId: 0 },
      );
    } catch {
      return { error: 'not-chatgpt' }; // no Butter content script in this tab
    }
    if (!reply?.snapshot) return { error: reply?.error || 'no-snapshot' };
    const savedAt = new Date(JSON.parse(reply.snapshot).savedAt);
    const filename = ButterDevRecorder.downloadPath(round, bug, savedAt);
    const download = await chrome.downloads.download({
      url: dataUrl(reply.snapshot),
      filename,
      saveAs: false,
      conflictAction: 'uniquify',
    });
    // The popup shows the file name, and Open round folder shows the download in its folder.
    const file = ButterDevRecorder.fileName(bug, savedAt);
    await chrome.storage.local.set({ [KEY]: { round, bugs: bug, file, download } });
    return { saved: filename, round, bug };
  }

  // New round: the next save goes to round-<N+1>/bug-01.
  async function newRound() {
    const { round } = await roundState();
    await chrome.storage.local.set({ [KEY]: { round: round + 1, bugs: 0 } });
    return { round: round + 1, bugs: 0 };
  }

  // One change to the round state at a time, so two quick presses get consecutive bug numbers
  // and New round never interleaves with a save.
  let queue = Promise.resolve();
  const enqueue = (task) => {
    const run = queue.then(task);
    queue = run.catch(() => {});
    return run;
  };
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'save-bug') enqueue(() => save('shortcut', tab)).catch(() => {});
  });
  // The popup's dev card: its save button takes the shortcut's path, with trigger "button".
  // Only the extension's own pages may ask; content scripts run on chatgpt.com and cannot.
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || !sender.url?.startsWith(chrome.runtime.getURL('')))
      return;
    const task =
      message?.type === 'butter-dev-save' && Number.isInteger(message.tabId)
        ? () => save('button', { id: message.tabId })
        : message?.type === 'butter-dev-new-round'
          ? newRound
          : null;
    if (!task) return;
    enqueue(task).then(respond, () => respond({ error: 'failed' }));
    return true;
  });
})();
