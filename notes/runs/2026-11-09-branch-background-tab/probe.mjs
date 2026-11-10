// Run on the lab host while holding LAB_OWNER's lock. No chat text or IDs are written.
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const L = await import(pathToFileURL(path.join(os.homedir(), '.local/share/chatgpt-lab/lib/lab.mjs')));
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const lab=L.getLab(process.env.LAB_ID||1), owner=process.env.LAB_OWNER;
assert.equal((await fs.readFile(`${lab.lockPath}/owner`,'utf8')).split('\n')[0],owner);
const {chromium}=await L.playwright();
let browser;for(let i=0;i<100;i++){try{browser=await chromium.connectOverCDP(lab.cdpUrl,{noDefaults:true});break}catch(e){if(i===99)throw e;await new Promise(r=>setTimeout(r,100))}}
const context=browser.contexts()[0];
const keep=context.pages().find(p=>!p.url().includes('bgstream'))||context.pages()[0];for(const p of context.pages())if(p!==keep)await p.close();
await L.sendGuard(context,lab);
await context.route('**/backend-api/conversation/new_branch',r=>r.request().method()==='POST'?r.continue():r.fallback());
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const stage=process.env.STAGE||'immediate';
const shim=false;
await context.addInitScript(()=>{
 window.__bgProbe={frames:0,timers:0,visibility:[]};
 const p=window.__bgProbe;const loop=()=>{p.frames++;requestAnimationFrame(loop)};requestAnimationFrame(loop);
 setInterval(()=>p.timers++,100);
 document.addEventListener('visibilitychange',()=>p.visibility.push({hidden:document.hidden,at:Math.round(performance.now())}));
 document.addEventListener('freeze',()=>p.frozen=true);
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-testid="send-button"],button[aria-label="Send"],button[aria-label="Send prompt"]'))p.sendClicks=(p.sendClicks||0)+1},true);
});
const source=context.pages().find(p=>p.url().startsWith('https://chatgpt.com'))||await context.newPage();
let serverData;source.on('response',async r=>{if(r.request().method()==='GET'&&/\/backend-api\/conversations?\/[0-9a-f-]+(?:\?|$)/.test(r.url()))serverData=await r.json().catch(()=>null)});
await source.bringToFront();
await source.goto(L.fixture(lab,'math12'),{waitUntil:'domcontentloaded'});
await source.locator('.ProseMirror').first().waitFor({timeout:60000});
const id=crypto.randomUUID(), url=source.url(), original=/\/c\/([^/?#]+)/.exec(url)[1];
for(let i=0;i<100&&!serverData;i++)await sleep(100);assert.ok(serverData?.current_node,JSON.stringify({serverKeys:Object.keys(serverData||{})}));
let savedTail=serverData.current_node;
if(stage.startsWith('streaming')){
 // The replay's message IDs never reached the server. Ask the native endpoint to branch
 // from the real saved tail, after the replay has exercised the real streaming UI.
 await context.route('**/backend-api/conversation/new_branch',r=>{
  const body=r.request().postDataJSON();body.message_id=savedTail;
  return r.continue({postData:JSON.stringify(body)});
 });
 const rec=JSON.parse(await fs.readFile(path.join(os.homedir(),'.local/share/chatgpt-lab/harness/recordings/t09.json'),'utf8')).streams[0];
 const body=JSON.parse(rec.reqBody), first=rec.chunks[0][0],last=rec.chunks.at(-1)[0];
 const R={inputId:body.messages[0].id,convId:body.conversation_id,original,schedule:rec.chunks.map(([t,s])=>[200+(t-first)/(last-first)*10000,s])};
 await context.addInitScript(R=>{
  const st=window.__bgReplay={started:false,done:false,chunks:0,mocks:[]};const native=window.fetch;
  window.fetch=async function(input,init){
   const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
   if(/\/sentinel\//.test(url)||/\/conversation\/prepare(?:\?|$)/.test(url)){
    st.mocks.push(/sentinel/.test(url)?'sentinel':'prepare');
    return new Response(JSON.stringify({token:'local-replay',proofofwork:{required:false},turnstile:{required:false}}),{status:200,headers:{'content-type':'application/json'}});
   }
   if(/\/f\/conversation(?:\?|$)/.test(url)&&(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase()==='POST'&&!st.started){
    const body=JSON.parse(init?.body||(input instanceof Request?await input.clone().text():'{}'));st.started=true;
    const ids=new Map([[R.inputId,body.messages[0].id],[R.convId,R.original]]);
    const remap=s=>s.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi,id=>{if(!ids.has(id))ids.set(id,crypto.randomUUID());return ids.get(id)});
    const t0=performance.now(),enc=new TextEncoder();
    return new Response(new ReadableStream({async start(c){for(const [at,s]of R.schedule){const wait=at-(performance.now()-t0);if(wait>0)await new Promise(r=>setTimeout(r,wait));c.enqueue(enc.encode(remap(s)));st.chunks++}c.close();st.done=true}}),{status:200,headers:{'content-type':'text/event-stream; charset=utf-8'}});
   }
   return native.apply(this,arguments);
  };
 },R);
}
const fromUI=process.env.UI==='1';let dest,worker;const start=Date.now();
if(fromUI){
 await sleep(2500);
 const box=await source.evaluate(()=>{
  const replies=[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')];
  for(const reply of replies.slice(0,-1).reverse()){
   const walk=document.createTreeWalker(reply,NodeFilter.SHOW_TEXT);
   for(let n;(n=walk.nextNode());){if(n.textContent.trim().length<40||n.parentElement.closest('.katex,math,code,pre,button,svg,a'))continue;
    n.parentElement.scrollIntoView({block:'center',behavior:'instant'});const r=document.createRange(),i=n.textContent.search(/\S/);r.setStart(n,i);r.setEnd(n,i+30);const b=r.getClientRects()[0];if(b&&b.top>80&&b.bottom<innerHeight-200)return{x1:b.left+1,x2:b.right-1,y:b.top+b.height/2};
   }
  }
 });assert.ok(box,'a plain passage can be selected');
 await source.mouse.move(box.x1,box.y);await source.mouse.down();await source.mouse.move(box.x2,box.y,{steps:10});await source.mouse.up();
 const host='chatgpt-butter-branch';await source.locator(`${host} .chip`).waitFor({timeout:10000});await source.locator(`${host} .chip`).click();
 await source.locator(`${host} textarea`).fill('Explain briefly.');const opened=context.waitForEvent('page');await source.locator(`${host} textarea`).press('Enter');dest=await opened;
}else{
 worker=context.serviceWorkers()[0]||await context.waitForEvent('serviceworker');
 const put=await worker.evaluate(async({id,original,url})=>ButterBranch.handoff(chrome.storage.session).put(id,{original,title:'Public probe',quote:'Public probe passage.',question:'Explain briefly.'},{tab:{id:999999,url}},Date.now()),{id,original,url});assert.equal(put.ok,true);
 dest=await context.newPage();
}
const req=[];dest.on('requestfailed',r=>{if(/\/f\/conversation(?:\/prepare)?(?:\?|$)/.test(r.url()))req.push({blockedSend:r.failure()?.errorText,ms:Date.now()-start})});dest.on('response',r=>{if(/new_branch$/.test(new URL(r.url()).pathname))req.push({branchResponse:r.status(),ms:Date.now()-start})});dest.on('request',r=>{const p=new URL(r.url()).pathname;if(r.method()==='POST'&&(/new_branch$/.test(p)||/conversation(?:\/prepare)?$/.test(p)))req.push({keys:Object.keys(r.postDataJSON()||{}),tailMatches:r.postDataJSON()?.message_id===savedTail,branch:/new_branch$/.test(p),send:!(/new_branch$/.test(p)),ms:Date.now()-start})});
if(!fromUI){await dest.bringToFront();
await dest.goto(`${url}${stage.startsWith('streaming')?'?bgstream=1':''}#butter-branch=${id}`,{waitUntil:stage==='immediate'?'commit':'domcontentloaded'});}
if(stage.startsWith('streaming')){
 await dest.locator('.ProseMirror:visible').first().waitFor({timeout:60000});await sleep(2500);
 await dest.locator('.ProseMirror:visible').first().fill('');await dest.locator('.ProseMirror:visible').first().pressSequentially('Local replay only.',{delay:20});
 for(let i=0;i<100;i++){if(await dest.evaluate(()=>[...document.querySelectorAll('button[aria-label="Send"]')].some(b=>b.getBoundingClientRect().width>0&&!b.disabled)))break;await sleep(100)}
 await sleep(200);
 await dest.evaluate(()=>[...document.querySelectorAll('button[aria-label="Send"],[data-testid="send-button"]')].find(b=>b.getBoundingClientRect().width>0&&!b.disabled)?.click());
 for(let i=0;i<100;i++){if(await dest.evaluate(()=>window.__bgReplay?.started))break;await sleep(100)}
 assert.equal(await dest.evaluate(()=>window.__bgReplay?.started),true,'the local stream reached the real page');
}
if(stage!=='immediate'&&!stage.endsWith('visible')&&!stage.startsWith('streaming')){
 for(let i=0;i<200;i++){if(await dest.evaluate(()=>document.documentElement.dataset.backgroundState==='branching'))break;await sleep(50)}
}
if(stage.endsWith('visible'))await dest.bringToFront();else await source.bringToFront();
const read=()=>dest.evaluate(()=>({hidden:document.hidden,replay:window.__bgReplay,state:document.documentElement.dataset.backgroundState,cause:document.documentElement.dataset.backgroundCause,claim:document.documentElement.dataset.bgClaim,incoming:document.documentElement.dataset.bgIncoming,started:document.documentElement.dataset.bgStarted,sleeps:document.documentElement.dataset.bgSleeps,lastSleep:document.documentElement.dataset.bgLastSleep,frames:window.__bgProbe?.frames,timers:window.__bgProbe?.timers,visibility:window.__bgProbe?.visibility,sendClicks:window.__bgProbe?.sendClicks||0,smoother:window.__butterStats,latestLength:[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')].at(-1)?.textContent.length,frozen:window.__bgProbe?.frozen||false,streaming:!!document.querySelector('[data-talvt-turn-state="in_progress"],[data-testid="stop-button"]'),replies:document.querySelectorAll('[data-markdown-text-style="assistant-message"]').length,menus:[...document.querySelectorAll('[role="menuitem"]')].map(e=>({branch:/Branch|分支/.test(e.textContent),submenu:e.getAttribute('aria-haspopup')==='menu',rects:e.getClientRects().length,visibility:getComputedStyle(e).visibility})),composer:!!document.querySelector('.ProseMirror')}));
const samples=[];
for(let i=0;i<35;i++){samples.push({ms:Date.now()-start,...await read()});if(['ready','failed','unsure'].includes(samples.at(-1).state))break;await sleep(1000)}
const hiddenEnd=samples.at(-1);
let resumed=null;if(!stage.endsWith('visible')&&hiddenEnd.state!=='ready'){await dest.bringToFront();for(let i=0;i<25;i++){resumed=await read();if(['ready','failed','unsure'].includes(resumed.state))break;await sleep(1000)}}
worker ||= context.serviceWorkers()[0];let workerIdle=null;if(worker&&hiddenEnd.state==='ready'){
 const before=await worker.evaluate(()=>globalThis.__bgDelays);await sleep(1500);const after=await worker.evaluate(()=>globalThis.__bgDelays);workerIdle={before,after};
}
const result={stage,fromUI,shim:!!shim,samples,requests:req,hiddenEnd,resumed,workerIdle};
console.log(JSON.stringify({stage,fromUI,shim:!!shim,hiddenEnd,resumed,requests:req,workerIdle}));
await fs.writeFile(process.env.OUTPUT||'/tmp/branch-background-result.json',JSON.stringify(result,null,2)+'\n');
await dest.close();await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();
if(stage.endsWith('visible'))assert.ok(samples.every(s=>!s.hidden),'the visible path stayed visible');
if(!stage.endsWith('visible')) {
 assert.ok(samples.every(s=>s.hidden),'the run remained hidden');
 assert.equal(new Set(samples.slice(2).map(s=>s.frames)).size,1,'native rAF stopped');
}
if(process.env.EXPECT_READY){
 assert.equal(hiddenEnd.state,'ready');
 assert.equal(req.filter(r=>r.branch).length,1,'one native branch request');
 assert.ok(req.some(r=>r.branchResponse===200),'native branch succeeded');
 assert.ok(req.some(r=>r.blockedSend),'the final send pipeline was blocked');
 if(workerIdle)assert.deepEqual(workerIdle.before,workerIdle.after,'no polling after ready');
}
