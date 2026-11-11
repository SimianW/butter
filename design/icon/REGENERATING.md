# Butter icon

The approved “A 改” vector drawings are the sources. `butter-icon-final.svg` supplies 48 and
128 px. The toolbar sizes drop the floor shadow and stretch the drawing to fill the square, so the
wide block isn't dwarfed by Chrome's square toolbar icons: `butter-icon-toolbar.svg` supplies
32 px (the toolbar on high-DPI screens), and `butter-icon-final-16.svg` simplifies the drawing and
adds the cream halo at 16 px.
The popup inlines the main drawing at 54 × 48 px.

Regenerate the transparent PNGs from the repository root:

```sh
npm ci
npx playwright install chromium
node design/icon/regenerate.mjs
```

This uses a separate headless Chromium, not the shared lab browser. Keep the viewport and
output device scale at 1 so the assets have exactly the manifest's declared dimensions.

Popup fonts are local OFL files under `extension/popup/fonts/`. Bagel Fat One is subset to
“Butter”; Nunito is a Latin subset with variable weights, used at 500–900. Chinese uses system fonts.
No popup asset loads a remote URL. Upstream sources: Google Fonts `ofl/bagelfatone` and
`ofl/nunito`; their OFL licenses accompany the bundled fonts.
