#!/usr/bin/env python3
"""Check that a PR body records the review the repo's workflow requires.

Usage: PR_BODY=... python3 scripts/check-pr-body.py [base]   (base defaults to origin/main)

The body records the review in a Markdown list, conventionally under a `## Review` heading at its
end:

    ## Review

    - **Tier:** 1
    - **Verdict:** approved at `fd81ae1`
    - **Reviewers:** gpt-6.1-sol ×3 → claude-fable-5-2 ×1

The Tier item (`-` or `*` bullet, `- **Tier:** N`) must give N = 0, 1 or 2 and at least the tier
scripts/review-tier.py computes against base; the first Tier item counts. When that tier is 1 or
2, the body must also carry a Verdict item `- **Verdict:** approved at <sha>` (`-` or `*` bullet,
backticks around the sha optional, 7 to 40 hex digits). When several Verdict items exist, the last
one counts. The Reviewers item is for humans; the check does not read it. The sha must exist in
this checkout, and nothing after it may reach tier 1 or 2: <sha> is
replayed onto the current base with `git merge-tree` (so a base-branch merge or rebase after the
review does not count, even in files the PR also changed), and the paths that differ between that
tree and the working tree are classified with review_tier.classify. When the replay conflicts,
the check falls back to the paths that differ between <sha> and the working tree, limited to paths
the PR changed at review time or changes now. Markdown or notes added after the approval pass.
Exits 0 when the body passes and 1 with one line per failure otherwise.
"""
import importlib.util
import os
from pathlib import Path
import re
import sys


SPEC = importlib.util.spec_from_file_location(
    "review_tier", Path(__file__).resolve().parent / "review-tier.py"
)
review_tier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review_tier)

TIER_ITEM = re.compile(r"[-*] \*\*Tier:\*\* ([0-9]+)")
VERDICT_ITEM = re.compile(r"[-*] \*\*Verdict:\*\* approved at (`?)([0-9a-fA-F]{7,40})\1")


def tier_item(tier):
    return f"- **Tier:** {tier}"


def verdict_item(sha=None):
    return f"- **Verdict:** approved at {sha or '<sha>'}"


def reviewed_sha(line):
    """The sha of an approved Verdict item, or None when line is not one."""
    match = VERDICT_ITEM.fullmatch(line)
    return match.group(2) if match else None


def check_body(body, tier, reasons, review_gate=None, head=None):
    """Return (failures, passes): message lists for a body against the computed tier and reasons.

    review_gate(sha) checks the approved commit against the checkout and returns its own
    (failures, passes); main passes one, and without it only the body's lines are checked.
    head, when given, fills the sha in the Verdict item the failure messages suggest.
    """
    lines = [line.strip() for line in (body or "").splitlines()]
    failures, passes = [], []

    claimed = None
    for line in lines:
        match = TIER_ITEM.fullmatch(line)
        if match:
            claimed = int(match.group(1))
            break
    if claimed is None or claimed > 2:
        failures.append(
            f"PR body has no `- **Tier:** N` item with N = 0, 1 or 2; add `{tier_item(tier)}`"
        )
    elif claimed < tier:
        why = "; ".join(reasons)
        failures.append(f"PR body claims Tier: {claimed}, but CI computes tier {tier} from: {why}")
    else:
        passes.append(f"Tier: {claimed} is at least the computed tier {tier}")

    if tier < 1:
        passes.append("tier 0 needs no Verdict item")
        return failures, passes

    approved = [sha for sha in map(reviewed_sha, lines) if sha]
    if not approved:
        failures.append(
            f"tier {tier} needs a `- **Verdict:** approved at <sha>` item; add `{verdict_item(head)}`"
        )
        return failures, passes
    sha = approved[-1]
    passes.append(f"tier {tier} has a `- **Verdict:** approved at {sha}` item")
    if review_gate is not None:
        gate_failures, gate_passes = review_gate(sha)
        failures.extend(gate_failures)
        passes.extend(gate_passes)
    return failures, passes


