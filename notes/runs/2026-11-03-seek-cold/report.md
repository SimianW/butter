> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

> **Current package update, 2026-11-03:** the blank-preview fix is complete in `0.1.0-alpha.10+seekpreview.3`. See [fix report](data/blank-preview-fix.md), commands and actual output (not archived), and current package provenance (not archived). The report below is the historical `.2` research result. Its runtime JSON path now names the rerun `.3` smoke; the preserved `.2` smoke is `blank-before/package-runtime-smoke.json`.

# Cold seek experiment

**Verdict — Conditional:** semantic landing can preserve the previewed turn and a chosen text anchor across a cold mount. Persistent block geometry can reduce cold mount cost after reload. Neither guarantees a seamless whole-viewport swap; neighboring preview content can still move substantially. Structural estimates improve height prediction without controlling ChatGPT’s native scrollbar geometry. The guarded private-state probe declined at its exact-asset gate and made zero writes; it proves neither feasibility nor impossibility.

All experimental files and raw captures are under `(not archived)` (plus required Snap-readable lab copies). No commits or version bumps were made. The original v2 experiment is read-only. The workspace had pre-existing changes to `docs/how-it-works.md`, `extension/butter-nav.js`, `test/butter-nav.test.mjs`, and `mockups/`; they were not edited by this experiment.

## Measured cold matrix

**Verified:** headed Chromium on Linux, normal 1600 × 1000 lab window. Overlay has no layout gutter; classic reserves gutters. Each run uses a fresh document and frozen read-only history replay. A cold destination must be absent from `everBefore` and have `destinationKnown=false`. Storage-warm destinations remain document-cold. Writes are blocked at both fetch and routing; streaming sends are local Response replays.

Arms: **v2** is the unmodified F v2 build; **estimate** changes only unseen-height weights using Markdown structure and Canvas font widths, calibrated from already measured rows; **semantic** corrects the selected excerpt after mount; **stored** combines persistent block geometry, stored height weights and semantic landing. No private virtualizer state is written by any measured arm; the separate guarded probe also made zero writes.

Times are milliseconds. Cells show median [minimum–maximum]; held max and release max task are the worst run in the cell. Preview latency is captured-screen input p95 (v2 stamp method). Frames completely inside the physical hold interval are used; a frame crossing release remains separately in JSON. Landing uses the original frozen pixel model consistently across arms. The matrix used the legacy anchor audit: its first regex match was not guaranteed to lie inside the clipped preview. The legacy-anchor column is therefore a numerical text-alignment result, not proof of visible-excerpt continuity. Other sampled preview blocks still shift by thousands of pixels. The final build selects only visible needles; its separate runtime trials are listed below.

