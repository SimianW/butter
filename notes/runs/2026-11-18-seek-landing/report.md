# Seek release landing and the rail's live theme switch — 2026-11-18

Bug fixes for two findings of [2026-11-18-live-features](../2026-11-18-live-features/report.md)
(§5 and §6), steps 1–3 of [docs/bugfix.md](../../../docs/bugfix.md). Lab 2 only, fixtures `math12`
(seek) and `ats12` (theme); lock owner `seek-1118`. The send guard was on in every connection, and
no message was sent. The only clicks were scrollbar drags and ChatGPT's own theme setting, which was
put back to light. Raw logs (with traces) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-18-seek-landing/`.

## Results

| Bug | Before | After | Red command |
|---|---|---|---|
| A: releasing the thumb lands on the previewed question | `seek-landing-live.mjs` on fix-1118-fix: **exit 1**, 2 of 5 trials FAIL (questions 6 and 7, timed out after 10 s about 31k px inside the previous answer) | on this branch's build: **exit 0** in each of the runs below, 5 of 5 trials PASS, readable in 3.0–4.1 s | `node --test test/seek-landing-find.test.js`: 2 of 3 fail on `e82b5cf` (`REVIEW_SOURCE`), 3 of 3 pass here |
| B: the rail follows a live theme switch | `rail-theme-switch-live.mjs` on seek-1118-fix: **exit 1** (`FAIL switch-dark-host`, `FAIL switch-dark-chat`) | on seek-1118-fix2: **exit 0**, `data-dark` set 96 ms after picking Dark, removed 91 ms after picking Light | `node --test --test-name-pattern="follows a switch" test/rail.test.mjs`: fails before the fix, passes after |

## Builds

| Name | Directory under `~/snap/chromium/common/` | What | `seek/preview-main.js` |
|---|---|---|---|
| release | `survey-1118-release/butter` | `v0.1.0-alpha.21` (unpacked by the lead) | same as `e82b5cf` |
| head | `survey-1118-head/butter` | this branch at `edaf178`, before the anchoring change | same as `e82b5cf` |
| fix-1118-fix | `fix-1118-fix/butter` | this branch at `25f80c2`; `extension/` as at `e82b5cf` | — |
| seek-1118-fix | `seek-1118-fix/butter` | `0.1.0-alpha.21+seek.1`: the seek fix (`d595be0`) | fixed |
| seek-1118-fix2 | `seek-1118-fix2/butter` | `0.1.0-alpha.21+seek.2`: both fixes | fixed |

The seek code is the same in the three older builds. They differ only in
`stream/containment.css` (today's `overflow-anchor: none` with `cv` on).

## A. Seek release landing

### 1. Control

`LAB_ID=2 LAB_OWNER=seek-1118 EXT=<build> node lab/harness/seek-landing-live.mjs` on `math12`. All
12 questions are loaded, layout memory is unconsented (so the preview draws the unseen estimate),
and the trials start at 0.2, 0.4, 0.55, 0.7 and 0.85 of the chat. Each trial drags the thumb about
160 px, holds, and lets go. The last two trials drag up.

| Trial (start) | Preview (held) | fix-1118-fix | head | release | native (no preview) |
|---|---|---|---|---|---|
| 1 (0.2) | question 3 | question 3 +1 px, PASS | scrollTop 0 | scrollTop 0 | question 4 +2052 px, turn mounted 8 ms after release |
| 2 (0.4) | question 6 | **question 5 +31261 px**, timed out 10.0 s | question 5 at 192799 for about 2 s, then scrollTop 0 | the same (192797, then 0) | question 6 +5998 px, mounted by 636 ms |
| 3 (0.55) | question 7 | **question 6 +31378 px**, timed out 10.0 s | scrollTop 0 | scrollTop 0 | question 7 +24668 px, mounted by 909 ms |
| 4 (0.7, up) | question 5 | question 5 +1 px, PASS | scrollTop 0 | scrollTop 0 | question 5 +17816 px, mounted by 659 ms |
| 5 (0.85, up) | question 7 | question 7 +1 px, PASS | scrollTop 0 | scrollTop 0 | question 7 +1703 px, mounted by 946 ms |
| Exit | | **1** | 1 (5 FAIL) | 1 (5 FAIL) | 0 (no verdicts) |

- **Old, not new with the anchoring change.** On head and release the chat jumped back to scrollTop
  0 by itself after every release (the bug today's anchoring change fixes), so every trial there
  FAILs for that reason. But in trial 2, before the jump back, both stood at scrollTop 192797–192799
  with only question 5 mounted, which is the same wrong commit that fix-1118-fix makes. The seek code
  is identical in all three builds. Trial 3 jumped back before the trace saw the commit.
- **Native ChatGPT mounts the turn under the released thumb**, every time, within 8–946 ms. Those
  are the first trace samples after the release: the page was busy until then, so they are upper
  bounds. Native has no preview, so it lands wherever the thumb maps; the native column is not a
  landing verdict.

### 2. Cause

From the post-release trace (`REPORT trial N trace`) on fix-1118-fix:

| Trial | Butter's destination (scrollTop) | Mounted there: question, top relative to the view, height | Where the target really starts | Destination short by |
|---|---|---|---|---|
| 2 → question 6 | 192797 | question 5, −31208 px, 33980 px | 195.6k: question 5 ends 2.77k px below the view's top. Native, held at 201593, shows question 6 at −5945 px | about 2.7k px |
| 3 → question 7 | 226906 | question 6, −31325 px, 33604 px | 229.2k: question 6 ends 2.28k px below the view's top | about 2.2k px |

- **The destination is short.** The preview mapped the held position to question 6 (`known: false`,
  `layout: false`). The commit scrolls to Butter's frozen estimate of that question's top, minus the
  52 px header inset. The estimate is 2.2–2.7k px short, so the chat stands in the last 2–3k px of the
  previous answer. Questions 5 and 6 are each about 34k px tall, which is why the view is "about 31k
  px inside the previous question".
- **ChatGPT mounts only the turn under the view.** Below the view, the next turn starts more than
  two viewports (912 px each) further down, and ChatGPT never mounts it. Nothing changes for the
  next 10 s: scrollTop, scrollHeight and the mounted turn are constant in every sample.
- **More time or a scroll event does not help.** ChatGPT does mount the turn under a position, as
  native shows. Butter's commit already dispatches a scroll event.
- **Nothing of Butter's holds it there.** No held scroll, no `content-visibility` placeholder in
  view, and no earlier-history page is pending (all 12 entries are loaded). The readiness wait
  counts quiet frames only while the target is mounted, so with an unmounted target it waited out
  10 s.
- **Not established:** why the frozen model's estimate is 2.2–2.7k px short. At press time it
  splits the unmeasured height by question and answer text length. The fix does not depend on it.

### 3. Red, then green

**Red, at seam 1.** `test/seek-landing-find.test.js` runs `seek/preview-main.js`'s commit and
readiness wait over a fake virtualizer that mounts the turns within 300 px of the view. The frozen
model is wrong by a long answer above the target (destination inside the previous turn) or below
it (destination inside the next turn).

```text
$ REVIEW_SOURCE=/tmp/seek-before/extension node --test test/seek-landing-find.test.js   # e82b5cf's extension/
landed {"turn":5,"offset":8000,"ms":10016,"timedOut":true} finds undefined
landed {"turn":7,"offset":29152,"ms":10016,"timedOut":true} finds undefined
landed {"turn":6,"offset":20,"ms":112,"timedOut":false} finds undefined
ℹ pass 1
ℹ fail 2
$ node --test test/seek-landing-find.test.js
landed {"turn":6,"offset":20,"ms":384,"timedOut":false} finds [{"t":304,"from":22448,"to":54448}]
landed {"turn":6,"offset":20,"ms":384,"timedOut":false} finds [{"t":304,"from":86600,"to":54448}]
landed {"turn":6,"offset":20,"ms":112,"timedOut":false} finds []
ℹ pass 3
ℹ fail 0
```

**Fix** (the rail jump's idea, in seek's own world). The readiness wait in `seek/preview-main.js`
now looks for a destination turn that is still unmounted after 5 frames and 250 ms with scrollTop
still. `layoutCheck.findTurn` (`seek/layout-check-main.js`, pure) computes where the turn should be
from the turns mounted now. If they come before it, the target starts after the last one ends, moved
by the model's spacing to the target. If they come after it, the target starts before the first one,
moved by the same spacing. The commit moves there, at most 4 times; the existing drift retarget then
puts the question at the inset. The session dump records `finds` and the destination's `top`.

**Live, after** (seek-1118-fix, then seek-1118-fix2):

| Run | Exit | Trials | Finds | Readable after release |
|---|---|---|---|---|
| seek-1118-fix #1 | **0** | 5 PASS (each on its previewed question +1 px) | trial 2: 192797 → 195529 at 1820 ms; trial 3: 226906 → 229145 at 1886 ms | 3.0–4.1 s |
| seek-1118-fix #2 | **0** | 5 PASS | the same two, at 1835 and 1887 ms | 3.0–4.0 s |
| seek-1118-fix2 #1 | **0** | 5 PASS | trial 2: 192799 → 195529 at 1819 ms; trial 3: 226908 → 229145 at 1887 ms | 3.0–4.2 s |
| seek-1118-fix2 #2 | **0** | 5 PASS | the same two, at 1985 and 1886 ms | 3.3–4.2 s |

Verdict lines: `PASS seek-landing #1` … `#5`, `SUMMARY seek-landing: 0 FAILs`. Before, on
fix-1118-fix: `FAIL seek-landing #2: preview showed question 6 +0 (unseen estimate, from its start),
landed on question 5 +31261 (viewport 912)`, `FAIL seek-landing #3: … question 7 +0 …, landed on
question 6 +31378`, `SUMMARY seek-landing: 2 FAILs`, exit 1.

