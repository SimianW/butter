// Exercises the real MAIN-world recorder, including observer registration and restore retries.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const core = require('../extension/seek/core-main.js');
function fixture() {
  const frames = [], observed = new Set(), listeners = {}, blocks = [];
  let mutation, resized; const nativeReads=[];
  const c = {complete:true, math:true};
  class Element { get clientWidth() {nativeReads.push(turn.style.contentVisibility || 'unrestored'); return 768;} }
  const sc = Object.assign(new Element(), {clientHeight:900, contains:()=>true,getBoundingClientRect:()=>({left:0})});
  const item = Object.assign(new Element(), {nodeType:1,isConnected:true,hasAttribute:()=>false,tagName:'P',className:'p',classList:{contains:()=>false},style:{},firstChild:{nodeType:3,data:'sample'},matches:()=>false,getBoundingClientRect:()=>({top:120,left:0,width:768,height:26})});
  const turn = Object.assign(new Element(), {nodeType:1,isConnected:true,dataset:{turnKey:'a'},style:{},clientHeight:500,getBoundingClientRect:()=>({top:8,height:480}),parentElement:{getBoundingClientRect:()=>({top:0,width:768,height:500})},hasAttribute:n=>n==='data-turn-key',matches:()=>false,closest:s=>s==='.thread-scroll-container'?sc:turn,
    querySelector:s=>s.includes('in_progress')?(!c.complete?{}:null):s.includes('complete')?(c.complete?{}:null):s.includes('author-role')?{getAttribute:()=> 'm1'}:null,
    querySelectorAll:s=>s==='[data-math-source]'?(c.math?[]:[{querySelector:()=>null}]):s.includes(':not(')?blocks:blocks,
  });item.closest=()=>turn; sc.querySelectorAll=()=>[turn];
  const doc={addEventListener:(n,fn)=>listeners[n]=fn,querySelectorAll:()=>[sc]};
  const context={document:doc,location:{pathname:'/g/g-p-project/c/00000000-0000-0000-0000-000000000000'},innerWidth:1600,Element,performance:{now:()=>1},__butterSeekCore:core,
    ResizeObserver:class {constructor(fn){resized=fn;}observe(e){observed.add(e);}unobserve(e){observed.delete(e);}},
    MutationObserver:class {constructor(fn){mutation=fn;}observe(){}},requestAnimationFrame:fn=>(frames.push(fn),frames.length),
    requestIdleCallback:fn=>(frames.push(fn),frames.length),
    getComputedStyle:()=>({fontStyle:'normal',fontWeight:'400',fontSize:'16px',lineHeight:'26px',fontFamily:'system-ui',paddingTop:'0px',paddingRight:'0px',paddingBottom:'0px',paddingLeft:'0px',borderRadius:'0px',backgroundColor:'transparent',color:'black',textAlign:'left'})};
  context.window=context;vm.createContext(context);
  vm.runInContext(fs.readFileSync(require.resolve('../extension/seek/height-cache-main.js'),'utf8'),context);
  const flush=()=>{const jobs=frames.splice(0);jobs.forEach(f=>f());};
  return {context,c,turn,item,blocks,nativeReads,Element,sc,observed,flush,mutation:r=>mutation(r),resize:rs=>resized(rs),frames};
}
test('real recorder observes blocks inserted after the empty turn, before a later layout',()=>{
 const f=fixture();f.mutation([{target:{},addedNodes:[f.turn],removedNodes:[]}]);f.flush();
 assert.equal(f.context.__butterHeightCache.get('a'),null);
 f.blocks.push(f.item);f.mutation([{target:f.turn,addedNodes:[f.item],removedNodes:[]}]);
 assert.ok(f.observed.has(f.item),'late block must be observed immediately, before the next idle/frame record');
 f.resize([{target:f.turn,contentRect:{height:500}},{target:f.item,contentRect:{height:26}}]);f.flush();
 assert.equal(f.context.__butterHeightCache.get('a')?.blocks[0],26,JSON.stringify(f.context.__heightCacheDump()));
 assert.equal(f.context.__butterHeightCache.get('a').turnOffset,8);
 assert.equal(f.context.__butterHeightCache.get('a').turnH,480);
 f.resize([{target:f.item,contentRect:{height:80}}]);f.flush();
 assert.equal(f.context.__butterHeightCache.get('a').blocks[0],80);
});
test('real recorder preserves the last positive size across zero/skipped notifications and pending math',()=>{
 const f=fixture();f.blocks.push(f.item);f.mutation([{target:{},addedNodes:[f.turn],removedNodes:[]}]);
 f.resize([{target:f.turn,contentRect:{height:500}},{target:f.item,contentRect:{height:26}}]);f.flush();
 f.resize([{target:f.item,contentRect:{height:0}}]);f.flush();assert.equal(f.context.__butterHeightCache.get('a').blocks[0],26);
 f.c.math=false;f.mutation([{target:f.turn,addedNodes:[],removedNodes:[]}]);f.flush();assert.equal(f.context.__butterHeightCache.get('a').blocks[0],26);
 f.c.math=true;f.resize([{target:f.item,contentRect:{height:90}}]);f.flush();assert.equal(f.context.__butterHeightCache.get('a').blocks[0],90);
});
test('removed streamed blocks stop being observed and can be observed again if reinserted',()=>{
 const f=fixture();f.blocks.push(f.item);f.mutation([{target:{},addedNodes:[f.turn],removedNodes:[]}]);assert.ok(f.observed.has(f.item));
 f.item.isConnected=false;f.blocks.length=0;f.mutation([{target:f.turn,addedNodes:[],removedNodes:[f.item]}]);assert.ok(!f.observed.has(f.item));
 f.item.isConnected=true;f.blocks.push(f.item);f.mutation([{target:f.turn,addedNodes:[f.item],removedNodes:[]}]);assert.ok(f.observed.has(f.item));
});

