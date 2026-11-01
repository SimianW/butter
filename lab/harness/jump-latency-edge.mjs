// Read-only cold-page and no-math probes, after jump-latency.mjs has staged both versions.
// Usage: node lab/harness/jump-latency-edge.mjs (CHAT optional; defaults to open lab chat).
import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const dir=new URL('./scratch/jump-latency/',import.meta.url),root=new URL('../../',import.meta.url).pathname;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let chat=process.env.CHAT;if(!chat)chat=(await(await fetch('http://127.0.0.1:9222/json/list')).json()).find(t=>t.type==='page'&&t.url.includes('chatgpt.com/')&&t.url.includes('/c/')).url;
const results=[];
for(const version of ['head','alpha5']){
 const stage=`/home/simon/snap/chromium/common/butter-jump-latency-${version}`;
 console.log(execFileSync(path.join(root,'lab/lab'),['restart-browser'],{env:{...process.env,LAB_EXTENSIONS:stage},encoding:'utf8'}).trim());
 for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:9222/json/version');break;}catch{await sleep(500);}}
 const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=b.contexts()[0].pages().find(p=>p.url().startsWith('https://chatgpt.com'));
 await p.addInitScript(()=>{
  window.__edge={events:[],reveals:[],longtasks:[],pages:[],geometry:[]};let visible=false;
  document.addEventListener('butter-latency',e=>{
   const d=JSON.parse(e.detail);__edge.events.push(d);
   if(d.phase==='katex:end'){
    const el=[...document.querySelectorAll('[data-turn-key]')].find(x=>x.querySelector('[data-user-message-bubble]')?.textContent.trim().startsWith(__edge.events.find(x=>x.tok===d.tok&&x.phase==='click')?.label??'!'));
    __edge.mathSample=el?{math:el.querySelectorAll('[data-math-source]').length,pending:[...el.querySelectorAll('[data-math-source]')].filter(x=>!x.querySelector('.katex')).map(x=>({connected:x.isConnected,html:x.outerHTML.slice(0,500)})).slice(0,4)}:null;
   }
  });
  document.addEventListener('butter-nav',e=>{try{const d=JSON.parse(e.detail);if(d.type==='page')__edge.pages.push({at:performance.now(),before:d.before,hasPrev:d.hasPrev,items:d.items.length});}catch{}});
  new PerformanceObserver(l=>{for(const e of l.getEntries())__edge.longtasks.push(e.toJSON());}).observe({type:'longtask',buffered:true});
  const f=()=>{const r=document.querySelector('chatgpt-butter-nav')?.shadowRoot,w=r?.querySelector('.warp');if(w){const s=getComputedStyle(w),v=s.visibility==='visible'&&+s.opacity>.01;if(visible&&!v)__edge.reveals.push({at:performance.now()});visible=v;}requestAnimationFrame(f);};requestAnimationFrame(f);
 });
 await p.goto(chat);await p.locator('.ProseMirror').first().waitFor();await p.locator('chatgpt-butter-nav[data-on]').waitFor({state:'attached'});await sleep(2500);
 const done=async()=>p.waitForFunction(()=>{const r=document.querySelector('chatgpt-butter-nav').shadowRoot;return !r.querySelector('.busy')&&getComputedStyle(r.querySelector('.warp')).visibility==='hidden';},{},{timeout:25000});
 for(const scenario of ['cold-top','no-math']){
  const start=await p.evaluate(()=>performance.now());
  if(scenario==='cold-top')await p.locator('chatgpt-butter-nav .tick').first().click();else await p.locator('chatgpt-butter-nav .tick').last().click();
  await p.mouse.move(5,500);await done();await sleep(1500);
  const end=await p.evaluate(()=>performance.now());
  const data=await p.evaluate(({start,end})=>{
   const sc=document.querySelector('.thread-scroll-container');
   return {events:__edge.events.filter(e=>e.at>=start&&e.at<=end),reveals:__edge.reveals.filter(e=>e.at>=start&&e.at<=end),longtasks:__edge.longtasks.filter(e=>e.startTime>=start&&e.startTime<=end),pages:__edge.pages.filter(e=>e.at>=start&&e.at<=end),mathSample:__edge.mathSample,turns:[...sc.querySelectorAll('[data-turn-key]')].map(el=>({label:el.querySelector('[data-user-message-bubble]')?.textContent.trim().slice(0,35),top:el.getBoundingClientRect().top-sc.getBoundingClientRect().top,math:el.querySelectorAll('[data-math-source]').length}))};
  },{start,end});
  const result={version,scenario,start,end,...data};results.push(result);fs.writeFileSync(new URL(`${version}-${scenario}.json`,dir),JSON.stringify(result,null,2));
  console.log(JSON.stringify({version,scenario,events:data.events.map(e=>({...e,at:Math.round(e.at-start)})),reveals:data.reveals.map(e=>Math.round(e.at-start)),pages:data.pages.map(e=>({...e,at:Math.round(e.at-start)})),mathSample:data.mathSample}));
 }
 await b.close();
}
fs.writeFileSync(new URL('edges.json',dir),JSON.stringify(results,null,2));