| Arm | Bars | Drag | n | Held mounts | Held frame p95 / max | Preview p95 | Release readable | Release max task | Pixel-model landing px | Legacy anchor px | Legacy all-anchor max px | Preview turn on screen |
|---|---|---|---:|---|---|---|---|---|---|---|---|---|
| v2 | classic | slow | 3 | 0 | 17 / 600 | 67 [66–67] | 3420 [3234–3873] | 3217 | -28872 [-28872–-28868] | 3339 [2370–3339] | 3339 | 0/3 audited |
| v2 | classic | fast | 3 | 0 | 17 [17–33] / 600 | 69 [65–655] | 3322 [3151–7365] | 3337 | -28872 [-28872–1] | 3339 [3339–26399] | 26399 | 1/3 audited |
| v2 | overlay | slow | 3 | 0 | 17 / 633 | 65 [65–67] | 3463 [3332–3646] | 2958 | -28872 [-28872–-28868] | 3598 [2442–3750] | 3750 | 0/2 audited; 1 missing |
| v2 | overlay | fast | 3 | 0 | 17 / 183 | 69 [64–70] | 3180 [3169–3368] | 2760 | -28872 | 3598 | 3598 | 0/3 audited |
| estimate | classic | slow | 3 | 0 | 17 / 633 | 66 [66–67] | 3324 [3208–3846] | 3193 | -28866 | 3105 [2318–3105] | 3105 | 0/3 audited |
| estimate | classic | fast | 3 | 0 | 17 [17–33] / 233 | 69 [68–70] | 3201 [3094–3249] | 2712 | -28866 | 3338 [3105–3338] | 3338 | 0/3 audited |
| estimate | overlay | slow | 3 | 0 | 17 / 567 | 66 [66–79] | 3369 [3332–3694] | 3010 | -28866 | 3338 [2443–3338] | 3338 | 0/3 audited |
| estimate | overlay | fast | 3 | 0 | 17 / 167 | 68 [65–69] | 3088 [3083–3249] | 2670 | -28866 | 3338 | 3338 | 0/3 audited |
| semantic | classic | slow | 3 | 0 | 17 / 200 | 66 [65–66] | 3348 [3306–3395] | 2737 | -25533 [-25533–-25277] | 0 | 3595 | 3/3 audited |
| semantic | classic | fast | 3 | 0 | 33 [17–33] / 600 | 216 [73–617] | 3382 [3001–7390] | 3428 | -25533 [-26398–-25533] | 0 | 3339 | 3/3 audited |
| semantic | overlay | slow | 3 | 0 | 17 / 217 | 66 | 3495 [3354–3496] | 2835 | -25274 [-25274–-25122] | 0 | 3750 | 3/3 audited |
| semantic | overlay | fast | 3 | 0 | 17 / 600 | 72 [66–621] | 3326 [3240–3754] | 2996 | -25274 [-26274–-25274] | 0 | 3598 | 3/3 audited |
| stored | classic | slow | 3 | 0 | 17 / 133 | 65 [65–67] | 1470 [1426–3239] | 2605 | -25604 [-25604–-25533] | 0 | 3339 | 3/3 audited |
| stored | classic | fast | 3 | 0 | 17 / 117 | 67 [65–70] | 1481 [1432–1550] | 1028 | -25604 [-25604–-25449] | 0 | 3438 | 3/3 audited |
| stored | overlay | slow | 3 | 0 | 17 / 500 | 65 [64–66] | 1540 [1478–1542] | 930 | -25273 [-26273–-25273] | 0 | 3598 | 3/3 audited |
| stored | overlay | fast | 3 | 0 | 17 / 150 | 67 [66–69] | 1596 [1571–1617] | 1007 | -25273 [-25273–-25147] | 0 | 3724 | 3/3 audited |

**Verified:** 48 matrix runs reduced; 48/48 satisfy the document-cold destination checks. Missing cells or failed checks remain visible; they are not silently relabeled. Raw `everBefore`, `beforeFiber`, native presses, frame/task/mount records, source build snapshot, screen audit and preview dump are in `runs/<name>.json`. Smokes are separate from the matrix.

## Warm subset

| Arm | Bars / drag | n | Release readable ms | Anchor max px | Held mounts | Known destinations | Releases at most 1100 ms |
|---|---|---:|---|---|---|---|---|
| v2 | classic / fast | 3 | 1066 [868–1350] | 2 | 0 | 3/3 | 2/3 |
| v2 | overlay / slow | 3 | 1010 [1004–1023] | 2 | 0 | 3/3 | 3/3 |
| stored | classic / fast | 3 | 949 [912–1327] | 2 | 0 | 3/3 | 2/3 |
| stored | overlay / slow | 3 | 987 [967–1037] | 2 | 0 | 3/3 | 3/3 |

**Verified warm geometry; latency target not universally met:** all 12 warm destinations are known, all have zero held mounts and 2 px anchor error. v2 classic fast r3 takes 1,349.9 ms, and stored classic fast r1 takes 1,326.5 ms, exceeding 1,100 ms. Every other release passes. Stored preserves the warm path in this subset; three samples per cell do not establish equivalence or a universal latency bound.

## Geometry persistence and stale data

