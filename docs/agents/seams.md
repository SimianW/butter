# Test seams

The agreed seams for this repo. The `tdd`, `to-spec`, `implement` and `diagnosing-bugs` skills test
at these without asking the user; propose a new seam to the user only when none of these reaches
the behaviour.

In order of preference:

1. Unit test: `test/`, run with `npm test`. Catches logic that runs without a page: pure
   models, modules over the fake DOM in `test/helpers/`, and the page reader's contract over the
   HTML fixtures in `test/fixtures/page/`. Misses the loaded extension in a real browser and
   ChatGPT's live markup.
2. Fixture harness: `lab/harness/`, run with `node lab/harness/<script>.mjs`. Real extension code
   over a synthetic page, with no ChatGPT requests: `branch-qa.mjs` and `bookmarks-qa.mjs` start
   their own Chromium; `nav-earlier.mjs` and `nav-takeovers.mjs` run in the lab browser. Catches
   layout, the wiring between scripts and shortcuts. Misses ChatGPT's live markup, and CI does not
   run it.
3. Live lab script: `lab/harness/`, run under the lab lock as [lab/README.md](../../lab/README.md)
   says (like `bookmarks-live.mjs`, or `rail-jump-live.mjs` for rail jumps: 52 tick clicks on two
   math fixtures from named start states, exit 1 on a failed or visibly detoured jump, when no
   end-pull control was pulled, or when scroll anchoring is on with the `cv` setting on). Only when the bug needs a real
   ChatGPT page; the PR names the script and the steps. Catches what only the real page shows.
   Slow, and CI does not run it.

Tooling under `scripts/` has its own seam: `scripts/test_*.py`, run with
`python3 -m unittest discover -s scripts -p 'test_*.py'`. Catches the packaging, review-tier and
PR-body rules; it reaches nothing in `extension/`.

Before a PR, run `npm run check`: it runs every check in
[`.github/workflows/check.yml`](../../.github/workflows/check.yml) locally.
