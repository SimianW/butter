> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter alpha.7 rebase handoff

Completed on `t3/faster-far-jumps`. No push, PR, delegation, or stash operation was performed.

- Final HEAD: `150bf46eb706a27bef189d3a64e6539ed812bea2`.
- Fetched origin/main: `d6f4f4c5c9755bcf44ae89fdf127a5e33c658b16`.
- Backup: `backup/faster-far-jumps-pre-rebase` at `36e3c4105aa93ca63cf8812f0f32682ba1d20701`.
- All 13 original commits retain their exact messages, authors, and author dates. One separate test fix follows them.
- Worktree clean; branch ahead of origin/main by 14 commits.

## Rebase and conflicts

Read AGENTS.md, then fetched origin before changing history. Main's PR #6 brings dfefc34: unit tests, the version checker, CI workflow, and AGENTS/development documentation updates. Main's rename is 2ed1a15; there are no additional feature changes in the PR #6 merge tree.

A temporary Git index mapped each original commit snapshot and the old base from `turbo`/`Turbo`/`TURBO` to `butter`/`Butter`/`BUTTER` in the branch's touched files and paths. This used `git read-tree`, `git cat-file`, `git hash-object`, `git update-index`, `git write-tree`, and `git commit-tree`; messages and author metadata were copied unchanged. The mapping helper is `rewrite.py` next to this report.

Rebased the mapped 13-commit chain onto origin/main. No conflicts occurred. Main's Butter filenames and identifiers, CI workflow, tests, and updated documentation survived; our navigation behavior was retained exactly. Git merged the independent development-documentation and manifest changes cleanly.

The new lab scripts need old alpha baselines whose Git trees still use historical names. Their loaders now discover the historical nav filename from `git ls-tree` and normalize its stem to Butter in the loaded source. The latency harness also normalizes staged filenames and text assets, preserving binary icons. This preserves alpha.5/alpha.6 historical comparisons while preventing broken historical paths or mixed event/selector names. These adapters are part of the replayed first commit.

The separate test commit renames `test/turbo-nav.test.mjs` to `test/butter-nav.test.mjs` and changes four source/event/global/diagnostic references. No test expectations changed. No production bug was exposed by the requested checks. The alpha.7 version sites already satisfy the checker, so no extra version changes were needed.

## New commit list

```console
$ git log --reverse --format='%h %s' origin/main..HEAD
8fb72de History rail: far jumps reveal the question once it has stopped moving instead of after a fixed wait, and keep it aligned through the reveal; takeovers share the first click's deadline and keep finished readiness for the same target; lab scripts for far-jump timing and the takeover deadline
6489eee 0.1.0-alpha.7: far jumps reveal about half a second sooner; a burst of clicks during a jump ends within about 12 seconds
81c101f History rail: a click puts the preview card away until the pointer returns to the rail, so it no longer lingers through the jump; the landing ring is drawn inside the bubble so the turn's paint containment no longer cuts off its edges
9a5f7a7 History rail: light the tick of every question with any part on screen instead of only the one crossing a line 30% down, so a short last question at the bottom of a chat is lit
7edb18a History rail: once a jump lands, light every question on screen again instead of only the clicked one until the next scroll; only while travelling is the clicked tick the only one lit
9e10683 History rail: a question needs more than a 40 px strip on screen to light its tick, so the end of the previous answer above a jumped-to question no longer lights the tick before it; a click on the earlier-dots trip's current target is no longer swallowed
f26fc73 Lab: jump-latency instrumentation matches the current jump code (landedAt between arrive and settle, earlier-trip repeat guard)
9d48f24 History rail: starting a jump always redraws the ticks, so re-clicking the already active tick lights only it during the glide
425a752 History rail: opening a chat lights the ticks of the questions on screen right away; switching chats cleared the lit set without observing the turns already in view again, so no tick lit until a scroll
ad36f7c History rail: opening a chat lights only its latest question until scrolling settles; predict the landing while ChatGPT lays out its history
2ff668e History rail: switching chats again before the previous opening settled left its settle loop running alongside the new one
78ebdc9 History rail: a tick's lit state follows its question, not its slot, so earlier questions loading in at the top no longer slide the lit look from the old latest tick onto the new one; while a chat opens the prediction shows at once
2524c99 History rail: the top of the lit band is EDGE below the header, not below TOP_INSET, so a question showing more than 40 px under the header is lit; lab: jump-latency finds plain /c/ chat URLs, and the edge runner uses the arms jump-latency stages and creates its output directory
150bf46 Tests: use Butter names for the history rail unit tests
[exit 0]
```

## Mutation commands and actual outputs

