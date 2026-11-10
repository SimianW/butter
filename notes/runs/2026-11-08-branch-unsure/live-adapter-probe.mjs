// Run the shipped state machine and adapter in their actual live extension world.
// Requires the lab2 lock; branch creation allowed, message sends guarded.
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
const lab = L.getLab(2);
assert.equal(
  (await fs.readFile(`${lab.lockPath}/owner`, 'utf8')).split('\n')[0],
  'branch-unsure-research',
);
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
await context.route('**/*', (route) => {
  const r = route.request(),
    u = new URL(r.url());
  return r.method() === 'POST' &&
    u.hostname === 'chatgpt.com' &&
    u.pathname === '/backend-api/conversation/new_branch'
    ? route.continue()
    : route.fallback();
});
const p = context.pages().find((p) => p.url().startsWith('https://chatgpt.com'));
try {
  console.log('loading fixture');
  await p.goto(L.fixture(lab, 'demo-en12'), { waitUntil: 'domcontentloaded' });
  await p.locator('.katex').first().waitFor({ timeout: 60000 });
  await p.waitForTimeout(2000);
  const quote = await p.evaluate(() => {
    const replies = [
      ...document.querySelectorAll('[data-markdown-text-style="assistant-message"]'),
    ];
    for (const e of replies) {
      const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode()); )
        if (
          n.textContent.trim().length > 65 &&
          !n.parentElement.closest('.katex,math,pre,code,button,a') &&
          !/[\u4e00-\u9fff]/.test(n.textContent)
        )
          return n.textContent.trim().slice(0, 65);
    }
    return null;
  });
  assert.ok(quote);
  await p.locator('.ProseMirror[contenteditable="true"]').fill('');
  const cdp = await context.newCDPSession(p),
    ids = [];
  cdp.on('Runtime.executionContextCreated', (e) => ids.push(e.context.id));
  await cdp.send('Runtime.enable');
  let id;
  for (const contextId of ids) {
    try {
      const r = await cdp.send('Runtime.evaluate', {
        contextId,
        expression: 'typeof ButterBranchRun',
        returnByValue: true,
      });
      if (r.result.value === 'object') {
        id = contextId;
        break;
      }
    } catch {}
  }
  assert.ok(id);
  console.log('running real adapter');
  const r = await cdp.send('Runtime.evaluate', {
    contextId: id,
    awaitPromise: true,
    returnByValue: true,
    expression: `(async()=>{
 const quote=${JSON.stringify(quote)}, mask=s=>s==null?s:s.replace(/[^\\s]/gu,'x');
 const raw=ButterBranchPage.adapter(),job={original:raw.identity(),quote,question:'Explain briefly.',title:'Probe'};
 const expected=ButterBranch.formatMessage(job.quote,job.question),calls=[],states=[];
 const page={...raw,composerText(){const s=raw.composerText();calls.push({method:'composerText',value:mask(s),length:s?.length,normalized:mask(s?.trim().replace(/\\n{3,}/g,'\\n\\n')),matchesExpected:s!==null&&s.trim().replace(/\\n{3,}/g,'\\n\\n')===expected});return s;},fill(s){const ok=raw.fill(s);calls.push({method:'fill',value:mask(s),result:ok});return ok;},sendButton(){const b=raw.sendButton();if(b)calls.push({method:'sendButton',label:b.getAttribute('aria-label'),disabled:b.disabled});return b;},send(b){calls.push({method:'send',inBranch:raw.identity()!==job.original,rendered:raw.isRendered(raw.identity())});return raw.send(b);}};
 const result=await ButterBranchRun.start({job,page,clock:{now:()=>performance.now(),sleep:ms=>new Promise(r=>setTimeout(r,ms))},onState:(state,info)=>states.push({state,cause:info.cause,verified:info.verified})}).done;
 return {mode:'english',fixture:'demo-en12',state:result.state,cause:result.cause,expected:mask(expected),expectedLength:expected.length,calls,states};
})()`,
  });
  if (r.exceptionDetails) throw Error(r.exceptionDetails.text);
  console.log(JSON.stringify(r.result.value));
  await fs.writeFile(
    '/tmp/branch-unsure-english.json',
    JSON.stringify(r.result.value, null, 2) + '\n',
  );
  await cdp.detach();
} finally {
  await context.unrouteAll({ behavior: 'ignoreErrors' });
  await browser.close();
}
