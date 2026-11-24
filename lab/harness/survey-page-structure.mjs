// Read-only survey of ChatGPT's page structure against the selectors and markers Butter depends on
// (2026-11-18 live survey). No clicks on ChatGPT's controls, no sends (send guard on), no writes but
// scrollTop. Raw turn keys and page text never leave the page: the output carries counts, attribute
// names, class names and value shapes only.
//
// LAB_ID=2 LAB_OWNER=<held lock owner> EXT=<unpacked dir, empty = none, unset = as is>
//   FIXTURES=ats12,math9 LABEL=<name> [OUT=<json>] node lab/harness/survey-page-structure.mjs
//
// Prints one `REPORT <fixture> <key> <value>` line per fact and writes the full JSON to OUT
// (default ~/.local/share/chatgpt-lab/captures/2026-11-18-live-survey/structure-<LABEL>.json).
// Exit 2 on a setup error; it judges nothing (the report compares the counts with the code).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';

const env = process.env;
const fixtures = (env.FIXTURES || 'ats12').split(',');
const label = env.LABEL || 'structure';
const out = env.OUT || path.join(L.root(), 'captures/2026-11-18-live-survey', `structure-${label}.json`);
const pause = ms => new Promise(r => setTimeout(r, ms));
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const scrubUrl = u => { try { const x = new URL(u); return x.pathname.replace(UUID, '<id>') + (x.search ? '?' + [...x.searchParams.keys()].join('&') : ''); } catch { return '<bad-url>'; } };

