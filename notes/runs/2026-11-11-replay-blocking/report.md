# Streaming replay blocking control — stopped by write guard

**Incomplete: a fetch write guard tripped during alpha.11 preflight, so the task stopped, restored the lab and released both locks. No hypothesis is resolved.** The required $n=3$ per cell was not reached. There are zero qualifying samples. No extension code changed and no bisection ran. Raw captures remain local under `/tmp/replay-blocking-work/` (mode 700); this publication contains only sanitized reports and numeric JSON.

## Question and predeclared predictions

Does the increase from about 11.5 s streaming-replay LoAF blocking in released alpha.11 to about 66 s in the November 11 acceptance run arise from method, environment/ChatGPT, Butter itself, or an inactive Butter stream path?

| Hypothesis | Prediction | Result |
|---|---|---|
| Measurement method | alpha.11 is near 11.5 s under M1 and near 66 s under M2 today. | Untested: alpha.11 replay never started and M2 was not run. |
| Environment / ChatGPT | Today's no-extension arm differs substantially from 76.4 s, or alpha.11 is high under both methods. | Unresolved: one excluded no-extension observation was 76.9 s; alpha.11 has no replay. Platform facts match, but observed app bundle hashes changed. |
| Butter regression | Under an identical method today, alpha.11 is near 11.5 s and main near 66 s. | Untested: neither extension completed a replay. |
| Stream path inactive | Extension replay shows no stats/block/seen activity, or settings disable the path. | Unresolved: alpha.11 preflight shows 9 rail ticks, 3870 seen elements and empty off markers, but no streaming activity was measured. |

The isolated no-extension timing cannot distinguish these predictions. Its proximity to the old median is not evidence that the environment is unchanged in performance.

## Builds and immutable inputs

| Arm | Identity | Provenance |
|---|---|---|
| None | No extensions; empty extension list verified in `chrome://version` | Browser restarted with empty `LAB_EXTENSIONS`; no storage seed. |
| Released alpha.11 | `37a2b4536d0c47c5f3b9997ad2ab4772f89ab2c3` | Downloaded `v0.1.0-alpha.11` from `SimianW/butter`; ZIP SHA-256 `8cc5476fdd0ac4748aa2b726dd0a1c1308f0b7ec6a63c3bd19dbd77c1f57a3ef`. Unpacked into a new empty directory; files match the historical archive byte for byte. |
| Current main | `2f2412706c318e2592c081e13436cee8e1af80c6` | `git fetch origin`; `git archive origin/main extension` into a new empty directory. Not replayed. |

Frozen nine-question history SHA-256: `359b4fe33317cb357e4f6646f3dc443dd6338241e53897039349c23fa239d345`. Recording SHA-256: `36b773bf0733ff3f4df3856157834243bfdcf886af1fbc2f0600631d251ca05c`. Both copied read-only from the November 4 archive; identical to the #92 inputs. Expected answer SHA-256: `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68`.

Snap requires readable extension staging under its common directory. New task-owned copies were used there; harnesses, captures and publication work stayed under the requested temporary directory. Neither historical archive was modified.

Both alpha.11 and main's `shared/status.js` normalize the same storage shape: `{butter:{enabled:true,layoutConsent:'granted',opts:{layout:true}}}`. Missing feature options normalize to enabled. Alpha.11 local/session storage was cleared and this exact seed written before its preflight; no-extension skipped storage work. Consent was not seeded in an incompatible newer shape.

## Recovered methods and differences

The recovered stream driver does **not** use “no long task for 1500 ms and no pending math markers” readiness. That readiness is in `nonstream.mjs`, a separate opening scenario. The initial progress message's approximately 18.5-second description was arithmetic error; the recovered stream's fixed waits sum to 16.5 seconds. M1 preserves the actual recovered stream scenario.

