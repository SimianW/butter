> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Candidate F (native-thumb seek preview): feasibility report

Base: released `79774e7` = `0.1.0-alpha.9` (control). Lab: Linux, headed Snap Chromium, classic scrollbars, CDP 127.0.0.1:9222, long test chat (12 questions, ~313k px). Every claim is tagged **Verified** (measured / read in full), **Conditional** (trigger stated), **Trade-off**, or **Unverified**. Measurement contract: [methods.md](data/methods.md). Commands: commands-and-output.md (not archived) (+ early part (not archived)). Per-run numbers: [results.json](data/results.json).

## Verdict

**F is feasible for the drag itself and not yet for the release.** On this lab it does what B2 could not: the user sees content while the thumb moves, and ChatGPT mounts nothing until the thumb is released. The release still freezes for 1.0–2.6 s. It is cheaper than control (1.7–2.3 s slow, 2.0–2.1 s fast), but still a multi-second freeze in half the runs. It does not run at all on the user's real machine (macOS overlay scrollbars) as prototyped.

- **Verified (drag):** with the best arm ("shift": B2 suppression + Butter shadow-root preview + real turns moved off-screen while held), slow top→bottom drags showed 0 window commits while held (control: 4 commits, 5–6 turn mounts, 2.2–2.4 s frames). Held frames were p95 17 ms, max 33–217 ms. Input-to-preview, measured from screen captures, was p95 66–67 ms (target ≤ 100 ms). Script-side preview work was < 1 ms per scroll event.
- **Verified (release):** one destination batch (4 mounts / 5 removals) per release. Release-to-readable was 1.25–1.47 s when the pre-read height cache restored the destination turns and 2.6–2.9 s when it missed; it missed in 7 of the 18 bottom-target drags across the three cache-carrying arms (hook 2/6, retry 1/6, shift 4/6). Control: 2.1–2.8 s slow, 3.7–5.5 s fast.
- **Conditional — feasible as a product only if all of these hold:** (1) thumb detection works with macOS overlay scrollbars (untested; the prototype passes overlay scrollbars through untouched); (2) the pre-read cache is fixed so it reliably hits (root cause found, issue 2); (3) the release is presented honestly (preview stays up with "loading" until real content is ready) and accepted as a ~1–1.5 s wait; (4) the within-turn preview offset is corrected or the preview stops claiming exact position (issue 4).
- **Trade-off:** F's quality as a "scrub" view of Markdown/LaTeX source text is plain. It is useful for recognising where you are, but it does not look like the rendered page.

## Results

Medians, with the [min–max] range across runs. "Held" = complete frames between physical press and release submission. Preview latency (screen) = input dispatch → first JPEG capture carrying that update's stamp. Release-to-readable = release → 3 quiet frames with real content under the scroller centre. Landing = frozen numeric target vs real geometry. Anchor = a source-text anchor from the preview found in the real answer, distance from where the preview showed it.

| Arm (drag) | Runs | Held frame max ms | Held frame p95 | Commits / turn mounts while held | Preview latency p95, script / screen ms | Release batches | Release-to-readable ms | Release max task ms | Landing px | Anchor px |
|---|---:|---|---|---|---|---:|---|---|---|---|
| control slow | 3 | 2283 [2183–2367] | 100 [83–100] | 4 / 5–6 | – | 1–2 | 2762 [2101–2775] | 2265 [1712–2281] | n/a | n/a |
| control fast | 3 | 100 [50–100] | 100 [50–100] | 0 / 0 | – | 2–3 | 3890 [3745–5537] | 2046 [2012–2100] | n/a | n/a |
| B2 only, fast | 3 | 117 [117–133] | 100 [83–117] | 0 / 0 | – (white) | 1 | 2844 [2474–2849] | 2568 [2217–2588] | −2 | – |
| B2 only, slow | 1 | 133 | 50 | 0 / 0 | – (white) | 1 | 2755 | 2498 | −2 | – |
| F preview + cache ("hook"), fast | 3 | 133 [133–150] | 117 [83–117] | 0 / 0 | 112 [103–134] / 153 [120–181] | 1 | 1279 [1258–1439] | 1048 [1036–1117] | −2 [−2…41] | 432 |
| F preview + cache ("hook"), slow | 3 | 300 [233–300] | 67 [67–83] | 0 / 0 | 83 [62–83] / 206 [200–243] | 1 | 2636 [1357–2752] | 2333 [1146–2433] | −2 | 432 |
| F + cache retry ("fix"), fast | 3 | 133 [117–150] | 83 [67–100] | 0 / 0 | 105 [89–113] / – | 1 | 1331 [1280–1380] | 1040 [1021–1045] | −2 [−2…41] | 432 |
| F + cache retry ("fix"), slow | 3 | 150 [133–267] | 67 | 0 / 0 | 75 [67–80] / – | 1 | 1389 [1279–2660] | 1175 [1072–2329] | −2 [−2…41] | 432 |
| **F shift (best), fast** | 3 | 50 [50–267] | 17 [17–50] | 0 / 0 | 32 [16–46] / 67 [66–104] | 1 | 2733 [2643–2864] | 2397 [2339–2569] | −2 | 432 |
| **F shift (best), slow** | 3 | 66 [33–217] | 17 | 0 / 0 | 11 [11–13] / 67 [66–67] | 1 | 1474 [1251–2719] | 1264 [1055–2394] | −2 [−2…41] | 432 |

