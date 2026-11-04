> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Stored seek preview product merge

Worktree: `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`. Uncommitted; repo version remains `0.1.0-alpha.10` / `0.1.0.10`.

## Results at handoff

Release matrix: 72/72 runs. Tall-fixture sweeps: 16/16. Comparative stream replays: 17 under the explicitly reduced 17-run plan (originally 48). Both mandatory control/product cells require three repetitions per arm. Every completed final release has 0 held mounts and 0 sampled empty frames across 34159 held samples.

Warm target misses: 17/24. No miss is discarded. Stored and warm semantic selected-anchor errors remain subpixel; whole-viewport text anchors can still shift and are reported for every run below. The 120 ms fade begins after the readable gate.

Performance chart: release-to-readable.png (not archived). The full results and every preserved failure follow. Final cleanup and package verification are recorded in `final-state.json` and `provenance.json`.

## Implementation

Ported reviewed persistent geometry, queue-time identity capture (S1), adopted-record validation (S2), warm preparation without fetched source (S3), visible semantic landing and the capped-text blank-preview fallback into the approved product UI. No estimate arm, private virtualizer writes, inject-probe, popup toggle, source-text persistence or text-dumping diagnostics. The native virtualizer is read only.

S5 uses a layout fingerprint refreshed outside the clientWidth hook. Resize, scroller size, font lifecycle, root class/style and current data-theme/data-appearance-theme changes invalidate it without layout reads. The hook checks cached identity, layout stamp and TTL before installing CSS intrinsic sizes. The S5 real-module regression fails on the reviewed trial (2 premature native width reads), passes on this build (0), and verifies fail-closed font/resize invalidation.

Stored geometry supplies weights within the native estimated scroll extent. A separate full-height preview coordinate system prevents stored blocks from overlapping neighboring native estimated rows. The selected row maps to the same question in both coordinate systems. Known/stored layout pins a fully visible semantic excerpt, with bounded question-bubble fallback; truly unknown rows retain the approved start-of-question preview, unseen label and start landing.

## Commands and checks

Full actual commands and output: commands-and-output.md (not archived), logs (not archived). Early red/failed attempts are preserved in the named logs and `runs/pilots/` / `runs/superseded-native-spans/`; none are silently replaced as successful runs. The final source passed all 110 tests, version consistency and git diff whitespace checks. See `logs/unit-final-source.log`, `s5-trial-final.log`, `nested-text-red.log`, `render-red.log` and `geometry-red.log`.

## Release matrix — every run

Linux headed Chromium, 1000 px viewport height; native classic or zero-gutter OverlayScrollbar input. Each cell has three cold, three stored-after-reload and three warm releases. Overlay uses a 12 s slow drag; classic uses a 1.2 s fast drag. History responses are local read-only replay; cold runs clear geometry first, stored runs seed at the matching width/theme then reload, and warm runs require all twelve document layouts. The target is selected from the frozen product model, without native virtualizer writes.

Release-to-readable is the destination/math-ready, three-quiet-frame gate measured from the native pointerup event; the specified 120 ms fade begins at that gate. The anchor column is the signed semantic-excerpt error, or question-bubble error for truly unknown questions. All visible anchor errors are reported separately; one correct excerpt cannot promise whole-viewport continuity. Held preview frames are sampled by rAF; zero sampled empty frames is not a claim about unsampled compositor frames.

