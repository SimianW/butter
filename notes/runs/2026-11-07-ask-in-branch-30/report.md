# Ask in branch #30: popup switch and status (fixture)

Question: does the popup's new Ask in branch row match the approved mockup in every state, stay under
Chrome's 600 px popup cap, and apply its setting live?

Build: branch `t3/aib-30` on `t3/ask-in-branch` (manifest 0.1.0-alpha.14, no version bump). Fixture
only: isolated headless Chromium with the unpacked extension; no ChatGPT requests, no account data.

## Commands

```
npm ci --prefix lab/harness
BUTTER_BRANCH_MOCKUP=<notes>/butter-ask-in-branch/popup-mockup-approved.html node lab/harness/popup-qa.mjs
SHOTS=/tmp/aib30-branch-qa node lab/harness/branch-qa.mjs
```

## Result

`popup-qa.mjs` passes: 36 screenshots (18 states × light/dark) at 360 px, six switches in every
state, the branch switch writes only `opts.branch`, and all 10 panels of the approved mockup match.

Each mockup panel is rendered from its own `srcdoc` at the page origin and compared with the built
popup. Heights match exactly. Pixels outside the usage line differ by at most 0.04 % (antialiasing
in the header). The usage line is masked: the harness's seeded layout rows no longer pass the
worker's row validation, so the built popup shows "0 chats · about 0 KB" where the mockup's stub
shows 12 chats · 8.4 MB. This predates #30 and affects every popup-qa state.

| State | Built (px) | Mockup (px) | Pixel diff outside usage |
|---|---|---|---|
| EN on, light | 577 | 577 | 0.039 % |
| EN off, light | 577 | 577 | 0.039 % |
| EN failed, light | 663 | 663 | 0.034 % |
| ZH on, light | 563 | 563 | 0.021 % |
| ZH off, light | 563 | 563 | 0.021 % |
| ZH failed, light | 632 | 632 | 0.019 % |
| EN on, dark | 577 | 577 | 0.030 % |
| EN failed, dark | 663 | 663 | 0.026 % |
| ZH on, dark | 563 | 563 | 0.013 % |
| ZH failed, dark | 632 | 632 | 0.012 % |

EN off dark and ZH off dark have no mockup panel; their built heights are 577 and 563 px.

Normal states are all at or under 600 px: EN 577, ZH 563 (both themes, on and off). The mockup's
own description quotes 580 px for ZH; rendered on this machine the mockup panel is 563 px, the same
as the build, so the difference is the CJK fallback font of the machine that drew the mockup. Failed
states run over 600 px and scroll, as the mockup states; `*-viewport.png` and `*-bottom.png` show the
600 px view and its scrolled bottom.

Live setting: `branch-qa.mjs` now also selects text, waits for the Ask in branch button, turns the
setting off, and checks the button leaves without a reload or new selection. It passes. The branch
content script already handled this (its per-frame follow loop and its `butter-settings` listener
both check `data-butter-off`), so `extension/branch/` is unchanged.

## Files

- `screenshots/13…18-*.png`: built states (EN/ZH × on/off/failed × light/dark), plus 600 px
  viewport and bottom views of the failed states.
- `screenshots/reference-*.png`: the matching approved-mockup panels.
- `screenshots/01-normal-*.png`, `09-en-memory-off-light.png`: earlier popup states at the new width.
- `heights.json`: every state's height and each mockup comparison.