| Variable | M1: recovered November 4 stream scenario | M2: PR #92 acceptance adapter |
|---|---|---|
| Driver provenance | `stream.mjs`, SHA-256 `b39be6a2a9fe43a5d52a4c273fbc1be228811a21b388b8f16fc39fde44bf44d8` before path adaptation | `bench-live.mjs`, SHA-256 `0249f58a22ce0c92703a198af7551849f31254ac938680ebe1061dc4b1235630` |
| Readiness before replay | Composer visible → 8 s; `full()` waits for a visible scroller with a turn → 2 s; theme pin → 5 s; scroll to bottom → 1.5 s. Fixed waits total 16.5 s, plus page/render/automation time. | Composer visible → 8 s; theme pin and auth/rail/CV/fixture preflight; scroll to bottom → 1.5 s. Then separate idle typing. |
| “Fully settled” readiness | No long-task or pending-math readiness in recovered stream scenario. That check is in the separate `nonstream.mjs` opening scenario. | No long-task/pending-math check. |
| Idle input before replay | None. | 54 letters at 80 ms per letter, 250 ms wait, then clear. |
| Scroller and composer | Visible `.thread-scroll-container`; visible `.ProseMirror`. | Same. Excluded #92 pilots used the hidden first scroller. |
| Wheel schedule | While streaming, 3 × 250 px, 30 ms between wheel acknowledgements, every 1500 ms; alternating direction. Serial CDP acknowledgements determine actual cadence. | Same. |
| Streaming typing | Two ten-letter bursts at one-third/two-thirds scheduled replay time, 120 ms spacing; ten Backspaces each; 250 ms driver poll. | Same. |
| Recording and replay timing | Same 189 chunks; initial 300 ms; inter-chunk thinking gaps capped at 1500 ms; local SSE fetch response; full answer textContent SHA-256. | Same bytes, schedule and replay hook. |
| LoAF/frame window | Observers start before Enter; stop after stream completion, 3 s tail wait, answer hashing and fixture check. First frame discarded; no replay-bound filtering. | LoAF start times / frame timestamps filtered to replay start through end; key listener letters/Backspace only while streaming. Attribution aggregation still covers the whole observer window. |
| Key filtering | All keydowns while replay active, including non-letter modifier events. | Letters/Backspace only. |
| History routing | Frozen `math-nine.json` plural conversation GET fulfilled; singular conversation GET denied; fixture identity observer; WebSockets closed and service-worker bypass. | Same frozen body and isolation; equivalent fixture observer. |
| 50 ms history page delay | Only inside `if(paged)` in `fixtures.mjs`; stream calls `history(ctx,'math-nine')` without paging, so **no delay**. | No delay. |
| Consent/storage | alpha.11 popup helper updates `butter.enabled`, `butter.layoutConsent='granted'`, `butter.opts.layout=true`; unrelated existing options historically preserved. This control clears task-extension local/session storage each repetition, then seeds the documented build-native shape. | Clears extension local/session storage then sets `{butter:{enabled:true,layoutConsent:'granted',opts:{layout:true}}}`. Same shape works in both source versions; omitted feature keys normalize to on. None skips the seed and Butter rail/CV checks. |
| Browser flags | Historical classic phase: normal lab flags, selected extension only; no extra flag. | Normal lab flags plus `--disable-extensions-except=<selected extension>`; none has no extra flag. |
| Viewport/theme | Headed Xvfb; 1440 × 1000 CSS px, light media and pinned light DOM attributes. | Same. |
| Restart/startup | Each control run restarts browser, waits for CDP and 3 s. Historical startup wrapper also waited 3 s. | Same control startup; original adapter additionally waits 3 s after CDP is reachable. |
| Control-only observation | Auth/send guard, storage seed, environment capture, before/after Butter stats and replay duration, saved raw observer arrays; no extension source changes. Existing M1 fixture routing and scenario retained. | Same observations; original #92 safety checks retained. |


The control additionally enforces auth, fixture-only history, send guard, WebSocket closure and zero completed ChatGPT writes; adds environment/engagement snapshots and saves existing observer arrays. It preserves M1's wheel/typing/replay timing, scroller choice and metric windows. Extension-local storage is reset for consistent repetition seeding. The copied historical `verifyLab` was replaced by a path-aware `chrome://version` check. All changes are in temporary harness copies.

