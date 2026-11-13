# Rail tick rendering diagnosis — Control and Red only

Baseline: `91fc048` (`main`), manifest `0.1.0-alpha.21`. The reported Windows build was `0.1.0-alpha.21+dev.3`; that packaged build was not available for execution. Local branch: `fix/rail-tick-thin`. No product code, settings defaults, shared lab configuration/profile, issue, PR, release or version was changed. Nothing was pushed.

## Findings

1. **Yes, rest ticks can differ substantially at fractional scales.** Real Chrome zoom reproduced the approximately half-bright third tick at 90%: grayscale sums **1,242 / 634 / 1,242** for rest ticks 2–4, a **49.0%** deficit. At 110%, 125% and 175% real zoom the differences were 32.2%, 32.2% and 24.1%. At 100% and 150% real zoom they were equal. Device-scale emulation behaved differently: only 1.1 exceeded the 10% threshold; 0.9 had a small 3.4% spread. At scale 1 all rest ticks matched, with identical two-row, 12-pixel-long drawing and brightness 1,516. These are the tested scales and fixture geometry, not an exhaustive map of every scale/phase.
2. **The failure is position-dependent painting/rasterization, with equal state.** It remains with identity transforms, equal opacity, no animation, and even `transform:none`. At 90% zoom, moving only the ticks' layout down 2 CSS pixels changes all four equal-state sums from `1242,1242,634,1242` to `1242,1242,1242,1242`. The browser's logical rectangles retain equal dimensions. Their rasterized strokes do not. The inline hover-wave scale is not shrinking the third tick.
3. **Smallest supported fix proposal: add `will-change: transform` to `.bar` in `extension/rail/style.js`.** This fixture-only probe removes the large inequality at every tested scale, without changing the scale-1 bitmap at all. It gives each tick its own compositing/rasterization opportunity rather than relying only on the rail's layer. This is a proposal, not a product edit. Across the tested real-zoom values, all four equal-state sums become exactly equal; device-scale emulation retains at most 2.1% residual antialiasing/rounding variation. No finite matrix proves equality at every possible scale, geometry, browser or GPU. The proposal targets perceptually alike rest ticks, not byte-identical pixels at different subpixel phases. Layer count/memory and hover performance with a long rail require validation before shipping.

## Step 1 — Control

The external lab README was read. One `lab status` call returned `xvfb: stopped`, `chromium: stopped`, `x11vnc: stopped`, `novnc: stopped`. `ls -l /snap/bin/chromium` exited 2: `No such file or directory`. No lab start, lock, configuration or profile operation was attempted. The live lab did **not** reproduce this bug because it could not run.

The independent control used Playwright 1.65.0, headed Chromium **158.0.8127.18** under `xvfb-run -a` on Linux/WSL. Every browser used a new temporary profile, removed in `finally`. Four artificial questions and answers occupy a synthetic conversation; the first question is in the lit band. Navigation is fulfilled with that fixed HTML, and every other routed request is aborted. There is no login, live ChatGPT conversation, API response, user message or captured DOM. The unpacked extension is loaded directly from this worktree, using the earlier run's successful page structure and `butter-nav` fixture event.

Without the extension, all six device-scale controls have **zero Butter hosts and zero grayscale brightness** in the equivalent right-hand crop. With Butter, four real `.tick > .bar` nodes are drawn and the bug reproduces. This establishes Butter's own drawing as the source in the synthetic control; it does not establish the state of the user's live page.

`device` means Playwright `deviceScaleFactor` at normal browser zoom. `zoom` means actual Chrome per-tab browser zoom set by `chrome.tabs.setZoom` in the unpacked extension's worker, with `deviceScaleFactor:1`. The requested scale is checked against `devicePixelRatio`; `visualViewport.scale` stays 1. This is neither CSS zoom nor CDP pinch/page-scale emulation. Real-zoom no-extension arms are explicitly skipped because there is no extension worker to set arbitrary tab zoom; the six extension-free controls use device-scale emulation. Equal-state controls cover **both** full scale matrices.

