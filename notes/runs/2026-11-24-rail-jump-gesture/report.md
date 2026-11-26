# Rail jump to questions 0–2: which script-dispatched gesture clears ChatGPT's end pin (issue #171, stage 1b) — 2026-11-24

Measurement only, **no extension loaded** (`EXT=`, `EXTENSIONS 0` in every log); nothing under `extension/` or
`lab/harness/` changed. Lab 2, fixture `math12` (12 questions, scrollHeight 316–350k px, clientHeight 912). Send guard on
in every connection; nothing was typed, Enter was never pressed, nothing was sent. ChatGPT's code is named by its minified
names only. Raw captures (per-trial JSON, unscrubbed logs) stay in `~/.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-gesture/`.

## Result

**Both G1 (the scrollbar gesture) and G2 (one synthetic wheel notch away, then the write) are accepted.** With the pin
set, G1 left the pin false in **12 of 12** trials (10 + 2 with a menu open) and every hold check had growth in the hold
and held (**12 of 12**); G2 left it false in **12 of 12** (10 + 2 with a menu open) and held **12 of 12**, growth in 12.
The controls show the run sees the bug: a plain scrollTop write to questions 0–2 was **pulled 6 of 6**, with the pin true
at ChatGPT's growth step each time. A reader's own thumb drag to questions 0–2 left the pin false **6 of 6** and was
pulled 0 of 6, so the spec's design is not contradicted (see C2 for what the drag's hold checks prove).

Differences between the two, for choosing:

- **G2 depends on order and position.** Wheel first, then the write: 12 of 12. Write first, then the wheel: 2 of 3; the
  failure was the write to question 0 (scrollTop 0), where a notch "away" (up) cannot move, so ChatGPT's `cO` did not
  call `cy` and the chat was pulled. G1 has no such case.
- **G1 closes an open ChatGPT menu at once** (2 of 2; focus moves from the menu to `body`); G2 left it open
  synchronously (2 of 2). In both, the menu was gone by the end of the 6 s hold (the jump moved its turn away).
- **G1 works from an isolated world** (3 of 3, as Butter's rail runs). G2 from an isolated world was not measured.
- Neither changed focus (outside the menu case), a text selection (3 of 3 each), or the composer's text or focus.

## C1. Control: plain scrollTop write, pin set (run 2)

| Target | Trials | Pin after write | Hold | Growth in hold (`ROgrow`/`ROtail` m, pin at it) | Back at the end (first sampled frame) |
|---|---:|---|---|---|---|
| q0 (scrollTop 0) | 2 | true 2 of 2 | **pulled 2 of 2** | 2 of 2, m +136, pin true, at 1.07–1.09 s | 1.91, 1.95 s |
| q1 (31,897) | 2 | true 2 of 2 | **pulled 2 of 2** | 2 of 2, m +260, pin true, at 2.69–2.72 s | 3.53, 3.56 s |
| q2 (78,852) | 2 | true 2 of 2 | **pulled 2 of 2** | 2 of 2, m +136, pin true, at 2.85–2.86 s | 3.70, 3.71 s |
| **all** | **6** | **true 6 of 6** | **pulled 6 of 6** | **6 of 6** | ChatGPT `scrollTo` to the end: 1 per trial |

The first frame sampled back at the end comes about 0.85 s after the `ROtail` hit; that gap is between rAF samples
(probably one long frame), not established.

## C2. Control: a reader's own input, pin set (run 3)

| Input | Trials | Pin after | Pin at hold end | Pulled | Hold growth | Notes |
|---|---:|---|---|---:|---|---|
| Real thumb drag from the end to q0 | 2 | false 2 of 2 | false 2 of 2 | 0 | none in the hold; growth m +124…+144 with **pin false** during the drag, 2 of 2 | landed at 5,755 / 6,112 (inside q0) |
| Real thumb drag to q1 | 2 | false 2 of 2 | false 2 of 2 | 0 | same, 2 of 2 | landed at 36,326 (inside q1) |
| Real thumb drag to q2 | 2 | false 2 of 2 | false 2 of 2 | 0 | same, 2 of 2 | landed at 82,724 (inside q2) |
| Real wheel from the end to q0 | 2 | false 2 of 2 | false 2 of 2 | 0 | 2 of 2 in the hold (m +136, pin false) | **fallback used**: see below |

- **Drag:** pin false after **6 of 6**, pulled **0 of 6**. The pin went false at the drag's first scroll event (`cE`
  ~0.1 s after the press, pin true → false), and every growth step during the drag (6 of 6 drags, 2–8 hits each) read
  pin false. In the 6 s after release there was no growth (scrollHeight constant, 0 `ROgrow`), so the hold checks
  themselves are **"no growth, proves nothing"** by the brief's rule. The drag took longer than scripted (growth hits up
  to 12 s after the press, before the release), so the growth fell inside the drag.
