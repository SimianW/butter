# Rail jumps fail on math12 (2026-11-24): Smoother streaming, a Butter change, or ChatGPT?

## Result

**Neither Smoother streaming nor a Butter change since 2026-11-19: ChatGPT's page changed.** The failed jumps
reproduce on today's page with Smoother streaming off, with `seek` off, and with the 11-19 build `e09235b`
that ran 54 clean jumps on 11-19. In every failed jump (24 across six runs) Butter's write reaches the
target (scrollTop 20, then 385 for question 0), and ChatGPT's own code writes the chat back to its end
3–4 times per jump: `scrollTo({top: <end>, behavior: 'instant'})` from `ah < callback < aj < callback <
ResizeObserver` in ChatGPT's bundle `76629.77a8c190f1.js`. The 11-19 capture of the same script has 0
ChatGPT writes to the chat's end in all 54 jumps, and that bundle was `76629.15f5868e7b.js` then.

- Smoother streaming off (`SMOOTHER=off`: `container`, `cv`, `throttle` false; `data-butter-off` showed
  `container cv throttle layout`): 3 of 8 on the short steps, 6 of 30 on the full sequence, the same jumps
  as with defaults.
- `e09235b` dev build, defaults: 3 of 8 short, 6 of 30 full, the same jumps as head.
- head with `seek` off (the only extension code changed since 11-19 is under `seek/`): 3 of 8, the same.

## Runs

Lab 2, fixture `math12`, `lab/harness/rail-jump-live.mjs`, all under one lock (`rail-jump-fail-1124`, with
perf). Short steps (`ONLY`): from top to 0, 1, 2, 3 and from bottom to 0, 1, 2, 3 (top 3 and bottom 3 were
clean in the earlier run today; bottom 0–2 failed there). Full = the script's default 30 jumps (2 right
after reload, then top to 0–11, bottom to 0–11, 4 from the previous target).

| # | Run | Build | Settings | Steps | Failed | Failed jumps | Exit |
|---|---|---|---|---|---:|---|---:|
| 1 | r1-head | head `b2df865` dev (0.1.0-alpha.22+dev.1) | defaults | 8 short | 3 | top→0, top→1, top→2 | 1 |
| 2 | r2-head-smoother-off | head dev | `SMOOTHER=off` | 8 short | 3 | top→0, top→1, top→2 | 1 |
| 3 | r3-e09235b | `e09235b` dev (0.1.0-alpha.21+dev.1) | defaults | 8 short | 3 | top→0, top→1, top→2 | 1 |
| 4 | r4-head-seek-off | head dev | `OPTS={"seek":false}` | 8 short | 3 | top→0, top→1, top→2 | 1 |
| 5 | r5-e09235b-full | `e09235b` dev | defaults | 30 full | 6 | top→0, 1, 2; bottom→0, 1, 2 | 1 |
| 6 | r6-head-smoother-off-full | head dev | `SMOOTHER=off` | 30 full | 6 | top→0, 1, 2; bottom→0, 1, 2 | 1 |

Every failure is class `failed`, reason `target-unmounted`; Butter's rail ended `lost` or `expired`.
`anchoringOn` 0 in every run. For comparison, today's earlier head run (defaults, full;
`2026-11-24-stream-ux-loaded/l2-rail-head.log`) failed the same 6 of 30.