def replayed_tree(sha, base, root):
    """The tree of sha's PR changes replayed onto the current base, or None when that conflicts."""
    old_base = review_tier.git("merge-base", sha, base, cwd=root).decode().strip()
    new_base = review_tier.git("merge-base", "HEAD", base, cwd=root).decode().strip()
    try:
        out = review_tier.git(
            "merge-tree", "--write-tree", f"--merge-base={old_base}", sha, new_base, cwd=root
        )
    except review_tier.GitError:
        return None
    return out.decode().splitlines()[0].strip()


def post_review_paths(sha, base, paths, root):
    """Return (paths, rev): the paths the PR changed after sha, and the rev holding their
    reviewed state. rev is sha replayed onto the current base; when that conflicts, rev is sha
    and the paths that differ from it are limited to paths the PR changed at review time or
    changes now."""
    tree = replayed_tree(sha, base, root)
    if tree is not None:
        return review_tier.changed_since(tree, root), tree
    review_base = review_tier.git("merge-base", sha, base, cwd=root).decode().strip()
    at_review = review_tier.git(
        "diff", "--name-only", "--no-renames", "-z", review_base, sha, "--", cwd=root
    )
    pr_paths = {path for path in at_review.decode("utf-8").split("\0") if path} | set(paths)
    return [path for path in review_tier.changed_since(sha, root) if path in pr_paths], sha


def check_after_review(sha, base, paths, root):
    """Return (failures, passes) for the changes made after the approved commit sha."""
    try:
        full = review_tier.git("rev-parse", "--verify", "--quiet", f"{sha}^{{commit}}", cwd=root)
    except review_tier.GitError:
        return [
            f"reviewed commit {sha} is not in this checkout (for example after a force-push); "
            "run another review-loop round and update the sha in the Verdict item"
        ], []
    full = full.decode().strip()
    changed, reviewed = post_review_paths(full, base, paths, root)
    if not changed:
        return [], [f"nothing changed after the reviewed commit {sha}"]
    before = review_tier.manifest_at(reviewed, root) if review_tier.MANIFEST in changed else None
    after = review_tier.working_manifest(root) if review_tier.MANIFEST in changed else None
    tier, reasons = review_tier.classify(changed, before, after)
    if tier >= 1:
        return [
            f"changes after the reviewed commit {sha} reach tier {tier}: {'; '.join(reasons)}; "
            "run another review-loop round on the current head and update the sha in the Verdict item"
        ], []
    return [], [f"changes after the reviewed commit {sha} are tier 0: {'; '.join(reasons)}"]


def main(argv):
    if len(argv) > 1 or (argv and argv[0].startswith("-")):
        print("usage: PR_BODY=... python3 scripts/check-pr-body.py [base]", file=sys.stderr)
        return 2
    base = argv[0] if argv else "origin/main"
    try:
        root = review_tier.git("rev-parse", "--show-toplevel").decode().strip()
        merge_base, paths, before, after = review_tier.collect(base)
        head = review_tier.git("rev-parse", "--short", "HEAD", cwd=root).decode().strip()
    except (review_tier.GitError, OSError) as error:
        print(f"check-pr-body: {error}", file=sys.stderr)
        return 1
    if not paths:
        print(f"check-pr-body: no changes against {base} (merge base {merge_base[:7]})", file=sys.stderr)
        return 1
    tier, reasons = review_tier.classify(paths, before, after)
    try:
        failures, passes = check_body(
            os.environ.get("PR_BODY", ""),
            tier,
            reasons,
            review_gate=lambda sha: check_after_review(sha, base, paths, root),
            head=head,
        )
    except (review_tier.GitError, OSError) as error:
        print(f"check-pr-body: {error}", file=sys.stderr)
        return 1
    for message in failures:
        print(f"FAIL: {message}")
    if failures:
        return 1
    for message in passes:
        print(f"PASS: {message}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