- **Wheel:** `page.mouse.wheel(0, −(scrollTop − destination))` (one delta of about −315k px) **did not scroll at all**,
  5 of 5 attempts in each trial (scrollTop unchanged, 315,428); ChatGPT's `cO` saw each as wheel "away" with pin true and
  did not call `cy`. So each trial used **one real notch up (−120) followed by a scrollTop write to 0**: pin false
  2 of 2, held 2 of 2, growth in the hold 2 of 2. Why the large delta did not scroll is not established.

No reader input to questions 0–2 was pulled, so the run continued.

## C3-G1. The scrollbar gesture from page JavaScript, main world (runs 1 and 2)

| Run | Trials | Targets | Pin before | Pin right after | scrollHeight same at press and scroll | Pin at hold end | Pulled | Held, growth in hold |
|---|---:|---|---|---|---|---|---:|---|
| 2 | 10 | q0 ×4, q1 ×3, q2 ×3 | true 10 of 10 | **false 10 of 10** | 10 of 10 | false 10 of 10 | 0 | **held 10 of 10, growth in 10** |
| 2 | 2 (menu open) | q0, q1 | true 2 of 2 | false 2 of 2 | 2 of 2 | false 2 of 2 | 0 | held 2 of 2, growth in 2 |
| 1 (smoke) | 2 + 2 menu | q0, q1 | true 4 of 4 | false 4 of 4 | 4 of 4 | false 4 of 4 | 0 | held 4 of 4, growth in 4 |

Growth in the hold: q0 m +136 at 1.03–1.11 s; q1 m +260 then +12 at 2.75–3.02 s; q2 m +136 at 2.75–2.79 s; every hit read
pin false. Logpoints: `cE` hit 47–49 ms into each trial's window, inside the gesture's task, with new distance = the
destination's distance from the end and old = 0, pin true before it (so `cE` set it false).

## C3-G2. One synthetic wheel notch away (run 3)

| Order | Trials | Pin after the wheel (before the write) | Pin after the write | Pin at hold end | Pulled | Held, growth in hold |
|---|---:|---|---|---|---:|---|
| wheel, then write | 10 (q0 ×4, q1 ×3, q2 ×3) | **false 10 of 10** | false 10 of 10 (80 ms later too) | false 10 of 10 | 0 | **held 10 of 10, growth in 10** |
| wheel, then write, menu open | 2 (q0, q1) | false 2 of 2 | false 2 of 2 | false 2 of 2 | 0 | held 2 of 2, growth in 2 |
| write, then wheel | 3 (q0, q1, q2) | n/a | **true at q0**, false at q1 and q2 | true 1, false 2 | **1 (q0)** | held 2 of 2 (q1, q2) |

The synthetic wheel did not scroll the page (scrollTop unchanged between the wheel and the write, 10 of 10) and was not
`defaultPrevented`. Logpoints in the write-first trials: `cO` wheel "away" with pin true each time, then `cy` (pin
false) at q1 and q2; at q0 `cO` without `cy` (the chat was at scrollTop 0 and could not move away).

## G1 extras (run 3)

| Case | Trials | Pin before | Pin right after | Later | Hold |
|---|---:|---|---|---|---|
| (a) G1 from an isolated world (`Page.createIsolatedWorld` + `Runtime.evaluate` with its context id), to q0, q1, q2 | 3 | true 3 of 3 | false 3 of 3 (read in the main world in the next CDP call) | false at hold end 3 of 3 | held 3 of 3, growth in 3; scrollHeight same 3 of 3 |
| (b1) G1 ending at the chat's end, from mid-chat (157,594) with the pin clear | 3 | false 3 of 3 | **true 3 of 3** | true 1.5 s later 3 of 3 | n/a |
| (b2) G1 that moves 0 px, at the end, pinned | 3 | true 3 of 3 | **true 3 of 3** (unchanged) | true 1.5 s later 3 of 3 | n/a |
| (c) G1 to q0, then writes at +0.3 s (365), +0.9 s (0), +1.6 s (365) and +3.1 s (0) | 3 | true 3 of 3 | false 3 of 3 | false at each of the 4 writes, 12 of 12, and at hold end 3 of 3 | held 3 of 3, growth in 3 (m +136 at 1.10–1.12 s) |