| Width | Theme | Bar | State | Readable ms, r1 / r2 / r3 | Anchor px, r1 / r2 / r3 | Held mounts | Empty / held frames |
|---|---|---|---|---|---|---|---|
| 1440 | light | classic | cold | 3975.9 / 4089.7 / 3940.1 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/125 / 0/118 / 0/118 |
| 1440 | light | classic | stored | 1535.4 / 1548.7 / 1925.6 | 0.266 / -0.484 / -0.484 | 0 / 0 / 0 | 0/124 / 0/117 / 0/119 |
| 1440 | light | classic | warm | 1102.0 / 1058.2 / 1087.9 | 0.141 / 0.141 / 0.141 | 0 / 0 / 0 | 0/123 / 0/118 / 0/119 |
| 1440 | light | overlay | cold | 4227.7 / 4016.7 / 4274.7 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/833 / 0/831 / 0/827 |
| 1440 | light | overlay | stored | 1704.6 / 1666.4 / 1709.2 | -0.375 / -0.375 / -0.375 | 0 / 0 / 0 | 0/829 / 0/830 / 0/823 |
| 1440 | light | overlay | warm | 1250.8 / 1270.9 / 1218.0 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/832 / 0/830 / 0/833 |
| 1440 | dark | classic | cold | 3971.3 / 4055.1 / 4290.2 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/126 / 0/119 / 0/118 |
| 1440 | dark | classic | stored | 1550.1 / 1538.7 / 1539.9 | -0.484 / -0.484 / -0.484 | 0 / 0 / 0 | 0/123 / 0/121 / 0/118 |
| 1440 | dark | classic | warm | 1097.0 / 1310.4 / 1072.4 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/122 / 0/119 / 0/118 |
| 1440 | dark | overlay | cold | 4232.0 / 4241.7 / 4207.8 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/828 / 0/828 / 0/824 |
| 1440 | dark | overlay | stored | 1535.5 / 1739.1 / 1698.0 | -0.375 / -0.375 / -0.375 | 0 / 0 / 0 | 0/834 / 0/828 / 0/828 |
| 1440 | dark | overlay | warm | 1275.4 / 1245.5 / 1160.6 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/830 / 0/832 / 0/833 |
| 800 | light | classic | cold | 3885.1 / 3867.5 / 3837.6 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/129 / 0/117 / 0/118 |
| 800 | light | classic | stored | 1341.5 / 1512.5 / 1636.0 | 0.109 / -0.281 / 0.109 | 0 / 0 / 0 | 0/126 / 0/118 / 0/119 |
| 800 | light | classic | warm | 1094.2 / 1172.0 / 1134.8 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/121 / 0/118 / 0/120 |
| 800 | light | overlay | cold | 4319.1 / 4350.6 / 4244.2 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/832 / 0/823 / 0/826 |
| 800 | light | overlay | stored | 1768.0 / 1805.6 / 1392.6 | 0.156 / 0.156 / -0.016 | 0 / 0 / 0 | 0/831 / 0/827 / 0/829 |
| 800 | light | overlay | warm | 1070.1 / 1283.3 / 1267.3 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/832 / 0/828 / 0/830 |
| 800 | dark | classic | cold | 3956.4 / 3904.6 / 3909.2 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/125 / 0/123 / 0/120 |
| 800 | dark | classic | stored | 1432.9 / 1339.0 / 1623.6 | 0.109 / 0.109 / 0.109 | 0 / 0 / 0 | 0/124 / 0/119 / 0/118 |
| 800 | dark | classic | warm | 1113.0 / 1084.9 / 1104.1 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/122 / 0/118 / 0/119 |
| 800 | dark | overlay | cold | 4248.5 / 4292.3 / 4075.4 | 0.000 / 0.000 / 0.000 | 0 / 0 / 0 | 0/805 / 0/826 / 0/830 |
| 800 | dark | overlay | stored | 1467.5 / 1779.4 / 1687.8 | 0.156 / 0.156 / 0.156 | 0 / 0 / 0 | 0/823 / 0/825 / 0/827 |
| 800 | dark | overlay | warm | 1269.1 / 1249.0 / 1195.2 | 0.141 / 0.141 / 0.141 | 0 / 0 / 0 | 0/826 / 0/834 / 0/833 |

Warm target: at most 1100 ms. Every miss:

- `1440-dark-classic-warm-r2`: 1310.4 ms.
- `1440-dark-overlay-warm-r1`: 1275.4 ms.
- `1440-dark-overlay-warm-r2`: 1245.5 ms.
- `1440-dark-overlay-warm-r3`: 1160.6 ms.
- `1440-light-classic-warm-r1`: 1102.0 ms.
- `1440-light-overlay-warm-r1`: 1250.8 ms.
- `1440-light-overlay-warm-r2`: 1270.9 ms.
- `1440-light-overlay-warm-r3`: 1218.0 ms.
- `800-dark-classic-warm-r1`: 1113.0 ms.
- `800-dark-classic-warm-r3`: 1104.1 ms.
- `800-dark-overlay-warm-r1`: 1269.1 ms.
- `800-dark-overlay-warm-r2`: 1249.0 ms.
- `800-dark-overlay-warm-r3`: 1195.2 ms.
- `800-light-classic-warm-r2`: 1172.0 ms.
- `800-light-classic-warm-r3`: 1134.8 ms.
- `800-light-overlay-warm-r2`: 1283.3 ms.
- `800-light-overlay-warm-r3`: 1267.3 ms.

## All visible anchors — every run

