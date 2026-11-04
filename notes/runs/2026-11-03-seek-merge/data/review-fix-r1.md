# Stored seek-preview review fixes, round 1

All repo changes remain uncommitted in `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`, HEAD `afbb1e3ea2eb8505e1b4fcad939c7cc252b439d4`. Repo version remains `0.1.0-alpha.10` / `0.1.0.10`.

## Changes

- S1: fingerprint the rendered assistant column width outside the clientWidth hook; observe that column and invalidate its scroller fingerprint on resize. An unavailable rendered width stays unknown rather than reusing an estimated column width. The hook continues to validate without reading layout.
- S3: remove leading whitespace from nonempty fallback excerpts; whitespace-only sources keep the existing question/placeholder fallback.
- S4: share one fingerprint across preparation, one recorder batch, and one storage flush. Warm cache reads do not compute it. Adopted reads still validate source/layout/expiry; standalone adopted reads refresh outside the hook.
- WARM: dispatch before selecting an anchor, stop selection at the first visible candidate, stop semantic traversal after alignment or four passes (at most three corrections), and skip semantic work when warm native/preview row coordinates already align. The coordinate check accounts for the separate preview origin.
- The declined first-24-character anchor limitation, storage design, and approved UI are unchanged. Only four runtime files and focused tests changed in this round.

## Red and green

One focused Node test each for S1, S3, S4, and WARM. The WARM case covers an aligned warm row with different coordinate origins, aligned stored rows, a real correction, and exhausted correction passes.

```text
$ REVIEW_SOURCE=(not archived) node --test --test-name-pattern='S1 rendered|S3 fallback|S4 preparation|WARM dispatch' test/review-r1.test.js
ℹ tests 4
ℹ pass 0
ℹ fail 4
Exit: 1
$ node --test --test-name-pattern='S1 rendered|S3 fallback|S4 preparation|WARM dispatch' test/review-r1.test.js
ℹ tests 4
ℹ pass 4
ℹ fail 0
Exit: 0
$ node --test
ℹ tests 114
ℹ pass 114
ℹ fail 0
Exit: 0
$ python3 scripts/check-version.py
OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
Exit: 0
$ git diff --check
(no output)
Exit: 0
```

The additional unavailable-column and whitespace-tail assertions also fail on the saved first-fix build (`edge-red-frozen.log`: 2 failures) and pass on final source (`edge-green.log`: 2 passes). Full actual test output: `review-fix-r1/red-final.log`, `green.log`, `unit.log`, `version.log`, `diff-check.log`, and `commands-and-output.md`. S2 stale-adoption and S5 restore-order tests are included in the passing full suite.

## Same-session interleaved warm A/B

Same Linux headed Chromium lab/profile and saved local history replay; each phase restarts into its frozen build, measures a fully traversed warm document, restores the lab, and releases the lock. Each repetition alternates base then fixed. Base is the supplied `review-base/extension`; fixed is the final repo tree. Warm setup traverses once and confirms all 12 layouts before the native drag. Overlay uses a 12 s slow drag; classic a 1.2 s fast drag. Width 1440, height 1000, light theme. The reported interval is native pointerup to the readable gate; fade begins afterward.

