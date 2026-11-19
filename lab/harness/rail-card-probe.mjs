// Why one rail card's text differs from its question bubble (2026-11-18 live features, item 4).
// Opens a fixture with Butter, loads all earlier history, captures ChatGPT's own conversation GET
// responses (in memory only), hovers tick TICK and compares, structurally, the card's text with the
// API's question (the rail's `q`, built as history/conversation-main.js `item()` builds it) and with
// what the question's turn shows. Prints lengths, booleans, element and attribute names, API field
// names: never chat text. Read-only, send guard on. Needs the lab lock you hold (LAB_OWNER).
//
// LAB_ID=2 LAB_OWNER=<owner> EXT=<unpacked Butter dir> [FIXTURE=ats12] [TICK=4] node lab/harness/rail-card-probe.mjs
// REPORT lines only. Exit 2 on a setup error.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';

const env = process.env;
const FIXTURE = env.FIXTURE || 'ats12', TICK = Number(env.TICK || 4);
const pause = ms => new Promise(r => setTimeout(r, ms));
const report = s => console.log(`REPORT ${s}`);
if (!env.LAB_OWNER || !env.EXT) { console.error('LAB_OWNER= and EXT= are required'); process.exit(2); }
const lab = { ...L.getLab(env.LAB_ID || 2), owner: env.LAB_OWNER };
const held = (() => { try { return fs.readFileSync(path.join(lab.lockPath, 'owner'), 'utf8').split('\n')[0].trim(); } catch { return null; } })();
if (held !== env.LAB_OWNER) { console.error(`lab ${lab.id} lock is held by ${held}`); process.exit(2); }
const PAGE = /\/backend-api\/conversations?\/[0-9a-f-]{36}(\/messages)?(?:\?|$)/;
const norm = s => (s || '').replace(/\s+/g, ' ').trim();
let browser, exit = 0;
try {
  execFileSync(path.join(L.root(), 'bin/lab'), ['restart-browser'], { env: { ...env, LAB_ID: String(lab.id), LAB_EXTENSIONS: env.EXT, LAB_FLAGS: '' }, stdio: 'pipe' });
  for (let n = 0; n < 60 && !(await L.cdpVersion(lab)); n++) await pause(500);
  await pause(2500);
  let context; ({ browser, context } = await L.connect(lab));
  if (typeof (await L.sendGuard(context, lab)) !== 'function') throw Error('send guard not installed');
  const page = context.pages().find(p => p.url().startsWith('https://chatgpt.com')) || context.pages()[0];
  for (const o of context.pages()) if (o !== page) await o.close();
  const pages = [];
  page.on('response', async r => {
    if (r.request().method() !== 'GET' || !PAGE.test(r.url())) return;
    try { pages.push({ older: !!PAGE.exec(r.url())[1], j: await r.json() }); } catch {}
  });
  await page.goto('about:blank');
  await page.goto(L.fixture(lab, FIXTURE), { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.locator('.thread-scroll-container:visible [data-turn-key]').first().waitFor({ state: 'attached', timeout: 60000 });
  await page.locator('chatgpt-butter-nav[data-on]').waitFor({ state: 'attached', timeout: 30000 });
  await pause(6000);
  const sc = 'const s=[...document.querySelectorAll(".thread-scroll-container")].find(s=>s.clientHeight>0);';
  // All earlier history, as rail-ticks-live.mjs loads it: until ChatGPT's turn list stops growing.
  const entries = () => page.evaluate(() => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0), t = s?.querySelector('[data-turn-key]');
    let f = t?.[Object.keys(t).find(k => k.startsWith('__reactFiber$'))];
    for (let d = 0; f && d < 80; d++, f = f.return) { const e = f.memoizedProps?.entries; if (Array.isArray(e) && e.length && e.every(x => typeof x?.turnKey === 'string')) return e.length; }
    return null;
  });
  let nEntries = -1;
  for (let n = 0, stable = 0; n < 40 && stable < 4; n++) {
    await page.evaluate(new Function(`${sc} s.scrollTop = 280;`)); await pause(30);
    await page.evaluate(new Function(`${sc} s.scrollTop = 0;`));
    await pause(1000);
    const c = await entries();
    stable = c === nEntries ? stable + 1 : 0; nEntries = c;
  }
  await pause(2000);
  report(`history loaded: ChatGPT's turn list ${nEntries} entries`);

  // API messages, oldest first, merged like rail/conversations.js (by id; pages arrive newest first).
  const byId = new Map(), order = [];
  const pagesSorted = [...pages.filter(p => !p.older), ...pages.filter(p => p.older)];
  for (const p of pagesSorted) {
    let msgs = p.j.messages;
    if (!msgs && p.j.mapping) { msgs = []; for (let n = p.j.mapping[p.j.current_node]; n; n = p.j.mapping[n.parent]) if (n.message) msgs.push(n.message); msgs.reverse(); }
    if (!Array.isArray(msgs)) continue;
    const fresh = msgs.filter(m => m?.id && !byId.has(m.id));
    for (const m of fresh) byId.set(m.id, m);
    if (p.older) order.unshift(...fresh.map(m => m.id)); else order.push(...fresh.map(m => m.id));
  }
  const item = m => {
    const c = m?.content;
    if (m?.author?.role !== 'user' || m.metadata?.is_visually_hidden_from_conversation || !(c?.content_type === 'text' || c?.content_type === 'multimodal_text')) return null;
    return (c.parts ?? []).filter(p => typeof p === 'string').join('\n').trim() || (c.parts?.length ? '[image]' : null);
  };
  const qs = order.map(id => ({ id, m: byId.get(id), q: item(byId.get(id)) })).filter(x => x.q != null);
  report(`API: ${pages.length} conversation pages, ${byId.size} messages, ${qs.length} visible questions; user messages ${[...byId.values()].filter(m => m.author?.role === 'user').length}`);
  report(`API question lengths (normalized): [${qs.map(x => norm(x.q).length).join(', ')}]`);
  const target = qs[TICK];
  if (!target) throw Error(`no question ${TICK}`);
  const m = target.m;
  const keysDeep = (o, pre = '') => Object.entries(o || {}).flatMap(([k, v]) => v && typeof v === 'object' && !Array.isArray(v) && pre.split('.').length < 3 ? [`${pre}${k}{}`, ...keysDeep(v, `${pre}${k}.`)] : [`${pre}${k}${Array.isArray(v) ? `[${v.length}]` : ''}`]);
  report(`API question ${TICK}: content_type ${m.content?.content_type}, parts ${m.content?.parts?.length} (${(m.content?.parts || []).map(p => typeof p).join(',')}), q ${norm(target.q).length} chars, ${target.q.split('\n').length} lines`);
  report(`API question ${TICK} message keys: ${keysDeep({ ...m, content: undefined }).filter(k => !k.startsWith('content')).join(' ')}`);
  report(`API question ${TICK} content keys: ${Object.keys(m.content || {}).join(' ')}`);
  const others = qs.filter((_, i) => i !== TICK).map(x => new Set(Object.keys(x.m.metadata || {})));
  const extra = Object.keys(m.metadata || {}).filter(k => !others.every(s => s.has(k)));
  report(`API question ${TICK} metadata keys not on every other question: [${extra.join(', ')}]`);
  // Is there another user message (not visible as a question) next to it?
  const at = order.indexOf(target.id);
  report(`API neighbours of question ${TICK} (role/content_type/hidden): ${order.slice(Math.max(0, at - 3), at + 4).map(id => { const x = byId.get(id); return `${id === target.id ? '*' : ''}${x.author?.role}/${x.content?.content_type}/${x.metadata?.is_visually_hidden_from_conversation ? 'hidden' : 'shown'}/${x.recipient ?? '-'}`; }).join(' ')}`);

  // Hover the tick; read the card. Then jump to the question and read its turn.
  const ticks = await page.evaluate(() => [...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')].map(t => { const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }));
  report(`rail: ${ticks.length} ticks`);
  await page.mouse.move(ticks[TICK].x, ticks[TICK].y); await pause(900);
  const card = await page.evaluate(() => { const r = document.querySelector('chatgpt-butter-nav').shadowRoot; return r.querySelector('.card .text')?.textContent ?? null; });
  const cardN = norm(card), qN = norm(target.q);
  report(`card ${TICK}: ${cardN.length} chars; equals API q ${cardN === qN}; is API q cut at 400 ${cardN.endsWith('…') && qN.startsWith(cardN.slice(0, -1).trim())}`);
  await page.mouse.click(ticks[TICK].x, ticks[TICK].y); await pause(4000);
  await page.mouse.move(700, 500); await pause(500);
  const dom = await page.evaluate(({ id, q }) => {
    const norm = s => (s || '').replace(/\s+/g, ' ').trim();
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
    const turn = s.querySelector(`[data-turn-key="${CSS.escape(id)}"]`);
    if (!turn) return { mounted: false };
    const bubble = turn.querySelector('[data-user-message-bubble]');
    const qN = norm(q);
    const tree = (el, d = 0) => d > 5 || !el ? [] : [`${'  '.repeat(d)}${el.tagName.toLowerCase()}[${[...el.attributes].map(a => a.name).filter(n => n !== 'style').join(' ')}] text=${norm(el.textContent).length}${el.childElementCount ? '' : ' leaf'}`, ...[...el.children].slice(0, 6).flatMap(c => tree(c, d + 1))];
    // The user-message part of the turn: from the bubble up to the turn.
    const userPart = bubble?.closest('[data-message-author-role], [class*="user"], [data-turn]') || bubble?.parentElement?.parentElement;
    const els = [...turn.querySelectorAll('*')].filter(e => !e.closest('[data-markdown-text-style="assistant-message"]'));
    const textEls = els.filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()));
    return {
      mounted: true,
      bubbleLen: norm(bubble?.textContent).length,
      bubbleInQ: qN.includes(norm(bubble?.textContent)),
      qInBubble: norm(bubble?.textContent).includes(qN),
      qStartsWithBubble: qN.startsWith(norm(bubble?.textContent).slice(0, 20)),
      qEndsWithBubble: qN.endsWith(norm(bubble?.textContent)),
      bubbleAt: qN.indexOf(norm(bubble?.textContent)),
      // The rest of q without the bubble's text: does the attachment pill stand for it?
      restLen: qN.replace(norm(bubble?.textContent), '').trim().length,
      pill: [...turn.querySelectorAll('[data-composer-attachment-pill]')].map(p => ({ label: ['Pasted text', 'Pasted', 'Text'].includes(norm(p.textContent)) ? norm(p.textContent) : `(${norm(p.textContent).length} chars)`, aria: p.getAttribute('aria-label'), haspopup: p.getAttribute('aria-haspopup'), beforeBubble: !!(bubble && (p.compareDocumentPosition(bubble) & Node.DOCUMENT_POSITION_FOLLOWING)), insideBubble: !!bubble?.contains(p) })),
      bubbleTree: tree(bubble),
      // Elements outside the answer with own text: where is the API text shown, if anywhere?
      ownText: textEls.slice(0, 20).map(e => ({ tag: e.tagName.toLowerCase(), attrs: [...e.attributes].map(a => a.name).filter(n => n !== 'style'), len: norm(e.textContent).length, inQ: qN.includes(norm(e.textContent)), inBubble: !!bubble?.contains(e) })),
      qShownInTurn: norm(turn.textContent).includes(qN.slice(0, 60)),
      media: turn.querySelectorAll('img, video, canvas, [class*="file" i], [class*="attachment" i]').length,
      mediaKinds: [...turn.querySelectorAll('img, [class*="file" i], [class*="attachment" i]')].slice(0, 5).map(e => `${e.tagName.toLowerCase()}[${[...e.attributes].map(a => a.name).filter(n => n !== 'style' && n !== 'src' && n !== 'alt').join(' ')}]`),
      buttons: [...turn.querySelectorAll('button')].filter(b => !b.closest('[data-markdown-text-style="assistant-message"]')).map(b => b.getAttribute('aria-label') || `(${norm(b.textContent).length} chars)`).slice(0, 12),
      versions: [...turn.querySelectorAll('*')].some(e => /^\d+\s*\/\s*\d+$/.test(norm(e.textContent))),
      userPartTag: userPart ? `${userPart.tagName.toLowerCase()}[${[...userPart.attributes].map(a => a.name).join(' ')}]` : null,
    };
  }, { id: target.id, q: target.q });
  report(`turn of question ${TICK}: ${JSON.stringify({ ...dom, bubbleTree: undefined, ownText: undefined })}`);
  if (dom.bubbleTree) report(`bubble tree:\n${dom.bubbleTree.join('\n')}`);
  if (dom.ownText) report(`elements with own text outside the answer: ${JSON.stringify(dom.ownText)}`);
  // React props of the bubble's message: which fields does ChatGPT render from?
  const fiber = await page.evaluate(id => {
    const s = [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight > 0);
    const b = s.querySelector(`[data-turn-key="${CSS.escape(id)}"] [data-user-message-bubble]`);
    let f = b?.[Object.keys(b).find(k => k.startsWith('__reactFiber$'))];
    const seen = [];
    for (let d = 0; f && d < 40; d++, f = f.return) {
      const p = f.memoizedProps; if (!p || typeof p !== 'object') continue;
      for (const [k, v] of Object.entries(p)) if (v && typeof v === 'object' && !Array.isArray(v) && (v.content || v.message?.content)) {
        const msg = v.message || v;
        seen.push({ depth: d, prop: k, id: msg.id === id, contentType: msg.content?.content_type, parts: msg.content?.parts?.length, keys: Object.keys(msg.content || {}), metaKeys: Object.keys(msg.metadata || {}).slice(0, 40) });
      }
      if (seen.length > 3) break;
    }
    return seen;
  }, target.id);
  report(`bubble's React message props: ${JSON.stringify(fiber)}`);
} catch (e) {
  console.log(`HARNESS ERROR: ${String(e.message).replace(/https?:\/\/\S+/g, '<url>').replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, '<id>')}`);
  exit = 2;
} finally { await browser?.close().catch(() => {}); }
process.exit(exit);
