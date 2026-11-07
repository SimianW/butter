# Fixing a bug

The steps for any bug the user reports or a lab run finds. Each step ends on its completion
criterion; finish it before starting the next.

## 1. Control

Reproduce the bug in the live lab with Butter and without it (`EXT=` empty restarts the lab
browser with no extensions; see [lab/README.md](../lab/README.md) for the lock). If it also
happens without Butter, it is ChatGPT's bug: stop and report that to the user.

Done when: the bug shows with Butter and not without it.

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

Done when: the PR is open with its `Review tier: N` line and, for tiers 1 and 2, an APPROVE.
