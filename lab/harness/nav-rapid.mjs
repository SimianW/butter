// Serial rapid-jump stress. CHAT is private; no messages are sent.
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
const CHAT=process.env.CHAT;if(!CHAT)throw Error('Set CHAT');
fs.mkdirSync('scratch/nav-rapid',{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let seed=0x7ac03;const rand=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/2**32};
execFileSync('../lab',['restart-browser'],{env:{...process.env,LAB_EXTENSIONS:new URL('../../extension',import.meta.url).pathname},stdio:'inherit'});await sleep(4000);
const b=await chromium.connectOverCDP('http://127.0.0.1:9222');const p=b.contexts()[0].pages().find(p=>p.url().startsWith('https://chatgpt.com'))??b.contexts()[0].pages()[0];await p.bringToFront();
const errors=[];p.on('pageerror',e=>errors.push(e.message));
const geometry=()=>p.evaluate(()=>{const h=document.querySelector('chatgpt-butter-nav'),r=h?.shadowRoot,rail=r?.querySelector('.rail'),box=rail?.getBoundingClientRect();if(!box||!h.hasAttribute('data-on'))return null;return {x:box.x+box.width/2,y:box.y,h:box.height,n:r.querySelectorAll('.tick').length,more:!r.querySelector('.more').hidden}});
// Calibrate coordinates once, then reload. The first stress input must not wait for a renderer
// geometry query: that would defer the requested 1.5-second early input until the page settles.
await p.goto(CHAT,{waitUntil:'domcontentloaded'});await p.locator('chatgpt-butter-nav[data-on]').waitFor({state:'attached',timeout:60000});await sleep(8000);
const calibrated=await geometry(),calibratedLabels=await p.evaluate(()=>[...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')].map(e=>e.getAttribute('aria-label')));
await p.addInitScript(()=>{window.__navClicks=[];const mo=new MutationObserver(()=>{const root=document.querySelector('chatgpt-butter-nav')?.shadowRoot;if(!root)return;root.querySelector('.rail').addEventListener('click',e=>{const tick=e.target.closest('.tick');if(tick)window.__navClicks.push({tick:[...root.querySelectorAll('.tick')].indexOf(tick),label:tick.getAttribute('aria-label'),at:performance.now()});},true);mo.disconnect();});mo.observe(document,{childList:true,subtree:true});});
const input=await p.context().newCDPSession(p);
await p.goto(CHAT,{waitUntil:'domcontentloaded'});const loadAt=Date.now();
console.log('early',JSON.stringify({scheduledFirstInputMs:1500,calibratedTicks:calibrated.n}));
const results=[];
for(let round=1;round<=5;round++){
 if(round>1)await sleep(2500);
 const actions=[];const count=8+Math.floor(rand()*8);let lastLabel='',lastTick=null;
 const g=round===1?calibrated:await geometry();if(!g)throw Error('Rail missing');
 if(round>1)await p.evaluate(()=>window.__navClicks=[]);
 const labels=round===1?calibratedLabels:await p.evaluate(()=>[...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')].map(e=>e.getAttribute('aria-label')));
 const cdp=input,pending=[],roundStart=round===1?loadAt+1500:Date.now();let scheduled=0;
 // Dispatch on a Node clock without querying a blocked renderer between clicks.
 const click=(x,y)=>{const base={x,y,button:'left',clickCount:1};pending.push(cdp.send('Input.dispatchMouseEvent',{...base,type:'mouseMoved'}).catch(e=>({error:e.message})));pending.push(cdp.send('Input.dispatchMouseEvent',{...base,type:'mousePressed',buttons:1}).catch(e=>({error:e.message})));pending.push(cdp.send('Input.dispatchMouseEvent',{...base,type:'mouseReleased',buttons:0}).catch(e=>({error:e.message})));};
 const wheel=()=>{const x=g.x-300,y=g.y+g.h/2;pending.push(cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x,y,deltaX:0,deltaY:350}).catch(e=>({error:e.message})));actions.push({wheel:true,at:Date.now()-loadAt});};
 for(let k=0;k<count;k++){
  await sleep(Math.max(0,roundStart+scheduled-Date.now()));
  let i=Math.floor(rand()*g.n);if(round===4&&k===1)i=lastTick;
  const pitch=(g.h-20-(g.more?16:0))/g.n,y=g.y+10+(g.more?16:0)+(i+.5)*pitch;
  lastLabel=labels[i];lastTick=i;click(g.x,y);
  const gap=round===4&&k===0?65:60+Math.floor(rand()*341);actions.push({tick:i,gap,at:Date.now()-loadAt});scheduled+=gap;
  if(round===3&&k===Math.floor(count/2))wheel();
 }
 if(round===3){await sleep(120);wheel();actions.at(-1).final=true;}
 const dispatched=await Promise.all(pending);
 const dispatchErrors=dispatched.filter(x=>x?.error);if(dispatchErrors.length)throw Error(JSON.stringify(dispatchErrors));
 await p.mouse.move(5,500);await sleep(6000);
 const state=await p.evaluate(label=>{
  const actual=window.__navClicks??[];label=actual.at(-1)?.label??label;
  const sc=document.querySelector('.thread-scroll-container'),root=document.querySelector('chatgpt-butter-nav').shadowRoot;
  const turn=sc.querySelector('[data-turn-key]'),box=turn?.parentElement?.parentElement?.parentElement;
  // ChatGPT intentionally hides assistive/action elements. Preserve their details instead of
  // mistaking them for the virtualizer's whole-content fade bug.
  const faded=[...sc.querySelectorAll('*')].filter(e=>+getComputedStyle(e).opacity!==1).map(e=>({tag:e.tagName,cls:String(e.className).slice(0,100),opacity:getComputedStyle(e).opacity,display:getComputedStyle(e).display}));
  const ancestors=[];let e=box;while(e&&sc.contains(e)){ancestors.push({tag:e.tagName,opacity:getComputedStyle(e).opacity});if(e===sc)break;e=e.parentElement;}
  let target=null;for(const t of sc.querySelectorAll('[data-turn-key]')){const q=t.querySelector('[data-user-message-bubble]')?.textContent.trim()??'';if(q.startsWith(label)){target=Math.round(t.getBoundingClientRect().top-sc.getBoundingClientRect().top);break;}}
  return {navigation:(()=>{const n=performance.getEntriesByType('navigation')[0];return {domContentLoaded:n.domContentLoadedEventEnd,load:n.loadEventEnd}})(),processedClicks:actual.length,actualTicks:actual.map(x=>({tick:x.tick,at:x.at})),everyElementOpacityOne:faded.length===0,contentOpacity:box?getComputedStyle(box).opacity:null,animations:box?.getAnimations().map(a=>({state:a.playState,fill:a.effect?.getTiming().fill})),ancestors,warp:getComputedStyle(root.querySelector('.warp')).visibility,busy:root.querySelectorAll('.tick.busy').length,targetTop:target,fadedCount:faded.length,faded:faded.slice(0,25)};
 },lastLabel);
 const pass=state.processedClicks===count&&state.contentOpacity==='1'&&state.animations?.every(a=>a.state==='finished')&&state.warp==='hidden'&&state.busy===0&&(round===3||(state.targetTop!==null&&Math.abs(state.targetTop-64)<=4));
 const result={round,pass,literalOpacityPass:state.everyElementOpacityOne,elapsedMs:Date.now()-loadAt,actions,...state};results.push(result);console.log(JSON.stringify(result));await p.screenshot({path:`scratch/nav-rapid/round-${round}.png`});
}
fs.writeFileSync('scratch/nav-rapid/results.json',JSON.stringify({seed:'0x7ac03',results,errors},null,2));await input.detach();await b.close();if(results.some(r=>!r.pass))process.exitCode=1;
