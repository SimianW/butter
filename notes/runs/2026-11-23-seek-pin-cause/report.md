# Seek release pull to the chat's end: what ChatGPT's pin is, and why Butter's release keeps it — 2026-11-23

Stage 3 of issue #152, after [seek-narrow-live](../2026-11-22-seek-narrow-live/report.md) and
[seek-pull-control](../2026-11-22-seek-pull-control/report.md). Lab 2, fixture `math12`. The send
guard was on in every connection and no message was sent. The inputs were scrollbar presses and
drags, wheel notches and scrollTop writes from the harness. The only other thing done was
dispatching `new Event('scroll')` on the scroller. ChatGPT's code was read from the script that
ChatGPT's own pull frames name. Raw captures (frames with script URL:line:col, the saved scripts,
unscrubbed logs) stay in `~/.local/share/chatgpt-lab/captures/2026-11-23-seek-pin-cause/`. This
report describes ChatGPT's code with its minified names and copies none of it.

## Result

**ChatGPT's pin is the flag `cc.current.bottom` in its thread-scroll component. Its pull is a
ResizeObserver that, while the flag is set and the transcript has grown, clamps the kept
distance-from-the-end to 0 and scrolls there. A scrollbar drag clears the flag only through
ChatGPT's own `scroll` listener on the scroller. The listener has to see a scroll event between
`pointerdown` and `pointerup`: `pointerdown` stores a snapshot, and the first scroll that follows it
records an "away" gesture and unpins in the same call. `pointerup` drops the snapshot.** Butter
stops every scroll event of the scroller at window capture during the drag. ChatGPT's listener
therefore sees nothing until about 100–136 ms after `pointerup`, when the snapshot is gone. The
scroll then counts as a non-user scroll, and the pin stays set. This held in **5 of 5** Butter
releases (runs 5 and 6). In run 6, at question 7's position, **3 of 3 hold checks were pulled to
the end with the pin still set**. One Butter release was itself pulled 2.4 s after `pointerup`,
the symptom in issue #152. Natively, a thumb drag and one wheel notch up each cleared the pin. A
synthetic scroll event did not clear it. Neither did a native drag whose scroll events were
swallowed the way Butter swallows them (run 4). **The part of Butter responsible is the swallowed
scroll events during the drag.** The synthetic event, the commit timing after `pointerup` and the
absent write for layout destinations do not matter: after `pointerup`, ChatGPT treats every
scroll event the same way.

## (a) ChatGPT's pin logic, as pseudo-code

The thread-scroll component lives in the chunk that the pull's frames name (`ah < callback < aj <
callback < ResizeObserver`, as in stage 2). Names are the minified ones. Distances are measured
from the end of the chat (`dist = scrollHeight − clientHeight − scrollTop`).

State (refs):

- `pin` = `cc.current.bottom`. While it is set, ChatGPT follows content growth to the end.
- `b3` = the stored distance; `b5` = scrollTop when `b3` was stored. Both are written by `cu(dist)`.
- `cb` = the current user scroll gesture `{direction: "away" | "toward", lastAtMs}`, or null.
- `d` = the scrollbar-press snapshot `{scrollHeightPx, scrollTopPx}`, local to the listener setup.

Listeners on the scroller element (`{passive: true}`, **bubble/target phase**, registered by `ay`):

```text
on pointerdown(e):                       // the scroller itself, mouse only
  d = null; cb = null
  if e.pointerType == "mouse" and e.target == scroller:
    d = {scrollHeightPx: scrollHeight, scrollTopPx: scrollTop}
on pointerup / pointercancel:  d = null
on touchmove: after 8 px of vertical-dominant movement, gesture(e, dy > 0 ? "away" : "toward")