The pointer stays at `(10,10)`, away from the rail. The harness waits for ticks 2–4 to settle to inline `scale(1, 1)` and opacity `0.28`, then waits out the rail's fade. Every crop is taken at device resolution. Because real zoom makes Playwright's screenshot-clip coordinates differ from DOM CSS coordinates, the final harness captures the viewport bitmap and crops it in device pixels. Full viewport captures are not retained.

### Independent attachment measurement

The supplied PNG was decoded only as image data with `ffmpeg` to raw grayscale and piped to `python3 -I`. The original image, its path and derived private frames are not copied into these artifacts. The initial measurement command had a Python parenthesis syntax error; the corrected command produced:

| Tick | Rows with pixels above 25 | Length | Row peaks | All grayscale brightness in its isolated band |
| --- | --- | --- | --- | --- |
| 1, active | 31–33 | 20 | 94, 236, 142 | 8751 |
| 2 | 44–46 | 10 | 26, 66, 40 | 1279 |
| 3 | 57–58 | 9 | 26, 40 | 661 |
| 4 | 69–71 | 10 | 26, 66, 40 | 1279 |

The third tick has a 48.3% brightness deficit against ticks 2 and 4. The synthetic 90%-zoom reproduction has a 49.0% deficit in the same third rest tick. It does not reproduce every pixel: its third tick is 10 pixels long at the threshold, rather than 9. Device-scale 1.1 separately reproduces both reduced width (12 versus 13) and reduced brightness. The original Windows screenshot's exact horizontal phase, vertical phase, zoom, device scale, compositor and live state are unknown.

### Measurement definition

Rows and lengths count grayscale values strictly greater than 25. Row numbers are zero-based within each synthetic crop. Length is the horizontal span of those pixels. Integrated brightness sums **all** grayscale values, including antialiased values at or below 25, in disjoint bands separated halfway between adjacent tick centers. Thus the brightness verdict is not an artifact of thresholding faint edge pixels. Crop bounds, dimensions, row peaks, DOM rectangles, inline/computed transforms, inline/computed opacity, animation name, rail opacity/class, three-dots visibility and bookmark-dot counts are retained in [measurements.json](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/measurements.json).

The pass/fail tolerance is a **10%** deficit against the brightest equal-state rest tick in that capture. The active first tick is excluded in the native arm; every tick is compared in the forced-equal arm. This tolerance is deliberately well below the reported roughly half-bright defect and above small interpolation/8-bit rounding differences. It is not a pixel-perfect visual specification.

### Native extension measurements

Entries in each cell follow tick order 1, 2, 3, 4. Tick 1 is active; ticks 2–4 are at rest.

| Method | Scale | Rows above 25, bars 1 / 2 / 3 / 4 | Lengths, device px | Summed grayscale |
| --- | --- | --- | --- | --- |
| device | 1 | 32–33 / 46–47 / 60–61 / 74–75 | 21, 12, 12, 12 | 9496, 1516, 1516, 1516 |
| device | 0.9 | 29–31 / 42–43 / 55–56 / 67–68 | 20, 10, 10, 10 | 7725, 1222, 1180, 1180 |
| device | 1.1 | 35–37 / 51–52 / 66–67 / 81–83 | 24, 13, 12, 13 | 11746, 1830, 1644, 1846 |
| device | 1.25 | 39–42 / 57–59 / 75–77 / 92–94 | 27, 15, 15, 15 | 14847, 2347, 2347, 2347 |
| device | 1.5 | 47–51 / 69–71 / 90–92 / 111–113 | 33, 19, 19, 19 | 21377, 3376, 3376, 3376 |
| device | 1.75 | 55–59 / 80–83 / 105–108 / 129–132 | 38, 21, 21, 21 | 29247, 4587, 4560, 4587 |
| zoom | 1 | 32–33 / 46–47 / 60–61 / 74–75 | 21, 12, 12, 12 | 9496, 1516, 1516, 1516 |
| zoom | 0.9 | 29–31 / 42–43 / 55 / 67–68 | 18, 10, 10, 10 | 7839, 1242, 634, 1242 |
| zoom | 1.1 | 35–37 / 51–52 / 66–68 / 82–83 | 25, 14, 14, 14 | 11117, 1763, 2599, 1763 |
| zoom | 1.25 | 40–42 / 58–59 / 75–77 / 93–94 | 27, 15, 15, 15 | 17671, 1912, 2818, 1912 |
| zoom | 1.5 | 48–50 / 69–71 / 90–92 / 111–113 | 32, 18, 18, 18 | 21386, 3412, 3412, 3412 |
| zoom | 1.75 | 56–59 / 81–83 / 105–108 / 130–132 | 38, 21, 21, 21 | 33458, 4000, 5270, 4000 |

