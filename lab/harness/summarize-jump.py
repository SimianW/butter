"""Create a redacted report from the jump experiment artifacts."""
from pathlib import Path
import json,statistics,collections,html,re
base=Path(__file__).resolve().parent/'scratch/jump-typing'
modes=['stock','current','page2','page3','page5','initial100','blocks-only']
labels={'stock':'Stock + rail driver','current':'Current Turbo','page2':'Older pages 2','page3':'Older pages 3','page5':'Older pages 5','initial100':'Initial page 100','blocks-only':'Answer-block skipping only'}

def read(p):return json.loads(p.read_text())
def quant(v,p):
 v=sorted(v);return v[min(len(v)-1,int(len(v)*p))] if v else None
def fmt(v):return '—' if v is None else f'{v:.1f}'
def stats(v):return [quant(v,.5),quant(v,.95),max(v) if v else None]
def valid(d):return d.get('valid',d.get('processedClick') and d.get('keys')==80 and d.get('clickedIndex')==0)
rows=[];allruns={};correctness={};traces={};opens={};lines=[]
lines += ['# History jump and composer input: lab report','',
'This report contains no chat URL, conversation/message identifiers, titles, or question text. All browser work was serial in the logged-in headed Chromium lab. No message was sent. Test drafts were cleared. `extension/` was not edited; no commit or push was made.','',
'## Method and limits','',
'The final matrix attempted three fresh document navigations per mode and wait time. The corrected current two-second cell has two usable trials and one throttled navigation that never produced a rail; all other primary cells have three typing trials. The wait starts when both the composer and rail are first usable. This definition matters: the composer can precede the rail, and ChatGPT sometimes replaces the page during hydration. Literal composer-ready-plus-two-second physical-click pilots missed a not-yet-usable rail; those attempts are retained separately and excluded, not called fast jumps. The original matrix uses a disposable calibration navigation. The corrected two-second baseline and supplemental matched-target run use direct activation without that extra navigation to reduce throttling. The fixed-clock driver activates the oldest rail tick with `.click()` through the production click handler; it does not wait for renderer acknowledgement. A CDP binding fires at click capture, before the production handler executes. At 300 ms after that actual click timestamp, Node sends 80 ASCII keydowns/ups at 100 ms intervals, without waiting for acknowledgements. No Enter is ever sent. Any delay between click dispatch and processing is retained in the raw timing.','',
'**Stock comparator:** ChatGPT has no native Turbo rail. The stock baseline injects only the unchanged production rail and response-listener scripts plus a DOM turn-discovery hook. It does not load Turbo CSS, content-visibility marking, or the streaming smoother. This isolates native ChatGPT rendering under the same jump algorithm; it is not untouched stock plus a nonexistent rail.','',
'**Target:** the oldest tick available after opening. Ordinary initial pages expose five questions, so their first tick is question 8 of the 12-question reference. Initial-page-100 exposes the full list and its first tick is question 1. The latter is therefore a different destination and not a matched-target speedup claim. Separate full-list correctness checks visit every tick.','',
'Event Timing records browser-reported keydown input delay, processing duration and event duration. Input delay is $\\mathrm{processingStart}-\\mathrm{startTime}$. Entries below the browser minimum duration of 16 ms are censored; the main table pools reported keydowns across valid runs. A second table uses the capture-handler timestamp for every delivered key (an upper bound close to processing-start delay). Long Animation Frames and long tasks are filtered by start time from click processing through the end of the typing/jump window; an already-running startup frame is not attributed to the jump. Frame counts are totals across runs; longest-frame/task are maxima; jump time is the median with the per-run values retained. Landing requires the target within 4 px of 64 px below the scroller top, visible after the travel overlay, stable for 150 ms. A timeout is a failure, never a zero.','',
'One CDP trace per wait condition per mode is diagnostic; other repetitions are untraced. The current ten-second baseline retains its earlier dispatch-clock run, whose actual first-key timestamps were 296.7–299.1 ms after click; its two-second trials were rerun using the actual-click binding. Trace overhead, warm browser/profile caches, server/network variation, a single conversation and only three runs limit precision. Network cache is disabled, not the browser code cache. Event duration includes processing/presentation and must not be confused with input delay. rAF-based geometry observation can itself request layout; trace stacks distinguish observer reads from ChatGPT reads.','',
'## Jump and typing matrix','',
'| Mode | Wait s | Valid/attempts | Reported keys | Delay p50 ms | p95 ms | max ms | Longest LoAF ms | LoAFs >200 ms | Median successful jump ms (failures) | Older requests/run | Longest task ms |',
'|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---:|']
for mode in modes:
 runs=[read(p) for p in sorted((base/mode).glob('*-T*.json')) if not any(s in p.name for s in ['trace','attribution'])];allruns[mode]=runs
 for T in [2,10]:
  attempts=[d for d in runs if d['T']==T];rs=[d for d in attempts if valid(d)];delays=[e['delay'] for d in rs for e in d['raw']['events'] if e['name']=='keydown' and d['raw']['click']<=e['start']<d['raw']['end']];ss=stats(delays);jumps=[d['jumpMs'] for d in rs if d['jumpMs'] is not None]
  r={'mode':mode,'T':T,'valid':len(rs),'attempts':len(attempts),'n':len(delays),'delay':ss,'frame':max([d['longestFrame'] for d in rs],default=None),'count':sum(d['framesOver200'] for d in rs),'jump':statistics.median(jumps) if jumps else None,'requests':[d['pageRequests'] for d in rs],'task':max([d['longestTask'] for d in rs],default=None),'jumps':jumps};rows.append(r)
  lines.append(f"| {labels[mode]} | {T} | {len(rs)}/{len(attempts)} | {len(delays)} | {' | '.join(fmt(x) for x in ss)} | {fmt(r['frame'])} | {r['count']} | {fmt(r['jump'])} ({len(rs)-len(jumps)}) | {'/'.join(map(str,r['requests']))} | {fmt(r['task'])} |")
