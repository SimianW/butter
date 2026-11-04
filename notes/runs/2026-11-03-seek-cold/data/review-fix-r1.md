# Stored seek-preview review fixes R1

Fixed S1–S3 with changes to three source files and one new test file. S4 is unchanged. No repo/worktree edits, commits, releases or API writes.

- S1: queue the measurement’s content and layout identity, and discard it if either differs before persistence.
- S2: reuse the store’s identity/layout/expiry gate for adopted entries before preview reads, coverage and remount restore; delete rejected entries. Fresh document entries retain the existing gate.
- S3: remove the fetched-source requirement from preparation when virtualizer row IDs exist, restoring the warm-cache path. Write invalidation still rejects stored geometry.

Patch: review-fix-r1.patch (not archived). It contains only `src/` and `test/` changes and applies in a dry run against `review-r1-before/`.

## Validation

One focused regression test per finding exercises the real modules in a VM. S1 covers queued font/content changes. S2 covers theme, font, digest and expiry for both preview reads and restore. S3 prepares warm layouts after the actual write event without source.

Commands and actual relevant output (full output, including failed harness attempts, is in review-fix-r1-commands.md (not archived)):

```text
REVIEW_SOURCE=(not archived) node --test test/review-r1.test.js
✖ S1 queued geometry keeps its measurement content and layout identity
✖ S2 adopted geometry is revalidated before preview reads and remount restore
✖ S3 warm layouts prepare after write invalidation without fetched source
ℹ tests 3; pass 0; fail 3; Exit: 1

node --test test/review-r1.test.js
✔ S1 queued geometry keeps its measurement content and layout identity
✔ S2 adopted geometry is revalidated before preview reads and remount restore
✔ S3 warm layouts prepare after write invalidation without fetched source
ℹ tests 3; pass 3; fail 0; Exit: 0

cd test && node --test
ℹ tests 58; pass 58; fail 0; cancelled 0; skipped 0; Exit: 0

python3 build.py && python3 package-test.py
stored {'storage': True, 'semantic': True} 0.1.0.10 0.1.0-alpha.10+seekpreview.3
zip entries 24
zipBytes: 82976
zipSHA256: f624959643a8aacf2ba8225457cf98ebe566926c66ca52d6ced5a8cdcb17ee05
Exit: 0
```

The following commands all exited successfully. These are their captured result fields; the full stdout is in the command transcript.

```text
./phase.sh test classic env RUN=review-r1-post-send WARM=1 node harness/review-r1-send.mjs
heldFrames: 128, emptyFrames: 0, heldMounts: 0
Exit: 0
```

```text
./phase.sh test classic env RUN=review-r1-blank-tall-cold WARM=0 FIXTURE_TALL=1 node harness/blank-preview.mjs
heldFrames: 128, emptyFrames: 0, heldMounts: 0
Exit: 0
```

```text
./phase.sh test classic env RUN=review-r1-blank-tall-warm WARM=1 FIXTURE_TALL=1 LANDING_TARGET=.82 node harness/blank-preview.mjs
heldFrames: 129, emptyFrames: 0, heldMounts: 0
Exit: 0
```

```text
./phase.sh test classic env RUN=review-r1-blank-normal-cold WARM=0 node harness/blank-preview.mjs
heldFrames: 128, emptyFrames: 0, heldMounts: 0
Exit: 0
```

All four builds match every packaged file hash. Total sampled held frames: 513; empty frames: 0; held mounts: 0.

The final S3 smoke used a recorded request through Butter’s real fetch wrapper and consumed a local SSE Response: 189 chunks, one write invalidation, seven warm layouts, zero stored records, zero subsequent history data and zero network conversation writes. Every sampled model had no fetched question/answer source. Two fetch guards and a route guard denied writes. History GETs were blocked after the replay to preserve the missing-source condition.

The UI-driven attempts stalled because the guards rejected ChatGPT’s preparatory POSTs (including `/f/conversation/prepare`). Another attempt correctly failed its proof check when the warm revisit fetched older history. These failed attempts remain in the transcript; the final smoke directly replayed the request and did not exercise ChatGPT’s UI submission/SSE rendering flow. No preparatory API writes were permitted.

```text
./phase.sh test overlay env RUN=stored-overlay-package-runtime-smoke FORCE_FULL=1 WARM=0 node harness/measure.mjs stored fast
Exit: 0
python3 verify-package.py
{
  "passed": true,
  "run": "stored-overlay-package-runtime-smoke",
  "buildPath": "(not archived)",
  "sourceFilesMatchZip": true,
  "heldMounts": 0,
  "destinationKnown": false,
  "destinationStored": false,
  "semantic": {
    "attempts": 1,
    "matched": false,
    "fallback": true,
    "clamped": false,
    "lastError": 0,
    "anchorVisible": false,
    "previewY": 52
  },
  "screenTurnMatches": true,
  "releaseReadableMs": 5814.300000190735,
  "allVisibleAnchorMaxPx": 29123,
  "declaredPathsChecked": 22,
  "platform": "Linux headed Chromium; native Windows and macOS behavior unverified"
}
Exit: 0

./phase.sh - classic node harness/review-r1-final.mjs
experimental local draft cleanup: draftCharsAfterReload: 0, submitted: false
fresh-baseline server integrity: beforeUserMessages: 13, afterUserMessages: 13, addedUserIds: [], removedUserIds: [], sameCurrentNode: true, addedNodeIds: [], removedNodeIds: []
experimental storage cleanup: remaining: false
restored <chat> composer empty
Exit: 0

python3 verify-review-r1.py
passed: true
Exit: 0

python3 check-final.py
protocolPassed: true, lockAbsent: true, normalFlags: true, sourceWorkspaceChangedSinceStart: [], unitTestCounts: {tests: 58, pass: 58, fail: 0}
Exit: 0

sha256sum butter-seek-cold-test.zip
f624959643a8aacf2ba8225457cf98ebe566926c66ca52d6ced5a8cdcb17ee05  butter-seek-cold-test.zip
Exit: 0
```

The package runtime smoke retains the pre-existing release limitation: about 5.8 seconds to readable content and a 29,123 px neighboring-anchor shift. The selected fallback anchor was correct. This round does not change release continuity.

## Package and lab

Unchanged version name `0.1.0-alpha.10+seekpreview.3`, numeric version `0.1.0.10`. Zip: 82976 bytes. SHA-256: `f624959643a8aacf2ba8225457cf98ebe566926c66ca52d6ced5a8cdcb17ee05`.

- Zip (not archived)
- Package provenance (not archived)
- [Result summary](review-fix-r1-results.json)
- Final lab state (not archived)

Final audit verifies blank-head, normal flags, the required original tab, an empty composer, deleted experimental IndexedDB, no lock and unchanged server state. The experimental chat’s local draft was also cleared and checked after reload. Raw captures remain under `/tmp`; none were published. Native macOS/Windows behavior was not tested this round.