## Environment and ChatGPT build

- Chromium 156.0.8078.47, official snap x86_64; read from `chrome://version` on each attempted arm. Same as November 4.
- Ubuntu 24.04.5 LTS; kernel `7.0.0-38-generic`; Intel Core i5-10400 at 2.90 GHz, 12 CPU threads. These match the historical environment capture.
- Headed Xvfb, 1440 × 1000 CSS viewport, light media/DOM theme; lab launch window is 1600 × 1000. No headless flag.
- GPU renderer: `ANGLE (Mesa, llvmpipe (LLVM 20.1.2 256 bits), OpenGL 4.5 (Core Profile) Mesa 25.2.8-0ubuntu0.24.04.2)`. GPU compositing/rasterization disabled in software; matches the archive.
- `chrome://version` command line, with private profile/endpoint values redacted: `/snap/chromium/3569/usr/lib/chromium-browser/chrome --password-store=basic --gtk-version=3 --disable-features=TFLiteLanguageDetectionEnabled --user-data-dir=<LAB_PROFILE> --remote-debugging-<REDACTED> --remote-debugging-<REDACTED> --no-first-run --no-default-browser-check --password-store=basic --window-position=0,0 --window-size=1600,1000 --ozone-platform=x11 --flag-switches-begin --flag-switches-end https://chatgpt.com/`. Alpha.11 additionally had the task-owned `--load-extension` path; no extra M1 flags. M2 would retain #92's `--disable-extensions-except` flag.
- No explicit page build id was exposed. Today's public assets include `manifest-42f0cd0e.js`, `807489.7f5d47cb0e.js`, `633146.acefa13d1a.js`, `226913.27c93050ff.js` and `731863.e2c3850b56.js`; the [public bundle inventory](app-assets.md) retains all captured public app asset URLs.
- Historical raw LoAF captures retain source bundle basenames, not a complete app build manifest. They include `807489.43c08228d1.js`, `633146.2285f1d8aa.js`, `226913.d4efcaca8e.js` and `731863.0ff6d7d48b.js`. These changed suffixes establish a different observed app asset set, not the cause of the timing change. Older raw captures themselves also contain more than one revision of some bundles; this was not a fully pinned page build.

## Lock windows (UTC)

Owner `replay-blocking`; lab chosen via `--lab auto --needs-fixture math12 --wait 1800 --perf`. Both windows have successful restore before release. The first window performed no measurement; all attempted matrix work happened within the second window.

| Activity | Lab | Acquire completed | Restore completed | Release completed |
|---|---:|---|---|---|
| Startup failure | 1 | 2026-11-11T20:42:05.369589+00:00 | 2026-11-11T20:42:18.445688+00:00 | 2026-11-11T20:42:18.510006+00:00 |
| Aborted matrix | 1 | 2026-11-11T20:42:33.684300+00:00 | 2026-11-11T20:45:51.727665+00:00 | 2026-11-11T20:45:51.791921+00:00 |

Final `lab-lock status`: lab 1 unheld; lab 2 unheld; perf unheld. Restore returned exit 0, empty composer, one home tab, default extension and default flags. No login expiry was observed.

## Attempts and exclusion

| Attempt | Replay | Outcome |
|---|---|---|
| Startup M1 none | Not started | CDP connection refused immediately after browser restart. Restore/release succeeded. A CDP-ready wait plus 3 s startup delay was added to the runner before the second lock; failure retained. |
| M1 none, first intended repetition | All 189 chunks, matching answer | Observer capture completed, but later inspection found 46 fetch guard denials and 3 network-route denials. Excluded under the user's guard-trip rule. Zero completed non-GET network requests. |
| M1 alpha.11, first intended repetition | Not started | `FETCH_WRITE_GUARD_TRIPPED` during preflight. Stopped; restore/release succeeded. The guard's attempted-request list and final network counter were not persisted for this failed process. No timing/hash/chunk outcome is available. |

