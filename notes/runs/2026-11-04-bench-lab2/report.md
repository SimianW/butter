> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter lab2 benchmark: none vs alpha.9 vs latest

Run date 2026-11-04 (UTC). Final matrix: 10:59:16 to 13:07:30 UTC. Raw captures are private under `(not archived)` and must not be published (they contain account UI).

## Setup and provenance

| Build | What was loaded | Hashes |
|---|---|---|
| **none** | No extension (`LAB_EXTENSIONS` empty). `butter-blank-head` (alpha.7) was **not** used. | n/a |
| **alpha9** | `0.1.0-alpha.9`, copied from `~/snap/chromium/common/butter-bench-final-alpha9` | file index `15fc9231ce78656ee6f70a7f3a7d436fa022b60ec2c4b69f0d92e6cb2f4cbe3b`, byte-identical to the lab1 archive snapshot |
| **latest** | `0.1.0-alpha.10+next.2`, `~/butter-wip/butter-0.1.0-alpha.10+next.2.zip`, root `butter/`; commit `6e8362305f0a68097458436351c9920a4645f12a` on `t3/seek-preview` | zip SHA-256 `ea647a8e8e9e2fc04ebe01d388ec9e591cf0ab03d1ce8286a9a26435fb6ea2ee`; file index `ee2900c350950c753a5b796144175343cc7825561bea18247ead2e836a156d44` (32 files) |

The file-index hash is the SHA-256 of canonical JSON `{relative path: per-file SHA-256}` with keys sorted and no whitespace. Each phase copied the build into `~/snap/chromium/common/butter-bench-lab2-<build>`, and the startup verifier read `chrome://version` to confirm the `--load-extension` path (none: no `--load-extension`) and whether the overlay flag was present.

**Machine:** Intel i5-10400 (12 threads), 16 GB, Linux 7.0.0-38, Chromium 156.0.8078.47 (snap). Software rendering: ANGLE on Mesa llvmpipe (LLVM 20.1.2), and Chromium reports GPU compositing as `disabled_software`. Headed browser on Xvfb `:98`, 1600×1000 (60 Hz per the lab notes; frame times quantize to multiples of ~16.7 ms). Viewport 1440×1000, light theme. **Compare the builds with each other. These are not absolute numbers for user hardware.**

**Lab:** lab2 (account 2) only; lab1 was not touched. Every timed phase held `lab-lock --lab 2 --perf`, so the lab2 lock and the machine-wide perf lock. After each phase: restart lab2 with no extension, run `lab-restore --lab 2`, verify the home URL, empty composer and native fetch, then release. Locks were free at the end.

**Fixtures** (served locally to the page for every build; identical across builds):

| Fixture | Original (lab1 archive) SHA-256 | lab2 copy SHA-256 |
|---|---|---|
| `raw/math-nine.json` (9 questions, 45 messages) | `359b4fe3…d345` | `8cb3a11f9dc9cbfa220a616d3f44ea04de9b546238aa6fc4d5471694db5d5631` |
| `raw/seek-twelve.json` (12 questions) | `8423f0f1…b2ed` | `ede36643e99cc3e92a3325bb981b3fa5dff277e777286e53aa0aff0569ce305a` |
| `raw/recording.json` (189-chunk SSE) | `36b773bf…a05c` | `d694ed376d1558211972b5d9ab7c67cfb6953dd3072fc1e625956ae5df38c809` |
| `raw/sidebar-conversations.json` (frozen sidebar list, see deviations) | n/a | `98162f21d03db1fcb9abc9be1ac28e93f88c59a3838c0ea3c68191c1c46fab51` |

The lab2 copies differ from the originals only in account identifiers: the conversation ID becomes lab2's `math9` chat (`<id>`), the project ID becomes lab2's project "<prompt text>" (`<project>`), and the top-level `owner` is set to `null`. Message IDs, message content and chunk timing are verified identical (`raw/fixture-provenance.json`). The final answer hash, `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68`, matches the lab1 run, and all 15 streamed answers here share it.

## Method