lines += ['', '## Every-key delay and run variation','', '| Mode | Wait s | Handler keys | Delay p50/p95/max ms | Event duration p50/p95/max ms | Jump times ms | Max delay in untraced runs ms |', '|---|---:|---:|---|---|---|---:|']
for mode in modes:
 for T in [2,10]:
  rs=[d for d in allruns[mode] if d['T']==T and valid(d)];ks=[k['delay'] for d in rs for k in d['raw']['keys']];ev=[e['duration'] for d in rs for e in d['raw']['events'] if e['name']=='keydown' and d['raw']['click']<=e['start']<d['raw']['end']];u=[d['allKeyHandlerDelay']['max'] for d in rs if not d['traced']]
  lines.append(f"| {labels[mode]} | {T} | {len(ks)} | {' / '.join(fmt(x) for x in stats(ks))} | {' / '.join(fmt(x) for x in stats(ev))} | {' / '.join(fmt(d['jumpMs']) for d in rs)} | {fmt(max(u) if u else None)} |")
lines += ['', '## Input clock checks','', '| Mode | Actual click-to-first-key timestamp range ms | Scheduled wait error range ms | Click dispatch-to-handler range ms |', '|---|---:|---:|---:|']
for mode in modes:
 rs=[d for d in allruns[mode] if valid(d)];offsets=[d['raw']['keys'][0]['start']-d['raw']['click'] for d in rs if d['raw']['keys']];waits=[d['waitActualMs']-d['T']*1000 for d in rs];dispatch=[d.get('clickDispatchDelayMs') for d in rs if d.get('clickDispatchDelayMs') is not None]
 def rng(a):return f'{min(a):.1f}–{max(a):.1f}' if a else '—'
 lines.append(f"| {labels[mode]} | {rng(offsets)} | {rng(waits)} | {rng(dispatch)} |")