```console
$ git fetch origin
(no output)
[exit 0]
```

```console
$ git branch backup/faster-far-jumps-pre-rebase 36e3c41
(no output)
[exit 0]
```

```console
$ python3 (not archived)
75a9387 -> c6e0fe2 Changelog: the tick swell fix is part of 0.1.0-alpha.6
8619c4f -> 81af64d History rail: far jumps reveal the question once it has stopped moving instead of after a fixed wait, and keep it aligned through the reveal; takeovers share the first click's deadline and keep finished readiness for the same target; lab scripts for far-jump timing and the takeover deadline
4d79f1e -> 7e1f878 0.1.0-alpha.7: far jumps reveal about half a second sooner; a burst of clicks during a jump ends within about 12 seconds
2c540cc -> 3e17dd3 History rail: a click puts the preview card away until the pointer returns to the rail, so it no longer lingers through the jump; the landing ring is drawn inside the bubble so the turn's paint containment no longer cuts off its edges
26d1f8d -> aca4f30 History rail: light the tick of every question with any part on screen instead of only the one crossing a line 30% down, so a short last question at the bottom of a chat is lit
07f8cc9 -> eb70a80 History rail: once a jump lands, light every question on screen again instead of only the clicked one until the next scroll; only while travelling is the clicked tick the only one lit
a136a8b -> 25b94a6 History rail: a question needs more than a 40 px strip on screen to light its tick, so the end of the previous answer above a jumped-to question no longer lights the tick before it; a click on the earlier-dots trip's current target is no longer swallowed
bf18c02 -> 5da14d6 Lab: jump-latency instrumentation matches the current jump code (landedAt between arrive and settle, earlier-trip repeat guard)
185d21b -> 7ea79a2 History rail: starting a jump always redraws the ticks, so re-clicking the already active tick lights only it during the glide
c83c4b8 -> 10512af History rail: opening a chat lights the ticks of the questions on screen right away; switching chats cleared the lit set without observing the turns already in view again, so no tick lit until a scroll
a7a7ff9 -> e7c60c0 History rail: opening a chat lights only its latest question until scrolling settles; predict the landing while ChatGPT lays out its history
06c8a97 -> ef41cc4 History rail: switching chats again before the previous opening settled left its settle loop running alongside the new one
a480651 -> 8ba4260 History rail: a tick's lit state follows its question, not its slot, so earlier questions loading in at the top no longer slide the lit look from the old latest tick onto the new one; while a chat opens the prediction shows at once
36e3c41 -> abc8356 History rail: the top of the lit band is EDGE below the header, not below TOP_INSET, so a question showing more than 40 px under the header is lit; lab: jump-latency finds plain /c/ chat URLs, and the edge runner uses the arms jump-latency stages and creates its output directory
Mapped base: c6e0fe26e6dd07a3a2d86cea10d4584213f41361
Mapped head: abc8356bb5d960a5823a7b47b3195c74d17dae7f
[exit 0]
```

```console
$ git rebase --onto origin/main c6e0fe26e6dd07a3a2d86cea10d4584213f41361 temp/faster-far-jumps-butter-replay
Rebasing (1/13)
Rebasing (2/13)
Rebasing (3/13)
Rebasing (4/13)
Rebasing (5/13)
Rebasing (6/13)
Rebasing (7/13)
Rebasing (8/13)
Rebasing (9/13)
Rebasing (10/13)
Rebasing (11/13)
Rebasing (12/13)
Rebasing (13/13)
Successfully rebased and updated refs/heads/temp/faster-far-jumps-butter-replay.
[exit 0]
```

```console
$ git switch -C t3/faster-far-jumps
Switched to and reset branch 't3/faster-far-jumps'
Your branch is ahead of 'origin/main' by 13 commits.
  (use "git push" to publish your local commits)
[exit 0]
```

```console
$ git branch -d temp/faster-far-jumps-butter-replay
Deleted branch temp/faster-far-jumps-butter-replay (was 2524c99).
[exit 0]
```

The test file was renamed and its four `turbo` references replaced with `butter` using Python pathlib. That command produced no output.

```console
$ git add test/turbo-nav.test.mjs test/butter-nav.test.mjs
(no output)
[exit 0]
```

```console
$ git commit -m "Tests: use Butter names for the history rail unit tests"
[t3/faster-far-jumps 150bf46] Tests: use Butter names for the history rail unit tests
 1 file changed, 4 insertions(+), 4 deletions(-)
 rename test/{turbo-nav.test.mjs => butter-nav.test.mjs} (97%)
[exit 0]
```

## Requested checks and actual outputs

