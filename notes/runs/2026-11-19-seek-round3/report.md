# Seek release, review round 3, live; stored layouts; the theme harness — 2026-11-19

Lab run on lab 2, fixtures `math12` (seek) and `ats12` (theme). The send guard was on in every
connection and no message was sent. The only clicks were scrollbar drags, wheel scrolling and
ChatGPT's own theme setting, which ended light. The one harness change is in
`lab/harness/rail-theme-switch-live.mjs`. Raw captures, the ad-hoc scripts and the per-frame traces
stay in `~/.local/share/chatgpt-lab/captures/2026-11-19-seek-round3/`.

## Result

**The round 3 seek code lands the reported releases on today's page.** I ran
`seek-landing-live.mjs` twice on `math12` with the test build of `af48dc2`. All 10 releases
PASSed, each landing on its previewed question (+1 px), and both runs exited 0. As on the
re-check of `e09235b`, trials 2 and 3 each needed one find, at 1267–1353 ms. Releases were
readable 2.5–3.2 s after letting go. **The stored-layout search was not reached live.** I turned
"Remember long-chat layouts" on through the extension's own storage, measured all 12 turns of
`math12` and released the thumb 17 times. 3 releases went to a layout destination and none of them
needed a find, so `findLanding` never ran. Two of those 3 FAILed the harness rule, for reasons
that have nothing to do with the search (see below). One cause is a finding about today's page:
ChatGPT's height map had no measured height for any unmounted turn, so stored records count as
layout only for mounted turns. The setting is off again and the extension's storage is as I found
it. **The theme harness works again:** it closes ChatGPT's Settings modal before going back. Two
runs gave all 8 checks PASS and exited 0. The rail followed Dark in 263–270 ms and Light in
263–271 ms, and the theme read light after a reload.

## Builds

| Name | Command at the checkout's head (`af48dc2` + notes) | Unpacked at `~/snap/chromium/common/` | `version_name` |
|---|---|---|---|
| test | `python3 scripts/package.py --test round3` | `round3-1119-test/butter` | `0.1.0-alpha.21+round3.1` |
| dev | `python3 scripts/package.py --dev` | `round3-1119-dev/butter` | `0.1.0-alpha.21+dev.2` |

Both have `findLanding` in `seek/layout-check-main.js` (4 matches each). `diff -rq extension/
round3-1119-test/butter` lists only `dev/` and `manifest.json`. Lab 2 was on Chromium 157 with
classic scrollbars at 1600×1000. Every command ran with
`LAB_PLAYWRIGHT=<checkout>/node_modules/playwright`, which today's re-check found the lab needs.

## Runs

`EXT`: T = `round3-1119-test/butter`, D = `round3-1119-dev/butter`. Every harness command also had
`LAB_ID=2 LAB_OWNER=seek-r3-1119`.

