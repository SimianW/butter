# Stored seek-preview lab re-check, round 2

2026-11-03. Repo: `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`, HEAD `afbb1e3ea2eb8505e1b4fcad939c7cc252b439d4`. All repo changes remain uncommitted. This task made no repo edits, commits, releases, or pushes.

The warm semantic skip was removed. Warm and stored landings now select a visible preview anchor after dispatch and run the same bounded semantic correction; the focused tests cover matching and the four-pass bound. All current-build runtime tests use the initial 24-file extension snapshot under `review-fix-r2/snapshot/extension`. The repo extension was checked byte-for-byte before packaging and at final verification.

## Same-session interleaved warm A/B

One Linux headed Chromium lab/profile, alternating base then current in each pair. Base is the supplied `review-base/extension`; current is the initial repo snapshot. Each phase acquires the shared lock, restarts with its frozen build, traverses all 12 layouts, measures one native drag, then restores the required lab and releases the lock. Width 1440, height 1000, light theme. Overlay uses a 12-second slow drag; classic uses a 1.2-second fast drag. Timing is pointerup to the readable gate, before the fade.

| Order | Bar | Build | Readable ms | Commit ms | Anchor px | Corrections | Held mounts | Empty / held frames |
|---|---|---|---:|---:|---:|---:|---:|---|
| 01 | overlay | base | 1190.1 | 15.7 | 0.297 | 0 | 0 | 0 / 829 |
| 02 | overlay | current | 1191.0 | 16.2 | 0.156 | 0 | 0 | 0 / 830 |
| 03 | overlay | base | 1223.4 | 15.6 | 0.297 | 0 | 0 | 0 / 830 |
| 04 | overlay | current | 1041.3 | 15.5 | 0.156 | 0 | 0 | 0 / 833 |
| 05 | overlay | base | 1206.5 | 16.2 | 0.297 | 0 | 0 | 0 / 827 |
| 06 | overlay | current | 1207.5 | 15.5 | 0.156 | 0 | 0 | 0 / 831 |
| 07 | overlay | base | 1174.0 | 16.2 | 0.297 | 0 | 0 | 0 / 830 |
| 08 | overlay | current | 1205.8 | 16.2 | 0.156 | 0 | 0 | 0 / 828 |
| 09 | overlay | base | 1141.2 | 16.5 | 0.297 | 0 | 0 | 0 / 826 |
| 10 | overlay | current | 1191.1 | 16.4 | 0.156 | 0 | 0 | 0 / 829 |
| 11 | overlay | base | 1190.8 | 15.8 | 0.297 | 0 | 0 | 0 / 827 |
| 12 | overlay | current | 1223.6 | 15.7 | 0.156 | 0 | 0 | 0 / 832 |
| 13 | classic | base | 1018.0 | 13.4 | 0.297 | 0 | 0 | 0 / 122 |
| 14 | classic | current | 1052.0 | 12.8 | 0.156 | 0 | 0 | 0 / 123 |
| 15 | classic | base | 1001.4 | 13.7 | 0.297 | 0 | 0 | 0 / 121 |
| 16 | classic | current | 1050.7 | 13.2 | 0.156 | 0 | 0 | 0 / 122 |
| 17 | classic | base | 1018.8 | 13.7 | 0.297 | 0 | 0 | 0 / 122 |
| 18 | classic | current | 1085.0 | 12.6 | 0.359 | 0 | 0 | 0 / 121 |

| Bar | Runs per build | Base median ms | Current median ms | Current minus base ms | Previous round ms |
|---|---:|---:|---:|---:|---:|
| overlay | 6 | 1190.4 | 1198.4 | +8.0 | +16.2 |
| classic | 3 | 1018.0 | 1052.0 | +34.0 | +27.1 |

Verdict: current is slower in this sample. Overlay difference +8.0 ms; classic difference +34.0 ms. These are descriptive medians from small samples, not a statistical equivalence claim. The destination-text lookup measured at about 15 ms in the prior attribution is restored; these measurements do not isolate its cost. Every A/B run is shown above.

Every warm A/B run and medians (not archived)

## Dark landing re-checks

Width 1440, dark theme; three runs of each kind in each scrollbar mode. Cold is unvisited geometry, stored is seeded then reloaded, warm is fully traversed in memory.

