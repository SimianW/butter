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

  // chrome.commands' `shortcut` read as `{ modifiers, key }` (modifiers as 'meta', 'alt', 'ctrl',
  // 'shift'), as Accelerator::GetShortcutText writes it. macOS: the glyphs ⌃⌥⇧⌘, then the key, run
  // together. Windows, Linux and ChromeOS: modifier names in the browser's language, always in the
  // order Win/Super/Search, Alt, Ctrl, Shift, then the key, joined by '+'. An English name is read
  // as is; any other is read only when one list in FITS has that role there. Otherwise `words`:
  // the names can't be told apart without guessing ("Strg+Umschalttaste+Q"). Media keys have none.
  const MODIFIER = {
    Alt: 'alt',
    Ctrl: 'ctrl',
    MacCtrl: 'ctrl',
    Shift: 'shift',
    Command: 'meta',
    Search: 'meta',
    Super: 'meta',
    Win: 'meta',
    Windows: 'meta',
  };
  const GLYPH = { '⌃': 'ctrl', '⌥': 'alt', '⇧': 'shift', '⌘': 'meta' };
  // The modifiers an extension's key can have, in Chrome's order: Ctrl, Alt or (ChromeOS) Search;
  // never Alt with Ctrl or Search; Shift only beside one of them (ui::Command::ParseImpl, and
  // cr-shortcut-input on chrome://extensions/shortcuts).
  const FITS = [
    'alt',
    'alt shift',
    'ctrl',
    'ctrl shift',
    'meta',
    'meta ctrl',
    'meta shift',
    'meta ctrl shift',
  ].map((f) => f.split(' '));
  function parse(shortcut) {
    if (typeof shortcut !== 'string' || !shortcut) return null;
    if (!shortcut.includes('+')) {
      const glyphs = shortcut.match(/^[⌃⌥⇧⌘]*/)[0];
      return { modifiers: [...glyphs].map((g) => GLYPH[g]), key: shortcut.slice(glyphs.length) };
    }
    const names = shortcut.split('+'),
      key = names.pop(),
      read = names.map((n) => MODIFIER[n]);
    if (!read.includes(undefined)) return { modifiers: read, key };
    const fits = FITS.filter(
      (f) =>
        f.length === read.length &&
        f.every((role, i) => (read[i] ? read[i] === role : !read.includes(role))),
    );
    return fits.length === 1 ? { modifiers: fits[0], key } : { words: true };
  }

  // A cell's key hint, in key symbols run together: "Alt+Shift+Q" reads "⌥⇧Q", macOS's symbols as
  // given; arrows, Comma and Period as symbols, other keys (letters, Home, Page Up, media keys…) by
  // Chrome's name. Modifiers that can't be read show Chrome's words ("Strg Umschalttaste Q").
  const HINT = { meta: '⌘', alt: '⌥', ctrl: '⌃', shift: '⇧' };
  const HINT_KEY = {
    'Up Arrow': '↑',
    'Down Arrow': '↓',
    'Left Arrow': '←',
    'Right Arrow': '→',
    Comma: ',',
    Period: '.',
  };
  function keyHint(shortcut) {
    const k = parse(shortcut);
    if (!k) return '';
    if (k.words) return shortcut.split('+').join(' ');
    if (!shortcut.includes('+')) return shortcut;
    return k.modifiers.map((m) => HINT[m]).join('') + (HINT_KEY[k.key] ?? k.key);
  }
  // The same key for a cell's aria-keyshortcuts (#77), in ARIA's modifier names and UI Events' key
  // names; a key name not listed loses its spaces, so the value stays one shortcut. None ('') when
  // the modifiers can't be read.
  const ARIA = { meta: 'Meta', alt: 'Alt', ctrl: 'Control', shift: 'Shift' };
  const ARIA_KEY = {
    'Up Arrow': 'ArrowUp',
    'Down Arrow': 'ArrowDown',
    'Left Arrow': 'ArrowLeft',
    'Right Arrow': 'ArrowRight',
    '↑': 'ArrowUp',
    '↓': 'ArrowDown',
    '←': 'ArrowLeft',
    '→': 'ArrowRight',
    'Page Up': 'PageUp',
    'Page Down': 'PageDown',
    '⇞': 'PageUp',
    '⇟': 'PageDown',
    '↖': 'Home',
    '↗': 'Home',
    '↘': 'End',
    '↙': 'End',
    '⇥': 'Tab',
    Comma: ',',
    Period: '.',
    Ins: 'Insert',
    Del: 'Delete',
    Esc: 'Escape',
    'Media Next Track': 'MediaTrackNext',
    'Media Previous Track': 'MediaTrackPrevious',
    'Media Play/Pause': 'MediaPlayPause',
    'Media Stop': 'MediaStop',
  };
  function ariaKeys(shortcut) {
    const k = parse(shortcut);
    if (!k || k.words) return '';
    return [...k.modifiers.map((m) => ARIA[m]), ARIA_KEY[k.key] ?? k.key.replace(/\s+/g, '')].join(
      '+',
    );
  }

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