| Order | Bar | Build | Readable ms | Commit ms | Prep ms | Anchor px | Semantic corrections | Held mounts | Empty / held frames |
|---|---|---|---:|---:|---:|---:|---:|---:|---|
| 01 | overlay | base | 1173.7 | 15.5 | 2.2 | 0.297 | 0 | 0 | 0 / 830 |
| 02 | overlay | fixed | 1190.3 | 15.9 | 4.8 | 0.297 | 0 | 0 | 0 / 833 |
| 03 | overlay | base | 1172.5 | 15.2 | 2.7 | 0.297 | 0 | 0 | 0 / 828 |
| 04 | overlay | fixed | 1189.6 | 14.3 | 4.8 | 0.297 | 0 | 0 | 0 / 826 |
| 05 | overlay | base | 1140.5 | 16.2 | 2.4 | 0.297 | 0 | 0 | 0 / 830 |
| 06 | overlay | fixed | 1173.1 | 15.4 | 4.9 | 0.297 | 0 | 0 | 0 / 832 |
| 07 | overlay | base | 1173.8 | 17.6 | 2.6 | 0.297 | 0 | 0 | 0 / 827 |
| 08 | overlay | fixed | 1207.6 | 16.2 | 4.8 | 0.297 | 0 | 0 | 0 / 834 |
| 09 | overlay | base | 1192.4 | 16.3 | 2.5 | 0.297 | 0 | 0 | 0 / 830 |
| 10 | overlay | fixed | 1173.3 | 15.7 | 4.9 | 0.297 | 0 | 0 | 0 / 830 |
| 11 | overlay | base | 1174.0 | 16.4 | 2.5 | 0.297 | 0 | 0 | 0 / 831 |
| 12 | overlay | fixed | 1226.2 | 16.0 | 4.8 | 0.297 | 0 | 0 | 0 / 830 |
| 13 | classic | base | 1085.4 | 12.9 | 2.4 | 0.297 | 0 | 0 | 0 / 121 |
| 14 | classic | fixed | 1083.9 | 18.6 | 4.6 | 0.297 | 0 | 0 | 0 / 124 |
| 15 | classic | base | 1056.8 | 22.4 | 2.5 | 0.281 | 0 | 0 | 0 / 122 |
| 16 | classic | fixed | 1100.7 | 14.1 | 5.0 | 0.297 | 0 | 0 | 0 / 122 |
| 17 | classic | base | 1039.0 | 14.2 | 2.4 | 0.297 | 0 | 0 | 0 / 121 |
| 18 | classic | fixed | 1034.1 | 16.9 | 4.7 | 0.297 | 0 | 0 | 0 / 121 |

| Bar | Runs per build | Base median ms | Fixed median ms | Fixed minus base ms | Verdict |
|---|---:|---:|---:|---:|---|
| overlay | 6 / 6 | 1173.8 | 1190.0 | +16.2 | fixed remains slower; see attribution |
| classic | 3 / 3 | 1056.8 | 1083.9 | +27.1 | fixed remains slower; see attribution |

These are measured medians with small samples, not a statistical equivalence claim. Every run is retained. Chart: review-fix-r1-warm-ab.png (not archived).

## Attribution and preserved diagnostic runs

One attempted sixth fixed overlay run switched back to dark during warm-up and failed the light-theme assertion. Its 1176.7 ms capture and exact failure output are retained under `runs/review-fix-r1-failed/` and `review-fix-r1/theme-failure-12.log`; it is excluded from the light A/B table. The retry and subsequent phases pin the requested theme through a DOM-only observer. Every final run asserts the actual held theme.

The earlier A/B series was superseded when an S3 tail-fallback edge case was found: the selected slice was whitespace-only, and the tail fallback could itself start with thousands of newlines. The final fix trims the selected result after every branch. The added assertion failed on the first fix (`s3-tail-red.log`) and passed after the correction (`s3-tail-green.log`). Final measurements were rerun against the final source. The first attempted fix was measured before the final A/B series. A lab-only instrumented copy found a warm native/preview origin difference of -83.865 px, with row drift only 0.281 px, so the original fast-path check was too conservative. Semantic corrections were zero. That probe measured 34 candidate needle calls (1.0 ms total), one destination-text lookup (15.5 ms), and one final swap audit (5.2 ms). It motivated comparing row-relative coordinates. No temporary performance instrumentation is present in the repo or package.

