> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Seek preview product port

Worktree: `~/.t3/worktrees/butter/t3-6cf413cf`  
Branch: `t3/seek-preview`  
Base: `afbb1e3ea2eb8505e1b4fcad939c7cc252b439d4` (`origin/main`, alpha.10)

Implemented and left uncommitted. No version bump, changelog edit, commit or release. Screenshots remain private under `(not archived)`.

## Implementation

Ported the v2 pure model, positive-size complete/typeset layout cache, pre-layout `clientWidth` restore hook, trusted native-thumb classification, capture-phase scroll suppression, release coalescing, readiness and bounded retarget checks. Kept the diagnostic audit without chat text; removed the prototype badge and lab stamp.

The approved preview uses half-opacity text and neutral question bubbles, inline TeX and measured-height display placeholders. Unmeasured turns show their question and answer from the beginning with a 60 px fade; release aligns the actual question bubble below the header. JSON `butter-seek-state` document events drive the existing isolated-world rail and its bilingual card, instant following, loading spinner and busy pulse. The preview fades over 120 ms after readiness, and the rail/card collapse after one second. Reduced motion removes the fade and spinner animation. Seek follows Butter's main switch independently of the rail setting; no popup toggle was added.

Files added: `extension/seek-core.js`, `height-cache.js`, `seek-preview.js`, and the small isolated-world `butter-seek-meta.js` formatter. The manifest, settings marker, existing rail and API-response feed are wired together. `docs/how-it-works.md` now documents seeking, memory-only caching and trade-offs. Prototype tests are ported, with additional UI-policy, settings, math-geometry and bootstrap regression coverage.

## Screenshots

Each image is the real product UI during a trusted native scrollbar gesture in the lab browser. The loading capture briefly defers frame callbacks to keep the transient loading state visible; timing runs do not do this. The narrow captures temporarily collapse ChatGPT's sidebar so its chat column can display the existing rail. The sidebar is restored afterward.

| Width | Theme | Seen drag | Unseen drag | Released loading |
|---|---|---|---|---|
| 1440 px | light | seen-drag (not archived) | unseen-drag (not archived) | released-loading (not archived) |
| 1440 px | dark | seen-drag (not archived) | unseen-drag (not archived) | released-loading (not archived) |
| 800 px | light | seen-drag (not archived) | unseen-drag (not archived) | released-loading (not archived) |
| 800 px | dark | seen-drag (not archived) | unseen-drag (not archived) | released-loading (not archived) |

Computed-style checks verify half opacity, recorded display-block height, zero vertical placeholder padding, 8 px radius, 12 px math font and the specified light/dark math colors. Captures verify the card, hot pill, instant position, spinner and busy tick. The 800 px dark run also checks static spinner and no preview fade under reduced motion. No page errors were captured. Full facts: ui-evidence-combined.json (not archived).

## Performance subset

Linux headed Chromium, real zero-gutter overlay scrollbar; native pointer input. This is a small sanity subset, not a new full matrix or a macOS measurement. Cache coverage is fail-closed before the warm drag. All test sends are the existing fail-closed local SSE replay; no real ChatGPT message was sent.

| Run | Held mounts | Physical release to readable | Text-anchor error | Landing error |
|---|---:|---:|---:|---:|
| Final warm overlay, slow | 0 | 1079.4 ms | 2 px maximum, three samples | -1.75 px |
| Final unseen overlay, fast | 0 | 4365.1 ms | Beginning-of-answer estimate; no measured-layout promise | 0.00 px at the question bubble |

Readability uses the prototype's gate: the destination is mounted, math-ready and quiet for three frames. The required 120 ms fade starts at this gate; the timestamp does not include fade completion.

The warm run passes the 1100 ms / 4 px requirements. Both drags keep held mounts at zero. The cold run does not time out and lands at the actual question start; rendering unseen content still takes about 4.4 seconds. A previous corrected warm repetition also passed at 983.9 ms / 2 px.

| Streaming arm | Replays | Duration | LoAF blocking | Longest LoAF | Chunks | Answer hash |
|---|---:|---:|---:|---:|---:|---|
| alpha.10 control | 1 | 125.065 s | 5998 ms | 641 ms | 189 | `043dc8afaf8d` |
| Final product | 1 | 124.889 s | 4378 ms | 642 ms | 189 | `043dc8afaf8d` |

The paired replay durations differ by 176 ms (0.141%). This is within the timing noise of a single paired sanity run; it is not a statistical non-regression study. Both answers match in length, math count and hash.

Performance subset (not archived)

Raw timing and build provenance: [perf-summary.json](data/perf-summary.json), runs (not archived). The final warm/cold runs and unseen captures use frozen copies byte-identical to the final extension directory. The streaming replay preceded only the final estimate-column-width adjustment, which executes on scrollbar presses and is not exercised by the replay; its streaming/cache/settings code is identical. Seen/loading screenshot code is unchanged by that width correction.