| Bar | Kind | Run | Readable ms | Anchor px | Semantic matched | Corrections | Held mounts | Empty / held frames |
|---|---|---:|---:|---:|---|---:|---:|---|
| classic | cold | 1 | 3959.7 | 0.000 | question start | 0 | 0 | 0 / 125 |
| classic | cold | 2 | 3824.8 | 0.000 | question start | 0 | 0 | 0 / 119 |
| classic | cold | 3 | 3860.1 | 0.000 | question start | 0 | 0 | 0 / 120 |
| classic | stored | 1 | 1476.9 | -0.484 | True | 1 | 0 | 0 / 126 |
| classic | stored | 2 | 3867.4 | -0.484 | True | 1 | 0 | 0 / 118 |
| classic | stored | 3 | 1456.2 | -0.484 | True | 1 | 0 | 0 / 117 |
| classic | warm | 1 | 1050.6 | 0.156 | True | 0 | 0 | 0 / 122 |
| classic | warm | 2 | 1087.2 | 0.156 | True | 0 | 0 | 0 / 120 |
| classic | warm | 3 | 1033.1 | 0.156 | True | 0 | 0 | 0 / 118 |
| overlay | cold | 1 | 4228.3 | 0.000 | question start | 0 | 0 | 0 / 836 |
| overlay | cold | 2 | 4295.7 | 0.000 | question start | 0 | 0 | 0 / 827 |
| overlay | cold | 3 | 4161.1 | 0.000 | question start | 0 | 0 | 0 / 828 |
| overlay | stored | 1 | 1677.7 | -0.375 | True | 1 | 0 | 0 / 830 |
| overlay | stored | 2 | 1608.0 | -0.375 | True | 1 | 0 | 0 / 829 |
| overlay | stored | 3 | 1457.9 | -0.375 | True | 1 | 0 | 0 / 825 |
| overlay | warm | 1 | 1225.4 | 0.156 | True | 0 | 0 | 0 / 831 |
| overlay | warm | 2 | 1225.1 | 0.156 | True | 0 | 0 | 0 / 830 |
| overlay | warm | 3 | 1225.2 | 0.156 | True | 0 | 0 | 0 / 833 |

The second classic stored run took 3867.4 ms; it remains in the accepted table because it passed every correctness assertion and did not time out. No latency threshold was imposed on these re-checks.

## Tall blank-preview fixture

Seven loaded questions with earlier history deliberately paginated, including the 900-line tall answer. Three cold and three warm track sweeps in both scrollbar modes, width 1440 and dark theme. Visibility requires text-node ink inside the preview viewport, including the narrow gaps between screenshot positions.

| Bar | Kind | Run | Held frames | Held mounts | Empty frames | Anchor px |
|---|---|---:|---:|---:|---:|---:|
| classic | cold | 1 | 128 | 0 | 0 | 0.422 |
| classic | cold | 2 | 128 | 0 | 0 | 0.422 |
| classic | cold | 3 | 128 | 0 | 0 | 0.422 |
| classic | warm | 1 | 128 | 0 | 0 | 0.297 |
| classic | warm | 2 | 128 | 0 | 0 | 0.297 |
| classic | warm | 3 | 128 | 0 | 0 | 0.297 |
| overlay | cold | 1 | 128 | 0 | 0 | 0.422 |
| overlay | cold | 2 | 128 | 0 | 0 | 0.422 |
| overlay | cold | 3 | 128 | 0 | 0 | 0.422 |
| overlay | warm | 1 | 128 | 0 | 0 | 0.297 |
| overlay | warm | 2 | 128 | 0 | 0 | 0.297 |
| overlay | warm | 3 | 128 | 0 | 0 | 0.297 |

Superseded pre-reset cold-overlay diagnostics:

| Run | Stored rows in first model | Held mounts | Empty frames | Anchor px |
|---|---:|---:|---:|---:|
| r2-blank-1440-dark-overlay-w0-r1 | 2 | 0 | 0 | 0.422 |
| r2-blank-1440-dark-overlay-w0-r2 | 2 | 0 | 0 | 0.422 |
| r2-blank-1440-dark-overlay-w0-r3 | 2 | 0 | 0 | 0.422 |

