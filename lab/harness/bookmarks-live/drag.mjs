// The native scrollbar drag and the jump probe, as the single script measured them. `drag(arm, n)`
// holds ChatGPT's own scrollbar thumb and moves it through six offsets while it counts turn mounts,
// added nodes, frames, seek updates, Butter's bookmark functions (precise coverage) and the
// worker's storage reads and bookmark messages; it adds one `drags` entry and the `held drag <arm>
// <n>` check. The jump probe records clicks, keys, seek states and the rail and bookmark functions
// a jump calls, into `summary.jumpEvidence[label]`.
// Butter's bookmark work runs in these two scripts: the page side and the bookmark session.
export const BOOKMARK_SCRIPTS = ['/bookmarks/content.js', '/bookmarks/session.js'];
const isBookmarkScript = (url) => BOOKMARK_SCRIPTS.some((name) => url.endsWith(name));
export function liveDrags({ page, worker, cdp, record, xkeys, barGeometry, targetBox, waitLanding, waitSeekSettled }) {
  const { summary } = record;
  const requireThat = (v, label) => {
    if (!v) throw new Error(label);
  };
  async function beginJumpProbe() {
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    await page.evaluate(() => {
      const root = document.querySelector('chatgpt-butter-nav').shadowRoot;
      window.__jumpProbe = { clicks: [], keys: [], seekStates: [] };
      if (window.__jumpProbeInstalled) return;
      window.__jumpProbeInstalled = true;
      document.addEventListener('butter-seek-state', (e) => {
        const m = JSON.parse(e.detail);
        __jumpProbe.seekStates.push({
          state: m.state,
          targetEqualsBookmarkedQuestion: m.id === window.__bookmarkLive.turn,
          pointerHeld: window.__seekDump.held,
        });
      });
      root.addEventListener(
        'click',
        (e) => {
          const el = e.composedPath()[0];
          __jumpProbe.clicks.push({
            control: el.closest('.go') ? 'go' : el.closest('.tick, .more') ? 'mark' : 'other',
            trusted: e.isTrusted,
            detail: e.detail,
          });
        },
        { capture: true },
      );
      root.addEventListener(
        'keydown',
        (e) => {
          if (['Enter', 'ArrowLeft'].includes(e.key))
            __jumpProbe.keys.push({ key: e.key, control: e.target.matches('.tick, .more') ? 'mark' : 'other', trusted: e.isTrusted });
        },
        { capture: true },
      );
    });
  }
  async function endJumpProbe(label) {
    const coverage = (await cdp.send('Profiler.takePreciseCoverage')).result;
    await cdp.send('Profiler.stopPreciseCoverage');
    const calls = {};
    for (const script of coverage) {
      const kind = isBookmarkScript(script.url) ? 'bookmark' : script.url.endsWith('/rail/rail.js') ? 'rail' : null;
      if (!kind) continue;
      for (const f of script.functions)
        if (['locate', 'jump', 'jumpTo', 'earlierJump', 'landOff', 'targetTop', 'glide'].includes(f.functionName))
          calls[`${kind}.${f.functionName}`] = (calls[`${kind}.${f.functionName}`] || 0) + (f.ranges[0]?.count || 0);
    }
    const result = {
      ...(await page.evaluate(() => window.__jumpProbe)),
      calls,
      paragraph: await targetBox(0),
      selection: await targetBox(1),
    };
    summary.jumpEvidence ||= {};
    summary.jumpEvidence[label] = result;
    record.info(`jump ${label}`, result);
  }
  async function startDrag() {
    xkeys('Shift');
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
      s.scrollTop = (s.scrollHeight - s.clientHeight) * 0.55;
    });
    await page.waitForTimeout(2500);
    const b = await barGeometry();
    await page.mouse.move(b.x, b.y);
    await page.mouse.down();
    await page.mouse.move(b.x, Math.min(b.top + b.height - 30, b.y + 60), { steps: 6 });
    await page.waitForTimeout(200);
    requireThat(await page.evaluate(() => window.__seekDump.held), 'native thumb hold not detected');
    return b;
  }
  async function drag(arm, repetition) {
    record.phase = `drag-${arm}-${repetition}`;
    const b = await startDrag();
    await cdp.send('Profiler.enable');
    await cdp.send('Profiler.startPreciseCoverage', { callCount: true, detailed: true });
    await worker.evaluate(() => {
      liveProbe.reads = 0;
      liveProbe.messages = 0;
    });
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find((s) => s.clientHeight > 0);
      window.__liveDrag = { mounts: 0, additions: 0, held: true, frames: [], start: performance.now(), updates: __seekDump().updateCount };
      const state = __liveDrag;
      state.mo = new MutationObserver((rs) => {
        for (const r of rs)
          for (const n of r.addedNodes)
            if (n.nodeType === 1) {
              state.mounts += (n.matches('[data-turn-key]') ? 1 : 0) + n.querySelectorAll('[data-turn-key]').length;
              state.additions += 1 + n.querySelectorAll('*').length;
            }
      });
      state.mo.observe(s, { childList: true, subtree: true });
      let last = performance.now();
      const frame = (t) => {
        if (state.done) return;
        state.frames.push(t - last);
        last = t;
        state.held &&= __seekDump.held;
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });
    for (const offset of [110, 160, 90, 40, 140, 60]) {
      await page.mouse.move(b.x, Math.min(b.top + b.height - 30, b.y + offset), { steps: 5 });
      await page.waitForTimeout(150);
    }
    const observation = await page.evaluate(() => {
      const s = __liveDrag;
      s.done = true;
      s.mo.disconnect();
      const f = s.frames.slice(1).sort((a, b) => a - b);
      return {
        mounts: s.mounts,
        additions: s.additions,
        held: s.held && __seekDump.held,
        updates: __seekDump().updateCount - s.updates,
        frames: f.length,
        p95FrameMs: Math.round((f[Math.floor(f.length * 0.95)] || 0) * 10) / 10,
        maxFrameMs: Math.round((f.at(-1) || 0) * 10) / 10,
      };
    });
    const coverage = (await cdp.send('Profiler.takePreciseCoverage')).result;
    await cdp.send('Profiler.stopPreciseCoverage');
    const critical = ['refresh', 'paragraphs', 'measure', 'selection', 'topBlock', 'locate', 'create', 'remove', 'show', 'place'];
    // One coverage entry per bookmark script: fewer would mean a renamed file escaped the count.
    observation.bookmarkCoverageScripts = coverage.filter((s) => isBookmarkScript(s.url)).length;
    observation.bookmarkFunctionCalls = coverage
      .filter((s) => isBookmarkScript(s.url))
      .flatMap((s) => s.functions)
      .reduce((n, f) => n + (f.ranges[0]?.count || 0), 0);
    observation.bookmarkWork = Object.fromEntries(critical.map((n) => [n, 0]));
    for (const script of coverage.filter((s) => isBookmarkScript(s.url)))
      for (const f of script.functions) if (critical.includes(f.functionName)) observation.bookmarkWork[f.functionName] += f.ranges[0]?.count || 0;
    observation.storage = await worker.evaluate(() => ({ reads: liveProbe.reads, messages: liveProbe.messages }));
    await page.mouse.up();
    await waitSeekSettled();
    await waitLanding();
    summary.drags.push({ arm, repetition, ...observation });
    await record.check(
      `held drag ${arm} ${repetition}`,
      observation.bookmarkCoverageScripts === BOOKMARK_SCRIPTS.length &&
        observation.held &&
        observation.updates > 0 &&
        observation.mounts === 0 &&
        observation.storage.reads === 0 &&
        observation.storage.messages === 0 &&
        Object.values(observation.bookmarkWork).every((n) => n === 0),
      observation,
    );
  }
  return { beginJumpProbe, endJumpProbe, startDrag, drag };
}