| Diagnostic run | Readable ms | Anchor px | Timed out |
|---|---:|---:|---|
| r1-final-ab-01-base-1440-light-overlay-warm-r1 | 1158.6 | 0.297 | False |
| r1-final-ab-02-fixed-1440-light-overlay-warm-r1 | 1158.0 | 0.297 | False |
| r1-final-ab-03-base-1440-light-overlay-warm-r1 | 1190.9 | 0.297 | False |
| r1-final-ab-04-fixed-1440-light-overlay-warm-r1 | 1192.1 | 0.297 | False |
| r1-final-ab-05-base-1440-light-overlay-warm-r1 | 1175.0 | 0.297 | False |
| r1-final-ab-06-fixed-1440-light-overlay-warm-r1 | 1190.2 | 0.297 | False |
| r1-final-ab-07-base-1440-light-overlay-warm-r1 | 1206.6 | 0.297 | False |
| r1-final-ab-08-fixed-1440-light-overlay-warm-r1 | 1188.8 | 0.297 | False |
| r1-final-ab-09-base-1440-light-overlay-warm-r1 | 1158.6 | 0.297 | False |
| r1-final-ab-10-fixed-1440-light-overlay-warm-r1 | 1205.4 | 0.297 | False |
| r1-final-ab-11-base-1440-light-overlay-warm-r1 | 1223.7 | 0.297 | False |
| r1-final-ab-12-fixed-1440-light-overlay-warm-r1 | 1190.6 | 0.297 | False |
| r1-final-ab-13-base-1440-light-classic-warm-r1 | 1040.1 | 0.297 | False |
| r1-final-ab-14-fixed-1440-light-classic-warm-r1 | 1088.8 | 0.297 | False |
| r1-final-ab-15-base-1440-light-classic-warm-r1 | 1034.7 | 0.297 | False |
| r1-final-ab-16-fixed-1440-light-classic-warm-r1 | 1051.6 | 0.297 | False |
| r1-final-ab-17-base-1440-light-classic-warm-r1 | 1034.1 | 0.297 | False |
| r1-final-ab-18-fixed-1440-light-classic-warm-r1 | 1034.6 | 0.297 | False |
| r1-final-ab-12-fixed-1440-light-overlay-warm-r1 | 1176.7 | 0.297 | False |
| r1-ab-01-base-1440-light-overlay-warm-r1 | 1041.8 | 0.297 | False |
| r1-ab-02-fixed-1440-light-overlay-warm-r1 | 1290.6 | 0.156 | False |
| r1-ab-03-base-1440-light-overlay-warm-r1 | 1190.8 | 0.297 | False |
| r1-attribution-before-1440-light-overlay-warm-r1 | 1208.6 | 0.141 | False |
| r1-attribution-final-classic-base-1440-light-classic-warm-r1 | 1017.4 | 0.297 | False |
| r1-attribution-final-classic-fixed-1440-light-classic-warm-r1 | 1082.9 | 0.297 | False |
| r1-attribution-final-overlay-base-1440-light-overlay-warm-r1 | 1172.2 | 0.297 | False |
| r1-attribution-final-overlay-fixed-1440-light-overlay-warm-r1 | 1207.7 | 0.297 | False |

Superseded pre-tail-trim cold/stored and blank captures (excluded from final-source checks):

| Run | Readable ms or sampled frames | Held mounts | Empty frames |
|---|---:|---:|---:|
| r1-recheck-1440-dark-classic-cold-r1 | 3940.9 ms | 0 | 0 |
| r1-recheck-1440-dark-classic-cold-r2 | 3872.1 ms | 0 | 0 |
| r1-recheck-1440-dark-classic-cold-r3 | 3955.7 ms | 0 | 0 |
| r1-recheck-1440-dark-classic-stored-r1 | 1398.0 ms | 0 | 0 |
| r1-recheck-1440-dark-classic-stored-r2 | 1502.8 ms | 0 | 0 |
| r1-recheck-1440-dark-classic-stored-r3 | 1373.3 ms | 0 | 0 |
| r1-recheck-1440-dark-overlay-cold-r1 | 4380.5 ms | 0 | 0 |
| r1-recheck-1440-dark-overlay-cold-r2 | 4109.2 ms | 0 | 0 |
| r1-recheck-1440-dark-overlay-cold-r3 | 4390.5 ms | 0 | 0 |
| r1-recheck-1440-dark-overlay-stored-r1 | 4193.4 ms | 0 | 0 |
| r1-recheck-1440-dark-overlay-stored-r2 | 1509.0 ms | 0 | 0 |
| r1-recheck-1440-dark-overlay-stored-r3 | 1691.4 ms | 0 | 0 |
| r1-blank-1440-dark-overlay-w0 | 128 frames | 0 | 0 |
| r1-blank-1440-dark-overlay-w1 | 128 frames | 0 | 0 |

