# Veil: the streamed blocks the marker never marks (the 19 / 20 blocks) — 2026-11-24 (#172)

Ticket #172 of spec #170. A live lab run on `main` (`547fa0a`, the integration branch
`feat/implement-spec-170` at the same commit) without the veil, plus one run of the first veil
prototype (`pv0`) to tie the 19 veiled blocks to what head shows. Lab 2, fixture `ats12`, one outer
lock with the perf lock (owner `veil-unmarked-172`), taken 00:12:53 UTC on 2026-11-25 and released
00:21:13 after `lab-restore`: 8.3 min of the 30 min budget, 3 harness runs of 10 (one stopped on a
setup error), plus one read-only CSS read on the open page. The send guard was on in every
connection; both replays printed `PASS no-escape` and `PASS server-unchanged`. Raw captures stay in
`~/.local/share/chatgpt-lab/captures/2026-11-24-veil-unmarked/`.

## Answer

**The unmarked blocks are the answer's `<hr>` separators.** ChatGPT gives `<hr>` `height: 0`.
A skipped element keeps a declared height, so a skipped `<hr>` still has a 0 px content box. The
marker's ResizeObserver therefore never reports it above 0. The marker queues a block only on such a
report (`stream/offscreen.js`, the `ro` callback), so it never queues these blocks, never holds them
and never marks them seen. They sit under the `content-visibility: auto` rules only through the
`in_progress` rule. They leave those rules when the turn leaves `in_progress`, with no state-change
event. pv0 veiled them on their skip event and had nothing to unveil them at completion. That is the
leak.

- **What:** 20 of the 612 blocks of the streamed answer are unmarked after completion. All 20 are
  `<hr>`, in the older (classic) renderer: direct children of the markdown root, no Dil root in this
  answer. They are 20 of 20 `<hr>` in the answer, and none of the other 592 blocks is unmarked.
- **Where:** blocks 10, 38, 71, 82, 122, 145, 170, 202, 233, 258, 300, 326, 363, 409, 439, 473, 497,
  536, 563 and 592 of 612. Each sits right before an `<h1>` section heading. The block before it is a `<p>` (15 of 20), a `<span>` (4) or an `<ol>` (1).
- **The 19 and the 20th:** 19 of the 20 got one skip event while streaming and never rendered
  afterwards. In the pv0 run, exactly those 19 (blocks 38 to 592) carried `data-butter-veil` and were
  not `content-visibility: auto` after the window. Block 10, the first `<hr>`, was inserted on screen
  6.2 s after Enter and rendered there. It got a "not skipped" event and never a "skipped" one, so pv0
  never veiled it. 19 + 1 = 20, the same count head has.
- **No marker bug without the veil.** On head the `<hr>` is skipped mid-stream at the same 0 px content
  box it renders at (no height change, no jump), and renders at completion: one empty element, and
  the rule draws on screen as before. Unmarked, it is never skipped in an opened chat, which costs nothing
  either. The one leftover is that the marker keeps observing it for the page's life. A headless
  check found that this does not keep a removed answer's DOM alive (see "Checked, not a bug").
  **No issue filed.**

## Acceptance criteria

| Criterion | Where |
|---|---|
| Kind of block (element, position, renderer) with counts adding up | Answer; Q1 |
| Why the marker never queues them, from what the run observed | Q2 |
| Whether they leave the `auto` rules at other moments than completion | Q3 |
| A minimal synthetic recipe | Q4 |
| Marker bug without the veil: filed, or none | Answer ("No marker bug without the veil"); Checked, not a bug |
| Lab README: one lock, send guard on, verdict lines kept | Runs; logs |

## Runs

| # | Build | Run | Lock time | Verdicts | Log |
|---|---|---|---|---|---|
| 1 | head (`extension/` at `547fa0a`) | `PHASES=stream UNMARKED=1 TAIL_MS=5000` | 0–55 s | setup error: the rail is off for a new install since #158, and the script waits for `chatgpt-butter-nav[data-on]` | [log](head-ats12-setup-error.log) |
| 2 | head | as 1 plus `OPTS={"rail":true}` | 55–265 s | 11 PASS, 0 FAIL; `OPTS put back … same as before true` | [log](head-ats12.log) |
| 3 | pv0 (`extension/` + [pv0.patch](../2026-11-24-stream-veil/pv0.patch)) | as 2 | 265–473 s | 11 PASS, 0 FAIL; `OPTS put back … same as before true` | [log](pv0-ats12.log) |

