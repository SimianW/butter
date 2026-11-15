# Rail jump detours: the chat is sent far away before it lands — 2026-11-14

Diagnosis only: steps 1 (Control, from the user's capture) and 2 (Red) of `docs/bugfix.md`.
Product base `main` 907297d (`0.1.0-alpha.21`); the user's build was `0.1.0-alpha.21+dev.5`
(Windows Chrome, device pixel ratio 0.9, a 4-question chat). No product code was changed, and
nothing was committed, pushed or filed.

Evidence: six `butter-diag` bug files (bug 1 has no rail events; bugs 2–6 cover jumps 2–13) and
a 7 s screen recording of one failed click. Both stay private and are not copied here. No chat
text, conversation id or URL appears in this report.

Each claim is tagged **[data]** (read from the bug files or video), **[code]** (read from
`extension/` at 907297d) or **[inferred]**.

## Findings

1. **The worst detour is Butter's own and has a red test.** When a turn leaves while the
   position observer sees it with an empty rect, the turn tracker records it at "wherever the
   chat is now". `extension/rail/turns.js:68-74` stores
   `boundingClientRect.top − rootBounds.top + sc.scrollTop`. An empty rect makes that the current
   scrollTop. After each `lost` jump the chat sits at the bottom (6527), and question 0 is
   recorded there. The next click on question 0 then writes 6463 (the bottom) first. Only after 30
   frames without a mount does `retarget` drop the record, and try 2 writes 0. This happens in
   jumps 11, 12 and 13, and the video shows it as the thumb going to the bottom and then to the
   top. `node --test test/rail-jump-detours.test.mjs` exits 1 on this. **[data] [code]**, Red below.
2. **The jumps that end at the bottom are `lost`, and the chat is moved there by something the
   traces don't record.** Jumps 9, 11 and 12 mount question 0 at the top (scrollTop 0–20, plus the
   400 px lead hold). Within 0.2–0.4 s question 0 unmounts and the chat ends at 6527. In the video
   the thumb disappears for about 0.43 s and then comes back at the bottom. That suggests the
   thread briefly had no overflow and was rebuilt at the bottom. None of Butter's traced writes
   goes there. **[data]** The cause is not established; see Q4.
3. **Butter makes a lost jump worse.** Once the target unmounts during the readiness waits,
   `steady` (`extension/rail/jump.js:406-433`) just waits out its 3 s budget. It writes nothing
   and does not try to mount again. Then the jump ends `lost` and reveals wherever ChatGPT left the
   chat (`recheck` 3004–3005 ms in all three, `elapsedMs` 3712–3944). **[data] [code]**
4. **The rail itself does not jump around.** For a lost jump it changes exactly twice. At the
   click, the lit tick moves from 3 to the target 0, which blinks (busy). At the `lost` end, tick
   0 goes out and tick 3 is lit again. That matches the snapshots and the video. What moves next
   to the rail is the scrollbar thumb, a few pixels to its right. **[data] [code] [inferred]**
5. **The chat's content is hidden for the whole detour.** From about 0.1–0.3 s after the click
   until the end, the user sees only the placeholder lines, the moving scrollbar thumb and the
   rail. The detours show only as thumb movement, plus a reveal at the wrong place (the bottom,
   question 3) about 4.5 s after the click. **[data] [code]**
6. **The 1793 estimate (jump 3) is a different kind of error.** It is not the empty-rect
   artifact. The likely source is a real record taken in a collapsed layout (`scrollHeight` 3904
   instead of 7619), which went stale when ChatGPT grew the turns. In this capture it cost no
   detour: the write went in the right direction and the jump followed the target down to 5661.
   **[data] [inferred]**

## 1. Control

`docs/bugfix.md` step 1 lets the user's capture stand in when the lab cannot reproduce. Here the
capture shows Butter's own state going wrong. Jumps 2 and 9 land question 0 at scrollTop 20,
which puts its top at 84 (20 + the 64 px inset). Jumps 11–13 nevertheless start with
`estimate=6527` for question 0. **[data]**

Lab: one status check, `lab-lock status`, reported labs 1, 2 and perf unlocked. Per the brief and
earlier run reports (the configured Chromium is missing), the lab was not started, and no lock,
config or profile was touched. No live Butter/no-Butter comparison was made. The ChatGPT
behaviour in Finding 2 needs one (see "What would settle it"). No synthetic fixture-harness run
was made: a synthetic page cannot show ChatGPT's unmount and snap, and the unit seam reaches the
Butter-side cause.

