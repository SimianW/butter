// Helpers for stream-replay-live.mjs: Butter's stored options for one run (OPTS=<json>, put back as
// found afterwards), a fingerprint of the extension's storage to confirm that, and a CDP trace of a
// window of the stream (TRACE_AT=<ms after Enter>). Measurement plumbing only; no verdicts.
import fs from 'node:fs';

async function inPopup(context, extId, fn, arg) {
  const w = await context.newPage();
  try {
    await w.goto(`chrome-extension://${extId}/popup/popup.html`);
    return await w.evaluate(fn, arg);
  } finally { await w.close().catch(() => {}); }
}

// In the extension page: sha256 of local and sync storage (sorted keys), and the key names.
async function fingerprint() {
  const norm = o => JSON.stringify(Object.keys(o).sort().map(k => [k, o[k]]));
  const local = await chrome.storage.local.get(null), sync = await chrome.storage.sync.get(null);
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm(local) + '|' + norm(sync)));
  return { sha256: [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16), localKeys: Object.keys(local).sort(), syncKeys: Object.keys(sync).sort(), opts: local.butter?.opts ?? null };
}

export const storageFingerprint = (context, extId) => inPopup(context, extId, fingerprint);

// Returns { prev, before } to hand to restoreOpts; prev is the whole `butter` value as found.
export async function applyOpts(context, extId, opts) {
  const before = await storageFingerprint(context, extId);
  const prev = await inPopup(context, extId, async () => (await chrome.storage.local.get('butter')).butter ?? null);
  await inPopup(context, extId, async o => { const { butter = {} } = await chrome.storage.local.get('butter'); await chrome.storage.local.set({ butter: { ...butter, opts: { ...butter.opts, ...o } } }); }, opts);
  return { prev, before };
}

export async function restoreOpts(context, extId, saved) {
  await inPopup(context, extId, v => (v == null ? chrome.storage.local.remove('butter') : chrome.storage.local.set({ butter: v })), saved.prev);
  const after = await storageFingerprint(context, extId);
  return { after, same: after.sha256 === saved.before.sha256 };
}

// For the harness: apply OPTS (a JSON string, or empty) and describe the storage as found.
export async function prepareOpts(context, extId, json, summary) {
  const saved = json ? await applyOpts(context, extId, (summary.opts = JSON.parse(json))) : null;
  summary.storage0 = saved ? saved.before : await storageFingerprint(context, extId);
  const s = summary.storage0;
  return { saved, line: `storage before the run: sha256 ${s.sha256}, local keys [${s.localKeys}], sync keys [${s.syncKeys}], opts ${JSON.stringify(s.opts)}; OPTS ${json || 'none'}` };
}
// Puts the options back and returns the REPORT text.
export async function putBack(context, extId, saved, summary) {
  const r = summary.optsRestore = await restoreOpts(context, extId, saved).catch(e => ({ error: String(e.message).slice(0, 200) }));
  return `OPTS put back: ${r.error ? `ERROR ${r.error}` : `sha256 ${r.after.sha256}, same as before ${r.same}, opts ${JSON.stringify(r.after.opts)}`}`;
}

// A devtools.timeline trace (no CPU profiler) on the page's CDP session.
export const TRACE_CATS = ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'disabled-by-default-devtools.timeline.stack', 'v8.execute', 'blink.user_timing'];
export async function startTrace(cdp) {
  const chunks = [];
  const on = ({ value }) => { for (const e of value) chunks.push(e); };
  cdp.on('Tracing.dataCollected', on);
  await cdp.send('Tracing.start', { traceConfig: { includedCategories: TRACE_CATS, excludedCategories: ['*'] }, transferMode: 'ReportEvents' });
  return { chunks, on };
}
// From `at - span/2` to `at + span/2` ms after Enter (el = the caller's elapsed ms); a user-timing
// mark `lab-trace-start` and `performance.now()` at that moment let a reader align the trace.
export function traceWindow(cdp, at, span, file) {
  let t = null, done = false, events = 0, pageStart = null;
  const stop = async () => { events = await stopTrace(cdp, t, file); done = true; };
  return {
    async tick(el) {
      if (done || at == null) return;
      if (!t && el >= at - span / 2) {
        t = await startTrace(cdp);
        pageStart = (await cdp.send('Runtime.evaluate', { expression: 'performance.mark("lab-trace-start"), performance.now()', returnByValue: true })).result.value;
      } else if (t && el >= at + span / 2) await stop();
    },
    async finish() { if (t && !done) await stop(); return { started: !!t, events, pageStart, file: t ? file : null }; },
  };
}
export async function stopTrace(cdp, t, file) {
  const done = new Promise(r => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.end');
  await done;
  cdp.off('Tracing.dataCollected', t.on);
  fs.writeFileSync(file, JSON.stringify({ traceEvents: t.chunks }));
  return t.chunks.length;
}
