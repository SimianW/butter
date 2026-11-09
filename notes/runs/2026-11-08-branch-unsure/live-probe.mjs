// Read-only instrumentation of the unmodified extension; run on the locked remote lab.
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const L = await import(
  pathToFileURL(
    path.join(
      process.env.LAB_ROOT || path.join(os.homedir(), '.local/share/chatgpt-lab'),
      'lib/lab.mjs',
    ),
  )
);
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const lab = L.getLab(2),
  owner = 'branch-unsure-research';
assert.equal((await fs.readFile(`${lab.lockPath}/owner`, 'utf8')).split('\n')[0], owner);
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
await context.route('**/*', (route) => {
  const r = route.request(),
    u = new URL(r.url());
  if (
    r.method() === 'POST' &&
    u.hostname === 'chatgpt.com' &&
    u.pathname === '/backend-api/conversation/new_branch'
  )
    return route.continue();
  return route.fallback();
});
const probes = new Map(),
  pending = [];
const instrumentation = `(() => {
 const mask=s=>s==null?s:s.replace(/[^\\s]/gu,'x');
 const expected=ButterBranch.formatMessage(job.quote,job.question);
 const data=globalThis.__branchProbe={states:[],calls:[],expected:mask(expected),expectedLength:expected.length};
 const kind=id=>id==null?null:id===job.original?'original':'branch';
 const prior=onState;
 onState=(state,info)=>{data.states.push({state,cause:info.cause,verified:info.verified});return prior(state,info);};
 rawPage=new Proxy(rawPage,{get(target,key){const fn=target[key];if(typeof fn!=='function')return fn;
 return (...args)=>{const result=fn.apply(target,args); const row={method:key};
 if(key==='composerText'){row.value=mask(result);row.length=result?.length;row.normalized=mask(result?.trim().replace(/\\n{3,}/g,'\\n\\n'));row.matchesExpected=result!==null&&result.trim().replace(/\\n{3,}/g,'\\n\\n')===expected;}
 else if(key==='fill'){row.value=mask(args[0]);row.result=result;}
 else if(key==='identity')row.result=kind(result);
 else if(key==='sendButton')row.result=result?{label:result.getAttribute('aria-label'),type:result.type,disabled:result.disabled}:null;
 else if(['isRendered','isLoaded','send','isStreaming'].includes(key))row.result=result;
 else row.result=!!result;
 data.calls.push(row);return result;};}});
 return true;
})()`;
async function attach(p) {
  const cdp = await context.newCDPSession(p),
    contexts = [];
  cdp.on('Runtime.executionContextCreated', (e) => contexts.push(e.context.id));
  await cdp.send('Runtime.enable');
  await cdp.send('Debugger.enable');
  cdp.on('Debugger.paused', async (e) => {
    try {
      const r = await cdp.send('Debugger.evaluateOnCallFrame', {
        callFrameId: e.callFrames[0].callFrameId,
        expression: instrumentation,
        returnByValue: true,
      });
      if (r.exceptionDetails) console.log('PROBE_ERROR ' + r.exceptionDetails.text);
    } finally {
      await cdp.send('Debugger.resume');
    }
  });
  await cdp.send('Debugger.setBreakpointByUrl', { urlRegex: 'branch/run\\.js$', lineNumber: 35 });
  probes.set(p, { cdp, contexts });
}
context.on('page', (p) => pending.push(attach(p)));
const results = [];
try {
  const original =
    context.pages().find((p) => p.url().startsWith('https://chatgpt.com')) ||
    (await context.newPage());
  for (const mode of (process.env.MODES || 'chinese-math,english').split(',')) {
    const fx = mode === 'english' ? 'demo-en12' : 'math12';
    await original.goto(L.fixture(lab, fx), { waitUntil: 'domcontentloaded' });
    await original
      .locator('[data-markdown-text-style="assistant-message"]')
      .first()
      .waitFor({ timeout: 60000 });
    await original.locator('.katex').first().waitFor({ timeout: 60000 });
    await original.waitForTimeout(2500);
    // Pick two adjacent Chinese/math paragraphs, or one plain English text node.
    const picked = await original.evaluate((mode) => {
      const replies = [
        ...document.querySelectorAll('[data-markdown-text-style="assistant-message"]'),
      ];
      for (const reply of replies) {
        if (mode === 'chinese-math') {
          const ps = [...reply.querySelectorAll('p')];
          for (let i = 0; i < ps.length - 1; i++) {
            const a = ps[i],
              b = ps[i + 1];
            if (
              !a.querySelector('.katex') ||
              !b.querySelector('.katex') ||
              !/[\u4e00-\u9fff]/.test(a.textContent + b.textContent) ||
              a.parentElement !== b.parentElement ||
              a.textContent.length + b.textContent.length > 1200
            )
              continue;
            a.scrollIntoView({ block: 'center', behavior: 'instant' });
            const r = document.createRange();
            r.setStart(a, 0);
            r.setEnd(b, b.childNodes.length);
            globalThis.__selectionRange = r;
            return {
              paragraphs: 2,
              math: a.querySelectorAll('.katex').length + b.querySelectorAll('.katex').length,
              chinese: true,
            };
          }
        } else {
          const walk = document.createTreeWalker(reply, NodeFilter.SHOW_TEXT);
          for (let n; (n = walk.nextNode()); ) {
            if (
              n.textContent.trim().length < 50 ||
              n.parentElement.closest('.katex,math,pre,code,button,a') ||
              /[\u4e00-\u9fff]/.test(n.textContent)
            )
              continue;
            n.parentElement.scrollIntoView({ block: 'center', behavior: 'instant' });
            const r = document.createRange();
            const start = n.textContent.search(/\S/);
            r.setStart(n, start);
            r.setEnd(n, Math.min(n.textContent.length, start + 65));
            globalThis.__selectionRange = r;
            return { paragraphs: 1, math: 0, chinese: false };
          }
        }
      }
      return null;
    }, mode);
    assert.ok(picked, 'selection found');
    await original.waitForTimeout(1800);
    await original.evaluate(() => {
      getSelection().removeAllRanges();
      getSelection().addRange(globalThis.__selectionRange);
    });
    await original.locator('chatgpt-butter-branch .chip').waitFor({ timeout: 10000 });
    await original.locator('chatgpt-butter-branch .chip').click();
    await original
      .locator('chatgpt-butter-branch textarea')
      .fill(mode === 'chinese-math' ? '详细解释' : 'Explain briefly.');
    const opened = context.waitForEvent('page');
    await original.locator('chatgpt-butter-branch textarea').press('Enter');
    const dest = await opened;
    await Promise.all(pending);
    const probe = probes.get(dest);
    let data;
    for (let poll = 0; poll < 180; poll++) {
      for (const contextId of probe.contexts) {
        try {
          const r = await probe.cdp.send('Runtime.evaluate', {
            contextId,
            expression: 'globalThis.__branchProbe || null',
            returnByValue: true,
          });
          if (r.result.value) data = r.result.value;
        } catch {}
      }
      if (data?.states.some((s) => ['ready', 'unsure', 'failed', 'cancelled'].includes(s.state)))
        break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(data, 'probe captured');
    const dom = await dest.evaluate(() => {
      const e = document.querySelector('.ProseMirror');
      return {
        editorHtml: e?.innerHTML.replace(
          />[^<]*</g,
          (m) => '>' + m.slice(1, -1).replace(/[^\s]/gu, 'x') + '<',
        ),
        whiteSpace: e && getComputedStyle(e).whiteSpace,
        line: document.querySelector('chatgpt-butter-branch')?.shadowRoot.querySelector('.line')
          ?.className,
      };
    });
    const result = { mode, fixture: fx, selection: picked, ...data, dom };
    result.calls = result.calls.filter((c) =>
      ['fill', 'composerText', 'sendButton', 'send', 'isRendered'].includes(c.method),
    );
    results.push(result);
    console.log(JSON.stringify(result));
    await dest.locator('.ProseMirror[contenteditable="true"]').fill('');
    await dest.close();
  }
} finally {
  await fs.writeFile(
    process.env.OUT || '/tmp/branch-unsure-live.json',
    JSON.stringify(results, null, 2) + '\n',
  );
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}
