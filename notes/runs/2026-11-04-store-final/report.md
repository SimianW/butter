> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter for ChatGPT — final Chrome Web Store graphics

Build: 0.1.0-alpha.11. Produced 2026-11-04. Output: `(not archived)`.

## Result

Eight upload-ready store PNGs, the contact sheet, production HTML/CSS/JS, local fonts and licenses, `numbers.json`, and the standalone `render.mjs` entry point are included. The five screenshots follow the approved order: results, drag preview, question rail, typing, privacy and popup.

The approved `mockups/store-assets.html` was read in full before implementation. The paper, dot pattern, melting band, colors, Nunito/Bagel Fat One typography, borders, hard shadows, brand placement, and copy are retained. Every red placeholder is removed. The icon uses the exact approved SVG in a centered 96×96 CSS box with 16px transparent padding.

The final PNGs render at device scale 1 and CSS scale 1, directly into their required output sizes. All except the icon are 8 bits per RGB channel, PNG color type 2 (24-bit RGB without alpha). The icon is RGBA. No Google Fonts fallback was required: the local fonts cover all final display copy.

## Real captures and English-only requirement

The released ZIP was unpacked into a new empty Snap-readable directory and loaded only into locked lab2. The real captures use the first exchange in the `ats12` fixture, an existing English question, “<prompt text>,” and an English answer about <prompt text>. The other fixture regions inspected were predominantly Chinese and were excluded. No chat content was edited or translated.

The sidebar was closed. Captures were cropped to conversation plus composer, excluding the project header and all account/browser controls. Browser zoom was 115% for readable native chat captures; the final production canvas is still exactly 1× CSS pixels. The real hover card reads “1 / 12” and “<prompt text>.” The held seek card reads “Question 1 of 12” and “<prompt text>.” The scrollbar was pressed and dragged using CDP input, then returned to the English first exchange while still held. At the screenshot instant, the extension reported `active: true`; mouse release occurred afterward.

Screenshot 4 uses a static finished English answer and the unsent composer draft “<prompt text>,” as permitted by the brief. There is no claim about typing during streaming in its headline, subline or stat. The draft was cleared immediately after capture and again before restoring the lab. No ChatGPT message was sent. Every browser connection installed route denial for methods other than GET/HEAD/OPTIONS; fetch write guards were also used. No SSE replay was needed. No HTTP 429 was observed.

The actual released popup was opened at its extension URL, set to English, and captured in light mode. Its bilingual footer was cropped off to exclude the Chinese language-selector text. Layout storage is shown switched off, removing the incidental usage counter and its extra numeric readout. The popup was not reconstructed or stubbed.

## Privacy and language inspection of every final PNG

All nine final PNGs were opened and visually inspected individually, including the final contact sheet. The held-preview crop was also inspected enlarged near the composer to ensure the following Chinese exchange was not visible.

| PNG | What is visible | Privacy result | No CJK text |
|---|---|---|---|
| `store-icon-128.png` | Approved butter illustration on transparency; no text. | No personal or account information. | Confirmed |
| `small-promo-440x280.png` | Butter icon, wordmark, FOR CHATGPT, approved English tagline and brand decoration. | No real app or account content. | Confirmed |
| `marquee-promo-1400x560.png` | Approved English brand copy and feature chips, cropped English chat/hover view, and the real English popup. | No sidebar, identity, project/chat title, other chats, plan, URL bar, tabs or browser chrome. | Confirmed |
| `screenshot-1-1280x800.png` | Approved results headline/subline, supplied frozen-page and frame-time figures, exact lab footnote, and a small real English chat/composer capture. | Only harmless English fixture content, generic UI and its nonidentifying timestamp. No excluded account/project/browser information. | Confirmed |
| `screenshot-2-1280x800.png` | Approved drag copy, supplied drag stat, real held seek preview, “Question 1 of 12,” “<prompt text>,” and empty composer. | Only harmless English fixture text and generic controls. No excluded information. | Confirmed |
| `screenshot-3-1280x800.png` | Approved rail copy, real twelve-tick rail, hover card “1 / 12,” “<prompt text>,” English answer and empty composer. | No question titles from other chats; the preview is an English question in this fixture. No excluded information. | Confirmed |
| `screenshot-4-1280x800.png` | Requested new English headline/subline and typing stat; real English answer and harmless unsent English draft. | No identity or project information. Draft cleared afterward. | Confirmed |
| `screenshot-5-1280x800.png` | Approved English privacy checklist and real English popup, version badge and feature switches; bilingual footer excluded. | Popup contains no account data or saved chat text; no storage usage counter. | Confirmed |
| `contact-sheet.png` | Reduced copies of the eight final assets and English filename labels. | Same inspected assets; no additional personal content. | Confirmed |

The DOM preflight separately reports no CJK copy and zero placeholder tags in every asset. Raster chat and popup content were checked visually; the DOM check is not represented as OCR.

## Numbers and reproduction

