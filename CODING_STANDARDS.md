# Coding standards

Read at review time. Formatting is Prettier's job (`npm run format:check`, run in CI); this file
holds only judgement calls a check can't make.

## Regression tests for fixed bugs

A fix for a bug the user reported, or one found in review or the lab, comes with a test that fails
without the fix: a unit test under `test/` (`node --test`) when the logic can run without a page,
otherwise a fixture harness under `lab/harness/` that needs no ChatGPT requests (like
`nav-earlier.mjs` or `nav-takeovers.mjs`). If the bug can only be reproduced live, the PR says so
and names the lab script and steps that reproduce it.

Flag a fix with neither as `should`.
