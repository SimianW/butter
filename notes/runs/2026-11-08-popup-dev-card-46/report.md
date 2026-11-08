# Popup dev card and DEV tag (#46): dev states against the approved #32 mockup

Build: `t3/46-popup-dev-card` at `48faea0`, packaged with `python3 scripts/package.py --dev` as
`0.1.0-alpha.15+dev.12`. The mockup is the `Mockup` artifact on issue #32
(`gh issue artifact download 32 1 -R SimianW/butter`). The run used Playwright's headless Chromium
on Linux, in its own profiles, over the popup page only. It sent no network requests and recorded no
page errors.

`BUTTER_REDESIGN_MOCKUP=<#35 mockup> BUTTER_DEV_MOCKUP=<#32 mockup> node lab/harness/popup-qa.mjs`

The run first checks the 24 store states in both themes against the #35 redesign as before. All 9
panels match, and no store state renders the DEV tag or the dev card. Then it builds the dev zip,
unzips it and loads it with the `save-bug` binding seeded as Alt+Shift+B. Chrome does not assign
that key on Linux, so the profile carries the binding that `chrome://extensions/shortcuts` would
save.

## Dev states against the mockup

A panel passes when its height equals the built popup's and fewer than 0.1% of its pixels differ by
more than 24 in any channel. The version label and the storage line are masked, and the mockup's
numbered badges are hidden. The recording dot is held at its first frame in both.

| Panel | Built state | Height built/panel | Pixels differing | Built | Mockup |
|---|---|---|---|---|---|
| dev-default-after | d1-en-recording-light | 568/568 | 0.001% | [png](popup/d1-en-recording-light.png) | [png](popup/mockup-dev-default.png) |
| dev-saved-after | d2-en-saved-light | 568/568 | 0.000% | [png](popup/d2-en-saved-light.png) | [png](popup/mockup-dev-saved.png) |
| dev-away-after | d3-en-away-light | 568/568 | 0.000% | [png](popup/d3-en-away-light.png) | [png](popup/mockup-dev-away.png) |
| dev-dark-after | d1-en-recording-dark | 568/568 | 0.000% | [png](popup/d1-en-recording-dark.png) | [png](popup/mockup-dev-dark.png) |
| dev-worst-after | d4-en-tallest-light | 597/597 | 0.000% | [png](popup/d4-en-tallest-light.png) | [png](popup/mockup-dev-worst.png) |

## Every dev state

Each state is captured in both themes. Each one is at most 600 px. Each dev row is 36 px, its
children stay inside it, and its text is not clipped. The status text starts at the same x as the
other cards' row text.

| State | Light | Dark | Row text |
|---|---|---|---|
| d1 recording | 568 px | 568 px | Round 2 · 3 bugs · Alt+Shift+B |
| d2 just saved | 568 px | 568 px | (Saved) bug-04_21-14-03.json · Alt+Shift+B |
| d3 not on a ChatGPT tab | 568 px | 568 px | Not recording · Alt+Shift+B (disabled) |
| d4 tallest (four faults and the consent note) | 597 px | 597 px | Round 2 · 3 bugs · Alt+Shift+B |
| d5 Chinese recording | 568 px | 568 px | 第 2 轮 · 3 个 bug · Alt+Shift+B |
| d6 Chinese tallest | 581 px | 581 px | 第 2 轮 · 3 个 bug · Alt+Shift+B |

## Card actions in the dev build

- The recording dot has `animation: rec 1.6s`. Under reduced motion its animation is `none`.
- Focusing New round from the keyboard shows the focus ring. Pressing Enter changed
  `butterDev` from `{round: 2, bugs: 3}` to `{round: 3, bugs: 0}`, and the card said
  "Round 3 · 0 bugs". After a page reload, it still said "Round 3 · 0 bugs".
- Open round folder before the round's first save called `chrome.downloads.showDefaultFolder()`.
- The save button, pressed with Enter, went through the real dev worker. The worker asked tab 1
  for a snapshot with trigger `button`, round 3 and bug 1; only that tab's reply is a fixture. It
  then downloaded `butter-diag/round-3/bug-01_05-36-47.json`, and the download completed. The card
  showed the file name with the visually hidden "Saved " prefix and no icon buttons, the save button
  stayed enabled, and the popup kept its height. After about 4 s the card read "Round 3 · 1 bug".
  Open round folder then called `chrome.downloads.show(<that download's id>)`.

After merging the #45 toast (`7216018`) into the branch (`654f1c7`), the same command passed again:
all 9 redesign panels and all 5 dev panels matched at the same heights (largest dev diff 0.001%),
and `dev-capture-qa.mjs` still passed with the toast after every save.

Data: [results.json](results.json). The screenshots come from synthetic popup states and contain no
private data.

## Limits

- Linux headless Chromium only; no Windows or macOS font rendering, and no real toolbar popup frame.
- The shortcut and the live ChatGPT page are #43's harness and #47's live check; this run presses
  only the popup's buttons.