### Forced-equal control

Fixture CSS sets all four ticks to identity scale and opacity 0.28 with animations disabled; it leaves placement, dimensions and the original painting rules intact. The unequal drawing persists.

| Method | Scale | Rows above 25, bars 1 / 2 / 3 / 4 | Lengths, device px | Summed grayscale |
| --- | --- | --- | --- | --- |
| device | 1 | 32–33 / 46–47 / 60–61 / 74–75 | 12, 12, 12, 12 | 1516, 1516, 1516, 1516 |
| device | 0.9 | 30–31 / 42–43 / 55–56 / 67–68 | 10, 10, 10, 10 | 1214, 1222, 1180, 1180 |
| device | 1.1 | 35–37 / 51–52 / 66–67 / 81–83 | 13, 13, 12, 13 | 1852, 1830, 1644, 1846 |
| device | 1.25 | 40–42 / 57–59 / 75–77 / 92–94 | 15, 15, 15, 15 | 2347, 2347, 2347, 2347 |
| device | 1.5 | 48–50 / 69–71 / 90–92 / 111–113 | 19, 19, 19, 19 | 3376, 3376, 3376, 3376 |
| device | 1.75 | 56–59 / 80–83 / 105–108 / 129–132 | 21, 21, 21, 21 | 4560, 4587, 4560, 4587 |
| zoom | 1 | 32–33 / 46–47 / 60–61 / 74–75 | 12, 12, 12, 12 | 1516, 1516, 1516, 1516 |
| zoom | 0.9 | 29–30 / 42–43 / 55 / 67–68 | 10, 10, 10, 10 | 1242, 1242, 634, 1242 |
| zoom | 1.1 | 36–37 / 51–52 / 66–68 / 82–83 | 14, 14, 14, 14 | 1763, 1763, 2599, 1763 |
| zoom | 1.25 | 40–42 / 58–59 / 75–77 / 93–94 | 15, 15, 15, 15 | 2818, 1912, 2818, 1912 |
| zoom | 1.5 | 48–50 / 69–71 / 90–92 / 111–113 | 18, 18, 18, 18 | 3412, 3412, 3412, 3412 |
| zoom | 1.75 | 56–59 / 81–83 / 105–108 / 130–132 | 21, 21, 21, 21 | 5270, 4000, 5270, 4000 |

### Small synthetic crops

These images contain only the artificial rail, never the supplied screenshot.

| Normal scale 1 | Real zoom 90%, native | Real zoom 90%, forced equal | Real zoom 90%, proposed layer probe |
| --- | --- | --- | --- |
| ![Synthetic scale 1](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/zoom-1-native.png) | ![Synthetic 90% native](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/zoom-0.9-native.png) | ![Synthetic 90% equal](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/zoom-0.9-equal.png) | ![Synthetic 90% layer probe](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/zoom-0.9-layer.png) |

## Cause and alternatives

The relevant product paths and lines are:

