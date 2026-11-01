# Exclusive main-thread attribution, per-input style/layout scope, JS samples.
import json,sys,collections,os,glob
for file in sys.argv[1:]:
 d=json.load(open(file));ev=d['traceEvents']; marks={e['name']:e['ts'] for e in ev if e['name'] in ('typing-start','typing-end')};lo,hi=marks['typing-start'],marks['typing-end']
 candidates=[e for e in ev if e['name']=='EventDispatch' and e.get('args',{}).get('data',{}).get('type')=='keydown' and lo<=e['ts']<=hi]
 if not candidates:continue
 pid,tid=collections.Counter((e['pid'],e['tid']) for e in candidates).most_common(1)[0][0]
 main=sorted([e for e in ev if e['pid']==pid and e['tid']==tid and e.get('ph')=='X' and e.get('dur',0)>0 and lo<=e['ts']<=hi],key=lambda e:(e['ts'],-e['dur']))
 stack=[];exclusive=collections.Counter()
 for e in main:
  while stack and stack[-1]['ts']+stack[-1]['dur']<=e['ts']:stack.pop()
  if stack:exclusive[stack[-1]['name']]-=min(e['dur'],max(0,stack[-1]['ts']+stack[-1]['dur']-e['ts']))
  exclusive[e['name']]+=e['dur'];stack.append(e)
 groups={'style':{'UpdateLayoutTree','RecalculateStyles'},'layout':{'Layout'},'paint':{'Paint','PrePaint','PaintImage','Layerize','UpdateLayerTree'},'scripting':{'FunctionCall','EvaluateScript','EventDispatch','V8.Execute','RunMicrotasks','v8.compile','TimerFire','FireAnimationFrame'}}
 sums={k:round(sum(max(0,exclusive[n]) for n in ns)/1000,2) for k,ns in groups.items()}
 def stat(a):
  a=sorted(a);return {'n':len(a),'p50':a[len(a)//2] if a else None,'p95':a[min(len(a)-1,int(len(a)*.95))] if a else None,'max':max(a) if a else None,'sum':sum(a)}
 ks=sorted(e['ts'] for e in candidates); per=[]
 for i,t in enumerate(ks):
  events=[e for e in main if t<=e['ts']<(ks[i+1] if i+1<len(ks) else hi)];st=[e for e in events if e['name']=='UpdateLayoutTree'];ly=[e for e in events if e['name']=='Layout']
  per.append({'styleMs':sum(e['dur'] for e in st)/1000,'layoutMs':sum(e['dur'] for e in ly)/1000,'styleElements':sum(e.get('args',{}).get('elementCount',e.get('args',{}).get('beginData',{}).get('elementCount',0)) for e in st),'layoutDirty':sum(e.get('args',{}).get('beginData',{}).get('dirtyObjects',0) for e in ly),'layoutTotal':max([e.get('args',{}).get('beginData',{}).get('totalObjects',0) for e in ly] or [0])})
 profiles=collections.defaultdict(lambda:{'nodes':{},'chunks':[],'start':None})
 for e in ev:
  if e['pid']!=pid:continue
  if e['name']=='Profile':profiles[str(e.get('id'))]['start']=e['args']['data']['startTime']
  if e['name']=='ProfileChunk':
   a=e['args']['data'];c=a.get('cpuProfile',{});pr=profiles[str(e.get('id'))];pr['nodes'].update({n['id']:n for n in c.get('nodes',[])});pr['chunks'].append((c.get('samples',[]),a.get('timeDeltas',[])))
 hot=collections.Counter();src=collections.Counter()
 for pr in profiles.values():
  clock=pr['start']
  for samples,deltas in pr['chunks']:
   for sid,dt in zip(samples,deltas):
    if clock is not None:
     clock+=dt
     if not lo<=clock<=hi:continue
    cf=pr['nodes'].get(sid,{}).get('callFrame',{});url=cf.get('url','');name=cf.get('functionName','?');bucket='extension' if url.startswith('chrome-extension://') else 'chatgpt' if ('chatgpt.com/' in url or 'oaistatic.com/' in url) else 'other';src[bucket]+=dt/1000;hot[(bucket,name,url,cf.get('lineNumber'))]+=dt/1000
 result={'trace':os.path.basename(file),'timeMs':sums,'stylePerKey':stat([x['styleElements'] for x in per]),'layoutDirtyPerKey':stat([x['layoutDirty'] for x in per]),'layoutTotalPerKey':stat([x['layoutTotal'] for x in per]),'sampleMs':dict(src),'hotFunctions':[{'source':k[0],'fn':k[1],'url':k[2],'line':k[3],'ms':round(v,2)} for k,v in sorted(((k,v) for k,v in hot.items() if k[2]),key=lambda x:-x[1])[:20]],'extensionFunctions':[{'fn':k[1],'url':k[2],'line':k[3],'ms':round(v,2)} for k,v in sorted(((k,v) for k,v in hot.items() if k[0]=='extension'),key=lambda x:-x[1])[:15]],'exclusiveMs':[(k,round(v/1000,2)) for k,v in exclusive.most_common(15)],'perKey':per}
 json.dump(result,open(file.replace('-trace.json','-analysis.json'),'w'),indent=2);print(json.dumps({k:v for k,v in result.items() if k not in ('perKey','hotFunctions','exclusiveMs')}))