| Run | Selected anchor px | Maximum absolute visible text-anchor error px | Visible anchors | Timed out |
|---|---|---|---|---|
| 1440-dark-classic-cold-r1 | 0.000 | 13 | 3 | False |
| 1440-dark-classic-cold-r2 | 0.000 | 13 | 3 | False |
| 1440-dark-classic-cold-r3 | 0.000 | 13 | 3 | False |
| 1440-dark-classic-stored-r1 | -0.484 | 0 | 1 | False |
| 1440-dark-classic-stored-r2 | -0.484 | 0 | 1 | False |
| 1440-dark-classic-stored-r3 | -0.484 | 0 | 1 | False |
| 1440-dark-classic-warm-r1 | 0.156 | 0 | 3 | False |
| 1440-dark-classic-warm-r2 | 0.156 | 0 | 3 | False |
| 1440-dark-classic-warm-r3 | 0.156 | 0 | 3 | False |
| 1440-dark-overlay-cold-r1 | 0.000 | 13 | 3 | False |
| 1440-dark-overlay-cold-r2 | 0.000 | 13 | 3 | False |
| 1440-dark-overlay-cold-r3 | 0.000 | 13 | 3 | False |
| 1440-dark-overlay-stored-r1 | -0.375 | 0 | 1 | False |
| 1440-dark-overlay-stored-r2 | -0.375 | 0 | 1 | False |
| 1440-dark-overlay-stored-r3 | -0.375 | 0 | 1 | False |
| 1440-dark-overlay-warm-r1 | 0.156 | 0 | 3 | False |
| 1440-dark-overlay-warm-r2 | 0.156 | 0 | 3 | False |
| 1440-dark-overlay-warm-r3 | 0.156 | 0 | 3 | False |
| 1440-light-classic-cold-r1 | 0.000 | 13 | 3 | False |
| 1440-light-classic-cold-r2 | 0.000 | 13 | 3 | False |
| 1440-light-classic-cold-r3 | 0.000 | 13 | 3 | False |
| 1440-light-classic-stored-r1 | 0.266 | 0 | 1 | False |
| 1440-light-classic-stored-r2 | -0.484 | 0 | 1 | False |
| 1440-light-classic-stored-r3 | -0.484 | 0 | 1 | False |
| 1440-light-classic-warm-r1 | 0.141 | 0 | 3 | False |
| 1440-light-classic-warm-r2 | 0.141 | 0 | 3 | False |
| 1440-light-classic-warm-r3 | 0.141 | 0 | 3 | False |
| 1440-light-overlay-cold-r1 | 0.000 | 13 | 3 | False |
| 1440-light-overlay-cold-r2 | 0.000 | 13 | 3 | False |
| 1440-light-overlay-cold-r3 | 0.000 | 13 | 3 | False |
| 1440-light-overlay-stored-r1 | -0.375 | 0 | 1 | False |
| 1440-light-overlay-stored-r2 | -0.375 | 0 | 1 | False |
| 1440-light-overlay-stored-r3 | -0.375 | 0 | 1 | False |
| 1440-light-overlay-warm-r1 | 0.156 | 0 | 3 | False |
| 1440-light-overlay-warm-r2 | 0.156 | 0 | 3 | False |
| 1440-light-overlay-warm-r3 | 0.156 | 0 | 3 | False |
| 800-dark-classic-cold-r1 | 0.000 | 14 | 3 | False |
| 800-dark-classic-cold-r2 | 0.000 | 14 | 3 | False |
| 800-dark-classic-cold-r3 | 0.000 | 14 | 3 | False |
| 800-dark-classic-stored-r1 | 0.109 | 0 | 1 | False |
| 800-dark-classic-stored-r2 | 0.109 | 0 | 1 | False |
| 800-dark-classic-stored-r3 | 0.109 | 0 | 1 | False |
| 800-dark-classic-warm-r1 | 0.156 | 0 | 3 | False |
| 800-dark-classic-warm-r2 | 0.156 | 0 | 3 | False |
| 800-dark-classic-warm-r3 | 0.156 | 0 | 3 | False |
| 800-dark-overlay-cold-r1 | 0.000 | 14 | 3 | False |
| 800-dark-overlay-cold-r2 | 0.000 | 14 | 3 | False |
| 800-dark-overlay-cold-r3 | 0.000 | 14 | 3 | False |
| 800-dark-overlay-stored-r1 | 0.156 | 0 | 1 | False |
| 800-dark-overlay-stored-r2 | 0.156 | 0 | 1 | False |
| 800-dark-overlay-stored-r3 | 0.156 | 0 | 1 | False |
| 800-dark-overlay-warm-r1 | 0.141 | 0 | 3 | False |
| 800-dark-overlay-warm-r2 | 0.141 | 0 | 3 | False |
| 800-dark-overlay-warm-r3 | 0.141 | 0 | 3 | False |
| 800-light-classic-cold-r1 | 0.000 | 14 | 3 | False |
| 800-light-classic-cold-r2 | 0.000 | 14 | 3 | False |
| 800-light-classic-cold-r3 | 0.000 | 14 | 3 | False |
| 800-light-classic-stored-r1 | 0.109 | 0 | 1 | False |
| 800-light-classic-stored-r2 | -0.281 | 0 | 1 | False |
| 800-light-classic-stored-r3 | 0.109 | 0 | 1 | False |
| 800-light-classic-warm-r1 | 0.156 | 0 | 3 | False |
| 800-light-classic-warm-r2 | 0.156 | 0 | 3 | False |
| 800-light-classic-warm-r3 | 0.156 | 0 | 3 | False |
| 800-light-overlay-cold-r1 | 0.000 | 14 | 3 | False |
| 800-light-overlay-cold-r2 | 0.000 | 14 | 3 | False |
| 800-light-overlay-cold-r3 | 0.000 | 14 | 3 | False |
| 800-light-overlay-stored-r1 | 0.156 | 0 | 1 | False |
| 800-light-overlay-stored-r2 | 0.156 | 0 | 1 | False |
| 800-light-overlay-stored-r3 | -0.016 | 0 | 1 | False |
| 800-light-overlay-warm-r1 | 0.156 | 0 | 3 | False |
| 800-light-overlay-warm-r2 | 0.156 | 0 | 3 | False |
| 800-light-overlay-warm-r3 | 0.156 | 0 | 3 | False |

