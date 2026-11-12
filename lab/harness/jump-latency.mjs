// Read-only real-chat rail timing. Stages instrumented copies; never writes extension/.
// Usage (from lab/harness): [CHAT=https://chatgpt.com/.../c/...] [RUNS=5] node jump-latency.mjs
// Defaults to the open chat. Compares pinned alpha.6 with the working tree; stages only.
// Takeovers only: TAKEOVER_ONLY=1 [SCENARIOS=takeover-same,takeover-distinct,takeover-burst]
// VERSION=alpha6 or VERSION=new selects one arm (head/alpha5 retain research compatibility).
// EXT overrides the non-hidden staging directory (must be readable by snap Chromium).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { railDeps, railScripts } from './rail-scripts.mjs';
const here = path.dirname(new URL(import.meta.url).pathname), repo = path.resolve(here, '../..');
const out = path.resolve(here, process.env.OUT ?? 'scratch/faster-jumps'); fs.mkdirSync(out, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const runs = Number(process.env.RUNS ?? 5);
let chat = process.env.CHAT;
if (!chat) {
  const tabs = await (await fetch('http://127.0.0.1:9222/json/list')).json();
  chat = tabs.find(t => t.type === 'page' && /^https:\/\/chatgpt\.com\/(?:[^?#]*\/)?c\//.test(t.url))?.url;
}
if (!chat) throw Error('Set CHAT or leave the long math chat open in the lab browser.');
const log = (...v) => { const line = v.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(line); fs.appendFileSync(path.join(out,'commands.log'),line+'\n'); };
function instrument(source) {
  const replace = (a,b) => { if (!source.includes(a)) throw Error('Instrumentation anchor missing: '+a); source=source.replace(a,b); };
  replace('  const ZH =', `  const __events = [], __work = {};
  const __emit = (tok, phase, extra = {}) => { const e = {at:performance.now(),tok,phase,...extra}; __events.push(e); performance.mark('butter-latency:'+tok+':'+phase); document.dispatchEvent(new CustomEvent('butter-latency', {detail:JSON.stringify(e)})); };
  const __timed = (name, fn) => (...args) => { const s=performance.now(); try { return fn(...args); } finally { const d=performance.now()-s, w=__work[name] ??= {calls:0,ms:0,max:0}; w.calls++; w.ms+=d; w.max=Math.max(w.max,d); } };
  globalThis.__butterLatency = {events:__events,work:__work};
  const ZH =`);
  // Sync work only: includes any layout forced synchronously by these functions.
  for (const name of ['reconcile','render','step','measure']) {
    const start = source.indexOf(`  const ${name} = `), body = source.indexOf('=> {',start), end = source.indexOf('\n  };',body);
    if(start<0||body<0||end<0) throw Error('Cannot wrap '+name);
    source = source.slice(0,start)+source.slice(start,end).replace(`const ${name} = `,`const ${name} = __timed('${name}', `)+'\n  });'+source.slice(end+6);
  }
  for (const [marker,name,ending] of [['const ro = new ResizeObserver(es => {','scrollerRO','\n  });'], ['ioPos = new IntersectionObserver(es => {','ioPos','\n    }, {'], ['ioBand = new IntersectionObserver(es => {','ioBand','\n    }, {']]) {
    const start=source.indexOf(marker), end=source.indexOf(ending,start);
    if(start<0||end<0) throw Error('Cannot wrap '+name);
    const part=source.slice(start,end).replace('Observer(es => {',`Observer(__timed('${name}', es => {`);
    source=source.slice(0,start)+part+(ending.includes('}, {')?'\n    }), {':'\n  }));')+source.slice(end+ending.length);
  }
  for(const arg of ['entries','()']) {
    const needle=`const ro = new ResizeObserver(${arg} => {`;
    if(!source.includes(needle))continue;
    const start=source.indexOf(needle),end=source.indexOf('\n    });',start);
    source=source.slice(0,start)+source.slice(start,end).replace(`Observer(${arg} => {`,`Observer(__timed('followRO', ${arg} => {`)+ '\n    }));'+source.slice(end+8);
  }
  replace('  const targetTop = ', '  let targetTop = ');
  replace('  const estimate = ', '  let estimate = ');
  replace('  const flash = ', '  let flash = ');
  replace('})();', `  targetTop = __timed('targetTop', targetTop); estimate = __timed('estimate', estimate); flash = __timed('flash', flash);\n})();`);
  const modern = source.includes('await Promise.all([ready.quiet');
  replace('    let id = qs[i].id;', `    __emit(tok, 'click', {i, label:qs[i].q.slice(0,35)});\n    let id = qs[i].id;`);
  if (modern) {
    const repeat = source.includes('trip && !journey?.earlier && busyId') ? 'trip && !journey?.earlier && busyId' : 'trip && busyId';
    replace(`    if (!earlier && ${repeat} === qs[i].id) return;`, `    if (!earlier && ${repeat} === qs[i].id) { __emit(jumpTok, 'repeat', {i, label:qs[i].q.slice(0,35)}); return; }`);
    replace("      if (live()) await (relay", "      __emit(tok, relay ? 'redirect:start' : 'depart:start');\n      if (live()) await (relay");
    replace('      if (!live()) return;\n      if (earlier)', `      __emit(tok, relay ? 'redirect:end' : 'depart:end');
      __emit(tok, 'tries:start', {mounted:!!el});
      if (!live()) return;
      if (earlier)`);
  } else {
    replace('    setBusy(id, tok);\n    await (relay', `    setBusy(id, tok);\n    __emit(tok, relay ? 'redirect:start' : 'depart:start', {mounted:!!el});\n    await (relay`);
    replace('    let landed = false;', `    __emit(tok, relay ? 'redirect:end' : 'depart:end');\n    __emit(tok, 'tries:start', {mounted:!!el});\n    let landed = false;`);
  }
  replace('for (let tries = 0; tries < 8 && !el && live(); tries++) {', `for (let tries = 0; tries < 8 && !el && live(); tries++) {\n        __emit(tok, 'try', {n:tries+1});`);
  replace('      if (!el || !live()) return;\n      sc.scrollTop = targetTop(el);', `      __emit(tok, 'tries:end', {mounted:!!el,live:live()});
      if (!el || !live()) return;
      __emit(tok, 'align:start');
      sc.scrollTop = targetTop(el);
      __emit(tok, 'align:end');`);
  const pageLine=source.split('\n').find(l=>l.includes('sc.scrollTop < PAGE_AT) { await nextPage(4000'));
  replace(pageLine, pageLine.replace('{ await nextPage', "{ __emit(tok,'postPage:start'); await nextPage").replace('150)); }', "150)); __emit(tok,'postPage:end'); }"));
  const mathLoop=source.split('\n').find(l=>l.includes('for (const end = performance.now() + 3000;'));
  replace(mathLoop, `      __emit(tok,'katex:start');\n${mathLoop}`);
  if (modern) {
    replace('      el = mountedEl(id);\n      if (!el || !live()) return;', `      __emit(tok,'katex:end');\n      el = mountedEl(id);\n      if (!el || !live()) return;`);
    replace('      await Promise.all([ready.quiet ? null : quiet(live, 4000), steady(el, live, lead, 3000, 150, ready.geometry)]);', `      __emit(tok,'readiness:start');
      await Promise.all([ready.quiet ? null : quiet(live, 4000), steady(el, live, lead, 3000, 150, ready.geometry)]);`);
    replace('      el = await steady(el, live, lead, 3000, 150, ready.geometry);', `      el = await steady(el, live, lead, 3000, 150, ready.geometry);\n      __emit(tok,'readiness:end');`);
    replace('      if (trip?.tok === tok) arrive(null, 0);', `      if (trip?.tok === tok) { __emit(tok,'expiry:reveal', {mounted:!!el,landed}); arrive(null, 0); }`);
    replace('      const expired = tok === jumpTok', `      __emit(tok,'finally', {landed,live:live(),deadline:end});\n      const expired = tok === jumpTok`);
  } else {
    replace('      await quiet(live, 4000);', `      __emit(tok,'katex:end');\n      __emit(tok,'quiet:start');\n      await quiet(live, 4000);\n      __emit(tok,'quiet:end');`);
    const steadyCall = source.includes('el = await steady(el, live, lead)') ? 'el = await steady(el, live, lead)' : 'await steady(el, live, lead)';
    replace(`      ${steadyCall};`, `      __emit(tok,'steady:start');\n      ${steadyCall};\n      __emit(tok,'steady:end');`);
    replace('    } finally {\n      if (trip?.tok === tok)', `    } finally {\n      __emit(tok,'finally', {landed,live:live()});\n      if (trip?.tok === tok)`);
  }
  const landed = source.includes('      if (tok === jumpTok) landedAt();') ? '\n      if (tok === jumpTok) landedAt();   // stopped moving; settle only nudges by a few px' : '';
  replace(`      await arrive(el, lead);${landed}\n      await settle(el, live);`, `      __emit(tok,'arrive:start', {top:el.getBoundingClientRect().top-sc.getBoundingClientRect().top});
      await arrive(el, lead);
      __emit(tok,'arrive:end');${landed}
      __emit(tok,'settle:start');
      await settle(el, live);
      __emit(tok,'settle:end');`);
  return source;
}
const all=[];
const refs = {alpha6:'75a9387',new:null,alpha5:'79c6c27',head:'1d7fdc6'};
for (const version of (process.env.VERSION ? [process.env.VERSION] : ['alpha6','new'])) {
  const ref = refs[version];
  if (!(version in refs)) throw Error('Unknown VERSION '+version);
  const stage=process.env.EXT ?? `/home/simon/snap/chromium/common/butter-jump-latency-${version}`;
  fs.mkdirSync(stage,{recursive:true});
  // Keep both arms on alpha.6 assets; only the nav source differs.
  const historicalFiles = revision => execFileSync('git',['ls-tree','-r','--name-only',revision,'extension'],{cwd:repo,encoding:'utf8'}).trim().split('\n');
  const historicalStem = files => path.basename(files.find(f=>f.endsWith('-nav.js'))).slice(0,-'-nav.js'.length);
  const assets = historicalFiles('75a9387'), stem = historicalStem(assets);
  const rename = value => value.replaceAll(stem,'butter');
  for (const f of assets) {
    const dest=path.join(stage,rename(f.slice('extension/'.length))); fs.mkdirSync(path.dirname(dest),{recursive:true});
    const content=execFileSync('git',['show',`75a9387:${f}`],{cwd:repo});
    fs.writeFileSync(dest,/\.(js|css|json)$/.test(f)?rename(content.toString('utf8')):content);
  }
  // A revision's rail: its nav script (`nav`) and the scripts it needs ahead of it (`deps`). Before
  // the rail moved to rail/ it was one `<stem>-nav.js`; since, rail/rail.js reads the globals of the
  // scripts its manifest loads before it (rail-scripts.mjs), read from that revision.
  const historicalNav = revision => {
    const files=historicalFiles(revision);
    if (files.includes('extension/rail/rail.js')) {
      const show=f=>execFileSync('git',['show',`${revision}:extension/${f}`],{cwd:repo,encoding:'utf8'});
      const scripts=railScripts(JSON.parse(show('manifest.json')));
      return {deps:scripts.slice(0,-1).map(show),nav:show('rail/rail.js')};
    }
    const name=historicalStem(files);
    return {deps:[],nav:execFileSync('git',['show',`${revision}:extension/${name}-nav.js`],{cwd:repo,encoding:'utf8'}).replaceAll(name,'butter')};
  };
  const {deps,nav:original}=ref ? historicalNav(ref) : {deps:railDeps(),nav:fs.readFileSync(path.join(repo,'extension/rail/rail.js'),'utf8')};
  fs.writeFileSync(path.join(out,`${version}-original.js`),original);
  // A split rail needs its dependencies ahead of it in the one staged script.
  const source=deps.map(d=>d+'\n').join('')+instrument(original); fs.writeFileSync(path.join(stage,'butter-nav.js'),source);
  fs.writeFileSync(path.join(out,`${version}-instrumented.js`),source);
  execFileSync('node',['--check',path.join(stage,'butter-nav.js')]);
  log({version,ref,originalSha256:createHash('sha256').update(original).digest('hex'),stage});
  const restart=execFileSync(path.join(repo,'lab/lab'),['restart-browser'],{env:{...process.env,LAB_EXTENSIONS:stage},encoding:'utf8'}); log(restart.trim());
  for(let i=0;i<60;i++){try{await fetch('http://127.0.0.1:9222/json/version');break;}catch{await sleep(500);}}
  const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),p=b.contexts()[0].pages().find(p=>p.url().startsWith('https://chatgpt.com'));
  const cdp=await p.context().newCDPSession(p), contexts=new Map();
  cdp.on('Runtime.executionContextCreated',({context})=>contexts.set(context.id,context));
  cdp.on('Runtime.executionContextDestroyed',({executionContextId})=>contexts.delete(executionContextId));
  cdp.on('Runtime.executionContextsCleared',()=>contexts.clear());
  await cdp.send('Runtime.enable');
  await cdp.send('Profiler.enable');
  await p.addInitScript(()=>{
    window.__jumpResearch={events:[],longtasks:[],reveals:[],frames:[],pages:[]};
    document.addEventListener('butter-latency',e=>__jumpResearch.events.push(JSON.parse(e.detail)));
    new PerformanceObserver(list=>{for(const e of list.getEntries()) __jumpResearch.longtasks.push(e.toJSON());}).observe({type:'longtask',buffered:true});
    let last=0,wasVisible=false;
    const frame=t=>{
      const root=document.querySelector('chatgpt-butter-nav')?.shadowRoot,warp=root?.querySelector('.warp');
      if(warp){const s=getComputedStyle(warp), visible=s.visibility==='visible' && +s.opacity>.01;
        if(wasVisible&&!visible)__jumpResearch.reveals.push({at:performance.now(),kind:'warp-hidden'});
        wasVisible=visible;
      }
      __jumpResearch.frames.push({at:t,dt:last?t-last:0});last=t;requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  });
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  p.on('response',r=>{if(/\/messages\?/.test(r.url())&&new URL(r.url()).searchParams.has('before')) p.evaluate(()=>__jumpResearch.pages.push({at:performance.now()})).catch(()=>{});});
  try {
    await p.goto(chat); await p.locator('.ProseMirror').first().waitFor(); await p.locator('chatgpt-butter-nav[data-on]').waitFor({state:'attached'}); await sleep(3000);
    const work=async()=>{
      for(const ctx of [...contexts.values()].filter(c=>c.name==='Butter for ChatGPT')) {
        try {const r=await cdp.send('Runtime.evaluate',{contextId:ctx.id,expression:'JSON.stringify(globalThis.__butterLatency?.work)',returnByValue:true});if(r.result.value)return r.result.value;} catch {}
      }
      throw Error('No live extension telemetry context');
    };
    const waitDone=async()=>{await p.waitForFunction(()=>{const r=document.querySelector('chatgpt-butter-nav')?.shadowRoot;return r&&!r.querySelector('.busy')&&getComputedStyle(r.querySelector('.warp')).visibility==='hidden';},{},{timeout:65000});};
    // Fetch all old pages by scrolling / using the real rail; no messages, no direct API requests.
    for(let i=0;i<20;i++){
      const more=await p.locator('chatgpt-butter-nav .more').isVisible();if(!more)break;
      await p.evaluate(()=>{const more=document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more');if(!more.hidden)more.click();});await p.mouse.move(5,500);await sleep(version==='alpha5'?2200:500);await waitDone();
      if(version==='alpha5') {await p.evaluate(()=>{const s=document.querySelector('.thread-scroll-container');s.scrollTop=500;});await sleep(250);await p.evaluate(()=>document.querySelector('.thread-scroll-container').scrollTop=0);await sleep(1800);}
    }
    await waitDone();await sleep(1500);
    log({version,history:await p.evaluate(()=>({ticks:[...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')].map(x=>x.getAttribute('aria-label').slice(0,35)),more:!document.querySelector('chatgpt-butter-nav').shadowRoot.querySelector('.more').hidden})),contexts:[...contexts.values()].map(c=>({id:c.id,name:c.name}))});
    const coordinates=await p.evaluate(()=>Object.fromEntries([...document.querySelector('chatgpt-butter-nav').shadowRoot.querySelectorAll('.tick')].map(t=>{const r=t.getBoundingClientRect();return [t.getAttribute('aria-label').match(/^\[(t\d+)\]/)?.[1]??t.getAttribute('aria-label'),{x:r.x+r.width/2,y:r.y+r.height/2}];})));
    const click=async label=>{const c=coordinates[label];if(!c)throw Error('Unknown tick '+label);await p.mouse.click(c.x,c.y);await p.mouse.move(5,500);};
    // Alternate the same early/late math pair to get >=5 far jumps in each direction.
    await click('t02');await waitDone();await sleep(750);
    const scenarios = (process.env.SCENARIOS ?? 'takeover-same,takeover-distinct,takeover-burst').split(',').filter(Boolean);
    const cases = [...(process.env.TAKEOVER_ONLY ? [] : Array.from({length:runs*2},(_,n)=>({scenario:'single',direction:n%2===0?'down':'up'}))),
      ...scenarios.map(scenario=>({scenario,direction:'down'}))];
    for (const [n,{scenario,direction}] of cases.entries()) {
      if (scenario !== 'single') { await click('t02'); await waitDone(); await sleep(750); }
      const sequence = scenario==='takeover-burst' ? ['t09','t04','t02','t08','t03','t09','t04','t06'] : ['t09','t04',scenario==='takeover-distinct'?'t06':'t09'];
      const label = scenario==='single' ? (direction==='down'?'t09':'t02') : sequence.at(-1);
      const filePrefix = scenario==='single' ? `${version}-${n+1}` : `${version}-${scenario}`;
      const before=JSON.parse(await work()||'{}');
      const start=await p.evaluate(()=>performance.now());
      await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
      const profileClock=await p.evaluate(()=>({now:performance.now(),origin:performance.timeOrigin}));
      // Trace one trip in each direction and the takeover; profiles and longtasks cover every trip.
      const traceChunks=[];const onTrace=e=>traceChunks.push(...e.value);let trace=false;
      if(n<2||scenario.startsWith('takeover')){trace=true;cdp.on('Tracing.dataCollected',onTrace);await cdp.send('Tracing.start',{categories:'toplevel,devtools.timeline,v8.execute,disabled-by-default-devtools.timeline.stack,blink.user_timing',transferMode:'ReportEvents'});}
      const inputSent=[];
      if(scenario.startsWith('takeover')){
        const t0=Date.now();
        await Promise.all(sequence.map((q,j)=>new Promise((resolve,reject)=>setTimeout(()=>{
          const c=coordinates[q];inputSent.push({label:q,offsetMs:Date.now()-t0});
          const press=cdp.send('Input.dispatchMouseEvent',{type:'mousePressed',x:c.x,y:c.y,button:'left',clickCount:1});
          const release=cdp.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:c.x,y:c.y,button:'left',clickCount:1});
          Promise.all([press,release]).then(resolve,reject);
        },j*Number(process.env.INPUT_MS ?? 1000)))));
        await p.mouse.move(5,500);
      } else await click(label);
      await waitDone();await sleep(600);
      const end=await p.evaluate(()=>performance.now());
      const {profile}=await cdp.send('Profiler.stop');
      if(trace){const done=new Promise(r=>cdp.once('Tracing.tracingComplete',r));await cdp.send('Tracing.end');await done;cdp.off('Tracing.dataCollected',onTrace);fs.writeFileSync(path.join(out,`${filePrefix}-trace.json`),JSON.stringify({traceEvents:traceChunks}));}
      const after=JSON.parse(await work()||'{}');
      const data=await p.evaluate(({start,end,label})=>{
        const s=__jumpResearch,sc=document.querySelector('.thread-scroll-container'),prefix='['+(label)+']';
        const target=[...sc.querySelectorAll('[data-turn-key]')].find(t=>t.querySelector('[data-user-message-bubble]')?.textContent.trim().startsWith(prefix));
        return {events:s.events.filter(e=>e.at>=start&&e.at<=end),longtasks:s.longtasks.filter(e=>e.startTime>=start&&e.startTime<=end),reveals:s.reveals.filter(e=>e.at>=start&&e.at<=end),frames:s.frames.filter(e=>e.at>=start&&e.at<=end),pages:s.pages.filter(e=>e.at>=start&&e.at<=end),targetTop:target?target.getBoundingClientRect().top-sc.getBoundingClientRect().top:null};
      },{start,end,label});
      if(!data.reveals.length) throw Error(`No completed reveal: ${version} ${n+1}`);
      if(data.targetTop===null || Math.abs(data.targetTop-64)>3) throw Error(`Bad target position: ${data.targetTop}`);
      const delta={};for(const [k,v]of Object.entries(after)) delta[k]={calls:v.calls-(before[k]?.calls??0),ms:v.ms-(before[k]?.ms??0),maxCumulative:v.max};
      const result={version,n:n+1,scenario,direction,start,end,inputSent,profileClock,...data,work:delta,profileFile:`${filePrefix}-profile.json`,traceFile:trace?`${filePrefix}-trace.json`:null};
      fs.writeFileSync(path.join(out,result.profileFile),JSON.stringify(profile));fs.writeFileSync(path.join(out,`${filePrefix}.json`),JSON.stringify(result,null,2));all.push(result);
      log({version,n:n+1,scenario,direction,events:result.events.map(e=>({phase:e.phase,t:Math.round(e.at-start),...(e.n?{n:e.n}:{}),...(e.pending!==undefined?{pending:e.pending}:{}),...(e.mounted!==undefined?{mounted:e.mounted}:{}),...(e.live!==undefined?{live:e.live}:{})})),reveals:result.reveals.map(e=>Math.round(e.at-start)),targetTop:result.targetTop,longtasks:result.longtasks.length,longtaskMs:Math.round(result.longtasks.reduce((a,e)=>a+e.duration,0)),work:delta});
      await sleep(500);
    }
    fs.writeFileSync(path.join(out,`${version}-errors.json`),JSON.stringify(errors,null,2));
  } finally {await b.close();}
}
fs.writeFileSync(path.join(out,`${process.env.VERSION ?? 'both'}-${process.env.TAKEOVER_ONLY?'takeovers':'all'}.json`),JSON.stringify(all,null,2));log({done:all.length,output:out});
