import json
from pathlib import Path
root = Path(__file__).parent / 'data'
comparison = {}
for mode in ['matrix', 'wash']:
    main, pr = [json.loads((root / f'bookmarks-{mode}-{build}' / 'summary.json').read_text()) for build in ['main-rerun', 'pr']]
    ordered = lambda d: [(c['name'], c['pass']) for c in d['checks']]
    a, b = ordered(main), ordered(pr)
    result = {
        'counts': {name: {'passed': sum(c['pass'] for c in d['checks']), 'total': len(d['checks'])} for name, d in [('mainRerun', main), ('pr', pr)]},
        'orderedChecksIdentical': a == b,
        'cleanupIdentical': main['cleanup'] == pr['cleanup'],
        'differences': [{'index': i + 1, 'mainRerun': a[i] if i < len(a) else None, 'pr': b[i] if i < len(b) else None} for i in range(max(len(a), len(b))) if (a[i] if i < len(a) else None) != (b[i] if i < len(b) else None)],
        'cleanup': {'mainRerun': main['cleanup'], 'pr': pr['cleanup']},
        'drags': {name: [{key: row[key] for key in ['arm', 'repetition', 'held', 'updates', 'mounts', 'frames', 'p95FrameMs', 'maxFrameMs']} for row in d['drags']] for name, d in [('mainRerun', main), ('pr', pr)]},
        'failure': main.get('failure'),
        'skipped': main.get('skipped', []),
    }
    comparison[mode] = result
    print(mode, 'ordered checks identical:', result['orderedChecksIdentical'], 'cleanup identical:', result['cleanupIdentical'])
    print('COUNTS', json.dumps(result['counts']))
    for difference in result['differences']:
        print('DIFFERENCE', json.dumps(difference))
(root / 'rerun-main-comparison.json').write_text(json.dumps(comparison, indent=2) + '\n')