## Q1. Every scroll position each jump put the chat at

Landing spots (target top − 64), from `rail-end` [data]: q0 20, q1 1819, q2 3354, q3 5661. Bottom
6527 (`scrollHeight` 7619 − `clientHeight` 1092).

How each write is known:

- `try` writes and end positions are **[data]**.
- The rest is from the code path **[code]**, because the trace does not log them:
  - `trip.depart` smooth-scrolls half a viewport toward the target, `scrollTop − m·546`
    (`extension/rail/trip.js:120`). The next write can cut it short.
  - After the mount, the jump writes `targetTop(el)` (`jump.js:290`).
  - `follow` and `steady` hold the chat `lead` = 400 px short of the target, on the side it came
    from (`jump.js:327-339`).
  - `trip.arrive` smooth-scrolls to the landing spot (`trip.js:94`).

| Jump | Target, path | Start → landing (straight distance) | Positions in order | Detour |
|---|---|---|---|---|
| 2 | q0 trip, up | 6527 → 20 (6507) | ≈5981 depart → **20** try 1 (est. 84) → 20 → 420 hold → 20 | none |
| 3 | q3 trip, down | 20 → 5661 (5641) | ≈566 depart → **1729** try 1 (est. 1793, `scrollHeight` 3904) → follows q3 down as the layout grows to 7619 → 5261 hold → 5661 | none in direction; the try fell 3932 short (stale record, Q2) |
| 4 | q2 trip (mounted), up | 5661 → 3354 (2307) | ≈5115 → 3354 → 3754 hold → 3354 | none |
| 5 | q2→q0 trip, up | 3354 → 20 (3334) | ≈2808 depart (target mounted by then, `tries=0`) → 20 → 420 → 20 | none |
| 6 | q1 trip (mounted), down | 20 → 1819 (1799) | ≈566 → 1819 → 1419 hold → 1819 | none |
| 7 | q2 glide | 1819 → 3354 | smooth scroll | none |
| 8 | q3 trip, down | 3354 → 5661 (2307) | ≈3900 (mounted by then) → 5661 → 5261 → 5661 | none |
| 9 | q0 trip, up | 5661 → 20 (5641) | ≈5115 → **20** try 1 (est. 84) → 20 → 420 hold → *chat moved to 6527, not by a traced write* → 3 s wait → revealed at 6527, `lost` | ends 6507 px from the target |
| 10 | q3 glide | 6527 → 5661 | smooth scroll | none |
| 11 | q0 trip, up | 5661 → 20 (5641) | ≈5115 → **6463** try 1 (est. 6527; read back 6462, 30 frames) → **0** try 2 → 20 → 420 → *6527* → `lost` at 6527 | try 1: 802 px below the start, opposite to the target; end at the bottom |
| 12 | q0 trip, up | 6527 → 20 (6507) | ≈5981 → **6463** → **0** → 20 → 420 → *6527* → `lost` | try 1 goes back down ≈480 px; end at the bottom |
| 13 | q0 trip, up | 6527 → 20 | as 12 up to the `quiet` wait; still in flight when bug 6 was saved (flying, pinned, busy 0) | as 12, outcome not captured |

The causes, by kind:

- **Wrong position record** (empty-rect `ioPos`): try 1 of jumps 11–13. This is the only
  wrong-way write Butter makes in these captures. **[data] [code]**
- **Wrong estimate from a changing `scrollHeight` or a stale record**: jump 3's 1729. It went in
  the right direction but was far short, and the jump then rode the growing layout down.
  **[data] [inferred]**
- **Depart scroll**: half a viewport toward the target. When try 1 then goes the other way
  (jumps 11–13), the chat reverses. It is a reversal only because of the wrong record. **[code]**
- **Lead hold**: 400 px short of the target, on the start side. It never overshoots, so it is not
  a detour. Content is hidden while it holds. **[code]**
- **Snap to the bottom**: jumps 9, 11 and 12, after the target mounted. It is not written by any
  traced Butter step. Note that `steady` and `follow` would write 6527 only if question 0's box
  read ≥ 6191 px down, and their writes are not traced. **[data] [code]**

## Q2. Where wrong position records come from

