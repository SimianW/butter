# Rail jumps to questions 0–2 and ChatGPT's end pin (issue #171, stage 1a) — 2026-11-24

Measurement only; nothing under `extension/` was changed. Lab 2, fixture `math12`, dev build of
`feat/implement-171` at `e37e393` (`0.1.0-alpha.22+dev.1`, `python3 scripts/package.py --dev`,
unpacked to `~/snap/chromium/common/rail-pin-171a/dev/butter`). The rail was turned on in its storage
and the stored value put back afterwards. Send guard on in every connection; no message was sent and
Enter was never pressed. ChatGPT's code is described by its minified names; none of it is copied.
Raw captures (per-frame JSON, the two saved chunk builds, unscrubbed logs) stay in
`~/.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-pin/`.

## Result

**The end pin is set in every failing jump, and in no clean jump to questions 0–2.** In the 7 failed
jumps with working logpoints (runs 2 and 4), the pin (`cc.current.bottom`) was true at the click,
after **65 of 65** Butter scrollTop writes, and at **22 of 22** end pulls. Each pull was ChatGPT's
`ResizeObserver` tail (`ROtail`) with the pin true and growth `m` of +124 to +272 px, followed by `ah`
`scrollTo` the end.

**Questions 0–2 differ from 3–11 by growth, not by the pin.** After the target mounts, a jump to 0, 1
or 2 always sees the transcript shrink and grow back by 124–272 px (`ROgrow` m −136 then +136,
repeating). After a jump to 3, 6 or 11 mounts, ChatGPT's observer reached its growth step **0 times**
in 9 of 9 jumps, 5 of them with the pin set, so nothing pulled. The clean jumps to 0–2 (bottom→0–2 in
the 8-jump order) had the growth, but the pin was false.

**The harness's own setup sets or keeps the pin.** Opening the chat sets it (true after loading
history, 3 of 3 runs). The one-pixel "unpin" wheel notch clears it only when the chat is away from the
end (true → false, 2 of 2). At the chat's end it either leaves it set (true → true, 7 of 7) or **sets
it** through ChatGPT's `scrollToBottom` (`ao`) when it was clear (false → true, 3 of 3). That confirms
the hypothesis. The edge writes (scrollTop 0 or the end) never changed the pin (20 of 20).

## Q1. Is the end pin set during the failing jumps?

Two ways of reading the pin:

- **Logpoints:** points inside ChatGPT's code that print `cc.current.bottom` (`adhoc/lp.json`).
- **`pinNow()`:** reads the same ref through React's fiber hooks (the hook ref whose `current` is
  exactly `{bottom, top}`, ChatGPT's `cc`). In run 4 it agreed with the logpoints at 20 of 20 setup
  readings. Three more readings follow a `cE` hit, whose logpoint prints the pin before `cE` writes
  it; there the next logpoint reading agrees with `pinNow()`.

Definitions for the table:

- **At click:** `pinNow()` at the measurement start (30–130 ms before the trusted click), and the first
  logpoint after the click.
- **After a Butter write:** the first `scroll` listener hit after the write.
- **End pull:** a MAIN-world `scrollTo` to the end from far away, with the `ROtail` and `ah` logpoint
  hits beside it. For run 4's top→0 and top→1 the `JUMP` line's own matching left the pull's pin empty
  (`ahPin: null`); their pin and `m` are read from the `LPJUMP` line, where `ROtail` and `ah` print
  the pin true 3 ms before each pull.

| Run | Jump | Class | Pin at click (`pinNow` / LP) | Pin after Butter writes | End pulls |
|---|---|---|---|---|---|
| 2 | top→0 | failed | true / true | true at 10 of 10 | 3, pin true at 3 of 3 (`ROtail` m 136, 136; the third had no `ROtail` matched, `ah` pin true) |
| 4 | top→0 | failed | true / true | true at 10 of 10 | 3, pin true at 3 of 3; m 136, 136, 136 |
| 4 | top→1 | failed | true / true | true at 10 of 10 | 3, pin true at 3 of 3; m 124, 248, 248 |
| 4 | top→2 | failed | true / true | true at 5 of 5 | 4, pin true at 4 of 4; m 136, 136, 124, 136 |
| 4 | bottom→0 (after top→11) | failed | true / true | true at 10 of 10 | 3, pin true at 3 of 3; m 136, 136, 136 |
| 4 | bottom→1 | failed | true / true | true at 10 of 10 | 3, pin true at 3 of 3; m 260, 260, 272 |
| 4 | bottom→2 | failed | true / true | true at 10 of 10 | 3, pin true at 3 of 3; m 136, 136, 136 |
| **all** | **7 failed** | | **true, 7 of 7** | **true at 65 of 65** | **22 pulls, pin true at 22 of 22, each after `ROtail` m > 0 with the pin true** |

