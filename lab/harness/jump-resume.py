"""Resume remaining measurements after the server-throttle cooldown."""
from pathlib import Path
import subprocess,os,time,json,shutil
root=Path(__file__).resolve().parents[2];cwd=root/'lab/harness';base=cwd/'scratch/jump-typing';commands=json.loads((base/'matrix-commands.json').read_text())
pilot=base/'open-pilot';pilot.mkdir(exist_ok=True)
for p in (base/'current').glob('open-*'):shutil.move(str(p),pilot/p.name)
if (base/'current-open.log').exists():shutil.move(str(base/'current-open.log'),pilot/'current-open.log')
for mode,script,ext,extra in [('blocks-only','jump-typing.mjs',root/'lab/variants/jump-blocks-only',{'TS':'10','START_REP':'3'}),('current','jump-open.mjs',root/'extension',{}),('initial100','jump-open.mjs',root/'lab/variants/jump-initial100',{})]:
 env={**os.environ,'EXT':str(ext),**extra};cmd=['node',script,mode,'3'];shown='CHAT="$CHAT" EXT='+repr(str(ext))+' '+' '.join(k+'='+v for k,v in extra.items())+' '+' '.join(cmd);print('START',shown,flush=True);start=time.time();log=base/(mode+('-open' if script=='jump-open.mjs' else '')+'.log')
 with log.open('a' if mode=='blocks-only' else 'w') as f:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 commands.append({'command':shown,'exit':r.returncode,'seconds':round(time.time()-start,1),'output':str(log)});(base/'matrix-commands.json').write_text(json.dumps(commands,indent=2));print('END',json.dumps(commands[-1]),flush=True)
 if r.returncode:raise SystemExit(r.returncode)