**Harness.** Its verdict rule was right and is unchanged. The default positions are now the five
used here (the old default 0.3, 0.55 and 0.8 had one failing position). It also gained a
post-release trace (`TRACE` ms, default 2000), the session's `finds` and `destination`, and
`EXT=` as a native control without verdicts.

## B. The rail's live theme switch

`LAB_ID=2 LAB_OWNER=seek-1118 EXT=<build> node lab/harness/rail-theme-switch-live.mjs` opens
`ats12`. It uses ChatGPT's own UI: profile menu, Settings, then Appearance, an in-app page at
`/settings/appearance` with no reload, where the rail's host stays in the page. There it picks Dark,
reads after 1 s, goes Back to the chat (no reload), and reads again. Then the same for Light.

| | Before (seek-1118-fix) | After (seek-1118-fix2) |
|---|---|---|
| `<html>` attributes ChatGPT changes | `data-theme`, `data-appearance-preset` (not `class`, not `style`; `data-appearance-mode` stayed `light`) | same |
| Computed `color-scheme` after Dark | `dark` | `dark` |
| Rail host `data-dark` after Dark | **absent** (`FAIL switch-dark-host`), still absent back in the chat (`FAIL switch-dark-chat`) | set **96 ms** after the pick (`PASS switch-dark-host`, `PASS switch-dark-chat`) |
| After Light | absent (it never changed) | removed **91 ms** after the pick |
| Exit | **1** | **0** |

