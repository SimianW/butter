from pathlib import Path
import json
b=Path(__file__).resolve().parent/'scratch/jump-typing';p=b/'report.md';s=p.read_text()
findings='''## Findings

**Two-turn older pages are the strongest demonstrated partial mitigation.** After the ten-second wait, pooled Event Timing input-delay p95 is 1287.5 ms versus 2948.8 ms for current Turbo, and the worst key is 1821.0 ms versus 3704.4 ms. Median successful jump time falls from 6045.1 to 4006.9 ms. The first older response falls from 145714 to 27708 decoded bytes. That still leaves conspicuous input freezes; this is not a complete responsiveness fix.

**The largest tasks are dominated by forced layout during React commit, not KaTeX parsing or GC.** The stock ten-second trace’s largest task takes 4827.4 ms, including 3931.1 ms of layout and 141.3 ms of style. The two-turn ten-second trace’s largest task is 1854.5 ms, including 1488.5 ms of layout and 77.2 ms of style. Those tasks have only 26.1 ms and 5.8 ms of minor GC respectively. Across the complete jump windows, KaTeX `renderToString` and parser/build-tree-like functions are present but account for tens to low hundreds of sampled milliseconds, not the multi-second dominant task.

The repeated source is `r@396705.6b0f9c5f16.js:43:527737`, ChatGPT’s collapsible-text measurement ref. Its callback calls the measurement helper with `e.clientWidth`; that helper reads computed style and, when line clamping is enabled, `e.scrollHeight`. React’s `o8` attaches the ref; `sc` and `s_` traverse commit/layout effects in `226913.a6f571e7d4.js`. Virtualizer callbacks `Z@901075.5cc9ea5885.js:1:62737` and `ea@901075.5cc9ea5885.js:1:73790` read bounding rectangles and heights. React DOM property handling `ud@226913.a6f571e7d4.js:2:196202`, including HTML insertion/parsing, is another substantial contributor. The trace’s native layout duration overlaps samples charged to these getters; they must not be added.

Whole-chat loading actually returns all 12 questions/54 messages and eliminates older-page requests, but its oldest-tick jumps still reach 4.32–4.40 seconds of input-delay p95. Its destination is older than the ordinary initial page’s oldest tick, so this is not a matched-target speed comparison. A supplemental same-question test still has 2566.5 ms p95, a 2744.5 ms maximum input delay and a 3853.4 ms frame, despite zero page requests. That one diagnostic run had a throttled duplicate refetch. Avoiding pagination therefore does not remove destination-rendering cost.

The optional block-only experiment retains the same dominant measurement/layout stack and multi-second stalls. Its full correctness could not be established after the server throttled reference and pagination requests; it is not a validated replacement.

'''
s=s.replace('## Method and limits',findings+'## Method and limits',1)
recommendation='''Prefer the two-turn older-page variant as an **experimental, bounded mitigation** if reducing input freezes is the immediate goal. It is the best measured option under the same destination and paging boundary, and it passes the independent 12-question/54-message and full reachability checks. Keep its scope configurable: fetching the entire history takes seven older requests instead of two; three-turn pages need five, and five-turn pages need three. A single measured jump still makes one older request in every paged mode.

Do not claim that any variant makes the composer continuously usable during a heavy jump. Even the best variant has a worst key delayed 1.82 seconds. The three- and five-turn variants trade fewer total requests for larger measured stalls; neither beats the two-turn variant on this workload. The whole-chat policy increases the initial decoded payload from 114696 to 331171 bytes and exposes the complete rail immediately. It does not show an obvious opening CPU penalty in this small virtualized chat: mean measured renderer busy time is 5527.3 ms current versus 5494.7 ms whole-chat. Throttled duplicate refetches and three runs prevent a clean causal performance claim. Larger chats may exceed a page of 100, and these data do not establish a universal whole-chat policy.

Reject the block-only CSS experiment as a fix for this issue: it preserves the expensive forced-layout path, does not produce reliably responsive input, and its full pagination check is unverified because of 429s. It is retained only as an experiment with its exact diff.

Further engineering should target the geometry/commit boundary: batch or defer text-collapse and virtualizer measurements, or investigate a containment boundary that prevents a question-width read from forcing large answer layout. Any such change needs evidence that it preserves virtualizer heights and question placement. The present traces do not support prioritizing composer-only CSS changes or moving KaTeX parsing to a worker as the main solution. No production fix was applied in this test task.'''
s=s.replace('(Final findings are appended after the completed measurements are reviewed.)',recommendation)
notes=(b/'method-notes.md').read_text();s+='\n## Measurement audit\n\n'+notes.replace('# Measurement audit notes\n','')
s+='\n## Artifact locations\n\n'
for label,name in [('Typing harness','jump-typing.mjs'),('Opening harness','jump-open.mjs'),('Trace attribution','jump-trace.py'),('Summary generator','summarize-jump.py')]:s+=f'- [{label}]({(b.parent.parent/name).resolve()})\n'
s+='\nTrace files and raw numeric observer records are in the mode directories alongside this report. Raw traces stay local and may contain private navigation identifiers; the report and owned source files were scanned separately.\n'
p.write_text(s)
print('Final report:',p,'bytes',len(s.encode()))