No logpoint that writes the pin (`cy` unpin, `cE`, `ao`, `ar`, `cH`) fired during any failed jump,
from the click to the end of the measurement. The pin was set before the click and stayed set.

Run 3 repeated the failures with the same pattern, read by `pinNow()` only (its logpoints were
misplaced; see Runs). Its 6 failed jumps were top→0, 1, 2 and bottom→0, 1, 2 after top→11, each with
the pin true at the start and at the end.

## Q2. Why only questions 0–2?

Run 4. "Growth after mount" = the `ROgrow` hits from the first frame with the target mounted to the
end of the measurement. `ROgrow` is the observer's growth step, and `m` is the transcript's height
change since its last callback.

Read from code: `ROgrow` runs in every callback except one that returns early through `cN()`, `bH` or
a zero-height viewport. "0 hits" means the observer did not reach its growth step at all. (The `ROcb`
logpoint, meant to count every callback, never hit; see Not established.)

| Jump | Pin at click → after mount | Growth after mount (`ROgrow` m, px) | Pulls | Class |
|---|---|---|---|---|
| top→0 | true → true | −136, +136, −136, +136, −136, +136 | 3 | failed |
| top→1 | true → true | −136, +124, −124, +248, −248, +248 | 3 | failed |
| top→2 | true → true | target never mounted on a frame; 8 `ROgrow` hits after the click, max +136 | 4 | failed |
| top→3 | true → true | **0 hits** | 0 | clean |
| bottom→0 (8-jump order, after top→3) | **false** → false | −136, +136 | 0 | clean |
| bottom→1 (8-jump order) | **false** → false | −272, +124, +12, +136 | 0 | clean |
| bottom→2 (8-jump order) | **false** → false | −136, +136 | 0 | clean |
| bottom→3 (8-jump order) | false → false | **0 hits** | 0 | clean |
| top→6 | false → false | **0 hits** | 0 | clean |
| top→11 (3 jumps) | false → false | **0 hits** after mount (one +1149 before mount, in the first) | 0 | clean |
| bottom→0 (after top→11) | true → true | −136, +136, −136, +136, −136, +136 | 3 | failed |
| bottom→1 | true → true | −272, +260, −260, +260, −260, +272 | 3 | failed |
| bottom→2 | true → true | −136, +136, −136, +136, −136, +136 | 3 | failed |
| bottom→3 (after bottom→2, pinned) | true → true | **0 hits** | 0 | clean |
| bottom→6 (after top→11, pinned) | true → true | **0 hits** | 0 | clean |
| bottom→11 (after top→11, pinned) | true → true | 0 hits; the chat was already at the end | 0 | clean |

An end pull needs both the pin and growth:

- **Clean jumps to 3, 6 and 11 lack the growth:** 0 growth steps after mount in 9 of 9, 5 of them
  with the pin set.
- **Clean jumps to 0–2 lack the pin:** false in 3 of 3, with the same growth (+136 / +124).
- **Failed jumps had both:** 6 of 6.

## Q3. What do the harness's setup inputs do to the pin?

`rail-jump-live.mjs` does this per step:

1. `unpin()`: mouse to 1000,420, `wheel(0, 1)`, 50 ms.
2. The edge write: `scrollTop` = 0 or `scrollHeight`.
3. 700 ms.
4. A positioning loop that rewrites the edge while the chat is more than 2 px from it.

`adhoc/rpin.mjs` runs the same inputs in the same order. It reads the pin before each input, right
after it (sync), and after the wait. All rows are run 4.

