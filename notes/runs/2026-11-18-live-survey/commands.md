# Commands and their final output lines

Run from the checkout `t3/fix-scrolling-and-tick-selection` at `edaf178`. `C` is
`~/.local/share/chatgpt-lab/captures/2026-11-18-live-survey`, `S` is `~/snap/chromium/common`.
Home paths are shown as `~`, URLs and ids are removed. Full output is in the `.log` file named
after each run.

## Setup

```text
$ npm ci
found 0 vulnerabilities

$ ~/.local/share/chatgpt-lab/bin/lab-lock status
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}

$ git rev-parse v0.1.0-alpha.21 edaf178
99594fa05c5c56f62763af1ad57efaa48a6fa035
edaf17868c40f06b460a2f3f1862c1533fe5d0a3
```

Builds (for each of `release:v0.1.0-alpha.21` and `head:edaf178`; read-only git only):

```text
$ git archive <ref> | tar -x -C $S/survey-1118-src-<arm>
$ (cd $S/survey-1118-src-<arm> && python3 scripts/package.py --test survey)
~/snap/chromium/common/survey-1118-src-<arm>/dist/butter-0.1.0-alpha.21+survey.1.zip
Note: Chrome version remains 0.1.0.21; remove the previous install before loading this test build.
$ python3 -c "zipfile…extractall" → $S/survey-1118-<arm>/butter          # manifest: 0.1.0.21 0.1.0-alpha.21+survey.1
$ diff -rq $S/survey-1118-src-<arm>/extension $S/survey-1118-<arm>/butter
Only in …/extension: dev
Files …/extension/manifest.json and …/butter/manifest.json differ
$ (cd $S/survey-1118-src-<arm> && python3 scripts/package.py --dev)
~/snap/chromium/common/survey-1118-src-<arm>/dist/butter-0.1.0-alpha.21+dev.1.zip
→ unpacked at $S/survey-1118-<arm>-dev/butter (release: no dev/rail-trace.js; head: has it)
```

Lock:

```text
$ ~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 2 --owner survey-1118 --wait 1800    # 00:51:29 UTC
2
```

## 1. Page structure

```text
$ LAB_ID=2 LAB_OWNER=survey-1118 EXT= FIXTURES=ats12,math9,math12,demo-en12 LABEL=native node lab/harness/survey-page-structure.mjs
REPORT wrote ~/.local/share/chatgpt-lab/captures/2026-11-18-live-survey/structure-native.json
(exit 0)

$ LAB_ID=2 LAB_OWNER=survey-1118 EXT=$S/survey-1118-head/butter FIXTURES=ats12,math12 LABEL=head node lab/harness/survey-page-structure.mjs
REPORT ats12 end scroller {"y":0,"h":40671,"vh":860,"anchor":"auto","children":["T:auto","none"],"turns":3,"cvAuto":3}
REPORT math12 end scroller {"y":0,"h":347074,"vh":912,"anchor":"auto","children":["T:auto","none"],"turns":1,"cvAuto":0}
REPORT wrote ~/.local/share/chatgpt-lab/captures/2026-11-18-live-survey/structure-head.json
(exit 0)
```

Ad-hoc, read-only (scripts in `$C/adhoc/`, not in the repo), on `ats12` with the head build:

```text
$ node $C/adhoc/card4.mjs        # tick 4's card vs the landed bubble: lengths only
[{"top":-10887,"bubbleLen":2,…},{"top":64,"bubbleLen":31,"innerLen":31,"cardLen":341,"cardStartsWithBubble":false,"cardIncludesBubble":false,…,"hasAttachmentish":true,…}]
$ node $C/adhoc/api-parts.mjs    # user messages' content shape: all "text", one string part, 0 attachments
[{"ct":"text","parts":["str:53"],"hidden":false,"attachments":0,"metaKeys":[]}, … {"ct":"text","parts":["str:812"],…}, …]
```

## 2. Wheel scrolling

One chain (`$C/wheel-chain.sh`), each run with `LAB_ID=2 LAB_OWNER=survey-1118 GAP=20000 LABEL=<label> OUT=$C/wheel-<label>.json`:

