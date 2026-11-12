# Fixing a bug

The steps for any bug the user reports or a lab run finds. Each step ends on its completion
criterion; finish it before starting the next.

When the user attaches `butter-diag` files, read them before step 1; see [Bug files from the dev build](../notes/diagnostics/README.md#bug-files-from-the-dev-build) for the format and privacy rules.

## 1. Control

Reproduce the bug in the live lab with Butter and without it (`EXT=` empty restarts the lab
browser with no extensions; see [lab/README.md](../lab/README.md) for the lock). If it also
happens without Butter, it is ChatGPT's bug: stop and report that to the user. If the lab
cannot reproduce it, the user's capture (a `butter-diag` bug file or a DevTools snippet's output)
stands in for the lab run, and the PR says the lab did not reproduce it.

Done when: the bug shows with Butter and not without it, or the user's capture shows Butter's own
state going wrong.

## 2. Red

Build the feedback loop with the `diagnosing-bugs` skill (Phase 1). In Butter, the loop is one of
these, in order of preference:

1. a unit test under `test/` (`node --test`), when the logic runs without a page;
2. a fixture harness under `lab/harness/` that sends no ChatGPT requests (like `nav-earlier.mjs`
   or `nav-takeovers.mjs`);
3. a live lab script, only when the bug needs a real ChatGPT page; the PR names it and the steps.

These are the agreed seams for the `tdd` skill; no need to ask the user for them.

Done when: one command goes **red** on this bug, and you have run it and seen it fail.

## 3. Green

Fix it with the `tdd` skill: the smallest change that turns the step 2 command **green**.

Done when: the step 2 command passes, and so does every check in
[`.github/workflows/check.yml`](../.github/workflows/check.yml), run locally.

## 4. Review and ship

Run `python3 scripts/review-tier.py origin/main` and follow the Workflow rule in
[AGENTS.md](../AGENTS.md). The PR body carries the step 1 result and the step 2 command.

Done when: the PR is open with the `- **Tier:** N` item in its Review section and, for tiers 1 and 2, an APPROVE recorded as `- **Verdict:** approved at <sha>`, or the user's override of a stuck loop as `- **Verdict:** overridden by <user> at <sha>`.
