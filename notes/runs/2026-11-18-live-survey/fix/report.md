# The anchoring fix on real ChatGPT (lead's runs) — 2026-11-18

The same harnesses as [the survey](../report.md), run by the lead on the fix: with Smoother
streaming's `cv` setting on, `overflow-anchor: none` on the chat scroller's children at all times
(`extension/stream/containment.css`). Lab 2, Linux Chromium 156, send guard on, nothing sent. Each
harness took, restored and released the lock itself.

## Result

**The jump back to the top is gone, and the chat opens at its end.** "Before" is the survey's head
build (`edaf178`) and the release (`v0.1.0-alpha.21`), run earlier the same day on the same page.

| Check | Before (release / head `edaf178`) | Fix | Exit | Log |
|---|---|---|---:|---|
| Wheel, `ats12`, 4 loads | 4/4 and 4/4 failed, 6–9 jumps back each; every load opened at scrollTop 1990 | **0/4 failed**; opened 1–5 px from the end | 0 | [wheel-fix-anchor.log](wheel-fix-anchor.log) |
| Wheel, `ats12`, `MODE=arm`, 3 loads | head 3/3 failed; 80 writes to the end never held | **0/3 failed**; the end held after 5–6 writes | 0 | [wheel-fix-arm.log](wheel-fix-arm.log) |
| Wheel, `math12`, 2 loads, `STEPS=400` | head 1/1 failed, 6 jumps back | **0/2 failed**, reached the end in 218 and 311 steps | 0 | [wheel-fix-math12.log](wheel-fix-math12.log) |
| Rail jumps, `math9` + `math12`, 54 jumps | head 54 clean | **54 clean**; `anchoringOn` 0 of 48 unpin checks | 0 | [railjump-fix.log](railjump-fix.log) |
| Ticks, `ats12` + `math12`: wheel pass | head: 2 and 7 page jumps back; `math12` covered questions 0–2 only | **0 page jumps back**, 12/12 questions seen on both; all `wheel-*` PASS | — | [ticks-fix.log](ticks-fix.log) |
| Ticks: 24 clicks, keys | release 10/24 clicks ended at the chat's start; head 24/24 | **24/24 landed**, lit and only lit, still 2 s later; `keys-*` PASS | — | same |
| Ticks: `card-text` | FAIL `ats12` tick 4 on both | FAIL `ats12` tick 4 (unchanged: the long-paste question, [second pass](../../2026-11-18-live-features/report.md), section 4) | 1 | same |

Every Butter load reported the scroller `auto` and its children `[T:none, none]`: the rule applied.
`scrollHeight` at open was 10256–10276 on `ats12`, as without an extension (10276); the survey's
head and release loads opened at 14817–15057.

## Builds

- `0.1.0-alpha.21+anchor.1`: the builder's branch at `d2888b4`, used for the first wheel run.
- `0.1.0-alpha.21+fix.1` and its dev build `+dev.1`: this branch at the merge `325387e`, used for
  the rest. `extension/` is the same in both (the merge added only lab files and notes).

## Notes

- **A stopped run.** The first `math12` wheel load used the default 150 steps: no jump back, but
  150 steps of 700 px cannot reach the end of that chat, so the harness printed FAIL
  ([wheel-fix-math12-150steps-stopped.log](wheel-fix-math12-150steps-stopped.log)). The run was
  then stopped by the shell's time limit while it held the lock; the lead restored lab 2 and
  released that lock by hand. The rerun with `STEPS=400` is the row above.
- **`math12`'s blocked requests.** Each open of `math12` had 2 `POST …/f/conversation/prepare`
  blocked by the guard, ChatGPT's own, as in the survey. Nothing was sent.
- **One load "not opened at the end".** The harness flags `ats12` load 1 of the first run at 5 px
  from the end; the other loads were 1 px from it.

## Not established

- macOS Chrome, overlay scrollbars and trackpad input.
- Any load count large enough for a failure rate: 9 wheel loads passed, against 12 of 12 failing
  before.

## Commands

```text
LAB_ID=2 EXT=~/snap/chromium/common/fix-1118-anchor/butter LABEL=fix-anchor LOADS=4 GAP=20000 node lab/harness/wheel-jump-live.mjs
  SUMMARY fix-anchor: 0/4 loads failed                                                          exit 0
LAB_ID=2 EXT=~/snap/chromium/common/fix-1118-dev/butter LABEL=fix-railjump node lab/harness/rail-jump-live.mjs
  SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,…,"unpinChecks":48,"anchoringOn":0,"cvOff":0}  exit 0
LAB_ID=2 EXT=~/snap/chromium/common/fix-1118-fix/butter LABEL=fix-ticks node lab/harness/rail-ticks-live.mjs
  SUMMARY fix-ticks: 1 FAIL   (ats12 card-text, tick 4)                                         exit 1
LAB_ID=2 EXT=~/snap/chromium/common/fix-1118-fix/butter LABEL=fix-math12 FIXTURES=math12 LOADS=2 STEPS=400 GAP=20000 node lab/harness/wheel-jump-live.mjs
  SUMMARY fix-math12: 0/2 loads failed                                                          exit 0
LAB_ID=2 EXT=~/snap/chromium/common/fix-1118-fix/butter LABEL=fix-arm MODE=arm LOADS=3 GAP=20000 node lab/harness/wheel-jump-live.mjs
  SUMMARY fix-arm: 0/3 loads failed                                                             exit 0
```