## Tall capped-block fixture

Local replay of `harness/blank-preview.mjs`: seven questions, unloaded earlier history, question 5 replaced locally with a 900-line answer. No send or API write. Both cold and warm sweeps include near-bottom offsets beyond the 4000-character lean prefix.

| Run | Held frames | Empty frames | Held mounts |
|---|---:|---:|---:|
| blank-1440-dark-classic-w0 | 129 | 0 | 0 |
| blank-1440-dark-classic-w1 | 129 | 0 | 0 |
| blank-1440-dark-overlay-w0 | 129 | 0 | 0 |
| blank-1440-dark-overlay-w1 | 129 | 0 | 0 |
| blank-1440-light-classic-w0 | 129 | 0 | 0 |
| blank-1440-light-classic-w1 | 129 | 0 | 0 |
| blank-1440-light-overlay-w0 | 129 | 0 | 0 |
| blank-1440-light-overlay-w1 | 129 | 0 | 0 |
| blank-800-dark-classic-w0 | 129 | 0 | 0 |
| blank-800-dark-classic-w1 | 129 | 0 | 0 |
| blank-800-dark-overlay-w0 | 129 | 0 | 0 |
| blank-800-dark-overlay-w1 | 129 | 0 | 0 |
| blank-800-light-classic-w0 | 129 | 0 | 0 |
| blank-800-light-classic-w1 | 129 | 0 | 0 |
| blank-800-light-overlay-w0 | 129 | 0 | 0 |
| blank-800-light-overlay-w1 | 129 | 0 | 0 |

## Streaming — every run

Two in-page fetch guards plus route-level denial of writes; the only send response is a local recorded SSE Response. Current app preparatory POSTs (conversation init, conversation prepare, sentinel prepare) receive local JSON fixtures, with no native write delegation. All runs use the same 189 chunks and original timing. No real message is sent. Full SHA-256, completion duration, wall duration and blocking are reported, including failures.

| Arm / cell | Rep | Chunks | Replay ms | Wall ms | LoAF blocking ms | Longest LoAF ms | Answer chars | Answer SHA-256 |
|---|---|---|---|---|---|---|---|---|
| control-1440-light-classic | 1 | 189 | 121770.5 | 124984 | 5657 | 587 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-1440-light-classic | 2 | 189 | 121770.79999995232 | 125001 | 5565 | 593 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-1440-light-classic | 3 | 189 | 121770.70000004768 | 125002 | 5542 | 590 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-1440-light-overlay | 1 | 189 | 121770.59999990463 | 125020 | 5710 | 634 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-1440-light-overlay | 2 | 189 | 121770.59999990463 | 125023 | 5555 | 613 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-1440-light-overlay | 3 | 189 | 121771.79999995232 | 124990 | 5698 | 591 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-800-dark-overlay | 1 | 189 | 121771.30000019073 | 125012 | 5748 | 624 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-800-dark-overlay | 2 | 189 | 121770.40000009537 | 124998 | 6186 | 596 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| control-800-dark-overlay | 3 | 189 | 121770.5 | 125028 | 6502 | 638 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| local-prepare-control | 1 | 189 | 121770.40000009537 | 125015 | 5323 | 599 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| prepare-probe-control | 1 | 0 | None | 13200 | 506 | 505 | 20 | `6b903ad3d723f40dd7b5ec58077ebadc9b2ecb8b4e7da91ea3f06a048079ae65` |
| product-1440-light-classic | 1 | 189 | 121771 | 124893 | 4618 | 688 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-1440-light-classic | 2 | 189 | 121771.20000004768 | 125048 | 3685 | 634 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-1440-light-classic | 3 | 189 | 121770.40000009537 | 125082 | 4584 | 699 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-1440-light-overlay | 1 | 189 | 121771.19999980927 | 124877 | 4202 | 631 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-1440-light-overlay | 2 | 189 | 121771.10000014305 | 125041 | 4756 | 629 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-800-dark-overlay | 1 | 189 | 121771.39999985695 | 125040 | 4219 | 644 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-800-dark-overlay | 2 | 189 | 121770.5 | 125036 | 4285 | 621 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| product-800-dark-overlay | 3 | 189 | 121770.89999985695 | 125023 | 4755 | 618 | 21448 | `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` |
| smoke-control | 1 | 0 | None | 184779 | 510 | 496 | 20 | `6b903ad3d723f40dd7b5ec58077ebadc9b2ecb8b4e7da91ea3f06a048079ae65` |