(b1) and (b2) match the code (section (a) of the 11-23 report): `cE(new, old)` sets the pin when the move goes toward the
end and ends within 24 px; a scroll event with no scrollTop change since the press records no gesture.

## Side effects

`before` is read in the same task just before the gesture, `after` just after it.

| Gesture | Trials | Focus (tag[role]) before → after | Selection made first | Open menu first | Composer text same | Composer focus same |
|---|---:|---|---|---|---|---|
| G1 | 10 | `div[textbox]` → `div[textbox]` 10 of 10 | kept 3 of 3 (11 chars, not collapsed, 1 range) | – | 10 of 10 | 10 of 10 |
| G1, menu open | 2 | `div[menu]` → **`body`** 2 of 2 | – | **closed at once 2 of 2** (1 → 0 visible `[role=menu]`) | 2 of 2 | 2 of 2 (not focused) |
| G2 | 10 | `div[region]` → `div[region]` 10 of 10 | kept 3 of 3 | – | 10 of 10 | 10 of 10 |
| G2, menu open | 2 | `div[menu]` → `div[menu]` 2 of 2 | – | **still open 2 of 2**; gone after the 6 s hold 2 of 2 | 2 of 2 | 2 of 2 |
| G2 write first | 3 | unchanged 3 of 3 | – | – | 3 of 3 | 3 of 3 |
| G1 isolated world | 3 | `body` → `body` 3 of 3 | – | – | 3 of 3 | 3 of 3 |
| Real thumb drag (C2) | 6 | `div[textbox]` → **`div[region]`** in the first; already `div[region]` in the others | – | – | 6 of 6 | 5 of 6 (the real press takes focus from the composer) |

Visible `[role=dialog]`: 0 before and after in every trial. The menu was a turn's "More actions" menu, opened by a real
click and closed with Escape afterwards. Which of G1's events closes the menu is **not established** (ChatGPT's menus
usually close on a pointerdown outside them; not traced). In run 1 the menu probe counted hidden `[role=menu]` elements
(38 → 39 → 38); fixed before run 2 to count visible ones.

## The accepted gestures, for a builder

Both are dispatched on the chat's scroller: the `.thread-scroll-container` element whose `clientHeight > 0`. "dest" is
the scrollTop to land on. ChatGPT's listeners are on the scroller itself (target/bubble phase), so the events must be
dispatched **on the scroller element**, not on a child or the window.

**G1, the scrollbar gesture** (as run, `adhoc/gesture.mjs`, `const G1`), all synchronously in one task:

```js
const r = s.getBoundingClientRect(), x = Math.round(r.right - 5), y = Math.round(r.top + r.height / 2);
const init = { bubbles: true, cancelable: true, composed: true, view: window, pointerId: 1, pointerType: 'mouse',
  isPrimary: true, button: 0, buttons: 1, clientX: x, clientY: y, screenX: x, screenY: y };
s.dispatchEvent(new PointerEvent('pointerdown', init)); // target === s; pointerType 'mouse'
s.scrollTop = dest;                                     // scrollHeight must not change between press and scroll event
s.dispatchEvent(new Event('scroll'));                   // the "first scroll after a scrollbar press"
s.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
```

Conditions (read from code and confirmed by (b1)/(b2)): scrollHeight at the `scroll` event equals scrollHeight at the
`pointerdown` (it did in 28 of 28 G1 dispatches here; reading scrollHeight before and after the write is a cheap check),
and the write must actually change scrollTop. A move toward the end that ends within 24 px of it sets the pin instead.
Works from an isolated world (3 of 3). Side effect: closes an open ChatGPT menu.

**G2, one wheel notch away, then the write** (`const G2`), synchronously:

