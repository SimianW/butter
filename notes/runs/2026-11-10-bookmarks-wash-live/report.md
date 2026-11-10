# Landing wash on live ChatGPT (#74) — 2026-11-10

**PASS: 42/42 live checks, light and dark theme.** On real ChatGPT markup the wash sits on the
bookmarked lines (0 px off), the text keeps its colour under it, there is no bubble flash, and
when the chat scrolls during the hold the boxes follow their text while ChatGPT's header and
composer show no butter. The drawing route of #73 (Butter's own fixed shadow-root layer,
multiplied in light theme, lightened in dark) holds up live, so the CSS Custom Highlight API
fallback was not needed.

One product bug was found and fixed during the run (see [Findings](#findings)): the wash was cut
52 px below the top of the chat, because it assumed ChatGPT's header overlaps the chat's
scroller. In current ChatGPT the scroller starts below the header.

## Build and method

- Branch `t3/69-blockwash-74`. The extension tested is the branch's `extension/` at `fd5c90d`
  (unchanged since); the script is `lab/harness/bookmarks-live.mjs` at `4268bc1`, `MODE=wash`.
  Source and copied extension tree SHA-256 both
  `388fe2c5090210ea698d8bfe365183c0d36231378a0eecf0c04cf236d8d4db6d`.
- Linux lab 2, Chromium `156.0.8078.47`, window 1600 × 1000. Run UTC `2026-11-10T11:55:02Z` to
  `11:57:16Z`. Lab lock taken with `--wait`, lab restored to its defaults and lock released
  (`summary.json` → `cleanup`). No perf lock: this is a functional check, not a timing run.
- Fixture `demo-en12` (lab 2): the only fixture whose answers hold both long paragraphs and a
  table. Send guard on: 0 send attempts, 110 non-GET requests to chatgpt.com blocked. No prompt
  was typed or sent; no ChatGPT setting was changed.
- A fresh unpacked install with layout consent declined and the first-use notice acknowledged.
  The bookmarks were made with Butter's hover button (paragraph, table, and a 110-character
  selection inside another paragraph of the same answer), and deleted afterwards (3 → 0).
- Each case is a jump from the question's tick card, started about 2500 px below the target.
- Dark theme: ChatGPT now draws its theme from `<html data-theme>`, set from the account's
  appearance setting on its server; both lab accounts are in light theme. The dark pass sets
  `data-theme="dark"` on the page, ChatGPT's own dark styles follow (body `#000`, computed
  `color-scheme: dark`), and Butter picks it up through `color-scheme`. A reload puts it back.

## What each case checks

| Check | How |
|---|---|
| On its own lines | The wash's boxes against the bookmarked text's line rectangles measured in the page (2 px above and below); the table's one box against the table's rectangle, 3 px around. Within 1 px. |
| Layer | `mix-blend-mode` multiply (light) or lighten (dark), the wash colour, `pointer-events: none`; no `data-butter-flash` on any frame of the trip. |
| Text keeps its colour | The darkest (light) or lightest (dark) pixel inside the first box during the hold, against the same pixels after the wash has gone, at the same scroll position. Within 16 per channel. |
| Follows the text | The chat scrolled during the hold (+74, −680 and +80 px), then the boxes compared with the text's lines again. |
| Header and composer | During the hold the paragraph's first line is scrolled 10 px past the top edge (the header), the selection's last line 10 px behind the composer. The 24 px band of the header or composer over the washed columns, during and after the wash: share of pixels that differ by more than 24 in a channel. Also, the wash reaches that edge (clip within 1 px), so no visible text goes unwashed. |
| Gone | The layer is removed after the hold and fade. |

## Results

Numbers from [`summary.json`](summary.json).

| Theme | Case | Lines (boxes / expected, max px off) | Text colour during → after | Scroll during hold | Edge band differ | Gone |
|---|---|---|---|---|---|---|
| light | paragraph | 2 / 2, 0 | `13,12,9` → `13,13,13` | +74 px, boxes follow | header: 0 | yes |
| light | selection | 2 / 2, 0 | `13,12,9` → `13,13,13` | −680 px, boxes follow | composer: 0 | yes |
| light | table | 1 / 1, 0 | `13,12,9` → `13,13,13` | +80 px, box follows | — | yes |
| dark | paragraph | 2 / 2, 0 | `237,237,237` → `237,237,237` | +74 px, boxes follow | header: 0 | yes |
| dark | selection | 2 / 2, 0 | `237,237,237` → `237,237,237` | −680 px, boxes follow | composer: 0 | yes |
| dark | table | 1 / 1, 0 | `237,237,237` → `237,237,237` | +80 px, box follows | — | yes |

Blend multiply in light, lighten in dark; no bubble flash on any of the six trips. The clip ran
from the scroller's top (52 px) to the composer's top (836 px) in every case.

## Findings

1. **Fixed: the wash was cut 52 px below the chat's top.** `bookmarks/content.js` clipped the
   wash at the scroller's top plus 52 px, the header height `rail/rail.js` assumes overlaps the
   scroller. On both labs' chats (a project chat on lab 2 and an ordinary one on lab 1, probed
   read-only) the scroller starts at 52 px, below the header. The first run measured the clip at
   104 px: the top 52 px of visible chat would never be washed. The clip now finds the fixed or
   sticky box drawn over the scroller's top edge, else uses the scroller's top (and keeps the
   old allowance only when it finds neither). A fixture check (`ONLY=wash`, "under a header that
   the scroller starts below") failed before the fix and passes after; this run confirms it live.
2. **Not covered live: a code block.** No fixture answer holds one: 0 of 15 answers walked on
   lab 1's `math12`, and 0 of 45 across lab 2's `math12`, `ats12`, `math9` and `demo-en12`. The
   table stands for the blocks the wash covers whole on real markup; code blocks are covered in
   the fixture harness in both answer markups (ChatGPT's `<pre>` panel and the code widget's
   `[data-code-block]` surface). A live code-block check needs a fixture chat that has one.
3. **For the rail's owner (not changed here):** `rail/rail.js` makes the same 52 px header
   allowance when it centres the rail and places a landing. With the scroller starting below the
   header, that allowance is counted twice. Worth a look in its own ticket.
4. The earlier `MODE` of this script (the #57 matrix) still uses the question segments that #71
   removed; it is not run here and needs #72's changes before it runs again.

## Earlier attempts in this run

- On lab 1 `math12`, no mounted answer held two long paragraphs and a table (its answers are
  short); the target search then moved to lab 2's `demo-en12`.
- The first lab 2 attempts found finding 1, then stopped on two harness problems: a second tab
  used for pixel statistics put the chat tab in the background (screenshots hung), fixed by
  decoding the PNGs in Node; and `localStorage.theme` does not switch ChatGPT's theme any more,
  fixed by `data-theme` as above.

## Reproduce

On the lab host, from a copy of the branch (no `.git` needed):

```sh
MODE=wash LAB_FIXTURE=demo-en12 EXT=<copy>/extension OUT=<copy>/out TESTED_HEAD=<sha> \
  node lab/harness/bookmarks-live.mjs
```

It takes the lab lock itself (`lib/lab.mjs`), restores and releases it.