## UI comparison and deviations

Approved spec: `~/.t3/worktrees/butter/t3-54326eed/mockups/seek-preview.html`. Private screenshots of seen drag, stored-cold drag, truly unseen drag and released loading are under `screenshots/`, for both widths, themes and scrollbar modes. UI facts are recorded with each run: no top badge, half-opacity text, math placeholders, hot rail, question label, unseen suffix only for unknown geometry, bottom fade only for unknown geometry, loading spinner and busy tick.

The mockup depicts light mode. Dark mode retains the product colors. Narrow-window tests collapse ChatGPT’s sidebar only if required by the existing 560 px rail minimum; the product does not change sidebar preferences. Tall-block fallback uses the existing half-opacity answer style. A placeholder is used if no source text can be reconstructed. Native Mac/Windows behavior remains unverified; Linux native overlay/classic behavior is the installable package’s runtime validation.

## Preserved failures and qualifications

- One overlay warm tall-block setup had 8 rows instead of the required 7 because traversal triggered automatic older pagination. The setup was stopped and retained in `logs/validate-all.log`. The final fixture aborts older-page reads so earlier history stays unloaded.
- Initial lab precondition failures used paginated history and had already visited all candidate rows. The final protocol uses the full read-only replay and validates cold geometry absence; these attempts were excluded as setup failures and retained in pilot logs.
- Nested preview markup required text-node rectangle checks: container ranges can intersect the viewport while every text line is clipped away. A new regression fails on the earlier port; the production renderer and final rAF sampler both use text-node rectangles.
- An early port referenced the trial-only `estShown` variable. The first cold drag still recorded 4101.3 ms, 0 px question error, zero held mounts and zero sampled empty frames, but rail publication failed. It was fixed with a real-render VM regression; the failed capture remains under `runs/pilots/`.
- Class-only theme switching did not change the live app’s data-theme selectors. Superseded captures were dark despite the light label. Final tests set and check actual theme attributes; storage invalidation covers those attributes.
- Superseded stored layouts overlapped native estimated row spans and incorrectly lit Question 1 while targeting Question 7. Their stored releases were 1763.0, 1835.3 and 1670.3 ms, with -0.391 px selected-anchor error; those numbers did not prove a correct preview. The separate preview-coordinate fix has a regression that fails on the prior product model. Superseded warm runs were 1099.0, 1121.6 and 1142.5 ms; all remain in raw results.
- Stored layout still cannot make the native virtualizer’s initial mount asynchronous. Cold rendering, ambiguous/missing anchors, media/citations, neighboring-turn shifts and warm-target misses are reported without a seamless-scroll claim. Persistent records are site-origin and not account-partitioned; extension-owned storage and a popup toggle remain out of scope. Conversation writes reject usable records immediately; rejected disk rows are retained until expiry, pruning or explicit clearing.

## Package and provenance

ZIP: `(not archived)`. Version name `0.1.0-alpha.10+seekstored.1`, numeric version `0.1.0.10`. 84332 bytes. SHA-256 `d6446af7f912ec9d9fd3634d6eb632f3b1ad27a4b4cdf1a02174060fd1008766`.

The packaging copy alone has the test metadata suffix. Every packaged runtime file is listed in `provenance.json`; the archive contains extension files and Chinese `TRY.md`, without probes, lab code or raw captures. Runtime smoke uses frozen copies of the extracted package; verification compares every file with the archive.

## Lab restoration

Each phase takes the shared lock with atomic mkdir and an owner file, then restores blank-head, normal flags, the required original tab and an empty composer before releasing only its own lock. The final cleanup clears any local replay draft, verifies the server still has 13 users with unchanged node IDs/current node, and deletes the experimental IndexedDB. Final independent checks are in `final-state.json`; source changes remain uncommitted.

Artifacts: `TRY.md`, `provenance.json`, `merge.patch`, `merged-untracked.tar.gz`, `results.json`, `commands-and-output.md`, `screenshots/`, `runs/` and `logs/`. Raw captures remain private under `/tmp`; nothing was pushed or published.

## Resumed validation scope and exact omissions

User-authorized reduction after interrupted multi-hour validation: finish both required control/product cells with three original-duration replays per arm; retain all additional completed runs. Do not claim coverage of omitted cells.

