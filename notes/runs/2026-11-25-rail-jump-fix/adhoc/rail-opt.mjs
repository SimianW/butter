// Stage 3b of #171, adhoc: seek-pin-live.mjs waits for the rail (chatgpt-butter-nav[data-on]), which
// is off on a new install. MODE=on saves Butter's stored `butter` value as found (to SAVE, outside the
// repo) and sets opts.rail = true; MODE=back puts the saved value back and compares fingerprints.
// On a lock you hold, with the extension already loaded in the lab browser:
// LAB_ID=2 LAB_OWNER=<owner> MODE=on|back SAVE=<json file> node notes/runs/2026-11-25-rail-jump-fix/adhoc/rail-opt.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { applyOpts, restoreOpts, storageFingerprint } from '../../../../lab/harness/stream-run-opts.mjs';

const L = await import(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs'));
const env = process.env, MODE = env.MODE, SAVE = env.SAVE;
if (!env.LAB_OWNER || !SAVE || !['on', 'back'].includes(MODE)) { console.error('LAB_OWNER, SAVE and MODE=on|back are required'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim();
if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
const extDir = L.browserArgs(lab)?.extensions[0];
if (!extDir) { console.error('no extension loaded'); process.exit(2); }
const extId = [...createHash('sha256').update(extDir).digest('hex').slice(0, 32)].map(h => String.fromCharCode(97 + parseInt(h, 16))).join('');
const { browser, context } = await L.connect(lab);
let code = 0;
try {
  if (MODE === 'on') {
    const saved = await applyOpts(context, extId, { rail: true });
    fs.writeFileSync(SAVE, JSON.stringify(saved));
    const now = await storageFingerprint(context, extId);
    console.log(`REPORT before: sha256 ${saved.before.sha256}, opts ${JSON.stringify(saved.before.opts)}; now opts ${JSON.stringify(now.opts)}`);
  } else {
    const saved = JSON.parse(fs.readFileSync(SAVE, 'utf8'));
    const r = await restoreOpts(context, extId, saved);
    console.log(`REPORT put back: sha256 ${r.after.sha256}, same as before ${r.same}, opts ${JSON.stringify(r.after.opts)}`);
    if (!r.same) code = 1;
  }
} finally { await browser.close().catch(() => {}); }
console.log(`EXIT ${code}`);
process.exit(code);
