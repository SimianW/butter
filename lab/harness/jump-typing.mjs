// Private CHAT env only. Fixed-clock CDP input; never presses Enter or sends a message.
// Run from lab/harness: CHAT=... EXT=... node jump-typing.mjs MODE [REPS=3]
// TS=2,10 TRACE=1 CHECK=1; artifacts and any private traces remain in scratch/.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {railDeps} from './rail-scripts.mjs';
const CHAT=process.env.CHAT;if(!CHAT)throw Error('Set CHAT');
const tickIndex=+(process.env.TICK??0);
const mode=process.argv[2]??'current',reps=+(process.argv[3]??3),times=(process.env.TS??'2,10').split(',').map(Number);
const root=path.resolve(new URL('../..',import.meta.url).pathname),out=path.join(root,'lab/harness/scratch/jump-typing',mode);fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,16);
const safe=s=>String(s).replace(/https?:\/\/[^\s"'<>]+/g,'[URL]').replace(/[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}/gi,'[ID]');
const stat=a=>{a=a.filter(Number.isFinite).sort((x,y)=>x-y);return {n:a.length,p50:a[Math.floor(a.length*.5)]??null,p95:a[Math.min(a.length-1,Math.floor(a.length*.95))]??null,max:a.at(-1)??null}};
if(+process.env.PREWAIT_MS)await sleep(+process.env.PREWAIT_MS);
if(process.env.EXT!==undefined){execFileSync(path.join(root,'lab/lab'),['restart-browser'],{env:{...process.env,LAB_EXTENSIONS:process.env.EXT},stdio:'ignore'});for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:9222/json/version');break}catch{await sleep(500)}}await sleep(1500)}
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),ctx=b.contexts()[0];
const p=ctx.pages().find(p=>p.url().startsWith('https://chatgpt.com'))??await ctx.newPage();await p.bringToFront();
const cdp=await ctx.newCDPSession(p),input=await ctx.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
let rateLimitUntil=0;const RATE_MS=60000;
p.on('response',r=>{if(r.status()===429&&r.url().includes('/backend-api/conversation'))rateLimitUntil=Math.max(rateLimitUntil,Date.now()+(Number(r.headers()['retry-after'])||RATE_MS/1000)*1000)});
async function gotoChat(){if(rateLimitUntil>Date.now()){const ms=rateLimitUntil-Date.now();console.log('BACKOFF429 '+ms+'ms');await sleep(ms)}return p.goto(CHAT,{waitUntil:'domcontentloaded',timeout:90000})}
let requests=[],jobs=[],errors=[],headers=null,active=false,received=new Map();
p.on('pageerror',e=>{if(active)errors.push(safe(e.message))});
cdp.on('Network.requestWillBeSent',e=>{const u=new URL(e.request.url);if(!/\/backend-api\/conversations?\/[a-f\d-]{36}(\/messages)?$/.test(u.pathname))return;
 if(e.request.method!=='GET')return;const r={id:e.requestId,kind:u.pathname.endsWith('/messages')?'older':'initial',numTurns:u.searchParams.get('num_turns'),start:Date.now(),status:null};if(active){requests.push(r);received.set(e.requestId,r)}
 headers=e.request.headers;
});
cdp.on('Network.responseReceived',e=>{const r=received.get(e.requestId);if(r){r.status=e.response.status;r.mime=e.response.mimeType}});
function messages(j){if(Array.isArray(j.messages))return j.messages;if(j.mapping){const a=[];for(let n=j.mapping[j.current_node],seen=new Set();n&&!seen.has(n);n=j.mapping[n.parent]){seen.add(n);if(n.message)a.push(n.message)}return a.reverse()}return []}
function payload(j){const m=messages(j),q=m.filter(m=>m.author?.role==='user'&&!m.metadata?.is_visually_hidden_from_conversation&&['text','multimodal_text'].includes(m.content?.content_type));return {messages:m.length,questions:q.length,messageHashes:m.map(m=>sha(m.id)),questionHashes:q.map(m=>sha(m.id)),hasPrevious:!!j.page_info?.has_previous_page}}
cdp.on('Network.loadingFinished',e=>{const r=received.get(e.requestId);if(!r)return;r.end=Date.now();r.encodedBytes=e.encodedDataLength;jobs.push(cdp.send('Network.getResponseBody',{requestId:e.requestId}).then(x=>{const s=x.base64Encoded?Buffer.from(x.body,'base64').toString():x.body;r.decodedBytes=Buffer.byteLength(s);try{Object.assign(r,payload(JSON.parse(s)))}catch{r.parseError=true}}).catch(e=>{r.bodyError=safe(e.message)}))});
await p.addInitScript(()=>{
 const s=window.__jumpProbe={events:[],longtasks:[],loafs:[],keys:[],frames:[],pages:[],running:true,click:null,landed:null,target:null,ready:null,last:0};
 const po=(type,key,map,opts={})=>{try{const o=new PerformanceObserver(l=>s[key].push(...l.getEntries().map(map)));o.observe({type,buffered:true,...opts})}catch{}};
 po('event','events',e=>({name:e.name,start:e.startTime,duration:e.duration,delay:e.processingStart-e.startTime,processing:e.processingEnd-e.processingStart,id:e.interactionId}),{durationThreshold:16});
 po('longtask','longtasks',e=>({start:e.startTime,duration:e.duration}));
 po('long-animation-frame','loafs',e=>({start:e.startTime,duration:e.duration,blockingDuration:e.blockingDuration,styleAndLayoutStart:e.styleAndLayoutStart,renderStart:e.renderStart,scripts:e.scripts.map(x=>({invoker:x.invoker,invokerType:x.invokerType,sourceURL:x.sourceURL,sourceFunctionName:x.sourceFunctionName,duration:x.duration,forcedStyleAndLayoutDuration:x.forcedStyleAndLayoutDuration}))}));
 document.addEventListener('butter-nav',e=>{try{const d=JSON.parse(e.detail);if(d.type==='page')s.pages.push(d)}catch{}});
 addEventListener('keydown',e=>{if(e.target.closest?.('.ProseMirror'))s.keys.push({start:e.timeStamp,at:performance.now(),delay:performance.now()-e.timeStamp,key:e.key.length===1?'ascii':e.key})},true);
 // Preserve editor focus while clicking the rail. No post-click renderer RPC gates input dispatch.
 addEventListener('mousedown',e=>{if(e.composedPath().some(e=>e?.classList?.contains('tick')))e.preventDefault()},true);
 addEventListener('click',e=>{
  s.lastPhysicalClick={at:performance.now(),tag:e.target.tagName,railOn:!!document.querySelector('chatgpt-butter-nav[data-on]'),ticks:document.querySelector('chatgpt-butter-nav')?.shadowRoot?.querySelectorAll('.tick').length??0};
  const tick=e.composedPath().find(e=>e?.classList?.contains('tick'));if(!tick)return;
  s.clickTickCount=tick.parentElement.querySelectorAll('.tick').length;s.clickHasEarlier=!document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more').hidden;s.clickedIndex=[...tick.parentElement.querySelectorAll('.tick')].indexOf(tick);s.click=performance.now();s.landed=null;s.targetLabel=tick.getAttribute('aria-label');
  s.target=s.pages.flatMap(x=>x.items).find(x=>x.q?.slice(0,120)===s.targetLabel)?.id??null;
  performance.mark('jump-start');window.__jumpClick?.(String(performance.timeOrigin+s.click));
 },true);
 function frame(t){if(!s.running)return;if(s.last)s.frames.push({start:s.last,duration:t-s.last});s.last=t;
  const editor=document.querySelector('.ProseMirror');if(editor&&s.ready===null){s.ready=performance.now();performance.mark('composer-ready');if(!editor.textContent.trim())editor.focus({preventScroll:true})}
  if(editor&&s.editor!==editor){s.editor=editor;if(!editor.textContent.trim())editor.focus({preventScroll:true})}
  if(!s.railReady&&editor&&document.querySelector('chatgpt-butter-nav[data-on]')?.shadowRoot?.querySelector('.tick')){s.railReady=performance.now();performance.mark('rail-ready');window.__jumpReady?.(String(performance.timeOrigin+s.railReady))}
  if(s.click&&!s.landed){const sc=document.querySelector('.thread-scroll-container');let el=s.target?document.querySelector(`[data-turn-key="${s.target}"]`):null;
   if(!el&&sc)el=[...sc.querySelectorAll('[data-turn-key]')].find(t=>t.querySelector('[data-user-message-bubble]')?.textContent.trim().startsWith(s.targetLabel));
   if(el&&sc){const top=el.getBoundingClientRect().top-sc.getBoundingClientRect().top;s.lastTargetTop=top;const root=document.querySelector('chatgpt-butter-nav')?.shadowRoot;
    const visible=!root?.querySelector('.tick.busy')&&getComputedStyle(root.querySelector('.warp')).visibility==='hidden';
    if(Math.abs(top-64)<=4&&visible){s.alignedSince??=t;if(t-s.alignedSince>150){s.landed=t;performance.mark('jump-landed')}}else s.alignedSince=null;
   }
  }requestAnimationFrame(frame)
 }requestAnimationFrame(frame);
});
if(mode==='stock'){
 // Navigation-only control: native ChatGPT rendering plus the exact production jump algorithm.
 await p.addInitScript({content:fs.readFileSync(path.join(root,'extension/history/conversation-main.js'),'utf8')+'\n'+railDeps().join('\n')+'\n'+fs.readFileSync(path.join(root,'extension/rail/rail.js'),'utf8')+`\n(()=>{const seen=new WeakSet();const scan=()=>{for(const e of document.querySelectorAll('[data-turn-key]'))if(!seen.has(e)){seen.add(e);globalThis.butterNavTurn(e)}};new MutationObserver(scan).observe(document,{subtree:true,childList:true});})();`});
}
async function traceStop(file){const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await done;const f=fs.createWriteStream(file);for(;;){const x=await cdp.send('IO.read',{handle:stream,size:1<<20});f.write(x.base64Encoded?Buffer.from(x.data,'base64'):x.data);if(x.eof)break}await new Promise(r=>f.end(r));await cdp.send('IO.close',{handle:stream})}
async function traceStart(){await cdp.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{includedCategories:['toplevel','devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.stack','disabled-by-default-v8.cpu_profiler','v8.execute','blink.user_timing']}})}
await cdp.send('Runtime.enable');await cdp.send('Runtime.addBinding',{name:'__jumpReady'});await cdp.send('Runtime.addBinding',{name:'__jumpClick'});let onReady=null,onClick=null;cdp.on('Runtime.bindingCalled',e=>{if(e.name==='__jumpReady')onReady?.(Number(e.payload));if(e.name==='__jumpClick')onClick?.(Number(e.payload))});
let ownsDraft=false;const results=[];
// The direct button driver needs no calibration navigation (important under server throttling).
const draft=p.locator('.ProseMirror').first();if(await draft.count()&&(await draft.innerText()).trim())throw Error('Existing draft; refusing overwrite');
const calibrated={n:null,more:null};
try{
const successes=new Map(times.map(T=>[T,0])),tracedTimes=new Set();
for(const T of (process.env.CHECK_ONLY?[]:times))for(let rep=+(process.env.START_REP??1);rep<=reps;rep++){
 await p.goto('about:blank');await sleep(200);requests=[];received=new Map();jobs=[];errors=[];active=true;
 const trace=process.env.TRACE!=='0'&&rep===1,prefix=path.join(out,`${rep}-T${T}`);if(trace)await traceStart();
 const readySignal=new Promise(resolve=>{onReady=resolve});const navAt=Date.now();await gotoChat();
 const readyAt=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Rail did not become usable')),90000);readySignal.then(x=>{clearTimeout(timer);resolve(x)},reject)});onReady=null;const editor=p.locator('.ProseMirror').first();
 const g=calibrated;
 await sleep(Math.max(0,readyAt+T*1000-Date.now()));
 const clickSignal=new Promise(resolve=>{onClick=resolve});const dispatchAt=Date.now(),pending=[];const send=(method,data)=>{const x=input.send(method,data).catch(e=>({error:safe(e.message)}));pending.push(x)};
 send('Runtime.evaluate',{expression:`document.querySelector('chatgpt-butter-nav')?.shadowRoot?.querySelectorAll('.tick')[${tickIndex}]?.click()`});
 // The binding is emitted at click capture, before the production handler can block.
 const processedClickAt=await Promise.race([clickSignal,sleep(5000).then(()=>null)]);onClick=null;const typingAt=(processedClickAt??Date.now())+300;
 ownsDraft=true;
 // Deliberately do not await key acknowledgements: a busy renderer must not slow the sender.
 for(let i=0;i<80;i++){await sleep(Math.max(0,typingAt+i*100-Date.now()));const key='abcdefghijklmnopqrstuvwxyz0123456789'[i%36],vkey=key.toUpperCase().charCodeAt(0);
  send('Input.dispatchKeyEvent',{type:'keyDown',key,code:/\d/.test(key)?'Digit'+key:'Key'+key.toUpperCase(),text:key,unmodifiedText:key,windowsVirtualKeyCode:vkey,nativeVirtualKeyCode:vkey});
  send('Input.dispatchKeyEvent',{type:'keyUp',key,windowsVirtualKeyCode:vkey,nativeVirtualKeyCode:vkey});
 }
 await Promise.all(pending);let state=null;
 for(let k=0;k<200;k++){state=await p.evaluate(()=>({landed:window.__jumpProbe.landed,top:window.__jumpProbe.lastTargetTop,click:window.__jumpProbe.click}));if(state.landed||state.click===null||Date.now()-dispatchAt>25000)break;await sleep(100)}
 await sleep(500);await p.evaluate(()=>{performance.mark('jump-end');window.__jumpProbe.end=performance.now();window.__jumpProbe.running=false});
 if(trace)await traceStop(prefix+'-trace.json');
 const raw=await p.evaluate(()=>{const s=window.__jumpProbe;return {clickTickCount:s.clickTickCount,clickHasEarlier:s.clickHasEarlier,railReady:s.railReady,physicalClick:s.lastPhysicalClick,target:s.target,clickedIndex:s.clickedIndex,ready:s.ready,click:s.click,landed:s.landed,end:s.end,lastTargetTop:s.lastTargetTop,events:s.events,longtasks:s.longtasks,loafs:s.loafs,keys:s.keys,frames:s.frames,nav:performance.getEntriesByType('navigation').map(n=>({dcl:n.domContentLoadedEventEnd,load:n.loadEventEnd})),railCount:document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick').length,hasEarlier:!document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more').hidden,composerLength:document.querySelector('.ProseMirror').textContent.length,focused:document.activeElement===document.querySelector('.ProseMirror'),mounted:[...document.querySelectorAll('[data-turn-key]')].map(e=>e.getAttribute('data-turn-key'))}});
 // Always clear with real editor input, never submit. Stop measurement before cleanup.
 await editor.focus();await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');await sleep(250);if((await editor.innerText()).trim())throw Error('Failed to clear composer');ownsDraft=false;
 await Promise.all(jobs);active=false;
 raw.targetHash=raw.target?sha(raw.target):null;delete raw.target;raw.mounted=raw.mounted.map(sha);for(const f of raw.loafs)for(const s of f.scripts){s.sourceURL=s.sourceURL?.replace(/([?#]).*$/,'');s.invoker=safe(s.invoker)}
 const win=x=>x.start>=raw.click&&x.start<raw.end,keyEvents=raw.events.filter(x=>x.name==='keydown'&&win(x)),frames=raw.loafs.filter(win),tasks=raw.longtasks.filter(win);
 const result={mode,rep,T,traced:trace,clickDispatchDelayMs:processedClickAt?processedClickAt-dispatchAt:null,waitActualMs:dispatchAt-readyAt,navToReadyMs:readyAt-navAt,initialTicks:raw.clickTickCount,initialMore:raw.clickHasEarlier,targetHash:raw.targetHash,processedClick:raw.click!==null,clickedIndex:raw.clickedIndex,jumpMs:raw.landed?raw.landed-raw.click:null,finalTargetTop:raw.lastTargetTop,keyDelay:stat(keyEvents.map(e=>e.delay)),allKeyHandlerDelay:stat(raw.keys.map(k=>k.delay)),keyDuration:stat(keyEvents.map(e=>e.duration)),keys:raw.keys.length,composerLength:raw.composerLength,cleared:true,longestFrame:Math.max(0,...frames.map(f=>f.duration)),framesOver200:frames.filter(f=>f.duration>200).length,longestTask:Math.max(0,...tasks.map(e=>e.duration)),pageRequests:requests.filter(r=>r.kind==='older'&&r.start>=dispatchAt).length,requests:requests.map(({id,start,end,...r})=>({...r,relativeStartMs:start-navAt,networkMs:end?end-start:null})),errors,raw};
 const valid=result.requests.some(r=>r.kind==='initial'&&r.status===200)&&result.requests.filter(r=>r.kind==='older').every(r=>r.status===200)&&result.processedClick&&result.clickedIndex===tickIndex&&result.keys===80&&result.composerLength===80;result.valid=valid;if(valid){successes.set(T,successes.get(T)+1);if(trace)tracedTimes.add(T)}
 fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2));results.push(result);console.log(JSON.stringify({...result,targetHash:undefined,raw:undefined,requests:result.requests.map(({messageHashes,questionHashes,...r})=>r)}));
 if(process.env.MAX_DELAY_MS&&result.allKeyHandlerDelay.max>+process.env.MAX_DELAY_MS)process.exitCode=2;
}
if(process.env.CHECK!=='0'){
 // Separate correctness navigation. Reference request is XHR, so it cannot seed the rail.
 await p.goto('about:blank');await sleep(200);requests=[];jobs=[];received=new Map();errors=[];active=true;await gotoChat();await p.locator('.ProseMirror').first().waitFor({timeout:90000});await sleep(10000);
 if(!await p.locator('chatgpt-butter-nav[data-on]').count()){await p.goto('about:blank');await gotoChat();await p.locator('chatgpt-butter-nav[data-on]').waitFor({state:'attached',timeout:90000});await sleep(5000)}
 active=false;const getReference=()=>p.evaluate(async()=>{const tok=(await (await fetch('/api/auth/session')).json()).accessToken,id=/\/c\/([^/?#]+)/.exec(location.pathname)[1];return await new Promise((resolve,reject)=>{const x=new XMLHttpRequest();x.open('GET',`/backend-api/conversations/${id}?num_turns=100&include_has_versions=true`);x.setRequestHeader('authorization','Bearer '+tok);x.onload=()=>{try{const j=JSON.parse(x.responseText);resolve({status:x.status,data:j})}catch{reject(Error('reference JSON'))}};x.onerror=()=>reject(Error('reference network'));x.send()})});
 let reference=await getReference();for(let attempt=0;reference.status===429&&attempt<2;attempt++){const ms=Math.max(1000,rateLimitUntil-Date.now());console.log('REFERENCE_BACKOFF429 '+ms+'ms');await sleep(ms);reference=await getReference()}
 active=true;const ref=payload(reference.data);let passCount=0,stall=0,prev=-1,restarts=0;const visited=new Set();
 for(let k=0;k<60;k++){
  const s=await p.evaluate(()=>{const r=document.querySelector('chatgpt-butter-nav')?.shadowRoot,sc=document.querySelector('.thread-scroll-container');return {more:r?!r.querySelector('.more').hidden:null,n:r?.querySelectorAll('.tick').length??0,ids:[...document.querySelectorAll('[data-turn-key]')].map(e=>e.getAttribute('data-turn-key'))}});
  s.ids.map(sha).forEach(x=>visited.add(x));if(!s.more){passCount=s.n;break}if(s.n===prev)stall++;else stall=0;if(stall===2&&restarts<2){restarts++;await p.goto('about:blank');await gotoChat();await p.locator('chatgpt-butter-nav[data-on]').waitFor({state:'attached',timeout:90000});await sleep(4000);prev=-1;stall=0;continue}if(stall>4)break;prev=s.n;
  if(rateLimitUntil>Date.now()){console.log('BACKOFF429 '+(rateLimitUntil-Date.now())+'ms');await sleep(rateLimitUntil-Date.now())}
  await p.evaluate(()=>{const sc=document.querySelector('.thread-scroll-container');sc.scrollTop=500});await sleep(300);await p.evaluate(()=>{document.querySelector('.thread-scroll-container').scrollTop=0});await sleep(2200);
 }
 await Promise.all(jobs);
 const pages=requests.filter(r=>r.status===200&&r.questionHashes),ids=[...new Set(pages.flatMap(r=>r.questionHashes))],last=await p.evaluate(()=>{const r=document.querySelector('chatgpt-butter-nav').shadowRoot;return {railCount:r.querySelectorAll('.tick').length,more:!r.querySelector('.more').hidden}});
 // Click every rail tick, with the loaded full rail, and check target landing/mounting.
 const reach=[];if(!last.more&&last.railCount<=100){for(let i=0;i<last.railCount;i++){
  await p.evaluate(i=>{window.__jumpProbe.running=true;const r=document.querySelector('chatgpt-butter-nav').shadowRoot;r.querySelectorAll('.tick')[i].click()},i);
  let v;for(let k=0;k<100;k++){await sleep(100);v=await p.evaluate(()=>{const s=window.__jumpProbe,sc=document.querySelector('.thread-scroll-container'),t=s.target&&sc?.querySelector(`[data-turn-key="${s.target}"]`),r=document.querySelector('chatgpt-butter-nav').shadowRoot;return {mounted:!!t,bottomClamped:sc?Math.abs(sc.scrollTop-(sc.scrollHeight-sc.clientHeight))<=5:false,top:t?t.getBoundingClientRect().top-sc.getBoundingClientRect().top:null,busy:!!r.querySelector('.tick.busy')}});if(v.mounted&&(Math.abs(v.top-64)<=5||(v.bottomClamped&&v.top>=64&&v.top<700))&&!v.busy)break}reach.push({index:i,...v,pass:v.mounted&&(Math.abs(v.top-64)<=5||(v.bottomClamped&&v.top>=64&&v.top<700))&&!v.busy});
 }}
 const labels=messages(reference.data).filter(m=>m.author?.role==='user'&&!m.metadata?.is_visually_hidden_from_conversation&&['text','multimodal_text'].includes(m.content?.content_type)).map(m=>(m.content.parts??[]).filter(p=>typeof p==='string').join('\n').trim().slice(0,120));
 const railOrderMatches=await p.evaluate(labels=>JSON.stringify([...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')].map(e=>e.getAttribute('aria-label')))===JSON.stringify(labels),labels);
 const fetchedMessages=[...new Set(pages.flatMap(r=>r.messageHashes))];
 const merged=[];for(const pg of pages){const fresh=pg.messageHashes.filter(id=>!merged.includes(id));if(pg.kind==='older')merged.unshift(...fresh);else merged.push(...fresh)}
 const messageOrderMatches=JSON.stringify(merged)===JSON.stringify(ref.messageHashes);
 const correct={mode,referenceQuestionHashes:ref.questionHashes,uniqueFetchedMessages:fetchedMessages.length,missingMessages:ref.messageHashes.filter(id=>!fetchedMessages.includes(id)).length,duplicateMessagesWithinPages:pages.reduce((n,pg)=>n+pg.messageHashes.length-new Set(pg.messageHashes).size,0),messageOrderMatches,railOrderMatches,referenceStatus:reference.status,referenceQuestions:ref.questions,referenceMessages:ref.messages,uniqueFetchedQuestions:ids.length,missing:ref.questionHashes.filter(x=>!ids.includes(x)).length,unexpected:ids.filter(x=>!ref.questionHashes.includes(x)).length,...last,allPagesLoaded:!last.more,allReachable:reference.status===200&&ref.questions>0&&reach.length===ref.questions&&reach.every(x=>x.pass),reach,requests:requests.map(({id,start,end,...r})=>r),errors};
 fs.writeFileSync(path.join(out,'correctness.json'),JSON.stringify(correct,null,2));console.log('CORRECTNESS '+JSON.stringify({...correct,referenceQuestionHashes:undefined,requests:undefined,reach:undefined}));active=false;
}
}finally{try{const e=p.locator('.ProseMirror').first();if(ownsDraft&&await e.count()){await e.focus();await p.keyboard.press('Control+a');await p.keyboard.press('Backspace')}}catch{}await cdp.detach();await input.detach();await b.close()}
