# runs.py <run.json>... : one JSON row per run from the harness JSON and its .raw.log
import json,sys,re
for p in sys.argv[1:]:
    s=json.load(open(p)); log=open(p.replace('.json','.raw.log')).read()
    L=s['lafDetail']; m=L['marks']; gone=m['inProgressGone']; fr=L['frames']
    c=s['completion']; raf=[x for x in c['scripts'] if x['invoker']=='FrameRequestCallback']
    win=re.search(r'REPORT long animation frames, Enter to 5 s after stream complete \(([\d.]+) ms\): LoAF (\d+), total [\d.]+ ms, blocking ([\d.]+) ms, longest ([\d.]+) ms; longtask \d+, total [\d.]+ ms, blocking ([\d.]+) ms',log)
    end=float(win.group(1))
    after=[f for f in fr if f['s']>=gone]
    post1=[f for f in fr if f['s']>=gone+1000 and f['s']<=end]
    butter=[f for f in fr if any('butter' in (x.get('src') or '') or 'offscreen' in (x.get('src') or '') for x in f['scripts'])]
    idle=[f for f in fr if any('Idle' in (x.get('invoker') or '') for x in f['scripts'])]
    row=dict(run=s['label'],build=s['build'] if isinstance(s['build'],str) else s['build'].get('version') if isinstance(s['build'],dict) else None,
      completion=c['d'],completion_b=c['b'],completion_s=c['s'],gone=gone,
      raf=[(x['d'],x['forced']) for x in raf],
      loaf_n=int(win.group(2)),blocking=float(win.group(3)),longest=float(win.group(4)),longtask_b=float(win.group(5)),
      ge1s=sum(1 for f in fr if f['d']>=1000),
      after_gone=dict(n=len(after),b=round(sum(f['b'] for f in after),1),longest=max([f['d'] for f in after],default=0)),
      gone1s_to_end=dict(n=len(post1),b=round(sum(f['b'] for f in post1),1),frames=[(round(f['s']-gone),f['d'],f['b'],[(x['invoker'],x['src'],x['d']) for x in f['scripts']]) for f in post1]),
      butter_frames=[(round(f['s']-gone),f['d'],[(x['invoker'],x['src'],x['d']) for x in f['scripts']]) for f in butter],
      idle_frames=[(round(f['s']-gone),f['d'],[(x['invoker'],x['src'],x['d']) for x in f['scripts']]) for f in idle],
      pass_=len(re.findall(r'^PASS ',log,re.M)),fail=re.findall(r'^FAIL .*',log,re.M),
      butterfiles=(re.search(r'^REPORT laf butter files: (.*)$',log,re.M) or [None,None])[1],
      veil_eff=(re.search(r'^REPORT veil-effective: (.*)$',log,re.M) or [None,None])[1],
      geo=s.get('answerGeo',{}).get('scrollHeight'), after_line=(re.search(r'^REPORT after completion: (.*)$',log,re.M) or [None,None])[1])
    print(json.dumps(row))
