# Repo workflow

The procedure for pull requests, the size and length checks, and building a feature in several
steps. The rules that hold in every task are in [AGENTS.md](../../AGENTS.md).

## Pull requests and review gate

Every change reaches `main` through a PR.

1. Run `python3 scripts/review-tier.py origin/main` and put the tier it prints in the PR body's
   `## Review` section as `- **Tier:** N` (use the `pr` skill). Open the PR as a **draft**: you may
   push to a draft before the review so that CI runs early, and `pr-body` runs only on ready PRs.
2. For **tiers 1 and 2**, run `review-loop` on the final diff, at the round budget the tier sets.
   On `APPROVE`, `review-loop` adds ``- **Verdict:** approved at `<sha>` (diff `<12-hex>`)`` and
   `- **Reviewers:**` to the PR body. The Verdict reads
   ``overridden by <user> at `<sha>` (diff `<12-hex>`)`` when the user ships a stuck loop.
   `<12-hex>` is the diff hash of the approved commit, which `review-loop` gets from
   `python3 scripts/check-pr-body.py diff-hash origin/main <sha>`; it reads commits only, so the
   change is committed before the review. **Tier 0** skips this step.
3. Run the local body check: `PR_BODY="$(cat body.md)" python3 scripts/check-pr-body.py`. It is
   CI's `pr-body` check, which enforces the Tier and Verdict items and the Cap raised items (see
   File length ratchet). CI runs `main`'s copy of the gate scripts, so a PR that changes them is
   judged by the rules on `main`: see [docs/development.md](../development.md), PR body.
4. Mark the draft **ready** only after `review-loop` approves (tiers 1 and 2) and the local body
   check passes. Merge only after CI is green; tier 0 merges on green CI alone.

The files agents take their instructions from are at least tier 1, never tier 0: `AGENTS.md` and
`CLAUDE.md` in any folder, `CODING_STANDARDS.md`, `docs/bugfix.md` and everything in
`docs/agents/`. A change to one of them after an approval needs a new review round.

**After approval.** When `main` moves after the approval and GitHub reports a conflict, follow
review-loop's After approval: merge `origin/main` in, never rebase, and never edit the Verdict
yourself.

**Codex GitHub bot.** Do not wait for its review before merging. If it has already posted when CI
is green, handle its comments first; comments that arrive after the merge become a follow-up
issue.

**After the merge.** The thread drops its local branch from its own worktree:
`git fetch --prune origin && git switch --detach origin/main && git branch -d <branch>`. `-d`
(never `-D`) refuses a branch that is unmerged or still checked out; T3 keeps the worktree.

## PR size and splitting

CI labels each PR from `size/XS` to `size/XXL` by the lines of code it changes; prose, lock files,
binary files and the folders in the script's `SKIP_PREFIXES` (docs, assets and `lab/variants/`) do
not count. `python3 scripts/pr-size.py` prints the label locally. The label is CI's to set.

When a task mixes a **structural refactor** (such as splitting a capped file along a seam) with
**behaviour changes**, or is likely to pass `size/L`, ship the refactor that keeps behaviour as its
own small PR first, then stack the bug fix or feature PR on top of it.

Open the stacked PR against the first PR's branch, and give that branch as the base to
`review-loop` and to the tier, `diff-hash` and body-check commands (`origin/<branch>` in place of
`origin/main`): the review then reads only the stacked change. Whether its Verdict holds once the
first PR merges and GitHub moves the stacked PR to `main` depends on how the first PR merges:

- **Merge commit:** the stacked PR's merge base with `main` stays on the commit of the first PR
  it was built on, so the Verdict's diff hash still holds. The exception is a stacked branch that
  merged `main` in before its review: its merge base can move, and `pr-body` then reports a diff
  hash mismatch.
- **Squash or rebase:** `main` gets new commits in place of the first PR's, so the merge base
  falls back to the commit the first PR branched from, and a Verdict recorded before the merge
  fails `pr-body`. Keep the stacked PR a draft until the first PR merges.

After such a mismatch, merge `origin/main` in and run `review-loop` against `origin/main`.

Do not review a stacked PR against `main` while the first PR is open: the review reads the first
PR's change too, and after a merge-commit merge it needs a new round.

## File length ratchet

Every linted file stays within `maxLines` (500) in `eslint.config.mjs`.

- Split a growing file along a seam rather than raise its cap.
- A file already over the limit has a cap in `maxLinesCaps` in `eslint.config.mjs`. Caps only come
  down: when a change shortens a capped file, lower its cap in the same PR, or drop it once the
  file is within 500 lines.
- A PR that adds or raises a cap carries one item per cap in its body, such as
  ``- **Cap raised:** `extension/seek/preview-main.js` 1546 → 1583: <reason>`` (`new` in place of
  the old cap for an added one); `pr-body` fails without it. A raised cap does not change the
  tier.
- Run `npm run lint` and `npm test` (`test/max-lines-caps.test.mjs`) before you open or update a
  PR.

## New features

1. `to-spec` publishes the spec as a GitHub issue in `SimianW/butter` (`gh`) labelled
   `ready-for-agent`.
2. Either `implement <spec>` builds it directly, or `to-tickets` splits it into tickets and
   `implement-spec <spec>` builds them.
3. Their review runs `code-review` against the spec issue. Sort its findings into **fix now /
   follow-up issue / drop**, one line of reason each, and stop for the user to choose. File each
   follow-up as a `ready-for-agent` issue in `SimianW/butter`.
4. After the fixes, `review-loop` gates the final diff at its tier, with the approved refactors
   listed in its Intent.
5. The work ends in a PR whose body carries `Closes #<issue>` and the Review section's
   `- **Tier:** N` item.

`to-spec`, `to-tickets`, `implement` and `implement-spec` are user-only, so the user starts each
one: when the work reaches a step, tell the user it is time and give the command to type, such as
`/to-spec`.

## Delegation

The role models, `target` values, brief rules and `Verify` checklist are in
`~/.agents/delegation.md`; [AGENTS.md](../../AGENTS.md) says which role each kind of work takes. A
brief for delegated `implement` work names the `tdd` skill and
[docs/agents/seams.md](seams.md).