## Tests

`node --test`:

```text
ℹ tests 84
ℹ suites 0
ℹ pass 84
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 282.983505
```

Full actual output: tests.txt (not archived).

`python3 scripts/check-version.py`:

```text
OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
```

Syntax checks for all new/changed runtime JavaScript and `git diff --check` pass without output. `git diff --exit-code HEAD -- CHANGELOG.md README.md README.zh-CN.md` passes without output; the manifest version remains alpha.10.

## Findings corrected during validation

- Chrome deduplicated `seek-core.js` when the same path was registered in both script worlds. The rail formatter now has its own isolated-world file; a manifest regression test covers that bootstrap rule. MAIN core/cache/seek APIs were then verified live.
- The prototype's very high preview layer covered the rail. Product preview uses z-index 19 under the existing z-index-20 rail.
- Reading KaTeX descendants for sizing forced layout inside skipped blocks, producing a failed 2590 ms first warm run. Reusing the already-recorded real block height removed that layout read. The recorder regression test throws if a math descendant is measured. Failed evidence remains in `runs/before-cache-layout-fix/` and the command logs.
- Screenshot comparison corrected clipped math placeholders, inherited accent-colored bubbles, and leading-newline Markdown headings. Whole display-math blocks now use the recorded outer block height with centered single-line TeX and all four rounded corners.
- The initial screenshot harness used virtual-time pausing and timed out the following held gesture; it now briefly defers frame callbacks only for loading screenshots. Its native input also selects the destination directly, since Chromium ignores a programmatic scroll during a held thumb drag.

## Deviations from the mockup

- Seek runs with Butter's main switch and adds no popup toggle, as explicitly requested. Kept here for the lead's decision.
- Unmeasured math cannot have a recorded height. Its display placeholders use the mockup's 38 px example until layout exists. Measured display blocks use their actual recorded height.
- Unmeasured answers use lightweight paragraphs, headings and math spans. Other Markdown remains plain text, following the prototype's lightweight fallback.
- The rail retains its existing minimum chat-column width of 560 px. At an 800 px browser width the capture harness collapses ChatGPT's sidebar; the extension does not alter sidebar preferences.
- Dark question bubbles use `#303030` with existing dark rail surfaces; the static mockup depicts light theme. Math and spinner colors follow the supplied explicit values.

## Git state

`git status --short`:

```text
 M docs/how-it-works.md
 M extension/butter-nav-main.js
 M extension/butter-nav.js
 M extension/butter-settings.js
 M extension/manifest.json
 M test/butter-nav.test.mjs
?? extension/butter-seek-meta.js
?? extension/height-cache.js
?? extension/seek-core.js
?? extension/seek-preview.js
?? test/cache-dom.test.js
?? test/cache-model.test.js
?? test/hit-activation.test.js
?? test/seek-settings.test.mjs
?? test/seek-ui.test.mjs
```

`git diff --stat` (new, untracked files are listed above and are not counted by this command):

```text
 docs/how-it-works.md         | 37 ++++++++++++++++++++++++++-----
 extension/butter-nav-main.js |  1 +
 extension/butter-nav.js      | 52 +++++++++++++++++++++++++++++++++++++++-----
 extension/butter-settings.js |  3 ++-
 extension/manifest.json      |  6 ++++-
 test/butter-nav.test.mjs     | 42 +++++++++++++++++++++++++++++++----
 6 files changed, 125 insertions(+), 16 deletions(-)
```

## Commands and restoration

Commands and actual output (not archived). Every lab phase acquired `lock.d` atomically, wrote its owner, and restored `LAB_EXTENSIONS=~/snap/chromium/common/butter-blank-head`, normal flags and `<chat>` before releasing its lock. The final restoration output is in the final phase log. Another lab task reacquired the shared lock after that restoration; this task made no further browser changes.

## Round 2

### What changed and why

**1. No real content outside the preview between release and fade.** The leak came from un-shifting the real turns at release (`translateX(-100000px)` removed) while the preview host covers only the area between the header inset and the composer inset. I chose to put an opacity mask on the shifted container. Keeping the shift was ruled out because readiness, `content-visibility` and ChatGPT's IntersectionObservers need the destination at its real horizontal position.

- On a committed release (`finish`), `mask(a)` sets `opacity: 0 !important` on the same container that was shifted, and then `restoreShift(a)` puts it back in place. The turns get their real layout immediately but paint nothing, so nothing shows behind the header or around the composer.
- `hide()` (the 120 ms fade start, and every cancel path) calls `restoreMask(revealOwner)`. The real content becomes visible in place under the fading preview. Nothing is moved, so there is no jump. A new drag also restores any leftover mask before it starts.
- Evidence: the loading-state facts report `allMasked: true`. The released-loading captures show no answer text beside "<prompt text>"/"Share" and no white or bordered box above the composer, in light or dark.

