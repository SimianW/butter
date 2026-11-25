# trace-find.py <run.json>... : per window.find call (u4, U4_FINDS), the main thread's work inside the
# call, from <run>.trace.json (TRACE_AT/TRACE_SPAN/TRACE_CATS as in u2-trace). One JSON line per call.
# The call's window is [at, at + callMs] on the page clock (stream-ux-probe.mjs records `at`), placed in
# the trace by the `lab-trace-start` mark and the page time the harness read at that mark.
# Prints counts, ms, tag/class names and script file names only (no text, no URLs).
import json, sys, collections, re

ms = lambda x: round(x / 1000, 1)

def one(run):
    s = json.load(open(run)); u = s['ux']['u4']; ps = s['trace']['pageStart']
    d = json.load(open(run.replace('.json', '.trace.json')))['traceEvents']
    pid, tid = collections.Counter((e['pid'], e['tid']) for e in d if e.get('name') == 'UpdateLayoutTree').most_common(1)[0][0]
    mark = [e for e in d if e.get('name') == 'lab-trace-start'][0]['ts']
    M = [e for e in d if e['pid'] == pid and e['tid'] == tid]
    X = [e for e in M if e.get('ph') == 'X' and 'dur' in e]
    # CPU profile samples on the renderer's main thread
    nodes, prof, starts = {}, [], {e['id']: e['args']['data']['startTime'] for e in d if e.get('name') == 'Profile' and e['pid'] == pid}
    for e in d:
        if e.get('name') == 'ProfileChunk' and e['pid'] == pid and e['id'] in starts:
            cp = e['args']['data'].get('cpuProfile', {})
            for n in cp.get('nodes', []): nodes[n['id']] = n['callFrame']
            base = starts[e['id']]
            for n, dt in zip(cp.get('samples', []), e['args']['data'].get('timeDeltas', [])):
                base += dt; prof.append((base, n))
            starts[e['id']] = base
    def cf(n):
        c = nodes.get(n, {}); url = re.sub(r'https?://[^/]+', '', c.get('url', '')); url = re.sub(r'chrome-extension://[a-z]+', 'ext:', url)
        return f"{c.get('functionName') or '(anon)'} {url.split('/')[-1]}".strip()
    calls = [dict(u['find'], k=0)] + list(u.get('finds') or [])
    name = run.split('/')[-1].replace('.json', '')
    for c in calls:
        if c.get('none'): continue
        W = mark + (c['at'] - ps) * 1000; E = W + c['callMs'] * 1000
        inX = [e for e in X if W - 500 <= e['ts'] and e['ts'] + e['dur'] <= E + 500]
        inI = [e for e in M if W <= e.get('ts', 0) <= E]
        top = lambda nm: [e for e in inX if e['name'] == nm and not any(p is not e and p['name'] == nm and p['ts'] <= e['ts'] and e['ts'] + e['dur'] <= p['ts'] + p['dur'] for p in inX)]
        st = top('UpdateLayoutTree'); la = top('Layout')
        el = lambda e: e['args'].get('elementCount') or e['args'].get('data', {}).get('elementCount')
        lo = lambda e: f"{e['args'].get('beginData', {}).get('dirtyObjects')}/{e['args'].get('beginData', {}).get('totalObjects')}"
        reasons = lambda nm: dict(collections.Counter(e['args'].get('data', {}).get('reason') for e in inI if e.get('name') == nm).most_common(8))
        added = [e for e in inI if e.get('name') == 'LayoutInvalidationTracking' and e['args'].get('data', {}).get('reason') == 'Added to layout']
        addedTags = collections.Counter(re.sub(r'#.*', '', (e['args']['data'].get('nodeName') or '?')).split(' ')[0] for e in added)
        fonts = [(ms(e['ts'] - W), e['name']) for e in d if e.get('name') in ('BeginRemoteFontLoad', 'RemoteFontLoaded') and W <= e['ts'] <= E + 300000]
        fontReq = [(ms(e['ts'] - W), e['args']['data'].get('priority'), e['args']['data'].get('mimeType'), e['args']['data'].get('fromCache'))
                   for e in d if e.get('name') in ('ResourceSendRequest', 'ResourceReceiveResponse') and W - 1000 <= e['ts'] <= E + 300000
                   and ('font' in str(e['args'].get('data', {}).get('mimeType', '')) or '.woff' in str(e['args'].get('data', {}).get('url', '')))]
        # everything top-level >= 5 ms inside the call that is not a style or layout pass
        big = collections.Counter(); bigMs = collections.Counter()
        for e in inX:
            if e['dur'] >= 5000 and e['name'] not in ('UpdateLayoutTree', 'Layout', 'RunTask', 'FunctionCall', 'v8.callFunction', 'EvaluateScript', 'v8.run', 'V8.Execute', 'ThreadControllerImpl::RunTask', 'RunMicrotasks', 'v8.evaluateModule', 'TimerFire', 'FireAnimationFrame', 'FunctionCall'):
                big[e['name']] += 1; bigMs[e['name']] += e['dur']
        samp = collections.Counter(cf(n) for t, n in prof if W <= t <= E)
        row = {
            'run': name, 'call': c.get('k', 0), 'block': c['block'], 'flags': c['flagsBefore'], 'callMs': c['callMs'],
            'style': [(el(e), ms(e['dur'])) for e in st if e['dur'] >= 200], 'styleMs': ms(sum(e['dur'] for e in st)),
            'layout': [(lo(e), ms(e['dur'])) for e in la if e['dur'] >= 200], 'layoutMs': ms(sum(e['dur'] for e in la)),
            'resolveStyle': sum(1 for e in inI if e.get('name') == 'StyleResolver::ResolveStyle'),
            'addedToLayout': len(added), 'addedTags': dict(addedTags.most_common(8)),
            'styleInvalidations': reasons('StyleRecalcInvalidationTracking'), 'layoutInvalidations': reasons('LayoutInvalidationTracking'),
            'fontLoads': fonts, 'fontRequests': fontReq,
            'over5ms': {k: (big[k], ms(bigMs[k])) for k in big},
            'cpuTop': [f'{a} x{b}' for a, b in samp.most_common(6)], 'cpuSamples': sum(samp.values()),
        }
        print(json.dumps(row))

for r in sys.argv[1:]: one(r)
