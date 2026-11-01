from pathlib import Path
import json
base=Path('scratch/jump-typing')
for name in ['current','stock','page2','page3','page5','initial100','blocks-only']:
 runs=[]
 for p in (base/name).glob('*-T*.json'):
  if any(x in p.name for x in ['trace','attribution']):continue
  d=json.loads(p.read_text());runs.append(d)
 if runs:print(name,[(d['rep'],d['T'],d.get('valid'),round(d['allKeyHandlerDelay']['max'] or 0),round(d['jumpMs']) if d['jumpMs'] else None,d['pageRequests']) for d in sorted(runs,key=lambda x:(x['T'],x['rep']))])
 cp=base/name/'correctness.json'
 if cp.exists():
  d=json.loads(cp.read_text());print(' correctness',{k:d.get(k) for k in ['railCount','railOrderMatches','missingMessages','duplicateMessagesWithinPages','allReachable','allPagesLoaded']})