### Final-build timing probes

One additional base/fixed diagnostic pair per slower scrollbar cell, excluded from the A/B medians. All marks/wrappers live only in lab build copies. The readiness CPU column includes the final swap audit after the readable timestamp; it is an upper bound on the gate callback CPU, not a claim that all of it delays the gate. CDP durations also include 150 ms of post-gate observation.

| Bar | Build | Readable ms | Commit ms | First readiness frame ms after release | Readiness calls | Total readiness CPU ms | Largest frame gap ms | Text lookups |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| classic | base | 1016.9 | 16.4 | 791.5 | 5 | 12.2 | 174.5 | 0 |
| classic | fixed | 1046.5 | 17.2 | 813.6 | 5 | 13.3 | 173.0 | 0 |
| overlay | base | 1155.2 | 14.9 | 929.8 | 5 | 10.4 | 185.2 | 0 |
| overlay | fixed | 1122.1 | 14.3 | 807.6 | 6 | 15.3 | 213.4 | 0 |

| Bar | Build | CDP task ms | Script ms | Layout ms | Style ms |
|---|---|---:|---:|---:|---:|
| classic | base | 1051.1 | 584.0 | 46.6 | 301.1 |
| classic | fixed | 1080.6 | 604.7 | 48.4 | 308.3 |
| overlay | base | 1198.3 | 700.0 | 55.6 | 321.2 |
| overlay | fixed | 1171.7 | 631.6 | 66.2 | 332.6 |

Recorder CPU during the measured window (including post-gate observation):
- classic base: 20.7 ms; fingerprint timing: `{}`.
- classic fixed: 20.1 ms; fingerprint timing: `{'calls': 2, 'ms': 11.999999761581421, 'max': 8.599999904632568}`.
- overlay base: 21.1 ms; fingerprint timing: `{}`.
- overlay fixed: 49.7 ms; fingerprint timing: `{'calls': 2, 'ms': 14.5, 'max': 11.200000047683716}`.

The native destination commit is early; most wall time follows dispatch while the application mounts/typesets the destination and delivers readiness frames. Compare the callback CPU, large frame gaps and CDP layout/style/script totals above. No semantic destination lookup remains on the final aligned warm path. These one-pair timing probes locate elapsed work; they do not establish statistical causation for the small A/B median differences.


## Cold/stored re-checks at 1440 dark

| Run | Readable ms | Anchor px | Held mounts | Empty / held frames |
|---|---:|---:|---:|---|
| r1-recheck2-1440-dark-classic-cold-r1 | 4115.1 | 0.000 | 0 | 0 / 125 |
| r1-recheck2-1440-dark-classic-cold-r2 | 3890.6 | 0.000 | 0 | 0 / 120 |
| r1-recheck2-1440-dark-classic-cold-r3 | 4006.5 | 0.000 | 0 | 0 / 119 |
| r1-recheck2-1440-dark-classic-stored-r1 | 1510.7 | -0.484 | 0 | 0 / 126 |
| r1-recheck2-1440-dark-classic-stored-r2 | 1272.6 | -0.484 | 0 | 0 / 118 |
| r1-recheck2-1440-dark-classic-stored-r3 | 1538.3 | -0.484 | 0 | 0 / 121 |
| r1-recheck2-1440-dark-overlay-cold-r1 | 4176.1 | 0.000 | 0 | 0 / 832 |
| r1-recheck2-1440-dark-overlay-cold-r2 | 4042.3 | 0.000 | 0 | 0 / 831 |
| r1-recheck2-1440-dark-overlay-cold-r3 | 4326.0 | 0.000 | 0 | 0 / 824 |
| r1-recheck2-1440-dark-overlay-stored-r1 | 1628.6 | -0.375 | 0 | 0 / 827 |
| r1-recheck2-1440-dark-overlay-stored-r2 | 1443.9 | -0.375 | 0 | 0 / 819 |
| r1-recheck2-1440-dark-overlay-stored-r3 | 4295.7 | -0.375 | 0 | 0 / 824 |