Original streaming plan: 48 runs, reduced by 31 runs. Reduced final plan: 17 valid runs, including the 12 mandatory runs (control and product, three each, in 1440/light/classic and 800/dark/overlay). Additional completed 1440/light/overlay runs remain in the results. No duration or SSE schedule was shortened.

| Stream cell | Control reps completed | Product reps completed | Missing original reps and reason |
|---|---|---|---|
| 1440/light/classic | 1, 2, 3 | 1, 2, 3 | none |
| 1440/light/overlay | 1, 2, 3 | 1, 2 | product r3: history setup failed; not rerun in reduced plan |
| 1440/dark/classic | none | none | control r1: omitted under reduced plan; control r2: omitted under reduced plan; control r3: omitted under reduced plan; product r1: omitted under reduced plan; product r2: omitted under reduced plan; product r3: omitted under reduced plan |
| 1440/dark/overlay | none | none | control r1: omitted under reduced plan; control r2: omitted under reduced plan; control r3: omitted under reduced plan; product r1: omitted under reduced plan; product r2: omitted under reduced plan; product r3: omitted under reduced plan |
| 800/light/classic | none | none | control r1: omitted under reduced plan; control r2: omitted under reduced plan; control r3: omitted under reduced plan; product r1: omitted under reduced plan; product r2: omitted under reduced plan; product r3: omitted under reduced plan |
| 800/light/overlay | none | none | control r1: omitted under reduced plan; control r2: omitted under reduced plan; control r3: omitted under reduced plan; product r1: omitted under reduced plan; product r2: omitted under reduced plan; product r3: omitted under reduced plan |
| 800/dark/classic | none | none | control r1: omitted under reduced plan; control r2: omitted under reduced plan; control r3: omitted under reduced plan; product r1: omitted under reduced plan; product r2: omitted under reduced plan; product r3: omitted under reduced plan |
| 800/dark/overlay | 1, 2, 3 | 1, 2, 3 | none |

### Harness diagnosis and preserved interrupted phase

The original tall-fixture failure is preserved verbatim in `logs/validate-all.log`: `Keep earlier history paginated and unloaded`, actual 8 versus expected 7. The fixture retained the app’s pagination flag and warm traversal could request older history. The existing harness correction aborts every older-message read while serving the seven-question fixture; the assertion remains exactly seven. Subsequent cold/warm sweeps must pass this assertion before measuring. No product change was needed to address this setup failure. The production blank-rendering fix is separately covered by the text-node clipping regression and strict sampled text checks.

The preserved stream failure (`runs/stream-history-failure-preserved.json`, `logs/streams-all.log`) reported 13 rail ticks, 5 current rows, and a fully loaded rail on the third local replay. That setup was inconsistent with the required twelve-question history. The resume harness navigates to `about:blank` between repetitions to destroy local optimistic replay/router state, then reloads the read-only history and still requires exactly twelve active entries. Counts before reset and after fresh history are saved in each new `preflight-*.json` and result. This is a harness isolation fix; there is no product workaround, weakened history assertion, shortened replay, or live send.

The interrupted matrix phase left this task’s lock at 2026-11-03T13:33:15Z. Before recovery, process inspection using bracketed grep found no live validation driver. Its owner matched the user-supplied owner exactly. Blank-head, normal flags, the required original conversation, and an empty composer were restored before removing that stale lock. The resumed driver uses the same atomic lock and restoration protocol for every subsequent phase. Existing successful release JSONs were retained; only missing releases were scheduled.

## Preserved release attempts — every captured result

These rows are excluded from the final 72-run matrix because they are setup failures, older product revisions, wrong-theme captures, or captures made with the superseded container-range sampler. Their measurements and error counts remain visible here. A zero empty-frame value under an older sampler is not proof of the final text-node visibility requirement.