```text
$ … EXT= LOADS=4 node lab/harness/wheel-jump-live.mjs                                        # native, 00:56–01:00
SUMMARY native: 0/4 loads failed
EXIT 0

$ … EXT=$S/survey-1118-release/butter LOADS=4 node lab/harness/wheel-jump-live.mjs           # release, 01:00–01:04
FAIL load ats12 #1: 9 jumps back, first 5149 → 0 at step 3
FAIL load ats12 #2: 9 jumps back, first 5149 → 700 at step 4
FAIL load ats12 #3: 7 jumps back, first 7843 → 0 at step 10
FAIL load ats12 #4: 6 jumps back, first 8400 → 0 at step 12
SUMMARY release: 4/4 loads failed
EXIT 1

$ … EXT=$S/survey-1118-head/butter LOADS=4 node lab/harness/wheel-jump-live.mjs              # head, 01:04–01:08
FAIL load ats12 #1: 7 jumps back, first 7843 → 0 at step 10
FAIL load ats12 #2: 7 jumps back, first 20751 → 0 at step 14
FAIL load ats12 #3: 8 jumps back, first 18059 → 0 at step 20
FAIL load ats12 #4: 9 jumps back, first 20751 → 700 at step 15
SUMMARY head: 4/4 loads failed
EXIT 1

$ … EXT=$S/survey-1118-head/butter LOADS=3 MODE=arm node lab/harness/wheel-jump-live.mjs     # head-arm, 01:08–01:14
FAIL load ats12 #1: 6 jumps back, first 8400 → 0 at step 12
FAIL load ats12 #2: 6 jumps back, first 8400 → 0 at step 12
FAIL load ats12 #3: 6 jumps back, first 8400 → 0 at step 12
SUMMARY head-arm: 3/3 loads failed
EXIT 1
```

Later (chain 2):

```text
$ LAB_ID=2 LAB_OWNER=survey-1118 EXT=$S/survey-1118-head/butter LABEL=head-math12 FIXTURES=math12 LOADS=1 OUT=$C/wheel-head-math12.json node lab/harness/wheel-jump-live.mjs   # 02:12–02:13
FAIL load math12 #1: 6 jumps back, first 60302 → 0 at step 49
SUMMARY head-math12: 1/1 loads failed
EXIT 1
```

## 4. Tick selection

```text
$ LAB_ID=2 LAB_OWNER=survey-1118 EXT=$S/survey-1118-head/butter LABEL=head-try FIXTURES=ats12 SHOTS=1 node lab/harness/rail-ticks-live.mjs   # trial, 01:14–01:21
REPORT ats12 wheel: 401 steps of 700 px, 344 judged, 56 page jumps back, questions seen 4/12
… all PASS …
SUMMARY head-try: 0 FAILs
EXIT 0

$ LAB_ID=2 LAB_OWNER=survey-1118 EXT=$S/survey-1118-head/butter LABEL=head FIXTURES=ats12,math12 SHOTS=1 node lab/harness/rail-ticks-live.mjs   # 01:21–01:48, script without the stuck cap
FAIL ats12 card-text: tick 4: card text (389 chars) is not question 4's (37 chars)
REPORT math12 wheel: 401 steps of 2894 px, 114 judged, 286 page jumps back, questions seen 11/12
REPORT guard sendAttempts=2 blockedMutations=332
SUMMARY head: 1 FAIL
EXIT 1
```

Chain 2 (`$C/chain2.sh`), each with `LAB_ID=2 LAB_OWNER=survey-1118`:

```text
$ … EXT=$S/survey-1118-release/butter LABEL=release FIXTURES=ats12,math12 SHOTS=1 node lab/harness/rail-ticks-live.mjs   # 01:52–01:57
FAIL ats12 click-lands: 6/12; tick 10: its question's top at unmounted px (want 64±32), scrollTop 0; …
FAIL ats12 card-text: tick 4: card text (389 chars) is not question 4's (37 chars)
FAIL ats12 keys-enter: Enter on tick 6: its question's top at unmounted px, lit [0,1,6]
REPORT guard blocked POST /backend-api/f/conversation/prepare during math12 open
REPORT guard blocked POST /backend-api/f/conversation/prepare during math12 open
FAIL math12 click-lands: 4/12; tick 2: its question's top at unmounted px (want 64±32), scrollTop 0; …
FAIL math12 keys-enter: Enter on tick 6: its question's top at unmounted px, lit [0,6]
REPORT guard sendAttempts=2 blockedMutations=119
SUMMARY release: 5 FAILs
EXIT 1

$ … EXT=$S/survey-1118-head/butter LABEL=head-final FIXTURES=ats12,math12 SHOTS=1 node lab/harness/rail-ticks-live.mjs   # 02:07–02:12
FAIL ats12 card-text: tick 4: card text (389 chars) is not question 4's (37 chars)
REPORT guard blocked POST /backend-api/f/conversation/prepare during math12 open
REPORT guard blocked POST /backend-api/f/conversation/prepare during math12 open
REPORT math12 wheel pass stopped at scrollTop 78138: the chat jumped back after 5 resumes there in a row
REPORT guard sendAttempts=2 blockedMutations=111
SUMMARY head-final: 1 FAIL
EXIT 1
```

