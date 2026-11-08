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

  // Resolves true when the download completes, false when it is interrupted.
  const completed = (id) =>
    new Promise((resolve) => {
      const finish = (state) => {
        if (state === 'in_progress') return;
        chrome.downloads.onChanged.removeListener(changed);
        resolve(state === 'complete');
      };
      const changed = (delta) => {
        if (delta.id === id && delta.state) finish(delta.state.current);
      };
      chrome.downloads.onChanged.addListener(changed);
      // It may already have finished before the listener was added.
      chrome.downloads.search({ id }).then(
        ([item]) => item && finish(item.state),
        () => {},
      );
    });

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
    const filename = ButterDevRecorder.downloadPath(
      round,
      bug,
      new Date(JSON.parse(reply.snapshot).savedAt),
    );
    const id = await chrome.downloads.download({
      url: dataUrl(reply.snapshot),
      filename,
      saveAs: false,
      conflictAction: 'uniquify',
    });
    await chrome.storage.local.set({ [KEY]: { round, bugs: bug } });
    // Once the file is on disk, the tab's dev/toast.js confirms the save on the page.
    completed(id).then((ok) => {
      if (ok)
        chrome.tabs
          .sendMessage(tab.id, { type: 'butter-dev-saved', bug, round }, { frameId: 0 })
          .catch(() => {});
    });
    return { saved: filename, round, bug };
  }

  // One save at a time, so two quick presses get consecutive bug numbers.
  let queue = Promise.resolve();
  const enqueue = (trigger, tab) => {
    const run = queue.then(() => save(trigger, tab));
    queue = run.catch(() => {});
    return run;
  };
  chrome.commands.onCommand.addListener((command, tab) => {
    if (command === 'save-bug') enqueue('shortcut', tab).catch(() => {});
  });
})();