lines += ['', '## Server responses and correctness','',
'The independent reference is a read-only authenticated XHR for an initial page of 100; it bypasses the fetch wrapper and is excluded from the measured page union. It is used only during correctness checks. API identities are hashed only in gitignored raw artifacts. The report prints counts and booleans. Each page is checked for internal duplicate identities; the combined page union is compared to the reference, and rail labels and order are compared in browser memory. Every tick is visited; the last question may land below 64 px because the scroller reaches its maximum. Such a visible bottom-clamped landing is reachable, not a missing turn.','',
'| Mode | Initial decoded bytes / messages / questions | First older decoded bytes / messages / questions | Questions fetched / reference | Older requests for full history | Rail count / ordered match | Missing messages / duplicates inside pages | All pages / all reachable |', '|---|---|---|---|---|---|---|---|']
for mode in modes:
 cp=base/mode/'correctness.json';c=read(cp) if cp.exists() else {};correctness[mode]=c
 if c.get('referenceStatus')!=200:
  lines.append(f"| {labels[mode]} | — | — | Unverified: reference HTTP {c.get('referenceStatus','—')} | — | — | — | Unverified |");continue
 requests=[q for d in allruns[mode] for q in d['requests']];first=lambda kind:next((q for q in requests if q['kind']==kind and q.get('status')==200),{})
 def sz(q):return ' / '.join(str(q.get(k,'—')) for k in ['decodedBytes','messages','questions'])
 lines.append(f"| {labels[mode]} | {sz(first('initial'))} | {sz(first('older'))} | {c.get('uniqueFetchedQuestions','—')} / {c.get('referenceQuestions','—')} | {len([q for q in c.get('requests',[]) if q['kind']=='older'])} | {c.get('railCount','—')} / {c.get('railOrderMatches','—')} | {c.get('missingMessages','—')} / {c.get('duplicateMessagesWithinPages','—')} | {c.get('allPagesLoaded','—')} / {c.get('allReachable','—')} |")
lines += ['', '## Chat-open cost','',
'Open cost is measured separately without clicking or typing, three fresh navigations each. All final opening samples had a successful first initial-page response. All three current samples and two whole-chat samples had a throttled duplicate initial refetch; one whole-chat sample had two successful initial responses. These are not a fully clean unthrottled opening comparison. Idle means at least ten seconds after document startup, no pending conversation request, no unrendered math sources, and no long task for 1.5 seconds. The trace begins before navigation; renderer main-thread busy time is the union of top-level RunTask intervals, including short tasks. It is not just the sum of tasks over 50 ms. The reporting window begins at the renderer navigation-start mark when present (otherwise the new document’s startup mark); browser-process navigation work and network wait are excluded from main-thread busy time.','',
'| Mode | Run | Mounted / rail | HTTP statuses | Ready ms | Navigation-to-idle ms | Longest task ms | Main-thread busy ms | Long-task busy ms |', '|---|---:|---|---|---:|---:|---:|---:|---:|']
for mode in ['current','initial100']:
 opens[mode]=[]
 for p in sorted((base/mode).glob('open-[123].json')):
  d=read(p);a=p.with_name(p.stem+'-attribution.json');at=read(a) if a.exists() else {};d['mainBusyMs']=at.get('mainBusyMs');opens[mode].append(d)
  lines.append(f"| {labels[mode]} | {d['rep']} | {d.get('mounted','—')} / {d.get('railQuestions','—')} | {'/'.join(str(r.get('status','—')) for r in d['requests'])} | {fmt(d['readyMs'])} | {fmt(d['idleMs'])} | {fmt(d['longestTask'])} | {fmt(d['mainBusyMs'])} | {fmt(d['longTaskBusyMs'])} |")
lines += ['', '## Largest long animation frames','', '| Mode | Wait s | Duration ms | Blocking ms | Style/layout starts after frame start ms | Top scripts: function, duration, forced style/layout ms |', '|---|---:|---:|---:|---:|---|']
for mode in modes:
 for T in [2,10]:
  fs=[f for d in allruns[mode] if d['T']==T and valid(d) for f in d['raw']['loafs'] if d['raw']['click']<=f['start']<d['raw']['end']]
  if not fs:continue
  f=max(fs,key=lambda f:f['duration']);scripts=[]
  for x in sorted(f['scripts'],key=lambda x:x['duration'],reverse=True)[:3]:
   scripts.append(f"`{x['sourceFunctionName'] or '(anonymous)'}@{x['sourceURL'].split('/')[-1]}` ({x['invoker']}); {x['duration']:.1f} / {x['forcedStyleAndLayoutDuration']:.1f}")
  style=f['styleAndLayoutStart']-f['start'] if f['styleAndLayoutStart'] else None
  lines.append(f"| {labels[mode]} | {T} | {f['duration']:.1f} | {f['blockingDuration']:.1f} | {fmt(style)} | {'; '.join(scripts)} |")