| Capture | Readable ms | Anchor px | Held mounts | Empty / held frames | Errors / qualification |
|---|---:|---:|---:|---|---|
| `runs/pilots/1440-light-classic-cold-r1-precondition-failure.json` | not measured | not measured | not measured | not measured/not measured | 2 errors; SecurityError: Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag. |
| `runs/pilots/1440-light-classic-cold-r1-render-failure.json` | 4101.3 | 0.000 | 0 | 0/123 | 62 errors; ReferenceError: estShown is not defined; SecurityError: Failed to read the 'localStorage' property from 'Window': The document is sandboxed and lacks the 'allow-same-origin' flag. |
| `runs/pilots/1440-light-classic-cold-r1.json` | 4080.9 | 0.000 | 0 | 0/126 | 0 errors; earlier sampler / setup; superseded |
| `runs/pilots/1440-light-classic-cold-r2.json` | 3938.4 | 0.000 | 0 | 0/120 | 0 errors; earlier sampler / setup; superseded |
| `runs/superseded-native-spans/1440-light-classic-cold-r1.json` | 4094.0 | 0.000 | 0 | 0/127 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-cold-r2.json` | 3886.3 | 0.000 | 0 | 0/122 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-cold-r3.json` | 3885.2 | 0.000 | 0 | 0/119 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-stored-r1.json` | 1763.0 | -0.391 | 0 | 0/121 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-stored-r2.json` | 1835.3 | -0.391 | 0 | 0/100 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-stored-r3.json` | 1670.3 | -0.391 | 0 | 0/106 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-warm-r1.json` | 1099.0 | 0.297 | 0 | 0/122 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-warm-r2.json` | 1121.6 | 0.297 | 0 | 0/118 | 0 errors; native/preview span mapping superseded |
| `runs/superseded-native-spans/1440-light-classic-warm-r3.json` | 1142.5 | 0.297 | 0 | 0/121 | 0 errors; native/preview span mapping superseded |
| `runs/before-text-node-fix/1440-light-classic-cold-r1.json` | 4089.2 | 0.000 | 0 | 0/125 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-cold-r2.json` | 4052.7 | 0.000 | 0 | 0/118 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-cold-r3.json` | 4053.7 | 0.000 | 0 | 0/118 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-stored-r1.json` | 1520.9 | -0.484 | 0 | 0/125 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-stored-r2.json` | 1510.0 | -0.484 | 0 | 0/117 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-stored-r3.json` | 1527.8 | -0.484 | 0 | 0/120 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-warm-r1.json` | 1094.2 | 0.156 | 0 | 0/124 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-warm-r2.json` | 1093.6 | 0.156 | 0 | 0/120 | 0 errors; earlier sampler / setup; superseded |
| `runs/before-text-node-fix/1440-light-classic-warm-r3.json` | 1124.0 | 0.156 | 0 | 0/118 | 0 errors; earlier sampler / setup; superseded |

## Package smoke — every mode

| Mode | Run | Readable ms | Anchor px | Held mounts | Empty frames |
|---|---|---:|---:|---:|---:|
| classic | package-classic-1440-dark-classic-stored-r1 | 1770.0 | -0.484 | 0 | 0 |
| overlay | package-overlay-1440-dark-overlay-stored-r1 | 1725.3 | -0.375 | 0 | 0 |

## Artifact and check inventory

The standalone matplotlib chart is `release-to-readable.png`: each measured release is a dot and each state’s median is a bar. The warm target is drawn at 1100 ms; no miss is removed. Release statistics use final runs only. The complete per-run values are in the matrix above and `results.json`.

`logs/unit-final-resumed.log` contains the final product command and actual output: 110 tests, 110 passed, 0 failed, and version consistency OK. `git diff --check` returned exit 0 with no output. The product source was not changed during resumed validation. No changes were staged or committed.

`capture-inventory.json` indexes and hashes every retained JSON capture, including setup progress, failed history state, seeds, superseded runs, package smoke results, and stream diagnostics. Failed stream sends with zero chunks remain in the main stream table. All private captures stay under `/tmp`.

## Completed visual inspection

Manually compared private four-panel contact sheets against the approved mockup source, checking seen, stored-cold, unseen, and cold released-loading states. Screenshot appearance is supported by the recorded DOM facts; screenshots cannot establish animation duration.

| Cell | States inspected | Finding |
|---|---|---|
| 1440-light-classic | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 1440-light-overlay | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 1440-dark-classic | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 1440-dark-overlay | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 800-light-classic | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 800-light-overlay | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 800-dark-classic | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |
| 800-dark-overlay | seen drag, stored-cold drag, truly unseen drag, released loading | Muted preview, formula placeholder boxes, expanded active rail and question card, no top badge. Unknown geometry begins with its question and alone carries the unseen suffix/bottom fade. Released loading keeps the preview and shows spinner/loading text. |

The mockup is light mode; dark captures keep the existing dark palette. Narrow captures naturally have a more overlapping rail card. The 120 ms fade and busy-tick animation are code/test checks, not a claim established by a still image. Some early captures contain a local replay draft; final cleanup clears it and verifies emptiness after reload. Raw screenshots remain private.

## Final independent verification

Protocol passed: `True`. Final releases: 72; tall fixtures: 16; valid streaming runs: 17. Both package smokes passed. Server: 13 user messages, unchanged node IDs and current node. Experimental database remaining: `False`. Lock absent: `True`. Composer empty: `True`; restored flags normal: `True`.


## Stream performance — every captured run

