# Seek release pin fix, live check — 2026-11-23

Stage 4 of issue #152, after [seek-pin-cause](../2026-11-23-seek-pin-cause/report.md). The fix
under test (uncommitted, branch `fix/seek-release-pinning`): Butter's `pointerup` capture handler
dispatches one `scroll` event on the scroller before ChatGPT's own `pointerup` runs, so ChatGPT's
scroll listener sees the scrollbar gesture and unpins the chat from its end. Lab 2, fixture
`math12`, new harness [`lab/harness/seek-pin-live.mjs`](../../../lab/harness/seek-pin-live.mjs).
The send guard was on in every connection and no message was sent. The inputs were scrollbar
drags, wheel notches and scrollTop writes from the harness, plus the extension's own storage
toggle for layout memory. Raw logs stay in `~/.local/share/chatgpt-lab/captures/2026-11-23-seek-pin-fix/`.

## Result

**Fixed build: 27 of 27 releases held, 0 pulled to the end** (`PASS seek-pin` 27, `FAIL seek-pin`
0). Destinations: 23 estimated, **4 layout stored** (`layout: true, stored: true`), 0 layout
session. **The test can see the bug.** No-extension scrollTop writes were pulled 3 of 3 (run a),
and controls in the fixed-build runs 4 of 4. **The unfixed build's releases were pulled 3 of 4**
(run b2) and 1 of 4 in run b, whose drags acted as track presses (see Surprises).

| Run | Build | Layout memory | Releases | Pulled | Destinations: estimated / layout stored / layout session | On the previewed question | Controls (pulled) | Exit |
|---|---|---|---:|---:|---|---:|---:|---:|
| a | none (`EXT=`) | n/a | 0 | n/a | n/a | n/a | 3 (3) | 0 |
| b | unfixed | off | 4 (drag missed the thumb, see Surprises) | 1 | 4 / 0 / 0 | 4 | 0 | 1 |
| b2 | unfixed | off | 4 | **3** (1815, 3150, 3538 ms) | 4 / 0 / 0 | 1 | 0 | 1 |
| c | fixed | off | 12 | **0** | 12 / 0 / 0 | 12 | 0 | 0 |
| d | fixed | on, records from storage | 9 | **0** | 7 / 2 / 0 | 8 | 3 (3) | 0 |
| d2 | fixed | on, records from storage | 6 | **0** | 4 / 2 / 0 | 5 | 1 (1) | 0 |
| **fixed total** | | | **27** | **0** | **23 / 4 / 0** | **25** | **4 (4)** | |

