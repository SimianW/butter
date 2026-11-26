// Butter's stored settings in a live lab run. Smoother scrolling (`older` and `seek`) is off on a new
// install, and the update to defaults version 2 switched it off once in every profile, the lab's
// included. A live run that drags the scrollbar or loads earlier pages with Butter switches it on for
// the run through the extension's own page, and puts the stored settings back after, as
// rail-jump-live.mjs does with its options.
import { createHash } from 'node:crypto';

// The id Chromium gives an unpacked extension: the SHA-256 of its path, first 32 hex digits mapped
// to a-p.
export const extensionId = (dir) =>
  [...createHash('sha256').update(dir).digest('hex').slice(0, 32)].map((h) => String.fromCharCode(97 + parseInt(h, 16))).join('');

// Switches `opts` on (default: Smoother scrolling) in the lab browser's Butter, the first extension
// of `lab`'s browser. Returns `restore()`, which puts the stored settings back and resolves to
// whether they read the same as before, or null when the browser has no extension. Waits up to 5 s
// for the install or update event's own settings write (its marker, defaults version 2), so that
// write cannot land over this one; a build without the marker just waits.
export async function switchOn(L, lab, context, opts = { older: true, seek: true }) {
  const dir = L.browserArgs(lab)?.extensions?.[0];
  if (!dir) return null;
  const url = `chrome-extension://${extensionId(dir)}/popup/popup.html`;
  const inExtension = async (fn, arg) => {
    const page = await context.newPage();
    try {
      await page.goto(url);
      return await page.evaluate(fn, arg);
    } finally {
      await page.close().catch(() => {});
    }
  };
  const previous = await inExtension(async (opts) => {
    for (let i = 0; i < 100 && !((await chrome.storage.local.get('butter')).butter?.defaultsVersion >= 2); i++) await new Promise((r) => setTimeout(r, 50));
    const { butter } = await chrome.storage.local.get('butter');
    await chrome.storage.local.set({ butter: { ...butter, opts: { ...butter?.opts, ...opts } } });
    return butter ?? null;
  }, opts);
  console.log(`REPORT options switched on for the run: ${JSON.stringify(opts)}`);
  return async () => {
    const same = await inExtension(async (value) => {
      await (value == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: value }));
      return JSON.stringify((await chrome.storage.local.get('butter')).butter ?? null) === JSON.stringify(value);
    }, previous).catch(() => false);
    console.log(`REPORT options put back: same as before ${same}`);
    return same;
  };
}