on scroll:                               // no isTrusted check, no delta threshold
  prev = b3
  if d != null:                          // first scroll after a scrollbar press
    snap = d; d = null
    if scrollHeight == snap.scrollHeightPx and scrollTop != snap.scrollTopPx and dist != prev:
      cb = {direction: dist > prev ? "away" : "toward", lastAtMs: now}
  if cb == null:                         // not a user scroll
    if not (|dist| < 3) and restoredAtEnd-and-unchanged(): return
    cu(dist); return                     // store the distance only; pin untouched
  if now - cb.lastAtMs > 1000: cb = null; cu(dist); return
  cu(dist)
  if direction(dist vs prev) == cb.direction:
    cb.lastAtMs = now
    cE(dist, prev)                       // the unpin/re-pin point
    if atEnd(dist): cb = null

cE(new, old):  pin = (new < old) and (new <= 24)     // only a gesture toward the end, ending within 24 px, keeps the pin
```

Wheel and keys (React handlers on the scroller, `cO = gesture(event, direction, explicit)`):

```text
wheel:   if vertical-dominant, not ctrl/shift, and not consumed by an inner scrollable:
           gesture(e, deltaY < 0 ? "away" : "toward", explicit = true)
keydown: ArrowUp/Home/PageUp/Shift+Space -> "away"; ArrowDown/End/PageDown/Space -> "toward"
         (ignored in inputs and contenteditable); explicit = PageUp/ArrowUp with no modifier

gesture(e, dir, explicit):
  if dir == "toward" and the chat is within the end threshold and not pin:
    scrollToBottom()                     // sets pin = true (followContentGrowth)
    return
  moved = (distance in dir) > 0
  if dir == "away" and moved and explicit and pin: cy()   // pin = false
  cb = moved ? {direction: dir, lastAtMs: now} : null
```

Other writers of `pin`: `cy()` sets it false. `scrollToBottom` sets it to `followContentGrowth !==
false`. Scrolling to a distance of 0 through `ai` sets it true. A route or restoration change resets
it to the initial prop.

The pull (`ResizeObserver` on the transcript and the scroller, the branch this chat takes):

```text
on resize:
  m = transcriptHeight - lastTranscriptHeight   // growth since the last callback
  if m <= 0 and viewport height unchanged: return
  p = dist + spacer - prevSpacer                // keep the distance from the end
  if pin: p = min(p, spacer)                    // spacer was 0 in every hit: p = 0
  aj(p) -> ah: scrollTo({top: scrollHeight - clientHeight - p, behavior: "instant"}); cu(dist)
