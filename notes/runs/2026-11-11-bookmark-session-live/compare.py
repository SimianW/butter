import json,pathlib
from itertools import zip_longest
root=pathlib.Path(__file__).parent/'data'
comparison={}
for mode in ['matrix','wash']:
 attempts={b:[json.loads(p.read_text()) for p in sorted(root.glob(f'bookmarks-{mode}-{b}-*/summary.json'))] for b in ['main','pr']}
 a,b=[attempts[k][-1] for k in ['main','pr']]
 checks=lambda d:[(c['name'],c['pass']) for c in d['checks']]
 row={'orderedChecksIdentical':checks(a)==checks(b),'cleanupIdentical':a['cleanup']==b['cleanup'],'attemptCounts':{k:len(v) for k,v in attempts.items()},'allAttemptCounts':{k:[{'passed':sum(c['pass'] for c in d['checks']),'total':len(d['checks']),'failure':d.get('failure')} for d in ds] for k,ds in attempts.items()},'differences':[{'index':i+1,'main':x,'pr':y} for i,(x,y) in enumerate(zip_longest(checks(a),checks(b))) if x!=y],'drags':{k:d['drags'] for k,d in [('main',a),('pr',b)]},'jumpEvidence':{k:d.get('jumpEvidence',{}) for k,d in [('main',a),('pr',b)]}}
 comparison[mode]=row
 print(mode,'ordered checks identical:',row['orderedChecksIdentical'],'cleanup identical:',row['cleanupIdentical'])
 for d in row['differences']:print('DIFFERENCE',json.dumps(d))
attempts={b:[json.loads(p.read_text()) for p in sorted(root.glob(f'branch-live-{b}-?.json'))] for b in ['main','pr']}
pills=lambda d:[(x['width'],x.get('button')) for x in d['runs']]
reference=pills(attempts['main'][-1])
comparison['branch']={'allAttemptsPillMeasurementsIdentical':all(pills(d)==reference for ds in attempts.values() for d in ds),'allAttemptsReadyBothWidths':all([(v['width'],v.get('end')) for v in d['runs']]==[(1280,'ready'),(800,'ready')] for ds in attempts.values() for d in ds),'attemptCounts':{k:len(v) for k,v in attempts.items()}}
print('branch pill measurements identical:',comparison['branch']['allAttemptsPillMeasurementsIdentical'])
print('branch ready at both widths in every attempt:',comparison['branch']['allAttemptsReadyBothWidths'])
(root/'comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