**Verified:** after reload, 12 persistent row records were found, while only 5 rows had mounted in that document. Stored payload: 2,347,780 UTF-8 JSON bytes per long chat, excluding IndexedDB page/index overhead. This prototype repeats typography per item; dictionary encoding could reduce size.

**Verified:** an edited-content/regeneration fixture was rejected (`editedTurnAccepted=False`), and a live width change accepted 0 entries. Unit tests independently change conversation/turn/message/content digest/layout identity, expiry, and geometry validity.

Storage keys include conversation and question ids, final assistant message id, SHA-256 of question/answer/message identities, scroller and window width, device pixel ratio, font, column width, theme class and the script-tag asset URL signature (not a comprehensive fingerprint of every dynamically imported module). Records have a 30-day TTL and the store is bounded to 64 rows globally. Media is unsupported by the measured fixture; dynamic image dimensions and UI expansion states remain a productization risk. Geometry restoration also requires same live assistant id, complete/typeset content, widths and block count.

**Verified:** only numeric heights, item tops/widths, typography, source-block indexes, ids and identity hashes are serialized. Source/preview strings stay in memory. Hydration reconstructs preview strings from current conversation JSON; unknown reconstructions veto the stored layout rather than displaying fabricated text. The source parser reconstructed 5932/5964 items exactly in the collected fixture; the remaining items still supply block sizes but veto full preview layout for that row. See `stored-geometry-rows.json` and `estimate-results.json`.

**Conditional:** persisted sizes make restoration faster without making the native thumb geometrically warm. ChatGPT still initializes its unseen rows with its own estimates. Saved heights are used as relative weights inside that frozen native range, then semantic landing supplies destination identity. A cache hit does not claim a matching native scrollHeight. IndexedDB lives under the site origin in this experiment; production should use extension-owned storage with cache clearing, quota handling and account partitioning.

## Structural height estimates

**Verified:** Uncalibrated approximate-font absolute relative error over 12 measured rows: median 3.75%, p95/max 6.71%. These offline estimates use the measured column size and a pure approximate glyph-width function; the live estimate arm uses Canvas font widths. Calibration excludes the row being scored.
**Verified:** Leave-one-out calibrated approximate-font absolute relative error over 12 measured rows: median 1.50%, p95/max 3.65%. These offline estimates use the measured column size and a pure approximate glyph-width function; the live estimate arm uses Canvas font widths. Calibration excludes the row being scored.

| Row | Actual px | Raw estimate px | Raw error % | Leave-one-out calibrated error % |
|---:|---:|---:|---:|---:|
| 1 | 33919 | 35876 | 5.77 | 1.99 |
| 2 | 39282 | 41310 | 5.16 | 1.40 |
| 3 | 24731 | 25641 | 3.68 | -0.11 |
| 4 | 32492 | 33214 | 2.22 | -1.51 |
| 5 | 34597 | 35909 | 3.79 | 0.08 |
| 6 | 26054 | 27020 | 3.71 | -0.08 |
| 7 | 29163 | 31070 | 6.54 | 2.73 |
| 8 | 34868 | 37208 | 6.71 | 2.90 |
| 9 | 36855 | 38089 | 3.35 | -0.43 |
| 10 | 5494 | 5783 | 5.26 | 1.50 |
| 11 | 14895 | 15209 | 2.11 | -1.62 |
| 12 | 208 | 208 | 0.00 | -3.65 |

**Verified:** live Canvas-font raw estimates, column 768 px, same 12 rows: median absolute relative error 3.79%, p95/max 6.79%. Live calibration factor in this cold run is 0.9740, fitted only to already measured initial rows. Full numeric Canvas estimates are retained in the raw session's `estimateAudit`. The optional second-chat check is reported below; actual code/image-heavy chats, other widths and Mac behavior remain Unverified. Unit fixtures cover parser branches.

