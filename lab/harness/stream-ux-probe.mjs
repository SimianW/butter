// Stage 5 of the Smoother streaming long-frame work (2026-11-24 stream ux), for
// stream-replay-live.mjs: what a user sees around the end of a streamed answer. Measurement only:
// REPORT lines, never a verdict; structure only (block indexes, px, flags), no chat text leaves the page.
//
// UX=<list> (u1,u2,u3,u4; empty = off). From 8 s before the replay's last chunk, every animation
// frame samples scrollTop, scrollHeight, <html>'s data-butter-hydrated / -hydrate-pending and, at
// 7 points down the view's centre column (the last answer's column centre), the answer block under
// the point (elementFromPoint; its index in the last turn, its rect top, data-butter-veil /
// -unrendered / -measure, computed opacity 0, content skipped). "Completion" (gone) is the first
// frame without [data-talvt-turn-state="in_progress"] after one with it; sampling ends 16 s later.
// - u1: in the first task after that frame, scrollTop = scrollHeight (the harness's toEnd).
// - u2: 2 s after it, a scrollTop write puts a block that still has data-butter-unrendered nearest
//   the answer's middle (or block U2_BLOCK) 40 px above the view's centre.
// - u3: in the first task after it, the answer's start goes to 60 px below the view's top; then one
//   wheel notch (100 px) down every 100 ms for 12 s (Playwright mouse.wheel). Per notch, at the
//   next notch: scrollTop's change, and the centre block's move (doc: rect move + scrollTop
//   change; visual: rect move + 100).
// - u4 (after sampling): (a) window.find of a 12-24 character string found once in the page, taken
//   from a held block (data-butter-unrendered, veiled where any is) in the last 30% of the answer;
//   (c) scrollIntoView({block: 'center'}) on another such block; for both, up to 90 frames: in
//   view, veil, opacity, content rendered; (b) selectAllChildren(last turn): toString().length
//   against the turn's innerText.length. The string never leaves the page; only its length does.
// Settle rule (u1, u2): the first frame at least 100 ms after the write; its centre block is the
// anchor whose rect top is then followed every frame (a new anchor when it disconnects).

const r1 = v => Math.round(v * 10) / 10;
const pause = ms => new Promise(r => setTimeout(r, ms));

