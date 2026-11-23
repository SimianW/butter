# Seek release with the narrowed search (#134, PR #148), live — 2026-11-22

Lab run on lab 2, fixture `math12`, with test and dev builds of `origin/main` `10008f2`. That
commit holds 5836967: after release, only an **estimated** destination (`layout: false`) whose
target did not mount is searched for; a **layout** destination (`layout: true`) is not (`findLanding`
deleted). The send guard was on in every connection and no message was sent. The only inputs were
scrollbar drags, wheel scrolling and scrollTop writes from the harness. Raw captures stay in
`~/.local/share/chatgpt-lab/captures/2026-11-22-seek-narrow-live/`.

## Result

**Estimated destinations: 15 of 18 releases landed on the previewed question; the 3 misses all
previewed question 7 and timed out.** Each of the 3 made 2–3 finds that put question 7 at the
view's top (scrollTop 229284, question 7 mounted), and each time, 1–4 s later, the chat was back at
its end (scrollTop 346445–347474, questions 10–11). Butter gave up at 10.0–11.0 s and the chat
stayed at the end or in question 6. No recorded Butter write (find or retarget) went to the end.
Releases with layout memory off, as in the 11-19 Step 2, were only 8 of the 18 (run 1); the other
10 are estimated destinations from the two dev-build runs with layout memory on.
**Layout destinations: 9 releases with `destination.layout: true`, below the 10 aimed for, and only
1 of them `stored: true`** (its record came from the extension's storage). The other 8 used records
of turns this session had measured. None made a find, as the narrowed code says. **4 of 9 landed on
the previewed question by the harness's numbering.** 4 more landed exactly on Butter's own
destination (landing error ±0.016 px), with Butter's text-anchor check matched, but the harness
numbers that question one higher: in that run Butter's turn list had 11 turns and the harness's 12
(see Layout destinations). **The 1 stored-layout destination is the case the narrowing gave up on:
its target was not mounted, no find ran, and the release timed out at 10016 ms.** Butter's question
fallback put the previewed question at the view's top at about 1.5 s, then the chat was pulled to
its end at about 3.5 s, where it ended. Harness exits: 1, 1, 0. The layout setting is off again,
and the dev build's storage is as it started (no keys, no database).

## Builds

| Name | Command in the worktree at `10008f2` | Unpacked at `~/snap/chromium/common/` | `version_name` |
|---|---|---|---|
| test | `python3 scripts/package.py --test seeknarrow` | `seeknarrow-1122-test/butter` | `0.1.0-alpha.22+seeknarrow.1` |
| dev | `python3 scripts/package.py --dev` | `seeknarrow-1122-dev/butter` | `0.1.0-alpha.22+dev.1` |

`grep -c findLanding <build>/seek/*.js` prints 0 for all 12 seek scripts in both builds. `diff -rq
extension/ <test>` lists only `dev/` and `manifest.json`; for the dev build, `manifest.json` and
`popup/popup.html`. No version was changed. Every command ran with
`LAB_PLAYWRIGHT=<worktree>/node_modules/playwright` after `npm ci`, from the worktree; the lab's
main checkout was not touched (`lab-lock` warned that it is 4 commits behind `origin/main`).

## Runs

`EXT`: T = `seeknarrow-1122-test/butter`, D = `seeknarrow-1122-dev/butter`. Every command also had
`LAB_ID=2 LAB_OWNER=seek-narrow-1122`. The lock was taken with `--lab 2 --needs-fixture math12`.

| # | Command | Exit | Result | Log |
|---:|---|---:|---|---|
| 1 | `EXT=T FIXTURE=math12 AT=0.1,0.2,0.3,0.4,0.5,0.55,0.65,0.7,0.8,0.85 node lab/harness/seek-landing-live.mjs` | 1 | 7 PASS; `FAIL seek-landing #5, #6, #10` (estimated, question 7, timed out) | [seek-est-1.log](seek-est-1.log) |
| 2 | `RESTART=1 EXT=D MODE=on node adhoc/layout.mjs` (11-19's script): the popup's toggle value, written in the dev build's worker | 0 | before: no keys, no database, `layoutConsent: "pending"`; after: `layoutConsent: "granted"`, `opts.layout: true` | [layout-on.log](layout-on.log) |
| 3 | `EXT=D MODE=measure node adhoc/layout.mjs` | 0 | only 6 of 12 turns stored: after the history loop the chat was at its end (scrollTop 346165), so wheeling down did nothing | [layout-measure.log](layout-measure.log) |
| 4 | the same with `FROMTOP=1` (new: put scrollTop 0 first) | 0 | scrollTop 0 did not hold: 3 s later 346165 again; still 6 turns | [layout-measure-2.log](layout-measure-2.log) |
| 5 | the same with `UP=1 FROMTOP=1` (new: wheel from the end up to the top) | 0 | 12 turns stored, 365,473 bytes, 0 errors, no jump over 5000 px while wheeling | [layout-measure-3.log](layout-measure-3.log) |
| 6 | `EXT=D FIXTURE=math12 DSTEP=8 AT=0.05,0.15,0.25,0.35,0.45,0.5,0.62,0.72,0.82,0.92 node adhoc/seek-aim.mjs` | 1 | 5 PASS; `FAIL #1, #2, #8, #10` (index, see below), `FAIL #9` (stored, timed out) | [seek-aim-1.log](seek-aim-1.log) |
| 7 | `EXT=D FIXTURE=math12 PRE=1 AT=0.25,0.35,0.45,0.55,0.68,0.78,0.88 node adhoc/seek-aim.mjs` | 0 | 7 PASS, all estimated destinations | [seek-aim-2.log](seek-aim-2.log) |
| 8 | `EXT=D timeout 150 node adhoc/cleanup.mjs` (11-19's script) | 124 | layout off: geometry rows 12 → 0; keys removed; database delete blocked by the worker until my timeout | [layout-cleanup.log](layout-cleanup.log) |
| 9 | `EXT=D node adhoc/dbdelete.mjs` (11-19's script; restarts the browser) | 0 | before: no keys, database present; delete succeeded; after: no keys, no database | [layout-dbdelete.log](layout-dbdelete.log) |

`adhoc/` is `~/.local/share/chatgpt-lab/captures/2026-11-22-seek-narrow-live/adhoc/`; copies of
the two changed scripts are in [adhoc/](adhoc/). 9 runs, lock held about 24 min.

**`adhoc/seek-aim.mjs`** is a copy of `lab/harness/seek-landing-live.mjs` at `10008f2`, with the
same drag, preview read, settle and `seek-landing` verdict. It adds:

- `DSTEP` (thumb px per drag step, 4 steps; default 40 as in the harness). `DSTEP=8` moves the
  thumb about 32 px, about 12.6k px of chat, so the destination stays near the mounted turn.
- `PRE=1`: before each drag, it puts scrollTop at the projected destination minus 1500 px and
  wheels down 3000 px in 300 px steps, so ChatGPT mounts and measures the turns there. Then it puts
  the chat back at the trial's fraction, waits 1500 ms (not 3500) and drags.
- Per release, `REPORT trial N press` (the press decision's layout and mounted turns and each
  turn's `layoutReason`) and `REPORT trial N row` (the summary used below). Its index probe (Butter's
  row list against the harness's) found no list and printed `butter: null`; it is not used.

## Estimated destinations (`destination.layout: false`)

"Find" is the search for an estimated target that did not mount (time after release, from → to
scrollTop). Question numbers are the harness's (0-based, the order of ChatGPT's entries). In this
table Butter's index and the harness's agree, because both index ranges below 6 match and run 1's
list had 12 turns (see the next section).

| Release | Memory | Previewed | Landed | Finds | Readable ms | timedOut | Harness |
|---|---|---|---|---|---:|---|---|
| run 1 #3 (0.3) | off | 5 | **5** +1 | none (retarget −360 at 3751) | 3918 | false | PASS |
| run 1 #4 (0.4) | off | 6 | **6** +1 | 1 (3310: 192942 → 195670) | 5627 | false | PASS |
| run 1 #5 (0.5) | off | 7 | 6 +31384 | 2 (1716: 227053 → 229284; 5798: 346445 → 229373) | 10017 | **true** | FAIL |
| run 1 #6 (0.55) | off | 7 | 10 +17582 | 3 (1336: 227068 → 229284; 4435 and 8369: 346445 → 229327) | 11037 | **true** | FAIL |
| run 1 #7 (0.65, up) | off | 4 | **4** +1 | none (retarget −3265 at 1522) | 3050 | false | PASS |
| run 1 #8 (0.7, up) | off | 9 | **9** +1 | 3 (1982: 315920 → 319983; 3598: 347474 → 316949; 5584: 316949 → 319983) | 6116 | false | PASS |
| run 1 #9 (0.8, up) | off | 9 | **9** +1 | 1 (2346: 316909 → 319983) | 2829 | false | PASS |
| run 1 #10 (0.85, up) | off | 7 | 10 +17582 | 2 (3970: 347474 → 226667; 7462: 226667 → 229284) | 10457 | **true** | FAIL |
| run 6 #4 (0.35) | on | 4 | **4** +1 | none | 1440 | false | PASS |
| run 6 #5 (0.45) | on | 5 | **5** +1 | none | 1184 | false | PASS |
| run 6 #7 (0.62, up) | on | 5 | **5** +1 | none (retarget −21068 at 1048) | 2772 | false | PASS |
| run 7 #1 (0.25) | on | 4 | **4** +1 | none (retarget +1018 at 2291) | 2447 | false | PASS |
| run 7 #2 (0.35) | on | 5 | **5** +1 | none (retarget −1789) | 2652 | false | PASS |
| run 7 #3 (0.45) | on | 6 | **6** +1 | none (retarget +973) | 2184 | false | PASS |
| run 7 #4 (0.55) | on | 7 | **7** +1 | none (retarget +1053) | 3248 | false | PASS |
| run 7 #5 (0.68, up) | on | 5 | **5** +1 | none (retarget −2142) | 2572 | false | PASS |
| run 7 #6 (0.78, up) | on | 6 | **6** +1 | none (retarget −689) | 2083 | false | PASS |
| run 7 #7 (0.88, up) | on | 7 | **7** +1 | none (retarget +1202) | 2563 | false | PASS |

15 of 18 on the previewed question. 8 of the 18 had layout memory off (run 1: 5 of 8). Each of the
three misses has the same shape in its 100 ms trace (`REPORT trial N trace`; the page was so busy
that samples came 1–3 s apart):

- run 1 #5: 1.5 s scrollTop 227053 (question 6) → 3.9 s 229284 (question 7 mounted at the top) →
  5.5 s 346445 (questions 10–11) → 8.8 s 229284 → 10.0 s 346445 → 11.0 s on 227053, question 6.
- run 1 #6: 1.1 s 227068 → 2.8 s 229284 (question 7) → 4.2 s 346445 → 7.0 s 229284 → 8.1 s
  346445 → 11.0 s 229284 → 12.3 s 346445, where it stayed.
- run 1 #10: 2.7 s 229284 (question 7) → 3.7 s 347474 → 7.2 s 226667 → 9.1 s 229284 → 10.4 s
  347474, where it stayed.

Run 1 #8 shows the same pull once (its second find starts from 347474) and recovered in time. So
on this page, an estimated target that does mount can be lost again: the chat jumps to its end
after question 7 mounts. Butter's finds and retargets, the scroll writes the session records,
never go to the end. On 11-19 the same release (0.55, question 7) needed one find and PASSed twice.

## Layout destinations (`destination.layout: true`)

No layout destination made a find (`finds: []` in all 9), as the narrowed code says.

| Release | Memory | `stored` | Previewed (Butter's index) | Destination offset | Landed (harness's numbering) | Butter's anchor check | Readable ms | timedOut | Harness |
|---|---|---|---|---:|---|---|---:|---|---|
| run 1 #1 (0.1) | off | false | 10 | 16731 | **10** +16784 | matched, +0.016 px | 159 | false | PASS |
| run 1 #2 (0.2) | off | false | 10 | 16731 | **10** +16784 | matched | 112 | false | PASS |
| run 6 #3 (0.25) | on | false | 2 | 20373 | **2** +20426 | matched | 165 | false | PASS |
| run 6 #6 (0.5) | on | false | 5 | 23861 | **5** +23914 | matched | 117 | false | PASS |
| run 6 #1 (0.05) | on | false | 9 | 16731 | 10 +16784 (exact destination) | matched, −0.016 px | 105 | false | FAIL (index) |
| run 6 #2 (0.15) | on | false | 9 | 16731 | 10 +16784 (exact destination) | matched | 91 | false | FAIL (index) |
| run 6 #8 (0.72, up) | on | false | 9 | 3165 | 10 +3218 (exact destination) | matched | 112 | false | FAIL (index) |
| run 6 #10 (0.92, up) | on | false | 9 | 3165 | 10 +3218 (exact destination) | matched | 110 | false | FAIL (index) |
| run 6 #9 (0.82, up) | on | **true** | 6 (≈ harness 7) | 43655 | 10 +17582 | fallback, no anchor visible | 10016 | **true** | FAIL |

"Landed +N" is the offset below the 52 px header: Butter's destination offset + 53 means the chat
is exactly where Butter put it.

- **The index mismatch (run 6 #1, #2, #8, #10).** In run 6 the press decision had 11 turns at every
  release (`reasons` length 11, `recordCount` 11), while the harness's entry list had 12. In run 7
  both had 12. Butter's indices 0–5 match the harness's: run 6 #3 and #6 land on 2 and 5 at the
  exact offset. From 6 up, Butter's index is the harness's minus 1: run 6 #9's question 6 starts at
  about 227.7k (271389 − 43655), where the harness's question 7 starts (229284). The same chat
  position gave question 10 in run 1 (test build, memory off) and 9 in run 6. In all four, Butter
  landed on its own destination and its anchor text sat where the preview drew it. So the chat
  shows the previewed passage, and the harness's question label is one higher. Which list is right
  on the page, and why Butter's list missed a turn in run 6, was not looked into.
- **The stored destination that did not mount (run 6 #9).** At the press, Butter's model had only
  its turn 7 mounted (harness 8). The destination was Butter's turn 6 (harness 7), from storage,
  offset 43655. The preview had no visible text anchor (`semantic: {matched: false, fallback: true,
  anchorVisible: false}`). Trace: 1.5 s and 2.6 s scrollTop 229284, question 7 (the previewed
  question) at the view's top and mounted. That is the question fallback putting the question's top
  in view, as in 11-19's run 1 #3. At 3.5 s the chat was at 346445 (questions 10–11), and it stayed
  there to the end of the trace and the settle. No find ran, as the narrowed code says. The session
  timed out at 10016 ms, the 10 s give-up. The release ended at the chat end, the same pull as the
  estimated misses, not at the previewed question.
- **How the layout destinations came about.** Every layout destination is a mounted or just-mounted
  turn. Run 1 #1 and #2 and run 6 #1, #2, #8, #10 started at the chat's end, because `put(f)` did
  not hold there (start scrollTop 346165–347474 for fractions 0.05–0.92). The short drags of run 6
  kept the destination near the turn under the view. `PRE=1` (run 7) did not help: all 7
  destinations were estimated. At each press, the layout turns were the mounted turn, turns 0 and 1,
  and some of 6–10 (Butter's index; `REPORT trial N press`). None of run 7's wheeled-through
  destination turns was among them by the time of the drag. With memory off (run 1), layout destinations still occur: they use this session's
  records (`stored: false`).

## Not established

- **What pulls the chat to its end.** The pull showed up in 4 estimated releases (3 lost), in the
  stored release, and in the measuring step. There, the history loop ended at the chat's end, not
  at the top as on 11-19, and a scrollTop 0 write was back at the end 3 s later. No recorded Butter
  write went there, but Butter's unrecorded writes were not probed (no scroll probe ran), and there
  was no native control (`EXT=`). So whether ChatGPT does this without Butter is open.
  Stage 2 ran that control: [seek-pull-control](../2026-11-22-seek-pull-control/report.md).
- **A stored-layout destination that lands, with this build.** Only 1 release had `stored: true`,
  and it lost to the pull above. Whether a stored destination that does not mount reaches its
  question within 10 s without a search, when nothing pulls the chat away, was not seen.
- **10 stored-layout releases.** 9 layout destinations, 1 stored. Measured heights still last only
  for turns ChatGPT mounted lately, and wheeling through the destination 2–3 s before the drag was
  not enough.
- **The 11 vs 12 turn lists in run 6**, and which numbering is the page's.
- **10 estimated releases with layout memory off.** 8 had memory off; 10 more had memory on.

## Lab time and clean-up

- Lock `seek-narrow-1122` on lab 2 from 02:35:15 to 02:59:12 UTC (2026-11-23; the evening of 11-22
  local), about 24 min, 9 runs. Lab 1 was not used.
- Clean-up, as 11-19's: layout off with the popup's toggle value (the worker emptied the 12
  geometry rows and wrote `butterLayoutCleared`), then the keys `butter`, `butterLayoutMigrated` and
  `butterLayoutCleared` removed. The database delete was blocked while the worker held it open. After
  a browser restart with the dev build it succeeded: `AFTER {"keys":[],"dbs":[]}`, the same as the
  dev build's state before run 2 (`{"keys":[],"dbs":[]}`). The test build ran only with layout
  memory off. It is a new unpacked path whose storage was empty and never turned on.
- `lab-restore --lab 2 --owner seek-narrow-1122`: exit 0, browser restarted to lab 2's defaults (no
  extension), home tab, empty composer ([restore.log](restore.log)). `lab-lock release`: exit 0.
  [lock-status.log](lock-status.log):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

The unpacked builds stay at `~/snap/chromium/common/seeknarrow-1122-{test,dev}/butter`.

## Files

- `report.md` (this).
- `*.log`: one per run or step, copied from the raw logs with the home path replaced by `~` and
  URLs replaced by `<url>`. They hold indices, pixel numbers, ms, storage counts and verdict lines,
  and no chat text, chat URLs, ids or account names.
- `adhoc/seek-aim.mjs`, `adhoc/layout.mjs`: the wrapper and the changed measuring script (11-19's
  with `FROMTOP` and `UP`). `cleanup.mjs` and `dbdelete.mjs` are 11-19's, unchanged.