[data.json](data.json) has, per run, every unmarked block's record and the probe's samples. It holds
no text, only tags, sizes and times. [restore.log](restore.log) is the `lab-restore` output.

**For #173 and the acceptance runs:** on `main`, `stream-replay-live.mjs` with a fresh unpacked build
stops on a setup error unless `OPTS` turns the rail on (`OPTS={"rail":true}`). The rail is off for a
new install since #158, and the script waits for the rail's host.

## Q1. Which blocks

From the probe's lines after the window (run 2; run 3 is the same block for block):

```
REPORT blocks after the window: 612 in the last turn, content-visibility auto 592, data-butter-seen 25, data-butter-unrendered 567, data-butter-settle left 0
REPORT unmarked blocks after the window: 20 of 612 (seen 25, unrendered 567); by kind: hr classic 20; positions (block index of 612): hr classic [10 38 71 82 122 145 170 202 233 258 300 326 363 409 439 473 497 536 563 592]
REPORT kind hr classic: computed height 1px, border-top 1px, text length 0, ResizeObserver content heights seen [0], skipped events 19, rendered events 1, content-visibility after the window visible
REPORT same elements across the answer: hr 20 (marked 0); marked blocks whose ResizeObserver content box was never above 0: 0
```

The unmarked-block detail line gives each block as `display: block`, 1 px tall, no `data-*`
attribute, and the next sibling always `h1`. 25 seen + 567 unrendered + 20 unmarked = 612.

The `<hr>`'s size, read on the page after run 3 ([hr-rule check](#commands)):