- **Matrix:** 5 repetitions. In each, a classic-scrollbar phase per build runs all scenarios (open, idle typing, wheel, rail, earlier-history loading, seek, local send, recorded stream), then an overlay-scrollbar seek phase per build. Build order rotates each repetition: rep 1 none→alpha9→latest, rep 2 alpha9→latest→none, rep 3 latest→none→alpha9, and so on. Every one of the 30 final phases succeeded on its first attempt.
- **Validity** (`slot.py`): history fully loaded (React entries = 9, or 12 for seek on every load); wheel reached both ends; earlier history reached `[t01]`; all 189 chunks sent and replay ended; no conversation write reached the network; answer complete; seek kinds present with metrics; no seek precondition failure; no 429 or usage notice. Invalid captures move to `raw/excluded/` with a reason.
- **Safety:** no real message was sent. Every send was the local SSE replay behind two in-page fetch guards plus a Playwright route that aborts every non-GET/HEAD/OPTIONS request. A read-only before/after server audit of lab2's three fixture chats (`math12`, `ats12`, `math9`) found all node IDs and `current_node` unchanged (48/12, 42/12, 35/9 nodes/users).
- **Stream-completion metric (new):** the replay records when it enqueues the `message_stream_complete` SSE event. The longest `longtask` entry and the longest LoAF starting between −50 ms and +5000 ms of that moment are reported. No synthetic wheel or typing starts after that event, and the run waits 5 s after `[DONE]`.
- Scenario definitions otherwise follow the lab1 harness (`(not archived)`). The per-metric definitions are in `results.json`.

## Deviations from the lab1 harness, and why

