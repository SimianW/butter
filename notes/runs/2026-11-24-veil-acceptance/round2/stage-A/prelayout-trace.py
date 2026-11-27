# prelayout-trace.py <run.json> : Butter's idle callbacks (pre-layout) in <run>.trace.json, ms after in_progress gone
import json,sys,re,collections
run=sys.argv[1]; s=json.load(open(run)); log=open(run.replace('.json','.raw.log')).read()
m=re.search(r'trace: \d+ events, started at page time ([\d.]+) \((-?\d+) ms after Enter\)',log)
pageStart=float(m.group(1)); enterPage=pageStart-float(m.group(2))
L=s['lafDetail']; gone=L['marks']['inProgressGone']; frames=L['frames']
d=json.load(open(run.replace('.json','.trace.json')))['traceEvents']
cnt=collections.Counter((e['pid'],e['tid']) for e in d if e.get('name')=='UpdateLayoutTree')
pid,tid=cnt.most_common(1)[0][0]
mark=[e for e in d if e.get('name')=='lab-trace-start'][0]['ts']
def rel(ts): return round((pageStart+(ts-mark)/1000)-enterPage-gone,1)   # ms after in_progress gone
M=[e for e in d if e['pid']==pid and e['tid']==tid]
X=sorted([e for e in M if e.get('ph')=='X' and 'dur' in e],key=lambda e:(e['ts'],-e['dur']))
ms=lambda x: round(x/1000,1)
def inside(t,e): return t['ts']<=e['ts'] and e['ts']+e.get('dur',0)<=t['ts']+t['dur']
def url(u): u=re.sub(r'chrome-extension://[a-z]+','ext:',u or ''); return re.sub(r'https?://[^/]+','',u)
idle=[e for e in X if e['name']=='FireIdleCallback']
tasks=[e for e in X if e['name']=='RunTask']
fc=[e for e in X if e['name']=='FunctionCall']
inst=[e for e in M if e.get('ph') in ('I','i','n','R')]
rows=[];other=[]
for t in idle:
    calls=[f for f in fc if inside(t,f)]
    srcs={url(f['args'].get('data',{}).get('url')) for f in calls}
    if not any('offscreen' in x for x in srcs): other.append((rel(t['ts']),ms(t['dur']),sorted(srcs))); continue
    k=[e for e in X if e is not t and inside(t,e)]
    lay=[e for e in k if e['name']=='Layout']; sty=[e for e in k if e['name']=='UpdateLayoutTree']
    added=sum(1 for e in inst if e.get('name')=='LayoutInvalidationTracking' and e['args'].get('data',{}).get('reason')=='Added to layout' and t['ts']<=e['ts']<=t['ts']+t['dur'])
    fontsInv=sum(1 for e in inst if e.get('name')=='StyleRecalcInvalidationTracking' and e['args'].get('data',{}).get('reason')=='Fonts' and t['ts']<=e['ts']<=t['ts']+t['dur'])
    task=max([x for x in tasks if inside(x,t)],key=lambda x:x['dur'],default=None)
    a=rel(t['ts']); loaf=[f for f in frames if f['s']-gone<=a<=f['s']-gone+f['d']]
    rows.append(dict(at=a,dur=ms(t['dur']),layout_ms=ms(sum(e['dur'] for e in lay)),layouts=len(lay),
      objects=sum((e['args'].get('beginData',{}).get('dirtyObjects') or 0) for e in lay),added=added,
      style_ms=ms(sum(e['dur'] for e in sty)),style_el=sum((e['args'].get('elementCount') or e['args'].get('data',{}).get('elementCount') or 0) for e in sty),
      fontsInv=fontsInv,task_ms=ms(task['dur']) if task else None,loaf=[(round(f['s']-gone),f['d']) for f in loaf]))
fonts=[]
for e in d:
    n=e.get('name')
    if n in ('ResourceSendRequest','ResourceFinish','ResourceReceiveResponse') and e.get('ph') in ('I','i','X','n'):
        da=e['args'].get('data',{}); u=da.get('url','')
        if n=='ResourceSendRequest' and not re.search(r'\.(woff2?|ttf|otf)',u): continue
        fonts.append((rel(e['ts']),n,da.get('requestId'),url(u).split('/')[-1] if u else None))
    elif n in ('BeginRemoteFontLoad','RemoteFontLoaded'):
        da=e['args'].get('data',{}) if isinstance(e.get('args'),dict) else {}
        fonts.append((rel(e['ts']),n,None,url(da.get('url','')).split('/')[-1] if da.get('url') else da.get('name')))
ids={f[2] for f in fonts if f[1]=='ResourceSendRequest'}
fonts=[f for f in fonts if f[1]!='ResourceSendRequest' and f[1] not in ('ResourceFinish','ResourceReceiveResponse') or f[2] in ids]
fonts.sort()
# which butter callback each font request falls in
spans=[(r['at'],r['at']+r['dur']) for r in rows]
out=dict(run=s['label'],trace_from=rel(min(e['ts'] for e in X)),trace_to=rel(max(e['ts']+e['dur'] for e in X)),
  completion_frame_at=round(s['completion']['s']-gone,1),butter_idle=len(rows),
  total_ms=round(sum(r['dur'] for r in rows),1),longest_ms=max([r['dur'] for r in rows],default=None),
  first=rows[0]['at'] if rows else None,last_end=round(rows[-1]['at']+rows[-1]['dur'],1) if rows else None,
  layout_ms=round(sum(r['layout_ms'] for r in rows),1),objects=sum(r['objects'] for r in rows),added=sum(r['added'] for r in rows),
  style_el=sum(r['style_el'] for r in rows),style_ms=round(sum(r['style_ms'] for r in rows),1),
  in_loaf=[r for r in rows if r['loaf']],tasks_ge50=[r for r in rows if (r['task_ms'] or 0)>=50],
  other_idle=len(other),other_idle_ms=round(sum(o[1] for o in other),1),
  fonts=[(f[0],f[1],f[3],next((i for i,(a,b) in enumerate(spans) if a<=f[0]<=b),None)) for f in fonts])
print(json.dumps(out))
for r in rows: print(json.dumps(r))
