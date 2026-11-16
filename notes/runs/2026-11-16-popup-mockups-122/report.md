# Popup mockups #35 and #32 refreshed to the popup after #108 (#122)

**Question:** `lab/harness/popup-qa.mjs` fails against the #35 (redesign) and #32 (dev card) mockups on main. Is each differing panel a stale mockup or a popup regression?

**Build:** main `620cfbb` (0.1.0-alpha.21); no extension change.

## Diagnosis (before)

`BUTTER_REDESIGN_MOCKUP=<#35> BUTTER_DEV_MOCKUP=<#32> xvfb-run -a node lab/harness/popup-qa.mjs` exits 1 ([before.txt](before.txt)): 9/9 redesign and 5/5 dev panels differ.

| Panels | Built / mockup | Pixels differing | Cause |
|---|---|---|---|
| default, paused, clear-confirm, branch-off, dark, zh | 523 / 522 px | 3.9–5.0% | stale mockup |
| rail-fault, branch-fault | 556 / 554 px | 4.4% | stale mockup |
| layouts-pending | 594 / 551 px | 21.3% | stale mockup |
| dev-default, dev-saved, dev-away, dev-dark | 569 / 568 px | 4.4–5.1% | stale mockup |
| dev-worst | 640 / 597 px | 22.3% | stale mockup |

Every difference is the #108 popup (PR #110, b8a558e, 99a65ac; CHANGELOG `[Unreleased]`): one card of six rows with a new Bookmarks row; the layouts card, usage bar and Clear pill are gone and the layouts row shows what is saved with a text Clear. The Bookmarks row (about 53 px) nearly cancels the removed card gap and usage line, hence 1–2 px; with the consent note showing nothing cancels it, hence 43 px. The dev build's 640 px tallest state is over the 600 px cap by an accepted, documented exception (`popup-qa.mjs`, since #108). No popup regression.

## Fix

The `after` panels of #35 (9 compared, plus the 2 consent `after` panels) and the 5 `dev-*-after` panels of #32 were redrawn from the built popup's markup and current `popup.css`, and their notes updated; `before`, `store-*-before` and toast panels are byte-identical. Each page states the refresh date. Both artifacts were replaced with `gh issue artifact edit` (earlier versions stay in the artifact history); a fresh download of each is byte-identical to the checked file.

## After

Same command with the refreshed artifacts exits 0, no FAIL or DIFF ([after.txt](after.txt)): 9/9 redesign panels match (0.000–0.004%), 5/5 dev panels match (0.000–0.001%), heights equal.
