# Coding standards

Read at review time. Formatting is Prettier's job (`npm run format:check`, run in CI); this file
holds only judgement calls a check can't make.

## Regression tests for fixed bugs

A fix for a bug the user reported, or one found in review or the lab, comes with a test that fails
without the fix, at a seam from [docs/agents/seams.md](docs/agents/seams.md). If the bug can only
be reproduced live, the PR says so and names the lab script and steps that reproduce it.

Flag a fix with neither as `should`.
