# frames.py <run.json> : per-task table from the u2 write to the clear frame (+1), from <run>.trace.json
import json,sys,collections,re
run=sys.argv[1]; s=json.load(open(run)); u=s['ux']; mid=[a for a in u['acts'] if a['kind']=='mid'][0]
d=json.load(open(run.replace('.json','.trace.json')))['traceEvents']
cnt=collections.Counter((e['pid'],e['tid']) for e in d if e.get('name')=='UpdateLayoutTree')
pid,tid=cnt.most_common(1)[0][0]
mark=[e for e in d if e.get('name')=='lab-trace-start'][0]['ts']
W=mark+(mid['t']-s['trace']['pageStart'])*1000   # write, trace µs
# probe frames (rt rel. gone) -> offset from write
C=u['compact']; fr=[(round(f[0]-mid['rt'],1), ''.join('-' if p<0 else str(p&7) for p in f[7])) for f in C if f[0]>=mid['rt']-1][:6]
blank=[x for x in fr if any(c in '1234567' for c in x[1])]
clear=next(x for x in fr if x[0]>blank[0][0] and not any(c in '1234567' for c in x[1]))
END=W+(clear[0]+60)*1000
M=[e for e in d if e['pid']==pid and e['tid']==tid]
X=sorted([e for e in M if e.get('ph')=='X' and 'dur' in e],key=lambda e:(e['ts'],-e['dur']))
tasks=[e for e in X if e['name']=='RunTask' and e['dur']>=1000 and W-2000<=e['ts']<=END]
# cpu profile samples on main thread
nodes={};samples=[]
for e in d:
    if e.get('name')=='ProfileChunk' and e['pid']==pid:
        cp=e['args']['data'].get('cpuProfile',{}); 
        for n in cp.get('nodes',[]): nodes[n['id']]=n['callFrame']
        t=e['args']['data'].get('timeDeltas',[]); ss=cp.get('samples',[])
        samples.append((e,ss,t))
prof=[]  # (ts, node) ; profile ts base from 'Profile' event startTime
starts={e['id']:e['args']['data']['startTime'] for e in d if e.get('name')=='Profile' and e['pid']==pid}
for e,ss,t in samples:
    base=starts.get(e['id'])
    if base is None: continue
    for i,(n,dt) in enumerate(zip(ss,t)):
        base+=dt; prof.append((base,n))
    starts[e['id']]=base
def cf(n):
    c=nodes.get(n,{}); url=re.sub(r'https?://[^/]+','',c.get('url',''))
    url=re.sub(r'chrome-extension://[a-z]+','ext:',url)
    return f"{c.get('functionName') or '(anon)'} {url.split('/')[-1]}:{c.get('lineNumber')}"
def kids(t): return [e for e in X if e is not t and t['ts']<=e['ts'] and e['ts']+e['dur']<=t['ts']+t['dur']]
def inst(t,name,reason=None):
    return sum(1 for e in M if e.get('name')==name and t['ts']<=e['ts']<=t['ts']+t['dur'] and (reason is None or e['args'].get('data',{}).get('reason')==reason))
ms=lambda x: round(x/1000,1)
out=[]
print(f"# {run.split('/')[-1]}: probe frames (ms after write, flags): {fr}; clear at {clear[0]}")
for t in tasks:
    k=kids(t); o=ms(t['ts']-W)
    fa=[e for e in k if e['name']=='FireAnimationFrame']
    raf=fa[0]['ts'] if fa else None
    def ph(name,pre):
        L=[e for e in k if e['name']==name and (raf is None or (e['ts']<raf)==pre)]
        # top-level only (not nested in a same-name)
        return L
    row={'at':o,'dur':ms(t['dur'])}
    for pre,tag in ((True,'pre'),(False,'post')):
        if raf is None and pre: continue
        st=ph('UpdateLayoutTree',pre); la=ph('Layout',pre); pp=ph('PrePaint',pre)
        row[tag]={'style':[(e['args'].get('elementCount') or e['args'].get('data',{}).get('elementCount'),ms(e['dur'])) for e in st if e['dur']>=200],
                  'layout':[(f"{e['args'].get('beginData',{}).get('dirtyObjects')}/{e['args'].get('beginData',{}).get('totalObjects')}",ms(e['dur'])) for e in la if e['dur']>=200],
                  'prepaint':ms(sum(e['dur'] for e in pp))}
    row['paint']=ms(sum(e['dur'] for e in k if e['name']=='Paint' and not any(p['name']=='Paint' and p is not e and p['ts']<=e['ts']<p['ts']+p['dur'] for p in k)))
    row['layerize']=ms(sum(e['dur'] for e in k if e['name']=='Layerize')); row['commit']=ms(sum(e['dur'] for e in k if e['name']=='Commit'))
    row['scripts']=[]
    for e in k:
        if e['name']=='FunctionCall' and e['dur']>=300:
            da=e['args'].get('data',{}); url=re.sub(r'https?://[^/]+','',da.get('url','')); url=re.sub(r'chrome-extension://[a-z]+','ext:',url)
            top=collections.Counter(cf(n) for ts,n in prof if e['ts']<=ts<=e['ts']+e['dur'])
            row['scripts'].append(f"{ms(e['dur'])} {da.get('functionName') or '(anon)'} {url.split('/')[-1] or '(probe)'}:{da.get('lineNumber')} top:{[f'{a}x{b}' for a,b in top.most_common(2)]}")
    ev=[e.get('args',{}).get('data',{}).get('type') for e in k if e['name']=='EventDispatch']
    if ev: row['events']=dict(collections.Counter(ev))
    row['resolveStyle']=inst(t,'StyleResolver::ResolveStyle'); row['addedToLayout']=inst(t,'LayoutInvalidationTracking','Added to layout')
    row['fontsRestyle']=inst(t,'StyleRecalcInvalidationTracking','Fonts'); row['displayLock']=inst(t,'StyleRecalcInvalidationTracking','DisplayLock')
    row['fontLoad']=inst(t,'BeginRemoteFontLoad'); row['fontLoaded']=inst(t,'RemoteFontLoaded')
    print(json.dumps(row))
# raster and gpu between write and END
r=collections.Counter(); rd=collections.Counter()
for e in d:
    if e.get('ph')=='X' and W<=e['ts']<=END and e['name'] in ('RasterTask','GPUTask','ImageDecodeTask','DrawFrame','Rasterize'):
        r[e['name']]+=1; rd[e['name']]+=e['dur']
print('# raster/gpu write..clear+60:',{k:(r[k],ms(rd[k])) for k in r})
print('# font loads in whole trace:',[(ms(e['ts']-W),e['name']) for e in d if e.get('name') in ('BeginRemoteFontLoad','RemoteFontLoaded')])