## Tall-fixture blank-preview sweeps

Both scrollbar modes, cold and warm; seven replayed rows with older pagination blocked and one 900-line answer. Seven held points plus a 100-step track sweep. Text-node range rectangles determine sampled visible ink.

| Run | Held mounts | Empty frames | Sampled frames |
|---|---:|---:|---:|
| r1-blank2-1440-dark-classic-w0 | 0 | 0 | 128 |
| r1-blank2-1440-dark-classic-w1 | 0 | 0 | 128 |
| r1-blank2-1440-dark-overlay-w0 | 0 | 0 | 128 |
| r1-blank2-1440-dark-overlay-w1 | 0 | 0 | 128 |

Zero sampled empty frames does not assert coverage of unsampled compositor frames.

## Streaming control versus fixed

One cell: classic, 1440 light; two control and two fixed local SSE replays, original 189 chunks and schedule. The actual UI send is intercepted locally. Two fetch denial guards and non-read request route abortion fail closed. There are no completed network writes.

| Build | Rep | Answer SHA-256 | Characters | KaTeX | Chunks | Network writes |
|---|---:|---|---:|---:|---:|---:|
| r1-stream-control-1440-light-classic | 1 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` | 21448 | 420 | 189 | 0 |
| r1-stream-control-1440-light-classic | 2 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` | 21448 | 420 | 189 | 0 |
| r1-stream-fixed-1440-light-classic | 1 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` | 21448 | 420 | 189 | 0 |
| r1-stream-fixed-1440-light-classic | 2 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` | 21448 | 420 | 189 | 0 |

| Build | Rep | FPS | Frame p95 ms | Busy % | Key p95 ms |
|---|---:|---:|---:|---:|---:|
| r1-stream-control-1440-light-classic | 1 | 52.2 | 33.3 | 37.8 | 149.9 |
| r1-stream-control-1440-light-classic | 2 | 52.2 | 33.3 | 38 | 146.1 |
| r1-stream-fixed-1440-light-classic | 1 | 53.5 | 33.3 | 40.2 | 141.6 |
| r1-stream-fixed-1440-light-classic | 2 | 54.1 | 33.3 | 39.2 | 141.6 |

Two replays per arm are a control and integrity check, not a statistical equivalence claim.

## Package smokes

| Bar | Readable ms | Anchor px | Held mounts | Empty frames |
|---|---:|---:|---:|---:|
| classic | 1371.0 | -0.484 | 0 | 0 |
| overlay | 1639.4 | -0.375 | 0 | 0 |

ZIP: `(not archived)`; version_name `0.1.0-alpha.10+seekstored.2`, numeric version `0.1.0.10`. SHA-256: `b2f2b8f3e3d7e48995cc2d4cc3f139065ae0049c28797ea99ecb65d2ff1e5fe8`. Runtime file hashes and smoke results: `provenance.json`.

Updated `TRY.md` identifies seekstored.2 and the fixed behaviors. The packaging copy alone carries the build suffix. Native Mac/Windows remain user-installation testing; both smokes use Linux classic/overlay.

## Artifacts and command record

Before-edit snapshot: `review-fix-r1/before.patch`, `before-untracked.list0`, and `before/`. Round-only changes: `review-fix-r1.patch` (verified applicable to the snapshot). Full merged source: `merge.patch`, `merged-untracked-files.txt`, `merged-untracked.tar.gz`, `source-manifest.json`. Raw captures remain under `/tmp` and were not published.