| Start | Chat before the input | Input | Pin before → after | Logpoints (ChatGPT's code) | Count |
|---|---|---|---|---|---|
| page open + history load | – | `ar` (restoration) | → **true** | `ar` at open | 3 of 3 runs |
| from the top (first steps after open) | at the end, pinned | wheel 1 px | true → true | `cO` wheel "toward"; pin already true, so no `ao` | 4 of 4 |
| from the top | at the end | edge write 0 | true → true | `scroll` with `cb` null → `cu` only (not a user scroll) | 4 of 4 |
| from the top | at 0 | (no input) | true; **pulled 0.97–1.03 s after each write to 0** | `ah` keeps the distance (~0.8 s), `ROgrow` m −136, then `ROgrow` m +136 → `ROtail` pin true → `cu` to 0 | 5 of 5 timed writes (1 edge, 4 positioning rewrites) |
| from the top, after a jump landing mid-chat (103k, 196k) | mid-chat | wheel 1 px | true → **false** (2), false → false (2) | `cO` "toward" → `scroll` with `cb` toward → `cE(a, a+1)`: new < old but > 24 px, so pin = false | 4 of 4 |
| from the top, unpinned | mid-chat | edge write 0 | false → false; the same +136 growth ~0.9 s later is not a pull (`ROtail` keeps the distance) | `cu` only | 4 of 4 |
| from the bottom, 8-jump order (after top→3, at 103k) | mid-chat, pinned | wheel 1 px | true → **false** | `cE(244121, 244122)` | 1 of 1 |
| from the bottom, 8-jump order (after bottom→0, 1, 2) | at 20 / 31.9k / 78.9k | wheel 1 px | false → false | `cE` | 3 of 3 |
| from the bottom, any | mid-chat | edge write to the end | false → false | `scroll` with `cb` null → `cu` only | 4 of 4 |
| from the bottom, 30-jump order (after top→11, which ends at the end) | **at the end, unpinned** | wheel 1 px | false → **true** | `cO` "toward" with pin false → **`ao`** (`scrollToBottom`) → `ah`, pin true | 3 of 3 |
| from the bottom, after a failed jump (ended at the end, pinned) | at the end | wheel 1 px | true → true | `cO` only | 3 of 3 |
| from the bottom, at the end | at the end | edge write to the end | true → true (no scroll: already there) | none | 6 of 6 |

**(a) Why "from the top" starts are pulled.**

- The pin is set when the chat opens.
- Nothing in the setup clears it: the wheel notch is made at the chat's end, and the write to 0 is
  not a user scroll.
- Each write to 0 is then pulled to the end about 1.0 s later (0.97–1.03 s, 5 of 5). The transcript
  shrinks by 136 px and grows back 136 px, and the observer's tail scrolls to the end because the pin
  is set.
- The harness writes 0, waits 700 ms, prepares, finds the chat still at 0, and starts measuring. The
  pull then lands about 0.25 s into the measurement, which fits the 11–111 ms reported earlier on
  11-24. This timing is **inferred** from the 700 ms wait and the measured ~1.0 s delay.
- In this script the pin readings lengthen the setup, so the positioning check came after the pull
  and rewrote 0. That rewrite was pulled again 1.0 s later, before the click.

**(b) Why bottom→0–2 fail only in the 30-jump order.**

- In the 30-jump order they follow top→11, which ends at the chat's end with the pin clear. The
  one-pixel notch is then a gesture toward the end, made at the end, while unpinned. ChatGPT answers
  it with `scrollToBottom`, which sets the pin (3 of 3). The edge write keeps it, and the jump to 0–2
  has the growth, so it is pulled.
- In the 8-jump order they follow top→3, which ends at about 103,400 px. There the same notch is a
  user gesture toward the end that does not end within 24 px, so `cE` clears the pin (1 of 1). The
  edge write to the end does not count as a user scroll and leaves it clear (4 of 4). The jump has the
  growth but no pin.
- The later bottom jumps in the 8-jump order start unpinned too (3 of 3).

Read from code, not measured:

- `cE(new, old)` sets the pin to `new < old && new <= 24`.
- `ao` sets it to `followContentGrowth !== false`.
- `cO`'s "toward" branch calls `scrollToBottom` only when the chat is within the end threshold and
  not pinned.

Why `cb` was null at the edge write's scroll event, 50 ms after the wheel set it to "toward", was not
traced.

## Runs

Lock `rail-pin-171a` on lab 2, taken 23:24:27 UTC and released 23:36:51 UTC (12.4 min). 4 script runs
of the 10 allowed. Each run was `adhoc/run.sh <name> '<STEPS json>'`, which runs `LAB_ID=2
LAB_OWNER=rail-pin-171a EXT=<dev build> LP=…/adhoc/lp.json LP_URL=<regex> STEPS=<json> OUT=<capture>
node notes/runs/2026-11-24-rail-jump-pin/adhoc/rpin.mjs`.

| # | Name | Steps | Exit | Result | Log |
|---:|---|---|---:|---|---|
| 1 | r1-smoke | top→0, top→3 | 2 | Setup error: the rail is off on a new install (Experimental page, #158), so `chatgpt-butter-nav[data-on]` never appeared. The script now turns the rail on in storage and puts the stored value back. | [adhoc/r1-smoke.log](adhoc/r1-smoke.log) |
| 2 | r2-smoke | top→0, top→3 | 0 | Chunk build `77a8c190f1` loaded; logpoints valid. top→0 failed (pin true throughout, 3 of 3 pulls pinned); top→3 clean, 0 growth after mount. | [adhoc/r2-smoke.log](adhoc/r2-smoke.log) |
| 3 | r3-matrix | top→0,1,2,3; bottom→0,1,2,3; top→6, 11; bottom→0,1,2,6,11 | 0 | ChatGPT served chunk build `c55b0947a1`, so the logpoints (columns for `77a8c190f1`) were misplaced and their values are **not used**. `pinNow()` readings and classes are valid: failures top→0–2 and bottom→0–2 after top→11, all pinned; bottom→0–2 clean in the 8-jump order, unpinned. | [adhoc/r3-matrix.log](adhoc/r3-matrix.log) |
| 4 | r4-matrix-lp | top→0,1,2,3; bottom→0,1,2,3; top→6, 11; bottom→0,1,2,3; top→11; bottom→6; top→11; bottom→11 | 0 | `lp.json` holds columns for both builds; `c55b0947a1` loaded; 32 of 32 logpoints resolved. Source of the Q1–Q3 tables. | [adhoc/r4-matrix-lp.log](adhoc/r4-matrix-lp.log) |

`rpin.mjs` reports and does not judge, so it exits 0 whether or not jumps fail; exit 2 is a setup
error. After run 4, one line changed with no change in behaviour: the page pick tests the host with a
regex instead of a URL literal, so the privacy grep stays clean.

### Using the script (stage 1b)

Environment variables:

- `LAB_OWNER`: the held lock's owner. The script refuses to run without a held lock.
- `EXT`: the unpacked dev build.
- `LP`: `adhoc/lp.json`.
- `LP_URL`: a regex for the chunk's URL, with the literal `HASH` where the build hash goes. As run:
  `/76629\.HASH\.js`. Each logpoint's `chunk` field fills in `HASH`.
- `STEPS`: a JSON array like `rail-jump-live.mjs`'s `ONLY`.
- `OUT` and `FIXTURE`: optional.

Steps:

- Each step is `{"from": "top"|"bottom"|"previous"|"none", "to": N, "pre": [...]}`.
- `top` and `bottom` run the harness setup: wheel notch, edge write, 700 ms, positioning loop.
- `pre` lists extra inputs that run after that setup and before the click. Each is read like a setup
  input: pin before, sync and after 700 ms, with the logpoint hits in between. Available inputs:
  `wheeldown`, `wheelup` (±120), `wheel1`, `write0`, `writeEnd`, `wait1000`.
- **To add a gesture:** add an entry to the `inputs` object in `rpin.mjs` (an async function that
  performs it), then name it in `pre`.
- Example, to test what clears the pin before a failing jump:
  `STEPS='[{"from":"bottom","to":11},{"from":"bottom","to":0,"pre":["wheelup"]}]'`.

Output lines:

- `SETUP`: pin before → sync → after, the chat's position, logpoint hits.
- `GAP`: hits between the last setup reading and the start (pulls before the click).
- `JUMP` (JSON): class; pin at start and end; Butter writes with the pin after each; end pulls with
  the `ah` pin and `ROtail` m; growth after mount.
- `LPJUMP`: the jump's logpoint hits.

`window.__pinNow()` is available in the page for ad-hoc reads.

**When ChatGPT ships a new build of chunk 76629**, `LOGPOINTS` prints a `chunks` name that is not in
`lp.json`, and the hits are garbage, as in run 3. To fix it:

1. Fetch that build.
2. Remap each logpoint by the 60 characters on either side of its column in an already-mapped build.
   All 16 mapped uniquely between `70d1df8967` (11-23), `77a8c190f1` and `c55b0947a1`.
3. Add the entries with the new `chunk`.

`pinNow()` does not depend on the build.

## Not established

- **What shrinks and grows by 124–272 px** when a turn among questions 0–2 is mounted. These are the
  `ROgrow` −m/+m pairs, about 0.1–0.3 s apart, repeating after every Butter retry. Also why no growth
  follows a mount of 3–11. The pairs also appear with no rail jump, after any write to 0. Not traced:
  no logpoint or DOM probe was on the changing element.
- **`ROcb`**, the logpoint meant to count every observer callback, never hit in any run. Its column
  is after the callback's `cN()` and `bH` early returns, and `ROgrow`, further down the same callback,
  did hit. It most likely resolved to a location that never runs. The "0 hits" in Q2 come from
  `ROgrow` and cover callbacks that reach the growth step.
- **The 11–111 ms delay in the harness itself.** Q3 (a) explains it by inference. The harness was not
  run with the logpoints attached, and this script's extra reads change the setup timing.
- **Why the edge write's scroll event had `cb` null** 50 ms after the wheel set it (4 of 4 bottom edge
  writes from mid-chat). This is why the write does not re-pin, but the code that clears `cb` was not
  identified.
- **Which build of chunk 76629 a page gets:** `77a8c190f1` in run 2, `c55b0947a1` in runs 3 and 4,
  within 6 minutes. Run 2's `LOGPOINTS` listed both names. Both builds behaved the same in these
  readings.
- **No-extension control:** not run (not part of this stage's questions; stage 1b).

## Lab time and clean-up

- Lock `rail-pin-171a` on lab 2, 23:24:27–23:36:51 UTC, 4 runs (1 setup error). Lab 1 was not used.
  No perf lock (no timing benchmark).
- The dev build ran from a new unpacked path with empty storage (`{"defaultsVersion":1}` after the
  first load). The script set `opts.rail: true` and put the stored value back after each run (`OPTS
  put back` in each log).
- `lab-restore --lab 2 --owner rail-pin-171a`: exit 0; browser restarted with no extension, home tab,
  empty composer ([restore.log](restore.log)). `lab-lock release`: exit 0.
  [lock-status.log](lock-status.log) shows lab 2 `"held": false`.
- The two chunk builds were fetched read-only (GET) from ChatGPT's CDN into `captures/…/src/` to map
  the logpoints. They are not in the repo.
- `git status --short extension/` is empty.

## Files

- `report.md` (this file).
- `adhoc/rpin.mjs`: the probe. It reuses `lab/harness/rail-jump-live-page.mjs` and
  `rail-jump-scroll-probe.mjs`, and the logpoint method of `2026-11-23-seek-pin-cause/adhoc/pin.mjs`.
- `adhoc/run.sh`: the run wrapper.
- `adhoc/lp.json`: 16 logpoints × 2 chunk builds (`chunk` `77a8c190f1` / `c55b0947a1`), with the URL
  regex replaced by `<script>`. Labels as on 11-23, plus `ROcb`, `ROgrow` (the observer's growth step),
  `ao` (`scrollToBottom`) and `ar` (restoration).
- `adhoc/r*.log`, `restore.log`, `lock-status.log`: scrubbed logs (URLs `<url>`, ids `<id>`, home
  `~`). They hold only numbers, labels and minified names.