The fair comparison is at the positions where the unfixed build was pulled: question 7 (`AT`
0.66–0.72) and question 0 (`AT` 0.05). There, unfixed releases were pulled 3 of 3 (b2 #1, #3, #4).
Fixed releases at the same positions (c #1, #3, #4, #6, #8, #10, #12) were pulled 0 of 7.
No-extension writes to the same positions were pulled 3 of 3, and fixed-build controls 4 of 4.
The question-6 release (`AT` 0.62) held in both builds. A pull needs transcript growth after the
jump, and question 6 apparently gave none.

Landing (a `REPORT`, not a verdict): **25 of 27 fixed releases landed on the previewed question.**
The 2 misses are both stored-layout destinations at `AT` 0.8 (d #10, d2 #2): previewed question 7
at offset ≈ 44.5k px, `timedOut: true` at 10015 ms, ended in question 8 at +1269 / +2148 px. They
held where Butter put them (no pull). This is the same give-up case that seek-narrow-live reported
for its 1 stored destination. The other 2 stored destinations (d #5, q3 +20437; d2 #4, q7 +38510)
landed on the previewed question with no time-out. In run b2 the 3 pulled unfixed releases also
timed out (10030–10467 ms) and ended at the chat's end, question 10.

## Surprises and limits

- **Run b's drags missed the thumb.** At the chat's end, the harness's computed thumb centre
  (`vh − ARROW − 10` = 887 px) is above the thumb if the scrollbar has no arrow buttons. A held
  press there pages up repeatedly, as stage 3's `press` step did. Every release stopped near
  scrollTop 320k (question 9), whatever `AT` was. Butter still ran a release session for each
  (preview shown, `reason: pointerup`). The harness now presses at `vh − 18`. That point is on a
  20 px thumb with or without 15 px buttons, and the target keeps the same offset. Run b2 onward
  reached the aimed questions. Run b is kept as evidence and is not counted as the unfixed baseline.
- **Stored-layout destinations were rare: 4 of 15 aimed releases.** All 12 turns were stored
  (365,473 bytes) and the page was reloaded so records came from storage. Still, every
  destination at a question's start reported `layout: false`. Only destinations deep inside a
  long answer (question 3 at +20k px, question 7 at +38–44k px) were stored layout. Why the
  preview did not trust the stored records for the other turns was not investigated. Seek-narrow-live
  saw the same rarity (1 of 9).
- **Pin state was not read.** The stage-3 logpoints were not used (optional, minified names). A
  fixed-build pass therefore shows that no pull happened. It does not show that ChatGPT unpinned.
  The evidence that a pull was possible at those positions is the controls (7 of 7 pulled across
  runs a, d and d2) and the unfixed releases at the same questions (3 of 3).
- **scrollHeight is a poor growth proxy.** b2 #1 was pulled with scrollHeight 348101 before and
  after the window. The pull came from growth inside the transcript that the scroller's total did
  not show.
- **The first sample of a window often came about 1 s after the action** (the page was busy
  mounting turns). Every pull seen came at 1.7–3.5 s, inside the 8 s window. A pull before the
  first sample would still show as the chat sitting at the end, which the check counts.
- No-extension scrollHeight was about 314.9k against about 347–348k with Butter. Butter's layout
  changes the total. This does not matter for the checks.

## Builds

| Name | How | Unpacked at `~/snap/chromium/common/` | `version_name` | `grep -c releaseScroll seek/preview-main.js` |
|---|---|---|---|---:|
| fixed | `python3 scripts/package.py --dev` in the worktree with the uncommitted fix | `seekpin-1123-fix/butter` | `0.1.0-alpha.22+dev.2` | 3 |
| unfixed | stage 3's dev build | `seekpin-1123-dev/butter` | `0.1.0-alpha.22+dev.1` | 0 |

`diff -rq extension/ <fixed>` lists only `manifest.json` and `popup/popup.html` (the dev build's
stamps).

## Runs

Every command ran from the worktree (layout scripts from the capture dir) with
`LAB_ID=2 LAB_OWNER=seekpin2-1123 LAB_PLAYWRIGHT=<worktree>/node_modules/playwright`, under one
lock: `lab-lock acquire --lab 2 --owner seekpin2-1123 --wait 1800 --needs-fixture math12`.
`F` = the fixed build, `U` = the unfixed build.

| # | Command | Exit | Result | Log |
|---:|---|---:|---|---|
| 1 | `EXT= AT=0.66,0.05,0.7 KINDS=write node lab/harness/seek-pin-live.mjs` | 0 | controls pulled 3 of 3 (2432, 1929, 2565 ms) | [run-a-native.log](run-a-native.log) |
| 2 | `EXT=U AT=0.66,0.62,0.7,0.05 node lab/harness/seek-pin-live.mjs` (thumb press at 887 px) | 1 | track presses, all at question 9; 1 of 4 pulled (3272 ms) | [run-b-unfixed.log](run-b-unfixed.log) |
| 3 | the same after the press fix (894 px) | 1 | `FAIL seek-pin #1, #3, #4`, pulled at 3538, 3150, 1815 ms | [run-b2-unfixed.log](run-b2-unfixed.log) |
| 4 | `EXT=F AT=0.66,0.62,0.7,0.05,0.64,0.68,0.6,0.72,0.1,0.66,0.3,0.69 node lab/harness/seek-pin-live.mjs` | 0 | 12 PASS, all estimated, 12 on the previewed question | [run-c-fixed-est.log](run-c-fixed-est.log) |
| 5 | `RESTART=1 EXT=F MODE=on node adhoc/layout.mjs` (stage 1's script) | 0 | `layoutConsent: granted`, `opts.layout: true` | [layout-on.log](layout-on.log) |
| 6 | `EXT=F MODE=measure UP=1 FROMTOP=1 node adhoc/layout.mjs` | 0 | 12 entries stored, 365,473 bytes, 0 errors | [layout-measure.log](layout-measure.log) |
| 7 | `EXT=F AT=0.66,0.25,0.45,0.66,0.35,0.55,0.62,0.7,0.5,0.8,0.4,0.05 KINDS=release,release,release,write node lab/harness/seek-pin-live.mjs` | 0 | 9 PASS (2 stored), controls pulled 3 of 3 | [run-d-fixed-layout.log](run-d-fixed-layout.log) |
| 8 | `EXT=F AT=0.35,0.8,0.33,0.78,0.37,0.82,0.66 KINDS=release×6,write node lab/harness/seek-pin-live.mjs` | 0 | 6 PASS (2 stored), control pulled 1 of 1 | [run-d2-fixed-layout.log](run-d2-fixed-layout.log) |
| 9 | `EXT=F timeout 150 node adhoc/layout-reset.mjs` | 0 | layout off (geometry rows 12 → 0), keys removed, browser restarted, database deleted: no keys, no database | [layout-reset.log](layout-reset.log) |

[`adhoc/layout-reset.mjs`](adhoc/layout-reset.mjs) combines stage 1's `cleanup.mjs` and
`dbdelete.mjs` in one run. It turns layout memory off with the popup's toggle value, removes the
keys, restarts the browser with the same build and deletes `butter-layouts-v1`. `adhoc/layout.mjs`
is stage 1's ([copy](../2026-11-22-seek-narrow-live/adhoc/layout.mjs)).

The harness reuses `seek-landing-live.mjs`'s lock check, browser start, fixture loading, page
probe and thumb geometry. They moved into a new shared module,
[`lab/harness/seek-live-page.mjs`](../../../lab/harness/seek-live-page.mjs), and
`seek-landing-live.mjs` now imports them. **`seek-landing-live.mjs` was not run live after that
move.** It passes `node --check`, and its no-lock run exits 2.

## Lab time and clean-up

- Lock `seekpin2-1123` on lab 2 from 01:09:52 to 01:31:53 UTC (2026-11-24; 2026-11-23 local),
  about 22 min, 9 harness runs. Lab 1 was not used.
- The fixed build was loaded at a new unpacked path. Before layout memory was turned on, its
  storage held no keys and one empty `butter-layouts-v1` database that the extension created
  itself in run 4. After run 9 it holds no keys and no database.
- `lab-restore --lab 2 --owner seekpin2-1123`: exit 0. The browser restarted with no extension,
  on the home tab, with an empty composer ([restore.log](restore.log)). `lab-lock release`: exit 0.
  [lock-status.log](lock-status.log):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Files

- `report.md` (this).
- `run-*.log`, `layout-*.log`, `restore.log`, `lock-status.log`: the raw logs, scrubbed. URLs
  are replaced by `<url>` and the home path by `~`. They hold indices, pixel numbers, ms and
  storage counts. They hold no chat text, chat URLs, ids, account names or script URLs.
- `adhoc/layout-reset.mjs`.
