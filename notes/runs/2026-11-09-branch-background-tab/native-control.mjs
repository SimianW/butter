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
const stage='streaming';
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
const url=source.url(), original=/\/c\/([^/?#]+)/.exec(url)[1];
let savedTail=null;
if(stage.startsWith('streaming')){
 for(let i=0;i<100&&!serverData;i++)await sleep(100);assert.ok(serverData?.current_node,JSON.stringify({serverKeys:Object.keys(serverData||{})}));savedTail=serverData.current_node;
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
const dest=await context.newPage();await dest.bringToFront();await dest.goto(url,{waitUntil:'domcontentloaded'});
await dest.locator('.ProseMirror:visible').first().waitFor();await sleep(2500);
await dest.locator('.ProseMirror:visible').first().fill('');await dest.locator('.ProseMirror:visible').first().pressSequentially('Local replay only.',{delay:20});
 for(let i=0;i<100;i++){if(await dest.evaluate(()=>[...document.querySelectorAll('button[aria-label="Send"]')].some(b=>b.getBoundingClientRect().width>0&&!b.disabled)))break;await sleep(100)}await sleep(300);
await dest.evaluate(()=>[...document.querySelectorAll('button[aria-label="Send"]')].find(b=>b.getBoundingClientRect().width>0&&!b.disabled)?.click());
for(let i=0;i<100;i++){if(await dest.evaluate(()=>window.__bgReplay?.started))break;await sleep(100)}
assert.equal(await dest.evaluate(()=>window.__bgReplay?.started),true);
await source.bringToFront();const start=Date.now(),samples=[];
const read=()=>dest.evaluate(()=>({hidden:document.hidden,frames:window.__bgProbe.frames,timers:window.__bgProbe.timers,replay:window.__bgReplay,streaming:!!document.querySelector('[data-talvt-turn-state="in_progress"],[data-testid="stop-button"]'),butter:!!window.__butterStats||document.documentElement.hasAttribute('data-butter-lang')}));
for(let i=0;i<30;i++){samples.push({ms:Date.now()-start,...await read()});await sleep(1000)}
// Drive ChatGPT's own menu through DOM events. Polling runs in Node, so browser page-timer
// throttling cannot pause this control driver. No Butter code is injected.
const wait=async f=>{for(let i=0;i<100;i++){if(await dest.evaluate(f))return;await sleep(100)}throw Error('native menu missing')};
await wait(()=>{const replies=[...document.querySelectorAll('[data-markdown-text-style="assistant-message"]')];const turn=replies.at(-1)?.closest('[data-turn-key],[data-testid^="conversation-turn-"],article');const b=[...(turn?.querySelectorAll('button')||[])].find(b=>b.getBoundingClientRect().width>0&&[...b.querySelectorAll('use')].some(u=>/icon-ellipsis-horizontal/.test(u.getAttribute('href'))));if(!b)return false;const init={bubbles:true,cancelable:true,pointerType:'mouse',button:0};b.dispatchEvent(new PointerEvent('pointerdown',{...init,buttons:1}));b.dispatchEvent(new PointerEvent('pointerup',init));return true});
await wait(()=>{const b=[...document.querySelectorAll('[role=menuitem][aria-haspopup=menu]')].find(b=>b.querySelector('use[href*="icon-branch"]'));if(!b)return false;b.click();return true});
await wait(()=>{const b=[...document.querySelectorAll('[role=menuitem]')].find(b=>b.textContent.trim()==='Branch in new chat');if(!b)return false;b.click();return true});
let branched=false;for(let i=0;i<150;i++){branched=await dest.evaluate(original=>{const id=/\/c\/([^/?#]+)/.exec(location.pathname)?.[1];return !!id&&id!==original&&!!document.querySelector('.ProseMirror')&&document.querySelectorAll('[data-markdown-text-style="assistant-message"]').length>0},original);if(branched)break;await sleep(100)}
const result={samples,end:await read(),nativeBranchRendered:branched};console.log(JSON.stringify({end:result.end,nativeBranchRendered:branched}));await fs.writeFile(process.env.OUTPUT||'/tmp/bg-control.json',JSON.stringify(result,null,2)+'\n');await dest.close();await context.unrouteAll({behavior:'ignoreErrors'});await browser.close();assert.ok(branched);assert.equal(result.end.butter,false);assert.ok(samples.every(s=>s.hidden));assert.equal(new Set(samples.map(s=>s.frames)).size,1);assert.equal(result.end.replay.done,true);