```

So **a pull needs `pin` set and the transcript to grow after the write**, for example a turn
mounting and replacing its height estimate. While `pin` is clear, the same observer keeps the
distance from the end instead (the `ah` hits that do not go to 0). Evidence: run 6 hold after
Butter release 1:
`ROtail 76081 {"n":118869,"o":0,"k":0,"p":118869,"m":144,"i":false,"pin":true}` then `cu 76082
{"to":0,...,"st":347338}` (the logpoint sits just before the clamp, so `p` is printed before it).
The first branch of the observer (gated on a component prop) never ran: its logpoint `RO` had no
hit in any run.

## (b) Native inputs: what clears the pin

Pin state is read from logpoints on ChatGPT's code (`pin` = `cc.current.bottom` at each call). A
hold check is a scrollTop write to `TARGET × range`, sampled for 6 s. It can show a pull only if
the transcript grows after the write: in run 4 no observer callback ran after any write, so every
hold there held whatever the pin. The pin column is the result, and the hold column is
supporting evidence.

| Run | Input (after the pin is set) | Pin after the input | Hold check |
|---:|---|---|---|
| 3 | none (`ctl`) | true | **pulled** at 2624 ms |
| 3 | scrollTop write + synthetic `new Event('scroll')` (`synth`) | true | **pulled** at 2710 ms |
| 3 | one wheel notch up, `deltaY −120` (`wheelup`) | **false** (`cO` wheel away, then `cy`) | held |
| 4 | none (`ctl`) | true | held (no resize after the write) |
| 4 | native thumb drag up 160 px (`drag`) | **false** (`cE` on the first scroll) | held |
| 4 | the same drag, with every scroller scroll event stopped at window capture from before `pointerdown` until after `pointerup` (`dragswallow`, 106 swallowed) | true | held (no resize) |
| 4 | the same + 40 ms after `pointerup` a scrollTop write −3000 and a synthetic scroll event (`dragswallowcommit`, Butter's commit) | true | held (no resize) |
| 4 | press without moving on the computed thumb position (`press`; it scrolled 798 px, so it acted as a track press) | **false** | held |
| 4 | synthetic scroll event with the write (`synth`) | true | held (no resize) |

Run 3's `press`, `drag`, `dragswallow` and `dragswallowcommit` rows are left out: re-pinning by
writing scrollTop to the end does not set the pin, so after `wheelup` they started unpinned (`pdown
... "pin":false`). Run 4 re-pinned with a write 300 px above the end and three wheel notches down.
Every step started with `pdown ... "pin":true` or a hold-time `"pin":true`.

Evidence lines (from [run3-native.log](run3-native.log) and [run4-native.log](run4-native.log)):

- Wheel: `cO 56530 {"type":"wheel","dir":"away","c":true,"pin":true,...}` then `cy 56531`, then
  `scroll 56532 {...,"pin":false,...,"cb":"away"}`.
- Native drag: `pdown 52191 {...,"pin":true}`, then `scroll 52229 {"d":314068,"dist":185,...,"pin":true}`
  (the snapshot is used), then `cE 52230 {"a":185,"b":0,"pin":true}` in the same call (the logpoint
  prints the pin before `cE` writes it), then `scroll 52255 {...,"pin":false,...,"cb":"away"}`.
- Swallowed drag: `pdown 65217 {...,"pin":true}`, then `pup 67131 {"d":true}` (the snapshot is
  dropped unused), then `scroll 67154 {"d":null,"dist":26890,...,"pin":true,...,"cb":null}`, then
  `cu` only. There was no `cE` or `cy`, and the hold showed `"pin":true`.
- Synthetic event (run 3): `scroll 48142 {"d":null,...,"pin":true,"cb":null}`, then `cu`, then
  `ah`s, then `cu {"to":0}`: pulled.

## (c) Butter's release

Dev build of this worktree (`0.1.0-alpha.22+dev.1`, `python3 scripts/package.py --dev`, unpacked
to `~/snap/chromium/common/seekpin-1123-dev/butter`). Each release dragged the thumb 160 px up from
the end (estimated destination, question 9, `layout: false`), waited 8 s, then ran a hold check.

| Run | Step | Pin before → after release | First scroll ChatGPT saw | Hold check |
|---:|---|---|---|---|
| 5 | Butter release 1 (`TARGET=0.4`) | true → **true** | 135 ms after `pup`, `d` null | held (no resize) |
| 5 | Butter release 2 | true → **true** | 136 ms after `pup` | held (no resize) |
| 5 | Butter release 3 | true → **true** | 135 ms after `pup` | held (no resize) |
| 5 | no release (`ctl`) | true | n/a | held (no resize) |
| 6 | Butter release 1 (`TARGET=0.66`, question 7's position) | true → **true** | 101 ms after `pup` | **pulled** at 3383 ms; the release itself was also pulled 2.4 s after `pup` |
| 6 | no release (`ctl`) | true | n/a | **pulled** at 3430 ms |
| 6 | Butter release 2 | true → **true** | 136 ms after `pup` | **pulled** at 3309 ms |

**The pin survives Butter's release: 5 of 5.** Between `pointerdown` and `pointerup` ChatGPT's
scroll listener ran **0 times** in every Butter release. From [run5-butter.log](run5-butter.log):
`pdown 60989 {"pt":"mouse","onSc":true,"pin":true,...}`, then `pup 62913 {"d":true}`, then `scroll
63048 {"d":null,"dist":30514,...,"pin":true,...,"cb":null}`, then `cu` only. The release-1 pull
in [run6-butter.log](run6-butter.log): `ROtail 68017 {"n":27491,"o":0,"k":0,"p":27491,"m":1029,
"i":false,"pin":true}` then `cu 68017 {"to":0,...,"st":347194}`, 2461 ms after `pup 65556`.

Which part of Butter's drag and release is responsible:

- **The swallowed scroll events during the drag: responsible.** ChatGPT only records a
  scrollbar gesture from a scroll event that arrives while the `pointerdown` snapshot `d` exists.
  Butter's window-capture `stopImmediatePropagation` (`seek/preview-main.js`, the `scroll` capture
  listener, including the activating event) blocks all of them. Its `pointerup` handler and
  ChatGPT's (target phase, `d = null`) run before any of Butter's commit scroll events. Reproduced
  natively by `dragswallow` (pin kept), against `drag` (pin cleared).
- **The synthetic (untrusted) scroll event: not responsible.** ChatGPT's listener never reads
  `isTrusted`. A synthetic event with `d` null and no gesture just stores the distance (`synth`,
  `dragswallowcommit`: pin kept, the same as without it).
- **The timing after `pointerup`: not responsible as such.** Any scroll after `pointerup` comes
  after `d = null`, so a faster commit would change nothing.
- **The absent write for layout destinations: not responsible.** With or without a write, every
  scroll after `pointerup` is treated as a non-user scroll. Layout destinations were not run in
  this stage, and by the code they behave the same.

Why stage 1 saw only 6 of 18 later `put`s pulled: a pull needs the transcript to grow after the
write, not just the pin. In runs 4 and 5 the pin was set, but no observer callback followed the
writes, so they held. At question 7's position (run 6) the turn mounts and grows (`m` 144–1029),
and every hold was pulled.

A fix direction that follows from the code, **not tested here**: let ChatGPT's scroll listener see
one scroll event while its `pointerdown` snapshot exists. For example, let the activating scroll
event through, or dispatch a scroll event on the scroller from Butter's `pointerup` capture
listener, which runs before ChatGPT's target-phase `pointerup`, with scrollTop already moved and
scrollHeight unchanged. That same call then records the gesture, reaches `cE` and unpins. Another way is to clear the pin through the wheel path. A live check would be this
report's `pin` logpoint and run 6's hold check.

## Runs

Every command ran from `~/.local/share/chatgpt-lab/captures/2026-11-23-seek-pin-cause/` with
`LAB_ID=2 LAB_OWNER=seekpin-1123`, after `npm ci` in the worktree (Playwright found through the
lab lib). The lock was taken with `lab-lock acquire --lab 2 --owner seekpin-1123 --wait 1800
--needs-fixture math12`. `B` = `~/snap/chromium/common/seekpin-1123-dev/butter`.

| # | Command | Exit | Result | Log |
|---:|---|---:|---|---|
| 1 | `EXT= MODE=src node adhoc/pin.mjs` (first version, which also wrapped `ResizeObserver` and `IntersectionObserver`) | 2 | ChatGPT showed its error page instead of the chat; the turns never appeared. Not established whether the wrapping caused it; the wrapping was removed | [run1-src.log](run1-src.log) |
| 2 | `EXT= MODE=src node adhoc/pin.mjs` | 0 | the pull's frames with locations, 832 listener registrations and 22 scripts saved locally; the scrollTop 0 write pulled at 1836 ms | [run2-src.log](run2-src.log) |
| 3 | `EXT= MODE=steps LP=adhoc/lp.json STEPS=ctl,synth,wheelup,press,drag,dragswallow,dragswallowcommit node adhoc/pin.mjs` | 0 | table (b), rows run 3; re-pin by write turned out not to re-pin | [run3-native.log](run3-native.log) |
| 4 | the same with `REPIN=wheel STEPS=ctl,drag,dragswallow,dragswallowcommit,press,synth`, plus the `ROtail` logpoint | 0 | table (b), rows run 4 | [run4-native.log](run4-native.log) |
| 5 | `EXT=B MODE=steps LP=adhoc/lp.json REPIN=wheel TARGET=0.4 STEPS=butter,butter,butter,ctl node adhoc/pin.mjs` | 0 | table (c), run 5 | [run5-butter.log](run5-butter.log) |
| 6 | `EXT=B MODE=steps LP=adhoc/lp.json TARGET=0.66 STEPS=butter,ctl,butter node adhoc/pin.mjs` | 0 | table (c), run 6 | [run6-butter.log](run6-butter.log) |

**[`adhoc/pin.mjs`](adhoc/pin.mjs)** (home path made generic) extends stage 2's `hold.mjs`. It
uses the same browser restart, history loop and 6 s hold sampling. The write probe now keeps full
caller frames (raw, local only), and an `addEventListener` wrapper records scroll, wheel, touch,
pointer and key listener registrations. `MODE=src` saves the pull's frames, the registrations and
the source of every script they name to the local capture dir. `MODE=steps` runs, per step, a
re-pin (`REPIN=wheel`: write 300 px above the end, three 200 px wheel notches down), the input,
then a hold check. The `butter` step is a thumb drag 160 px up from the end in 4 steps, a 600 ms
hold, release, then 8 s, reading Butter's `__seekDump` session. **[`adhoc/lp.json`](adhoc/lp.json)**
holds the CDP logpoints (`Debugger.setBreakpointByUrl` with a condition that logs and returns
false). Each has a label, line and column in the scroll chunk, and an expression over ChatGPT's
minified refs. The chunk's URL regex is replaced by a placeholder here. Labels: `scroll` (the
scroller's scroll listener), `pdown` and `pup` (its `pointerdown` and `pointerup` handlers), `cu`
(store distance), `cE` (gesture result, sets the pin), `cy` (unpin), `cO` (wheel, key and touch
gesture), `cH`, `cF`, `ah` (scroll to a distance), `RO` and `ROtail` (the observer's two branches).

## Not established

- **Run 1's error page.** The first probe version also subclassed `ResizeObserver` and
  `IntersectionObserver`. The page showed ChatGPT's error text, and the next run without that
  wrapping loaded normally. It could also have been ChatGPT refusing a fast reload.
- **Which re-pin path ran in run 4.** Hits during the re-pin were not printed. The pin was set
  afterwards (`"pin":true` at every step's `pdown` or hold). By the code it is `scrollToBottom`
  from the wheel "toward" gesture near the end.
- **Layout destinations and the wheel/keyboard paths with Butter** were not run. By the code, a
  wheel notch up during or after a Butter session clears the pin as natively (Butter's wheel
  listener is passive and does not stop propagation).
- **The fix** was not tried. This stage changed nothing under `extension/`.

## Lab time and clean-up

- Lock `seekpin-1123` on lab 2 from 00:43:50 to 00:58:00 UTC (2026-11-24; 2026-11-23 local), about
  14 min, 6 harness runs (1 failed at setup). Lab 1 was not used.
- The dev build was loaded at a new unpacked path with empty storage; "Remember long-chat
  layouts" was not turned on and no storage was written by the harness.
- `lab-restore --lab 2 --owner seekpin-1123`: exit 0, browser restarted back to no extension, home
  tab, empty composer ([restore.log](restore.log)). `lab-lock release`: exit 0.
  [lock-status.log](lock-status.log):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

## Files

- `report.md` (this).
- `run*.log`, `restore.log`, `lock-status.log`: scrubbed copies of the raw logs. URLs are
  `<url>`/`<script>`, the home path is `~`, and the listener-registration dump is replaced by its
  count. They hold pixel numbers, ms, minified names and logpoint values. They hold no chat text,
  chat URLs, ids, account names or script URLs.
- `adhoc/pin.mjs`, `adhoc/lp.json`: the probe and the logpoints, as run in runs 4–6 (lp.json had
  no `ROtail` in run 3).
