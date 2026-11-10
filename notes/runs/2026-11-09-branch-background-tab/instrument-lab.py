"""Lab-copy instrumentation only; apply after copying extension/ to a fresh directory."""
from pathlib import Path
import sys
root = Path(sys.argv[1])
p = root / 'branch/run.js'
s = p.read_text()
if 'dataset.backgroundState' not in s:
    s = s.replace('onState(next, info);', 'document.documentElement.dataset.backgroundState = next; onState(next, info);')
    s = s.replace('onState(result.state, result);', 'document.documentElement.dataset.backgroundState = result.state; document.documentElement.dataset.backgroundCause = result.cause || ""; onState(result.state, result);')
p.write_text(s)
p = root / 'branch/content.js'
s = p.read_text()
if 'dataset.bgClaim' not in s:
    s = s.replace('if (!result?.job) return;', 'await domReady(); document.documentElement.dataset.bgClaim = result?.job ? "job" : JSON.stringify(result); if (!result?.job) return;')
    s = s.replace('runBranch(result.job);', 'if (new URL(location.href).searchParams.has("bgstream")) while (!P.adapter().isStreaming()) await clock.sleep(100); runBranch(result.job);')
    s = s.replace('if (incoming) claim(incoming);', 'domReady().then(() => document.documentElement.dataset.bgIncoming = incoming ? "yes" : "no"); if (incoming) claim(incoming);')
    s = s.replace('const runBranch = (job) => {', 'const runBranch = (job) => { document.documentElement.dataset.bgStarted = "yes";')
if 'd.bgSleeps' not in s and 'butter-branch-delay' in s:
    s = s.replace("const result = await send({ type: 'butter-branch-delay', ms });", "const at = performance.now(); const result = await send({ type: 'butter-branch-delay', ms }); const d = document.documentElement?.dataset; if(d) { d.bgSleeps=String(Number(d.bgSleeps||0)+1); d.bgLastSleep=String(Math.round(performance.now()-at)); }")
if 'd.bgSleeps' not in s:
    s = s.replace('sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),', 'sleep: (ms) => new Promise((resolve) => { const at=performance.now(); setTimeout(() => { const d=document.documentElement?.dataset; if(d) { d.bgSleeps=String(Number(d.bgSleeps||0)+1); d.bgLastSleep=String(Math.round(performance.now()-at)); } resolve(); }, ms); }),')
p.write_text(s)
p = root / 'branch/worker.js'
s = p.read_text()
if '__bgDelays' not in s and 'butter-branch-delay' in s:
    s = s.replace('setTimeout(() => respond({ ok: true }), message.ms);', 'const d = (globalThis.__bgDelays ||= {scheduled:0,completed:0}); d.scheduled++; setTimeout(() => { d.completed++; respond({ok:true}); }, message.ms);')
p.write_text(s)