The first version of the control helper checked completed network writes but did not reject accumulated replay fetch-denial entries. A stricter denial assertion was added before alpha.11 loaded the helper; it detected the trip. The already-running none process had loaded the older helper. Its retained raw record subsequently exposed its own denials. This is a control-harness error: the task should have stopped upon detecting the first trip, and the no-extension sample must not be presented as a valid control. No reruns followed the detected trip. Denial categories for the completed none replay were 6 telemetry POSTs and 40 other POSTs; no denied request path is published. Route denial counts overlap fetch/network protection layers and must not be summed as distinct attempted requests.

## Per-cell medians [min–max]

All cells have zero qualifying samples; no median or range can be estimated. The planned rotating orders were none→a11→main, a11→main→none, main→none→a11, separately for M1 and M2. Work stopped at the first alpha.11 preflight; main and all M2 arms were never attempted.

| Method | None | alpha.11 | Main |
|---|---|---|---|
| M1 | unavailable, $n=0$; one excluded completed observation | unavailable, $n=0$; preflight failed | unavailable, $n=0$ |
| M2 | unavailable, $n=0$ | unavailable, $n=0$ | unavailable, $n=0$ |

The following is the excluded observation, **not a per-cell benchmark estimate**:

| Attempt | loafBlockMs | loafMaxMs | loafCount | frame p95 ms | replay duration ms | keyMax ms | keyP95 ms | chunks | completed writes |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| M1 none, excluded | 76890 | 2916 | 345 | 333.3 | 121774.8 | 406 | 329.8 | 189 | 0 |

Answer hash matches the expected full SHA-256. No Butter stats (expected without extension); blockAdds 1158, seenMarks 0, remounts 2. DOM before: 207945 nodes, 10 turns, 3028 KaTeX roots; after: 194641 nodes, 9 turns, 2909 KaTeX roots. Counts include ChatGPT's hidden root, as in the recovered driver; turn count changes alone do not prove a history mismatch. Fixture identity checks passed.

LoAF attribution over M1's full observer window: render style/layout 74.5 s; forced style/layout 31.3 s; script excluding forced style/layout 8.5 s. These are attribution components with the original harness's conventions, not additive estimates of total wall time. The largest forced-layout source was a ChatGPT ResizeObserver callback (23.074 s). Raw source attribution stays local; numeric aggregates are exported.

Alpha.11's preflight had 9 rail ticks, 3870 seen elements, one visible scroller and empty `data-butter-off`. This confirms preflight activation/settings only. Stream-path engagement (`__butterStats`, stream blockAdds/seenMarks and remounts) was not measured. Main has no engagement observation.

## Ablations and conclusion

No ablations: neither method has a qualifying sample set, and the guard-trip stop rule prevents further live work. The one-perf-lock requirement could not cover the startup failure and retry in a single window; both windows and cleanup are disclosed. The minimum $n=3$ requirement is unmet because of the explicitly required safety stop, not early convergence or outlier removal.

No data supports selecting method, environment/ChatGPT or Butter regression as the cause. A different observed ChatGPT asset set is established; its performance impact is not. The recovered-driver differences narrow what a future authorized control must compare, but this aborted run does not establish Butter's stream behavior today.

## Publication and privacy

Only this directory and the run index are published through a temporary Git index and commit-tree on pinned origin/main; no PR. No shared checkout branch/index/working-tree changes. Commands and redacted actual output: [commands.md](commands.md). Numeric exports contain no strings/nulls. Privacy scan checks UUIDs, chat URLs, emails, credentials, private endpoints and captured text fragments; its counts are in `data/privacy-scan.json`. No raw captures/screenshots/prompt/answer text are published.

Final prepublication byte checks: shared status, branch and HEAD equal their initial captures; both staged extension copies pristine. Task-owned Snap runtime directories removed after successful restore. Private raw captures retained.