1. **Account-2 fixture IDs.** Account 2 cannot open account 1's conversation or project: the app got a 403 on the project and a 404 on the conversation, then redirected to `/`. With the account-1 `owner` left in, the page rendered nothing. Only those identifiers were changed (see Fixtures). The same frozen content is served, so this is still the same fixture.
2. **Frozen sidebar list.** In the first matrix attempt, `GET /backend-api/conversations` (ChatGPT's sidebar list, not our fixture) returned **429** twice: at 10:00:25 during alpha9 rep 2, and at 10:28:03 during none rep 2. The harness aborted both captures, released the locks and backed off 15 minutes, then 30. I then stopped that driver (exact PID), waited out the full 30-minute backoff, captured the sidebar list once, and from then on served it locally for every build. **The matrix was restarted from rep 1**, so all five final repetitions share identical conditions. The ~19 rep 1–2 captures from the live-sidebar attempt are kept in `raw/superseded-live-sidebar/` and excluded. No 429 or usage notice occurred after the change.
3. **Seek seeding traversal dwells 300 ms per step** (lab1: two frames). latest records seek layouts only in idle time while a turn is still rendered. With the lab1 traversal, a shakedown recorded only 3 of 12 questions, and the "seen in an earlier session" drag could not reach a stored destination. The dwell applies to every build.
4. **A latest seek that hits its own internal deadline but becomes readable is kept as a valid sample** (lab1 rejected these). Dropping them would bias latest favorably. 2 of 5 classic cold drags timed out (10.5 s and 10.4 s). Counts are in the table.
5. **No 6th repetition.** All five fresh repetitions captured the dispatch-delay probe, so the lab1 rep-6 supplement was not needed.
6. **Stream wheel/typing stops at `message_stream_complete`**, so the completion window is free of synthetic input. The run waits 5 s after the stream (lab1: 3 s).

## Results (median [min–max], n = valid runs)

| Scenario | Metric | none | alpha9 | latest |
|---|---|---|---|---|
| 1. Open a long chat | Navigation → first readable text (ms) | 3575 [3522–4270] n=5 | 3606 [3530–3642] n=5 | 3566 [3496–3636] n=5 |
| 1. Open a long chat | Navigation → settled (ms) | 11398 [11122–12636] n=5 | 8526 [8464–11081] n=5 | 8670 [8364–9026] n=5 |
| 2. Streaming a recorded answer | Main-thread blocked time (sum of LoAF blockingDuration) (ms) | 75176 [74775–85381] n=5 | 7977 [7454–9060] n=5 | 12907 [12751–13101] n=5 |
| 2. Streaming a recorded answer | Longest freeze (longest long animation frame) (ms) | 2622 [2547–7521] n=5 | 698 [679–729] n=5 | 1321 [1318–1428] n=5 |
| 2. Streaming a recorded answer | Frame time p95 during replay (ms) | 300 [300–317] n=5 | 33.4 [33.3–33.4] n=5 | 50.0 [50.0–50.0] n=5 |
| 2. Streaming a recorded answer | Longest main-thread task at stream completion (ms) | 1159 [1128–1228] n=5 | 578 [558–605] n=5 | 1141 [1127–1236] n=5 |
| 2. Streaming a recorded answer | Longest long animation frame at stream completion (ms) | 1462 [1425–1528] n=5 | 698 [679–729] n=5 | 1321 [1318–1428] n=5 |
| 2. Streaming a recorded answer | Final answer SHA-256 (sha256) | n=5, 1 distinct | n=5, 1 distinct | n=5, 1 distinct |
| <prompt text> | Slowest keydown → next frame (ms) | 304 [280–2215] n=5 | 192 [186–198] n=5 | 222 [220–236] n=5 |
| <prompt text> | Keydown → next frame p95 (ms) | 297 [272–1087] n=5 | 185 [179–187] n=5 | 213 [205–230] n=5 |
| <prompt text> | Input dispatch delay p95 (ms) | 11.9 [10.9–164] n=5 | 6.7 [6.1–7.3] n=5 | 8.2 [8.1–13.4] n=5 |
| <prompt text> | Slowest keydown → next frame (ms) | 5447 [2802–7418] n=5 | 422 [336–617] n=5 | 467 [460–722] n=5 |
| <prompt text> | Keydown → next frame p95 (ms) | 271 [143–2748] n=5 | 162 [156–164] n=5 | 193 [188–383] n=5 |
| <prompt text> | Input dispatch delay p95 (ms) | 19.5 [2.6–21.8] n=5 | 2.2 [2.0–4.1] n=5 | 3.0 [2.0–4.6] n=5 |
| <prompt text> | Frame time p95 (ms) | 167 [167–183] n=5 | 150 [133–183] n=5 | 150 [133–167] n=5 |
| <prompt text> | Longest frame (ms) | 3416 [3366–3483] n=5 | 2583 [2567–2617] n=5 | 2483 [1867–2716] n=5 |
| 6. Scrollbar drag (classic): never opened | Frame time p95 while thumb held (ms) | 3083 [2817–3233] n=5 | 1467 [1317–1900] n=5 | 33.4 [16.8–117] n=5 |
| 6. Scrollbar drag (classic): never opened | Turn mounts while thumb held (count) | 7.0 [7.0–7.0] n=5 | 7.0 [7.0–7.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): never opened | Release → readable (ms) | 141 [131–165] n=5 | 132 [118–395] n=5 | 4638 [4488–10523] n=5 |
| 6. Scrollbar drag (classic): seen this session | Frame time p95 while thumb held (ms) | 167 [167–183] n=5 | 1000 [1000–1200] n=5 | 16.8 [16.8–16.8] n=5 |
| 6. Scrollbar drag (classic): seen this session | Turn mounts while thumb held (count) | 5.0 [5.0–5.0] n=5 | 5.0 [5.0–5.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): seen this session | Release → readable (ms) | 54.6 [52.6–55.3] n=5 | 233 [223–261] n=5 | 1470 [1003–1752] n=5 |
| 6. Scrollbar drag (classic): seen in an earlier session | Frame time p95 while thumb held (ms) | n/a | n/a | 50.1 [33.4–83.3] n=5 |
| 6. Scrollbar drag (classic): seen in an earlier session | Turn mounts while thumb held (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): seen in an earlier session | Release → readable (ms) | n/a | n/a | 2425 [1791–2979] n=5 |
| 6. Scrollbar drag (overlay): never opened | Frame time p95 while thumb held (ms) | 33.4 [33.4–33.4] n=5 | 50.1 [50.0–66.6] n=5 | 16.8 [16.7–16.8] n=5 |
| 6. Scrollbar drag (overlay): never opened | Turn mounts while thumb held (count) | 7.0 [7.0–7.0] n=5 | 7.0 [7.0–7.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): never opened | Release → readable (ms) | 117 [114–122] n=5 | 223 [221–255] n=5 | 4828 [4562–4861] n=5 |
| 6. Scrollbar drag (overlay): seen this session | Frame time p95 while thumb held (ms) | 33.4 [33.4–33.4] n=5 | 50.1 [50.1–50.1] n=5 | 16.7 [16.7–16.8] n=5 |
| 6. Scrollbar drag (overlay): seen this session | Turn mounts while thumb held (count) | 5.0 [5.0–5.0] n=5 | 5.0 [5.0–5.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): seen this session | Release → readable (ms) | 49.0 [47.2–57.9] n=5 | 130 [126–132] n=5 | 2264 [1561–2394] n=5 |
| 6. Scrollbar drag (overlay): seen in an earlier session | Frame time p95 while thumb held (ms) | n/a | n/a | 16.8 [16.8–16.8] n=5 |
| 6. Scrollbar drag (overlay): seen in an earlier session | Turn mounts while thumb held (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): seen in an earlier session | Release → readable (ms) | n/a | n/a | 4128 [2362–4406] n=5 |
| 6. Scrollbar drag (classic): cold | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–1.0] n=5 |
| 6. Scrollbar drag (classic): warm | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): stored | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): cold | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): warm | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): stored | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| <prompt text> | Click → first question readable (ms) | n/a | 3960 [3858–4008] n=5 | 2612 [1963–3263] n=5 |
| <prompt text> | Enter → new question visible (ms) | 12164 [10597–19217] n=5 | 3908 [3871–4053] n=5 | 4060 [4052–4080] n=5 |
| <prompt text> | Frame time p95 while earlier pages load (ms) | 50.1 [50.1–167] n=5 | 83.3 [66.6–117] n=5 | 117 [83.3–167] n=5 |
| <prompt text> | Longest frame while earlier pages load (ms) | 7116 [7066–7166] n=5 | 2317 [2267–2350] n=5 | 2333 [2316–2350] n=5 |