Bottom→0–2 were clean in all four short runs (where they follow top→3, which lands at 103k px) and failed
in both full runs (where they follow top→11, which lands at the chat's end). Why the order matters is not
established.

## Fixture line, 11-19 against today

| | 11-19 (`e09235b`, full) | today head, full (stream-ux-loaded) | today `e09235b`, full (r5) | today short runs |
|---|---|---|---|---|
| questions | 12 | 12 | 12 | 12 |
| height | 345,177 | 348,321 | 348,465 | 348,321–348,465 |
| mathDisplay (mounted) | 231 | 117 | 117 | 117 |
| nativeShape | entries-with-separate-row-virtualizer | same | same | same |
| measuredRows | 0 | 0 | 0 | 0 |
| hasPrev | false | false | false | false |
| streamingStyles turn / block | auto / auto | null / null | auto / auto | null / null (with cv on) |

The chat is ~3.1k px (0.9%) taller than on 11-19, and half as many display formulas are mounted when the
line is taken, with the same build (`e09235b`) as on 11-19. Both point at ChatGPT's page or the fixture,
not at Butter. The `turn`/`block` difference (null with head's full run, `auto` with `e09235b`'s) is
between builds today; both builds fail the same jumps, so it is not the cause.

## Who writes scrollTop back to the end

Attributed by the script's scroll probe (wrapped `scrollTop` setter and `scroll*` methods in ChatGPT's
world and Butter's isolated world, with stacks):

- In each failed jump, Butter's writes (`rail/trip.js` `depart`, `rail/jump.js`, `rail/readiness.js`
  `steady`) take the chat to the target region (question 0: 20 then 385; question 1: ~32k; question 2:
  ~65k from the top, ~79k from the bottom).
- Then ChatGPT's `ah` calls `scrollTo` to the end (scrollTop 347.4k–348.8k) from a `ResizeObserver`
  callback, about 1–3 s after each of Butter's tries: 3–4 times per failed jump, 24 of 24 failed jumps,
  in all six runs and both builds. No write back to the end came from Butter or from the browser
  (no scroll without a script write before it).
- From the top: right after the harness wrote scrollTop 0, ChatGPT's same `ResizeObserver` `scrollTo`
  pulled the chat to the end 11–111 ms into the measurement, before the click, for top→0–3 in every run.
  So those jumps started at the end, where on 11-19 they started at 0. Top→3 was clean anyway.
- 11-19: 0 ChatGPT writes to the end in 54 jumps; its only ChatGPT writes were small
  `compensateScrollToDistanceFromBottomPx` corrections of ~124 px (e.g. bottom→1, bottom→2).

This is the same caller as the pull that 2026-11-22-seek-pull-control found (`ah < callback < aj <
callback < ResizeObserver`), and that 2026-11-23-seek-pin-cause traced to ChatGPT's pin to the end
(`cc.current.bottom`), set while the transcript grows.

## Environment

- Lab 2, Chromium 157.0.8103.50 (same as 11-19), one lock with perf, 21:52:38–22:15:21 UTC.
- head: `~/snap/chromium/common/stream-ux-loaded-1124/head-dev/butter` (`package.py --dev` from
  `b2df865`; `rail/`, `stream/` and `seek/` match `b2df865` byte for byte).
- `e09235b`: `package.py --dev` in a temporary detached worktree, unzipped to
  `~/snap/chromium/common/rail-jump-fail-1124/e09-dev/butter` (`rail/`, `stream/` match `e09235b`).
- Send guard on in every connection; no `allowSends`. Each run counted 2 (short) or 4 (full) blocked
  `POST …/conversation/prepare` as `sendAttempts`, ChatGPT's own requests when a chat is opened (as on
  11-19); Enter was never pressed.
- Raw captures (per-frame JSON): `~/.local/share/chatgpt-lab/captures/2026-11-24-rail-jump-fail/`.

## Not established

- Whether ChatGPT's pin (`cc.current.bottom`) is set during these jumps. The pin flag was not read; the
  caller matches the pin pull of 11-22/11-23.
- Why only questions 0–2 fail (3–11 land and stay), and why bottom→0–2 fail only after a jump that ended
  at the chat's end. In the failed jumps the transcript's height changed (348,185 ↔ 348,321) when the
  target mounted, which the pin pull needs, but this was not measured against the clean jumps.
- A no-extension control on today's page: not run. The script's native control positions the chat by a
  different method. That native scrollTop writes to questions 0–2 are pulled the same way is not shown
  here. 2026-11-22-seek-pull-control showed it for writes to 0 and to question 7.
- `OPTS={"layout":false}`: not run, because `layout` is already off by default (`"off":"layout"` in
  every default fixture line), which makes it the same as run 1.
- One run per configuration; no repeats.

## Clean-up

`lab-restore` ok (browser restarted with no extensions, composer empty); lab and perf locks released.
Butter's stored options read `null` after runs 2 and 6, and the script put them back as found. The
`e09235b` worktree was removed. `git status --short extension/` is empty. Nothing committed.
