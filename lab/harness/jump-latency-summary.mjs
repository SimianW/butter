// Usage: node lab/harness/jump-latency-summary.mjs
// Rebuild summary.json / tables.md from scratch/faster-jumps single and takeover JSON files.
import fs from 'node:fs';
const dir=new URL((process.env.OUT ?? './scratch/faster-jumps')+'/',import.meta.url);
const data=fs.readdirSync(dir).filter(f=>/^(head|alpha5|alpha6|new)(?:-distinct)?-(?:\d+|takeover-(?:same|distinct|burst))\.json$/.test(f)).map(f=>({...JSON.parse(fs.readFileSync(new URL(f,dir))),raw:f}));
const med=x=>{x=x.slice().sort((a,b)=>a-b);return x.length?x.length%2?x[(x.length-1)/2]:(x[x.length/2-1]+x[x.length/2])/2:0;};
const stats=x=>({median:+med(x).toFixed(1),max:+Math.max(0,...x).toFixed(1)});
function profileSummary(profile,r,click,reveal){
 const nodes=new Map(profile.nodes.map(n=>[n.id,n])),parents=new Map(),cats={},hot={};
 for(const n of profile.nodes)for(const id of n.children??[])parents.set(id,n.id);
 let sampleAt=profile.startTime;const clipFrom=profile.startTime+(click.at-(r.profileClock?.now??r.start))*1000;
 for(let i=0;i<(profile.samples??[]).length;i++){
  sampleAt+=profile.timeDeltas[i]??0;if(sampleAt<clipFrom || (reveal && sampleAt>profile.startTime+(reveal.at-(r.profileClock?.now??r.start))*1000))continue;
  const node=nodes.get(profile.samples[i]),cf=node?.callFrame??{},url=cf.url??'',name=cf.functionName??'',ms=(profile.timeDeltas[i]??0)/1000;
  let owner=node;while(owner&&!owner.callFrame.url)owner=nodes.get(parents.get(owner.id));const ownerUrl=owner?.callFrame.url??url;
  const cat=ownerUrl.includes('chrome-extension://')?ownerUrl.split('/').pop():/chatgpt.com\/(cdn|assets)/.test(ownerUrl)?'ChatGPT assets':ownerUrl.includes('chatgpt.com')?'ChatGPT other':name==='(idle)'?'idle':name==='(program)'?'native/program':name==='(garbage collector)'?'GC':url.includes('pptr:')||url.includes('playwright')?'harness':url?'other URLs':'native/anonymous';
  cats[cat]=(cats[cat]??0)+ms;
  const key=`${name||'(anonymous)'} @ ${url.split('/').pop()}:${cf.lineNumber}`;hot[key]=(hot[key]??0)+ms;
 }
 return {sampledMs:cats,hot:Object.entries(hot).sort((a,b)=>b[1]-a[1]).slice(0,18)};
}
function traceSummary(file){
 const all=JSON.parse(fs.readFileSync(new URL(file,dir))).traceEvents;
 const cost=new Map();for(const e of all)if(e.name==='Layout'&&e.ph==='X')cost.set(e.pid,(cost.get(e.pid)??0)+(e.dur??0));
 const pid=[...cost].sort((a,b)=>b[1]-a[1])[0]?.[0];
 const thread=all.find(e=>e.name==='thread_name'&&e.args.name==='CrRendererMain'&&e.pid===pid);
 if(!thread)return {error:'No main thread'};
 const mark=all.find(e=>e.pid===thread.pid&&e.name?.startsWith('butter-latency:')&&e.name.endsWith(':click'));
 const events=all.filter(e=>e.pid===thread.pid&&e.tid===thread.tid&&e.ph==='X'&&(!mark||e.ts+(e.dur??0)>=mark.ts));
 const tasks=events.filter(e=>/RunTask$/.test(e.name)&&e.dur>=50000).map(e=>{
  const sub=events.filter(x=>x.ts>=e.ts&&x.ts<e.ts+e.dur);
  const calls=sub.filter(x=>x.name==='FunctionCall').map(x=>({ms:x.dur/1000,url:x.args.data?.url,functionName:x.args.data?.functionName})).sort((a,b)=>b.ms-a.ms).slice(0,10);
  const layout=sub.filter(x=>x.name==='Layout'||x.name==='UpdateLayoutTree').map(x=>({type:x.name,ms:x.dur/1000,stack:x.args.beginData?.stackTrace??x.args.data?.stackTrace})).sort((a,b)=>b.ms-a.ms).slice(0,8);
  return {atMs:mark?(e.ts-mark.ts)/1000:null,ms:e.dur/1000,calls,layout};
 });
 const agg={};for(const name of ['Layout','UpdateLayoutTree','Paint','PrePaint','FunctionCall','FireAnimationFrame','UpdateLayerTree'])agg[name]=events.filter(e=>e.name===name).reduce((a,e)=>a+e.dur/1000,0);
 return {tasks,aggregateInclusiveMs:agg};
}
const rows=[];
for(const r of data){
 const clicks=r.events.filter(e=>e.phase==='click'),click=clicks.at(-1),events=r.events.filter(e=>e.tok===click?.tok);
 const event=p=>events.find(e=>e.phase===p),dur=p=>event(p+':end')&&event(p+':start')?event(p+':end').at-event(p+':start').at:0;
 const reveal=r.reveals.find(e=>e.at>(event('arrive:start')?.at??event('expiry:reveal')?.at??Infinity));
 const phases=Object.fromEntries(['depart','redirect','tries','align','postPage','katex','quiet','steady','readiness','arrive','settle'].map(p=>[p,dur(p)]));
 const longtasks=r.longtasks.filter(e=>e.startTime>=clicks[0]?.at && e.startTime<=(reveal?.at??r.end));
 const row={version:r.version,n:r.n,scenario:r.scenario,direction:r.direction,raw:r.raw,clicks:clicks.map(e=>({tok:e.tok,at:e.at-clicks[0].at,label:e.label})),phases,tries:events.filter(e=>e.phase==='try').length,math:event('katex:start')?.math,pendingStart:event('katex:start')?.pending,pendingEnd:event('katex:end')?.pending,
   revealMs:reveal?reveal.at-click.at:null,firstClickToFinalReveal:reveal?reveal.at-clicks[0].at:null,revealStartMs:event('arrive:start')?event('arrive:start').at-click.at:null,doneMs:event('settle:end')?event('settle:end').at-click.at:null,targetTop:r.targetTop,
   longtasks:{count:longtasks.length,ms:longtasks.reduce((a,e)=>a+e.duration,0),max:Math.max(0,...longtasks.map(e=>e.duration))},work:r.work,
   profile:profileSummary(JSON.parse(fs.readFileSync(new URL(r.profileFile,dir))),r,clicks[0],reveal),trace:r.traceFile?traceSummary(r.traceFile):null};
 rows.push(row);
}
const groups=[];for(const version of ['alpha6','new','head','alpha5'])for(const direction of ['all','up','down']){
 const rs=rows.filter(r=>r.version===version&&r.scenario==='single'&&(direction==='all'||r.direction===direction));if(!rs.length)continue;
 const group={version,direction,count:rs.length,stats:{}};
 for(const p of ['revealMs','revealStartMs','doneMs','tries'])group.stats[p]=stats(rs.map(r=>r[p]??0));
 for(const p of ['depart','tries','align','postPage','katex','quiet','steady','readiness','arrive','settle'])group.stats[p==='tries'?'triesMs':p]=stats(rs.map(r=>r.phases[p]));
 for(const p of ['count','ms','max'])group.stats['longtask_'+p]=stats(rs.map(r=>r.longtasks[p]));
 const workKeys=new Set(rs.flatMap(r=>Object.keys(r.work)));group.work={};for(const p of workKeys)group.work[p]={calls:stats(rs.map(r=>r.work[p]?.calls??0)),ms:stats(rs.map(r=>r.work[p]?.ms??0))};
 const keys=new Set(rs.flatMap(r=>Object.keys(r.profile.sampledMs)));group.profile={};for(const p of keys)group.profile[p]=stats(rs.map(r=>r.profile.sampledMs[p]??0));
 groups.push(group);
}
fs.writeFileSync(new URL('summary.json',dir),JSON.stringify({groups,rows},null,2));
const columns=['version','n','scenario','direction','revealMs','revealStartMs','doneMs','firstClickToFinalReveal','tries','targetTop',...['depart','redirect','tries','align','postPage','katex','quiet','steady','readiness','arrive','settle'].map(p=>'phase_'+p),'longtask_count','longtask_ms','longtask_max','raw'];
const csv=[columns.join(','),...rows.map(r=>columns.map(k=>JSON.stringify(k.startsWith('phase_')?r.phases[k.slice(6)]:k.startsWith('longtask_')?r.longtasks[k.slice(9)]:r[k]??'')).join(','))].join('\n')+'\n';
fs.writeFileSync(new URL('rows.csv',dir),csv);

let table='| Version / direction | n | Reveal med/max | Depart | Tries | Attempts | Page wait | KaTeX | Quiet | Steady | Overlapped readiness | Arrive | Settle (after reveal) |\n|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|\n';
for(const g of groups){const v=k=>`${g.stats[k].median.toFixed(0)} / ${g.stats[k].max.toFixed(0)}`;table+=`| ${g.version} / ${g.direction} | ${g.count} | ${v('revealMs')} | ${v('depart')} | ${v('triesMs')} | ${v('tries')} | ${v('postPage')} | ${v('katex')} | ${v('quiet')} | ${v('steady')} | ${v('readiness')} | ${v('arrive')} | ${v('settle')} |\n`;}
fs.writeFileSync(new URL('tables.md',dir),table);console.log(table);
for(const r of rows.filter(r=>r.scenario.startsWith('takeover')))console.log(JSON.stringify({version:r.version,scenario:r.scenario,clicks:r.clicks,firstClickToFinalReveal:r.firstClickToFinalReveal,revealMs:r.revealMs,phases:r.phases,targetTop:r.targetTop}));