Frame p95 values are quantized by the 60 Hz frame clock (16.7 / 33.4 / 50 ms …). The deadline rows count, per run, whether latest's seek hit its internal deadline.

**Where the drags land** (question visible after release, 5 runs each): none and alpha9 cold → **Q1** (5/5, both modes; the native thumb lands near the top as the estimated geometry expands), warm → Q6. latest cold → Q7 (classic 3/5, with Q4 in the 2 timed-out runs; overlay 5/5), warm and stored → Q7. **Release → readable therefore compares different destinations and different readiness signals** (native: two frames of visible text; latest: its shipped seek diagnostic). Do not read it as a like-for-like arrival-speed comparison.

**Stream blocked time split** (medians): inside the completion window none 1456 ms, alpha9 648 ms, latest 1287 ms. Outside it: none 73.7 s, alpha9 7.3 s, latest 11.5 s. Longest LoAF outside the completion window: none 2622 ms, alpha9 539 ms, latest 593 ms. latest's single worst freeze in the stream is the completion frame.

## Invalid and excluded runs

| What | Build / rep / kind | Reason | Where |
|---|---|---|---|
| Shakedown (rep 0), all builds | latest classic full; alpha9 classic full; none overlay | Harness shakedown before the matrix; never part of the medians | `raw/shakedown/` |
| Shakedown cold seek (try 2) | latest r0 seek | Seek timed out; at that point the harness still rejected timed-out seeks (changed afterwards, see deviation 4) | `raw/excluded/` |
| Shakedown stream (try 1) | latest r0 stream | Completion window was anchored on `[DONE]` and missed the completion task; re-anchored | `raw/shakedown/stream-latest-try1-*` |
| Rate-limited | alpha9 rep 2 nonstream (first attempt) | HTTP 429 on `/backend-api/conversations` at 10:00:25Z | `raw/excluded/`, `raw/rate-limit.jsonl` |
| Rate-limited | none rep 2 nonstream (first attempt) | HTTP 429 on `/backend-api/conversations` at 10:28:03Z | `raw/excluded/`, `raw/rate-limit.jsonl` |
| Superseded live-sidebar attempt | all of reps 1–2 captured before the frozen sidebar (19 JSON captures plus stream files) | Matrix restarted from rep 1 with the frozen sidebar list so every repetition shares conditions | `raw/superseded-live-sidebar/` |
| Setup probes | `probe-*` | Functional checks of fixture rendering on lab2; not timing runs | `raw/probe-*` |