if (!env.LAB_OWNER) { console.error('LAB_OWNER required (take the lock first)'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const result = { label, at: new Date().toISOString(), lab: lab.id, fixtures: {} };

// In the page. Counts of every selector Butter reads, the scroller's facts and the wrapper chain.
function survey() {
  const vis = el => { if (!el.getClientRects().length) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const scrollers = [...document.querySelectorAll('.thread-scroll-container')];
  const s = scrollers.find(vis);
  const scope = s || document;
  const q = (sel, root = document) => { try { return root.querySelectorAll(sel).length; } catch (e) { return 'ERR ' + e.message; } };
  const STYLE = '[data-markdown-text-style="assistant-message"]';
  const ANSWER = `:is(${STYLE}:not(:has([class*="DilResponseRoot"])), ${STYLE} [class*="DilResponseRoot"])`;
  const KEEP = ':not([data-wide-block]):not([class*="TableFrame-"])';
  const sel = {
    'scroller .thread-scroll-container': '.thread-scroll-container',
    'turn [data-turn-key]': '[data-turn-key]',
    'turn (old) [data-testid^=conversation-turn-]': '[data-testid^="conversation-turn-"]',
    'article': 'article',
    'markdown root (COLUMN)': STYLE,
    'Dil response root': '[class*="DilResponseRoot"]',
    'Dil source wrapper [data-dil-source-message-id]': '[data-dil-source-message-id]',
    'answer root (ANSWER)': ANSWER,
    'paragraphs (ANSWER > :not(ul,ol), ANSWER > :is(ul,ol) > li)': `${ANSWER} > :not(ul, ol), ${ANSWER} > :is(ul, ol) > li`,
    'old message wrapper [data-message-author-role=assistant][data-message-id]': '[data-message-author-role="assistant"][data-message-id]',
    '[data-message-author-role=assistant]': '[data-message-author-role="assistant"]',
    '[data-message-author-role=user]': '[data-message-author-role="user"]',
    '[data-message-id]': '[data-message-id]',
    'selection id [data-chatgpt-selection-message-id]': '[data-chatgpt-selection-message-id]',
    'selection conv id [data-chatgpt-selection-conversation-id]': '[data-chatgpt-selection-conversation-id]',
    'question bubble [data-user-message-bubble]': '[data-user-message-bubble]',
    'cv blocks (COLUMN > :not(dil) KEEP)': `${STYLE} > :not([data-dil-source-message-id])${KEEP}`,
    'cv blocks (Dil > KEEP)': `${STYLE} [class*="DilResponseRoot"] > ${KEEP}`,
    'seek blocks (ANSWER > KEEP:not(hr))': `${ANSWER} > ${KEEP}:not(hr)`,
    '[data-wide-block]': '[data-wide-block]',
    '[class*=TableFrame-]': '[class*="TableFrame-"]',
    'table': 'table',
    'pre': 'pre',
    '[data-code-block]': '[data-code-block]',
    '[data-talvt-turn-state]': '[data-talvt-turn-state]',
    '[data-talvt-turn-state=in_progress]': '[data-talvt-turn-state="in_progress"]',
    '[data-talvt-turn-state=complete]': '[data-talvt-turn-state="complete"]',
    '[class*=AdaptiveStreaming]': '[class*="AdaptiveStreaming"]',
    '.katex': '.katex',
    '.katex-display': '.katex-display',
    'annotation[encoding=application/x-tex]': 'annotation[encoding="application/x-tex"]',
    '[data-math-source]': '[data-math-source]',
    '[data-testid=chatgpt-citation]': '[data-testid="chatgpt-citation"]',
    'inline-size container div.[container-type:inline-size].min-h-full': 'div.\\[container-type\\:inline-size\\].min-h-full',
    'container (harness form) div[class*=container-type][class~=min-h-full]': 'div[class*="container-type"][class~="min-h-full"]',
  };
  const docSel = {
    'composer .ProseMirror[contenteditable=true]': '.ProseMirror[contenteditable="true"]',
    'composer #prompt-textarea[contenteditable=true]': '#prompt-textarea[contenteditable="true"]',
    'composer .ProseMirror[contenteditable=true][role=textbox]': '.ProseMirror[contenteditable="true"][role="textbox"]',
    '#thread-bottom-container': '#thread-bottom-container',
    'form:has(.ProseMirror[contenteditable=true])': 'form:has(.ProseMirror[contenteditable="true"])',
    'form[data-composer-placement]': 'form[data-composer-placement]',
    '[data-testid=send-button]': '[data-testid="send-button"]',
    '#composer-submit-button': '#composer-submit-button',
    'button[type=submit]': 'button[type="submit"]',
    '[data-testid=stop-button]': '[data-testid="stop-button"]',
    'button[aria-label=Send prompt]': 'button[aria-label="Send prompt"]',
    'header': 'header',
    'form': 'form',
    'use[href*=chat-bubble-checkmark-dashed]': 'use[href*="chat-bubble-checkmark-dashed"]',
    'html.dark': 'html.dark',
    'html.light': 'html.light',
    'chatgpt-butter-nav': 'chatgpt-butter-nav',
    'chatgpt-butter-nav[data-on]': 'chatgpt-butter-nav[data-on]',
    'butter-seek-preview': 'butter-seek-preview',
    '[data-turn-key][data-butter-seen]': '[data-turn-key][data-butter-seen]',
    '[data-butter-seen]': '[data-butter-seen]',
    '[data-butter-unrendered]': '[data-butter-unrendered]',
  };
  const counts = {};
  for (const [k, v] of Object.entries(sel)) counts[k] = q(v, scope);
  const doc = {};
  for (const [k, v] of Object.entries(docSel)) doc[k] = q(v);
  const shapeOf = v => { if (v == null) return null; const r = String(v).replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>'); return r.length > 60 ? `<${r.length} chars>` : r; };
  const attrs = el => Object.fromEntries([...el.attributes].map(a => [a.name, a.name === 'class' ? a.value : a.name === 'style' ? a.value.replace(/\d+(\.\d+)?px/g, 'Npx') : shapeOf(a.value)]));
  const desc = el => ({ tag: el.tagName.toLowerCase(), attrs: attrs(el), children: el.children.length,
    style: (({ overflowAnchor, contentVisibility, containerType, contain, position, display, overflowY, height }) => ({ overflowAnchor, contentVisibility, containerType, contain, position, display, overflowY }))(getComputedStyle(el)),
    h: Math.round(el.getBoundingClientRect().height) });
  const out = { url: location.pathname.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>'), title: document.title ? '<title>' : '', counts, doc,
    scrollers: scrollers.map(x => ({ visible: vis(x), clientHeight: x.clientHeight })) };
  const html = document.documentElement;
  out.htmlAttrs = [...html.attributes].map(a => a.name + (a.name === 'class' ? '=' + a.value : a.name.startsWith('data-butter') ? '=' + a.value : ''));
  if (s) {
    const cs = getComputedStyle(s);
    out.scroller = { ...desc(s), scrollTop: s.scrollTop, scrollHeight: s.scrollHeight, clientHeight: s.clientHeight, offsetMinusClientWidth: s.offsetWidth - s.clientWidth,
      scrollBehavior: cs.scrollBehavior, scrollSnapType: cs.scrollSnapType, overscrollBehaviorY: cs.overscrollBehaviorY, scrollbarGutter: cs.scrollbarGutter, scrollbarWidth: cs.scrollbarWidth,
      box: (r => ({ top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) }))(s.getBoundingClientRect()) };
    out.scrollerChildren = [...s.children].map(c => ({ ...desc(c), holdsTurns: !!c.querySelector('[data-turn-key]') }));
    // Wrapper chain from the scroller to the first mounted turn, and the turn's own attributes.
    const turns = [...s.querySelectorAll('[data-turn-key]')];
    const t = turns[0];
    if (t) {
      const chain = [];
      for (let el = t.parentElement; el && el !== s; el = el.parentElement) chain.unshift(desc(el));
      out.chain = chain;
      out.turn = desc(t);
      out.turnChildren = [...t.children].map(desc);
      out.turnAttrNames = [...new Set(turns.flatMap(x => [...x.attributes].map(a => a.name)))];
      out.turnTags = [...new Set(turns.map(x => x.tagName.toLowerCase()))];
      out.turnParentsDistinct = new Set(turns.map(x => x.parentElement)).size;
      out.turnWrapperGrandparentsDistinct = new Set(turns.map(x => x.parentElement?.parentElement)).size;
      out.turnWrappers = turns.map(x => ({ parentTag: x.parentElement.tagName.toLowerCase(), parentAttrs: attrs(x.parentElement), parentChildren: x.parentElement.children.length, parentH: Math.round(x.parentElement.getBoundingClientRect().height), h: Math.round(x.getBoundingClientRect().height), top: Math.round(x.getBoundingClientRect().top - s.getBoundingClientRect().top) }));
      // Things inside a turn: the question bubble, the answer column and their ancestors' attributes.
      const bubble = t.querySelector('[data-user-message-bubble]');
      const col = t.querySelector(STYLE);
      const up = (el, stop) => { const a = []; for (let e = el?.parentElement; e && e !== stop; e = e.parentElement) a.push({ tag: e.tagName.toLowerCase(), attrs: Object.keys(attrs(e)).filter(n => n !== 'class' && n !== 'style'), cls: (e.getAttribute('class') || '').split(/\s+/).filter(c => /^[A-Z]|group|turn|message|markdown|prose/i.test(c)).slice(0, 8) }); return a; };
      out.bubbleChain = bubble ? up(bubble, t) : null;
      out.bubbleAttrs = bubble ? attrs(bubble) : null;
      out.columnChain = col ? up(col, t) : null;
      out.columnAttrs = col ? Object.fromEntries(Object.entries(attrs(col)).filter(([k]) => k !== 'class')) : null;
      out.columnClass = col?.getAttribute('class') ?? null;
      out.columnChildTags = col ? [...col.children].slice(0, 12).map(c => c.tagName.toLowerCase() + (c.hasAttribute('data-dil-source-message-id') ? '[dil-src]' : '')) : null;
      const dil = t.querySelector('[class*="DilResponseRoot"]');
      out.dilRootClass = dil?.getAttribute('class') ?? null;
      out.talvt = [...s.querySelectorAll('[data-talvt-turn-state]')].map(e => ({ tag: e.tagName.toLowerCase(), value: e.getAttribute('data-talvt-turn-state'), isTurn: e.hasAttribute('data-turn-key'), inTurn: !!e.closest('[data-turn-key]') }));
      // Every data-* attribute name seen in the scroller, with how many elements carry it.
      const names = {};
      for (const e of s.querySelectorAll('*')) for (const a of e.attributes) if (a.name.startsWith('data-')) names[a.name] = (names[a.name] || 0) + 1;
      out.dataAttrs = names;
      out.testids = {};
      for (const e of document.querySelectorAll('[data-testid]')) { const k = e.getAttribute('data-testid').replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, '<id>').replace(/\d+/g, 'N'); out.testids[k] = (out.testids[k] || 0) + 1; }
      out.mountedTurns = turns.length;
      out.turnsCvAuto = turns.filter(x => getComputedStyle(x).contentVisibility === 'auto').length;
    }
    // Header and composer overlap (the rail's HEADER = 52 and COMPOSER = 140 assumptions).
    const sb = s.getBoundingClientRect();
    const header = [...document.querySelectorAll('header')].filter(vis).map(h => { const r = h.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), width: Math.round(r.width), id: h.id || null, intoScroller: Math.round(r.bottom - sb.top) }; });
    const comp = document.querySelector('#thread-bottom-container') || document.querySelector('form:has(.ProseMirror[contenteditable="true"])');
    const cr = comp?.getBoundingClientRect();
    const form = document.querySelector('form:has(.ProseMirror[contenteditable="true"])')?.getBoundingClientRect();
    out.overlap = { header, composer: cr ? { top: Math.round(cr.top), bottom: Math.round(cr.bottom), intoScroller: Math.round(sb.bottom - cr.top) } : null,
      composerForm: form ? { top: Math.round(form.top), intoScroller: Math.round(sb.bottom - form.top) } : null };
  }
  // React's virtualizer entries (as rail-jump-live-page.mjs reads them).
  try {
    const t = s?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))], found = null;
    for (let d = 0; f && d < 80; d++, f = f.return) {
      const e = f.memoizedProps?.entries;
      if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) { found = { depth: d, entries: e.length, keys: Object.keys(e[0]).sort(), rowComponent: !!f.memoizedProps.RowComponent, propKeys: Object.keys(f.memoizedProps).sort() }; break; }
    }
    out.entries = found;
  } catch (e) { out.entries = { error: e.message }; }
  return out;
}