test('restore applies cached sizes before any native geometry getter is read',()=>{
 const f=fixture();f.blocks.push(f.item);f.mutation([{target:{},addedNodes:[f.turn],removedNodes:[]}]);f.resize([{target:f.turn,contentRect:{height:500}},{target:f.item,contentRect:{height:26}}]);f.flush();
 f.context.__butterHeightCache.get('a').removed=true;f.nativeReads.length=0;
 const bubble=Object.assign(new f.Element(),{firstElementChild:{classList:{contains:()=>true}},closest:s=>s==='.thread-scroll-container'?f.sc:{}});
 void bubble.clientWidth;
 assert.equal(f.nativeReads.length,1,'only the final original getter may read layout; restore itself must not');
 assert.equal(f.nativeReads[0],'auto','sizes must be installed before the original geometry read');
});

test('the recorder keeps inline and display TeX spans with measured display height and trimmed offsets', () => {
 const f=fixture();
 const inline={nodeType:1,tagName:'SPAN',classList:{contains:n=>n==='katex'},querySelector:()=>({textContent:'x^2'}),nextSibling:null};
 const display={nodeType:1,tagName:'SPAN',classList:{contains:n=>n==='katex-display'},querySelector:()=>({textContent:'\\frac{a}{b}'}),getBoundingClientRect:()=>{throw Error('math descendants must not force skipped layout')},nextSibling:null};
 f.item.getBoundingClientRect=()=>({top:120,left:0,width:768,height:48});
 f.item.firstChild={nodeType:3,data:'  value ',nextSibling:inline};inline.nextSibling={nodeType:3,data:'\n',nextSibling:display};
 f.blocks.push(f.item);f.mutation([{target:{},addedNodes:[f.turn],removedNodes:[]}]);
 f.resize([{target:f.turn,contentRect:{height:500}},{target:f.item,contentRect:{height:80}}]);f.flush();
 const item=f.context.__butterHeightCache.get('a').items[0];
 assert.equal(item.text,'value x^2\n\\frac{a}{b}');
 assert.equal(item.math.length,2);
 assert.equal(item.text.slice(item.math[0].start,item.math[0].end),'x^2');
 assert.equal(item.math[1].display,true);assert.equal(item.math[1].h,48);
 assert.equal(item.text.slice(item.math[1].start,item.math[1].end),'\\frac{a}{b}');
 assert.ok(!JSON.stringify(f.context.__heightCacheDump()).includes('value'));
});