In the final matrix, no capture was invalid, no 429 or usage notice appeared, and every applicable metric has n = 5 for every build.

## Plain-language summary

**latest vs none (no extension):** latest is much smoother almost everywhere. While an answer streams, main-thread blocked time falls from 75 s to 12.9 s (−83%), the longest freeze from 2.6 s to 1.3 s, and frame p95 from 300 ms to 50 ms. Typing stays responsive: idle-typing worst case 5.4 s → 0.47 s, and during a stream p95 297 → 213 ms. Sending from far up shows the new question in 4.1 s instead of 12.2 s. Dragging the classic scrollbar into a never-opened area runs at a 33 ms p95 frame instead of 3.1 s, with 0 turn mounts while held instead of 7. Opening the chat settles in 8.7 s instead of 11.4 s, with first text at the same time (~3.6 s). Exceptions, where latest is **worse than none**:
- Release → readable after a drag: 4.6–4.8 s cold, 1.5–2.3 s warm, 2.4–4.1 s stored. Native shows text within 0.05–0.15 s, but often at the wrong question (cold lands on Q1).
- Earlier-history loading frame p95: 117 vs 50 ms, though the longest frame is 2.3 s vs 7.1 s.
- The longest task at stream completion is no better than none (1141 vs 1159 ms).

**latest vs alpha9:** this is a **mixed result with real regressions**.
- *Better in latest:* scrollbar drag while held (classic cold p95 33 ms vs 1467 ms; warm 16.8 vs 1000 ms; overlay 16.8 vs 50 ms; 0 mounts vs 7 or 5). History-rail click → readable is 2.6 s vs 4.0 s (−34%). The longest wheel frame is slightly better (2.48 vs 2.58 s).
- *Worse in latest (regressions):*
  - **Streaming:** blocked time 12.9 s vs 8.0 s (+62%), longest freeze 1.32 s vs 0.70 s (+89%), frame p95 50 vs 33 ms.
  - **Long task at stream completion:** 1141 ms vs 578 ms, about 2× alpha9 and back to the no-extension level. This matches the latest change that renders never-rendered blocks at completion. But most of the extra blocked time (+4.2 s) is spread over the stream, outside the completion window, so the regression is not only at completion.
  - **Typing:** during a stream p95 213 vs 185 ms (slowest 222 vs 192 ms); idle p95 193 vs 162 ms.
  - **Earlier-history loading:** frame p95 117 vs 83 ms.
  - **Send from far up:** 4.06 vs 3.91 s (+4%, small but consistent).
  - Open → settled is about the same (8.67 vs 8.53 s).
- Drag release → readable is not comparable (different destination, different readiness signal). In absolute terms, latest takes seconds after release, while alpha9's native scroll shows *some* text within ~0.12–0.4 s (medians 0.13–0.23 s).

## Caveats

- One machine, software rendering, headed Xvfb, Chromium 156. Five interleaved repetitions in one session. The ranges are tight for most metrics; none's stream and typing metrics have heavy outliers (for example the longest freeze ranges 2.5–7.5 s).
- Both fixtures are frozen and served locally. The nine-question chat renders ~104k DOM nodes on lab2 (lab1 reported ~208k including a hidden root), so absolute values differ from the lab1 run.
- Dispatch delay is the keydown timeStamp to listener entry, not OS input latency. The keydown → next-frame numbers include rendering.
