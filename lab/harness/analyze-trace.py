# Summarize a Chrome trace: main-thread time by category, forced style/layout stacks, top JS functions (self time from samples).
import json, sys, collections
d = json.load(open(sys.argv[1])); ev = d['traceEvents'] if isinstance(d, dict) else d
ult = [e for e in ev if e['name'] == 'UpdateLayoutTree' and e.get('ph') == 'X']
pid, tid = collections.Counter((e['pid'], e['tid']) for e in ult).most_common(1)[0][0]
main = sorted([e for e in ev if e['pid'] == pid and e['tid'] == tid and e.get('ph') == 'X'], key=lambda e: (e['ts'], -e.get('dur', 0)))
span = (max(e['ts'] + e['dur'] for e in main) - main[0]['ts']) / 1e6
tasks = [e for e in main if e['name'] == 'RunTask']
print(f'span {span:.1f}s  busy {sum(e["dur"] for e in tasks)/1e6:.1f}s')
# exclusive time per event name
stack, excl = [], collections.Counter()
for e in main:
    while stack and stack[-1]['ts'] + stack[-1]['dur'] <= e['ts']: stack.pop()
    if stack: excl[stack[-1]['name']] -= e['dur']
    excl[e['name']] += e['dur']; stack.append(e)
print('exclusive ms:', [(k, round(v / 1000)) for k, v in excl.most_common(12)])
def key(e):
    st = (e.get('args', {}).get('beginData', {}) or {}).get('stackTrace') or []
    return ' <- '.join(f"{f.get('functionName') or '?'}@{f.get('url','').split('/')[-1]}:{f.get('lineNumber')}:{f.get('columnNumber')}" for f in st[:4]) or '(no stack: frame/rAF)'
for name in ('UpdateLayoutTree', 'Layout'):
    agg, cnt, el = collections.Counter(), collections.Counter(), collections.Counter()
    for e in main:
        if e['name'] == name: k = key(e); agg[k] += e['dur']; cnt[k] += 1; el[k] += (e.get('args', {}).get('elementCount') or 0)
    print(f'\n{name}: total {sum(agg.values())/1000:.0f}ms')
    for k, v in agg.most_common(6): print(f'  {v/1000:7.0f}ms x{cnt[k]:4d} elems/call {el[k]//max(1,cnt[k]):6d} | {k}')
# JS self time from cpu profile samples
nodes, samples, deltas = {}, [], []
for e in ev:
    if e['name'] == 'ProfileChunk' and e['pid'] == pid:
        c = e['args']['data'].get('cpuProfile', {})
        for n in c.get('nodes', []): nodes[n['id']] = n
        samples += c.get('samples', []); deltas += e['args']['data'].get('timeDeltas', [])
self_t = collections.Counter()
for sid, dt in zip(samples, deltas):
    n = nodes.get(sid); 
    if not n: continue
    cf = n['callFrame']; self_t[f"{cf.get('functionName') or '(anon)'}@{cf.get('url','').split('/')[-1]}:{cf.get('lineNumber')}:{cf.get('columnNumber')}"] += dt
print(f'\nJS samples self time (top):')
for k, v in self_t.most_common(15): print(f'  {v/1000:7.0f}ms {k}')
