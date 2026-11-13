// The rail's isolated-world scripts in manifest order, for fixtures that inject the rail into a page
// of their own instead of loading the extension (nav-earlier, nav-takeovers, jump-typing,
// jump-latency): seek's card text and the bookmark rules (its dependencies outside rail/), then
// every script under rail/: its conversations, its wave, the device-pixel grid, the rail model, the turn tracker, the trip,
// the jump, the send pre-jump, the rail's style, its card, and rail/rail.js last. Inject every one, in this order: rail.js reads the
// others' globals.
import fs from 'node:fs';

const ext = new URL('../../extension/', import.meta.url);
const OUTSIDE = ['seek/seek-meta.js', 'bookmarks/model.js'];
const read = () => JSON.parse(fs.readFileSync(new URL('manifest.json', ext), 'utf8'));
// The rail's scripts in `manifest` (extension/manifest.json by default).
export function railScripts(manifest = read()) {
  const scripts = manifest.content_scripts
    .filter((c) => (c.world ?? 'ISOLATED') === 'ISOLATED')
    .flatMap((c) => c.js)
    .filter((f) => OUTSIDE.includes(f) || f.startsWith('rail/'));
  if (OUTSIDE.some((f) => !scripts.includes(f)) || scripts.at(-1) !== 'rail/rail.js')
    throw Error(`the manifest no longer loads ${OUTSIDE.join(', ')} and then rail/, rail.js last`);
  return scripts;
}
export const RAIL_SCRIPTS = railScripts();
// The scripts before rail/rail.js, as source texts.
export const railDeps = () =>
  RAIL_SCRIPTS.slice(0, -1).map((f) => fs.readFileSync(new URL(f, ext), 'utf8'));
