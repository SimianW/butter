# Ask in branch: the line takes the disclaimer's row

Question: does the ready/unsure line take the row of ChatGPT's "ChatGPT can make mistakes" disclaimer
(approved option A), covering it while shown and giving it back when it goes?

Build: branch `t3/branch-line-disclaimer-row` on 0.1.0-alpha.16 (a8d111a). Fixture only: `node lab/harness/branch-qa.mjs`
over `lab/harness/branch-fixture.mjs` in its own headless Chromium; no ChatGPT requests, no live lab.

## Result

All harness checks pass. At 1280 and 390 px, light and dark, for both lines:

- the line's box equals the disclaimer's (within 1 px); a hit test at the disclaimer's centre lands on
  Butter's line, whose background equals the page's (`rgb(255, 255, 255)` light, `rgb(33, 33, 33)` dark);
- 12/16 px type copied from the disclaimer, `--fg2` text, `--err` unsure icon, 14 px icons, 6 px gap,
  20 px ×; icon, text and × centred as one group (within 1 px); one row, full text in `title`;
- × removes the line and the hit test lands on the disclaimer again;
- unsure (`senddelay=60000`: Send stays disabled past Butter's 3 s wait) sends nothing.

The ready text is cut with an ellipsis at 390 px (as the mockup expects); the unsure text fits.
With `nodisclaimer=1` the line keeps its own row 8 px above the composer, at 13.5 px.

## Screenshots

| State | Light | Dark |
|---|---|---|
| Ready, 1280 px | [png](screenshots/line-ready-1280-light.png) | [png](screenshots/line-ready-1280-dark.png) |
| Ready, 390 px | [png](screenshots/line-ready-390-light.png) | [png](screenshots/line-ready-390-dark.png) |
| Unsure, 1280 px | [png](screenshots/line-unsure-1280-light.png) | [png](screenshots/line-unsure-1280-dark.png) |
| Unsure, 390 px | [png](screenshots/line-unsure-390-light.png) | [png](screenshots/line-unsure-390-dark.png) |
| After ×, 1280 / 390 px | | [1280](screenshots/line-closed-1280-dark.png), [390](screenshots/line-closed-390-dark.png) |
| Unsure, Chinese, 1280 px | [png](screenshots/line-unsure-1280-light-zh.png) | |
| No disclaimer (fallback), 1280 px | [png](screenshots/line-ready-nodisclaimer-1280-light.png) | |

Limits: fixture only. The live disclaimer's box, background and type were not re-measured on
chatgpt.com in this run.