- [extension/rail/style.js:16](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/style.js:16): the rail is translated and already has `will-change:transform`. Its child ticks do not each have that hint.
- [extension/rail/style.js:24](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/style.js:24): tick buttons use flex centering. [extension/rail/style.js:33](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/style.js:33) gives their pitch; [extension/rail/style.js:37](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/style.js:37) paints the 12-by-2 CSS-pixel rounded `.bar`, with `transform-origin:right center`.
- [extension/rail/model.js:32](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/model.js:32) fixes the short-rail maximum pitch at 14 CSS pixels. [extension/rail/model.js:262](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/model.js:262) calculates the pitch; line 264 rounds the rail origin to a **CSS** pixel, which need not be a device pixel under scaling. Different tick positions therefore have different device-pixel phases.
- [extension/rail/model.js:41](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/model.js:41) defines rest width scale 1 and opacity 0.28. [extension/rail/model.js:101](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/model.js:101) derives the targets; vertical scale starts at 1 and the pointer only increases it. There is no target below 1 in this policy.
- [extension/rail/wave.js:14](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/wave.js:14) serializes scale and opacity; [extension/rail/wave.js:54](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/wave.js:54) eases/snaps to those targets. [extension/rail/rail.js:381](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/rail.js:381) applies the frame's inline values; [extension/rail/rail.js:434](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/rail.js:434) also applies them on layout.
- [extension/rail/style.js:34](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/style.js:34) applies the busy blink **only** to a `.tick.busy .bar`. The native measured parents are plain `tick`, animations are `none`, and rest opacity is `0.28`. Forcing animations off still reproduces it, so the blink is unnecessary for this failure.
- [extension/rail/style.js:43](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/style.js:43) applies `faint` only to `.bdot.faint`; [extension/rail/rail.js:280](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/rail.js:280) creates/decorates those separate bookmark dots. The measured elements are `SPAN` children of tick buttons, created at [extension/rail/rail.js:420](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/extension/rail/rail.js:420), not bookmark dots, the three dots, or a scrollbar.

At real zoom 0.9, native rest ticks 2–4 all report `scale(1, 1)`, `matrix(1, 0, 0, 1, 0, 0)`, opacity `0.28`, animation `none`, and equal rectangles approximately 11.99653 by 1.99653 CSS pixels. Their top positions are approximately 397.98264, 411.97571 and 425.96875 CSS pixels. The source dimensions remain equal while coverage changes.

Removing the identity transform produces the same unequal sums at every tested scale. Removing the corner radius also fails: at real zoom 0.9 the square-tick sums are `1310,1310,650,1310`. Neither the identity transform nor rounded corners is required to trigger the large deficit. Moving the `.ticks` layout 2 CSS pixels at 0.9 removes the deficit with no state change. Together these controls isolate placement/paint phase from wave state. The precise Chromium/Skia internal snapping stage was not traced; position-dependent rasterization is established by the observable controls, and integer device-stroke snapping is the mechanism consistent with them.

## Proposed smallest change — not applied

Add just this declaration to the existing `.bar` rule:

```css
will-change: transform;
```

The harness's `layer` probe injects this declaration into the fixture shadow root after forcing equal rest state. It does not edit or persist product CSS. All rest bars retain the same intended CSS size, color and opacity; the large per-tick brightness differences disappear in both matrices:

| Method | Scale | Rows above 25, bars 1 / 2 / 3 / 4 | Lengths, device px | Summed grayscale |
| --- | --- | --- | --- | --- |
| device | 1 | 32–33 / 46–47 / 60–61 / 74–75 | 12, 12, 12, 12 | 1516, 1516, 1516, 1516 |
| device | 0.9 | 29–31 / 42–43 / 55–56 / 67–68 | 10, 10, 10, 10 | 1214, 1225, 1215, 1215 |
| device | 1.1 | 35–37 / 51–52 / 66–68 / 81–83 | 13, 13, 13, 13 | 1869, 1844, 1882, 1856 |
| device | 1.25 | 40–42 / 57–59 / 75–77 / 92–94 | 15, 15, 15, 15 | 2387, 2376, 2387, 2376 |
| device | 1.5 | 48–50 / 69–71 / 90–92 / 111–113 | 19, 19, 19, 19 | 3412, 3412, 3412, 3412 |
| device | 1.75 | 56–59 / 80–83 / 105–108 / 129–132 | 21, 21, 21, 21 | 4628, 4609, 4628, 4609 |
| zoom | 1 | 32–33 / 46–47 / 60–61 / 74–75 | 12, 12, 12, 12 | 1516, 1516, 1516, 1516 |
| zoom | 0.9 | 29–30 / 42–43 / 55–56 / 67–68 | 11, 11, 11, 11 | 1382, 1382, 1382, 1382 |
| zoom | 1.1 | 36–37 / 51–52 / 66–67 / 82–83 | 13, 13, 13, 13 | 1643, 1643, 1643, 1643 |
| zoom | 1.25 | 40–42 / 58–60 / 75–77 / 93–95 | 15, 15, 15, 15 | 2820, 2820, 2820, 2820 |
| zoom | 1.5 | 48–50 / 69–71 / 90–92 / 111–113 | 18, 18, 18, 18 | 3414, 3414, 3414, 3414 |
| zoom | 1.75 | 56–59 / 81–84 / 105–108 / 130–133 | 21, 21, 21, 21 | 5280, 5280, 5280, 5280 |