The masked screenshot: PIL pixelation (20 px blocks, x 0–960) of
`$C/ticks-release-shots/ats12-click-10-lands.png` → `release-click-tick10-masked.png`.

## 3. Rail jumps

```text
$ … EXT=$S/survey-1118-head-dev/butter LABEL=survey-head OUT=$C/railjump-head.json node lab/harness/rail-jump-live.mjs   # 01:57–02:06
SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,"native":0,"gated":0,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":0,"rawReversal":43,"rawReversalCount":86,"unpinChecks":48,"anchoringLeftOff":0,"pinnedAnchoringOff":44}
EXIT 0

$ … EXT=$S/survey-1118-release-dev/butter LABEL=survey-release OUT=$C/railjump-release.json node lab/harness/rail-jump-live.mjs   # 02:06–02:07
HARNESS ERROR: click produced no dev rail trace; not a measured jump
EXIT 2

$ LAB_ID=2 LAB_OWNER=survey-1118 EXT= LABEL=survey-native OUT=$C/railjump-native.json node lab/harness/rail-jump-live.mjs   # 02:17–02:29
SUMMARY {"jumps":54,"failed":4,"visibleDetour":1,"native":0,"gated":4,"postCompletion":0,"postCompletionEventMoves":0,"afterLanding":1,"rawReversal":7,"rawReversalCount":9,"unpinChecks":0,"anchoringLeftOff":0,"pinnedAnchoringOff":0}
EXIT 1
```

## 5. Other features

```text
$ cp -r $S/survey-1118-head/butter $S/survey-1118-head-sel/
$ LAB_ID=2 LAB_EXTENSIONS=$S/survey-1118-head-sel/butter ~/.local/share/chatgpt-lab/bin/lab restart-browser
chromium: stopped
chromium: started (pid 573645)
$ LAB_ID=2 LAB_OWNER=survey-1118 LAB_EXTENSIONS=$S/survey-1118-head-sel/butter TESTED_HEAD=edaf178 OUT=$C/selection node lab/harness/bookmark-selection-live.mjs   # 02:14
{"name":"pill beside real Ask ChatGPT","pass":true,"gap":4,"topDelta":0,"radiusMatches":true,"backgroundMatches":true,"shadowMatches":true}
{"name":"Bookmark cell saves and shows top-right card","pass":true,"stored":1,"top":64,"right":84}
{"name":"Undo saved card deletes bookmark","pass":true,"stored":0}
{"name":"rail x removes and shows removed card","pass":true,"stored":0}
{"name":"Undo removed card restores bookmark","pass":true,"stored":1}
{"name":"pill absent for user question","pass":true,"characters":13,"inUserQuestion":true,"nativeAskVisible":true}
{"name":"no Butter page errors","pass":true,"butter":0,"other":0}
(exit 0)

$ node $C/adhoc/seek-drag.mjs      # first version: pressed at the chat's end, on the down arrow
{"geo":{…"y":66130,"h":67042,"vh":912,…,"gutter":"stable both-edges","sw":"thin",…},"before":{…"host":false…},"held":[8 × {"y":66130,"host":false,…}],…}
$ node $C/adhoc/seek-drag.mjs      # at 55%, arrow-aware thumb; then with post-release sampling (seek-drag-head-2.log)
held: {"y":32363,"host":true,"visible":true,"layerKids":26,"mounted":1} … {"y":28397,…,"layerKids":24,"mounted":1}
after: {"h":118046,"y":47953,"visible":true,…} … {"h":118174,"y":48081,"visible":false,"layerKids":0,"mounted":2}
```

## Clean-up

```text
$ ~/.local/share/chatgpt-lab/bin/lab-restore --lab 2 --owner survey-1118          # 02:29:17
restored {"lab":2,"restarted":false,"url":"<home-url>…
(exit 0)
$ ~/.local/share/chatgpt-lab/bin/lab-lock release --lab 2 --owner survey-1118
{"lab": 2, "lab_released": true, "perf_released": false}
(exit 0)
$ ~/.local/share/chatgpt-lab/bin/lab-lock status                                 # 02:29:22
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```
