// Runs in the real ChatGPT page. Raw turn keys stay here; saved evidence uses ordinals only.
export function installProbe() {
  if (window.__railJumpLive) return;
  const scroller = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const tracePart = () => {
    let part = null;
    const receive = e => { part = JSON.parse(e.detail); };
    document.addEventListener('butter-dev-rail-snapshot-response', receive, { once: true });
    document.dispatchEvent(new Event('butter-dev-rail-snapshot-request'));
    document.removeEventListener('butter-dev-rail-snapshot-response', receive);
    return part;
  };
  const nativeOrder = () => {
    const t = scroller()?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let depth = 0; f && depth < 80; depth++, f = f.return) {
      if (Array.isArray(f.memoizedProps?.entries) && f.memoizedProps.entries.every(e => typeof e?.turnKey === 'string') && [...scroller().querySelectorAll('[data-turn-key]')].every(el => f.memoizedProps.entries.some(e => e.turnKey === el.dataset.turnKey))) {
        const ids = f.memoizedProps.entries.map(e => e.turnKey);
        let heights = {};
        for (let h = f.memoizedState, i = 0; h && i < 80; h = h.next, i++) {
          const v = h.memoizedState;
          if (v && typeof v === 'object' && !Array.isArray(v) && ids.some(id => typeof v[id] === 'number')) {
            heights = v; break;
          }
        }
        return { ids, heights, shape: f.memoizedProps.RowComponent ? 'entries-RowComponent' : 'entries-with-separate-row-virtualizer' };
      }
    }
    throw Error('ChatGPT virtualizer shape unavailable; refusing to guess target order');
  };
  let ids = [], run = null;
  const scrollerIds = new WeakMap(); let nextScroller = 0;
  const sid = s => { if (!scrollerIds.has(s)) scrollerIds.set(s, ++nextScroller); return scrollerIds.get(s); };
  document.addEventListener('rail-scroll-probe', e => {
    if (!run || run.done) return;
    const entry = JSON.parse(e.detail);
    const turnIndex = entry.subjectTurn ? ids.indexOf(entry.subjectTurn) : null;
    delete entry.subjectTurn;
    run.scrollCalls.push({ ...entry, turnIndex, t: Math.round(entry.at - run.at), tExact: entry.at - run.at, scroller: sid(e.target), at: undefined });
  });
  const known = new Map();
  const remember = () => {
    const s = scroller(), origin = s.getBoundingClientRect().top;
    for (const el of s.querySelectorAll('[data-turn-key]')) {
      const b = el.getBoundingClientRect();
      if (b.height > 0) known.set(el.dataset.turnKey, s.scrollTop + b.top - origin);
    }
  };
  const sample = () => {
    const s = scroller(), part = tracePart(), root = document.querySelector('chatgpt-butter-nav')?.shadowRoot;
    const origin = s.getBoundingClientRect().top;
    const turns = [...s.querySelectorAll('[data-turn-key]')];
    const liveIds = part?.ids ?? nativeOrder().ids;
    const el = turns.find(el => el.dataset.turnKey === run.targetKey);
    const top = el?.getBoundingClientRect().top - origin;
    const warp = root?.querySelector('.warp');
    const sampledAt = performance.now() - run.at;
    return {
      t: Math.round(sampledAt), tExact: sampledAt, scroller: sid(s), animations: s.getAnimations({ subtree: true }).map(a => ({ state: a.playState, time: a.currentTime, properties: a.effect?.getKeyframes().map(k => Object.keys(k).filter(p => !['offset', 'computedOffset', 'easing', 'composite'].includes(p))).flat().filter((v,i,a) => a.indexOf(v) === i) })), y: s.scrollTop, h: s.scrollHeight, vh: s.clientHeight,
      mounted: turns.map(el => liveIds.indexOf(el.dataset.turnKey)).filter(i => i >= 0),
      targetIndex: liveIds.indexOf(run.targetKey),
      targetTop: Number.isFinite(top) ? top : null,
      targetHeight: el?.getBoundingClientRect().height ?? null,
      rail: part?.state ?? null,
      ticks: part?.ticks?.bars.map(b => ({ index: b.index, top: b.tickTop, height: b.tickHeight, width: b.width, opacity: b.opacity })) ?? [],
      placeholder: !!warp && getComputedStyle(warp).visibility !== 'hidden' && Number(getComputedStyle(warp).opacity) > 0,
    };
  };
  document.addEventListener('butter-dev-rail', e => {
    if (!run) return;
    const event = JSON.parse(e.detail);
    // Dev trace fields contain numbers and closed codes, never content or identifiers.
    if (event.type === 'rail-jump' && event.fields.path !== 'repeat') {
      const current = tracePart();
      if (current?.ids) { ids = current.ids; run.targetKey = ids[event.fields.target]; }
    }
    const receivedAt = performance.now();
    run.events.push({ t: Math.round(receivedAt - run.at), tExact: receivedAt - run.at, ...event });
    if (event.type === 'rail-end') { run.endAt = receivedAt; run.end = performance.now(); }
  });
  const frame = () => {
    if (!run || run.done) return;
    const row = sample(); run.frames.push(row);
    if (run.native && !run.end) {
      const previous = run.frames.at(-2);
      if (!previous || Math.abs(row.y - previous.y) > 2 || (row.targetTop == null) !== (previous.targetTop == null)) run.stableSince = performance.now();
      if (row.targetTop != null && performance.now() - (run.stableSince ?? run.at) >= 500) run.end = performance.now();
    }
    if ((run.end && performance.now() - run.end >= 2000) || row.t > 20000) {
      document.dispatchEvent(new Event('rail-probe-stop'));
      run.done = true; run.timedOut = !run.end; return;
    }
    requestAnimationFrame(frame);
  };
  window.__railJumpLive = {
    prepare() {
      const part = tracePart(), native = nativeOrder();
      const next = part?.ids ?? native.ids;
      if (JSON.stringify(next) !== JSON.stringify(ids)) known.clear();
      ids = next;
      remember();
      const s = scroller();
      const container = s.querySelector('div[class*="container-type"][class~="min-h-full"]');
      const seenTurn = s.querySelector('[data-turn-key][data-butter-seen]');
      const seenBlock = s.querySelector('[data-markdown-text-style="assistant-message"] > [data-butter-seen]:not([data-dil-source-message-id]):not([data-wide-block]):not([class*="TableFrame-"]), [class*="DilResponseRoot"] > [data-butter-seen]:not([data-wide-block]):not([class*="TableFrame-"])');
      const streamingStyles = { container: container ? getComputedStyle(container).containerType : null, turn: seenTurn ? getComputedStyle(seenTurn).contentVisibility : null, block: seenBlock ? getComputedStyle(seenBlock).contentVisibility : null, contentAnchor: s.firstElementChild ? getComputedStyle(s.firstElementChild).overflowAnchor : null };
      return { streamingStyles, scrollerStyle: Object.fromEntries(['overflowAnchor','scrollSnapType','scrollBehavior'].map(k => [k,getComputedStyle(scroller())[k]])), off: document.documentElement.getAttribute('data-butter-off'), probe: !!window.__railScrollProbe, questions: ids.length, hasPrev: part?.state?.hasPrev ?? null, height: scroller().scrollHeight,
        mathDisplay: scroller().querySelectorAll('.katex-display').length,
        nativeShape: native.shape, nativeQuestions: native.ids.length, measuredRows: Object.keys(native.heights).length, trace: !!part?.state };
    },
    edge(where) {
      // A real wheel cancels the previous pin before this setup write (the driver sends it).
      const s = scroller(); s.scrollTop = where === 'top' ? 0 : s.scrollHeight;
    },
    remember,
    async calibrate(target) {
      // Native control: find the real row by ordinal, rather than trusting Butter estimates or
      // ChatGPT's private height-hook representation. These setup writes are not measured jumps.
      const s = scroller();
      const goalId = ids[target];
      let lo = 0, hi = s.scrollHeight - s.clientHeight, priorHeight = hi, priorOrder = '';
      for (let round = 0; round < 40; round++) {
        const liveIds = nativeOrder().ids, goal = liveIds.indexOf(goalId);
        const maximum = s.scrollHeight - s.clientHeight, signature = JSON.stringify(liveIds);
        if (signature !== priorOrder || Math.abs(maximum - priorHeight) > s.clientHeight) { lo = 0; hi = maximum; }
        priorOrder = signature; priorHeight = maximum;
        const turns = [...s.querySelectorAll('[data-turn-key]')];
        const el = turns.find(el => el.dataset.turnKey === goalId);
        if (el && el.getBoundingClientRect().height > 0) {
          const position = s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top;
          known.set(goalId, position);
          return { position, rounds: round };
        }
        const mounted = turns.map(el => liveIds.indexOf(el.dataset.turnKey)).filter(i => i >= 0);
        if (round && mounted.length) {
          if (Math.min(...mounted) > goal) hi = s.scrollTop;
          else if (Math.max(...mounted) < goal) lo = s.scrollTop;
        }
        s.scrollTop = (lo + hi) / 2;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      throw Error('native calibration could not mount target');
    },
    position(target) {
      const s = scroller(), id = ids[target];
      const el = [...s.querySelectorAll('[data-turn-key]')].find(el => el.dataset.turnKey === id);
      if (!el) throw Error('source tick not mounted after calibration');
      s.scrollTop = Math.max(0, Math.min(s.scrollHeight-s.clientHeight, s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top - 64));
    },
    start(target, native = false) {
      remember();
      console.timeStamp('rail-cause-start');
      performance.clearMarks('rail-cause-start');
      performance.mark('rail-cause-start');
      run = { target, targetKey: ids[target], native, at: performance.now(), events: [], frames: [], scrollCalls: [], end: null, done: false };
      document.dispatchEvent(new Event('rail-probe-start'));
      run.frames.push(sample()); requestAnimationFrame(frame);
    },
    nativeJump(target) {
      const s = scroller(), order = nativeOrder();
      const id = ids[target];
      const el = [...s.querySelectorAll('[data-turn-key]')].find(el => el.dataset.turnKey === id);
      let position = el ? s.scrollTop + el.getBoundingClientRect().top - s.getBoundingClientRect().top : known.get(id);
      if (position == null) {
        const index = order.ids.indexOf(id);
        if (index < 0 || order.ids.slice(0, index).some(k => !order.heights[k])) throw Error('native target position unavailable');
        position = order.ids.slice(0, index).reduce((sum, k) => sum + order.heights[k], 0);
      }
      run.write = Math.max(0, Math.min(s.scrollHeight - s.clientHeight, position - 64));
      s.scrollTop = run.write;
      run.writeReadback = s.scrollTop;
      run.writeMs = Math.round(performance.now() - run.at);
    },
    done: () => !!run?.done,
    result() {
      const { frames, events, scrollCalls, timedOut, write, target, at, end } = run;
      return { target, frames, events, scrollCalls, timedOut: !!timedOut, nativeWrite: write ?? null,
        nativeWriteReadback: run.writeReadback ?? null, nativeWriteMs: run.writeMs ?? null,
        endExactMs: end == null ? null : (run.endAt ?? end) - at,
        endMs: end == null ? null : Math.round(end - at) };
    },
  };
}

