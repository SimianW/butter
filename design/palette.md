# Butter's palette

The custom properties at the top of `extension/popup/popup.css` are the implementation of record.
The consent card (`extension/consent/layout-consent.js`) copies the tokens it uses from them. If
this page and the stylesheet disagree, the stylesheet wins. Fix the page.

## Which surface uses which palette

- **Butter's palette:** the popup and the "remember layouts" consent card on the ChatGPT page.
- **ChatGPT's colours:** the question rail and Ask in branch. They sit inside ChatGPT's page, so
  they take its theme variables, not these tokens.

## Tokens

| Token            | Light                   | Dark                     | Used for                                                                                |
| ---------------- | ----------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| `--paper`        | `#f6f1e3`               | `#1d1914`                | popup background, under the noise texture                                               |
| `--card`         | `#fffdf6`               | `#26211b`                | features and layouts cards, paused master card, consent card                            |
| `--ink`          | `#1b170f`               | `#ece3cf`                | titles, footer links, the clear question                                                |
| `--ink-2`        | `#5c5240`               | `#b3a78e`                | descriptions, icons, consent body and No thanks                                         |
| `--ink-3`        | `#776c58`               | `#948870`                | muted text: version label, paused rows, paused status                                   |
| `--line`         | `rgb(27 23 15 / .16)`   | `rgb(236 227 207 / .14)` | card borders, small buttons, segmented control, consent card border                     |
| `--hair`         | `rgb(27 23 15 / .10)`   | `rgb(236 227 207 / .09)` | dividers between rows and above the layouts card's second line                          |
| `--edge`         | `#1b170f`               | `#4f4638`                | master card outline and hard shadow, switch on track, selected language segment (light) |
| `--butter`       | `#fbe07a`               | `#e3c766`                | master card on, switch knob on, selected segment text (light), Sounds good              |
| `--butter-deep`  | `#f2c23a`               | `#c9a53f`                | focus ring, link underlines, storage bar fill, dark-theme switch on track               |
| `--butter-light` | `#fff4c2`               | `#2f2816`                | the consent note band, and nothing else                                                 |
| `--on-butter-2`  | `#4d3d10`               | `#3f3312`                | master card status line while on                                                        |
| `--warn`         | `#b8321a`               | `#f0917a`                | fault text and icon, destructive Clear                                                  |
| `--warn-bg`      | `#ffe3d8`               | `#3d241b`                | destructive Clear background                                                            |
| `--track`        | `#e3dac3`               | `#3a3328`                | switch off track, storage bar, No thanks hover                                          |
| `--knob`         | `#fffdf6`               | `#1d1914`                | switch knob off (`--paper` is the dark-theme knob on)                                   |
| `--knob-shadow`  | `rgb(0 0 0 / .22)`      | `rgb(0 0 0 / .22)`       | the knob's 1 px shadow                                                                  |
| `--highlight`    | `rgb(255 255 255 / .7)` | `rgb(255 255 255 / .35)` | the master card's highlight bar                                                         |

Dark ink on butter: text on a butter surface is `#1b170f` in both themes. This is the only literal
colour in state rules.

## Type

- Nunito for all text, at weights 500, 700 and 800. The fault text and the master status line use
  600, as #35 specifies.
- Bagel Fat One for the wordmark only.
- Five sizes: 26 px wordmark, 15 px master title, 13 px row titles, 11 px language segments, 12 px
  everything else. Nothing is set below 11 px.

## Contrast

WCAG 2 contrast ratios of the text pairs the product uses, computed from the token values above.
Semi-transparent tokens are composited on their background first. All text is under 18.66 px, so
every pair needs 4.5:1 for AA. The selected language segment is butter on edge in light
theme and dark ink on butter in dark theme.

| Text on background            | Size and weight | Light | Dark  | AA   |
| ----------------------------- | --------------- | ----- | ----- | ---- |
| `--ink` on `--paper`          | 12 px / 700     | 15.82 | 13.70 | pass |
| `--ink` on `--card`           | 13 px / 700     | 17.54 | 12.51 | pass |
| `--ink-2` on `--paper`        | 12 px / 700     | 6.80  | 7.35  | pass |
| `--ink-2` on `--card`         | 12 px / 500     | 7.54  | 6.71  | pass |
| `--ink-3` on `--paper`        | 12 px / 700     | 4.57  | 5.01  | pass |
| `--ink-3` on `--card`         | 12 px / 500     | 5.07  | 4.57  | pass |
| `--ink-2` on `--butter-light` | 12 px / 500     | 6.93  | 6.15  | pass |
| `--warn` on `--card`          | 12 px / 600     | 5.88  | 6.87  | pass |
| `--warn` on `--warn-bg`       | 12 px / 700     | 4.91  | 6.16  | pass |
| dark ink on `--butter`        | 11–15 px / 700+ | 13.64 | 10.74 | pass |
| `--butter` on `--edge`        | 11 px / 700     | 13.64 | —     | pass |
| `--on-butter-2` on `--butter` | 12 px / 600     | 8.06  | 7.46  | pass |
| `--ink-2` on `--track`        | 12 px / 700     | 5.51  | 5.25  | pass |

The muted ink has the least headroom (4.57 in two places). Darken it before reusing it on any
surface not listed here.