Single-run screens (fast, Verified, n=1): `hidden` (content-visibility:hidden on turns while held) held max 200 / p95 17, screen latency p95 73; `covered` (preview over real content) 150 / 107; `plain` (B2 + preview, no cache) 167 / 170, release 3.4 s. These screens ran before a landing-model fix, so their landing columns (−5.3k px) are not comparable; they are not promoted.

Other measurements (Verified unless tagged):

| Case | Result |
|---|---|
| Streaming bench (189-chunk fail-closed replay, 3 reps) median loafBlockMs | control 6073 [5653–6248]; F "hook" build 3644 [3602–3742] (−40%). Gate (≤ +10%) passes. **Unverified attribution:** the drop comes with fewer seen-marks (2049 → 1320), which points at the pre-read cache module, not the preview; the preview alone was not isolated. |
| Drag during a streaming answer (shift, 1 run, 12 s slow drag mid-chat) | 0 mounts while held; held p95 17 ms, max 100 ms, max task 191 ms; one release batch (3 mounts / 7 removals) at +407 ms; readable +815 ms; landing 0 px. The scroll height grew 230,778 → 238,794 during the run and the stand-in did not cancel. A 3.4 s LoAF 16 s before the drag, during harness positioning, is outside F (cause Unverified). |
| Cold drags (fresh history, no warm traversal), fast, 3 runs | readable 552 / 554 / 2897 ms; landing −1 / −1 / **2941 px**; release dispatch was delayed 1.14 s in the bad run (main thread busy). |
| Middle target (55%), warm, 3 runs | readable 1616–2061 ms; landing −1 px; anchor 55 / 87 / 893 px. |
| Very short drag (0.8% of track) / drag ending where it started | readable 84 ms / 97 ms; no mounts; landing 0. |
| Drag into unloaded history (alpha.9 holds page requests), 1 run | history request sent 6 ms after release (held as intended), 200 at +69 ms; height grew 92,770 → 121,945; 1 batch; readable 1618 ms; landing 0. |
| Wheel + PageDown | 0 seek sessions (both arms). |
| Track click (not on thumb) | 0 new sessions (both arms). |
| Synthetic `pointercancel` mid-drag | session cancelled; after that, ChatGPT handled the continuing native drag normally (final turn-top error 0). Real OS cancellation is untested. |
| Tab switch mid-drag (CDP `bringToFront`) | session ended on `pointerup`, not `blur`; landed exactly. The blur path itself was never triggered by this harness. |
| SPA path change mid-drag | cancelled with reason `chat-switch`; ChatGPT restored. |
| Preview data memory | 162,478 chars ≈ 406 KB UTF-16 estimate; clearing it reclaimed 335 KB of JS heap after GC. Renderer heap was 172 MB used, 178k DOM nodes. |

Videos (screen captures re-timed to 60 fps): best F = shift — slow (not archived), fast (not archived); control — slow (not archived), fast (not archived). Also the cache-carrying arm without shift: slow (not archived), fast (not archived). Contact sheets sit next to each mp4 (`*-contact.jpg`).