Exact browser commands and their complete actual stdout/stderr are in `(not archived)`; per-phase logs are in `review-fix-r1/`. The driver is `review-fix-r1/run-final2.sh`. Key invocations:

```sh
python3 package.py
python3 run.py ./phase.sh r1-base overlay env WIDTH=1440 THEME=light ONLY=warm REP_COUNT=1 RUN_PREFIX=r1-final2-ab-01-base node harness/review-fix-warm.mjs
# Alternate base/fixed for 12 overlay phases and 6 classic phases; every exact invocation is logged.
python3 run.py ./phase.sh r1-fixed-v2 overlay env WIDTH=1440 THEME=dark REP_COUNT=3 RUN_PREFIX=r1-recheck2 node harness/review-fix-recheck.mjs
# Repeat re-checks for classic; cold and stored are measured, warm is excluded.
python3 run.py ./phase.sh r1-fixed-v2 overlay env WIDTH=1440 THEME=dark FIXTURE_TALL=1 WARM=0 RUN=r1-blank2-1440-dark-overlay-w0 node harness/blank-preview.mjs
# Repeat cold/warm for both scrollbar modes.
python3 run.py ./phase.sh control classic env WIDTH=1440 THEME=light ./stream.sh r1-stream-control-1440-light-classic 2
python3 run.py ./phase.sh r1-fixed-v2 classic env WIDTH=1440 THEME=light ./stream.sh r1-stream-fixed-1440-light-classic 2
python3 run.py ./package-smoke.sh
python3 run.py ./phase.sh - classic node harness/final-cleanup.mjs
python3 run.py python3 refresh-artifacts.py
python3 run.py python3 verify-final.py
```

## Final protocol state

```json
{
  "protocolPassed": true,
  "lockAbsent": true,
  "extensions": "~/snap/chromium/common/butter-blank-head",
  "normalFlags": true,
  "browserExtensionsMatch": true,
  "browserFlagInspection": "proc cmdline; Snap single-value argv normalized with shlex",
  "restoredURL": "<chat>",
  "composerEmpty": true,
  "experimentalIDBRemaining": false,
  "localDraftEmptyAfterReload": true,
  "server": {
    "beforeUserMessages": 13,
    "afterUserMessages": 13,
    "addedUserIds": [],
    "removedUserIds": [],
    "sameCurrentNode": true,
    "addedNodeIds": [],
    "removedNodeIds": [],
    "sameConversation": true
  },
  "releaseRuns": 72,
  "blankRuns": 16,
  "streamRuns": 17,
  "originalStreamPlan": 48,
  "streamReductionDocumented": true,
  "requiredStreamCellsPassed": true,
  "streamHashesIdentical": true,
  "streamAnswerSha256": "043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68",
  "streamAnswerChars": 21448,
  "completedNetworkWriteRequests": 0,
  "zipRuntimeSmokePassed": true,
  "sourceUnchangedSincePackage": true,
  "repoVersionName": "0.1.0-alpha.10",
  "noStagedChanges": true,
  "unitTestsPassed": 114,
  "uiCellsCompared": 8,
  "uiStatesCompared": 32,
  "releaseHeldMounts": 0,
  "releaseEmptyFrames": 0,
  "releaseHeldFrames": 34159,
  "warmTargetMisses": 17,
  "reviewFixR1": {
    "warmABRuns": 18,
    "recheckRuns": 12,
    "blankRuns": 4,
    "streamRuns": 4,
    "streamHashesIdentical": true,
    "heldMounts": 0,
    "emptyFrames": 0,
    "allFixedBuildsMatchSource": true,
    "warmMediansMs": {
      "overlay": {
        "base": 1173.75,
        "fixed": 1189.9500000476837,
        "fixedMinusBaseMs": 16.200000047683716
      },
      "classic": {
        "base": 1056.7999999523163,
        "fixed": 1083.9000000953674,
        "fixedMinusBaseMs": 27.100000143051147
      }
    },
    "warmGoalMet": false,
    "declinedAnchorImplementationUnchanged": true
  }
}
```