- Tailwind's preflight: `*, ::after, ::before, ::backdrop { box-sizing: border-box; border-width: 0 }`;
- `hr { height: 0; border-top-width: 1px }` (preflight);
- `.HorizontalRule-ByOEk_ { height: 0 }`, from ChatGPT's own stylesheets (two of them);
- computed: `height: 1px` (border box), `box-sizing: border-box`, `border-top-width: 1px`,
  `margin-top: 28px`, `contain-intrinsic-size: auto 120px` (Butter's rule).

Only the declared `height: 0` matters here. With size containment from skipping, `contain-intrinsic-size`
replaces the element's intrinsic size, not a declared height. So a skipped `<hr>` stays at a 0 px
content box (1 px border box), where the study's synthetic `<hr>` (`height: auto`) took the
120 px placeholder. That is why the study's dry page did not reproduce the leak.

## Q2. Why the marker never queues them

The probe (`UNMARKED=1`, [stream-unmarked-probe.mjs](../../../lab/harness/stream-unmarked-probe.mjs))
mirrors the marker in the page's main world. From the moment of Enter it applies the marker's block
selector to every added subtree, puts each block it finds under a ResizeObserver from that moment (the
content box, as the marker's), and counts the content-visibility state events per block.

```
REPORT why never queued: never watched 0; watched, content box never above 0: 20; watched, content box above 0 at some report: 0
```

- **Every one was watched:** each `<hr>` matched the selector when it was inserted (6.2 s to 99.4 s
  after Enter), so the marker's `scan` calls `watch`, which observes it.
- **Every report was 0:** the only content height any report gave for any of the 20 was 0, over the
  whole run, including the 5 s after completion, when they render. The marker unobserves and queues a
  block only on a report above 0 (`e.contentRect.height > 0`). So none was ever queued, so the flush
  never held one (`data-butter-unrendered`) or marked one seen.
- **No other block has this:** 0 marked blocks had a content box that was never above 0. The cause
  is only the declared height, not when the block was inserted, nor its renderer.
- **Not replaced at completion:** 0 watched blocks were removed within 2 s after `in_progress` went,
  and 0 blocks were inserted after it. The 27 (run 2) and 38 (run 3) blocks removed earlier were
  removed while streaming (4.5–101 s); which blocks they were was not recorded.

So, of the spec's three starting points, the second one is it: a block whose size is never reported
above zero. It is not a block that matches the rules only after insertion, and not a block ChatGPT
replaces at completion.

## Q3. Do they leave the `auto` rules at other moments than completion?

**In this run, no.** An unmarked `<hr>` is under the `auto` rules only through the `in_progress`
rule. With no `data-butter-seen` and no `data-butter-unrendered`, the other two rules never apply to
it.

```
REPORT under the auto rules: 93 samples while in_progress, never-queued blocks 0-20, some not content-visibility auto in 0; first sample after in_progress gone at 107608 ms: 0 of 20 auto
```

- In every sample while streaming (93 in run 2, 94 in run 3, once a second), every never-queued block
  computed `content-visibility: auto`. In the first sample after `in_progress` went, 0 of 20 did.
  They all left at the completion attribute change. No state-change event came for any of them after
  completion (run 3: still 19 veiled after the window).
- **Scrolling into view is not such a moment:** a skipped `<hr>` that comes into view fires the
  "not skipped" event like any block. Headless with the real marker
  ([synthetic-scroll.log](synthetic-scroll.log)): `skipped@1019`, then `not-skipped@3537` one frame
  after the scroll. pv0 unveiled it by the second frame.

By the selectors, the `in_progress` rule stops applying to such a block, with no event, in these cases:

| Moment | Seen in a run? | Covered by spec #170's unveil table / guard |
|---|---|---|
| The turn leaves `in_progress` (completion) | Yes, 20 of 20 (19 veiled in pv0) | Completion sweep "every veiled block of that turn that is not held": it must include never-queued blocks, not only queued and held ones; the stylesheet guard as well |
| Stop, if ChatGPT takes the same attribute path | Not runnable in the lab | The same sweep (read-through in #176); the stylesheet guard |
| `cv` goes off (`data-butter-off~="cv"`) | No | The `cv`-off sweep; the guard (every rule is under `html:not([data-butter-off~="cv"])`) |
| The block or its turn leaves the streaming turn (version switch, hidden chat, a remount into another turn) | No (0 hr removed at completion) | The stylesheet guard: outside an `in_progress` turn an unmarked block matches no `auto` rule, so with the guard it computes opacity 1 even with a stale attribute |

The completion sweep alone is not the whole cover. With the stylesheet guard, every moment above is
covered, because an unmarked, unheld block can only be `auto`, and so only veiled, under an
`in_progress` turn.

**One more finding for #176: pv0 veils such a block again after it rendered.** An `<hr>` never gets
a mark, so pv0's test for "has rendered" (`shown` or `data-butter-seen`) never holds for it. Scrolled
into view mid-stream, it unveils. Scrolled away again, its next skip event veils it again
(synthetic-scroll.log, pv0: `away: veil true, opacity 0`). That is harmless on screen while it is
skipped, but it breaks the spec's rule "a block that has rendered once is never veiled again". The
build has to remember "rendered once" on its own (a `WeakSet` filled by the "not skipped" event, for
example), not read it from the marks.

## Q4. Recipe

[veil-unmarked-synthetic.mjs](../../../lab/harness/veil-unmarked-synthetic.mjs) runs it with
Butter's real `stream/containment.css` and `stream/offscreen.js`, headless, no lab
([synthetic.log](synthetic.log)):

1. **Markup:** a scroller (700 px), one `article[data-turn-key]` > `div[data-talvt-turn-state="in_progress"]` >
   `div[data-markdown-text-style="assistant-message"]` holding one `<p>`.
   CSS as on chatgpt.com: `*, ::before, ::after { box-sizing: border-box; border: 0 solid }` and
   `hr { height: 0; border-top-width: 1px }`.
2. **Load:** the stylesheet and marker are in place before the answer streams.
3. **Stream:** one block per frame, 60 `<p>` (past the fold), then the `<hr>`, then 5 more `<p>`. The
   `<hr>` is inserted below the fold: it fires `contentvisibilityautostatechange` with
   `skipped: true`, and its ResizeObserver reports a content height of 0.
4. **Wait** past the 1 s flush: the `<hr>` has neither mark, and computes `content-visibility: auto`.
5. **Complete:** set `data-talvt-turn-state` to anything but `in_progress`. The `<hr>` now computes
   `content-visibility: visible`, no event fires, and it still has neither mark.

Results: head `PASS tw-hr-unmarked`. With pv0 the `<hr>` keeps `data-butter-veil` and computes
`opacity: 0` after completion: the live leak, reproduced. The control `<hr>` (`height: auto`) takes
the 120 px placeholder, is held (`data-butter-unrendered`), and stays `auto`, as in the study's
dry page (`PASS ua-hr-held`).

**After merging `feat/implement-spec-170` (`0e526b5`, which carries the veil):** the same recipe
against that branch's `extension/` gives the `<hr>` `veil true, opacity 0` while streaming and
`veil false, opacity 1` after completion (`PASS tw-hr-unmarked`, `PASS ua-hr-held`).
`veil-unmarked-scroll.mjs` gives `away: veil false, opacity 1`: it is not veiled again after it
rendered. Headless only; no live run of that build was made here.

## Checked, not a bug

**The marker never unobserves a 0 px block.** Headless: a finished turn of 200 `<p>` + a 0 px
`<hr>` was removed, its references dropped, and `gc()` run. It was collected with the `<hr>` as
without it (`removed turn still alive after gc false` in both cases), so the open observation does
not keep a removed chat's DOM alive. The block is never skipped outside a streaming turn, which is
harmless. No issue filed.

## Not established

- **Dil renderer:** this answer rendered in the older renderer only. Under a `DilResponseRoot` an
  `<hr>` would match the same selector and the same `height: 0` rules (the `.HorizontalRule-…` class
  came from ChatGPT's stylesheets). That Dil renders the same `<hr>` was not observed.
- **Other zero-height blocks:** none in this answer besides `<hr>`. Any block with a declared
  `height: 0` (or `display: contents`) would behave the same. #176's synthetic page tests the `<hr>`.
- **Stop, a version switch, a hidden chat:** not runnable in the lab (read-through in #176).
- One fixture, one recording (`en-t09`), one run per build.

## Commands

Run from the worktree (branch `veil/172-unmarked`). `B=~/.local/share/chatgpt-lab/bin`,
`C=~/.local/share/chatgpt-lab/captures/2026-11-24-veil-unmarked`.

```sh
node --test test/stream-unmarked-probe.test.mjs                         # pure report logic (tdd), 4 pass
git apply notes/runs/2026-11-24-stream-veil/pv0.patch                   # in a copy of extension/ (/tmp), = pv0
cp -r extension ~/snap/chromium/common/veil-172/head/butter            # and the pv0 copy to …/pv0/butter
node lab/harness/veil-unmarked-synthetic.mjs extension <pv0 copy>       # synthetic.log, exit 0
node lab/harness/veil-unmarked-scroll.mjs extension; … <pv0 copy>        # synthetic-scroll.log
$B/lab-lock acquire --lab 2 --owner veil-unmarked-172 --wait 1800 --perf  # first wait timed out (lab held by two other tasks in turn); second got it at 00:12:53
# each replay, through a wrapper that refused a run after 1560 s of the lock, after 10 runs, or after an escape:
env LAB_ID=2 LAB_OWNER=veil-unmarked-172 EXT=<build> LABEL=<name> FIXTURE=ats12 PHASES=stream UNMARKED=1 TAIL_MS=5000 \
  [OPTS='{"rail":true}'] OUT=$C/<name>.json node lab/harness/stream-replay-live.mjs > $C/<name>.raw.log
# hr-rule check: connect over CDP with the send guard, read the CSS rules that match the answer's first <hr> and its computed style (no reload, no input)
$B/lab-restore --lab 2 --owner veil-unmarked-172                         # restored, ok true
$B/lab-lock release --lab 2 --owner veil-unmarked-172                    # lab_released, perf_released
```

Logs here are the raw logs with chat URLs, ids and home paths replaced.

**Harness changes** (REPORT lines only, no verdict):

- `lab/harness/stream-unmarked-probe.mjs` (new): the in-page mirror (`installUnmarkedProbe`) and
  `unmarkedReport`. The report is unit-tested in `test/stream-unmarked-probe.test.mjs`.
- `stream-api-probe.mjs`: `UNMARKED=1` installs the probe, arms it at the first tick after Enter,
  samples it with the hydration samples, and adds its lines after the window.
- `veil-unmarked-synthetic.mjs`, `veil-unmarked-scroll.mjs` (new): the recipe, and the
  scroll-in/scroll-away check.
