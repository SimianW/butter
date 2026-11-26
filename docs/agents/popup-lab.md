# Popup lab checks

The popup's fixture QA, its mockup comparisons and its probe and live scripts. Read this before
you change or verify the popup; [development.md](../development.md) has the other test commands.

- Popup in the lab browser: `node lab/harness/popup-qa.mjs` uses an isolated headless Chromium to capture all 48 states (main page and Experimental page) in both themes at 360 px under `/tmp/butter-popup-build/` (`BUTTER_SHOTS` overrides; `BUTTER_SCALE=2` shoots at device scale 2; set `BUTTER_MOCKUP` to also capture approved references, and `BUTTER_CASES=13,16` to run only those states). Its fresh profile is a real install, so it first checks that the rail and Bookmarks start on and Smoother scrolling and layouts off, with no card on a fixture ChatGPT page; it also checks the Experimental page's swap, focus and reduced motion, and "Needs Smoother scrolling" on the layouts row and its live switch (`lab/harness/popup/experimental.mjs`). Every run copies each mockup panel's state shot to `<shots>/panels/<id>.png`; `BUTTER_SCALE=2 BUTTER_EXPERIMENTAL_MOCKUP=mockups/popup-rail-bookmarks-main.html` also compares them with that mockup's after screenshots: each must match its state's height, and the pixel diff is reported only (the screenshots are lossy WebP from another headless renderer, so every text line differs at its glyph edges). Every store state must be exactly 509 px with nothing overflowing it, and the footer's top must not move between the pages, mid-swap, or when the privacy note goes.
  `BUTTER_REDESIGN_MOCKUP=<path>` compares the built states with the #35 redesign mockup
  (`gh issue artifact download 35 1 -R SimianW/butter`), and `BUTTER_REDESIGN_SIDE=before|after`
  (default `after`) picks its panels: default, paused, rail fault, layouts pending, clear confirm,
  branch off, branch fault, dark and Chinese, where that side has them. Each panel must match its
  state's height and differ in under 0.1% of pixels (by more than 24 in a channel), with the
  version label and the storage rows' saved lines masked; the run prints every panel's height and diff ratio.
  That mockup draws the single-page popup from before #158, so its panels no longer match: the
  comparison is historical and report-only, and never fails the run. `BUTTER_EXPERIMENTAL_MOCKUP`
  is the current visual check, and fails the run if a compared panel differs.
  The same run then builds the dev zip (`BUTTER_DEV_ZIP` names an existing one; `BUTTER_DEV=0` skips
  it), loads it unpacked in its own profile with the save-bug binding seeded, and captures the dev
  states (recording, just saved, not on a ChatGPT tab, the tallest state, Chinese recording and
  tallest) in both themes, each exactly 509 px with nothing overflowing and the dev row unclipped,
  and one with a fault, whose 541 px of content scroll inside the 509 px popup. It also drives the card:
  New round survives a reload, Open round folder, and the save button through the real worker.
  `BUTTER_DEV_MOCKUP=<path>` (`gh issue artifact download 32 1 -R SimianW/butter`) compares the
  English and dark dev states with that mockup's `dev-*-after` panels the same way; it too draws
  the pre-#158 popup, so it is historical and report-only.
  `popup-probes.mjs` checks status failures with a fixture, and `popup-live.mjs` checks live switches
  in an existing chat. The probe/live scripts need `extension/` loaded in the shared lab browser first (see `lab/README.md`); acquire its lock before using them. The QA script starts its own browser.
- Popup storage rows (#108): `node lab/harness/popup-bookmarks-shots.mjs` shows the page of the row each panel is about (Bookmarks on the main page, layouts on the Experimental page, with Smoother scrolling on) and shoots the real popup at 360 px for each panel of `mockups/popup-bookmarks.html` (plus paused and needs-rail), seeding synthetic bookmarks and layouts through the worker, and records each state's height in English and Chinese; `MOCKUP=mockups/popup-bookmarks.html` compares every box with the mockup's (1 px tolerance), but that #108 mockup draws the rows on the old single page, so since #158 the comparison fails; check the pages against the current popup mockup with `popup-qa.mjs` instead. `OUT=<dir>` overrides the default `notes/runs/2026-11-13-popup-bookmarks/` (set it, or the run overwrites that run's committed shots).