## Issues, ranked by consequence

### 1. F never activates on the user's real machine (macOS overlay scrollbars)
- **Where:** `seek-preview.js` `down()`: thumb hit-test uses `offsetWidth − clientWidth`; when that gutter is 0 it logs `overlay-fallback` and returns.
- **Trigger:** overlay scrollbars (macOS default, trackpad users), where the scrollbar takes no layout width.
- **Consequence:** on the user's machine, behaviour equals alpha.9; none of the gains apply. **Conditional** on macOS behaving like Chromium overlay mode, which is **Unverified** in this lab.
- **Evidence:** code read in full (Verified); lab is Linux classic scrollbars only.
- **Fix:** detect a thumb drag on overlay scrollbars from a pointerdown within the right ~15 px of the scroller plus scroll events with no wheel/key input. Whether pointerdown reaches the page on a macOS overlay thumb at all must be checked on a Mac first; if it doesn't, F is not possible there.

### 2. The release is cheap only when the pre-read height cache hits, and it misses about half the time
- **Where:** `remount-prototype.js` (copied from `(not archived)`): `watch()` registers a turn's blocks with the ResizeObserver only when it first sees the turn element; `restore()` requires `bs.length === e.blocks.length`.
- **Trigger:** a destination turn whose element was first seen before its Markdown blocks existed (timing of the warm traversal). Its cache entry then has a height and identity but 0 block sizes.
- **Consequence:** the restore is skipped and the release pays a full uncached mount: readable 2.6–2.9 s instead of 1.25–1.47 s. A bimodal release looks unreliable to the user.
- **Evidence (Verified):** in miss runs the miss log shows `<id>` with 673 blocks in the DOM vs 0 cached, and `<id>` with 84 vs 0; hits restore 982 blocks for the 3 destination turns. The "fix" arm (retry instead of one-shot) did not cure it (slow 2660 / 1389 / 1279 ms), which rules out the one-shot retry as the cause.
- **Fix:** re-scan a watched turn's blocks on child mutations (or at removal time, record sizes from the live tree before unmount). Then re-measure ≥ 3 slow and fast runs. Expected result (**Unverified**): consistent ~1.1–1.4 s release.

### 3. Even a hit leaves a ~1 s release freeze
- **Where:** ChatGPT's mount of the destination turns (style recalc is the dominant cost per `../2026-11-02-fast-mount-opinion/report.md`).
- **Trigger:** every release that lands on unmounted turns.
- **Consequence:** about 1.0–1.15 s max task at release, best case. The F acceptance criteria in the fast-mount opinion ask for no multi-second freeze; 1 s passes that, but it isn't "seamless". The preview stays up with "loading real content" during it, so the screen never goes white, but input is frozen for that second. **Trade-off.**
- **Evidence:** release max task 1021–1175 ms in every cache-hit run (Verified).
- **Fix:** none found here. Splitting the mount is outside Butter's control; this is the floor for F.

### 4. The preview shows the right turn, but text ~430 px away from where the same text lands
- **Where:** the within-turn mapping uses Markdown character fractions of the answer, not layout.
- **Trigger:** any target inside a long answer; strongest in math-heavy answers (LaTeX source is short relative to its rendered height, or the other way round).
- **Consequence:** the turn and numeric scroll position are right (landing −2 px; 41 px when the total height varies by ~200 px), but the text the preview showed at the viewport top appears about half a screen away after release. The user sees content "jump" at the swap. **Correctness of the preview's promise.**
- **Evidence (Verified):** anchor error 432 px in every bottom drag; 55–893 px middle; 254–602 px short/same.
- **Fix:** record per-block heights (already collected by the cache module) with each block's source-text offset, and map using those for seen turns; for unseen turns, label the preview as approximate.

### 5. Cold (never-seen) destinations can land thousands of pixels off
- **Where:** height estimates (`max(208, chars × 2.1)` scaled to the remaining height) for turns ChatGPT never measured.
- **Trigger:** a drag into turns never mounted in this page session, especially with a busy main thread at release.
- **Consequence:** 1 of 3 cold runs landed 2941 px off and took 2.9 s.
- **Evidence:** `best-cold-fast-r1` (Verified); release dispatch was 1.14 s late in that run.
- **Fix:** after release, re-target once against real geometry when the destination turn mounts; document estimates as approximate.

