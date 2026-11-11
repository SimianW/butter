import json,pathlib
root=pathlib.Path(__file__).parent/'data'
comparison={}
for mode in ['matrix','wash']:
 a,b=[json.loads((root/f'bookmarks-{mode}-{x}'/'summary.json').read_text()) for x in ['main','pr']]
 checks=lambda d:[(x['name'],x['pass']) for x in d['checks']]
 row={'orderedChecksIdentical':checks(a)==checks(b),'cleanupIdentical':a['cleanup']==b['cleanup'],'counts':{k:{'passed':sum(x['pass'] for x in d['checks']),'total':len(d['checks'])} for k,d in [('main',a),('pr',b)]},'differences':[]}
 for i in range(max(len(a['checks']),len(b['checks']))):
  x=checks(a)[i] if i<len(a['checks']) else None
  y=checks(b)[i] if i<len(b['checks']) else None
  if x!=y: row['differences'].append({'index':i,'main':x,'pr':y})
 row['drags']={k:[{f:d[f] for f in ['arm','repetition','held','updates','mounts','frames','p95FrameMs','maxFrameMs']} for d in v['drags']] for k,v in [('main',a),('pr',b)]}
 comparison[mode]=row
 print(mode,'ordered checks identical:',row['orderedChecksIdentical'],'cleanup identical:',row['cleanupIdentical'])
 for d in row['differences']:print('DIFFERENCE',json.dumps(d))
attempts={k:[json.loads(p.read_text()) for p in sorted(root.glob(f'branch-live-{k}-[1-3].json'))] for k in ['main','pr']}
pills=lambda d:[(r['width'],r.get('button')) for r in d['runs']]
reference=pills(attempts['main'][-1])
comparison['branch']={'allAttemptsPillMeasurementsIdentical':all(pills(d)==reference for ds in attempts.values() for d in ds),'allAttemptsReadyBothWidths':all([(r['width'],r.get('end')) for r in d['runs']]==[(1280,'ready'),(800,'ready')] for ds in attempts.values() for d in ds),'finalAttemptPasses':{k:ds[-1]['exit']==0 for k,ds in attempts.items()},'attemptCounts':{k:len(ds) for k,ds in attempts.items()}}
print('branch pill measurements identical:',comparison['branch']['allAttemptsPillMeasurementsIdentical'])
print('branch ready at both widths in every attempt:',comparison['branch']['allAttemptsReadyBothWidths'])
(root/'comparison.json').write_text(json.dumps(comparison,indent=2)+'\n')
