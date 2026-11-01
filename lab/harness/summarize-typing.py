import json,glob,collections,statistics,pathlib,sys
base=pathlib.Path('scratch/typing')
def q(a,p):
 a=sorted(a);return a[min(len(a)-1,int(len(a)*p))] if a else None
def stat(a):return [len(a),q(a,.5),q(a,.95),max(a) if a else None]
def fmt(x):return '—' if x is None else str(round(x,1))
def table(headers,rows):return '| '+' | '.join(headers)+' |\n|'+'|'.join(['---']*len(headers))+'|\n'+'\n'.join('| '+' | '.join(map(str,r))+' |' for r in rows)+'\n'
groups=collections.defaultdict(list)
for label in (['stock','current','current-clean','variant-v1','variant','short'] if '--all' in sys.argv else ['stock','current-clean','variant','short']):
 for file in sorted((base/label).glob('*.json')):
  if '-analysis' in str(file) or '-trace' in str(file):continue
  r=json.load(open(file));a=file.with_name(file.stem+'-analysis.json');r['analysis']=json.load(open(a)) if a.exists() else None;groups[(label,r['position'])].append(r)
rows=[];erows=[];trows=[];lrows=[]
for (label,pos),rs in groups.items():
 label='current' if label=='current-clean' else label
 keys=[e['duration'] for r in rs for e in r['raw']['events'] if e['name']=='keydown'];ks=stat(keys)
 rows.append([label,pos,len(rs),*map(fmt,ks[1:]),'/'.join(str(r['eventStats']['keydown']['max']) for r in rs),sum(r['longtasks']['count'] for r in rs),fmt(sum(r['longtasks']['total'] for r in rs))])
 for name in ['keydown','keypress','input','beforeinput']:
  arr=[e['duration'] for r in rs for e in r['raw']['events'] if e['name']==name];erows.append([label,pos,name,*map(fmt,stat(arr))])
 for r in rs:
  a=r['analysis'];f=r.get('traceFrames',r['frames']);lrows.append([label,pos,r['rep'],*map(fmt,[f['p50'],f['p95'],f['max']]),r['longtasks']['count'],fmt(r['longtasks']['total']),fmt(r['longtasks']['max'])])
 if all(r['analysis'] for r in rs):
  trows.append([label,pos,*[fmt(statistics.mean(r['analysis']['timeMs'][k] for r in rs)) for k in ['scripting','style','layout','paint']],fmt(statistics.mean(r['analysis']['sampleMs'].get('chatgpt',0) for r in rs)),fmt(statistics.mean(r['analysis']['sampleMs'].get('extension',0) for r in rs))])
s=table(['Mode','Position','Runs','Key p50 ms','Key p95 ms','Key max ms','Max by run ms','Long tasks','Long-task total ms'],rows)
s+='\n'+table(['Mode','Position','Event','Count ≥16ms','p50 ms','p95 ms','max ms'],erows)
s+='\n'+table(['Mode','Position','Mean scripting ms','Mean style ms','Mean layout ms','Mean paint ms','Sample ChatGPT JS ms','Sample extension JS ms'],trows)
s+='\n'+table(['Mode','Position','Run','Frame p50 ms','Frame p95 ms','Frame max ms','Long tasks','LT total ms','LT max ms'],lrows)
pathlib.Path('scratch/typing-tables.md').write_text(s);print(s[:5000])