All four requested performance pairs and labels come directly from the task's v1 figures: five-run medians from a build just before alpha.11 against no extension. The task states alpha.11 is equal or better. No fresh benchmark was performed, and these graphics do not claim that one was performed.

Edit only `numbers.json` to replace benchmark strings, labels and the screenshot 1 footnote. Screenshot 1 bar lengths are derived from the values, so they update too. Then run:

```sh
cd (not archived)
node render.mjs
```

`numbers.json` also records the approved privacy retention number and the provenance of numbers already embedded in authentic screenshots: the fixture timestamp, question ordinal/count, the existing answer's $<prompt text>$ notation, and the real popup version badge. Those embedded screenshot pixels are original content, not editable benchmark claims. The four benchmark metrics are entirely generated from JSON.

The renderer uses Playwright from `(not archived)` and `python3 -I` with Pillow. It loads only local source, waits for `document.fonts.ready` before each capture, decodes all images, captures at CSS 1×, converts PNGs to the required color modes, and builds the contact sheet. Production source and the sanitized capture assets live in `src/`; rerendering needs neither lab2 nor ChatGPT nor a network connection.

## Deviations needed to make the approved mockup production-ready

- The English first exchange in ats12 replaces the sketched math text. The real seek destination is question 1 of 12; no question text or count was fabricated.
- Screenshot 1 adds the requested real chat crop in the open area below the left-hand copy. Its two result cards remain in the approved positions.
- The requested drag stat chip and screenshot 1 footnote were added; screenshot 4 uses the supplied new copy and figure. Screenshot 1 also omits the previous typing phrase to avoid implying typing during streaming.
- Authentic captures preserve their aspect ratio inside the approved window frames, with a narrow white inset rather than stretching text.
- The real popup is taller than the sketch. It is proportionally fitted within each composition, with the bilingual footer cropped and layout storage switched off. The other feature switches remain on. No new performance claim or metric was added.

## Commands and their actual outputs

The principal production and done-check commands are recorded below. Exploratory reads checked the approved HTML, lab README/config, extension code, fonts and fixture content. Two initial native drag attempts pressed the scrollbar arrow rather than the thumb and failed with `Error: Native held drag did not engage`; moving the press to the actual thumb produced the verified held capture. An initial inspection used an obsolete composer selector and timed out; subsequent captures use the visible `.ProseMirror` composer.

### Acquire and load the released extension

```sh
~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 2 --owner butter-store-final
```

```text
2
```

The ZIP extraction used Python's `zipfile.ZipFile.extractall` into a new `tempfile.mkdtemp` under Snap's readable common directory. Actual created directory:

```text
~/snap/chromium/common/butter-store-final-zmieerq7
```

```sh
LAB_ID=2 LAB_EXTENSIONS=~/snap/chromium/common/butter-store-final-zmieerq7/butter ~/.local/share/chatgpt-lab/bin/lab2 restart-browser
```

```text
chromium: stopped
chromium: started (pid 653039)
```

The loaded manifest reported `version: 0.1.0.11` and `version_name: 0.1.0-alpha.11`.

### Capture and clear

```sh
node work/capture-production.mjs
```

Actual successful capture output, with diagnostic timing fields omitted here because this was not a benchmark:

```text
CAPTURE chat 660x540 RGB; crop excludes header
rail 1 / 12
<prompt text>
CAPTURE rail 660x540 RGB; crop excludes header
CAPTURE typing 660x540 RGB; crop excludes header
composer draft cleared
```

The actual held-state JSON begins:

```json
{"active":true,"top":0,"card":"Question 1 of 12\n<prompt text>"}
```

```text
CAPTURE drag 660x540 RGB; crop excludes header
CAPTURE popup 320x590 RGB; bilingual footer excluded
```

The final popup recapture removes the usage counter by using its real layout-storage switch:

```sh
node work/popup-clean.mjs
```

```text
popup.png: 320x556 RGB; real popup, English; layout storage switch off, no usage counter; bilingual footer cropped.
Storage cleared: {"local":{},"session":{}}
```

### Render

```sh
node render.mjs
```

```text
store-icon-128.png: 128x128 RGBA; CSS 1x; local fonts ready
small-promo-440x280.png: 440x280 RGB; CSS 1x; local fonts ready
marquee-promo-1400x560.png: 1400x560 RGB; CSS 1x; local fonts ready
screenshot-1-1280x800.png: 1280x800 RGB; CSS 1x; local fonts ready
screenshot-2-1280x800.png: 1280x800 RGB; CSS 1x; local fonts ready
screenshot-3-1280x800.png: 1280x800 RGB; CSS 1x; local fonts ready
screenshot-4-1280x800.png: 1280x800 RGB; CSS 1x; local fonts ready
screenshot-5-1280x800.png: 1280x800 RGB; CSS 1x; local fonts ready
contact-sheet.png: 1440x1840 RGB; all 8 assets included
Rendered 8 store assets and contact-sheet.png from src/ and numbers.json.
```

### Required size and mode check

```sh
python3 -I src/verify.py
```