| Step | Command | Exit | Result | Log |
|---|---|---:|---|---|
| 2 | `EXT=T FIXTURE=math12 node lab/harness/seek-landing-live.mjs` | 0 | `PASS seek-landing #1–#5`, `SUMMARY seek-landing: 0 FAILs` | [seek-1.log](seek-1.log) |
| 2 | the same command again | 0 | `PASS seek-landing #1–#5`, 0 FAILs | [seek-2.log](seek-2.log) |
| 3 | `MODE=on` (ad-hoc, `adhoc/layout.mjs`): the popup's toggle value, written by the extension's worker | 0 | before: no keys, no database; after: `layoutConsent: "granted"`, `opts.layout: true` | [layout-on.log](layout-on.log) |
| 3 | `MODE=measure` (ad-hoc): open `math12`, load all history, wheel top to end in 600 px steps | 0 | 12 turns stored, 365,473 bytes, 0 errors | [layout-measure.log](layout-measure.log) |
| 3 | `EXT=D FIXTURE=math12 node lab/harness/seek-landing-live.mjs` | 1 | 4 PASS; `FAIL seek-landing #3`, a stored-layout destination (see Step 3) | [seek-stored-1.log](seek-stored-1.log), [probe](seek-stored-1-probe.log) |
| 3 | `EXT=D FIXTURE=math12 AT=0.1,0.25,0.3,0.35,0.45,0.5,0.6,0.65,0.75,0.8,0.9,0.95 node lab/harness/seek-landing-live.mjs` | 1 | 11 PASS; `FAIL seek-landing #1`, a layout destination (see Step 3) | [seek-stored-2.log](seek-stored-2.log), [probe](seek-stored-2-probe.log), [reasons](layout-reasons.log) |
| 3 | clean-up (ad-hoc): layout off with the popup's toggle, keys removed, database deleted | 0 | geometry rows 12 → 0; then no keys and no database (see Clean-up) | [layout-cleanup.log](layout-cleanup.log), [layout-dbdelete.log](layout-dbdelete.log) |
| 4 | `EXT=T node lab/harness/rail-theme-switch-live.mjs` (repaired) | 0 | all 8 PASS; `data-dark` set 263 ms after Dark, removed 263 ms after Light | [theme-1.log](theme-1.log) |
| 4 | the same command again | 0 | all 8 PASS; 270 ms, 271 ms | [theme-2.log](theme-2.log) |
| 4 | read-only check after `lab-restore` and a reload | 0 | `data-theme` light, `color-scheme` light, cookie light, `localStorage.theme` light, no modal | [theme-final.log](theme-final.log) |

## Step 2: estimated destinations (the reported bug)

Layout memory was unconsented, so every preview drew the unseen estimate and every destination was
an estimated one (`layout: false`). "Find" is the round 1–3 search for a target that did not mount.
"Retarget" is the drift correction after the target mounted. Times are ms after release.

| Trial (start) | Previewed → landed | Run 1: find; readable | Run 2: find; readable |
|---|---|---|---|
| 1 (0.2) | question 3 → question 3 +1 px | none (retarget −2773 at 1138); 2951 | none (retarget −2773 at 1190); 3107 |
| 2 (0.4) | question 6 → question 6 +1 px | 1 find at 1299 (192955 → 195670); 2666 | 1 find at 1267 (the same); 2483 |
| 3 (0.55) | question 7 → question 7 +1 px | 1 find at 1303 (227066 → 229284); 3056 | 1 find at 1353 (the same); 3152 |
| 4 (0.7, up) | question 5 → question 5 +1 px | none (retarget −4614 at 1117); 3173 | none (retarget −4614 at 1144); 3203 |
| 5 (0.85, up) | question 7 → question 7 +1 px | none (retarget −364 at 2354); 2586 | none (retarget −364 at 2398); 2648 |

10 of 10 releases PASSed. No release timed out, and none made more than one find. The same questions,
finds and landing positions as today's re-check of `e09235b` (finds at 1284 and 1352 ms, readable
2.5–3.3 s), so round 3 changed nothing on this path. That is what the round 3 notes expect: the new
code acts on stored-layout targets and on unusual row parents.

## Step 3: stored layouts

**How it was turned on.** The popup's "Remember long-chat layouts" row calls
`ButterStatus.toggleGroup(settings, 'layout')` (`extension/shared/status.js`). That sets
`layoutConsent: 'granted'` and `opts.layout: true` in the extension's `chrome.storage.local` key
`butter`. I ran that same function in the dev build's service worker, so it was the popup's write,
made without the popup UI. Nothing else was written, and no extension file was changed.
`layout-worker.js` stores the rows in the extension's IndexedDB `butter-layouts-v1`. The dev build
is a new unpacked path, so it had its own, empty storage: no keys, no database.

