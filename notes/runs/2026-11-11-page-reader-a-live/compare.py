import json,pathlib
root=pathlib.Path(__file__).parent/'data'
for mode in ['matrix','wash']:
 a,b=[json.loads((root/f'bookmarks-{mode}-{x}'/'summary.json').read_text()) for x in ['main','pr']]
 checks=lambda d:[(x['name'],x['pass']) for x in d['checks']]
 print(mode, 'ordered checks identical:',checks(a)==checks(b),'cleanup identical:',a['cleanup']==b['cleanup'])
 for i in range(max(len(a['checks']),len(b['checks']))):
  x=a['checks'][i] if i<len(a['checks']) else None;y=b['checks'][i] if i<len(b['checks']) else None
  if (x and (x['name'],x['pass']))!=(y and (y['name'],y['pass'])):print('DIFFERENCE',i,x,y)
a,b=[json.loads((root/f'branch-live-{x}.json').read_text()) for x in ['main','pr']]
pills=lambda d:[(r['width'],r['button']) for r in d['runs']]
print('branch pill measurements identical:',pills(a)==pills(b))