- **Cause.** `rail/rail.js` re-checks the theme only on mutations of `<html>`'s `class` and `style`.
  ChatGPT's live switch changes neither.
- **Fix.** The observer also watches `data-theme` and `data-appearance-mode`. The check itself is
  unchanged: it reads the `dark` class or the computed `color-scheme`.
- **Red, at seam 1.** `test/rail.test.mjs` "the rail follows a switch of ChatGPT's theme without a
  reload". `test/helpers/rail-boot.mjs` now records MutationObservers, and its `theme()` sets
  attributes on `<html>`, sets the computed `color-scheme` and notifies the observers that watch
  them. It failed with `dark after the switch to dark` before the fix and passes after.
- **Theme put back.** Picking Light restored it in the UI. The harness then wrote the cookie and
  `localStorage.theme` back to their earlier values (`light`, `light`) and reloaded. After the
  reload: `PASS light-restored` (cookie `light`, `localStorage.theme` `light`, `data-theme` `light`,
  `color-scheme` `light`) and `PASS light-host`, in every run.
- Two first attempts at the harness stopped on stale UI selectors (`HARNESS ERROR`, exit 2): the
  profile button's `data-testid`, then a click on the visually hidden radio input. A third run used
  a verdict that required a change of `data-dark` even for Light. None of these are counted.

## Lab time and clean-up

- Lock `seek-1118` on lab 2 from 04:38 to 05:09 UTC (31 min of the 120 min budget). Before that
  the lab sat free for about an hour while I waited: my wait loop's `pgrep -f` pattern matched its
  own command line.
- At the end: `lab-restore --lab 2 --owner seek-1118` (exit 0, `"ok":true`: browser restarted to
  lab 2's defaults, home tab, empty composer), then `lab-lock release --lab 2 --owner seek-1118`
  (exit 0). `lab-lock status`: no lab or perf lock held.

## Files

- `report.md` (this). Logs stay in the captures directory: they hold traces only (indices, pixel
  numbers, ms), but also the lab's local paths.
- Code: `extension/seek/preview-main.js`, `extension/seek/layout-check-main.js` (`findTurn`),
  `extension/rail/rail.js`.
- Tests: `test/seek-landing-find.test.js`, `test/rail.test.mjs`, `test/helpers/rail-boot.mjs`.
- Harnesses: `lab/harness/seek-landing-live.mjs` (extended), `lab/harness/rail-theme-switch-live.mjs`
  (new).