**Measured.** I opened `math12`, loaded all history and wheeled from the top to the end (600 px per
step, 1.5 s pause every 50 steps), then waited for the flush. Layout storage reported
`entries: 12, writes: 16, bytes: 365473, errors: 0, pending: 0`. The database held 12 `geometry`
rows. Both harness runs then started the browser afresh, which reloads the chat. The storage loaded
(`loads: 1`, hits 60 and 144) and every release's model had `stored: 12` of 12 turns.

**The releases.** 17 releases. 3 had a layout destination (`destination.layout: true`, the same
`question.layout` the dev build's `commit` event carries). None of those 3 had a find.

| Release | Destination | Find | Landed vs previewed | Readable | Verdict |
|---|---|---|---|---|---|
| run 1 #3 (0.55) | question 7, `layout`, `stored`, offset 25341 | none | **question 7 +1 px** vs +25341 | 3955 ms | FAIL |
| run 2 #1 (0.1) | question 1, `layout`, not `stored`, offset 31552 | none | question 1 +31605 vs +30223 | 238 ms | FAIL |
| run 2 #6 (0.5) | question 7, `layout`, `stored`, offset 8533 | none | question 7 +9382 vs +8533 (849 px, under the 912 px viewport) | 1706 ms | PASS |
| the other 14 | estimated (`layout: false`) | 1 find (run 1 #2) | on the previewed question, +1 px | 1631–4515 ms | 14 PASS |

- **Run 1 #3: the semantic step's question fallback, not the search.** The commit left scrollTop at
  253600, inside question 7; the next trace sample (1.6 s, the page was busy) already shows
  question 7 mounted at its top and scrollTop 229284, with no find or drift retarget recorded. The preview had no
  visible text anchor (`semantic: {matched: false, fallback: true, anchorVisible: false}`, no
  needle; why none was found was not looked into). So `preview-main.js` took its "Math-only/unmatched previews retain
  the selected question identity" branch. That branch scrolls the question's bubble to the view's
  top, which is question 7 +1 px, 24,316 px above the passage the preview showed. Natively,
  ChatGPT left the same drag inside question 7 (11-18 native control: +24668 px). The fallback
  works as it was written, but it lands a viewport-sized passage 24k px away, so the harness FAILs
  it. This code path predates round 3.
- **Run 2 #1: the harness read the preview early.** Butter landed on its own destination: offset
  31552, landed +31605 = 31552 + the 52 px header + 1. The text anchor sat where the preview drew it
  (`semantic.matched: true`, error 0.01 px). The harness reads the preview 600 ms after the last
  mouse move. Between that read and the commit, scrollTop went on moving: 62395 at 6 ms after
  release, 63469 at 219 ms (`releaseToCommitMs` 178). So the harness's +30223 is 1329 px older
  than the destination. Whether the preview showed +31552 at the moment of release was not
  recorded.
- **Run 2 #6** is the clean case: a stored layout, no find, and one semantic retarget that put the
  matched anchor text at the preview's y (error −0.06 px).

**Why so few layout destinations.** At the first release of run 1, 5 of 12 turns were layout
turns. The count fell over each run: 5, 5, 5, 4, 4, then 4 down to 2 in run 2. The last press's
decision ([layout-reasons.log](layout-reasons.log)) explains it. All 12 turns had records
(`recordCount: 12`). The 2 mounted turns were layout turns. Each of the 10 unmounted turns had
`layoutReason: "no-measured"`, because ChatGPT's height map (`measuredHeight`) was 0 for every one
of them. A stored record is used only next to a measured height, and today ChatGPT keeps measured
heights only for the turns it has mounted lately. With the page's new `data-virtualized-turn`
wrappers and `data-thread-reading="measured"` (re-check, this morning), stored layouts rarely reach
the preview, and when they do, the turn is one ChatGPT has measured. Its position then agrees with
the stored model, so the commit lands where the target mounts and no search is needed.

### Not established

- **A stored-layout destination whose target does not mount at the commit, which is the case
  `findLanding` (L8) and the L11 timeout return were written for.** I tried 17 releases at 17
  positions after measuring every turn. 3 went to layout destinations and none needed a find, for
  the reason above. Round 3's stored-layout code is backed by its unit tests only.
- **Whether ChatGPT's height map dropping unmounted turns is new** (it would also explain the
  falling counts), or whether it was so on 11-04 when layout storage was built. Only today's page
  was looked at.
- **Run 2 #1's preview at the moment of release.** Butter landed on its own final destination.
  Whether the preview showed that passage when the thumb was released was not recorded.

## Step 4: the theme harness

**What I changed in `lab/harness/rail-theme-switch-live.mjs`, and why:**

1. **`closeSettings()`, called first in `back()`.** If a visible `[role="dialog"][aria-modal="true"]`
   is open, it presses Escape and waits up to 3 s for the dialog to hide. If the dialog is still
   there, it clicks the dialog's "Close" button and waits again. `back()` then goes on as before,
   with the browser's Back while no turn shows. The old `back()` stopped as soon as turns were
   visible. Today they are visible behind the modal, so it left Settings open. The modal hides the
   sidebar's `<nav>` (`aria-hidden`), so the Light pass could not find "Open profile menu". The
   harness did not log which of the two closed the dialog.
2. **The error path reloads after putting the theme back.** ChatGPT reads the cookie and
   `localStorage.theme` only on a load. After the re-check's two errors the page stayed dark until
   a manual reload. The report line now gives the state after that reload. No error occurred today,
   so this path was not exercised live.
3. Comments and the `lab/README.md` row now describe Settings as a modal dialog.

Both runs, all 8 checks: `switch-dark-page`, `switch-dark-host`, `switch-dark-chat`, the three for
light, `theme-restored`, `host-restored`. ChatGPT changed `data-theme` and
`data-appearance-preset` for each pick, as on 11-18. `data-dark` followed in 263–271 ms; on 11-18
it took 77–96 ms, and today's re-check measured 264–267 ms for Dark. The check reads 1 s after
each pick, so both pass.

## Lab time and clean-up

- Lock `seek-r3-1119` on lab 2 from 03:10:42 to 03:35:58 UTC (2026-11-20, the evening of 11-19
  local), about 25 min: step 2 to 03:16, step 3 from 03:16 to about 03:31, the theme runs from
  03:33. I then took the lock again for one read-only theme check, from about 03:36:00 to 03:36:16:
  my first check script failed on a coding error after its reload but before it printed, and I
  had already released.
- Step 3's clean-up. Layout off with the popup's toggle value: the worker's own `clear()` emptied
  the 12 geometry rows and wrote `butterLayoutCleared`. I then removed the keys `butter`,
  `butterLayoutMigrated` and `butterLayoutCleared`. Deleting the database stayed blocked while the
  service worker held it open, so I stopped that script. After a browser restart with the dev build
  (no open connection), `indexedDB.deleteDatabase('butter-layouts-v1')` succeeded. The dev build's
  storage ended as it started: no keys, no databases. The test build's storage was never written.
- `lab-restore --lab 2 --owner seek-r3-1119`: exit 0, browser restarted to lab 2's defaults (no
  extension), home tab, empty composer ([restore.log](restore.log)). The second restore needed no
  restart ([restore-final.log](restore-final.log)). Both `lab-lock release`: exit 0.
  `lab-lock status` at the end ([lock-status.log](lock-status.log)):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

Lab 1 was not used. The unpacked builds stay at `~/snap/chromium/common/round3-1119-{test,dev}/butter`.

## Files

- `report.md` (this).
- `*.log`: one per run or step, copied from the raw logs with the home path replaced by `~` and
  URLs, ids, the extension id and the project id removed. They hold indices, pixel numbers, ms,
  storage counts and verdict lines, and no chat text, chat URLs or account names. The probe logs
  are `__seekDump(true)` sessions with the anchor needle left out.
