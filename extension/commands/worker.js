// Command keys, worker side (#126). Loaded by the service worker (storage/layout-worker.js) after
// commands/keys.js, whose closed list (ButterCommandKeys.COMMANDS) it serves:
// - a pressed command in the list is relayed to the tab it was pressed in as
//   `{ version: 1, type: 'butter-command', command }`; a tab with no content script to answer
//   (not ChatGPT) rejects it, which is ignored;
// - `{ version: 1, type: 'butter-command-key', command }` from Butter's pages is answered with
//   `{ shortcut }`, the key Chrome reports, '' when the command has none or is not in the list.
// The dev build's `save-bug` command is not in the list: dev/worker.js listens for it itself.
(() => {
  const { COMMANDS } = ButterCommandKeys;
  chrome.commands.onCommand.addListener((command, tab) => {
    if (!COMMANDS.includes(command) || tab?.id == null) return;
    chrome.tabs
      .sendMessage(tab.id, { version: 1, type: 'butter-command', command })
      .catch(() => {});
  });
  const shortcut = async (command) =>
    COMMANDS.includes(command)
      ? ((await chrome.commands.getAll()).find((c) => c.name === command)?.shortcut ?? '')
      : '';
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'butter-command-key') return;
    if (message.version !== 1) {
      respond({ error: 'command-protocol' });
      return;
    }
    shortcut(message.command).then(
      (key) => respond({ shortcut: typeof key === 'string' ? key : '' }),
      () => respond({ shortcut: '' }),
    );
    return true;
  });
})();