Before the separate test fix, `node --test` reproduced main's known failure: `raf.test.mjs` passed; the nav test failed with `ENOENT` opening `extension/turbo-nav.js` (exit 1; 1 pass, 1 fail). After the rename, the full output was:

```console
$ node --test
✔ hover wave stays within its targets when the frame timestamp predates kick() (8.048557ms)
✔ hover wave converges monotonically, stays finite across long frames, and stops at rest (8.512328ms)
✔ overlapping older pages deduplicate questions, and an empty final page hides the earlier button (1.289607ms)
✔ wheel invalidates a pending jump before it can settle or pin its old target (2.166496ms)
✔ keyboard invalidates a pending jump before it can settle or pin its old target (1.428644ms)
✔ new click invalidates a pending jump before it can settle or pin its old target (2.272289ms)
raf throttle: all checks passed
✔ test/raf.test.mjs (35.529346ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 463.703982
[exit 0]
```

```console
$ python3 scripts/check-version.py
OK: 0.1.0-alpha.7 / 0.1.0.7; manifest, READMEs, and changelog agree.
[exit 0]
```

Changed JS/MJS paths were selected using `git diff --name-only --diff-filter=ACMR origin/main`; a Python subprocess loop ran `node --check` on each. Each command produced no stdout/stderr and exited 0:

```console
$ node --check extension/butter-nav.js
(no output)
[exit 0]
```

```console
$ node --check lab/harness/jump-latency-edge.mjs
(no output)
[exit 0]
```

```console
$ node --check lab/harness/jump-latency-summary.mjs
(no output)
[exit 0]
```

```console
$ node --check lab/harness/jump-latency.mjs
(no output)
[exit 0]
```

```console
$ node --check lab/harness/nav-takeovers.mjs
(no output)
[exit 0]
```

```console
$ node --check test/butter-nav.test.mjs
(no output)
[exit 0]
```

```console
$ cd lab/harness && node nav-earlier.mjs
{"kind":"growth","run":1,"ms":3256,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":2,"ms":3238,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":3,"ms":3239,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":4,"ms":3237,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"growth","run":5,"ms":3248,"first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"late-growth","first":0,"firstTop":-15836,"latestTop":64,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"anchor-released","first":0,"firstTop":-15336,"latestTop":1064,"growth":true,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"earlier-click","ms":5042,"first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","uncoveredPages":0,"pass":true}
{"kind":"earlier-keyboard","ms":5010,"first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","uncoveredPages":0,"pass":true}
{"kind":"slow-final-page","first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"reduced-motion","first":0,"firstTop":64,"latestTop":14464,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":1,"content":0},{"first":2,"warp":"visible","opacity":1,"content":0},{"first":0,"warp":"visible","opacity":1,"content":0}],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"empty-final-page","first":6,"firstTop":-5400,"latestTop":-1800,"growth":false,"pages":[],"more":false,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"earlier-takeover","first":6,"firstTop":-3536,"latestTop":64,"growth":false,"pages":[],"more":true,"busy":0,"warp":"hidden","content":"1","pass":true}
{"kind":"earlier-cancelled","first":4,"firstTop":-3936,"latestTop":3264,"growth":false,"pages":[{"first":4,"warp":"visible","opacity":0.513804,"content":0.64821}],"more":true,"busy":0,"warp":"hidden","content":"1","pass":true}
errors []
[exit 0]
```

```console
$ python3 - <<'PY'
import json
from pathlib import Path
p=Path('lab/harness/scratch/nav-earlier-after.json')
r=json.loads(p.read_text())
passed=sum(x['pass'] for x in r['results'])
print(f"nav-earlier: {passed}/{len(r['results'])} passed; errors {r['errors']}")
assert passed == len(r['results']) == 14
assert r['errors'] == []
PY
nav-earlier: 14/14 passed; errors []
[exit 0]
```

```console
$ python3 scripts/package.py
~/.t3/worktrees/butter/t3-c2ad6aab/dist/butter-0.1.0-alpha.7.zip
[exit 0]
```

```console
$ python3 - <<'PY'
import json
import zipfile
from pathlib import Path
p=Path('dist/butter-0.1.0-alpha.7.zip')
with zipfile.ZipFile(p) as z:
    names=z.namelist()
    print('\n'.join(names))
    expected={f'butter/{name}' for name in ['butter-nav.js','butter-nav-main.js','butter-main.js','butter-cv.js','butter.css']}
    assert expected.issubset(names)
    assert not any('turbo' in name.lower() for name in names)
    assert z.testzip() is None
    manifest=json.loads(z.read('butter/manifest.json'))
    assert manifest['version_name']=='0.1.0-alpha.7' and manifest['version']=='0.1.0.7'
    print('OK: all five butter-* assets present under butter/; no legacy filenames; ZIP integrity and alpha.7 manifest pass.')
PY
butter/butter-cv.js
butter/butter-main.js
butter/butter-nav-main.js
butter/butter-nav.js
butter/butter.css
butter/config.js
butter/manifest.json
butter/icons/icon-128.png
butter/icons/icon-16.png
butter/icons/icon-32.png
butter/icons/icon-48.png
OK: all five butter-* assets present under butter/; no legacy filenames; ZIP integrity and alpha.7 manifest pass.
[exit 0]
```

