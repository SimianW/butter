# Stored seek-preview blank viewport fix — 2026-11-03

Implemented and packaged as `0.1.0-alpha.10+seekpreview.3`, numeric version unchanged at `0.1.0.10`. All implementation, tests and artifacts are under `(not archived)`; no repo/worktree edits, commits, releases, real sends or API writes were made. Runtime lab installation copies followed the existing phase protocol.

## Cause and evidence

The recorder in `height-cache.js` caps each block's lean text at 4,000 characters while keeping its full measured height. `seek-preview.js` previously assumed that an intersecting recorded block meant there was text to show. A tall paragraph, list, table or raw-TeX block can have all its lean text above the clipped viewport while its geometry still covers that viewport. The preview then draws an empty block and supplies no estimated-text fallback.

The ordinary frozen lab chat did not reproduce this: its largest recorded item was 625 px tall, and no item reached the 4,000-character cap. To exercise the actual failure path, the harness locally replays the newest seven questions, leaves `has_previous_page=true`, and replaces only question 5's answer with a 900-line paragraph. This is an entirely local read-response fixture, never a ChatGPT send. It reproduces the user's exact visible symptom: a black viewport with `Preview · question 5/7 · earlier history not loaded`. This verifies a cause matching the recording; the recording alone cannot establish the precise block structure in the user's private chat.

The failing preview dump, from `runs/blank-before-tall.json`, records:

```json
{
  "scrollTop": 77229,
  "viewport": {"top": 52, "height": 844},
  "window": [{"turn": 4, "abs": 72660.953125, "h": 23400, "chars": 4000}],
  "rendered": {"top": -4568.046875, "height": 23400, "visibleText": false, "color": "rgb(237, 237, 237)"}
}
```

The row is measured and has a valid layout. Its source answer contains 59,293 characters. Its recorded block intersects the viewport and its text color is light, but its capped preview text has scrolled above the clip. This rules out an empty row query, dark text, unavailable hydration and pagination-index displacement for this reproduction. After release in the fixed warm trial, question 5 is mounted with 56,649 text characters; its semantic anchor matches with zero error.

## Implementation

- `src/seek-core.js` and generated `extension-stored/seek-core.js`: retain a whole-row fallback span even for measured layouts. Maintain monotonic prefix bottoms so window lookup remains correct when these spans overlap blocks. Add pure excerpt selection with question/placeholder fallback for missing or whitespace-only source.
- `src/seek-preview.js` and generated `extension-stored/seek-preview.js`: check actual text rectangles inside the preview's clip, using only the preview tree. If no text is visible, show the current row's source excerpt in the viewport; use `Preview text unavailable` when no source exists. Preserve the recorded row geometry and zero held mounts. Allow semantic landing for fallback excerpts of measured rows too. Expose a text-free `textFallback` diagnostic.
- `test/blank-preview.test.js`: regressions for capped tall blocks, overlapping window spans, source excerpts beyond the capped prefix, and absent/question-only/whitespace source.
- `build.py`, `package-test.py`: build metadata suffix `.3`; numeric version preserved. `TRY-ON-MAC.md` now explicitly covers Windows and the blank-preview fix.

Reviewable implementation diff: blank-preview-fix.patch (not archived).

## Validation and actual command output

The full command transcript, including failed/interrupted attempts, is blank-preview-commands.md (not archived). Commands below ran from `(not archived)` unless they explicitly change directory. Output is abbreviated here; the linked transcript contains the actual full output.

