# scroll2.py <run.json>... : scroll samples after completion: last stream samples, `after` (3 s), tail hydration turn heights
import json,sys
for p in sys.argv[1:]:
    s=json.load(open(p)); sm=s['stream']['samples']
    i=next(k for k in range(1,len(sm)) if sm[k-1].get('inProgress') and not sm[k].get('inProgress'))
    g=sm[i]['t']; a=s['stream']['after']['s']
    hy=[r for r in s['hydration']['rows'] if r and r['t']>=g]
    print(json.dumps(dict(run=s['label'],samples=[(round(x['t']-g),x['y'],x['h']) for x in sm[i:]],after=(round(a['t']-g),a['y'],a['h'],a['unrendered']),
      turnH=sorted({r['turnH'] for r in hy}),turnH_span=(round(hy[0]['t']-g),round(hy[-1]['t']-g)) if hy else None,n_hy=len(hy),geo_sh=s['answerGeo']['scrollHeight'],leaks=sorted({r['leaks'] for r in hy}))))
