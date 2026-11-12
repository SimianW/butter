# Benchmarks

## Latest benchmark: alpha.9 and alpha.11 (2026-11-04)

Butter 0.1.0-alpha.11 was compared with released 0.1.0-alpha.9 and a true no-extension control.
Later builds (alpha.12 and alpha.13) change only the popup, locale metadata and toolbar icon, so
these alpha.11 measurements still apply. The benchmark completed on November 4 in America/Toronto
(November 5 UTC); the final validator passed **73/73** checks.

Builds alpha.14 through alpha.20 regressed streaming blocking to about 66 s, close to the
no-extension control. The cause was the Dil answer-root selector from #24: its `:has()` in
`stream/containment.css` made Chromium restyle every block of the streaming answer on each update,
so a long answer's style work grew with the square of its length. Released alpha.11 still measures about 13 s on the same host today, so the
table below remains valid for alpha.11 through alpha.13. #94 fixes it: 13.6 s against main's 67.2 s
in a live replay ([run report](../notes/runs/2026-11-11-replay-blocking/report.md)).

### What the results mean

Streaming blocking fell from 76.4 s to 11.5 s, and classic-scrollbar dragging into unread history
fell from a 3.0 s p95 frame to 17 ms with no turns mounted while held. Sending from far up showed
the question in 3.4 s rather than 13.1 s. Opening settled in 27 s rather than 47 s, but the first
readable text was unchanged at about 3.4 s. Typing showed no meaningful improvement in this lab;
the slowest-key medians were all about 0.2–0.3 s.

There is a cost: after a classic-scrollbar drag into unread history, real text appeared about
4.3 s after release with Butter versus 0.2 s without it. Butter holds loading to keep the drag
smooth; ChatGPT must render the destination afterward. The native control had already stuttered
for seconds during the drag. These builds use different readiness checks and can land on different
rows, so release times are not an equal-destination speed comparison.

### Method and fixtures

