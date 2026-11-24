// The command keys module's page side (commands/keys.js): the key reader, the key hint and
// aria-keyshortcuts formatters, and the listener for a command the worker relays to this tab.
const test = require('node:test'),
  assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

// The module in a vm whose chrome.runtime answers each request with the next of `answers` (an
// Error is thrown, as a closed port does; a function answers with its result once called).
function page(answers = []) {
  const sent = [],
    listeners = [];
  const ctx = {
    chrome: {
      runtime: {
        sendMessage: async (m) => {
          sent.push(m);
          const a = answers.shift();
          if (a instanceof Error) throw a;
          return typeof a === 'function' ? a() : a;
        },
        onMessage: { addListener: (fn) => listeners.push(fn) },
      },
    },
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(require.resolve('../extension/commands/keys.js'), 'utf8'), ctx);
  // The worker relays a message to this tab: every listener sees it.
  const relay = (message) => listeners.forEach((fn) => fn(message, { id: 'butter' }));
  return { keys: ctx.ButterCommandKeys, sent, relay };
}
const plain = (x) => JSON.parse(JSON.stringify(x));

test('the hint shows the key Chrome reports for the command, and nothing when it has none', () => {
  const { keyHint } = page().keys;
  assert.equal(keyHint('Alt+Shift+Q'), '⌥⇧Q'); // Windows and Linux: names become symbols
  assert.equal(keyHint('Alt+Shift+M'), '⌥⇧M');
  assert.equal(keyHint('⌥⇧Q'), '⌥⇧Q'); // macOS reports symbols, shown as given
  assert.equal(keyHint(''), '');
  assert.equal(keyHint(undefined), '');
  assert.equal(keyHint(null), '');
});

// Chrome names keys as Accelerator::KeyCodeToName does in English: "Up Arrow", "Page Up", "Comma".
test('the hint writes modifiers, Comma, Period and arrows as symbols, other keys as Chrome names them', () => {
  const { keyHint } = page().keys;
  assert.equal(keyHint('Ctrl+Shift+Comma'), '⌃⇧,');
  assert.equal(keyHint('Ctrl+Up Arrow'), '⌃↑');
  assert.equal(keyHint('Alt+Down Arrow'), '⌥↓');
  assert.equal(keyHint('Shift+Left Arrow'), '⇧←');
  assert.equal(keyHint('Shift+Right Arrow'), '⇧→');
  assert.equal(keyHint('Alt+Shift+Up Arrow'), '⌥⇧↑');
  assert.equal(keyHint('MacCtrl+Period'), '⌃.');
  assert.equal(keyHint('Command+Shift+1'), '⌘⇧1');
  assert.equal(keyHint('Search+Shift+Q'), '⌘⇧Q'); // ChromeOS's Search key
  assert.equal(keyHint('Alt+Home'), '⌥Home');
  assert.equal(keyHint('Ctrl+Page Up'), '⌃Page Up');
  assert.equal(keyHint('Media Next Track'), 'Media Next Track'); // a media key, no modifier
});

// Windows and Linux name modifiers in the browser's language, always in Chromium's order (Win or
// Super or Search, Alt, Ctrl, Shift); an extension's key has Ctrl, Alt or Search, never Alt with
// Ctrl or Search, and Shift only beside one of them. A name that is not English is read when only
// one such list fits; otherwise the hint is Chrome's own words, and there is no aria-keyshortcuts.
test("modifiers named in the browser's language read as symbols when only one modifier fits", () => {
  const { keyHint, ariaKeys } = page().keys;
  assert.equal(keyHint('Alt+Umschalttaste+Q'), '⌥⇧Q'); // German: after Alt, only Shift can follow
  assert.equal(ariaKeys('Alt+Umschalttaste+Q'), 'Alt+Shift+Q');
  assert.equal(keyHint('Alt+Maj+Q'), '⌥⇧Q'); // French
  assert.equal(ariaKeys('Alt+Maj+Q'), 'Alt+Shift+Q');
  assert.equal(keyHint('Ctrl+Maj+Comma'), '⌃⇧,');
  assert.equal(keyHint('Strg+Shift+Q'), 'Strg Shift Q'); // Strg could be Alt, Ctrl or Search
  assert.equal(ariaKeys('Strg+Shift+Q'), '');
  assert.equal(keyHint('Strg+Umschalttaste+Q'), 'Strg Umschalttaste Q');
  assert.equal(ariaKeys('Strg+Umschalttaste+Q'), '');
  assert.equal(keyHint('Strg+Q'), 'Strg Q');
  assert.equal(ariaKeys('Strg+Q'), '');
});

// A cell's aria-keyshortcuts (#77): the same key in ARIA's names.
test('aria-keyshortcuts spells the key in ARIA names, and is empty when there is none', () => {
  const { ariaKeys } = page().keys;
  assert.equal(ariaKeys('Alt+Shift+Q'), 'Alt+Shift+Q');
  assert.equal(ariaKeys('⌥⇧Q'), 'Alt+Shift+Q'); // macOS symbols
  assert.equal(ariaKeys('⌥⇧M'), 'Alt+Shift+M');
  assert.equal(ariaKeys('⌃⌘K'), 'Control+Meta+K');
  assert.equal(ariaKeys('Ctrl+Shift+Comma'), 'Control+Shift+,');
  assert.equal(ariaKeys('Command+Period'), 'Meta+.');
  assert.equal(ariaKeys(''), '');
  assert.equal(ariaKeys(undefined), '');
  assert.equal(ariaKeys(null), '');
});

