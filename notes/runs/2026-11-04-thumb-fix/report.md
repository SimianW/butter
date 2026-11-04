> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Overlay thumb hidden by seek preview — fix report

Repo: `~/.t3/worktrees/butter/t3-6cf413cf`, branch `t3/seek-preview`. Not committed.

## Implementation summary

The preview leaves a 16 px strip at the inline end for an overlay thumb. Classic gutters keep their original width; RTL moves the strip to the left and compensates the text column. The original source diff is omitted; measured geometry and test results follow.

## Red (fix reverted, new test present): `node --test test/seek-activation.test.js`

```
✖ preview host leaves the overlay thumb strip uncovered and keeps classic widths (0.2476ms)
ℹ pass 19
ℹ fail 1
✖ failing tests:
✖ preview host leaves the overlay thumb strip uncovered and keeps classic widths (0.2476ms)
  TypeError: core.previewHostSpan is not a function
```

## Green

```
✔ preview host leaves the overlay thumb strip uncovered and keeps classic widths (0.720331ms)
ℹ tests 20
ℹ pass 20
ℹ fail 0

ℹ tests 198
ℹ pass 198
ℹ fail 0
All matched files use Prettier code style!
OK: 0.1.0-alpha.10 / 0.1.0.10; manifest, READMEs, and changelog agree.
```

## Lab check (lab1, read-only, functional)

Setup: `lab-lock acquire --lab 1 --owner butter-thumb-fix` (no `--perf`). Two copies of the working
tree under `~/snap/chromium/common/butter-thumb-fix/`: `before` (my patch reverse-applied) and `after`.
Overlay runs used `LAB_FLAGS=--enable-features=OverlayScrollbar` (same as `(not archived)`);
classic runs used no flags. I granted layout consent via the popup's `chrome.storage.local` (as in
`consent.mjs`). Send guard on. Opened `math12`, put scrollTop at 30%, hovered and pressed the thumb with
CDP mouse events, dragged down 120 px, and measured and screenshotted while the button was held.
Driver: `(not archived)`; raw output: `(not archived)`.

| run | press kind | offsetWidth / clientWidth | host left→right (width) | strip at right−2/−8/−14 covered | text column left |
|---|---|---|---|---|---|
| before-overlay | overlay | 1546 / 1546 | 53→1599 (1546) | yes / yes / yes | 442 (item) |
| after-overlay | overlay | 1546 / 1546 | 53→**1583 (1530)** | **no / no / no** | 442 (est) |
| before-classic | classic | 1546 / 1526 | 63→1589 (1526) | no / no / yes* | 442 |
| after-classic | classic | 1546 / 1526 | 63→1589 (1526) | no / no / yes* | 442 |

\* right−14 = x 1585 lies in the content area. ChatGPT's classic gutter is 20 px split 10/10, so the bar is at 1589–1599.
Classic geometry is identical before and after.

**Limitation: the thumb itself can't be seen in this lab.** In Chromium 156 on Xvfb/llvmpipe, no
thumb pixels appear in the right 14 px, overlay or classic. I checked CDP screenshots, X-display
screenshots (`import -display :99`), and a 3 s x11grab recording during a wheel scroll, including
with the page's `scrollbar-color`/`scrollbar-width` reset inline. The only changes at the edge were
Butter's rail ticks. Also, the page and preview backgrounds are both `rgb(0,0,0)` in dark mode, so the
screenshots can't show a visual difference. The evidence for the fix is therefore geometric: during
an active overlay seek, the opaque host no longer spans the thumb strip. A visual confirmation needs
a real macOS run.

Screenshots (`(not archived)`, not published):
- `{before,after}-overlay-{hover,middrag}.png`, `…-middrag-edge.png` (CDP, viewport)
- `{before,after}-overlay-{hover,middrag}-x.png` (X display incl. browser chrome)
- `{before,after}-classic-*` (same set)
- `before-overlay-*-edge.png` crops, `probe-wheel-{50,300}.png` (thumb probe)

## Lab state

- `lab-restore --lab 1 --owner butter-thumb-fix` → ok: browser restarted with the default
  `butter-blank-head` extension and no flags, one tab on the home URL, composer empty.
- Snap copy `~/snap/chromium/common/butter-thumb-fix/` removed.
- lab1 lock released (`{"lab": 1, "held": false}`). I never touched lab2 or the perf lock.
- No messages sent, no API writes, no 429s. The math12 tab already had a composer draft
  ("<prompt text>") before I opened it. I did not type into it or change it.