**The `ioPos` hypothesis is confirmed in form.** `turns.js:73` records
`e.boundingClientRect.top − e.rootBounds.top + sc.scrollTop`, with scrollTop read at callback
time. The result equals the current scrollTop exactly when the entry's rect top equals
`rootBounds.top`. That is what an empty rect gives for a scroller whose box starts at the
viewport top: a removed, hidden or not-yet-laid-out target. Rail model `HEADER`: ChatGPT's header
overlaps the scroller. **[code]**

Under the IntersectionObserver spec, a target that is no longer in the root's containing block
chain keeps a zero target rect. **[inferred]**: not checked in Chrome here.

The numbers fit it:

- Each lost jump leaves the chat at exactly 6527.
- The next jump's try 1 has `estimate=6527`, and try 2, after `retarget` deleted that record
  (`turns.js:258-263`), has `estimate=0`. That is `y(hi)·0/hi` with q2 measured: interpolation
  from the top.
- The record is planted again on every lost jump. Try 2 mounts question 0, and its real record
  (84) is overwritten when it leaves while the chat is at the bottom.

**[data] [code]** `test/rail-jump-detours.test.mjs` reproduces this chain with the real
`turns.js` and `jump.js`. The writes are `6463, 0, 20, 420, 20`, the capture's try writes
followed by the landing and the lead hold.

What is not established: the exact Chrome entry (removal while intersecting, `display: none`, or
an entry delivered after the scroll changed) and that `rootBounds.top` is 0 rather than null. A
null value would throw and record nothing; the exact 6527 implies a top of 0.

**1793 is not this artifact.** An empty-rect record taken between jump 2 and jump 3 would read
the chat's position then. The chat sat at 20 to 420 (jump 2's landing and lead hold; jump 3
starts at 20), and no Butter write goes near 1793. **[data] [code]**

The likely source **[inferred]** is a real observation of q3 in a collapsed layout:

- At jump 3 the scroller was 3904 px tall.
- The write to 1729 mounted turns 0–3 together, with the last ending at 3746. Four turns fit in
  about 3700 px, against 7340 px at full height.
- Jump 2's try had read turn 1's element ending at 2013 inside a 3406 px wrapper, and both
  answers were rejected `no-blocks`: they were only partly rendered.

`ioPos` reports a turn only when its intersection changes (threshold 0, no margin). A record taken
there can stay after the layout grows, because a turn that unmounts while off-screen produces no
new entry. **[code] [inferred]**

Other sources:

- `estimate` interpolates toward the current `scrollHeight` (`turns.js:247-250`), which changes
  with which turns are mounted (3904 vs 7619). **[code] [data]**
- The callback adds callback-time scrollTop to an observation-time rect. A scroll between the two
  shifts the record by that much. **[code]**; not seen in these captures.
- `measure` sets the turn after the mounted ones to the last wrapper's bottom
  (`turns.js:198-200`). That is correct while wrappers reserve real heights. **[code]**

## Q3. What the user can see

**Chat content.** `trip.depart` fades the virtualizer's content box to opacity 0 over 260 ms and
fades the placeholder in; both hold until `arrive` or `end` (`trip.js:103-123`). **[code]**

In the video [data]:

- Click at about 1.17 s.
- The content is gone from about 1.3 s.
- Only placeholder lines show until about 5.6 s, with no chat text between the lines. That
  includes the time the thumb was gone.
- The content fades in at about 5.7 s, at the bottom (question 3), about 4.5 s after the click.

**Stays visible:** the sidebar, header, composer, the placeholder streaks, the scrollbar and the
rail. **[data]**

**Scrollbar thumb** (video, 30 fps) [data]:

| Time | Thumb |
|---|---|
| ≤ 1.13 s | bottom |
| 1.17–1.37 s | moves up a little (the depart scroll) |
| 1.40–1.57 s | bottom (try 1, 6463) |
| 1.60–1.83 s | top (try 2, 0; the lead hold at 420 is a few px lower) |
| 1.87–2.30 s | gone |
| from 2.33 s | bottom, briefly longer at 2.33–2.37 s (a shorter `scrollHeight`) [inferred] |

This video is not linked to a bug file. Its sequence and timings match jumps 11–13 (in jump 11, try 1's write comes 0.26 s after the jump starts and try 2's 0.20 s after that;
in the video, the thumb reaches the bottom 0.23 s after the click and the top 0.20 s later). **[inferred]**