// In the page. Self-contained.
function installUx(cfg) {
  if (window.__ux) return;
  const COLUMN = '[data-markdown-text-style="assistant-message"]';
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const BLOCKS = `${COLUMN} > :not([data-dil-source-message-id])${KEEP}, ${COLUMN} [class*="DilResponseRoot"] > ${KEEP}`;
  const IP = '[data-talvt-turn-state="in_progress"]';
  const now = () => performance.now(), q1 = v => Math.round(v * 10) / 10;
  const sc = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
  const lastTurn = () => { const t = sc()?.querySelectorAll('[data-turn-key]'); return t?.[t.length - 1] ?? null; };
  const U = (window.__ux = { cfg, frames: [], post: [], acts: [], steps: [], anchors: [], gone: null, lastIp: null, on: false, sampled: false, u3Ready: false, startAt: null, enter: null, err: [] });
  let list = [], idx = new Map();
  const other = new WeakSet(), evSkip = new WeakSet();
  const reindex = () => { const t = lastTurn(); list = t ? [...t.querySelectorAll(BLOCKS)] : []; idx = new Map(list.map((b, i) => [b, i])); };
  const blockOf = e => { for (; e && e !== document.body; e = e.parentElement) if (e.parentElement?.matches(`${COLUMN}, [class*="DilResponseRoot"]`) && !e.matches('[data-dil-source-message-id]')) return e; return null; };
  const indexOf = b => { if (idx.has(b)) return idx.get(b); if (other.has(b)) return -2; reindex(); if (idx.has(b)) return idx.get(b); other.add(b); return -2; };
  document.addEventListener('contentvisibilityautostatechange', e => { if (e.skipped) evSkip.add(e.target); else evSkip.delete(e.target); }, true);
  // flags: 1 veil, 2 opacity 0, 4 content skipped, 8 unrendered, 16 measure
  const flags = b => {
    const cs = getComputedStyle(b), c = b.firstElementChild, auto = cs.contentVisibility === 'auto';
    const skip = auto && (c ? !c.checkVisibility({ contentVisibilityAuto: true }) : evSkip.has(b));
    return (b.hasAttribute('data-butter-veil') ? 1 : 0) | (cs.opacity === '0' ? 2 : 0) | (skip ? 4 : 0) | (b.hasAttribute('data-butter-unrendered') ? 8 : 0) | (b.hasAttribute('data-butter-measure') ? 16 : 0);
  };
  const geom = () => {
    const s = sc(); if (!s) return null;
    const r = s.getBoundingClientRect(), col = lastTurn()?.querySelector(COLUMN)?.getBoundingClientRect();
    return { s, r, x: col && col.width > 0 ? col.left + col.width / 2 : r.left + r.width / 2 };
  };
  const point = (g, k) => { const b = blockOf(document.elementFromPoint(g.x, g.r.top + (g.s.clientHeight * (k + 0.5)) / 7)); return b ? { b, i: indexOf(b), top: b.getBoundingClientRect().top } : null; };
  const centre = g => { for (const k of [3, 2, 4, 1, 5, 0, 6]) { const p = point(g, k); if (p) return { ...p, k }; } return null; };
  const inView = (b, g) => { const br = b.getBoundingClientRect(); return br.bottom > g.r.top && br.top < g.r.bottom; };
  const num = n => { const h = document.documentElement; return h.hasAttribute(n) ? Number(h.getAttribute(n)) : null; };
  let anchor = null;
  const pickAnchor = (g, why) => { const c = centre(g); anchor = c?.b ?? null; U.anchors.push({ t: q1(now()), why, i: c?.i ?? null, k: c?.k ?? null, top: c ? q1(c.top) : null }); };
  const frame = () => {
    if (!U.on) return;
    try {
      const t = now(), g = geom();
      const ip = !!document.querySelector(IP);
      if (ip) U.lastIp = t;
      else if (U.lastIp != null && U.gone == null) { U.gone = t; onGone(); }
      if (g) {
        if (U.settleAt != null && t >= U.settleAt && U.settle == null) { U.settle = { t: q1(t), n: U.frames.length }; pickAnchor(g, 'settle'); }
        if (anchor && !anchor.isConnected) pickAnchor(g, 'lost');
        const pts = [];
        for (let k = 0; k < 7; k++) { const p = point(g, k); pts.push(p ? [p.i, q1(p.top), flags(p.b)] : null); }
        U.frames.push([q1(t), q1(g.s.scrollTop), g.s.scrollHeight, num('data-butter-hydrate-pending'), num('data-butter-hydrated'), ip ? 1 : 0, anchor ? q1(anchor.getBoundingClientRect().top) : null, pts]);
        // After this frame's rendering update (what was painted): scrollTop and the anchor's top.
        const mc = new MessageChannel(), a0 = anchor;
        mc.port1.onmessage = () => U.post.push([q1(t), q1(now()), q1(g.s.scrollTop), a0?.isConnected ? q1(a0.getBoundingClientRect().top) : null]);
        mc.port2.postMessage(0);
      }
    } catch (e) { if (U.err.length < 5) U.err.push(String(e.message).slice(0, 120)); }
    if (U.gone != null && now() > U.gone + cfg.sampleMs) { U.on = false; U.sampled = true; U.endState = endState(); return; }
    if (U.lastIp == null && now() > U.startAt + 60000) { U.on = false; U.sampled = true; U.err.push('no in_progress seen'); return; }
    requestAnimationFrame(frame);
  };
  const endState = () => {
    const g = geom(); if (!g) return null;
    reindex();
    const lastB = list.at(-1), c = centre(g);
    return { lastBlock: list.length - 1, lastBlockInView: lastB ? inView(lastB, g) : null, centre: c?.i ?? null, fromEnd: Math.round(g.s.scrollHeight - g.s.clientHeight - g.s.scrollTop) };
  };
  const act = (kind, fn) => {
    const g = geom(), y0 = g.s.scrollTop, t = now();
    let info = null;
    try { info = fn(g); } catch (e) { info = { error: String(e.message).slice(0, 120) }; }
    U.acts.push({ kind, t: q1(t), sinceGone: q1(t - U.gone), y0: q1(y0), y1: q1(g.s.scrollTop), H: g.s.scrollHeight, info });
    if (kind !== 'start') U.settleAt = t + 100;
    return info;
  };
  const toEnd = g => { g.s.scrollTop = g.s.scrollHeight; return null; };
  const toMid = g => {
    reindex();
    const n = list.length, mid = n >> 1;
    let i = cfg.u2Block;
    if (i == null) list.forEach((b, j) => { if (b.hasAttribute('data-butter-unrendered') && (i == null || Math.abs(j - mid) < Math.abs(i - mid))) i = j; });
    i ??= mid;
    const b = list[i], br = b.getBoundingClientRect();
    const around = list.slice(Math.max(0, i - 10), i + 11);
    g.s.scrollTop = Math.round(g.s.scrollTop + br.top - g.r.top - g.s.clientHeight / 2 + 40);
    return { block: i, of: n, flags: flags(b), unrenderedAround: around.filter(x => x.hasAttribute('data-butter-unrendered')).length, around: around.length };
  };
  const toStart = g => { const col = lastTurn().querySelector(COLUMN); g.s.scrollTop = Math.round(g.s.scrollTop + col.getBoundingClientRect().top - g.r.top - 60); return null; };
  const onGone = () => {
    const m = cfg.mode;
    if (m.includes('u1')) setTimeout(() => act('end', toEnd), 0);
    if (m.includes('u3')) setTimeout(() => { act('start', toStart); U.u3Ready = true; }, 0);
    if (m.includes('u2')) setTimeout(() => act('mid', toMid), 2000);
  };
  // u3: one step per wheel event, closed by the next (or by closeStep).
  let pend = null;
  const close = t => {
    if (!pend) return;
    const s = sc(), p = pend; pend = null;
    if (!p.c) { U.steps.push({ t: q1(p.t), dt: q1(t - p.t), none: true }); return; }
    const lost = !p.c.b.isConnected, dTop = lost ? null : p.c.b.getBoundingClientRect().top - p.c.top, dY = s.scrollTop - p.y;
    U.steps.push({ t: q1(p.t), dt: q1(t - p.t), i: p.c.i, dy: p.dy, dY: q1(dY), doc: lost ? null : q1(dTop + dY), visual: lost ? null : q1(dTop + p.dy), lost });
  };
  addEventListener('wheel', e => {
    if (!U.wheelOn) return;
    const t = now(); close(t);
    const g = geom();
    pend = { t, y: g.s.scrollTop, dy: e.deltaY, c: centre(g) };
  }, { capture: true, passive: true });
  U.closeStep = () => { close(now()); U.wheelOn = false; return U.steps.length; };
  U.wheelStart = () => { U.wheelOn = true; const g = geom(); return { x: Math.round(g.x), y: Math.round(g.r.top + g.s.clientHeight / 2) }; };
  // u4
  const raf = () => new Promise(r => requestAnimationFrame(() => r()));
  const watch = async (b, t0) => {
    const rows = [];
    for (let n = 1; n <= 90; n++) {
      await raf();
      const g = geom(), f = flags(b);
      rows.push({ n, t: q1(now() - t0), y: q1(g.s.scrollTop), top: q1(b.getBoundingClientRect().top - g.r.top), inView: inView(b, g), f, ok: !(f & 7) });
    }
    const firstOk = rows.find(r => r.ok && r.inView), firstIn = rows.find(r => r.inView), firstUnveiled = rows.find(r => r.ok);
    const fr = r => (r ? { n: r.n, t: r.t } : null);
    return { firstInView: fr(firstIn), firstOk: fr(firstOk), firstUnveiled: fr(firstUnveiled), topFirstInView: firstIn?.top ?? null, end: rows.at(-1), rows };
  };
  const held = () => {
    reindex();
    const n = list.length, deep = list.map((b, i) => [b, i]).filter(([b, i]) => i >= Math.floor(n * 0.7) && b.hasAttribute('data-butter-unrendered'));
    const veiled = deep.filter(([b]) => b.hasAttribute('data-butter-veil'));
    return { n, list: veiled.length ? veiled : deep, veiledAny: veiled.length > 0 };
  };
  const unique = b => {
    const all = document.body.textContent.toLowerCase();
    const count = s => { let c = 0; for (let i = all.indexOf(s); i >= 0 && c < 3; i = all.indexOf(s, i + 1)) c++; return c; };
    for (const run of (b.textContent.match(/[A-Za-z][A-Za-z ,]{15,}/g) || []).sort((x, y) => y.length - x.length)) {
      for (let o = 0; o + 12 <= run.length; o += 7) {
        const s = run.slice(o, o + 24).replace(/^[ ,]+|[ ,]+$/g, '').replace(/ {2,}/g, ' ');
        if (s.length >= 12 && count(s.toLowerCase()) === 1) return s;
      }
    }
    return null;
  };
  U.u4 = async () => {
    const out = {};
    document.activeElement?.blur?.();
    const sel = getSelection();
    sel.removeAllRanges();
    const h = held();
    out.held = { blocks: h.n, candidates: h.list.length, veiledAny: h.veiledAny };
    let a = null, str = null;
    for (const [b, i] of h.list) { str = unique(b); if (str) { a = { b, i }; break; } }
    if (a) {
      const g = geom(), y0 = g.s.scrollTop, f0 = flags(a.b), t0 = now();
      const found = window.find(str, false, false, true, false, false, false);
      const ms = q1(now() - t0), y1 = g.s.scrollTop;
      const selIn = sel.rangeCount ? a.b.contains(sel.getRangeAt(0).commonAncestorContainer) : false;
      out.find = { block: a.i, len: str.length, found, callMs: ms, selectionInBlock: selIn, flagsBefore: f0, y0: q1(y0), yAfterCall: q1(y1), ...(await watch(a.b, t0)) };
      sel.removeAllRanges();
    } else out.find = { none: true };
    await raf();
    const c = h.list.find(([b, i]) => (!a || Math.abs(i - a.i) >= 10) && b.hasAttribute('data-butter-unrendered'));
    if (c) {
      const g = geom(), y0 = g.s.scrollTop, f0 = flags(c[0]), t0 = now();
      c[0].scrollIntoView({ block: 'center' });
      out.intoView = { block: c[1], flagsBefore: f0, y0: q1(y0), yAfterCall: q1(g.s.scrollTop), ...(await watch(c[0], t0)) };
    } else out.intoView = { none: true };
    await raf();
    const t = lastTurn(), veil0 = t.querySelectorAll('[data-butter-veil]').length;
    let t0 = now();
    sel.selectAllChildren(t);
    const selLen = sel.toString().length, selMs = q1(now() - t0);
    sel.removeAllRanges();
    t0 = now();
    const inner = t.innerText.length, innerMs = q1(now() - t0);
    await raf(); await raf();
    out.select = { selLen, selMs, innerLen: inner, innerMs, innerLen2: t.innerText.length, equal: selLen === inner, textLen: t.textContent.length, veiledBefore: veil0, veiledAfter: t.querySelectorAll('[data-butter-veil]').length };
    return out;
  };
  // Start the frame sampler 8 s before the replay's last chunk (polled every 250 ms until then).
  const poll = setInterval(() => {
    const R = window.__replay;
    if (!R?.started || now() < R.started + cfg.schedEnd - 8000) return;
    clearInterval(poll);
    U.startAt = now(); U.on = true; U.enter = window.__lafProbe?.enter ?? R.started;
    requestAnimationFrame(frame);
  }, 250);
}