```text
store-icon-128.png: 128x128 RGBA; 8-bit/channel; PNG color type 6; alpha allowed
small-promo-440x280.png: 440x280 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
marquee-promo-1400x560.png: 1400x560 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
screenshot-1-1280x800.png: 1280x800 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
screenshot-2-1280x800.png: 1280x800 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
screenshot-3-1280x800.png: 1280x800 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
screenshot-4-1280x800.png: 1280x800 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
screenshot-5-1280x800.png: 1280x800 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
contact-sheet.png: 1440x1840 RGB; 8-bit/channel; PNG color type 2; 24-bit, no alpha
Icon: 96x96 SVG box centered at (16,16); every pixel in outer 16px padding is transparent.
contact-sheet.png exists: True
PASS: all 9 PNG dimensions, modes, channel depths, and icon padding.
```

### Source-language and placeholder check

```sh
node src/check-source.mjs
```

```text
icon: CJK text=false; red placeholder tags=0
small: CJK text=false; red placeholder tags=0
marquee: CJK text=false; red placeholder tags=0
s1: CJK text=false; red placeholder tags=0
s2: CJK text=false; red placeholder tags=0
s3: CJK text=false; red placeholder tags=0
s4: CJK text=false; red placeholder tags=0
s5: CJK text=false; red placeholder tags=0
```

### Identical rerender

The SHA-256 baseline was captured before a second `node render.mjs`; a `python3 -I` comparison of every resulting PNG against that baseline printed:

```text
contact-sheet.png: IDENTICAL 360380fdcf32b48903f4e137dca716e011a7eeb38894da142ec6fd13534b0342
marquee-promo-1400x560.png: IDENTICAL 4a908ce747afb86441e32bc406078912eb6e070a7816d6f01efa69a2ddc35c43
screenshot-1-1280x800.png: IDENTICAL 5906538eec282bfebb74d31cf116b0456384c5647dcb3c34f9277e3347b3e186
screenshot-2-1280x800.png: IDENTICAL 0728df5a14b0056cf3f1f82274483272218e5c8f85500c7941c29b8194df8996
screenshot-3-1280x800.png: IDENTICAL 4377b7b02747835335a2b05e87bd718b4a23da1f047709c23c48eaa06834858c
screenshot-4-1280x800.png: IDENTICAL 256a9acf72cc6c6a78ea752962f1a8bcfc6df91d57384793d2d7d25d572358dc
screenshot-5-1280x800.png: IDENTICAL 0e4537f78643053a37d261708850aa2b670c929ccdfcb50daa282a69a8a4140f
small-promo-440x280.png: IDENTICAL 2ac5034929bc09f1dc6da2563b959cc85e9586f14c0d952321a4c909805f79f2
store-icon-128.png: IDENTICAL 1797e2e9c62e7b8ae29a91862ed1f082aa1f6824d2cc4e5431e41988026d663a
PASS: byte-identical re-render for all 9 PNGs.
```

### Restore and release lab2

```sh
~/.local/share/chatgpt-lab/bin/lab-restore --lab 2 --owner butter-store-final
```

```text
restore lab 2: restarting browser (now {"pid":653039,"extensions":["~/snap/chromium/common/butter-store-final-zmieerq7/butter"],"flags":[]}, cdp up, want {"extensions":[],"flags":[]})
chromium: stopped
chromium: started (pid 680477)
restored {"lab":2,"restarted":true,"url":"<chat>","composer":"","pages":["<chat>"],"browser":{"pid":680477,"extensions":[],"flags":[]},"at":"2026-11-04T22:42:49.788Z","ok":true}
```

```sh
~/.local/share/chatgpt-lab/bin/lab-lock release --lab 2 --owner butter-store-final
```

```text
{"lab": 2, "lab_released": true, "perf_released": false}
```

```sh
~/.local/share/chatgpt-lab/bin/lab-lock status
```

```text
{"lab": 1, "held": true, "owner": "butter-final-bench-683969-1793832256082507510"}
{"lab": 2, "held": false, "owner": null}
{"lab": "perf", "held": true, "owner": "butter-final-bench-683969-1793832256082507510"}
```

Lab2 has no extension, is at its project home, has an empty composer, and is unlocked. Lab1 and the perf lock remain owned by the separate benchmark; neither was acquired, changed or released here.

Raw screenshots and fixture responses stayed under `/tmp` and are excluded from the final bundle. The sanitized source images are the only real app captures packaged for reproduction. Existing repository changes were not edited.

## Final package check

Raw capture work and exploratory scripts were moved out of the delivery directory to `(not archived)` after production. Their historical command paths above reflect where they ran. They are not part of the ZIP.

A Python `zipfile` integrity and contents check printed:

```text
butter-store-final.zip: 31 files; integrity OK; raw captures excluded
Raw capture work moved outside delivery directory to (not archived)
Final directory: (not archived)
```

The final bundle includes every deliverable, sanitized source captures, fonts and licenses, and the `src/verify.py` and `src/check-source.mjs` verification commands. The upload images are the eight individually named store PNGs; the contact sheet is for review.