export function classify(result) {
  const click = result.events.find(e => e.type === 'rail-jump' && e.fields.path !== 'repeat');
  const raw = result.frames;
  const before = click ? raw.filter(row => row.t <= click.t).at(-1) ?? raw[0] : raw[0];
  // Arm before the trusted click, but classify only motion beginning at the trace's actual click.
  const f = click ? [{ ...before, t: click.t, y: click.fields.scrollTop }, ...raw.filter(row => row.t > click.t)] : raw;
  const last = f.at(-1), start = f[0].y;
  const finalTarget = last.targetTop == null ? null : last.y + last.targetTop - 64;
  const wanted = finalTarget == null ? null : Math.max(0, Math.min(last.h - last.vh, finalTarget));
  const failed = result.timedOut || wanted == null || last.targetHeight <= 0 || Math.abs(last.y - wanted) > 32;
  const changes = [];
  let previous = f[0], direction = 0;
  const reversals = [];
  for (const row of f.slice(1)) {
    const delta = row.y - previous.y;
    if (Math.abs(delta) <= 2) continue;
    const sign = Math.sign(delta);
    if (direction && sign !== direction) reversals.push({ t: row.t, from: previous.y, to: row.y, placeholder: row.placeholder });
    direction = sign;
    changes.push({ t: row.t, y: row.y, targetTop: row.targetTop, placeholder: row.placeholder });
    previous = row;
  }
  const beyond = wanted == null ? [] : f.filter(row => row.y < Math.min(start, wanted) - row.vh || row.y > Math.max(start, wanted) + row.vh);
  // Visible detours need an excursion between stable positions or a visible loss after mount.
  // A reversal alone can be a masked readiness correction or an ordinary native geometry nudge.
  const losses = []; let mounted = f[0].targetTop != null;
  for (const row of f.slice(1)) {
    if (row.targetTop == null && mounted && !row.placeholder) losses.push({ t: row.t, y: row.y });
    mounted = row.targetTop != null;
  }
  const excursions = [];
  // Turning points of monotone legs: include a gradual multi-frame overshoot, not only
  // single-frame spikes. Include the endpoints as the outer neighbours.
  const significant = [f[0], ...changes.map(c => f.find(r => r.t === c.t))];
  const points = [significant[0]];
  let leg = 0;
  for (let i = 1; i < significant.length; i++) {
    const sign = Math.sign(significant[i].y - significant[i - 1].y);
    if (leg && sign !== leg) points.push(significant[i - 1]);
    leg = sign;
  }
  points.push(last);
  for (let i = 1; i < points.length - 1; i++) {
    const turn = points[i], a = points[i - 1], b = points[i + 1];
    // A masked turning point is seen where the placeholder goes, if that is before the next one.
    const row = turn.placeholder ? f.find(r => r.t > turn.t && r.t <= b.t && !r.placeholder) ?? turn : turn;
    if (!row.placeholder &&(row.y < Math.min(a.y,b.y) - row.vh || row.y > Math.max(a.y,b.y) + row.vh)) excursions.push({ t: row.t, y: row.y });
  }
  const detour = losses.length > 0 || excursions.length > 0;
  const landing = f.find(r => !r.placeholder && r.targetTop != null && Math.abs(r.targetTop - 64) <= 32);
  const afterLanding = landing ? f.filter(r => r.t > landing.t && !r.placeholder && Math.abs(r.y - landing.y) > r.vh) : [];
  const end = result.endMs;
  const landed = f.filter(r => end != null && r.t <= end).at(-1);
  const postCompletion = landed ? f.filter(r => r.t >= end && !r.placeholder && Math.abs(r.y - (result.events.find(e => e.type === 'rail-end')?.fields.scrollTop ?? landed.y)) > r.vh) : [];
  // A position sample at rail-end can still show an earlier move. Count actual recorded
  // transitions strictly after the completion event separately; this never changes the verdict.
  const postEndMoves = [], previousByScroller = new Map();
  const exactEnd = result.endExactMs ?? result.endMs;
  const completionY = result.events.find(e => e.type === 'rail-end')?.fields.scrollTop ?? landed?.y;
  for (const call of result.scrollCalls ?? []) {
    const prior = previousByScroller.get(call.scroller), at = call.tExact ?? call.t;
    if (prior && exactEnd != null && completionY != null && at > exactEnd && call.vh > 0 &&
        Math.abs(call.y - prior.y) > call.vh && Math.abs(call.y - completionY) > call.vh) {
      const visible = f.findLast(row => (row.tExact ?? row.t) <= at) ?? f[0];
      if (!visible.placeholder && visible.scroller === call.scroller)
        postEndMoves.push({ t: call.t, tExact: at, from: prior.y, to: call.y, observedVia: `${call.world}:${call.kind}`, scroller: call.scroller });
    }
    previousByScroller.set(call.scroller, call);
  }
  return { class: failed ? 'failed' : detour ? 'detour' : 'clean', failed, detour, failureReason: !failed ? null : wanted == null || last.targetHeight <= 0 ? 'target-unmounted' : result.timedOut ? 'no-completion' : 'alignment',
    start, final: last.y, targetTop: last.targetTop, wanted,
    reversals, losses, excursions, postEndMoves, afterLanding: afterLanding.slice(0,3).map(r => ({t:r.t,y:r.y})), postCompletion: postCompletion.slice(0,3).map(r => ({t:r.t,y:r.y})), beyond: beyond.slice(0, 3).map(row => ({ t: row.t, y: row.y })), changes,
    maxFrameGapMs: Math.max(0, ...f.slice(1).map((row, i) => row.t - f[i].t)), samples: f.length };
}