### 6. Interception relies on private DOM/React shapes
- **Where:** `.thread-scroll-container`, `[data-turn-key]`, the turn-container two levels up (shift arm), and the React fiber `entries`/`RowComponent` heights (geometry source).
- **Trigger:** a ChatGPT front-end change.
- **Consequence:** if the shift target or scroll suppression fails silently, the user gets alpha.9 behaviour (safe). If the fiber shape changes, F falls back to estimates (issue 5 widens). **Conditional.**
- **Evidence:** code read (Verified); the second opinion's issue 3 makes the same point.
- **Fix:** fail closed per session (already done for overlay and missing data), and log a health flag in the popup status check.

### 7. Lifecycle coverage gaps
- **Verified:** wheel/keys/track click don't start sessions; SPA path change cancels; synthetic pointercancel cancels; streaming does not break a drag.
- **Unverified:** real OS pointer cancellation, window blur (the harness's tab switch ended on pointerup), trackpad scrolling while the thumb is held, other widths, and macOS.

## Score table

Dimensions are the ones that tell the candidates apart. The idle-mount alternative is "all retained" from `../2026-11-02-idle-mount/data/tables.md` (preliminary; that report is not final).

| Dimension | Control (alpha.9) | F shift + cache, as measured | Idle-mount "all retained" |
|---|---|---|---|
| Slow drag: worst frame while moving | 2.2–2.4 s | 33–217 ms | 100 [83–467] ms incl. recovery |
| Shows content while dragging | yes, with mount stalls | preview text (source form) | real content, but CV blanks 5.0–6.3 s per slow drag |
| Release / landing freeze | 1.7–2.3 s task, readable 2.1–5.5 s | 1.06–1.26 s task on hit, 2.4–2.6 s on miss | none at release; cost moves to background growth (max task 0.9–1.5 s; typing 612 ms worst) |
| Landing accuracy | native | −2 px numeric; ~430 px text mismatch | native |
| Streaming cost | baseline | no increase measured (−40%, attribution unverified) | +12–20% (shrink/quiet-shrink) |
| Works on macOS overlay | yes | **no, as prototyped** | yes (independent of scrollbar type) |
| Brittleness | low | medium-high (private shapes, scrollbar calibration) | medium |
| Overall (1–10) | 4 | 5 now; ~7 if issues 1, 2, 4 are fixed | 4 |

## Recommendation

**Don't ship F yet. Spend one round on the two blockers before building any product UI:** (a) on a real Mac, check whether a pointerdown on an overlay-scrollbar thumb reaches the page and whether scroll suppression holds there; (b) fix the cache's block registration (issue 2) and re-measure the release over ≥ 3 slow and fast runs. If (a) fails, drop F: the user's machine can't benefit. If (a) passes and the release is consistently ≤ ~1.4 s with the preview kept up until the real content is readable, F is the strongest option measured for the user's slow-drag case. Then request a mockup for the preview's look and the "loading" state.

**Re-evaluate when:** macOS overlay evidence exists; the cache fix lands (release bimodality gone or not); ChatGPT changes its virtualizer or turn markup; the idle-mount report becomes final with a seamless candidate; or ChatGPT's own turn mount drops well below 1 s (then a plain B2 + preview without the cache may be enough).

## What this lab cannot cover

- **Unverified:** macOS, overlay scrollbars, trackpad momentum, real OS cancellation, high-refresh displays, other window widths, other chats (media, branches, code-heavy answers).
- Screen latency comes from CDP JPEG captures, not physical display refreshes. Commit counts are DOM window-change proxies, not all React work.
- n = 3 per arm, sequential runs: descriptive only, not significance tests.

## Prototype

`extension-best/` (not archived) = the shift arm, loadable unpacked, with EXPERIMENT.md (not archived). The cache-only arm is kept as `extension-hook-noshift/`, the retry arm as `extension-fix/`. No tracked file of any Butter worktree was changed. The lab was restored to `butter-blank-head` and the original tab after every phase, and the lock was released.
