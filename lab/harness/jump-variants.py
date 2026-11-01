"""Make isolated request-size experiments; never touch the shipping extension."""
from pathlib import Path
import shutil,subprocess
root=Path(__file__).resolve().parents[2]
src=root/'extension'
for name,older,initial in [('jump-page2',2,None),('jump-page3',3,None),('jump-page5',5,None),('jump-initial100',None,100)]:
    dst=root/'lab/variants'/name
    if dst.exists(): raise SystemExit(f'Refusing to overwrite {dst}')
    shutil.copytree(src,dst)
    p=dst/'butter-nav-main.js';s=p.read_text()
    needle='    const res = of.apply(this, arguments);'
    code=f'''    // Lab experiment: rewrite only ChatGPT's existing paginated GET requests.
    try {{
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input?.url ?? '';
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const match = method === 'GET' && PAGE.exec(raw);
      const size = match && (match[2] ? {older or 'null'} : {initial or 'null'});
      if (size) {{
        const url = new URL(raw, location.href);
        url.searchParams.set('num_turns', String(size));
        input = input instanceof Request ? new Request(url.href, input) : url.href;
      }}
    }} catch {{}}
    const res = of.call(this, input, init);'''
    assert needle in s;p.write_text(s.replace(needle,code))
    diff=subprocess.run(['diff','-ruN',str(src),str(dst)],capture_output=True,text=True)
    (root/'lab/harness/scratch/jump-typing'/f'{name}.diff').write_text(diff.stdout)
    print(f'{name}: copied extension; diff exit {diff.returncode}; {len(diff.stdout.splitlines())} lines')
