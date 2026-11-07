#!/usr/bin/env python3
"""Check that a PR body records the review the repo's workflow requires.

Usage: PR_BODY=... python3 scripts/check-pr-body.py [base]   (base defaults to origin/main)

The body must carry a `Review tier: N` line with N at least the tier scripts/review-tier.py
computes against base. When that tier is 1 or 2, it must also carry a line starting
`Reviewed with review-loop:` and ending `Verdict: approved`.
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

TIER_LINE = re.compile(r"Review tier: ([0-9]+)")
REVIEW_PREFIX = "Reviewed with review-loop:"
REVIEW_SUFFIX = "Verdict: approved"


def check_body(body, tier, reasons):
    """Return (failures, passes): message lists for a body against the computed tier and reasons."""
    lines = [line.strip() for line in (body or "").splitlines()]
    failures, passes = [], []

    claimed = None
    for line in lines:
        match = TIER_LINE.fullmatch(line)
        if match:
            claimed = int(match.group(1))
            break
    if claimed is None or claimed > 2:
        failures.append("PR body has no `Review tier: N` line with N = 0, 1 or 2")
    elif claimed < tier:
        why = "; ".join(reasons)
        failures.append(f"PR body claims Review tier: {claimed}, but CI computes tier {tier} from: {why}")
    else:
        passes.append(f"Review tier: {claimed} is at least the computed tier {tier}")

    if tier >= 1:
        if any(line.startswith(REVIEW_PREFIX) and line.endswith(REVIEW_SUFFIX) for line in lines):
            passes.append(f"tier {tier} has a `{REVIEW_PREFIX} ... {REVIEW_SUFFIX}` line")
        else:
            failures.append(
                f"tier {tier} needs a line starting `{REVIEW_PREFIX}` and ending `{REVIEW_SUFFIX}`"
            )
    else:
        passes.append("tier 0 needs no review-loop line")
    return failures, passes


def main(argv):
    if len(argv) > 1 or (argv and argv[0].startswith("-")):
        print("usage: PR_BODY=... python3 scripts/check-pr-body.py [base]", file=sys.stderr)
        return 2
    base = argv[0] if argv else "origin/main"
    try:
        merge_base, paths, before, after = review_tier.collect(base)
    except (review_tier.GitError, OSError) as error:
        print(f"check-pr-body: {error}", file=sys.stderr)
        return 1
    if not paths:
        print(f"check-pr-body: no changes against {base} (merge base {merge_base[:7]})", file=sys.stderr)
        return 1
    tier, reasons = review_tier.classify(paths, before, after)
    failures, passes = check_body(os.environ.get("PR_BODY", ""), tier, reasons)
    for message in failures:
        print(f"FAIL: {message}")
    if failures:
        return 1
    for message in passes:
        print(f"PASS: {message}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