At scale 1, the forced-equal and layer-probe PNGs for both methods have the **same SHA-256**, `3e8d992e5c2cd06ffe084c220f66d99ee5b9b37f5ce2541a2123176aa34d1ec5`. This establishes unchanged scale-1 drawing for rest ticks in this fixture. It does not validate all hover/active states or long-rail layer costs. A preliminary fixture-only `translateZ(0)` probe also equalized the 0.9 and 1.1 real-zoom samples; the one-declaration hint is smaller and leaves the wave's inline transform protocol intact.

Snapping only the **rail origin** is insufficient because fractional device-pixel pitch still gives successive ticks different phases. Rounding each tick's placement in device pixels is a possible stronger geometry-based alternative if compositing hints prove unreliable, but would require more code, zoom/resize handling, and consideration of pointer/card/bookmark alignment. It is not the smallest supported proposal here.

## Step 2 — Red

The unit seam cannot reproduce rasterization: equal numerical dimensions and state are precisely what the failing browser reports. The first suitable agreed seam is the real-browser synthetic fixture harness in `lab/harness/`. No unit assertion was added that would falsely imply pixel coverage is covered.

From the repository root, after `npm ci`:

```sh
xvfb-run -a node lab/harness/rail-tick-thin.mjs
```

Actual exit status: **1**. The complete stdout/stderr is [red-output.txt](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/red-output.txt). Relevant actual lines:

```text
FAIL device=1.1 native bar 3: brightness 1644 vs 1846, deficit 10.9% > 10%
FAIL zoom=0.9 native bar 3: brightness 634 vs 1242, deficit 49.0% > 10%
FAIL zoom=0.9 equal bar 3: brightness 634 vs 1242, deficit 49.0% > 10%
RED: 17 unequal-rest-bar comparisons; tolerance=10%; browser=158.0.8127.18
```

The full matrix was run repeatedly with the same 17 failures; narrower 90% and 110% zoom runs also went red. The earlier device-only 1/0.9 pilot correctly went green, which is why real zoom was essential. The red command exercises unchanged product rendering; only diagnostic controls inject fixture CSS. The script preserves the four-question input requested for comparison and runs unattended. It closes its browsers and deletes its own profiles, including on an assertion/setup error.

## Limits and handoff

- The live lab cannot start on this machine; no live ChatGPT or Windows browser was tested.
- The screenshot alone cannot establish the user's actual browser zoom, Windows display scale, DPR, transient wave state, busy state or exact version contents. It establishes the pixel symptom only. The synthetic controls show a sufficient cause, not proof of the user's historical state.
- Device-scale emulation and browser zoom differ materially; their results must not be collapsed into one "effective DPR" claim.
- No claim is made about all scales, operating systems, GPUs, themes, long-rail compressed pitch, resizing or hover performance. The per-tick layer proposal needs those checks before implementation/ship.
- Browser zoom without any extension was not driven; the no-extension controls cover the complete device-scale matrix.
- The crops reproduce reduced vertical coverage and brightness at 90%, and reduced length at device scale 1.1; exact Windows screenshot pixel identity was not reached.
- The task deliberately stops after Control and Red. No Green fix, mockup/product UI change, issue/PR action, push, review gate or release was performed.

`npm run format:check` and `npm run lint` both exit 0. Their actual output is in [format-output.txt](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/format-output.txt) and [lint-output.txt](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/lint-output.txt). Commands, outputs, pilot limitations and local commit/done checks are recorded in [commands.md](/home/Simian/.t3/worktrees/butter/t3-f26a38db-fe28de0bff619ca6/notes/runs/2026-11-13-rail-tick-thin/commands.md).
