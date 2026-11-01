"""Attribute jump/open Chrome traces without persisting chat identifiers or message text."""
import json,sys,collections,os,bisect,re

def safe(s):
    return re.sub(r'[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}','[ID]',s,flags=re.I)
def frame(cf):
    url=cf.get('url','').split('?')[0].split('/')[-1]
    return safe(f"{cf.get('functionName') or '(anonymous)'}@{url}:{cf.get('lineNumber',0)+1}:{cf.get('columnNumber',0)+1}")
def union(spans):
    total=0;end=-1
    for a,b in sorted(spans):
        total+=max(0,b-max(a,end));end=max(end,b)
    return total
for file in sys.argv[1:]:
 d=json.load(open(file));ev=d['traceEvents'];marks={e['name']:e['ts'] for e in ev if e['name'] in ['jump-start','jump-end','jump-landed','open-start','open-end','composer-ready']}
 if 'jump-start' in marks:lo,hi=marks['jump-start'],marks['jump-end'];anchor='jump-start'
 else:lo,hi=marks.get('open-start',min(e['ts'] for e in ev)),marks.get('open-end',max(e['ts'] for e in ev));anchor='open-start'
 # Marks identify the actual renderer (not browser/network threads).
 anchor_ev=next((e for e in ev if e['name']==anchor),None)
 if anchor_ev:pid,tid=anchor_ev['pid'],anchor_ev['tid']
 else:pid,tid=collections.Counter((e['pid'],e['tid']) for e in ev if e['name']=='EventDispatch').most_common(1)[0][0]
 if anchor=='open-start':
    starts=[e['ts'] for e in ev if e.get('pid')==pid and e.get('tid')==tid and e['name']=='navigationStart' and e['ts']<=lo]
    if starts:lo=max(starts)
 main=sorted([e for e in ev if e.get('pid')==pid and e.get('tid')==tid and e.get('ph')=='X' and e.get('dur',0)>0 and e['ts']<hi and e['ts']+e['dur']>lo],key=lambda e:(e['ts'],-e['dur']))
 taskname='RunTask' if any(e['name']=='RunTask' for e in main) else 'ThreadControllerImpl::RunTask'
 tasks=sorted([e for e in main if e['name']==taskname],key=lambda e:e['dur'],reverse=True)
 # Exclusive timeline durations: subtract union of immediate child intervals, clipped to window.
 stack=[];exclusive=collections.Counter();children=collections.defaultdict(list)
 for i,e in enumerate(main):
    a,b=max(lo,e['ts']),min(hi,e['ts']+e['dur'])
    while stack and main[stack[-1]]['ts']+main[stack[-1]]['dur']<=e['ts']:stack.pop()
    if stack:children[stack[-1]].append((a,b))
    exclusive[e['name']]+=b-a;stack.append(i)
 for i,spans in children.items():exclusive[main[i]['name']]-=union(spans)
 profiles=collections.defaultdict(lambda:{'nodes':{},'chunks':[],'start':None})
 for e in ev:
    if e.get('pid')!=pid:continue
    if e['name']=='Profile' and e.get('tid')==tid:profiles[str(e.get('id'))]['start']=e['args']['data']['startTime']
    if e['name']=='ProfileChunk':
       a=e['args']['data'];c=a.get('cpuProfile',{});pr=profiles[str(e.get('id'))];pr['nodes'].update({n['id']:n for n in c.get('nodes',[])});pr['chunks'].append((c.get('samples',[]),a.get('timeDeltas',[])))
 samples=[]
 for pr in profiles.values():
    clock=pr['start']
    if clock is None:continue
    chaincache={}
    for ss,dd in pr['chunks']:
       for sid,dt in zip(ss,dd):
          clock+=dt
          if not lo<=clock<=hi:continue
          chain=chaincache.get(sid)
          if chain is None:
             node=pr['nodes'].get(sid,{});chain=[];seen=set()
             while node and node.get('id') not in seen:
                nid=node.get('id');seen.add(nid)
                if nid in chaincache:chain.extend(chaincache[nid]);break
                chain.append(frame(node.get('callFrame',{})));node=pr['nodes'].get(node.get('parent'))
             chaincache[sid]=chain
          samples.append((clock,dt,chain))
 hot=collections.Counter();inclusive=collections.Counter();bundles=collections.Counter();families=collections.Counter()
 for t,dt,chain in samples:
    if chain:
       hot[chain[0]]+=dt;bundles[chain[0].split('@')[-1].split(':')[0]]+=dt
       fam='KaTeX' if any('990054.' in n for n in chain) else 'markdown' if any('418851.' in n or '76629.' in n for n in chain) else 'React' if any('226913.' in n for n in chain) else 'other'
       families[fam]+=dt
    for name in set(chain):inclusive[name]+=dt
 big=[]
 for task in tasks[:8]:
    a,b=task['ts'],task['ts']+task['dur'];inside=[e for e in main if a<=e['ts']<b];selfhot=collections.Counter();anc=collections.Counter()
    for t,dt,chain in samples:
       if a<=t<b:
          if chain:selfhot[chain[0]]+=dt
          for n in set(chain):anc[n]+=dt
    layout=[]
    for e in inside:
       if e['name'] in ('Layout','UpdateLayoutTree') and e['dur']>10000:
          data=e.get('args',{});beg=data.get('beginData',{});st=beg.get('stackTrace',data.get('data',{}).get('stackTrace',[]))
          layout.append({'name':e['name'],'ms':round(e['dur']/1000,2),'stack':[frame({**x,'lineNumber':x.get('lineNumber',1)-1,'columnNumber':x.get('columnNumber',1)-1}) for x in st[:10]],'elements':data.get('elementCount'),'dirty':beg.get('dirtyObjects'),'total':beg.get('totalObjects')})
    cats={n:round(union([(e['ts'],e['ts']+e['dur']) for e in inside if e['name']==n])/1000,2) for n in ['UpdateLayoutTree','Layout','Paint','PrePaint','MinorGC','MajorGC','V8.GC_SCAVENGER','V8.GC_MARK_COMPACTOR','FunctionCall','RunMicrotasks','EventDispatch']}
    big.append({'startMs':round((a-lo)/1000,2),'durationMs':round(task['dur']/1000,2),'timeline':cats,'self':[{'function':n,'ms':round(t/1000,2)} for n,t in selfhot.most_common(15)],'inclusive':[{'function':n,'ms':round(t/1000,2)} for n,t in anc.most_common(24)],'layouts':layout})
 out={'file':os.path.basename(os.path.dirname(file))+'/'+os.path.basename(file),'spanMs':round((hi-lo)/1000,2),'pid':pid,'tid':tid,'marks':{n:round((t-lo)/1000,2) for n,t in marks.items()},'mainBusyMs':round(union([(max(lo,e['ts']),min(hi,e['ts']+e['dur'])) for e in tasks])/1000,2),'exclusiveMs':{n:round(t/1000,2) for n,t in exclusive.most_common(25)},'sampleFamiliesMs':{n:round(t/1000,2) for n,t in families.items()},'sampleBundlesMs':{n:round(t/1000,2) for n,t in bundles.most_common(20)},'mathEvidence':[{'function':n,'ms':round(t/1000,2)} for n,t in inclusive.most_common() if '990054.' in n][:20],'markdownEvidence':[{'function':n,'ms':round(t/1000,2)} for n,t in inclusive.most_common() if '418851.' in n or '76629.' in n][:15],'self':[{'function':n,'ms':round(t/1000,2)} for n,t in hot.most_common(25)],'inclusive':[{'function':n,'ms':round(t/1000,2)} for n,t in inclusive.most_common(30)],'bigTasks':big}
 dest=file.replace('-trace.json','-attribution.json');json.dump(out,open(dest,'w'),indent=2);print(json.dumps(out))