// The harness's stream-no-jump rule for one sample: scrollTop fell by more than a viewport since the
// last sample. uxActs (window.__ux.acts.length; 0 without UX) > 0: the probe has written scrollTop
// itself (u1, u2, u3), so the harness stops counting.
export const isStreamDrop = (lastY, s, uxActs = 0) => !uxActs && lastY != null && !!s && lastY - s.y > s.vh;

async function waitFor(page, fn, ms) {
  for (const t0 = Date.now(); Date.now() - t0 < ms; await pause(50)) if (await page.evaluate(fn).catch(() => false)) return true;
  return false;
}

// The node side: u3's wheel notches and u4, concurrently with the harness's loop.
async function drive(page, mode, env) {
  const out = {};
  const limit = Number(env.UX_WAIT || 200000);
  if (mode.includes('u3')) {
    if (!(await waitFor(page, () => window.__ux.u3Ready || window.__ux.sampled, limit))) return { ...out, error: 'u3: completion not seen' };
    const at = await page.evaluate(() => window.__ux.wheelStart());
    await page.mouse.move(at.x, at.y);
    const sent = [], t0 = Date.now();
    for (let k = 0; k < 120; k++) {
      const wait = t0 + k * 100 - Date.now(); if (wait > 0) await pause(wait);
      const s = Date.now(); await page.mouse.wheel(0, 100); sent.push([s - t0, Date.now() - s]);
    }
    await pause(150);
    out.closed = await page.evaluate(() => window.__ux.closeStep());
    out.sent = sent;
  }
  if (!(await waitFor(page, () => window.__ux.sampled, limit))) return { ...out, error: 'sampling did not end' };
  if (mode.includes('u4')) { await pause(500); out.u4 = await page.evaluate(() => window.__ux.u4()); }
  return out;
}

