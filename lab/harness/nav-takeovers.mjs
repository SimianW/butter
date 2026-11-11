// Controlled trip deadline/readiness and remount checks. No ChatGPT requests.
// Run sequentially with other lab scripts: node lab/harness/nav-takeovers.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { railDeps } from './rail-scripts.mjs';
const repo = new URL('../../', import.meta.url), out = new URL('./scratch/faster-jumps/', import.meta.url);
fs.mkdirSync(out, {recursive:true});
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const cx = await b.newContext({viewport:{width:1600,height:1000}}), p = await cx.newPage(), errors = [], results = [];
p.on('pageerror', e=>errors.push(e.message));
await cx.route('http://butter.test/**', r=>r.fulfill({contentType:'text/html',body:`<!doctype html><style>
body{margin:0}.thread-scroll-container{height:100vh;overflow:auto;overflow-anchor:none}.content{padding:64px 180px 1000px}article{height:1800px}
</style><div class="thread-scroll-container"><div class="content"><div class="window"></div></div></div>`}));
const cv = fs.readFileSync(new URL('extension/stream/offscreen.js',repo),'utf8');
const css = fs.readFileSync(new URL('extension/stream/containment.css',repo),'utf8');
const deps = railDeps(); // the rail's dependencies, injected before it in manifest order (#89)
// Historical baselines use the stem recorded in their tree; expose the current protocol.
const baselineFile = execFileSync('git',['ls-tree','-r','--name-only','75a9387','extension'],{cwd:repo,encoding:'utf8'}).trim().split('\n').find(f=>f.endsWith('-nav.js'));
const baselineStem = baselineFile.slice('extension/'.length,-'-nav.js'.length);
const baseline = execFileSync('git',['show',`75a9387:${baselineFile}`],{cwd:repo,encoding:'utf8'}).replaceAll(baselineStem,'butter');
async function setup(source, pending=true) {
  await p.goto('http://butter.test/c/00000000-0000-0000-0000-000000000001');
  await p.addStyleTag({content:css});
  await p.evaluate(pending=>{
    const sc=document.querySelector('.thread-scroll-container'),win=document.querySelector('.window');
    for(let i=0;i<10;i++)win.insertAdjacentHTML('beforeend',`<div><div><article data-turn-key="t${i}"><div data-user-message-bubble>question ${i}</div>${pending?'<div data-math-source>x</div>':''}</article></div></div>`);
    window.fixture={clicks:[],reveals:[]};let shown=false;
    function sample(){const r=document.querySelector('chatgpt-butter-nav')?.shadowRoot,w=r?.querySelector('.warp');if(w){const s=getComputedStyle(w),on=s.visibility==='visible'&&+s.opacity>.01;if(shown&&!on)fixture.reveals.push(performance.now());shown=on;}requestAnimationFrame(sample);}requestAnimationFrame(sample);
    document.addEventListener('click',e=>{if(e.composedPath().some(x=>x?.classList?.contains('tick')))fixture.clicks.push(performance.now());},true);
    sc.scrollTop=2400;
  },pending);
  for(const dep of deps) await p.addScriptTag({content:dep});
  await p.addScriptTag({content:source}); await p.addScriptTag({content:cv});
  await p.evaluate(()=>document.dispatchEvent(new CustomEvent('butter-nav',{detail:JSON.stringify({type:'page',conv:'00000000-0000-0000-0000-000000000001',hasPrev:false,items:Array.from({length:10},(_,i)=>({id:`t${i}`,q:`question ${i}`}))})})));
  await p.locator('chatgpt-butter-nav[data-on]').waitFor({state:'attached'});await p.waitForTimeout(200);
}
const click = i=>p.evaluate(i=>document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')[i].click(),i);
const done = ()=>p.waitForFunction(()=>{const r=document.querySelector('chatgpt-butter-nav').shadowRoot;return !r.querySelector('.busy')&&getComputedStyle(r.querySelector('.warp')).visibility==='hidden';},null,{timeout:20000});
const state = id=>p.evaluate(id=>{const sc=document.querySelector('.thread-scroll-container'),el=sc.querySelector(`[data-turn-key="${id}"]`),r=document.querySelector('chatgpt-butter-nav').shadowRoot;return {clicks:fixture.clicks.map(t=>Math.round(t-fixture.clicks[0])),revealMs:Math.round(fixture.reveals.at(-1)-fixture.clicks[0]),top:el?Math.round(el.getBoundingClientRect().top-sc.getBoundingClientRect().top):null,busy:!!r.querySelector('.busy'),warp:getComputedStyle(r.querySelector('.warp')).visibility};},id);
try {
  for(const version of ['alpha6','new']){
    const source=version==='new'?fs.readFileSync(new URL('extension/rail/rail.js',repo),'utf8'):baseline;
    for(const [kind,seq] of [['repeat',[8,8,8]],['same-final',[8,4,8]],['deadline',Array.from({length:12},(_,i)=>i%2?4:8)]]){
      await setup(source);const start=Date.now();
      for(let i=0;i<seq.length;i++){await p.waitForTimeout(Math.max(0,start+i*1000-Date.now()));await click(seq[i]);}
      await done();await p.waitForTimeout(100);
      const r={version,kind,...await state(`t${seq.at(-1)}`)};results.push(r);console.log(JSON.stringify(r));
      assert.equal(r.top,64);assert.equal(r.busy,false);assert.equal(r.warp,'hidden');
      if(version==='new'&&kind==='deadline'){
        assert.ok(r.revealMs<=12500,'shared 12s deadline plus reveal fade');
        await p.evaluate(()=>document.querySelector('[data-turn-key="t3"]').style.height='2300px');await p.waitForTimeout(200);
        const released={version,kind:'deadline-followed',...await state('t4')};results.push(released);console.log(JSON.stringify(released));assert.equal(released.top,64);
      }
    }
    if(version==='new'){
      await setup(source,false);
      await p.evaluate(()=>{
        let full=false;
        const watch=()=>{
          const w=document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.warp'),s=getComputedStyle(w);
          if(s.visibility==='visible'&&+s.opacity>.99)full=true;
          if(full&&+s.opacity<.95){
            const el=document.querySelector('[data-turn-key="t8"]').parentElement.parentElement;
            el.replaceWith(el.cloneNode(true));document.querySelector('[data-turn-key="t7"]').style.height='3300px';fixture.remounted=true;
          }else requestAnimationFrame(watch);
        };requestAnimationFrame(watch);
      });
      await click(8);await done();await p.waitForTimeout(100);
      const arrival={version,kind:'remount-during-reveal',...await state('t8'),remounted:await p.evaluate(()=>fixture.remounted)};
      results.push(arrival);console.log(JSON.stringify(arrival));assert.equal(arrival.remounted,true);assert.equal(arrival.top,64);
      await setup(source,false);await click(8);await done();
      // Replace the target and its ancestors after reveal, then grow a preceding answer.
      await p.evaluate(()=>{const el=document.querySelector('[data-turn-key="t8"]').parentElement.parentElement;el.replaceWith(el.cloneNode(true));document.querySelector('[data-turn-key="t7"]').style.height='3300px';});
      await p.waitForTimeout(250);
      const r={version,kind:'remount',...await state('t8')};results.push(r);console.log(JSON.stringify(r));assert.equal(r.top,64);
      await setup(source,false);await click(8);await p.waitForTimeout(310);
      await p.evaluate(()=>document.dispatchEvent(new CustomEvent('butter-nav',{detail:JSON.stringify({type:'send',parent:'t9',item:{id:'sent',q:'sent'}})})));
      await done();
      const sent={version,kind:'send-during-readiness',...await state('t8')};results.push(sent);console.log(JSON.stringify(sent));assert.equal(sent.busy,false);assert.equal(sent.warp,'hidden');
      // Leave the final question unmounted when the shared deadline expires.
      await setup(source);
      const absentStart=Date.now();
      for(let i=0;i<12;i++){
        await p.waitForTimeout(Math.max(0,absentStart+i*1000-Date.now()));
        if(i===11)await p.evaluate(()=>{for(let j=0;j<8;j++)document.querySelector(`[data-turn-key="t${j}"]`).parentElement.parentElement.remove();});
        await click(i%2?4:8);
      }
      await done();await p.waitForTimeout(100);
      const absent={version,kind:'deadline-unmounted',...await state('t4')};results.push(absent);console.log(JSON.stringify(absent));
      assert.equal(absent.top,null);assert.equal(absent.busy,false);assert.equal(absent.warp,'hidden');assert.ok(absent.revealMs<=12500);
      await p.evaluate(()=>{
        document.querySelector('.window').insertAdjacentHTML('afterbegin','<div><div><article data-turn-key="t4"><div data-user-message-bubble>question 4</div></article></div></div>');
        document.querySelector('.thread-scroll-container').scrollTop=400;
      });await p.waitForTimeout(250);
      const fallback={version,kind:'deadline-fallback-released',...await state('t4')};results.push(fallback);console.log(JSON.stringify(fallback));assert.equal(fallback.top,-336);
      for(const kind of ['keyboard','touch','scrollbar']){
        await setup(source,false);await click(8);await done();
        if(kind==='keyboard')await p.keyboard.press('PageUp');
        if(kind==='touch')await p.evaluate(()=>document.querySelector('.thread-scroll-container').dispatchEvent(new Event('touchstart')));
        if(kind==='scrollbar')await p.evaluate(()=>{const sc=document.querySelector('.thread-scroll-container');sc.dispatchEvent(new PointerEvent('pointerdown',{clientX:sc.getBoundingClientRect().right}));});
        await p.waitForTimeout(200);
        const before=await state('t8');
        await p.evaluate(()=>document.querySelector('[data-turn-key="t7"]').style.height='3300px');await p.waitForTimeout(200);
        const r={version,kind:`release-${kind}`,...await state('t8')};results.push(r);console.log(JSON.stringify(r));assert.ok(r.top>=before.top+1490);
      }
    }
  }
  console.log('errors',JSON.stringify(errors));assert.deepEqual(errors,[]);
  fs.writeFileSync(new URL('fixture-takeovers.json',out),JSON.stringify(results,null,2));
}finally{await cx.close();await b.close();}
