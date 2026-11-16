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

A lab that did not run has not failed to reproduce the bug, so the user's capture does not stand
in for it. When `lab status` shows the lab stopped and it does not start, this machine is not the
lab's machine: follow [lab/README.md](../lab/README.md).

For a bug the user can see, record it happening and show the user the GIF
([recordings](agents/recordings.md)).

Done when: the bug shows with Butter and not without it, with its recording when it is visible; or
the lab ran without showing it, and the user's capture shows Butter's own state going wrong.

## 2. Red

Build the feedback loop with the `diagnosing-bugs` skill (Phase 1), at the first seam in
[docs/agents/seams.md](agents/seams.md) that reaches the bug.

Done when: one command goes **red** on this bug, and you have run it and seen it fail.

## 3. Green

Fix it with the `tdd` skill: the smallest change that turns the step 2 command **green**.

For a bug with a step 1 recording, run the same steps on the fix: `after.gif`.

Done when: the step 2 command passes, and so does `npm run check` (every check in
[`.github/workflows/check.yml`](../.github/workflows/check.yml), run locally); and `after.gif`
shows the bug gone.

## 4. Review and ship

Run `python3 scripts/review-tier.py origin/main` and follow the Workflow rule in
[AGENTS.md](../AGENTS.md). The PR body carries the step 1 result, the step 2 command and both
recordings.

The PR body says `Closes #N` only when the fix was seen working on real ChatGPT: a live-lab run,
or the user on a test build. Otherwise it says `Refs #N`, and the issue stays open until then.

Done when: the PR is open with the `- **Tier:** N` item in its Review section and, for tiers 1 and 2, an APPROVE recorded as `- **Verdict:** approved at <sha>`, or the user's override of a stuck loop as `- **Verdict:** overridden by <user> at <sha>`.