The first ad hoc ZIP assertion assumed root-level assets and failed after printing this same listing. The package correctly uses a `butter/` prefix; the corrected inspector above passed without changing the package or source.

```console
$ git diff --stat origin/main
 CHANGELOG.md                                     |  24 +++
 README.md                                        |   2 +-
 README.zh-CN.md                                  |   2 +-
 docs/development.md                              |   2 +
 extension/butter-nav.js                          | 215 ++++++++++++++++------
 extension/butter.css                             |   8 +-
 extension/manifest.json                          |   4 +-
 lab/harness/jump-latency-edge.mjs                |  46 +++++
 lab/harness/jump-latency-summary.mjs             |  70 ++++++++
 lab/harness/jump-latency.mjs                     | 218 +++++++++++++++++++++++
 lab/harness/nav-takeovers.mjs                    | 109 ++++++++++++
 test/{turbo-nav.test.mjs => butter-nav.test.mjs} |   8 +-
 12 files changed, 646 insertions(+), 62 deletions(-)
[exit 0]
```

```console
$ git grep -n -i turbo -- extension test lab/harness/jump-latency*.mjs lab/harness/nav-takeovers.mjs
(no output; grep exit 1 means no matches)
[exit 1]
```

```console
$ git diff --check origin/main
(no output)
[exit 0]
```

## Behavior preservation

Saved the requested comparison to `pre-rebase-comparison.diff` alongside this report using:

```console
$ git diff --find-renames backup/faster-far-jumps-pre-rebase HEAD -- extension test README.md README.zh-CN.md CHANGELOG.md docs/development.md lab/harness/jump-latency*.mjs lab/harness/nav-takeovers.mjs > (not archived)
(no output; diff saved)
[exit 0]
```

```console
$ python3 (not archived)
8619c4f -> 8fb72de: message and author preserved; 11 branch files match the mapped original
4d79f1e -> 6489eee: message and author preserved; 11 branch files match the mapped original
2c540cc -> 81c101f: message and author preserved; 11 branch files match the mapped original
26d1f8d -> 9a5f7a7: message and author preserved; 11 branch files match the mapped original
07f8cc9 -> 7edb18a: message and author preserved; 11 branch files match the mapped original
a136a8b -> 9e10683: message and author preserved; 11 branch files match the mapped original
bf18c02 -> f26fc73: message and author preserved; 11 branch files match the mapped original
185d21b -> 9d48f24: message and author preserved; 11 branch files match the mapped original
c83c4b8 -> 425a752: message and author preserved; 11 branch files match the mapped original
a7a7ff9 -> ad36f7c: message and author preserved; 11 branch files match the mapped original
06c8a97 -> 2ff668e: message and author preserved; 11 branch files match the mapped original
a480651 -> 78ebdc9: message and author preserved; 11 branch files match the mapped original
36e3c41 -> 2524c99: message and author preserved; 11 branch files match the mapped original
OK: every final extension asset is byte-identical to the backup after the name mapping.
OK: READMEs and CHANGELOG are unchanged from the backup.
OK: the separate test commit changes only the filename and Butter references; no expectation changes.
OK: lab differences consist of the name mapping plus adapters that normalize historical baselines.
[exit 0]
```

The verifier checks every touched file at every replayed commit against the mapped original snapshot, allowing only main's unit/version documentation update and the described historical baseline adapters. It also checks every final extension asset, including unchanged assets, byte for byte. The raw backup-to-HEAD diff includes main's extension rename, renamed raf test references, newly introduced nav tests, and test/version documentation. README and CHANGELOG content match the backup exactly.

```console
$ git status --short --branch
## t3/faster-far-jumps...origin/main [ahead 14]
[exit 0]
```

```console
$ git status --porcelain=v1
(no output)
[exit 0]
```

```console
$ git rev-parse HEAD origin/main backup/faster-far-jumps-pre-rebase
150bf46eb706a27bef189d3a64e6539ed812bea2
d6f4f4c5c9755bcf44ae89fdf127a5e33c658b16
36e3c4105aa93ca63cf8812f0f32682ba1d20701
[exit 0]
```

