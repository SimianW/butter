// Private target via CHAT; EXT='' stock; SHORT=1 empty home. Never sends.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const label=process.argv[2]??'current', reps=+(process.argv[3]??3);
const CHAT=process.env.SHORT?'https://chatgpt.com/':process.env.CHAT;
if(!CHAT) throw Error('Set CHAT');
const out=path.resolve('scratch/typing',label); fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const q=(a,p)=>a.length?[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*p))]:null;
const stats=a=>({n:a.length,p50:q(a,.5),p95:q(a,.95),max:a.length?Math.max(...a):null});
if(process.env.EXT!==undefined){execFileSync('../lab',['restart-browser'],{env:{...process.env,LAB_EXTENSIONS:process.env.EXT},stdio:'inherit'});await sleep(4000);}
const b=await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx=b.contexts()[0], p=ctx.pages().find(x=>x.url().startsWith('https://chatgpt.com'))??await ctx.newPage();
await p.bringToFront();const cdp=await ctx.newCDPSession(p);
async function traceStop(file){const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');const {stream}=await done;const f=fs.createWriteStream(file);for(;;){const x=await cdp.send('IO.read',{handle:stream,size:1<<20});f.write(x.base64Encoded?Buffer.from(x.data,'base64'):x.data);if(x.eof)break;}await new Promise(r=>f.end(r));await cdp.send('IO.close',{handle:stream});}
for(let rep=1;rep<=reps;rep++)for(const position of process.env.POSITIONS?process.env.POSITIONS.split(','):process.env.SHORT?['bottom']:['bottom','middle']){
 await p.goto(CHAT);await p.locator('.ProseMirror').first().waitFor({timeout:60000});await sleep(10000);
 await p.evaluate(pos=>{const sc=document.querySelector('.thread-scroll-container');if(sc)sc.scrollTop=pos==='middle'?sc.scrollHeight/2:sc.scrollHeight;},position);await sleep(2500);
 const composer=p.locator('.ProseMirror').first();await composer.click();
 if((await composer.innerText()).trim())throw Error('Composer has existing draft; refusing to overwrite');
 const probe=process.env.PROBE;
 if(probe)await p.evaluate(probe=>{
  if(probe==='dedupe'){const set=Element.prototype.setAttribute,remove=Element.prototype.removeAttribute;Element.prototype.setAttribute=function(n,v){if(this.getAttribute(n)===String(v))return;return set.call(this,n,v)};Element.prototype.removeAttribute=function(n){if(!this.hasAttribute(n))return;return remove.call(this,n)};}
  if(probe==='no-thread')document.querySelector('[data-turn-key]').parentElement.parentElement.parentElement.style.display='none';
  if(probe==='thread-contain'){const e=document.querySelector('[data-turn-key]').parentElement.parentElement.parentElement;e.style.contain='layout style';}
  if(probe==='scope-hr'){const walk=rs=>{for(const r of [...rs]){if(r.cssRules)walk(r.cssRules);if(r.selectorText?.includes('composerHorizontalRules')&&r.selectorText.includes(':has(')){const replacement='@scope ([class*=composerHorizontalRules] .ProseMirror) { :is(:scope > hr:has(+ p[data-empty-paragraph=\"true\"]), :scope > div:has(+ p[data-empty-paragraph=\"true\"]) > hr) {'+r.style.cssText+'} }';const sheet=new CSSStyleSheet();sheet.replaceSync(replacement);document.adoptedStyleSheets=[...document.adoptedStyleSheets,sheet];r.selectorText=':not(*)';}}};for(const sheet of document.styleSheets)try{walk(sheet.cssRules)}catch{}}
  if(['no-has','no-root-has','no-print-has','no-touch-has','no-table-has','no-hr-has','no-table-hr-has'].includes(probe)){const walk=rs=>{for(const r of rs){if(r.cssRules)walk(r.cssRules);if(r.selectorText?.includes(':has(')&&(probe==='no-has'||(probe==='no-table-has'&&r.selectorText.includes(':has(tbody > tr)'))||(probe==='no-hr-has'&&r.selectorText.includes('composerHorizontalRules'))||(probe==='no-table-hr-has'&&(r.selectorText.includes(':has(tbody > tr)')||r.selectorText.includes('composerHorizontalRules')))||(probe==='no-root-has'&&/html:has|body:has/.test(r.selectorText))||(probe==='no-touch-has'&&r.selectorText.includes('data-page-touch-pending'))||(probe==='no-print-has'&&/printDocument|PrintDocument/.test(r.selectorText))))r.selectorText=':not(*)';}};for(const sheet of document.styleSheets)try{walk(sheet.cssRules)}catch{}}
  if(probe==='no-ancestor-has'){const editor=document.querySelector('.ProseMirror'),anc=[];let a=editor;while(a){anc.push(a);a=a.parentElement;}let changed=0;const walk=rs=>{for(const r of rs){if(r.cssRules)walk(r.cssRules);if(r.selectorText?.includes(':has(')&&anc.some(e=>{try{return e.matches(r.selectorText)}catch{return false}})){r.selectorText=':not(*)';changed++;}}};for(const sheet of document.styleSheets)try{walk(sheet.cssRules)}catch{}window.__probeChanged=changed;}
  if(probe==='no-size-containers')for(const e of document.querySelectorAll('*'))if(getComputedStyle(e).containerType!=='normal')e.style.setProperty('container-type','normal','important');
  if(probe==='composer-contain')document.querySelector('.ProseMirror').closest('form').style.contain='layout style';
  if(probe==='app-container-normal')document.querySelector('[class*=MainContentFrame-]').style.setProperty('container-type','normal','important');
  if(probe==='no-surface-has'){const walk=rs=>{for(const r of rs){if(r.cssRules)walk(r.cssRules);if(r.selectorText?.includes(':has(')&&r.selectorText.includes('data-thread-scroll-footer'))r.selectorText=':not(*)';}};for(const sheet of document.styleSheets)try{walk(sheet.cssRules)}catch{}}
  if(probe==='no-nav')document.querySelector('chatgpt-turbo-nav')?.remove();
  const st=document.createElement('style');st.textContent=({contain:'.thread-scroll-container { contain: layout style !important; }','no-anim':'*,*::before,*::after {animation:none!important;transition:none!important}'})[probe]??'';document.head.append(st);
 },probe);
 if(probe)await sleep(2500);
 const prefix=path.join(out,`${rep}-${position}`);
 await p.screenshot({path:prefix+'-before.png'});
 const dom=await p.evaluate(()=>({turbo:typeof window.__turboTyping==='object'?{...window.__turboTyping}:null,nav:!!document.querySelector('chatgpt-turbo-nav'),nodes:document.querySelectorAll('*').length,turns:document.querySelectorAll('[data-turn-key]').length,katexNodes:document.querySelectorAll('.katex *').length,geometry:(()=>{const e=document.querySelector('.ProseMirror'),t=document.querySelector('[data-turn-key]');const rect=e=>e?Object.fromEntries(['x','y','width','height'].map(k=>[k,e.getBoundingClientRect()[k]])):null;return {composer:rect(e),turn:rect(t)}})(),scroll:(()=>{const s=document.querySelector('.thread-scroll-container');return s?{top:s.scrollTop,height:s.scrollHeight,client:s.clientHeight}:null})()}));
 await p.evaluate(()=>{
  const s=window.__typing={events:[],longtasks:[],frames:[],keys:[],mutations:[],running:true};
  s.po=new PerformanceObserver(l=>s.events.push(...l.getEntries().map(e=>({name:e.name,start:e.startTime,duration:e.duration,processing:e.processingEnd-e.processingStart,delay:e.processingStart-e.startTime,id:e.interactionId}))));s.po.observe({type:'event',durationThreshold:16,buffered:true});
  s.lt=new PerformanceObserver(l=>s.longtasks.push(...l.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));s.lt.observe({type:'longtask'});
  s.last=performance.now();const frame=()=>{if(!s.running)return;const t=performance.now();s.frames.push({t,duration:t-s.last});s.last=t;requestAnimationFrame(frame)};requestAnimationFrame(frame);
  s.handler=e=>{const k={start:e.timeStamp,at:performance.now()};s.keys.push(k);requestAnimationFrame(()=>setTimeout(()=>k.present=performance.now()-e.timeStamp,0))};addEventListener('keydown',s.handler,true);
  s.mo=new MutationObserver(rs=>{let thread=0,html=0,turn=0;for(const r of rs){if(r.target.closest?.('.thread-scroll-container'))thread++;if((r.target.nodeType===1?r.target:r.target.parentElement)?.closest('[data-turn-key]'))turn++;if(r.target===document.documentElement)html++;}if(thread||html)s.mutations.push({t:performance.now(),thread,html,turn,attrs:rs.filter(r=>r.type==='attributes').map(r=>({tag:r.target.tagName,cls:String(r.target.className).slice(0,100),attr:r.attributeName,value:r.target.getAttribute(r.attributeName)?.slice(0,250)}))})});s.mo.observe(document.documentElement,{subtree:true,childList:true,attributes:true,characterData:true});
 });
 await cdp.send('Tracing.start',{transferMode:'ReturnAsStream',traceConfig:{includedCategories:['devtools.timeline','disabled-by-default-devtools.timeline','disabled-by-default-devtools.timeline.stack','disabled-by-default-v8.cpu_profiler','v8.execute','blink.user_timing',...(process.env.HEAVY?['disabled-by-default-devtools.timeline.invalidationTracking']:[])]}});
 await p.evaluate(()=>{window.__typing.start=performance.now();window.__typing.last=window.__typing.start;performance.mark('typing-start')});
 const keys=[...'Typing a longer math question 1234567890.'];keys.splice(12,0,'Backspace','Backspace');keys.push('Backspace');
 try{for(let i=0;i<keys.length;i++){await p.keyboard.press(keys[i]===' '?'Space':keys[i]);await sleep(80+(i*17%41));}await sleep(500);}
 finally{
  await p.evaluate(()=>{performance.mark('typing-end');window.__typing.end=performance.now();window.__typing.running=false});await traceStop(prefix+'-trace.json');
  const r=await p.evaluate(()=>{const s=window.__typing;s.running=false;s.po.disconnect();s.lt.disconnect();s.mo.disconnect();removeEventListener('keydown',s.handler,true);return {start:s.start,end:s.end,events:s.events.filter(e=>e.start>=s.start&&e.start<=s.end),longtasks:s.longtasks.filter(e=>e.start>=s.start&&e.start<s.end),frames:s.frames.filter(e=>e.t>=s.start&&e.t<=s.end).map(e=>Math.min(e.duration,e.t-s.start)),keys:s.keys,mutations:s.mutations}});
  await p.screenshot({path:prefix+'-typed.png'});
  const semanticCheck=await p.evaluate(()=>window.__turboTyping?.verify?.()??null);
  const typedDom=await p.evaluate(()=>{let e=document.querySelector('.ProseMirror'),a=[];while(e&&e!==document.body){const s=getComputedStyle(e);if(s.containerType!=='normal'||/thread-scroll/.test(e.className))a.push({cls:e.className,container:s.containerType,h:e.offsetHeight});e=e.parentElement;}return a;});
  await composer.click();await p.keyboard.press('Control+a');await p.keyboard.press('Backspace');await sleep(500);
  if((await composer.innerText()).trim())throw Error('Failed to clear composer');await p.screenshot({path:prefix+'-after.png'});
  const result={label,rep,position,probe:probe??null,dom,typedDom,semanticCheck,wall:r.end-r.start,keyCount:keys.length,eventStats:Object.fromEntries(['keydown','keypress','input','beforeinput'].map(n=>[n,stats(r.events.filter(e=>e.name===n).map(e=>e.duration))])),presentation:stats(r.keys.map(k=>k.present).filter(Number.isFinite)),frames:stats(r.frames),longtasks:{count:r.longtasks.length,total:r.longtasks.reduce((a,e)=>a+e.duration,0),max:Math.max(0,...r.longtasks.map(e=>e.duration))},raw:r};
  if(process.env.MAX_KEY_MS&&result.eventStats.keydown.max>+process.env.MAX_KEY_MS)process.exitCode=1;
  fs.writeFileSync(prefix+'.json',JSON.stringify(result,null,2));console.log(JSON.stringify({...result,raw:undefined}));
 }
}
await b.close();