lines += ['', '## Trace evidence','',
'Timeline layout/style durations and sampled JavaScript attribution overlap: a sample in a DOM geometry getter includes native layout beneath that getter. Do not add them. CPU family buckets are heuristic bundle ancestry, not exclusive proof that all time is JavaScript. React commit attribution is supported by hook/commit ancestry plus the source at the sampled location; math attribution is supported by `renderToString`, parser and builder functions in the KaTeX bundle. GC timeline durations are considered separately.','']
for mode in modes:
 ats=[]
 for p in sorted((base/mode).glob('*-T*-attribution.json')):
  a=read(p);data=p.with_name(p.name.replace('-attribution.json','.json'));run=read(data) if data.exists() else {}
  if valid(run):ats.append(a)
 traces[mode]=ats
 for a in ats:
  big=a['bigTasks'][0] if a.get('bigTasks') else {};tl=big.get('timeline',{});lines += [f"### {labels[mode]} — {a['file']}", '',f"Trace window {fmt(a['spanMs'])} ms; renderer busy {fmt(a['mainBusyMs'])} ms. Biggest task {fmt(big.get('durationMs'))} ms at {fmt(big.get('startMs'))} ms relative to click. Within it: layout {fmt(tl.get('Layout'))} ms; style {fmt(tl.get('UpdateLayoutTree'))} ms; minor GC {fmt(tl.get('MinorGC'))} ms; major GC {fmt(tl.get('MajorGC'))} ms.",'']
  for n in big.get('self',[])[:5]:lines.append(f"- Sample self {n['ms']:.1f} ms: `{n['function']}`.")
  for lay in sorted(big.get('layouts',[]),key=lambda x:x['ms'],reverse=True)[:3]:lines.append(f"- `{lay['name']}` {lay['ms']:.1f} ms; stack: "+' ← '.join('`'+x+'`' for x in lay['stack'][:5])+'.')
  lines += ['', 'Sample ancestry bucket totals (not additional timeline time): '+', '.join(f'{k} {v:.1f} ms' for k,v in a.get('sampleFamiliesMs',{}).items())+'.', '']
  if a.get('mathEvidence'):lines.append('KaTeX evidence: '+', '.join(f"`{x['function']}` {x['ms']:.1f} ms inclusive" for x in a['mathEvidence'][:5])+'.')
  if a.get('markdownEvidence'):lines.append('Markdown evidence: '+', '.join(f"`{x['function']}` {x['ms']:.1f} ms inclusive" for x in a['markdownEvidence'][:3])+'.')
  lines.append('')
matched=[]
for p in sorted((base/'initial100-matched').glob('*-T10.json')):matched.append(read(p))
if matched:
 rs=[d for d in matched if valid(d)];ds=[e['delay'] for d in rs for e in d['raw']['events'] if e['name']=='keydown' and d['raw']['click']<=e['start']<d['raw']['end']]
 control=[d for d in allruns['current'] if d['T']==10 and valid(d)];sameTarget=bool(rs and control) and len({d['targetHash'] for d in rs+control})==1
 lines += ['## Matched-destination whole-chat control','',f'The whole-chat variant also jumps to tick 8, the same question as the ordinary initial page’s oldest tick. Hashed target equality across both modes: {sameTarget}. This supplemental condition is one diagnostic run after the ten-second wait, limited to avoid further throttling.','', '| Runs | Key delay p50/p95/max ms | Longest frame ms | Jump times ms | Older requests/run |', '|---:|---|---:|---|---|',f"| {len(rs)} | {' / '.join(fmt(x) for x in stats(ds))} | {fmt(max([d['longestFrame'] for d in rs],default=None))} | {' / '.join(fmt(d['jumpMs']) for d in rs)} | {'/'.join(str(d['pageRequests']) for d in rs)} |",'']