```text
SEEK_CORE_SOURCE=(not archived) node --test --test-name-pattern="recorded tall|window lookup" test/blank-preview.test.js
  tests 2; pass 0; fail 2; exit 1
  AssertionError: A layout record is not proof of visible text: retain a row-height fallback
  AssertionError: Binary search needs monotonic prefix bottoms when fallback spans overlap blocks

cd test && node --test blank-preview.test.js
  tests 4; pass 4; fail 0; exit 0

node --test
  tests 55; pass 55; fail 0; cancelled 0; skipped 0; exit 0

./phase.sh stored classic env RUN=blank-before-tall WARM=0 FIXTURE_TALL=1 node harness/blank-preview.mjs
  heldFrames:128, emptyFrames:27, heldMounts:0; exit 1
  AssertionError: Preview must contain visible text in every sampled held frame

./phase.sh stored classic env RUN=blank-fixed-tall-cold WARM=0 FIXTURE_TALL=1 node harness/blank-preview.mjs
  heldFrames:128, emptyFrames:0, heldMounts:0; exit 0

./phase.sh test classic env RUN=blank-fixed-tall-warm WARM=1 FIXTURE_TALL=1 LANDING_TARGET=.82 node harness/blank-preview.mjs
  heldFrames:129, emptyFrames:0, heldMounts:0; exit 0

./phase.sh test classic env RUN=blank-fixed-normal-cold WARM=0 node harness/blank-preview.mjs
  heldFrames:128, emptyFrames:0, heldMounts:0; exit 0

python3 build.py && python3 package-test.py
  stored: 0.1.0.10 / 0.1.0-alpha.10+seekpreview.3
  zip entries 24; zipBytes 82807; exit 0

./phase.sh test overlay env RUN=stored-overlay-package-runtime-smoke FORCE_FULL=1 WARM=0 node harness/measure.mjs stored fast
  pressOnScroller:true, updates:58, captures:95; exit 0

python3 verify-package.py
  passed:true, sourceFilesMatchZip:true, heldMounts:0, destinationKnown:false,
  semantic.fallback:true, semantic.lastError:0, screenTurnMatches:true,
  declaredPathsChecked:22; exit 0

python3 verify-blank-fix.py
  passed:true, oldEmptyFrames:27, newHeldFrames:385, newEmptyFrames:0,
  heldMounts:0, warmSemanticErrorPx:0; packaged warm/ordinary trial files match zip; exit 0

./phase.sh - classic node harness/final-audit.mjs
  beforeUserMessages:13, afterUserMessages:13, addedUserIds:[], removedUserIds:[],
  addedNodeIds:[], removedNodeIds:[], sameCurrentNode:true
  experimental storage cleanup: remaining:false; restored original tab; composer empty; exit 0

python3 check-final.py
  protocolPassed:true, lockAbsent:true, normalFlags:true, packageVersionCorrect:true,
  runtimeSmokePassed:true, sourceWorkspaceChangedSinceStart:[], sourceFilesChecked:237; exit 0

sha256sum butter-seek-cold-test.zip
  0fb3b3a35daa06a430f438a64854066777f499122777a737bc428ea065b7fa44  butter-seek-cold-test.zip
```

All three fixed classic-scrollbar trials use dark theme at 1576 × 980, seven loaded questions and unloaded earlier history. Each samples near-bottom and near-top positions, then sweeps the thumb track. They contain 385 sampled held frames in total, none empty, and zero held mounts. Captures were inspected at the formerly blank location and near both ends. Raw captures remain under `/tmp`, including `runs/blank-before-tall-0.82.png`, `runs/blank-fixed-tall-cold-0.82.png`, `runs/blank-fixed-tall-warm-0.82.png`, and `runs/blank-fixed-normal-cold-0.995.png`. No raw captures were published.

The added text-visibility check has a cost: render p95 was 3.3 ms in the fixed cold tall trial, 5.2 ms in the warm tall trial and 3.9 ms in the ordinary cold trial; maxima were 3.9, 7.6 and 7.5 ms. These are limited correctness trials, not a new performance matrix. The unseeded runtime smoke took 5,771.5 ms to become readable and retained the pre-existing neighboring-anchor shift of 29,130 px. This fix addresses blank held previews; it does not establish seamless release continuity. Native Windows/macOS behavior remains unverified; Linux classic and overlay Chromium were tested.

## Package and restored state

- Trial zip (not archived): 82,807 bytes, version name `0.1.0-alpha.10+seekpreview.3`, numeric version `0.1.0.10`.
- Package provenance (not archived): new SHA-256, every packaged file hash and passing runtime smoke.
- [Results](blank-preview-results.json) and final state (not archived).
- Mac/Windows instructions (not archived).

Final restoration is independently verified: blank-head extension, normal flags, original conversation URL, empty composer, no replay/probe, unchanged server state, experimental database absent and lock directory absent. All 237 original tracked-file hashes remain unchanged.
