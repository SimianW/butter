# Popup defaults: the rail and Bookmarks back on the main page, Smoother scrolling experimental

**Question:** what does a new install see in the popup before (the last release) and after this
change, with the same steps on both builds?

**Builds:** before is `v0.1.0-alpha.22` (a temporary worktree of the tag, removed afterwards);
after is `feat/implement-171` with this change in the working tree (on `4d6f8c2`). Both are
unpacked from the repo, each in a fresh Chromium profile (a real install), light theme, English,
360 px wide, at the popup's real size: before 360×594 (its content height, 593.55 px), after
360×509 (the fixed height). Playwright records video at even sizes, so the after video and GIF are
360×508: the bottom 1 px row, the paper under the footer's margin, is not in them.

**Seam:** fixture harness, its own headless Chromium with Playwright's `recordVideo`; no ChatGPT
page and no network. `record.mjs` here (adapted from
[2026-11-24-experimental-page](../2026-11-24-experimental-page/record.mjs)) makes both recordings:
`node record.mjs <extensionDir> before|after` without `H=` prints the popup's heights, then with
`H=<px>` records at that height (to `OUT`, default `/tmp/butter-rec-defaults`). Each video is
trimmed of its blank lead-in and converted with ffmpeg at the popup's native width:

```sh
H=594 node record.mjs <alpha22 worktree>/extension before
H=509 node record.mjs <repo>/extension after
ffmpeg -ss 2.2 -i video-before/<page>.webm -vf "fps=15,split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer" before.gif
ffmpeg -ss 0.2 -i video-after/<page>.webm  -vf "<same>" after.gif
```

## Steps and result

The steps: open the popup on a new install, show the main page, open Experimental, switch Smoother
scrolling on, switch Remember long-chat layouts on, go back. The last release has one page and
Smoother scrolling already on, so there the same steps are: show the page, point at Smoother
scrolling, switch layouts on.

| | ffprobe | What the DOM said |
|---|---|---|
| [before.gif](before.gif) | 360×594, 5.74 s, 0.81 MB | `rows: Smoother streaming \| Smoother scrolling \| Question rail \| Ask in branch \| Bookmarks \| Remember long-chat layouts; scrolling=true layouts=false`, then `layouts after click=true` |
| [after.gif](after.gif) | 360×508, 8.54 s, 2.01 MB | `main rows: Smoother streaming \| Question rail \| Ask in branch \| Bookmarks; count=""`; `page=experimental rows: Smoother scrolling \| Remember long-chat layouts; scrolling=false layouts=false`; `scrolling after click=true`; `layouts after click=true`; `page=main count="2 on"` |

No page errors on either build; the after document never grew past 509 px. A red dot marks the
pointer.

## Popup fixture harness

`BUTTER_SCALE=2 BUTTER_SHOTS=<dir> BUTTER_EXPERIMENTAL_MOCKUP=mockups/popup-rail-bookmarks-main.html node lab/harness/popup-qa.mjs`:
PASS. 46 store states × light/dark and 13 dev states; every store state exactly 509 px with nothing
overflowing; the dev build's one-fault state is 541 px of content and scrolls inside the 509 px
popup; a fresh install stores defaults version 2 with the rail and Bookmarks on and Smoother
scrolling and layouts off; "Needs Smoother scrolling" shows (en and zh) wherever layouts are on and
Smoother scrolling off, and switching Smoother scrolling on brings back "14 chats, about 3.4 MB" and
Clear live. All 8 mockup panels match their state's height (509/509 px). The pixel diff against the
mockup's screenshots (2.2–4.2%) is report-only: they are lossy WebP taken by headless-shell
Chromium, and only glyph edges differ; the same build shot by the prototype's own script differs
from them by 1.1–1.5%, all glyph-edge compression speckle.

## Privacy

Both GIFs show only the extension popup: no URL bar, account, chat title or chat text. Checked on a
contact sheet of each GIF at one frame per second.
