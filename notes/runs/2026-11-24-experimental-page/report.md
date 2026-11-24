# Popup Experimental page (#158): before and after recordings

**Question:** what does a new install see in the popup before and after #158, with the same steps on
both builds?

**Builds:** before is `main` at `b2df865` (0.1.0-alpha.22); after is `feat/experimental-page` at
`7c8403d`. Both are unpacked from the repo, each in a fresh Chromium profile (a real install), light
theme, English, 360 px wide.

**Seam:** fixture harness, its own headless Chromium with Playwright's `recordVideo`; no ChatGPT
page and no network. `record.mjs` here makes both recordings:
`node record.mjs <repo>/extension before|after` (output to `OUT`, default `/tmp/butter-rec-158`),
then each video is trimmed of its blank lead-in and converted with ffmpeg
(`fps=15`, `palettegen=stats_mode=diff`, `paletteuse=dither=bayer`) at the popup's native width.

## Steps and result

| | Steps | What the DOM said |
|---|---|---|
| [before.gif](before.gif) (4.9 s) | The popup opens on its one page of six rows; click the Question rail switch off, then on again. | `rows=6 rail=true`, after the clicks `false`, then `true` |
| [after.gif](after.gif) (6.5 s) | The popup opens on the main page (three rows and the dashed Experimental row, no count); click the row; the Experimental page slides in with all three off and the privacy note; switch Question rail on; click the title to go back; the row reads "1 on". | `main switches=4 count=""`, `page=experimental rail=false`, `rail=true`, `page=main count="1 on"` |

No page errors on either build. A red dot marks the pointer.

## Privacy

Both GIFs show only the extension popup: no URL bar, account, chat title or chat text. Checked on
nine extracted frames and a contact sheet every 0.5 s of each video.