lines += ['## Correctness details and errors','']
for mode in modes:
 c=correctness[mode];runs=allruns[mode];errs=collections.Counter(e for d in runs for e in d.get('errors',[]));fails=[{'rep':d['rep'],'T':d['T'],'click':d['processedClick'],'keys':d['keys'],'jumpMs':d['jumpMs']} for d in runs if not valid(d) or d['jumpMs'] is None];bad=[r for r in c.get('reach',[]) if not r['pass']]
 lines += [f"- {labels[mode]}: {len(runs)} attempts; errors {dict(errs)}; invalid/timed-out trials {fails}; failed reachability destinations {bad}; HTTP failures {[(d['rep'],d['T'],r['kind'],r['status']) for d in runs for r in d['requests'] if r.get('status',200)!=200]}; missing questions {c.get('missing','—')}; unexpected questions {c.get('unexpected','—')}; message order match {c.get('messageOrderMatches','—')}."]
lines += ['', 'React hydration error #418 is recorded rather than silently dropped. If it occurs in both control and variants, it cannot establish a variant regression; the data do not justify a literal “no page errors” claim. HTTP statuses and response sizes remain in each mode log. Pagination correctness here covers this conversation’s current branch, not edits, other branches, streaming, multimodal replies or future backend changes.','', '## Variants and diffs','']
for mode in ['page2','page3','page5','initial100','blocks-only']:
 name='jump-'+mode;f=base/(name+'.diff');lines += [f'### {name}', '',f'Command: `diff -ruN extension lab/variants/{name}` (exit 1 means differences).', '', '```diff',f.read_text() if f.exists() else '(missing)','```','']
lines += ['## Recommendation','', '(Final findings are appended after the completed measurements are reviewed.)','', '## Commands and actual output','', 'Measurement commands were run from `lab/harness/` with the private target supplied only through `CHAT`. `$CHAT` below is an environment variable placeholder, not a recorded URL. Full actual JSON stdout/stderr is retained in the adjacent gitignored logs.','']
cmds=read(base/'matrix-commands.json') if (base/'matrix-commands.json').exists() else []
if (base/'finish-commands.json').exists():cmds+=read(base/'finish-commands.json')
for c in cmds:
 lines += [f"- `{c['command']}` → exit {c['exit']}"+(f" in {c['seconds']} s" if isinstance(c.get('seconds'),(int,float)) else '')+f"; output: [{Path(c['output']).name}]({c['output']})."]
lines += ['', 'Validation commands and concise actual outputs:', '', '```text', 'node --check jump-typing.mjs → exit 0, no output', 'node --check jump-open.mjs → exit 0, no output', 'python3 -m py_compile jump-trace.py jump-matrix.py summarize-jump.py → exit 0, no output', 'python3 jump-variants.py → jump-page2/page3/page5/initial100: diff exit 1; 24 lines each', 'diff -ruN extension lab/variants/jump-blocks-only → exit 1; 12 lines', '```', '']
# Append exact compact measurement stdout, already privacy safe (no titles/questions/identifiers).
lines += ['The next section reproduces the actual emitted measurement JSON (request hash arrays and raw traces were never printed).','']
for mode in modes+['initial100-matched']:
 p=base/(mode+'.log')
 if p.exists():lines += [f'### {mode}.log', '', '```jsonl', p.read_text().strip(), '```','']
for mode in ['current','initial100']:
 p=base/(mode+'-open.log')
 if p.exists():lines += [f'### {mode}-open.log','','```jsonl',p.read_text().strip(),'```','']
report='\n'.join(lines);report=re.sub(r'"targetHash":"[^"]+",?', '', report);report=re.sub(r'[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}','[REDACTED]',report,flags=re.I)
(base/'report.md').write_text(report)
(base/'summary.json').write_text(json.dumps({'rows':rows,'correctness':{m:{k:v for k,v in c.items() if k not in ('referenceQuestionHashes','requests')} for m,c in correctness.items()},'opens':{m:[{k:v for k,v in d.items() if k!='raw'} for d in ds] for m,ds in opens.items()}},indent=2))
print('\n'.join(lines[:lines.index('## Server responses and correctness')]))
print('Report:',base/'report.md')