function ensureBrowser() {
  if (env.EXT === undefined) return;
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
}

let browser;
try {
  ensureBrowser();
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2000);
  let context;
  ({ browser, context } = await L.connect(lab));
  await L.sendGuard(context, lab);
  const page = context.pages()[0] || await context.newPage();
  for (const other of context.pages()) if (other !== page) await other.close();
  const api = [];
  page.on('response', async r => {
    const u = r.url();
    if (!/\/backend-api\/conversation/.test(u)) return;
    const rec = { path: scrubUrl(u), status: r.status(), method: r.request().method(), matchesPAGE: /\/backend-api\/conversations?\/([0-9a-f-]{36})(\/messages)?(?:\?|$)/.test(u) };
    try {
      const ct = r.headers()['content-type'] || '';
      if (ct.includes('json')) {
        const j = await r.json();
        rec.keys = Object.keys(j).sort();
        if (j.mapping) { const nodes = Object.values(j.mapping); rec.mappingNodes = nodes.length; const m = nodes.find(n => n?.message?.author?.role === 'user')?.message; rec.userMessageKeys = m ? Object.keys(m).sort() : null; rec.contentKeys = m?.content ? Object.keys(m.content).sort() : null; rec.contentType = m?.content?.content_type ?? null; rec.hasCurrentNode = 'current_node' in j; }
        for (const k of ['messages', 'items']) if (Array.isArray(j[k])) { rec[k] = j[k].length; const m = j[k].find(x => (x.author?.role ?? x.message?.author?.role) === 'user'); rec[k + 'Keys'] = m ? Object.keys(m).sort() : (j[k][0] ? Object.keys(j[k][0]).sort() : null); }
      }
    } catch (e) { rec.parse = 'not json'; }
    api.push(rec);
  });
  for (const name of fixtures) {
    api.length = 0;
    const fx = { positions: {} };
    await page.goto('about:blank');
    await page.goto(L.fixture(lab, name), { waitUntil: 'domcontentloaded', timeout: 90000 });
    try {
      await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 45000 });
    } catch {
      fx.error = 'no [data-turn-key] in a visible scroller within 45 s';
      fx.positions.load = await page.evaluate(survey).catch(e => ({ error: e.message }));
      fx.bodyHint = await page.evaluate(() => /Could not load/i.test(document.body.innerText) ? 'could-not-load page' : 'other');
      result.fixtures[name] = fx; console.log(`REPORT ${name} error ${fx.error} (${fx.bodyHint})`); continue;
    }
    await pause(9000);
    fx.positions.opened = await page.evaluate(survey);
    // Load all earlier history (like rail-jump-live.mjs), then survey at the top, middle and end.
    let previous = -1, stable = 0;
    for (let n = 0; n < 25 && stable < 3; n++) {
      await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = 280; });
      await pause(30);
      await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = 0; });
      await pause(800);
      const h = await page.evaluate(() => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight).scrollHeight);
      stable = h === previous ? stable + 1 : 0; previous = h;
    }
    await pause(1500);
    fx.positions.top = await page.evaluate(survey);
    await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = (s.scrollHeight - s.clientHeight) / 2; });
    await pause(2500);
    fx.positions.middle = await page.evaluate(survey);
    await page.evaluate(() => { const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight); s.scrollTop = s.scrollHeight; });
    await pause(2500);
    fx.positions.end = await page.evaluate(survey);
    fx.api = [...api];
    result.fixtures[name] = fx;
    const o = fx.positions.middle;
    console.log(`REPORT ${name} entries ${JSON.stringify(o.entries)}`);
    for (const pos of ['opened', 'top', 'middle', 'end']) {
      const p = fx.positions[pos];
      console.log(`REPORT ${name} ${pos} scroller ${JSON.stringify({ y: p.scroller?.scrollTop, h: p.scroller?.scrollHeight, vh: p.scroller?.clientHeight, anchor: p.scroller?.style.overflowAnchor, children: p.scrollerChildren?.map(c => `${c.holdsTurns ? 'T:' : ''}${c.style.overflowAnchor}`), turns: p.mountedTurns, cvAuto: p.turnsCvAuto })}`);
      // Smoother streaming's container rule: computed container-type of each wrapper from the scroller to a turn.
      const ct = (p.chain || []).map(c => `${c.tag}${c.attrs.class && /container-type|min-h-full/.test(c.attrs.class) ? '[' + c.attrs.class.split(/\s+/).filter(k => /container-type|min-h-full/.test(k)).join(' ') + ']' : ''}:${c.style.containerType}`);
      console.log(`REPORT ${name} ${pos} container chain ${JSON.stringify({ scroller: p.scroller?.style.containerType, chain: ct, sizeContainerAboveTurn: (p.chain || []).some(c => c.style.containerType !== 'normal') })}`);
    }
    for (const [k, v] of Object.entries(o.counts)) console.log(`REPORT ${name} count ${k} = ${['opened', 'top', 'middle', 'end'].map(p => fx.positions[p].counts[k]).join('/')}`);
    for (const [k, v] of Object.entries(o.doc)) console.log(`REPORT ${name} doc ${k} = ${['opened', 'top', 'middle', 'end'].map(p => fx.positions[p].doc[k]).join('/')}`);
    console.log(`REPORT ${name} api ${JSON.stringify(fx.api)}`);
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(`REPORT wrote ${out.replace(process.env.HOME, '~')}`);
  await browser.close();
} catch (e) {
  console.error('HARNESS ERROR', e.message);
  try { await browser?.close(); } catch {}
  process.exit(2);
}
