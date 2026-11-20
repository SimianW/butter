# Live re-check: today's ChatGPT page with the seek build — 2026-11-19

Lab run only; no extension, test, lab or script file changed. Lab 2, fixtures `ats12`, `math9`,
`math12` and `demo-en12`. The send guard was on in every connection and no message was sent. The
only clicks were the harnesses' own: rail ticks, scrollbar drags, and ChatGPT's theme setting,
which is back to light. Raw captures (per-load and per-frame JSON, the full survey JSON, ad-hoc
probes) stay in `~/.local/share/chatgpt-lab/captures/2026-11-19-live-recheck/`.

## Result

**The scrolling, rail and seek fixes hold on today's page. ChatGPT's page did change, in ways that
none of Butter's selectors depend on.** With the checkout's head (`e09235b`), wheel scrolling
failed 0 of 6 loads (`ats12` 4, `math12` 2). Rail jumps were 54 of 54 clean, with anchoring left
on at 0 of 48 unpin checks. The tick run gave the same verdicts as the 11-18 fix run: one FAIL, the
known `ats12` tick 4 `card-text` (#130). The seek release landed on the previewed question in 5 of
5 trials, with the same finds in trials 2 and 3 as on 11-18. The rail followed the switch to Dark
(`data-dark` set 264–267 ms after the pick). **`rail-theme-switch-live.mjs` itself no longer
matches the page:** ChatGPT's Settings is now a modal dialog that stays open over the chat after
Back. The modal hides the sidebar from the accessibility tree, so the harness cannot find the
profile button for the Light pass (`HARNESS ERROR`, exit 2, twice). The Light switch was therefore
not measured. On the page itself, ChatGPT now computes `overflow-anchor: none` on the chat
scroller without any extension: scroll anchoring is off for the whole chat natively. The new
transcript element's `none` from 11-18 has moved to the scroller. The reading mode is now
`data-thread-reading="measured"`, the row wrapper's marker is `data-virtualized-turn`, and the
scroller sits under the 52 px header on every fixture. The conversation API and every selector
and marker Butter reads are unchanged.

## Environment and builds

| | |
|---|---|
| Lab | Lab 2, headed Linux Chromium on Xvfb `:98` (1600×1000), software rendering, classic scrollbars, ChatGPT light theme. Lab 2 was stopped at the start; I started it (`LAB_ID=2 bin/lab start`) under my lock. |
| Browser | **Chromium 157.0.8103.50** (snap). The 11-18 runs used 156.0.8078.47. |
| Lock | owner `recheck-1119`, lab 2: 02:28:25–02:54:11 UTC on 2026-11-20 (the evening of 11-19 local), for the survey, wheel, ticks, seek and theme runs (harnesses given `LAB_OWNER`). `rail-jump-live.mjs` then took lab 2 and the perf lock itself (`rail-jump-live-987418`, 02:54:17–03:02:33) and restored and released both. Last, `recheck-1119` again from 03:02 to 03:02:51, for a read-only theme check, a restore and the release. About 34 min of lab time. |
| Test build | `python3 scripts/package.py --test recheck` at `e09235b` → `dist/butter-0.1.0-alpha.21+recheck.1.zip`, unpacked at `~/snap/chromium/common/recheck-1119-test/butter` (manifest `0.1.0.21` / `0.1.0-alpha.21+recheck.1`; `diff -rq` against `extension/`: only `dev/` and `manifest.json` differ) |
| Dev build | `python3 scripts/package.py --dev` → `dist/butter-0.1.0-alpha.21+dev.1.zip`, unpacked at `~/snap/chromium/common/recheck-1119-dev/butter` (has `dev/rail-trace.js`), used for `rail-jump-live.mjs` only |
| Settings | none stored (defaults). Layout memory is unconsented in this profile, so every load had `data-butter-off="layout"`. |
| Lab tooling | `lab-restore` (and every harness, through `lib/lab.mjs`) failed with `Cannot find package 'playwright'`. The lab's `harness` link points to `~/Dev/butter/lab/harness`, which no longer has a `node_modules`, and the README still says it does. Every command here ran with `LAB_PLAYWRIGHT=<checkout>/node_modules/playwright` (Playwright 1.65.0). The lab's files were not changed. |

## Page structure since 2026-11-18

Method: `lab/harness/survey-page-structure.mjs` as on 11-18. It ran natively on all four fixtures
([structure-native.log](structure-native.log)) and with the test build on `ats12` and `math12`
([structure-recheck.log](structure-recheck.log)), each surveyed as opened, at the top, the middle
and the end. I compared the full JSON with the 11-18 survey's `structure-native.json` and
`structure-head.json`. The comparison covered every selector count, `<html>` attributes, the
scroller's attributes, class tokens and computed style, its children, the wrapper chain to the
first turn, the turn, its row wrapper, the question bubble's and answer's attributes and ancestor
chains, every `data-*` attribute name in the scroller, `data-testid`s, header and composer overlap,
ChatGPT's virtualizer props and the conversation API's paths and JSON keys. The ad-hoc comparison
script is `adhoc/sdiff.py` in the captures directory.

**Differences (native unless marked):**

1. **The scroller itself computes `overflow-anchor: none`.** On 11-18 it was `auto`, with `none`
   on the `[data-rail-chat-transcript]` element and the footer child. Today the scroller is `none`,
   and the transcript, the footer child and the `[container-type]` child are all `auto`. This holds
   on all four fixtures at all four positions, so ChatGPT now turns scroll anchoring off for the
   whole chat on its own. The scroller also gained the class `contain-pane-overscroll` and computes
   `overscroll-behavior-y: contain` (was `auto`). Which rule sets the `none` was not traced. With
   the test build: scroller `none`, children `[T:none, none]` (Butter's `cv` rule on the children,
   as in the 11-18 fix runs). The 11-18 head build had `auto`, `[T:auto, none]`.
2. **The reading mode changed.** The scroller carries `data-thread-reading="measured"` (was
   `anchored`). `data-thread-has-reading-passage` and the `[data-thread-reading-passage]` element
   are gone. Its `role="region"`, `aria-label` and `tabindex` are unchanged.
3. **Row wrapper marker renamed.** Each virtualized row wrapper now has `data-virtualized-turn`
   instead of `data-measured-turn`, and its inline style gained `overflow-y: clip`, so it reads
   `height; margin-top; contain: size; overflow-y: clip`. The spacer structure (`div.contents` >
   `div.relative.shrink-0[height]` > `div.flex.flex-col[margin-top]` > rows) is unchanged.
   `rail/turns.js` reads `wrapper.style.height`, which is still there. Neither attribute appears in
   `extension/` or `lab/harness/`.
4. **The scroller sits under the header on every fixture.** On 11-18, `ats12` and `demo-en12`
   started at y 52 (`clientHeight` 860, header overlap 0), while `math9` and `math12` started at y 0.
   Today all four start at y 0 with `clientHeight` 912 and a header overlap of 52 px, so the rail's
   `HEADER = 52` now fits every fixture. The composer overlap is unchanged: 76 px, 203 on `math12`.
5. **Natively, `ats12` opens 5 px from its end.** scrollTop 9409 of 10326, `clientHeight` 912; on
   11-18, 1 px. The test build opened the same way (4–5 px), so `wheel-jump-live.mjs` reports every
   `ats12` load "not opened at the end" (its rule is within 2 px). This is ChatGPT's own position,
   not Butter's.
6. **Minor.** Two new `data-testid`s outside the chat (`task-row-environment-cloud`,
   `cloud-thread-environment-icon`). New `data-*` names in the scroller: `data-dropdown-overlay-side`,
   plus on some positions `data-anchor-positioning`, `data-composer-expandable` and
   `data-placement`. The scroller's class `group-has-[[data-expanded-composer]]…` became
   `group-has-[[data-composer-expanded]]…`.

**Unchanged:** every selector and marker Butter reads (the 11-18 survey's table) matches with
counts that follow the mounted turns. No selector went from matching to 0 or from 0 to matching on
any fixture. The checked set: `.thread-scroll-container`, `[data-turn-key]` (attributes `class` +
`data-turn-key` only), `[data-markdown-text-style="assistant-message"]`,
`[data-chatgpt-selection-message-id]`, `[data-chatgpt-selection-conversation-id]`,
`[data-user-message-bubble]`, `[data-talvt-turn-state]`, `.katex`/annotation/`[data-math-source]`,
`[data-wide-block]`, the inline-size container, `.ProseMirror[contenteditable=true]` (with
`role=textbox`), `form[data-composer-placement]` and `header`. The two stale first alternatives
(`#prompt-textarea`, `#thread-bottom-container`) and the send and stop selectors still match 0 with
an empty composer, as on 11-18. `<html>` has the same attribute names (`class="chatgpt-theme"`,
`data-theme`, `data-appearance-preset`, `data-appearance-mode`, …) and still no `dark`/`light`
class. The virtualizer's `entries[].turnKey` and its props are as on 11-18. The conversation API
paths, methods, status codes and JSON keys (top level and `messages`) are identical. With the
test build, every mounted turn has `data-butter-seen` and computes `content-visibility: auto`, and
the "end" survey stood at the end (`ats12` 39808, `math12` 346428). On 11-18, head's end survey had
jumped back to 0.

## Harness runs

All on lab 2. Commands as in the baselines, plus `LAB_OWNER=recheck-1119` (and `OUT=` into the
captures directory) where I held the lock. Every command also had `LAB_PLAYWRIGHT` set (see
Environment). "Baseline" is the 11-18 fix runs ([fix report](../2026-11-18-live-survey/fix/report.md))
and the 11-18 seek-landing runs ([report](../2026-11-18-seek-landing/report.md)).

| Run | Command (`EXT`: T = `recheck-1119-test/butter`, D = `recheck-1119-dev/butter`) | Exit | Result | Baseline result | Log |
|---|---|---:|---|---|---|
| Survey, native | `LAB_ID=2 LAB_OWNER=recheck-1119 EXT= FIXTURES=ats12,math9,math12,demo-en12 LABEL=native node lab/harness/survey-page-structure.mjs` | 0 | surveyed (REPORT only); differences above | 11-18 native: exit 0 | [structure-native.log](structure-native.log) |
| Survey, test build | `… EXT=T FIXTURES=ats12,math12 LABEL=recheck node lab/harness/survey-page-structure.mjs` | 0 | surveyed (REPORT only); scroller `none`, children `[T:none, none]` | 11-18 head: exit 0, `auto [T:auto, none]` (pre-fix build) | [structure-recheck.log](structure-recheck.log) |
| Wheel, `ats12` | `LAB_ID=2 LAB_OWNER=recheck-1119 EXT=T LABEL=recheck-wheel-ats12 LOADS=4 GAP=20000 node lab/harness/wheel-jump-live.mjs` | 0 | **0/4 failed**; `PASS load ats12 #1–#4`: end in 57, 57, 25, 57 steps; opened 4–5 px from the end | fix-anchor: exit 0, 0/4 failed (18, 57, 20, 57 steps), opened 1–5 px from the end | [wheel-ats12.log](wheel-ats12.log) |
| Wheel, `math12` | `… EXT=T LABEL=recheck-wheel-math12 FIXTURES=math12 LOADS=2 STEPS=400 GAP=20000 node lab/harness/wheel-jump-live.mjs` | 0 | **0/2 failed**; end in 311 and 266 steps; opened 2019 px from the end (scrollTop 64103 of 67034) | fix-math12: exit 0, 0/2 failed (218, 311 steps) | [wheel-math12.log](wheel-math12.log) |
| Ticks | `LAB_ID=2 LAB_OWNER=recheck-1119 EXT=T LABEL=recheck-ticks node lab/harness/rail-ticks-live.mjs` | 1 | `SUMMARY recheck-ticks: 1 FAIL`: only `FAIL ats12 card-text: tick 4: card text (389 chars) is not question 4's (37 chars)` (#130); all `count`, `wheel-*`, `click-*`, `keys-*` PASS on both fixtures; wheel passes 0 page jumps back, 12/12 questions seen on both | fix-ticks: exit 1, the same single FAIL, the same PASS lines | [ticks.log](ticks.log) |
| Rail jumps | `LAB_ID=2 EXT=D LABEL=recheck-railjump node lab/harness/rail-jump-live.mjs` (took and released its own lab and perf lock) | 0 | `SUMMARY {"jumps":54,"failed":0,"visibleDetour":0,…,"rawReversal":43,"rawReversalCount":91,"unpinChecks":48,"anchoringOn":0,"cvOff":0}` | fix-railjump: exit 0, 54 jumps, 0 failed, 0 detours, rawReversal 43 (count 88), anchoringOn 0/48 | [railjump.log](railjump.log) |
| Seek landing, `math12`, 5 releases | `LAB_ID=2 LAB_OWNER=recheck-1119 EXT=T FIXTURE=math12 node lab/harness/seek-landing-live.mjs` | 0 | `PASS seek-landing #1–#5`, `SUMMARY seek-landing: 0 FAILs`; each on its previewed question +1 px (3, 6, 7, 5, 7); finds in trial 2 (192955 → 195670 at 1284 ms) and trial 3 (227066 → 229284 at 1352 ms); readable 2.5–3.3 s after release | fix5: exit 0, 5/5 PASS, the same questions, finds at 1836/1919 ms, readable 3.1–4.2 s | [seek-landing.log](seek-landing.log) |
| Theme switch | `LAB_ID=2 LAB_OWNER=recheck-1119 EXT=T node lab/harness/rail-theme-switch-live.mjs` | 2 | `PASS switch-dark-page`, `PASS switch-dark-host` (`data-dark` set 267 ms after the pick), `PASS switch-dark-chat`; then `HARNESS ERROR: locator.click: Timeout 10000ms exceeded … waiting for getByRole('button', { name: 'Open profile menu' })`; the Light pass and `light-restored`/`light-host` never ran | fix3: exit 0, all 8 PASS, `data-dark` 82 ms after Dark, 77 ms after Light | [theme-switch.log](theme-switch.log) |
| Theme switch, rerun | the same command | 2 | the same: three Dark PASS (264 ms), the same `HARNESS ERROR` | — | [theme-switch-2.log](theme-switch-2.log) |

Send guard: each open of `math12` had 2 `POST /backend-api/f/conversation/prepare` blocked
(ChatGPT's own, known): `sendAttempts` 4 in the wheel run (2 loads) and 2 in the tick run, the same
as the 11-18 fix runs. Nothing else was counted as a send attempt (`ats12` wheel: 0).

### The theme harness against today's Settings

The harness opens ChatGPT's settings through the profile menu. Its code assumes "an in-app page
at `/settings/appearance` with no reload". It picks Dark, goes Back to the chat until turns show,
then opens the profile menu again for Light. A read-only probe after the rerun
([theme-dialog-probe.log](theme-dialog-probe.log)) found the chat's URL with ChatGPT's Settings
still open over it as a `div[role=dialog][aria-modal=true]` (1200×775 at x 200, y 68). The
profile button was present, but its `<nav>` ancestor had `aria-hidden="true"`, so
`getByRole('button', { name: 'Open profile menu' })` cannot see it. The Back steps changed the URL
but did not close the dialog.

The harness's error path writes the theme cookie (`codex_appearance_theme=light`) and
`localStorage.theme` back but does not reload. After each error the page was still Dark
(`data-theme="dark"`, `color-scheme: dark`, the rail host `data-dark`). A plain reload brought it
back to light both times (`data-theme` and `color-scheme` light, no `data-dark`). After the last
run and `lab-restore`, the lab read light ([theme-final.log](theme-final.log)). Both points are
harness findings; the harness was not changed.

## Not established

- **The rail following a live switch to Light.** The harness stopped before the Light pass both
  times. The Dark direction passed, with `data-dark` set 264–267 ms after the pick, against
  77–96 ms on 11-18. Whether the slower time comes from the modal Settings, Chromium 157 or the
  machine's load was not looked into; the harness reads 1 s after the pick, so it passes either way.
- **What sets the scroller's `overflow-anchor: none` natively, and since when.** The survey records
  computed styles only. Whether ChatGPT means to keep anchoring off for the whole chat (which would
  make Butter's own `none` on the children redundant but harmless) is not known.
- **What `data-thread-reading="measured"` does** to scroll positions (not traced, as with
  `anchored` on 11-18).
- **The send and stop buttons** (nothing typed or streamed), **streaming selectors**, **Dil**,
  **Temporary Chat**, **Work mode**, **Ask in branch** and **bookmarks**: not run, as on 11-18.
- **`ats12` tick 4's card** (#130): unchanged, not investigated.
- **Failure rates.** 6 wheel loads, 54 jumps and 5 releases, each run once (theme twice). That is
  enough to show that the fixes still hold on today's page, not enough to measure how often they
  fail.
- macOS Chrome, overlay scrollbars and trackpad input: only Linux Chromium 157 with classic
  scrollbars and CDP input was run.

## Clean-up

- After the theme runs: `lab-restore --lab 2 --owner recheck-1119` (exit 0, browser restarted to
  the lab's defaults: no extension; home tab; empty composer) ([restore-1.log](restore-1.log)),
  then `lab-lock release` (exit 0).
- `rail-jump-live.mjs` restored (`restored: true`) and released its lab and perf locks itself.
- Last: `lab-lock acquire --lab 2 --owner recheck-1119`, a read-only theme check (light),
  `lab-restore` (exit 0, `"ok":true`, no restart needed) ([restore-final.log](restore-final.log)),
  `lab-lock release` (exit 0). `lab-lock status` at the end ([lock-status.log](lock-status.log)):

```text
{"lab": 1, "held": false, "owner": null}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": false, "owner": null}
```

Lab 1 was not used. Unpacked builds stay at `~/snap/chromium/common/recheck-1119-{test,dev}/butter`.

## Files

- `report.md` (this).
- `*.log`: one per run, copied from the raw logs with the home path replaced by `~` and URLs,
  ids and the project id removed. They hold counts, attribute and class names, pixel numbers and
  verdict lines, and no chat text, chat URLs or account names. `theme-dialog-probe.log` is a
  summary of the raw probe with the dialog headings left out: they contained a chat title and the
  account name.