All 48 new A/B and re-check runs have zero held mounts and zero empty frames. Maximum absolute anchor error is 0.484 px; the acceptance limit is 4 px. All release sessions became readable without timeout.

Three initial overlay cold sweeps inherited two stored rows from earlier phases. They passed the visual checks but were superseded by isolated runs with persisted geometry cleared before fixture navigation. All initial captures and logs are retained under `runs/r2-pre-clear-diagnostic/` and `review-fix-r2/pre-clear-diagnostic/`; they are excluded from the accepted tables. The final cold sweeps assert that no preview model rows are marked stored.

## Package

- ZIP: `butter-0.1.0-alpha.10+seekstored.3.zip` (84758 bytes).
- Version name: `0.1.0-alpha.10+seekstored.3`; numeric version: `0.1.0.10`. Repo remains `0.1.0-alpha.10` / `0.1.0.10`.
- SHA-256: `defa20f603c0bb1c4ddc48cdea44c5e7f8de4269e83f6f8da0d56075fb78ab01` (recorded in `provenance.json`).
- Built only from the initial snapshot into the packaging copy. ZIP files match both loaded smoke builds; manifest differs from source only in `version_name`.
- `TRY.md` updated for seekstored.3, the restored anchor check, and this report; included in the ZIP. No harness, probes, or raw captures are packaged.

| Smoke | Readable ms | Anchor px | Held mounts | Empty frames | Files match ZIP |
|---|---:|---:|---:|---:|---|
| classic, stored, 1440 dark | 1527.8 | -0.484 | 0 | 0 | true |
| overlay, stored, 1440 dark | 1725.6 | -0.375 | 0 | 0 | true |

Both Linux headed Chromium smokes pass. Native Mac/Windows installation testing remains a user trial.

## Final cleanup and integrity

`final-cleanup.mjs` ran as the last browser phase. The final verifier retains historical validation against its historical source, then verifies the round-2 builds against the initial snapshot. Historical stream captures are not claimed as new round-2 stream tests.

| Check | Actual result |
|---|---|
| protocolPassed | true |
| Lock absent | true |
| Experimental IndexedDB remaining | false |
| Server user messages | 13 before / 13 after |
| Added / removed server user or node IDs | [] / [] / [] / [] |
| Same current server node | true |
| Extension | ~/snap/chromium/common/butter-blank-head |
| Normal flags and expected extension | True / True |
| Restored tab | <chat> |
| Empty composer and draft after reload | True / True |
| Snapshot unit tests | 114 passed, 0 failed |
| Version consistency | OK: 0.1.0-alpha.10 / 0.1.0.10 |

No composer send was used in these read-only drag/replay checks. Page fetch guards and the context route abort deny non-read methods. Final server reads confirm 13 user messages and no added/removed nodes or current-node change. Raw captures remain private under `/tmp`; this report contains only derived measurements.

`merge.patch`, `merged-untracked-files.txt`, `merged-untracked.tar.gz`, and `source-manifest.json` were regenerated. Initial backups are unchanged. Repo staging remains empty.

## Commands and actual output

The complete phase commands, snapshot test invocation, packaging, both smokes, artifact generation, cleanup and verifier output are in commands-r2.md (not archived). `review-fix-r2/run-lab.sh` is the exact serial driver. The per-phase logs under `review-fix-r2/` retain actual outputs and exit codes. Read-only inspection commands were `cat`, `rg`, `diff`, `ls`, `tail`, and `ps`; setup scripts only wrote under `/tmp`.

Final command output:

```text
$ python3 verify-final.py
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
  },
  "reviewFixR2": {
    "warmABRuns": 18,
    "darkRecheckRuns": 18,
    "blankRuns": 12,
    "heldMounts": 0,
    "emptyFrames": 0,
    "anchorMaxAbsPx": 0.484375,
    "allCurrentBuildsMatchSnapshot": true,
    "repoMatchesSnapshot": true,
    "warmMediansMs": {
      "overlay": {
        "base": 1190.4499999284744,
        "current": 1198.4499999284744,
        "currentMinusBaseMs": 8.0
      },
      "classic": {
        "base": 1018,
        "current": 1052,
        "currentMinusBaseMs": 34
      }
    },
    "unitTestsPassed": 114
  }
}
```
