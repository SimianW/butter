"""Final baseline rerun with validated click clock, matched-target control, attribution."""
from pathlib import Path
import subprocess,os,json,time,shutil
root=Path(__file__).resolve().parents[2];cwd=root/'lab/harness';base=cwd/'scratch/jump-typing';commands=[]
archive=base/'current-before-click-clock';archive.mkdir(exist_ok=True)
for p in (base/'current').glob('*-T2*.json'):shutil.move(str(p),archive/p.name)
shutil.copy2(base/'current/correctness.json',archive/'correctness.json')

if (base/'current.log').exists():shutil.move(str(base/'current.log'),base/'current-failed-rate-limit.log')
for mode,ext,extra in [('current',root/'extension',{'CHECK':'0','TS':'2','PREWAIT_MS':'60000'}),('initial100-matched',root/'lab/variants/jump-initial100',{'TICK':'7','TS':'10','CHECK':'0','PREWAIT_MS':'60000'})]:
 env={**os.environ,'EXT':str(ext),**extra};cmd=['node','jump-typing.mjs',mode,'3'];shown='CHAT="$CHAT" EXT='+repr(str(ext))+' '+' '.join(k+'='+v for k,v in extra.items())+' '+' '.join(cmd);print('START',shown,flush=True);start=time.time()
 with (base/(mode+'.log')).open('w') as f:r=subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 commands.append({'command':shown,'exit':r.returncode,'seconds':round(time.time()-start,1),'output':str(base/(mode+'.log'))});print('END',json.dumps(commands[-1]),flush=True)
 (base/'finish-commands.json').write_text(json.dumps(commands,indent=2))
 if r.returncode:raise SystemExit(r.returncode)
# Keep the valid T=10 stdout from the earlier baseline alongside the corrected T=2 stdout.
prior=(base/'current-before-click-clock.log').read_text().splitlines()
with (base/'current.log').open('a') as f:
 f.write('\nARCHIVED_T10_BASELINE_OUTPUT (first key timestamp 296.7-299.1 ms after click)\n')
 for line in prior:
  if '"T":10' in line or line.startswith('CORRECTNESS '):f.write(line+'\n')
# Stop browser interactions before CPU-intensive trace analysis.
for mode in ['stock','current','page2','page3','page5','initial100','blocks-only','initial100-matched']:
 traces=[p for p in sorted((base/mode).glob('*-trace.json')) if not p.with_name(p.name.replace('-trace.json','-attribution.json')).exists()]
 if traces:
  with (base/(mode+'-attribution.log')).open('w') as f:r=subprocess.run(['python3','jump-trace.py',*map(str,traces)],cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
  print('ATTRIBUTION',mode,'exit',r.returncode,flush=True)
  if r.returncode:raise SystemExit(r.returncode)
with (base/'summary.log').open('w') as f:r=subprocess.run(['python3','summarize-jump.py'],cwd=cwd,stdout=f,stderr=subprocess.STDOUT)
print('SUMMARY exit',r.returncode,flush=True)