| Arm / cell | Rep | FPS | Frame p95 ms | Jank % | Busy % | Style % | Key p95 ms | Wheel p95 ms | Network writes completed |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| control-1440-light-classic | 1 | 52.6 | 33.3 | 2.2 | 37.3 | 13 | 151.2 | 74 | 0 |
| control-1440-light-classic | 2 | 52.7 | 33.3 | 2.1 | 37.3 | 12.8 | 163.8 | 74 | 0 |
| control-1440-light-classic | 3 | 52.6 | 33.3 | 2.3 | 37 | 12.9 | 164.3 | 74 | 0 |
| control-1440-light-overlay | 1 | 52.6 | 33.3 | 2.3 | 37 | 12.8 | 147 | 68 | 0 |
| control-1440-light-overlay | 2 | 52.7 | 33.3 | 2.1 | 37.1 | 12.7 | 148.6 | 77 | 0 |
| control-1440-light-overlay | 3 | 52.7 | 33.3 | 2.1 | 36.7 | 12.7 | 144.8 | 79 | 0 |
| control-800-dark-overlay | 1 | 52.5 | 33.3 | 2.3 | 37.2 | 13 | 154.4 | 69 | 0 |
| control-800-dark-overlay | 2 | 52.4 | 33.3 | 2.4 | 38 | 12.5 | 158.7 | 82 | 0 |
| control-800-dark-overlay | 3 | 52.2 | 33.3 | 2.5 | 37.3 | 13 | 144.2 | 70 | 0 |
| local-prepare-control | 1 | 52.9 | 33.3 | 2.1 | 36.3 | 12.4 | 150.5 | 68 | 0 |
| prepare-probe-control | 1 | 56.7 | 16.8 | 0.4 | 12.4 | 2.8 | 507.6 | None | 0 |
| product-1440-light-classic | 1 | 53.5 | 33.3 | 1.6 | 39.2 | 9.6 | 132.7 | 73 | 0 |
| product-1440-light-classic | 2 | 54.2 | 33.3 | 1.5 | 38.2 | 9.3 | 138.5 | 66 | 0 |
| product-1440-light-classic | 3 | 53.8 | 33.3 | 1.8 | 39.6 | 9.4 | 142.8 | 72 | 0 |
| product-1440-light-overlay | 1 | 54.1 | 33.2 | 1.5 | 38.5 | 9.3 | 133.2 | 72 | 0 |
| product-1440-light-overlay | 2 | 53.7 | 33.3 | 1.7 | 39.2 | 9.8 | 143.8 | 69 | 0 |
| product-800-dark-overlay | 1 | 54 | 33.3 | 1.5 | 38.3 | 9.1 | 134.5 | 64 | 0 |
| product-800-dark-overlay | 2 | 54.1 | 33.2 | 1.6 | 38.7 | 9.5 | 134.7 | 61 | 0 |
| product-800-dark-overlay | 3 | 53.6 | 33.3 | 1.8 | 39.3 | 9.7 | 132.4 | 57 | 0 |
| smoke-control | 1 | 59.8 | 16.8 | 0 | 5.5 | 0.1 | 509.1 | None | 0 |

No statistical equivalence or cross-platform streaming claim is made from this reduced set. The complete per-frame and script attribution captures remain private in the raw results.


### Fresh-document replay preflights

| Variant | Rep | Rail ticks before document reset | Active entries after fresh history | Rail ticks after fresh history |
|---|---:|---:|---:|---:|
| control-800-dark-overlay | 1 | 0 | 12 | 12 |
| control-800-dark-overlay | 2 | 13 | 12 | 12 |
| control-800-dark-overlay | 3 | 13 | 12 | 12 |
| product-800-dark-overlay | 1 | 0 | 12 | 12 |
| product-800-dark-overlay | 2 | 13 | 12 | 12 |
| product-800-dark-overlay | 3 | 13 | 12 | 12 |

A completed local replay adds an optimistic question to the current document. Every resumed replay destroys that document first and must independently recover twelve historical entries before any local send is attempted. The table records the actual setup counts rather than inferring correctness from the final answer hash.


## Additional preserved tooling failures

- The first matplotlib command failed with `ModuleNotFoundError: No module named matplotlib`. Matplotlib and its dependencies were then installed into `(not archived)`, with pip and matplotlib caches also under `/tmp`. The successful chart command uses that interpreter. Both the failure and successful commands are retained in `commands-and-output.md`; installation output is in `logs/plot-setup.log`.
- The first final verifier failed its restoration assertion after cleanup had succeeded (`logs/finalize-first.log`). Snap Chromium flattens its browser arguments into one NUL-terminated `/proc` command-line value, so the original parser found no browser and reported `normalFlags=false`. A direct probe found one NUL separator; normalizing the single value with `shlex` yielded fourteen arguments, the expected port and blank-head extension, and no overlay flag. The verifier now normalizes that representation, requires the exact lab profile, and independently checks the loaded extension flag. The corrected verifier passed; no lab or product change was needed.
