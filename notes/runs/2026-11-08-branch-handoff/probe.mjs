// Diagnostic only. Hold the live lab lock before running. No ChatGPT writes are allowed.
// Raw URLs/selected text exist only in memory (and the local, excluded state file).
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const out = new URL('./', import.meta.url);
const mode = process.argv[2] || 'baseline';
const lab = L.getLab(process.env.LAB_ID || 1);
assert.equal((await fs.readFile(`${lab.lockPath}/owner`, 'utf8')).split('\n')[0], 'branch-handoff-9d5b9df2');
let { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
const ids = new Map();
const token = (id) => { if (!ids.has(id)) ids.set(id, `chat-${ids.size + 1}`); return ids.get(id); };
const cleanUrl = (raw) => {
  if (!raw) return raw;
  try {
    const u = new URL(raw);
    return u.pathname.replace(/g-p-[^/]+/g, 'g-p-<project>').replace(/\/c\/([^/]+)/g, (_, id) => `/c/<${token(id)}>`)
      + (u.hash.startsWith('#butter-branch=') ? '#butter-branch=<job>' : u.hash ? '#<fragment>' : '');
  } catch { return '<unreadable>'; }
};
const stateFile = '/tmp/butter-branch-handoff-9d5b9df2.json';
const events = [];
let workerCDP;
class CDP {
  constructor(ws) { this.ws=ws; this.id=0; this.pending=new Map(); ws.addEventListener('message', e=>{ const m=JSON.parse(e.data); if(m.id){ const p=this.pending.get(m.id);this.pending.delete(m.id); m.error?p.reject(new Error(m.error.message)):p.resolve(m.result); } }); }
  static async open(url) {const ws=new WebSocket(url);await new Promise((ok,no)=>{ws.addEventListener('open',ok,{once:true});ws.addEventListener('error',no,{once:true});});return new CDP(ws);}
  send(method,params={}) {const id=++this.id;return new Promise((resolve,reject)=>{this.pending.set(id,{resolve,reject});this.ws.send(JSON.stringify({id,method,params}));});}
  close(){this.ws.close();}
}
async function instrumentWorker() {
  const wake=await contentProbe(context.pages().find(p=>p.url().startsWith('https://chatgpt.com')));
  await wake.cdp.send('Runtime.evaluate',{contextId:wake.id,expression:'chrome.runtime.sendMessage({type:"butter-branch-probe"}).catch(()=>null)',awaitPromise:true});
  await wake.cdp.detach();
  const targets=await (await fetch(`${lab.cdpUrl}/json/list`)).json();
  const w=targets.find(t=>t.type==='service_worker' && t.url.includes('/storage/layout-worker.js'));
  assert.ok(w,'Butter worker is running');
  workerCDP=await CDP.open(w.webSocketDebuggerUrl);
  await workerCDP.send('Runtime.enable');await workerCDP.send('Debugger.enable');
  await workerCDP.send('Runtime.evaluate',{expression:'globalThis.__branchProbe = []; globalThis.__branchProbeInstalled ??= false;'});
  // A non-pausing logpoint gets the existing closure's handoff object; only wraps its methods.
  await workerCDP.send('Debugger.setBreakpointByUrl',{
    url:w.url.replace('/storage/layout-worker.js','/branch/worker.js'),lineNumber:19,
    condition:`(()=>{
      if(!globalThis.__branchProbeInstalled){
        globalThis.__branchProbeInstalled=true;
        for(const name of ['put','claim']){
          const original=handoff[name].bind(handoff);
          handoff[name]=async(...args)=>{
            const sender=args[name==='put'?2:1];
            const input={name,at:Date.now(),senderUrl:sender.url,tabUrl:sender.tab?.url,tab:sender.tab?.id,
              senderIdentity:ButterBranch.identity(sender.url),tabIdentity:ButterBranch.identity(sender.tab?.url),
              jobOriginal:name==='put'?args[1].original:undefined};
            try{const result=await original(...args);globalThis.__branchProbe.push({...input,result:{ok:result.ok,error:result.error,missing:result.missing,hasJob:!!result.job,origin:result.origin}});return result;}
            catch(e){globalThis.__branchProbe.push({...input,threw:e.message});throw e;}
          };
        }
      }
      return false;
    })()`
  });
}
async function workerEvents() {
  if(!workerCDP)return [];
  const r=await workerCDP.send('Runtime.evaluate',{expression:'globalThis.__branchProbe.splice(0)',returnByValue:true});
  return (r.result.value||[]).map(e=>({...e,senderUrl:cleanUrl(e.senderUrl),tabUrl:cleanUrl(e.tabUrl),
    senderIdentity:e.senderIdentity?token(e.senderIdentity):null,tabIdentity:e.tabIdentity?token(e.tabIdentity):null,
    jobOriginal:e.jobOriginal?token(e.jobOriginal):undefined}));
}
async function contentProbe(p) {
  const cdp=await context.newCDPSession(p);const contexts=[];
  cdp.on('Runtime.executionContextCreated', e=>contexts.push(e.context));await cdp.send('Runtime.enable');
  let chosen;
  for(const c of contexts.filter(c=>!c.auxData?.isDefault)){
    const r=await cdp.send('Runtime.evaluate',{contextId:c.id,expression:'typeof ButterBranch !== "undefined"',returnByValue:true}).catch(()=>null);
    if(r?.result.value){chosen=c.id;break;}
  }
  assert.ok(chosen,'Butter isolated world exists');
  await cdp.send('Runtime.evaluate',{contextId:chosen,expression:`(()=>{
    globalThis.__branchContentProbe=[];
    if(globalThis.__branchContentProbeInstalled)return;
    globalThis.__branchContentProbeInstalled=true;
    const send=chrome.runtime.sendMessage.bind(chrome.runtime);
    const open=window.open;
    window.open=function(...args){__branchContentProbe.push({openUrl:args[0]});return open.apply(this,args);};
    chrome.runtime.sendMessage=(...args)=>{
      const type=args[0]?.type;
      if(!type?.startsWith('butter-branch-'))return send(...args);
      try{return send(...args).then(result=>{__branchContentProbe.push({type,result:{ok:result?.ok,error:result?.error,missing:result?.missing,hasJob:!!result?.job}});return result;},e=>{__branchContentProbe.push({type,rejected:e.message});throw e;});}
      catch(e){__branchContentProbe.push({type,threw:e.message});throw e;}
    };
    chrome.runtime.onMessage.addListener(m=>{if(m?.type?.startsWith('butter-branch-'))__branchContentProbe.push({received:m.type});});
  })()`});
  return {cdp,id:chosen};
}
const waitReady = async p => {
  await p.locator('.ProseMirror[contenteditable="true"]:visible').first().waitFor({timeout:60000});
  await p.locator('[data-markdown-text-style="assistant-message"]').first().waitFor({state:'attached',timeout:60000});
  await p.waitForTimeout(1800);
};
async function select(p) {
  await p.bringToFront();
  await p.keyboard.press('Escape');
  const point=await p.evaluate(()=>{
    const replies=[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
    for(const reply of replies.reverse()){
      const walk=document.createTreeWalker(reply,NodeFilter.SHOW_TEXT);
      for(let n;n=walk.nextNode();){
        if(n.textContent.trim().length<16||n.parentElement.closest('.katex,math,code,pre,button,svg,a'))continue;
        n.parentElement.scrollIntoView({block:'center',behavior:'instant'});
        const s=n.textContent.search(/\S/), r=document.createRange();r.setStart(n,s);r.setEnd(n,Math.min(s+16,n.textContent.length));
        const rect=r.getClientRects()[0];if(!rect||rect.top<80||rect.bottom>innerHeight-140)continue;
        return {x1:rect.left+1,x2:rect.right-1,y:rect.top+rect.height/2};
      }
    }
  });
  assert.ok(point,'selectable assistant text');await p.waitForTimeout(300);
  await p.mouse.move(point.x1,point.y);await p.mouse.down();await p.mouse.move(point.x2,point.y,{steps:12});await p.mouse.up();
  await p.locator('chatgpt-butter-branch .chip').waitFor({timeout:8000});
  await p.locator('chatgpt-butter-branch .chip').dispatchEvent('pointerdown',{button:0});
  await p.locator('chatgpt-butter-branch textarea').waitFor({timeout:3000});
}
async function attempt(p,label,{reload=false,observeMs=6500}={}){
  if(reload){await p.reload({waitUntil:'domcontentloaded'});await waitReady(p);}
  const probe=await contentProbe(p);await select(p);
  const original=p.url();const composer=await p.locator('.ProseMirror:visible').first().textContent();
  const starts=[];
  const onReq=r=>{if(r.isNavigationRequest()&&r.url().startsWith('https://chatgpt.com'))starts.push({url:cleanUrl(r.url())});};context.on('request',onReq);
  const oldPages=new Set(context.pages());
  await p.locator('chatgpt-butter-branch textarea').fill('什么是source scc');
  const start=Date.now();await p.locator('chatgpt-butter-branch textarea').press('Enter');
  await p.waitForTimeout(observeMs);
  const content=await probe.cdp.send('Runtime.evaluate',{contextId:probe.id,expression:'globalThis.__branchContentProbe',returnByValue:true}).then(r=>(r.result.value||[]).map(e=>e.openUrl?{openUrl:cleanUrl(e.openUrl)}:e)).catch(()=>[]);
  const reason=await p.evaluate(()=>document.querySelector('chatgpt-butter-branch')?.shadowRoot.querySelector('.reason')?.textContent||null);
  const created=context.pages().filter(x=>!oldPages.has(x));
  const newTabs=[];
  for(const tab of created){newTabs.push({url:cleanUrl(tab.url()),initial:await tab.evaluate(()=>window.__branchInitialUrl).then(cleanUrl).catch(()=>null)});await tab.close();}
  context.off('request',onReq);
  const row={label,original:cleanUrl(original),elapsedMs:Date.now()-start,reason,content,worker:await workerEvents(),navigationRequests:starts,newTabs,
    originalUnchanged:p.url()===original && (await p.locator('.ProseMirror:visible').first().textContent())===composer};
  events.push(row);console.log(JSON.stringify(row));
  await fs.writeFile(new URL(`${mode}.json`,out),JSON.stringify({at:new Date().toISOString(),lab:lab.id,mode,events},null,2)+'\n');
  await probe.cdp.detach();return row;
}
try{
  await context.addInitScript(()=>{window.__branchInitialUrl=location.href;});
  let p=context.pages().find(p=>p.url().startsWith('https://chatgpt.com'))||await context.newPage();
  for(const extra of context.pages())if(extra!==p)await extra.close();
  if(mode==='baseline'){
    await p.goto(L.fixture(lab,'math12'),{waitUntil:'domcontentloaded'});await waitReady(p);
    const urls=await p.evaluate(()=>({project:location.href,normal:[...document.querySelectorAll('a[href^="/c/"]')].map(a=>a.href),otherProject:[...document.querySelectorAll('a[href^="/g/g-p-"]')].filter(a=>a.pathname.includes('/c/')).map(a=>a.href)}));
    await fs.writeFile(stateFile,JSON.stringify(urls),{mode:0o600});
    await instrumentWorker();
    await attempt(p,'project-fresh-document',{reload:true});
    assert.ok(urls.normal.length,'normal conversation link');
    let normal;
    for(const url of urls.normal){
      await p.goto(url,{waitUntil:'domcontentloaded'});await waitReady(p);
      const probe=await contentProbe(p);
      const facts=await probe.cdp.send('Runtime.evaluate',{contextId:probe.id,expression:'ButterBranchPage.facts()',returnByValue:true});await probe.cdp.detach();
      console.log(JSON.stringify({candidate:cleanUrl(p.url()),facts:facts.result.value}));
      if(!facts.result.value.work && !p.url().includes('/g/')){normal=p.url();break;}
    }
    assert.ok(normal,'normal chat outside Work mode');urls.normal=[normal];await fs.writeFile(stateFile,JSON.stringify(urls),{mode:0o600});
    await attempt(p,'normal-fresh-document');
  }else if(mode==='spa'){
    const urls=JSON.parse(await fs.readFile(stateFile,'utf8'));await instrumentWorker();
    await p.goto(urls.normal[0],{waitUntil:'domcontentloaded'});await waitReady(p);
    await p.waitForFunction(target=>[...document.querySelectorAll('a')].some(a=>a.pathname.split('/c/')[1]===new URL(target).pathname.split('/c/')[1]),urls.project,{timeout:20000});
    const href=await p.evaluate(target=>{
      const id=new URL(target).pathname.split('/c/')[1];
      return [...document.querySelectorAll('a')].find(a=>a.pathname.split('/c/')[1]===id)?.getAttribute('href');
    },urls.project);
    assert.ok(href,'project conversation in sidebar');
    const start=p.url();await p.locator(`a[href="${href}"]`).first().click();
    await p.waitForURL(u=>u.href!==start);await waitReady(p);
    const failed=await attempt(p,'normal-to-project-SPA');
    const repaired=await attempt(p,'same-project-after-reload',{reload:true});
    assert.equal(repaired.reason,null,'reload control should hand over');
    assert.equal(failed.reason,null,'Ask in branch should hand over after sidebar navigation');
  }else if(mode==='navigation'){
    const urls=JSON.parse(await fs.readFile(stateFile,'utf8'));await instrumentWorker();
    for(const kind of ['normal','project']){
      await p.goto(urls.project,{waitUntil:'domcontentloaded'});await waitReady(p);
      const target=kind==='normal'?urls.normal[0]:urls.otherProject.find(u=>new URL(u).pathname.split('/c/')[1]!==new URL(urls.project).pathname.split('/c/')[1]);
      assert.ok(target,'another saved conversation');
      await p.waitForFunction(target=>[...document.querySelectorAll('a')].some(a=>a.pathname.split('/c/')[1]===new URL(target).pathname.split('/c/')[1]),target,{timeout:20000});
      const href=await p.evaluate(target=>[...document.querySelectorAll('a')].find(a=>a.pathname.split('/c/')[1]===new URL(target).pathname.split('/c/')[1])?.getAttribute('href'),target);
      assert.ok(href,'target in sidebar');
      const before=p.url();await p.locator(`a[href="${href}"]`).first().click();await p.waitForURL(u=>u.href!==before);await waitReady(p);
      await attempt(p,`project-to-${kind}-SPA`);
    }
  }else if(mode==='idle'){
    const urls=JSON.parse(await fs.readFile(stateFile,'utf8'));
    await p.goto(urls.project,{waitUntil:'domcontentloaded'});await waitReady(p);
    const before=(await (await fetch(`${lab.cdpUrl}/json/list`)).json()).filter(t=>t.type==='service_worker').length;
    console.log(JSON.stringify({step:'idle-start',workerTargets:before,waitMs:36000,disconnectingCDP:true}));
    await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();
    await new Promise(ok=>setTimeout(ok,36000));
    const after=(await (await fetch(`${lab.cdpUrl}/json/list`)).json()).filter(t=>t.type==='service_worker').length;
    events.push({step:'idle-end',workerTargets:after,waitMs:36000});console.log(JSON.stringify(events.at(-1)));
    ({browser,context}=await L.connect(lab));await L.sendGuard(context,lab);
    await context.addInitScript(()=>{window.__branchInitialUrl=location.href;});
    p=context.pages().find(p=>p.url().startsWith('https://chatgpt.com'));
    const row=await attempt(p,'project-after-36s-worker-idle');
    assert.ok(row.content.some(e=>e.received==='butter-branch-claimed'),'idle control claims handoff');
  }else if(mode==='slow'){
    const urls=JSON.parse(await fs.readFile(stateFile,'utf8'));
    await p.goto(urls.project,{waitUntil:'domcontentloaded'});await waitReady(p);await instrumentWorker();
    let delayed=false;
    const gate=async route=>{
      const r=route.request();
      // Popup's first navigation can arrive before Playwright has a Frame object.
      // The original stays put; only the popup navigates to this same conversation here.
      if(!delayed&&r.isNavigationRequest()&&r.url().startsWith('https://chatgpt.com')&&new URL(r.url()).pathname===new URL(p.url()).pathname){
        delayed=true;await new Promise(ok=>setTimeout(ok,15000));
      }
      await route.fallback();
    };
    await context.route('**/*',gate);
    const row=await attempt(p,'project-new-tab-navigation-delayed-15s',{observeMs:22000});
    await context.unroute('**/*',gate);events.push({delayed});
    assert.ok(delayed,'new-tab navigation was delayed');
    assert.ok(row.content.some(e=>e.received==='butter-branch-claimed'),'slow control claims handoff');
  }else if(mode==='reload'){
    const urls=JSON.parse(await fs.readFile(stateFile,'utf8'));
    await p.goto(urls.project,{waitUntil:'domcontentloaded'});await waitReady(p);
    const worker=context.serviceWorkers().find(w=>w.url().includes('/storage/layout-worker.js'));
    assert.ok(worker,'worker available to reload extension');
    await worker.evaluate(()=>chrome.runtime.reload()).catch(()=>{});
    await p.waitForTimeout(2000);
    const stale=await attempt(p,'project-open-tab-after-extension-reload');
    await p.reload({waitUntil:'domcontentloaded'});await waitReady(p);await instrumentWorker();
    const fresh=await attempt(p,'project-after-page-reload-repairs-context');
    assert.equal(stale.reason,'Couldn’t hand your question to the new tab. Try again.');
    assert.ok(fresh.content.some(e=>e.received==='butter-branch-claimed'),'page reload repairs context');
  }else if(mode==='control'){
    const urls=JSON.parse(await fs.readFile(stateFile,'utf8'));
    for(const [label,url] of [['project',urls.project],['normal',urls.normal[0]]]){
      await p.goto(url,{waitUntil:'domcontentloaded'});await waitReady(p);
      const row={label,kind:'no-extension-control',url:cleanUrl(p.url()),markdownReplies:await p.locator('[data-markdown-text-style="assistant-message"]').count(),composer:await p.locator('.ProseMirror:visible').count(),branchHost:await p.locator('chatgpt-butter-branch').count(),workers:context.serviceWorkers().length};
      events.push(row);console.log(JSON.stringify(row));
    }
  }else throw new Error('unknown mode');
  await fs.writeFile(new URL(`${mode}.json`,out),JSON.stringify({at:new Date().toISOString(),lab:lab.id,mode,events},null,2)+'\n');
} finally {workerCDP?.close();await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();}
