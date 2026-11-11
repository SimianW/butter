// The rail's isolated-world scripts in manifest order, for fixtures that inject the rail into a page
// of their own instead of loading the extension (nav-earlier, nav-takeovers, jump-typing,
// jump-latency): seek's card text, the bookmark rules, the rail model, its conversations and its wave, then
// rail/rail.js. Inject every one, in this order: rail.js reads the others' globals.
import fs from 'node:fs';

const ext = new URL('../../extension/', import.meta.url);
const RAIL = [
  'seek/seek-meta.js',
  'bookmarks/model.js',
  'rail/conversations.js',
  'rail/wave.js',
  'rail/model.js',
  'rail/rail.js',
];
const manifest = JSON.parse(fs.readFileSync(new URL('manifest.json', ext), 'utf8'));
export const RAIL_SCRIPTS = manifest.content_scripts[0].js.filter((f) => RAIL.includes(f));
if (RAIL_SCRIPTS.length !== RAIL.length || RAIL_SCRIPTS.at(-1) !== 'rail/rail.js')
  throw Error(`the manifest no longer loads the rail as ${RAIL.join(', ')}`);
// The scripts before rail/rail.js, as source texts.
export const railDeps = () =>
  RAIL_SCRIPTS.slice(0, -1).map((f) => fs.readFileSync(new URL(f, ext), 'utf8'));