**Conditional:** good total row predictions cannot promise native landing. Both virtualizers need the same row layout for that; Butter only controls its preview model. Block/source offsets and line wrapping inside an unseen answer can still differ even with a small total-height error.

## Private virtualizer geometry injection

**Verified source read, feasibility unverified:** captured source `runs/virtualizer-source.js`, module `if6d`, function `C`, keeps measured heights in React state and a mutable ref. A layout effect can revert a state-only write. `src/inject-probe.js` gates a coupled ref-plus-dispatch proposal on exact asset URL, source SHA, 85 hooks, props, queue and ref identity. The actual browser probe returned `why=asset`, `writes=0`, with the expected source SHA. Native height, mounted turns and ever-mounted set were unchanged. This is a fail-closed refusal, not evidence that an admitted private write works or is impossible. No fifth drag arm was measured, and the probe is excluded from every extension build and zip.

## Streaming vs control

| Arm | n | Replay duration ms | Wall ms | LoAF blocking ms | Chunks | Final answer hash |
|---|---:|---|---|---|---|---|
| control | 3 | 121771 | 124990 [124888–125019] | 5409 [5303–5597] | 189,189,189 | 043dc8afaf8d |
| stored | 3 | 121771 | 125020 [124870–125042] | 4324 [4139–4402] | 189,189,189 | 043dc8afaf8d |

**Verified replay correctness; no added stream-completion stall observed:** every run delivered 189/189 chunks, 21,448 answer characters, 420 KaTeX nodes and the same recorded hash `043dc8afaf8d` (the harness stores the first 48 bits of SHA-256). Replay durations span 121,770.8–121,771.2 ms. Paired stored-minus-control wall deltas are +23, -18 and +30 ms; all include the fixed three-second post-stream wait. This small single-fixture sample supports unchanged completion, not statistical equivalence. Literal stall-free UI is not demonstrated: control worst LoAF durations are 606/665/598 ms and stored 639/624/613 ms. LoAF blocking totals are reported separately; they improve in this sample but neither arm eliminates freezes. No real message was sent.

## Recommendation and risks

**Recommendation: merge the semantic arm first, including the validated question-bubble fallback and visible-anchor guard.** It repairs destination identity without persistent-cache ownership, quota and stale-data costs. The matrix timing benefit belongs to stored geometry, but the visible-anchor/fallback patch arrived after that matrix, and the prototype cache still lives in the site origin. Keep the stored arm in this Mac trial for validation; follow with a separate product change using extension-owned, account-partitioned storage, explicit clear/quota handling and the measured invalidation gates. Do not merge the estimate-only arm as a landing fix or ship the private writer.

The semantic-first merge costs a post-mount correction (at most three passes), sometimes an explicit jump to the selected question start when there is no visible matching text, and substantial synchronous cold mounting. Legacy matched-target runs had a median of about 3.4 seconds; the final forced-fallback trial took about 6.0 seconds. It adds no persistent geometry storage. Adopting stored later costs about 2.35 MB serialized geometry per long chat/layout, potentially several layouts at once (the fixture observed 9.39 MB across 48 entries), a 30-day TTL and 64-row global limit, and invalidation on content/message/layout mismatch or mutation start. Source and geometry must stay disabled until current history returns; pre-mutation GET responses and asynchronous hash completions must not reinstall stale state. Disk records are rejected, not immediately all deleted, on mutation.

Preserving one text anchor cannot preserve every visible block when unseen rows expand. The chosen cold excerpt may align while a neighboring turn moves thousands of pixels. Retargeting can trigger an additional application commit, and the initial cold mount remains synchronous. Repeated/ambiguous text, Markdown reconstruction, inserted history, media, changed fonts, collapsed content and regenerated branches require broader validation. Mac native events and behavior remain Unverified; the lab uses Linux native overlay bars.


## Preserved failures and late-source provenance

