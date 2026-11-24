// Command keys (#126): Butter's Chrome commands, the keys a reader presses and can rebind in
// Chrome's shortcut settings. Loaded twice: as a content script (ISOLATED world), where it is the
// page side, and by the service worker (storage/layout-worker.js) for the closed list, which
// commands/worker.js relays. Version-1 messages (docs/runtime-api.md, "Command keys"):
// - worker → tab: `{ version: 1, type: 'butter-command', command }` when the command's key is
//   pressed in that tab; `on(command, fn)` runs `fn` for it;
// - page → worker: `{ version: 1, type: 'butter-command-key', command }` → `{ shortcut }`, the key
//   Chrome reports ('' for none), since content scripts can't read chrome.commands.
// A new command is one entry in COMMANDS, its manifest entry and its handler (`on`).
(() => {
  const COMMANDS = Object.freeze(['bookmark', 'branch']);

  // A cell's key hint, from chrome.commands' `shortcut`: "Alt+Shift+Q" reads "Alt Shift Q", as the
  // mockup writes keys; macOS reports symbols ("⌥⇧Q"), shown as given; no key, no hint.
  const keyHint = (shortcut) => (typeof shortcut === 'string' ? shortcut.split('+').join(' ') : '');
  // The same key for a cell's aria-keyshortcuts (#77), in ARIA's key names: macOS's symbols and
  // Chrome's modifier and key names spelled out.
  const ARIA = {
    '⌥': 'Alt',
    '⇧': 'Shift',
    '⌃': 'Control',
    '⌘': 'Meta',
    Ctrl: 'Control',
    MacCtrl: 'Control',
    Command: 'Meta',
    Comma: ',',
    Period: '.',
  };
  const ariaKeys = (shortcut) =>
    typeof shortcut === 'string' && shortcut
      ? (shortcut.includes('+') ? shortcut.split('+') : shortcut.match(/[⌥⇧⌃⌘]|[^⌥⇧⌃⌘]+/g))
          .map((k) => ARIA[k] ?? k)
          .join('+')
      : '';

  // The last key read per command (null until read), and the commands being read now.
  const keys = new Map(),
    reading = new Set();
  // Read `command`'s key again (the reader may rebind it in Chrome's settings at any time), one
  // read at a time per command; `changed()` runs when it differs from the last read. A failed or
  // malformed answer reads as no key.
  async function read(command, changed) {
    if (reading.has(command)) return;
    reading.add(command);
    let next = '';
    try {
      const r = await chrome.runtime.sendMessage({
        version: 1,
        type: 'butter-command-key',
        command,
      });
      next = typeof r?.shortcut === 'string' ? r.shortcut : '';
    } catch {}
    reading.delete(command);
    if (next === keys.get(command)) return;
    keys.set(command, next);
    changed();
  }

  // `fn()` runs each time the worker relays `command` to this tab.
  const on = (command, fn) =>
    chrome.runtime.onMessage.addListener((m) => {
      if (m?.type === 'butter-command' && m.version === 1 && m.command === command) fn();
    });

  globalThis.ButterCommandKeys = {
    COMMANDS,
    keyHint,
    ariaKeys,
    key: (command) => keys.get(command) ?? null,
    read,
    on,
  };
})();