- **Builds:** immutable released alpha.9 snapshot; released alpha.11 zip from main `37a2b45`
  (PR #11); and no extensions at all. The lab's usual “blank-head” actually contains alpha.7,
  so it was not used as the control. Alpha.11's zip SHA-256 is
  `8cc5476fdd0ac4748aa2b726dd0a1c1308f0b7ec6a63c3bd19dbd77c1f57a3ef`.
- **Environment:** Chromium 156.0.8078.47, Ubuntu 24.04.5 LTS, Linux 7.0.0-38-generic x64,
  Intel Core i5-10400 at 2.90 GHz, about 16.5 GB RAM, Xvfb and software rendering without GPU
  acceleration. Viewport 1440 × 1000 CSS pixels, scale factor 1, light theme. Browser, kernel,
  CPU and GPU/software-rendering state matched across the pause. The shared host was not CPU-isolated.
- **Fixtures:** a frozen nine-question math history for open, stream, typing, wheel, send and
  pagination tests; the full twelve-question math history for seek tests; and one frozen streamed
  answer. The nine-question load had about 208,000 DOM nodes including hidden roots. A separate
  home chat was used only for restoration. Fixtures contain no newly generated answers.
  Conversation identifiers, account details and captured chat text are excluded from the public archive.
- **Replay:** identical read-only conversation GET fixtures with the live app bundle/session,
  not offline HTML. The answer uses the original 189 SSE chunks, capping inter-chunk thinking gaps
  at 1500 ms. Its chunks and request body match the earlier recording; the recording JSON metadata
  differs. Local SSE responses, two fetch write guards and network denial of non-read methods keep
  simulated sends off the server. Local history pages have a fixed 50 ms delay.
- **Runs:** five full repetitions, plus an extra interleaved typing/replay repetition to complete
  dispatch-delay coverage. Build order rotates none → alpha.9 → alpha.11, alpha.9 → alpha.11 → none,
  then alpha.11 → none → alpha.9. Classic-scrollbar phases cover all scenarios; overlay phases
  cover dragging. The first driver failure split the none phase, so first-repetition streaming
  ran alpha.9 → none → alpha.11. Startup retries and interruption recovery also changed actual order.
- **Input:** whole-chat wheel steps of 8000 CSS pixels, requested 16 ms pauses, bottom → top → bottom
  with endpoints verified. Classic dragging uses 60 moves over 1.2 s; overlay uses 120 over 12 s.
  Streaming typing uses two ten-letter bursts at 120 ms spacing, followed by Backspaces; idle typing
  uses 54 fixed characters at 80 ms spacing. Only letters/Backspaces during the active stream count
  toward streaming key response; Enter is excluded. CDP acknowledgements can stretch input cadence
  when the renderer blocks, unlike the demo's fixed-clock dispatch.
- **Layout state:** alpha.11 explicitly grants layout consent. Cold tests clear stored layouts;
  warm tests visit content in the same session; stored tests reload after seeding layouts.
  Native baseline traversal uses roughly 60 spatial steps. After a failed alpha.11 stored precondition,
  setup changed to 70%-viewport steps, flushed outside timing, and verified all twelve layouts.
  The valid first cold/warm captures were kept; only the failed stored trial was retried.

### Readiness and metrics

- **First readable:** first rendered text after navigation. **Fully settled:** no long task for
  1500 ms and no pending math markers. Browser cache stays warm across same-session runs.
- **Frames:** requestAnimationFrame intervals; percentiles follow the existing harness's nearest-rank
  index convention. “Page frozen” sums Long Animation Frame `blockingDuration` over the replay;
  it is not one uninterrupted freeze. The longest LoAF is a different metric.
- **Input response:** keydown timestamp to next rendered frame/setTimeout callback, including
  rendering, rather than queue-only browser Event Timing. Dispatch delay separately measures
  event timestamp to the first capture listener and excludes OS-level queueing.
- **Drag readable:** native none/alpha.9 require two visible-text frames after release; alpha.11
  uses its shipped readiness diagnostic (target, math and quiet frames). Native destinations use
  estimated virtualizer row heights and can move to another row as history mounts; Butter uses a
  semantic target. “Never opened” is checked using the stricter proxy of no prior mount.
- **Rail readable:** the first question is within 8 px of the 64 px reading inset, without a busy
  marker or visible warp. **Send visible:** the new question is in the readable viewport after Enter;
  the composer is focused first and the actual pre-send position must be in the earlier half.
- **Earlier history:** starts with the last five questions, scrolls up until the first appears, then
  allows 1200 ms to settle. The fixture honors native page size 10 and Butter's size 2.

### Full results

Each numeric cell is the median [minimum–maximum], followed by valid sample count.
“n/a” means the feature does not exist in that arm: stored layouts for none/alpha.9, or the rail
for none. Classic and overlay scrollbar results are labelled separately. Failed or missing samples
are not zero-filled; all valid samples, including outliers, remain in the summaries.

| Scenario | Metric | ChatGPT as is | Butter alpha.9 | Butter alpha.11 |
|---|---|---:|---:|---:|
| 1. Open a long chat | Navigation → first readable text (ms) | 3447 [3206.5–3689.3], n=5 | 3410.1 [3266.8–3484.6], n=5 | 3480.8 [3261.8–3748.2], n=5 |
| 1. Open a long chat | Navigation → fully settled (ms) | 47381.1 [45527.1–59047.3], n=5 | 26994.6 [26068–28467.7], n=5 | 26978.1 [14634–28950.3], n=5 |
| 2. Streaming the recorded answer | Total long-animation-frame blocking duration (ms) | 76432.5 [75834–78250], n=6 | 10975.5 [7643–14592], n=6 | 11527.5 [10169–13409], n=6 |
| 2. Streaming the recorded answer | Longest long animation frame (ms) | 2733.0 [2582–4915], n=6 | 718.0 [678–767], n=6 | 731.5 [690–823], n=6 |
| 2. Streaming the recorded answer | Frame time p95 during recorded replay (ms) | 316.6 [300–316.8], n=6 | 50.0 [33.4–50], n=6 | 50.0 [49.9–50], n=6 |
| 2. Streaming the recorded answer | Final answer SHA-256 (sha256) | 6 hashes; identical | 6 hashes; identical | 6 hashes; identical |
| 3. Typing while an answer streams | Slowest keydown → next painted frame (ms) | 270.0 [247.2–333.6], n=6 | 195.2 [173.9–210.4], n=6 | 200.2 [187.7–321.1], n=6 |
| 3. Typing while an answer streams | Keydown → next painted frame p95 (ms) | 249.1 [233.4–322.4], n=6 | 186.7 [169.4–204.7], n=6 | 196.7 [185.2–300.1], n=6 |
| 3. Typing while an answer streams | Input dispatch delay p95 (ms) | 9 [8.4–10.3], n=5 | 4.7 [4.5–7.1], n=5 | 8.7 [2.4–9.7], n=6 |
| 4. Typing without a stream | Slowest keydown → next painted frame (ms) | 243.4 [228.7–432], n=6 | 213.1 [208.8–233.1], n=6 | 216.6 [148.8–265.6], n=6 |
| 4. Typing without a stream | Keydown → next painted frame p95 (ms) | 30.9 [27.4–188.5], n=6 | 21.0 [20.2–39.1], n=6 | 21.1 [19–35], n=6 |
| 4. Typing without a stream | Input dispatch delay p95 (ms) | 0.5 [0.5–2.3], n=5 | 1.5 [1.2–1.9], n=5 | 2.0 [0.8–3.1], n=6 |
| 5. Wheel-scrolling the whole chat | Frame time p95 (ms) | 2633.3 [183.3–2933.2], n=5 | 566.6 [133.3–649.9], n=5 | 283.3 [133.3–633.3], n=5 |
| 5. Wheel-scrolling the whole chat | Longest frame (ms) | 3516.6 [3483.2–3733.2], n=5 | 1716.6 [1699.9–1799.9], n=5 | 1816.6 [1766.6–1883.2], n=5 |
| 6. Scrollbar drag (classic): Never opened | Held-frame p95 (ms) | 3033.3 [2883.1–3133.2], n=5 | 1233.2 [1083.3–1449.9], n=5 | 16.8 [16.7–16.8], n=5 |
| 6. Scrollbar drag (classic): Never opened | Turn mounts while thumb held (count) | 7 [7–7], n=5 | 7 [7–7], n=5 | 0 [0–0], n=5 |
| 6. Scrollbar drag (classic): Never opened | Release → readable (ms) | 154.9 [149.9–189.2], n=5 | 178.7 [149–263.3], n=5 | 4309.9 [4106.6–4356.5], n=5 |
| 6. Scrollbar drag (classic): Already seen this session | Held-frame p95 (ms) | 250 [233.3–1883.3], n=5 | 1000 [833.3–1149.9], n=5 | 16.8 [16.7–16.8], n=5 |
| 6. Scrollbar drag (classic): Already seen this session | Turn mounts while thumb held (count) | 5 [5–5], n=5 | 5 [5–5], n=5 | 0 [0–0], n=5 |
| 6. Scrollbar drag (classic): Already seen this session | Release → readable (ms) | 53.6 [52.9–80.3], n=5 | 228.4 [226.7–1898.3], n=5 | 1169.5 [1153.4–3758.4], n=5 |
| 6. Scrollbar drag (classic): Seen in an earlier session, after reload | Held-frame p95 (ms) | n/a | n/a | 16.7 [16.7–16.8], n=5 |
| 6. Scrollbar drag (classic): Seen in an earlier session, after reload | Turn mounts while thumb held (count) | n/a | n/a | 0 [0–0], n=5 |
| 6. Scrollbar drag (classic): Seen in an earlier session, after reload | Release → readable (ms) | n/a | n/a | 1528.5 [1426.2–1991.6], n=5 |
| 6. Scrollbar drag (overlay): Never opened | Held-frame p95 (ms) | 16.8 [16.8–16.8], n=5 | 33.4 [33.3–33.4], n=5 | 16.8 [16.7–16.8], n=5 |
| 6. Scrollbar drag (overlay): Never opened | Turn mounts while thumb held (count) | 7 [7–7], n=5 | 7 [7–7], n=5 | 0 [0–0], n=5 |
| 6. Scrollbar drag (overlay): Never opened | Release → readable (ms) | 113.6 [112.3–120.7], n=5 | 536.2 [523.5–540.1], n=5 | 4408.6 [4328.2–4544.8], n=5 |
| 6. Scrollbar drag (overlay): Already seen this session | Held-frame p95 (ms) | 16.8 [16.8–16.8], n=5 | 50 [50–50], n=5 | 16.8 [16.7–16.8], n=5 |
| 6. Scrollbar drag (overlay): Already seen this session | Turn mounts while thumb held (count) | 6 [6–6], n=5 | 6 [6–6], n=5 | 0 [0–0], n=5 |
| 6. Scrollbar drag (overlay): Already seen this session | Release → readable (ms) | 217.7 [206.3–255.2], n=5 | 151 [150–162.4], n=5 | 1329.3 [1327–1410.8], n=5 |
| 6. Scrollbar drag (overlay): Seen in an earlier session, after reload | Held-frame p95 (ms) | n/a | n/a | 16.8 [16.7–16.8], n=5 |
| 6. Scrollbar drag (overlay): Seen in an earlier session, after reload | Turn mounts while thumb held (count) | n/a | n/a | 0 [0–0], n=5 |
| 6. Scrollbar drag (overlay): Seen in an earlier session, after reload | Release → readable (ms) | n/a | n/a | 1708.9 [1664.7–1795.5], n=5 |
| 7. Early history-rail click | Click → early question readable (ms) | n/a | 3951.4 [3918–3979.6], n=5 | 3325.4 [2614.9–3910.3], n=5 |
| 8. Send from far up a long chat | Enter → new question visible (ms) | 13080.8 [12081.3–17138.1], n=5 | 4067.5 [3985.2–4124.5], n=5 | 3398.9 [3210.2–3810.9], n=5 |
| 9. Scroll up while earlier history loads | Frame time p95 while earlier pages load (ms) | 66.7 [66.6–116.7], n=5 | 116.7 [100–133.3], n=5 | 116.7 [83.4–150], n=5 |
| 9. Scroll up while earlier history loads | Longest frame while earlier pages load (ms) | 8366.4 [8133–8733], n=5 | 2283.3 [2266.6–2333.3], n=5 | 2299.9 [2249.9–2383.3], n=5 |

### Pause, recovery and limitations

This was a **paused and resumed** benchmark with reused baseline captures, not one uninterrupted
interleaved session. It paused at 05:10 UTC on November 4. The first resume at 21:38 UTC stopped
because live math history had changed. The user confirmed three messages sent from another device
and authorized new audit baselines; the live check passed at 22:27 UTC. Frozen fixtures kept the
measured input unchanged. Valid none/alpha.9 repetition-1 captures were reused; later baseline runs
and all alpha.11 runs were measured after resume. Old candidate “latest” captures were excluded.

A prior audit's user-message count belonged to the math chat, not the restoration chat; counts were
not altered to make them match. Final audits forbade removals and accepted additions only outside
benchmark-owned lock windows. Original snapshots and hashes remain private. Pre-pause lock timing
uses a conservative envelope; the first failed resume uses acquire/release logs, and later phases
record owner/start/end with conservative boundary rounding. Final audit and cleanup passed.

The report retains failed attempts and outliers. Startup checks based on process argv could not
verify Chromium's switches and were replaced by chrome://version checks before timing. Initial
send detection had hidden-root/SSE-replacement errors. Held-boundary probes ending at a CDP
acknowledgement were superseded by actual pointer-up boundaries. A user interruption during
alpha.9 classic repetition 4 preserved valid cold/nonstream data; only unfinished warm/send/stream
slots resumed after owner-verified restoration and lock release. A none-only 800 px wheel pilot was
excluded from all summaries.

During resumed alpha.9 classic repetition 3, warm setup exposed live nonfixture messages. That
capture was excluded; its verified cold capture was retained and the next send was stopped before
capture. Four navigation checks and a full functional sequence did not reproduce the leak, so no
product cause is claimed. The harness then blocked singular live-history reads and account-sync
WebSockets, bypassed service workers and enforced fixture-ID checks. This instrumentation change is
a method deviation; old baseline captures remain as authorized, with their original preconditions.

The original none/alpha.9 repetition-1 dispatch observers were missing (four observations).
Repetitions 2–6 provide five valid dispatch samples per baseline; alpha.11 has six. All six valid
paint/replay samples per arm remain. All 18 final answer textContent hashes (including KaTeX
representations) match: `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68`.

Absolute timings do not predict typical laptops, Windows or macOS. The fixture, 208,000-node state,
pinned viewport, 8000 px wheel steps, warm caches and rendering/input instrumentation differ from
the earlier published benchmark (about 90,000 nodes and 400 px wheel steps). Native warm dragging,
especially with overlay scrollbars, can already be responsive. Do not infer a universal speedup,
a typing improvement, or a directly comparable release-time win from these tables.

The [curated run archive](../notes/runs/2026-11-04-big-benchmark/report.md) includes provenance,
per-run numeric results, excluded-attempt notes and the final validator result. Raw captures,
private audit snapshots, command logs and account screenshots are deliberately not committed.

## Earlier benchmark (0.1.0-alpha)

Historical published results for the first alpha, not measurements of the current build. The README demo also comes from this earlier setup.

### Setup

The same recorded ChatGPT answer is replayed into a 9-turn math chat (~90k DOM nodes) while the
harness scrolls and types. Both runs get identical keyboard and mouse-wheel input.

Lab Chromium 156 on Linux without GPU, so absolute numbers are worse than on a typical laptop;
compare the ratios. Not yet measured on Windows or macOS:
[`lab/measure-console.js`](../lab/measure-console.js) measures it on your own machine.

### Results

| Metric | ChatGPT as is | With Butter |
|---|---|---|
| Main thread blocked during the answer | 75.6 s | 6.3 s |
| Frame time p95 while scrolling | 300 ms | 33 ms |
| Slowest keystroke while typing | 3.5 s | 0.8 s |
| Longest single freeze | 2.1 s | 0.6 s |
| Longest frame scrolling the whole chat | 3.6 s | 0.7 s |

The fully streamed answer is byte-identical with and without the extension.

In the recorded [demo video](media/demo-en.mp4) the page without the extension was frozen for
75.8 s in total during the answer, with Butter for 8.0 s.

### Sources

- [REPORT.md](REPORT.md): full test report in Chinese, with comparison against other extensions,
  ablations, method and risks. Chinese demo video: [media/demo-zh.mp4](media/demo-zh.mp4).
- [oss-survey.md](oss-survey.md): survey of existing long-chat extensions.
- [`results/`](../results): result tables from every benchmark run.