**2. Drag lighting uses the rail's normal rule.**
- `seek-core.previewLitQuestions(turns, scrollTop, height)` applies the rail's `ioBand` (HEADER 52 + EDGE 40 at the top, COMPOSER 140 + EDGE 40 at the bottom) to the preview model. It uses turn-element bounds, not row bounds. To make that possible, `height-cache.js` now records `turnOffset` and `turnH`, and `buildModel` exposes them as `litTop` and `litH`.
- `butter-seek-state` now carries `lit` (all lit ids), and `butter-nav.js` lights every tick in that set.
- The card names `previewCardQuestion`: the lit question that fills most of the band. Using the first lit question, as the earlier round-2 build did, still labeled the 1440 capture "Question 3": answer 3's tail is still in the band, so the normal rule correctly lights ticks 3 and 4, but the screen is question 4.
- The destination and preview rendering still use the turn at the top of the viewport (`previewQuestion`). Unseen previews show one question, so their card is that question.
- `docs/how-it-works.md` was updated to match.
- New unit tests are in `test/seek-ui.test.mjs`:
  - the band excludes a preceding tail and the composer strip;
  - turn bounds are used, not row bounds;
  - the card picks the dominant lit question.

### Screenshots (`(not archived)`, final build)
- 1440-light-released-loading.png (not archived), 1440-dark-released-loading.png (not archived), 800-light-released-loading.png (not archived), 800-dark-released-loading.png (not archived)
- 1440-light-seen-drag.png (not archived), 1440-dark-seen-drag.png (not archived), 800-light-seen-drag.png (not archived), 800-dark-seen-drag.png (not archived)
- 1440-light-unseen-drag.png (not archived)

Lit ticks during the drag vs. the rail after the swap to real content, at the same scroll position:

| Capture | Card | Drag ticks | Rail after swap |
|---|---|---|---|
| 1440 light / dark | Question 4 of 12 | [2, 3] | [2, 3] |
| 800 light / dark | Question 4 of 12 | [3] | [3] |
| 1440 unseen | Question 4 of 12 · not opened yet | card only (no lit set) | [3], the same question |

The tick indices are 0-based, so [2, 3] are questions 3 and 4.

### Performance (overlay scrollbar, final build unless noted)

| Run | Held mounts | Release to readable | Text-anchor error | Landing |
|---|---|---|---|---|
| Warm slow, final run | 0 | 1119.8 ms | 2 / 2 / 2 px | -1.75 px |
| Warm slow, repeats r1–r3 | 0 | 1184.9 / 1097.4 / 1063.1 ms | 2 px | -1.75 px |
| Warm slow, A/B final build ×3 | 0 | 1047.9 / 1049.1 / 1070.1 ms | 2 px | — |
| Warm slow, A/B **round-1 build** ×3 | 0 | 1080.0 / 1169.6 / 1143.3 ms | 2 px | — |
| Unseen (cold) fast | 0 | 4720 ms (no timeout) | estimate | 0 px, at the question bubble (offset -52 = header inset, `layout: false`) |

Warm release-to-readable is noisy in this lab session.
- The final build passes ≤ 1100 ms in 5 of 7 runs, with a median of 1070 ms.
- In an interleaved A/B, the unchanged round-1 build was slower: 1080, 1170 and 1143 ms, against 1048, 1049 and 1070 ms for the final build. The over-limit runs are therefore session noise, not a round-2 regression.
- Earlier round-2 builds measured 1161 and 1083 ms; their only difference is the card choice.
- Held mounts are 0 in every run, and the text-anchor error is 2 px in every warm run.

Raw data: `(not archived)` (`round2-final-*`, `ab-*`). Frozen builds: `(not archived)`.

### Tests
```
ℹ tests 88
ℹ suites 0
ℹ pass 88
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 211.470158
OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
```

### git status --short (`~/.t3/worktrees/butter/t3-6cf413cf`)
```
 M docs/how-it-works.md
 M extension/butter-nav-main.js
 M extension/butter-nav.js
 M extension/butter-settings.js
 M extension/manifest.json
 M test/butter-nav.test.mjs
?? extension/butter-seek-meta.js
?? extension/height-cache.js
?? extension/seek-core.js
?? extension/seek-preview.js
?? test/cache-dom.test.js
?? test/cache-model.test.js
?? test/hit-activation.test.js
?? test/seek-settings.test.mjs
?? test/seek-ui.test.mjs
```

### Lab notes
- A previous runner session ended mid-phase (an API 429) while it held the lab lock, which this task owned ("Butter seek product UI"). The lab was restored to blank-head, the normal flags and the standard tab, and only then was that lock removed.
- Every later phase went through `phase.sh`, which restores the lab and releases the lock on exit. After the last phase, the lock is absent and the tab is restored.
- No message was sent to ChatGPT.