const median = a => { if (!a.length) return null; const b = [...a].sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const BLANK = 1 | 2 | 4;

// Frames where a tested point is on a block with any of `mask`; the longest consecutive run.
function blankRuns(frames, mask) {
  let n = 0, best = { frames: 0, ms: 0, from: null }, cur = null;
  frames.forEach((f, j) => {
    const hit = f.pts.some(p => p && p[2] & mask);
    if (hit) { n++; cur = cur ? { ...cur, frames: cur.frames + 1 } : { frames: 1, from: f.rt, j }; const end = frames[j + 1]?.rt ?? f.rt; const ms = r1(end - cur.from); if (cur.frames > best.frames || (cur.frames === best.frames && ms > best.ms)) best = { frames: cur.frames, ms, from: cur.from }; }
    else cur = null;
  });
  return { frames: n, longest: best };
}

function analyse(raw, drv, mode) {
  const U = raw, z = U.gone;
  const frames = U.frames.map(([t, y, H, pend, hyd, ip, a, pts]) => ({ rt: r1(t - z), y, H, pend, hyd, ip, a, pts })).filter(f => f.rt >= -1000);
  const acts = U.acts.map(a => ({ ...a, rt: r1(a.t - z) }));
  const settle = U.settle ? { ...U.settle, rt: r1(U.settle.t - z) } : null;
  const anchors = U.anchors.map(a => ({ ...a, rt: r1(a.t - z) }));
  const res = { goneAfterEnter: r1(z - U.enter), lastIpBeforeGone: r1(U.lastIp - z), frames: frames.length, acts, settle, anchors, endState: U.endState, errors: U.err };
  const dts = frames.slice(1).map((f, j) => f.rt - frames[j].rt);
  res.frameMs = { median: r1(median(dts) ?? 0), max: r1(Math.max(0, ...dts)) };
  const jump = acts.find(a => a.kind !== 'start') ?? acts[0];
  const after = jump ? frames.filter(f => f.rt >= jump.rt) : frames;
  res.blank = { all: { veil: blankRuns(frames, 3), skipped: blankRuns(frames, 4), any: blankRuns(frames, BLANK) }, afterAct: { veil: blankRuns(after, 3), skipped: blankRuns(after, 4), any: blankRuns(after, BLANK) }, noBlockFrames: frames.filter(f => f.pts.every(p => !p)).length };
  res.firstBlank = frames.filter(f => f.pts.some(p => p && p[2] & BLANK)).slice(0, 12).map(f => ({ rt: f.rt, pts: f.pts.map(p => (p ? p[2] & BLANK : '-')).join('') }));
  // (i) view shift after settling: the anchor's rect top, frame to frame and against the settle frame.
  if (settle) {
    const s = frames.filter(f => f.rt >= settle.rt && f.a != null);
    const lostAt = anchors.filter(a => a.why === 'lost').map(a => a.rt);
    let base = s[0]?.a, maxMove = 0, jumps = [];
    s.forEach((f, j) => {
      if (j && lostAt.some(t => t > s[j - 1].rt && t <= f.rt)) { base = f.a; return; }
      if (j) { const d = r1(f.a - s[j - 1].a); if (Math.abs(d) > 4) jumps.push({ rt: f.rt, d }); }
      maxMove = Math.max(maxMove, Math.abs(f.a - base));
    });
    const net = s.length ? r1(s.at(-1).a - s[0].a) : null;
    res.shift = { from: settle.rt, frames: s.length, maxMove: r1(maxMove), net, jumps: jumps.length, jumpSizes: jumps.map(x => x.d), jumpSum: r1(jumps.reduce((a, x) => a + x.d, 0)), firstJumps: jumps.slice(0, 20), reanchors: lostAt.length };
    const cAt = f => f.pts[3]?.[0] ?? null;
    const ps = (U.post || []).map(([t, pt, y, a]) => ({ rt: r1(t - z), lag: r1(pt - t), y, a })).filter(p => p.rt >= settle.rt && p.a != null);
    const pj = ps.slice(1).map((p, j) => ({ rt: p.rt, d: r1(p.a - ps[j].a) })).filter(x => Math.abs(x.d) > 4);
    res.shiftPost = { frames: ps.length, maxMove: ps.length ? r1(Math.max(...ps.map(p => Math.abs(p.a - ps[0].a)))) : null, jumps: pj.length, jumpSizes: pj.map(x => x.d), firstJumps: pj.slice(0, 20), lagMedian: median(ps.map(p => p.lag)) };
    res.end = { centreAtSettle: anchors.find(a => a.why === 'settle')?.i ?? null, centreAtEnd: U.endState?.centre ?? (frames.length ? cAt(frames.at(-1)) : null), lastBlockInViewAtEnd: U.endState?.lastBlockInView ?? null, fromEndAtEnd: U.endState?.fromEnd ?? null };
    res.end.same = res.end.centreAtSettle != null && res.end.centreAtSettle === res.end.centreAtEnd;
  }
  // (iv) once a second from 1 s before completion.
  res.series = frames.filter((f, j) => j === 0 || Math.floor(f.rt / 1000) !== Math.floor(frames[j - 1].rt / 1000)).map(f => ({ rt: f.rt, y: Math.round(f.y), H: f.H, pend: f.pend, hyd: f.hyd, c: f.pts[3]?.[0] ?? null }));
  res.yRange = frames.length ? [Math.round(Math.min(...frames.map(f => f.y))), Math.round(Math.max(...frames.map(f => f.y)))] : null;
  res.compact = frames.map(f => [f.rt, f.y, f.H, f.pend, f.hyd, f.a, f.pts[3]?.[0] ?? null, f.pts.map(p => (p ? p[2] : -1))]);
  if (mode.includes('u3')) {
    const st = U.steps, ok = st.slice(0, -1).filter(x => !x.none && !x.lost), lastStep = st.at(-1);
    const off = ok.map((x, k) => ({ k, dY: x.dY })).filter(x => Math.abs(x.dY - 100) > 1);
    const vis = ok.filter(x => Math.abs(x.visual) > 4), doc = ok.filter(x => Math.abs(x.doc) > 4);
    const sent = drv?.sent || [], gaps = sent.slice(1).map((s, j) => s[0] - sent[j][0]);
    res.wheel = { steps: st.length, tracked: ok.length, lost: st.filter(x => x.lost).length, none: st.filter(x => x.none).length, offDelta: off.length, offDeltaList: off.slice(0, 30), dYsum: r1(ok.reduce((a, x) => a + x.dY, 0)),
      visualOver4: vis.length, visualSizes: vis.map(x => x.visual), docOver4: doc.length, docSizes: doc.map(x => x.doc), maxDoc: r1(Math.max(0, ...ok.map(x => Math.abs(x.doc)))), maxVisual: r1(Math.max(0, ...ok.map(x => Math.abs(x.visual)))),
      sendGapMedian: median(gaps), sendGapMax: gaps.length ? Math.max(...gaps) : null, sendAckMax: sent.length ? Math.max(...sent.map(s => s[1])) : null, lastStep, firstAt: st[0] ? r1(st[0].t - z) : null, lastAt: st.length ? r1(st.at(-1).t - z) : null, rows: st.map(x => ({ ...x, rt: r1(x.t - z) })) };
  }
  return res;
}

const fmtBlank = b => `veil/opacity 0 ${b.veil.frames} (longest ${b.veil.longest.frames} frames, ${b.veil.longest.ms} ms), skipped ${b.skipped.frames} (longest ${b.skipped.longest.frames}, ${b.skipped.longest.ms} ms), either ${b.any.frames} (longest ${b.any.longest.frames}, ${b.any.longest.ms} ms${b.any.longest.from != null ? ` from ${b.any.longest.from}` : ''})`;
const fr = r => (r ? `${r.n} (${r.t} ms)` : 'never in 90');
const fmtWatch = w => (w.none ? 'no candidate block' : `block ${w.block}, flags before ${w.flagsBefore}, scrollTop ${w.y0} → ${w.yAfterCall} in the call; first frame in view ${fr(w.firstInView)} (top ${w.topFirstInView ?? '-'} px below the view's top), unveiled at opacity 1 and rendered ${fr(w.firstUnveiled)}, both ${fr(w.firstOk)}; after 90 frames scrollTop ${w.end.y}, top ${w.end.top} px, in view ${w.end.inView}, flags ${w.end.f}`);

export async function uxProbe(page, env, summary, schedEnd) {
  const mode = (env.UX || '').split(',').filter(Boolean);
  if (!mode.length) return { finish: async () => [] };
  await page.evaluate(installUx, { mode, schedEnd, sampleMs: 16000, u2Block: env.U2_BLOCK ? Number(env.U2_BLOCK) : null });
  const task = drive(page, mode, env).catch(e => ({ error: String(e.message).slice(0, 200) }));
  return {
    async finish() {
      const drv = await task;
      const raw = await page.evaluate(() => { const U = window.__ux; return { frames: U.frames, post: U.post, acts: U.acts, steps: U.steps, anchors: U.anchors, gone: U.gone, lastIp: U.lastIp, enter: U.enter, settle: U.settle, endState: U.endState, err: U.err }; });
      const lines = [];
      if (raw.gone == null) { summary.ux = { mode, raw: { err: raw.err, frames: raw.frames.length }, drv }; return [`ux: completion not seen (${raw.frames.length} frames, errors ${JSON.stringify(raw.err)}, drive ${JSON.stringify(drv?.error ?? null)})`]; }
      const a = analyse(raw, drv, mode);
      summary.ux = { mode, ...a, u4: drv?.u4 ?? null, driveError: drv?.error ?? null };
      const P = `ux ${mode.join('+')}`;
      lines.push(`${P}: completion (first frame without in_progress) ${a.goneAfterEnter} ms after Enter, last in_progress frame ${a.lastIpBeforeGone} ms before; ${a.frames} frames sampled from 1 s before to 16 s after, frame interval median ${a.frameMs.median} ms, max ${a.frameMs.max} ms; acts ${a.acts.map(x => `${x.kind} at +${x.rt} ms (scrollTop ${x.y0} → ${x.y1}, scrollHeight ${x.H}${x.info ? `, ${JSON.stringify(x.info)}` : ''})`).join('; ') || 'none'}${a.errors.length ? `; errors ${JSON.stringify(a.errors)}` : ''}${drv?.error ? `; drive ${drv.error}` : ''}`);
      lines.push(`${P} (ii) frames with a tested point on a veiled / skipped block, whole window: ${fmtBlank(a.blank.all)}; from the act on: ${fmtBlank(a.blank.afterAct)}; frames with no point on an answer block ${a.blank.noBlockFrames}; first such frames (ms: per point 0-7 flag bits, - none) ${a.firstBlank.map(f => `${f.rt}:${f.pts}`).join(' ') || 'none'}`);
      if (a.shift) lines.push(`${P} (i) view shift after settling (settled at +${a.settle.rt} ms, first frame >= 100 ms after the write; anchor block ${a.end.centreAtSettle}): ${a.shift.frames} frames, largest move of the anchor ${a.shift.maxMove} px, net ${a.shift.net} px, jumps > 4 px ${a.shift.jumps} (sum ${a.shift.jumpSum} px; first ${a.shift.firstJumps.map(j => `${j.d}@${j.rt}`).join(' ') || '-'}), new anchors ${a.shift.reanchors}`);
      if (a.shiftPost) lines.push(`${P} (i) the same after each frame's rendering update (a task posted from the frame's rAF, median ${a.shiftPost.lagMedian} ms later): ${a.shiftPost.frames} frames, largest move ${a.shiftPost.maxMove} px, jumps > 4 px ${a.shiftPost.jumps} (first ${a.shiftPost.firstJumps.map(j => `${j.d}@${j.rt}`).join(' ') || '-'})`);
      if (a.end) lines.push(`${P} (iii) view at the end (+16 s): centre block ${a.end.centreAtEnd} against ${a.end.centreAtSettle} after settling (same ${a.end.same}); answer's last block (${a.endState?.lastBlock}) in view ${a.end.lastBlockInViewAtEnd}; fromEnd ${a.end.fromEndAtEnd}`);
      lines.push(`${P} (iv) once a second (ms after completion: scrollTop/scrollHeight, pending/hydrated, centre block): ${a.series.map(s => `${s.rt}:${s.y}/${s.H},${s.pend ?? '-'}/${s.hyd ?? '-'},${s.c ?? '-'}`).join(' ')}; scrollTop range ${JSON.stringify(a.yRange)}`);
      if (a.wheel) {
        const w = a.wheel;
        lines.push(`${P} u3 wheel: ${w.steps} notches from +${w.firstAt} to +${w.lastAt} ms (sent every ${w.sendGapMedian} ms median, max gap ${w.sendGapMax}, longest dispatch ${w.sendAckMax} ms), tracked ${w.tracked} of the first ${w.steps - 1} (lost ${w.lost}, none ${w.none}; the last, closed 150 ms after the last notch: dY ${w.lastStep?.dY}, doc ${w.lastStep?.doc}); scrollTop moved other than 100 px in ${w.offDelta} steps (sum of moves ${w.dYsum} px; first ${w.offDeltaList.map(x => `#${x.k}:${x.dY}`).join(' ') || '-'}); centre block moved > 4 px beyond the notch (visual) in ${w.visualOver4} (max ${w.maxVisual}; ${w.visualSizes.slice(0, 20).join(', ') || '-'}), in the document (doc) in ${w.docOver4} (max ${w.maxDoc}; ${w.docSizes.slice(0, 20).join(', ') || '-'})`);
      }
      const u = drv?.u4;
      if (u) {
        lines.push(`${P} u4 held blocks in the last 30%: ${u.held.candidates} of ${u.held.blocks} blocks (veiled ones ${u.held.veiledAny})`);
        lines.push(`${P} u4 (a) window.find: ${u.find.none ? 'no unique string found' : `string of ${u.find.len} chars in ${fmtWatch(u.find)}; returned ${u.find.found} in ${u.find.callMs} ms, selection in the block ${u.find.selectionInBlock}`}`);
        lines.push(`${P} u4 (c) scrollIntoView: ${fmtWatch(u.intoView)}`);
        lines.push(`${P} u4 (b) selectAllChildren(last turn).toString().length ${u.select.selLen} (${u.select.selMs} ms), innerText.length ${u.select.innerLen} (${u.select.innerMs} ms; ${u.select.innerLen2} two frames later), equal ${u.select.equal}, textContent.length ${u.select.textLen}; veiled blocks before ${u.select.veiledBefore}, after ${u.select.veiledAfter}`);
      }
      return lines;
    },
  };
}