test('aria-keyshortcuts names keys as UI Events does, one shortcut with no spaces', () => {
  const { ariaKeys } = page().keys;
  assert.equal(ariaKeys('Alt+Shift+Up Arrow'), 'Alt+Shift+ArrowUp');
  assert.equal(ariaKeys('⌥⇧↑'), 'Alt+Shift+ArrowUp'); // macOS's arrow
  assert.equal(ariaKeys('Ctrl+Down Arrow'), 'Control+ArrowDown');
  assert.equal(ariaKeys('Ctrl+Left Arrow'), 'Control+ArrowLeft');
  assert.equal(ariaKeys('Ctrl+Right Arrow'), 'Control+ArrowRight');
  assert.equal(ariaKeys('Ctrl+Page Up'), 'Control+PageUp');
  assert.equal(ariaKeys('Ctrl+Page Down'), 'Control+PageDown');
  assert.equal(ariaKeys('⌘⇞'), 'Meta+PageUp');
  assert.equal(ariaKeys('Alt+Space'), 'Alt+Space');
  assert.equal(ariaKeys('Alt+Tab'), 'Alt+Tab');
  assert.equal(ariaKeys('Alt+Home'), 'Alt+Home');
  assert.equal(ariaKeys('⌃↘'), 'Control+End');
  assert.equal(ariaKeys('Alt+Ins'), 'Alt+Insert');
  assert.equal(ariaKeys('Alt+Del'), 'Alt+Delete');
  assert.equal(ariaKeys('Search+Shift+Q'), 'Meta+Shift+Q');
  assert.equal(ariaKeys('Media Next Track'), 'MediaTrackNext');
  assert.equal(ariaKeys('Ctrl+Shift+Bild auf'), 'Control+Shift+Bildauf'); // a key name not in the table
});

test('a key is read from the worker, and a change is reported once', async () => {
  const p = page([{ shortcut: 'Alt+Shift+Q' }, { shortcut: 'Alt+Shift+Q' }, { shortcut: '' }]);
  let changed = 0;
  assert.equal(p.keys.key('branch'), null, 'not read yet');
  await p.keys.read('branch', () => changed++);
  assert.equal(p.keys.key('branch'), 'Alt+Shift+Q');
  await p.keys.read('branch', () => changed++);
  assert.equal(changed, 1, 'the same key again changes nothing');
  await p.keys.read('branch', () => changed++);
  assert.equal(p.keys.key('branch'), '', 'the key was removed');
  assert.equal(changed, 2);
  assert.deepEqual(plain(p.sent[0]), { version: 1, type: 'butter-command-key', command: 'branch' });
});

test('a failed or malformed answer reads as no key', async () => {
  for (const answer of [new Error('port closed'), undefined, { shortcut: 7 }, { error: 'x' }]) {
    const p = page([{ shortcut: 'Alt+Shift+M' }, answer]);
    let changed = 0;
    await p.keys.read('bookmark', () => changed++);
    await p.keys.read('bookmark', () => changed++);
    assert.equal(p.keys.key('bookmark'), '');
    assert.equal(changed, 2);
  }
});

test('keys are kept per command', async () => {
  const p = page([{ shortcut: 'Alt+Shift+M' }, { shortcut: '' }]);
  const changed = [];
  await p.keys.read('bookmark', () => changed.push('bookmark'));
  await p.keys.read('branch', () => changed.push('branch'));
  assert.equal(p.keys.key('bookmark'), 'Alt+Shift+M');
  assert.equal(p.keys.key('branch'), '');
  assert.deepEqual(changed, ['bookmark', 'branch']);
  assert.deepEqual(plain(p.sent.map((m) => m.command)), ['bookmark', 'branch']);
});

test('one read at a time per command; another command reads alongside it', async () => {
  let answer;
  const pending = new Promise((resolve) => (answer = resolve));
  const p = page([() => pending, { shortcut: 'Alt+Shift+M' }]);
  let changed = 0;
  const first = p.keys.read('branch', () => changed++);
  await p.keys.read('branch', () => changed++); // still reading: not asked again
  await p.keys.read('bookmark', () => {});
  assert.deepEqual(plain(p.sent.map((m) => m.command)), ['branch', 'bookmark']);
  answer({ shortcut: 'Alt+Shift+Q' });
  await first;
  assert.equal(changed, 1);
  assert.equal(p.keys.key('branch'), 'Alt+Shift+Q');
});

test('a relayed command reaches its own handler only', () => {
  const p = page();
  const ran = [];
  p.keys.on('bookmark', () => ran.push('bookmark'));
  p.keys.on('branch', () => ran.push('branch'));
  p.relay({ version: 1, type: 'butter-command', command: 'branch' });
  p.relay({ version: 1, type: 'butter-command', command: 'bookmark' });
  p.relay({ version: 2, type: 'butter-command', command: 'branch' }); // another protocol version
  p.relay({ version: 1, type: 'butter-command', command: 'save-bug' });
  p.relay({ version: 1, type: 'butter-branch-claimed', command: 'branch' });
  p.relay(undefined);
  assert.deepEqual(ran, ['branch', 'bookmark']);
});

test('the commands are a closed list', () => {
  assert.deepEqual(plain(page().keys.COMMANDS), ['bookmark', 'branch']);
});
