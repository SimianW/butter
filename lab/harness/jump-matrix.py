"""Serial browser experiments. Requires private CHAT env; never prints it."""
from pathlib import Path
import os,subprocess,time,json
root=Path(__file__).resolve().parents[2];out=root/'lab/harness/scratch/jump-typing';cwd=root/'lab/harness'
modes=['current','stock','page2','page3','page5','initial100','blocks-only']
commands=[]
for mode in modes:
 ext='' if mode=='stock' else str(root/'extension') if mode=='current' else str(root/'lab/variants'/('jump-'+mode))
 if mode not in ('stock','current','blocks-only'):ext=str(root/'lab/variants'/('jump-'+('page'+mode[4:] if mode.startswith('page') else mode)))
 env={**os.environ,'EXT':ext};cmd=['node','jump-typing.mjs',mode,'3'];shown=f'CHAT="$CHAT" EXT={ext!r} '+ ' '.join(cmd)
 print('START',shown,flush=True);t=time.time()
 with (out/(mode+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 entry={'command':shown,'exit':r.returncode,'seconds':round(time.time()-t,1),'output':str(out/(mode+'.log'))};commands.append(entry);print('END',json.dumps(entry),flush=True)
 (out/'matrix-commands.json').write_text(json.dumps(commands,indent=2))
for mode,ext in [('current',str(root/'extension')),('initial100',str(root/'lab/variants/jump-initial100'))]:
 env={**os.environ,'EXT':ext};cmd=['node','jump-open.mjs',mode,'3'];shown=f'CHAT="$CHAT" EXT={ext!r} '+' '.join(cmd);print('START',shown,flush=True);t=time.time()
 with (out/(mode+'-open.log')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 commands.append({'command':shown,'exit':r.returncode,'seconds':round(time.time()-t,1),'output':str(out/(mode+'-open.log'))});print('END',json.dumps(commands[-1]),flush=True);(out/'matrix-commands.json').write_text(json.dumps(commands,indent=2))