```js
const r = s.getBoundingClientRect(), x = Math.round((r.left + r.right) / 2), y = Math.round(r.top + r.height / 2);
s.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, composed: true, view: window,
  deltaX: 0, deltaY: -120, deltaZ: 0, deltaMode: 0, clientX: x, clientY: y, screenX: x, screenY: y }));
s.scrollTop = dest;                                     // after the wheel, not before
```

Condition: the chat must be able to move up at the moment of the wheel (it is not at scrollTop 0), so the wheel must come
before the write. Dispatched from the main world only in this run.

## Runs

Lock `rail-pin-171b` on lab 2. Each run was `adhoc/run.sh <name> <PHASES> <N>`, which runs `LAB_ID=2
LAB_OWNER=rail-pin-171b EXT= LP=…/adhoc/lp.json LP_URL='/76629\.HASH\.js' PHASES=<…> N=<…> OUT=<capture> node
notes/runs/2026-11-24-rail-jump-gesture/adhoc/gesture.mjs`. The script reports and does not judge (exit 0; 2 on a setup
error). Chunk build `76629.c55b0947a1.js` was served in all three runs, which `lp.json` (copied from stage 1a) maps:
32 of 32 logpoints resolved, `valid: true`.

| # | Command | Exit | Result | Log |
|---:|---|---:|---|---|
| 1 | `run.sh r1-smoke g1 2` | 0 | G1 2 + 2 menu trials, all pin false and held. Probe fixes after: menus counted hidden elements; the selection helper selected nothing. Both fixed; no other change. | [adhoc/r1-smoke.log](adhoc/r1-smoke.log) |
| 2 | `run.sh r2-g1-c1 g1,c1 10` | 0 | C3-G1 (10 + 2 menu) and C1 (6). | [adhoc/r2-g1-c1.log](adhoc/r2-g1-c1.log) |
| 3 | `run.sh r3-rest c2,g2,xa,xb,xc 10` | 0 | C2 (6 drags, 2 wheels), C3-G2 (10 + 3 write-first + 2 menu), extras (a) 3, (b) 3 + 3, (c) 3. | [adhoc/r3-rest.log](adhoc/r3-rest.log) |

The `REPORT c2-drag` line in run 3's log says "growth 6": the script counted growth from the press, which includes the
drag. The C2 table above separates growth during the drag from growth in the hold.

## Not established

- **C2 drag hold checks with growth after release.** All growth for the 6 drags came during the drag (pin false at every
  hit); none in the 6 s after release. They show the pin cleared by a real drag and no pull, but the holds alone prove
  nothing.
- **A real wheel all the way from the end to q0.** One `page.mouse.wheel` delta of about −315k px did not scroll
  (5 of 5 per trial); multiple smaller real deltas were not tried. The wheel rows use one real notch then a write.
- **Which G1 event closes an open menu** (pointerdown is the likely one; not traced), and whether G2 from an isolated
  world behaves as from the main world.
- **The ~0.85 s between ChatGPT's `ROtail` with pin true and the first sampled frame at the end** in C1.
- One fixture (`math12`), one chunk build (`c55b0947a1`), one session per run; no Butter build was involved.

## Lab time and clean-up

- Lock `rail-pin-171b` on lab 2, taken 23:56:17 UTC (after waiting for another task), released 00:12:53 UTC
  (16.6 min). 3 runs of the 10 allowed. No perf lock (no timing benchmark). Lab 1 not used.
- `lab-restore --lab 2 --owner rail-pin-171b`: exit 0, browser with no extension, home tab, composer empty
  ([restore.log](restore.log)). `lab-lock release`: exit 0. [lock-status.log](lock-status.log) shows lab 2
  `"held": false`.
- `git status --short extension/ lab/` is empty.

## Files

- `report.md` (this file).
- `adhoc/gesture.mjs`: the probe as run (runs 2 and 3; run 1 ran the same file before the two probe fixes). It reuses
  stage 1a's `__pinNow()`, its logpoint method and `lp.json`, and `thumbAt` from `lab/harness/seek-live-page.mjs`.
- `adhoc/run.sh`: the run wrapper (writes the scrubbed log next to itself).
- `adhoc/lp.json`: stage 1a's 16 logpoints × 2 chunk builds, URL regex as `<script>`.
- `adhoc/r*.log`, `restore.log`, `lock-status.log`: scrubbed logs (numbers, labels, minified names; URLs `<url>`,
  home `~`).