**Rail.** The rail model lights only the active tick while a jump is `flying`. The lit band's
kicks are skipped while flying (`model.js:102-109`, `turns.js:86`). The trip path blinks the
target tick (`busy`, `jump.js:203`). **[code]**

A lost jump ends without landing: `unpin`, `flying` false, busy cleared (`jump.js:369-378`). The
rail then lights the band only, which is tick 3 at the bottom. `active` stays 0. **[code]**

The snapshots agree [data]:

- Bugs 4–6, saved mid-jump: `lit [0], busy 0, pinned, flying`.
- Bugs 2–3, saved after a lost jump: `active 0, lit [3], busy null, pinned false`.

In the video, tick 0 is lit and blinking from the click until about 5.6 s, and tick 3 is lit from
about 5.7 s. [data] The only other rail motion is the hover swell under the pointer at the click.
So the lit tick changes once at the click and once at the end. Read (b), an erratic rail, is not
supported. The "rail on the right jumps around" is most likely the scrollbar thumb beside it.
**[inferred]**

## Q4. Butter's own state vs ChatGPT behaviour

Butter's own, fixable in Butter:

- The empty-rect position record (`turns.js:68-74`). It causes every wrong-way try in the
  captures. Red below. **[data] [code]**
- After the target mounts and then unmounts, the jump waits out `steady` (3 s per wait, and the
  `recheck` repeats it) without writing or trying to mount again. It then reveals wherever the
  chat is and ends `lost` (`jump.js:333-341`, `406-433`). This turns a ChatGPT hiccup into a
  4-second wait and a reveal at the wrong question. **[data] [code]**
- Records outliving layout changes, and interpolation over a `scrollHeight` that depends on what
  is mounted (`turns.js:239-251`). No visible harm in these captures. **[code] [inferred]**
- After a lost jump the rail keeps `active` on the target while lighting another tick. That is
  consistent with the model, but nothing tells the user the jump failed. **[code] [data]**

Depending on ChatGPT, not shown by the captures:

- Why question 0 unmounts 0.2–0.4 s after mounting at the top, and why the chat then ends at
  6527.
- Why the thread briefly has no overflow (thumb gone).
- Why the layout was 3904 px tall before jump 3.
- Whether Smoother streaming provokes any of this: the `container` rule, `cv`'s
  `content-visibility`/`contain-intrinsic-size` on seen turns, or `throttle`'s smoother rAF. The
  user's report that turning it off stops the failures points that way, but there is no capture
  of that state. **[inferred]**
- Whether Chrome's entry for a removed turn has `rootBounds.top` 0.

## 2. Red

```sh
node --test test/rail-jump-detours.test.mjs
```

The seam is the first agreed one (unit, `node --test`). The test runs the real
`extension/rail/turns.js` and `extension/rail/jump.js` in one context over
`test/helpers/rail-dom.mjs`. It adds a fake virtualizer in the capture's geometry (turns at 84,
1883, 3418 and 5725 px, `scrollHeight` 7619, `clientHeight` 1092, a turn mounted within 1500 px
of the viewport) and a trip that times but does not scroll.

As Chrome does for a removed target, the fake position observer reports an unmounted turn with an
empty rect and `rootBounds.top` 0. It reports every mount and unmount, which is more often than
Chrome, which reports only intersection changes. In the scene, though, question 0 is on screen
when it goes, as in the capture.

The scene mirrors jumps 9–11:

1. Question 0 is recorded at 84 (the control assertion).
2. The page moves to the bottom, and question 0 unmounts there.
3. The chat glides to question 3 (5661), then question 0 is clicked.

Actual output, exit 1:

```text
✖ a turn unmounted while the chat is at the bottom keeps its position record (6.405228ms)
✖ a click on question 0 from question 3 never scrolls the chat below where it started (20.104478ms)
ℹ tests 2
ℹ pass 0
ℹ fail 2
...
  AssertionError [ERR_ASSERTION]: bug: q0 unmounted at scrollTop 6527 is now recorded at 6527: the position observer turned its empty rect into "wherever the chat is now" (rail/turns.js ioPos)
  6527 !== 84
...
  AssertionError [ERR_ASSERTION]: bug: the jump up to question 0 from scrollTop 5661 first wrote 6463 (the bottom is 6527); all writes: 6463, 0, 20, 420, 20
  + [
  +   6463
  + ]
  - []
```

