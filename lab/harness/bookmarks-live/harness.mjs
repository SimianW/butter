// A bookmarks-live run on the shared runner (../runner/index.mjs). Unlike a fixture QA, a live
// scenario starts from where the ones before it left the chat and the store: `start` only names
// the phase, and each scenario's `precondition(t)` says what it needs (needs.mjs). An unmet one is
// skipped with its reason, which also goes to the summary's `skipped`.
//
// The runner writes no summary here: record.mjs writes it, as the last cleanup, so that it holds
// the cleanup's results; `report()` is empty, so the run's evidence arrays (`drags`, `wash`) don't
// count as errors. A throw goes through `record.onThrow` (its stack to a private file only).
import { createHash } from 'node:crypto';
import { runScenarios } from '../runner/index.mjs';
import { liveDrags } from './drag.mjs';
import { liveEarlier } from './earlier.mjs';
import { launchLive } from './lab.mjs';
import { livePage } from './page.mjs';

// Runs `scenarios` with `launch(defer)` building what they drive (`liveLauncher`, or a test's fake).
// In a full run (`full`: no ONLY), a skip means an earlier scenario left the chat or the store
// short, so it fails the run, as the old script's throw did; only a reason marked `expected` (the
// fixture lacks what the scenario needs: list-item's top-level list) lets the run pass.
export async function runLive({ scenarios, record, launch, verbose, full = !process.env.ONLY }) {
  const failingSkips = [];
  const noted = (s) =>
    s.precondition
      ? {
          ...s,
          precondition: async (t) => {
            const unmet = await s.precondition(t);
            const why = unmet?.why ?? unmet;
            if (why) record.skip(s.name, why);
            if (why && full && !unmet.expected) failingSkips.push(s.name);
            return why;
          },
        }
      : s;
  let t = null;
  const ok = await runScenarios({
    scenarios: scenarios.map(noted),
    summary: null,
    verbose,
    onThrow: async (e, name) => {
      // A throw with the scrollbar thumb held must not leave the button down for the next scenario.
      await Promise.resolve()
        .then(() => t?.page?.mouse.up())
        .catch(() => {});
      return record.onThrow(e, name);
    },
    setup: async (defer) => {
      // Registered first, so it runs last: after the lab is restored and released.
      defer(() => record.cleanup('summary', record.finish));
      t = await launch(defer);
      return { start: (scenario, check) => record.start(scenario, check, t), report: () => ({}) };
    },
  });
  if (failingSkips.length) console.log(`FAIL: a full run skipped ${failingSkips.join(', ')}`);
  return ok && !failingSkips.length;
}

// Consumes only successful conversation API responses already requested by ChatGPT, for the
// matrix's message-id check, and counts the earlier-history pages loaded. Raw response data never
// leaves this callback; only SHA-256 digests survive in memory.
function watchApi(page) {
  const net = { earlierPages: 0, apiPages: 0, apiHashes: new Set(), apiPending: new Set() };
  page.on('response', (r) => {
    const u = new URL(r.url());
    if (/\/messages$/.test(u.pathname) && u.searchParams.has('before') && r.ok()) net.earlierPages++;
    if (r.request().method() !== 'GET' || !r.ok() || !/\/backend-api\/conversations?\/[0-9a-f-]{36}(?:\/messages)?$/.test(u.pathname)) return;
    const pending = (async () => {
      const data = await r.json();
      const messages = data.messages || Object.values(data.mapping || {}).map((n) => n.message);
      for (const m of messages) if (m?.author?.role === 'assistant' && m.id) net.apiHashes.add(createHash('sha256').update(m.id).digest('hex'));
      net.apiPages++;
    })().catch(() => {});
    net.apiPending.add(pending);
    pending.finally(() => net.apiPending.delete(pending));
  });
  return net;
}

// The live lab's `launch` for `mode`: the lab (lab.mjs), then what the scenarios drive: the page
// helpers with the Butter driver (`butter`), the drags and jump probe, the earlier-history checks,
// and per mode the API watcher (matrix: `net`) or the wash's settings and its closing reload.
export const liveLauncher =
  ({ L, mode, source, fixture, record }) =>
  async (defer) => {
    const live = await launchLive({ L, mode, source, fixture, record, defer });
    const kit = livePage({ ...live, record, fixture });
    const t = { ...live, ...kit, ...liveDrags({ ...live, ...kit, record }), ...liveEarlier({ page: live.page, record }) };
    if (mode === 'wash') {
      await live.worker.evaluate(() =>
        chrome.storage.local.set({
          butter: { enabled: true, lang: 'en', layoutConsent: 'declined', bookmarkNotice: 'acknowledged' },
        }),
      );
      // The theme attribute lives in the page only: a load puts ChatGPT's own theme back.
      defer(() =>
        record.cleanup('wash-end', async () => {
          record.phase = 'wash-end';
          await kit.open().catch(() => {});
        }),
      );
    } else t.net = watchApi(live.page);
    return t;
  };