- v2: 12 strict cold runs; release median 3350 [3151–7365] ms; held mounts 0; no outliers removed.
- estimate: 12 strict cold runs; release median 3249 [3083–3846] ms; held mounts 0; no outliers removed.
- semantic: 12 strict cold runs; release median 3368 [3001–7390] ms; held mounts 0; no outliers removed.
- stored: 12 strict cold runs; release median 1541 [1426–3239] ms; held mounts 0; no outliers removed.

The 7,365 ms v2 classic fast r3 and 7,390 ms semantic classic fast r3 remain in their cells. The former has only about 1 px frozen pixel-model error but 26,399 px text-anchor error; a small pixel-model number is not a text-identity success. Stored classic slow r1 takes 3,239 ms and reports `destination.stored=false`; a cache miss is retained, not relabeled as a cache-hit sample. The first baseline, `v2-overlay-cold-slow-r1`, has no `screenAudit`: the cell reports two audited runs and one missing audit, not a fabricated third failure or a zero error.

The completed matrix is not a randomized, single-build product qualification. Each arm/mode ran in sequence; exact frozen source is under `builds-used/`. Stored overlay used the earlier source; stored classic, warm and streams include the later mutation/epoch hardening. Matched-text results do not exercise mutation branches. After the matrix, `visible-audit.js` and visible-needle selection were added; the clipped-preview audit (`clipping-check.json`) shows that many earlier regex matches can fall outside the estimated row’s visible clip. Legacy zero anchor error therefore does not prove that an on-screen preview excerpt survived. The final question-bubble fallback fix was made during this continuation. None of these new-source trials replaces a matrix sample.

The navigation wrapper invalidates before any conversation POST, including edit/regeneration without a new user message, rejects pre-mutation GET completions, and the store rejects stale asynchronous digest completions. VM tests use mocked fetch only. Browser invalidation dispatches a local event; no mutation API request or real send is needed.

| Retained trial | Semantic result | Error px | Correct turn at upper point | Readable ms |
|---|---|---:|---|---:|
| stored-overlay-fixture-fallback-invalidation | FAILED fallback | missing | False | 1221.3 |
| semantic-overlay-fixture-fallback | FAILED fallback | missing | False | 3322.0 |
| semantic-overlay-fixture-fallback-fixed | question fallback | 0 | True | 6002.3 |
| stored-overlay-package-runtime-smoke | question fallback | 0 | True | 1934.7 |

The two original missing-anchor failures are retained. The old user selector did not exist in the observed ChatGPT DOM (`runs/dom-shape.json`). The corrected build prefers `[data-user-message-bubble]` and keeps the old selector as a compatibility fallback. The browser harness now asserts fallback activation, correct upper-point turn, error at most 4 px and no timeout. The fixed forced trial passes at 0 px but takes about 6.0 seconds and moves other sampled visible layout anchors about 29,130 px: forcing an answer excerpt to the question start intentionally gives up the earlier excerpt position. The normal package smoke, without FORCE_NO_ANCHOR, also found no visible needle, took the same question-start fallback, and showed the same 29,130 px neighboring-anchor displacement. These final-build outcomes are additional evidence, not hidden behind the matrix’s roughly 3,600 px neighboring-anchor shifts. The guide describes this fallback; no whole-viewport seamless claim is justified.

Local invalidation fixture: usable stored records 12 → 0, adopted in-document cache entries after invalidation 0. Physical IndexedDB entries remain until rejection/pruning/explicit cleanup; the final audit deletes the database.
Guarded native probe actual result: `{"why": "asset", "writes": 0, "sha": "7ec155806a9695e2edcc3efb907201053b23cd873b6592dd629b747e59a648c5"}`. It left native scroll height and the five ever-mounted turns unchanged. The absent pinned asset resource entry does not establish that the React mutation would fail if the gate passed.

## Optional second-chat estimate check

Read-only live traversal collected 7 measured rows at column width 768 px. Canvas raw absolute relative error: median 7.02%, maximum 11.41%; leave-one-out calibration: median 1.85%, maximum 5.86%. This is a geometry/model check, not an additional cold drag or stream sample. Rows and errors, including outliers, are in `runs/other-estimates.json`. It does not qualify arbitrary media or code-heavy chats.

