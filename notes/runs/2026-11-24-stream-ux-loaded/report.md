# Butter on an opened long chat: prototype pvh against head — 2026-11-24 (stage 5b)

Lab run; no file under `extension/` changed. `pvh` is the veil + late hydration prototype of
[2026-11-24-stream-veil](../2026-11-24-stream-veil/report.md) (`pvh.patch`). The send guard was on in
every connection and no message was sent. Raw captures stay in
`~/.local/share/chatgpt-lab/captures/2026-11-24-stream-ux-loaded/`.

## Result

- **L1:** the late hydration does not run when a long chat is opened. On `math12` (lab 2),
  `data-butter-hydrated` stayed 0 and `data-butter-hydrate-pending` stayed 0 for 40 s. No block ever
  had `data-butter-unrendered`, `-veil` or `-measure`, with pvh or with head.
  - This comes from the code: `hold()` only runs for a block that was skipped
    (`content-visibility: auto`) before it was first laid out. On an opened chat a block becomes
    `auto` only after it is marked seen, so no block is ever held.
  - Each build path gives a new extension id, so no stored layout record existed. A chat reopened
    with a stored layout record (inline `content-visibility: auto` from the seek layout cache) was
    **not** tested.
- **L2:** rail jumps behave the same on both builds. **Both failed the same 6 of 30 jumps on
  `math12`** (`target-unmounted`: from the top and from the bottom to questions 0, 1 and 2; the chat
  reaches the target's region and is pulled back to its end, three times). These failures are new
  since the 11-19 run, and head has them too, so pvh did not cause them.
- **L3 and L4:** seek landing, seek pin and wheel scrolling all pass with pvh, with the same landings
  as the earlier head runs.
- **L5:** typing with pvh is no worse than head.
- **Not explained:** in the 40 s after the first turn appears, pvh blocked the page for 2100.7 ms
  against head's 1137.1 ms. All of it fell in the first 10 s, and none of it was attributed to
  Butter's scripts. With one run each, this cannot be told from noise.

## L1: an opened chat, 40 s with no input (`stream-loaded-probe.mjs`, lab 2, perf lock)

Both builds opened `math12` at its end and stayed pinned there.

- **Height and scroll position:** during the page's own load, the page grew once in about the first
  2 s and `scrollTop` followed it exactly. pvh grew +3065 px (65543 to 68608). Head grew +2012 px and
  then +34 px (to 67589). Nothing changed after 2.5 s in either build.
- **What is under the viewport's centre:** the point hit a turn, not an answer block. That turn moved
  up 2036 px with pvh and 2046 px with head, once, in the first ~2 s, and never again.
- **Marks:** 445 blocks had `data-butter-seen` with pvh. Head's count went 445, then 284, then 401.

Long Animation Frames, by window (one run each):

| Window | pvh | head |
|---|---|---|
| Navigation to first turn | 16 frames, 2308.8 ms blocking, longest 1024.3 ms | 13 frames, 2591.4 ms blocking, longest 963 ms |
| 40 s after first turn | 11 frames, 2100.7 ms blocking, longest 1080.5 ms at +486 ms | 8 frames, 1137.1 ms blocking, longest 665.4 ms at +1192 ms |
| 10 s to 40 s | 0 frames | 0 frames |
| Forced layout from ChatGPT's scripts (40 s window) | 1120 ms | 526 ms |

## L2: rail jumps (`rail-jump-live.mjs`, `FIXTURES=math12`, dev builds)

Both builds exited 1.

| | pvh-dev | head-dev |
|---|---|---|
| Jumps | 30 | 30 |
| Clean | 24 | 24 |
| Failed (`target-unmounted`) | 6 | 6 |
| Visible detour | 1 (one of the 6 failed) | 0 |
| `anchoringOn` | 0 of 27 | 0 of 27 |
| Clean jumps' end time, median / max | 3866 / 8588 ms | 3876 / 7370 ms |
| Largest frame gap | 4579 ms | 3119 ms |

- **The 6 failures:** jumps from the top and from the bottom to questions 0, 1 and 2. Every one ended
  at the chat's end (scrollTop about 347.4k–348.8k). The position traces show the chat reaching the
  target's region (for question 0: scrollTop 20, then 385) and returning to the end about 1 s later,
  three times per jump.
- **pvh's visible detour:** it is the bottom-to-question-1 jump, which also had 1 loss and 3 samples
  after completion.
- **Jumps during the first seconds after opening:** the script's reload-phase jumps start as soon as
  the rail appears. They were clean on both builds (top to 4: 6996 ms pvh, 6496 ms head; bottom to 0:
  4818 ms, 4715 ms).
- **Earlier head run:** 11-19 `live-recheck` (head `e09235b`) had 54 clean jumps on `math9` and
  `math12`.

## L3: scrollbar hold and release

- **`seek-landing-live.mjs`, pvh:** 5 of 5 PASS.
  - Landed on questions 10 (+16828 px), 6, 7, 5 and 7.
  - Release to readable: 93, 3266, 4598, 2701 and 2906 ms.
  - In trial 1 ChatGPT pulled the chat back to its end before the thumb was pressed. The 11-22 run
    shows the same pull at 0.1–0.2.
- **Head reference, 11-19 `live-recheck/seek-landing.log`:** 5 of 5 PASS, questions 3, 6, 7, 5, 7,
  readable 3170, 2500, 3143, 3306 and 2643 ms.
  - pvh's trial 3 (4598 ms) is outside the 11-19 spread but inside the 11-22 spread (3050–6116 ms).
- **`seek-pin-live.mjs`, pvh:** 4 of 4 PASS, 0 pulled to the end, all 4 landed on the previewed
  question (7, 6, 7, 0).
- **Head reference, 11-23 `seek-pin-fix/run-c-fixed-est.log`:** 12 of 12 PASS, 0 pulled. Its first
  four trials landed on the same questions.

## L4: wheel scrolling (`wheel-jump-live.mjs`, `ats12`, `LOADS=2`)

- **pvh:** 2 of 2 loads PASS. Each opened at the end and reached the end in 58 steps, with 0 jumps
  back. scrollHeight 10438–10458.
- **Head reference, 11-19 `live-recheck/wheel-ats12.log`:** 4 of 4 PASS, 57, 57, 25 and 57 steps,
  scrollHeight 10306–10358.

## L5: typing (`ats12`, 41 keys starting 3.1 s after the first turn)

| | pvh | head (typing part of the L1 head run) |
|---|---|---|
| Keydown to next frame, p50 / p95 / max | 10.9 / 57.9 / 180 ms | 12.4 / 71.6 / 196.9 ms |
| Longest keydown (Event Timing) | 160 ms | 176 ms |
| Long Animation Frames | 5, blocking 224 ms, longest 148.5 ms | 4, blocking 347.3 ms, longest 214.1 ms |

pvh's hydration counters were 0 before and after typing. `typing-lag.mjs` was not run: it is
hardwired to lab 1's port and to the old launcher, and it connects without the send guard.

In the head typing run the probe counted 3 "send attempts". That count lumped ChatGPT's typing-time
`/conversation/prepare` requests in with real sends, all of which the guard blocked. The counter was
then split: the pvh run shows 0 sends and 1 prepare. Enter was never pressed.

## pvh against head

| Check | pvh | head | Head source |
|---|---|---|---|
| L1 blocks hydrated (40 s) | 0 | n/a | today |
| L1 view shift after 2.5 s | 0 px | 0 px | today |
| L1 blocking, 40 s window | 2100.7 ms | 1137.1 ms | today |
| L1 longest frame | 1080.5 ms | 665.4 ms | today |
| L2 jumps failed / visible detour | 6 / 1 | 6 / 0 | today |
| L3 seek-landing | 5 of 5 | 5 of 5 | 11-19 |
| L3 seek-pin | 4 of 4, 0 pulled | 12 of 12, 0 pulled | 11-23 |
| L4 wheel loads failed | 0 of 2 | 0 of 4 | 11-19 |
| L5 keydown p95 | 57.9 ms | 71.6 ms | today |

## Environment

- **Labs:** lab 2 for everything, Chromium 157. Lab 1 was tried first and abandoned: its `math12` chat
  is short there (5 turns, 1,314 px) and its composer held a draft (`l1-pvh-lab1.log`). On lab 2 the
  `math12` composer holds a 38-character draft that was left alone, so typing was measured on `ats12`.
- **Builds:**
  - head: `~/snap/chromium/common/stream-audit-1123/butter` (`0.1.0-alpha.22+streamaudit.1`, `b2df865`);
  - pvh: head plus `pvh.patch`, `~/snap/chromium/common/stream-proto-1124/pvh/butter`;
  - `head-dev` and `pvh-dev`, for L2 only (`rail-jump-live.mjs` needs a dev build): built with
    `package.py --dev` from `b2df865`, pvh-dev with pvh's two files copied in, under
    `~/snap/chromium/common/stream-ux-loaded-1124/`.
- **Locks:** owner `stream-ux-loaded-1124`; lab 1 with perf 20:50:47–20:52:50, then lab 2 with perf
  20:52:55–21:15:30 UTC. 10 harness runs.
- **New probe:** `lab/harness/stream-loaded-probe.mjs` (270 lines).

## Not established

- Whether the L1 blocking difference is real: one run each, and no earlier spread exists for this
  window.
- **A chat reopened with a stored layout record,** where the seek layout cache restores inline
  `content-visibility: auto` on blocks: no build had stored layouts.
- No head controls were run today for L3 and L4: the run budget was spent. The references are earlier
  days, on an earlier version of ChatGPT's page.
- L2 covered `math12` only; `math9` was not run. Why 6 rail jumps fail on head today was not looked
  into.
- No second rail run during hydration, because hydration does not happen on an opened chat.
- Hydration after a real stream, followed by rail jumps or seeking, was outside this run.

## Clean-up

- `lab-restore` ran on lab 1 (which was then stopped, as found) and on lab 2; both printed `ok: true`.
- Both releases printed `lab_released` and `perf_released` true ([restore.log](restore.log),
  [release.log](release.log)).
- The private-data scan of this folder found no matches.