No agreed seam reaches Finding 2's snap to the bottom: that needs ChatGPT's virtualizer. A Red
for the 3 s `lost` wait would assert a fix's design: retry the mount, or end early. That is left
to step 3.

### 2b. Red for the lost target (Finding 3)

Added with step 3, once the design was chosen: a target lost after it mounted is looked for
again.

```sh
node --test test/rail-jump-lost.test.mjs
```

Same seam and fake virtualizer as above; the scene's setup moved to
`test/helpers/rail-virtualizer.mjs`, shared by both tests. The chat sits at question 3 (5661) and
question 0 is clicked. Each time question 0 mounts, ChatGPT renders for 600 ms (a frame every
50 ms). In the first scene, 250 ms after question 0's first mount, ChatGPT unmounts it and moves
the chat to the bottom, once. In the second scene it does that after every mount. The tests ask
that the first jump lands on question 0 within 2.5 s of the click, and that the second ends within
3 s, in at most 20 scroll writes, with the chat shown and unpinned.

Output against the unfixed code: `lost-red-output.txt`, exit 1, both fail. The jump ended
4408 ms after the click at scrollTop 6527, with question 0 unmounted and the chat unpinned. Its
writes were `5597, 0, 20, 420`: 5597 is Finding 1's wrong record, and nothing after the lead
hold at 420. That matches the capture's 3.7–3.9 s `lost` jumps and the reveal about 4.5 s after
the click.

## What is not established, and what would settle it

| Open question | Capture that settles it |
|---|---|
| What moves the chat to 6527 and unmounts question 0 after it mounted at the top, and whether a Butter write (`steady`/`follow`, untraced) is involved | During one failed click on tick 1 from the bottom, a DevTools snippet logging every `scroll` event (scrollTop, scrollHeight) and every `[data-turn-key]` add/remove (MutationObserver), with timestamps. A dev trace of `steady`/`follow` writes would also settle it, but that needs a dev-build change. |
| Whether ChatGPT does this without Butter | Extension off, at the bottom of the same chat: drag the thumb to the top in one move and watch whether the chat snaps back to the bottom (the bugfix.md Control). |
| Which Smoother streaming part matters | Bug files after the same click with Smoother streaming fully off, then with only `container`, only `cv` and only `throttle` off. |
| The exact IntersectionObserver entry behind the 6527 record | A snippet logging the turns' entries on the chat's scroller (`boundingClientRect.top`, `rootBounds?.top`, `isIntersecting`, `target.isConnected`, scrollTop at callback) during a failed click. |
| Where 1793 came from | The same entry log across a jump to the top and the next jump down. |
| Jump 13's outcome | The next bug file after it (bug 6 was saved mid-jump). |

## Commands run

All attachment reads used `python3 -I`, with scripts in `/tmp/detours/` and frames extracted to
`/tmp/detours/frames/`. Nothing was written to the attachments folder or the repo apart from the
two files below.

| Command | Actual result |
|---|---|
| `python3 -I /tmp/bug1-scripts/jumps.py <bugs 2–6>` | rail timeline, jumps 2–13 (quoted in Q1) |
| `python3 -I /tmp/detours/all.py <bugs 2–6>` | all events; no `conversation` event; only `record`/`rejection` besides rail events |
| `python3 -I /tmp/detours/snap.py <bugs 1–6>` | settings: all options on; `rail.state` per file as quoted in Q3; readiness rows: turns 0–1 unmounted, 2–3 mounted, all `unmeasured-row` |
| `ffmpeg … crop/tile` on the recording | frame sheets of the scrollbar column, the rail, and the chat over 1.0–3.0 s and 4.4–6.8 s (Q3) |
| `~/.local/share/chatgpt-lab/bin/lab-lock status` | `{"lab": 1, "held": false…}`, `{"lab": 2, "held": false…}`, `{"lab": "perf", "held": false…}`; exit 0 |
| `node --test test/rail-jump-detours.test.mjs` | exit 1, 2 tests, 2 fail (above) |
| `node --test test/rail-jump.test.mjs test/rail-turns.test.mjs test/rail-trip.test.mjs test/rail-jump-returns.test.mjs` | 27 tests, 27 pass |
| `npm run lint` | exit 0 |
| `npm run format:check` | "All matched files use Prettier code style!", exit 0 |

Files added: `test/rail-jump-detours.test.mjs` and this report. The run index in
`notes/runs/README.md` was not updated, because the brief limited the files this run could touch.