## Mac trial package

Version name `0.1.0-alpha.10+seekpreview.2`, unchanged numeric version `0.1.0.10`; 81,871 bytes. SHA-256: `00521a3dfb260afdf06f3f128bfc41ef9b6de76c6f0f67fcf6a943c7cace0cb3`. Source is final `extension-stored`; only `extension-test/` and the Chinese guide are zipped. The package excludes the lab-only native writer, raw chat data and captures. Declared manifest/popup paths and frozen runtime file hashes are checked by `verify-package.py`.

Runtime smoke: `{"passed": true, "run": "stored-overlay-package-runtime-smoke", "buildPath": "(not archived)", "sourceFilesMatchZip": true, "heldMounts": 0, "destinationKnown": false, "destinationStored": true, "semantic": {"attempts": 1, "matched": false, "fallback": true, "clamped": false, "lastError": 0, "anchorVisible": false, "previewY": 52}, "screenTurnMatches": true, "releaseReadableMs": 1934.7000977993011, "allVisibleAnchorMaxPx": 29130, "declaredPathsChecked": 22, "platform": "Linux headed Chromium; Mac trial itself unverified"}`. This validates the actual unpacked zip content on Linux Chromium; native macOS scrollbar behavior remains unverified. The Chinese guide explains mutation-start invalidation, old-GET/async-digest epoch rejection, revalidation only after current history, and retained rejected disk records.

Final protocol audit: `protocolPassed=True`; lock absent `True`, normal flags `True`, experimental IDB remaining `False`. See `final-state.json` for independent state and build/artifact verification.

## Integrity, tests and artifacts

**Verified:** final read-only server audit: {"added": [{"id": "<id>", "created": 1793672618.018, "createdUTC": "2026-11-03T02:23:38.018Z", "chars": 2, "isReplayBenchmark": false, "isOurRecordedInput": false, "sha256": "<content digest>", "parent": "<id>", "children": 1, "metadataKeys": ["request_id", "message_source", "turn_exchange_id", "working_turn_id", "can_save"]}], "currentNode": "<id>", "totalUserMessages": 13}. The legitimate user-created two-character `<prompt text>` at 2026-11-03T02:23:38.018Z (2026-11-02 21:23 EST) predates this experiment and is explicitly allowed. New nodes relative to this experiment’s fresh baseline are assessed in `server-integrity.json`.
Fresh-baseline comparison: `{"beforeUserMessages": 13, "afterUserMessages": 13, "addedUserIds": [], "removedUserIds": [], "sameCurrentNode": true, "addedNodeIds": [], "removedNodeIds": [], "sameConversation": true}`.

Unit verification: `node --test` from the `test/` directory; actual output in `logs/unit-tests.txt` and `commands-and-output.md`. Lab phases restore blank-head, normal flags, original conversation and an empty composer before releasing the shared lock. Final independent restoration/lock/source-integrity checks are recorded in `final-state.json`.

- Commands and actual output (not archived)
- [Machine-readable results](data/results.json)
- Sources (not archived)
- Tests (not archived)
- Cold slow overlay side-by-side video (not archived)
- Mac trial zip (not archived)
- Mac Chinese instructions (not archived)
- Plots: PNG (not archived) / SVG (not archived)
- Video contact sheet (not archived)
- Video provenance (not archived)
- Package provenance and runtime smoke (not archived)
- Source provenance (not archived)
- Final state (not archived)

Raw account/chat captures remain under `/tmp`; none were published.

## Final recommendation

Merge semantic first, with the visible-anchor guard and corrected question-start fallback. Keep stored as the trial optimization until extension-owned/account-partitioned storage, quota/clear handling and broader invalidation validation are ready. Its measured speed benefit is real for this fixture; whole-viewport continuity, Mac behavior and statistical performance equivalence remain unproven.
