#!/usr/bin/env python3
"""Pick a change's review tier from the files it touches.

Usage: python3 scripts/review-tier.py [base]   (base defaults to origin/main)

Compares `git merge-base HEAD <base>` with the working tree, untracked files included, and prints
`Review tier: N` followed by one line per file (or manifest key set) that set the tier.
Tier 2 is high risk, tier 1 is ordinary code, tier 0 needs only the checks.
"""
import json
from pathlib import PurePosixPath
import subprocess
import sys


MANIFEST = "extension/manifest.json"
HIGH_RISK_DIRS = ("extension/storage/", "extension/consent/", "extension/stream/")
# Files outside those directories that read or write chrome.storage or layout consent.
HIGH_RISK_FILES = (
    "extension/shared/settings.js",
    "extension/shared/status.js",
    "extension/popup/popup.js",
)
HIGH_RISK_KEYS = (
    "permissions",
    "optional_permissions",
    "host_permissions",
    "optional_host_permissions",
    "background",
    "content_scripts",
)
VERSION_KEYS = ("version", "version_name")
CHECKS_ONLY_DIRS = (
    "docs/",
    "notes/",
    "design/",
    "results/",
    "report/",
    "extension/_locales/",
    "extension/icons/",
)


def changed_keys(before, after):
    """Top-level manifest keys whose values differ; a missing manifest counts as {}."""
    before = before or {}
    after = after or {}
    return sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))


def classify_path(path, manifest_before, manifest_after):
    """Return (tier, reason) for one repo-relative path."""
    if path.startswith(HIGH_RISK_DIRS):
        return 2, f"{path} (high-risk directory)"
    if path in HIGH_RISK_FILES:
        return 2, f"{path} (storage or consent)"
    if path == MANIFEST:
        keys = changed_keys(manifest_before, manifest_after)
        risky = [key for key in keys if key in HIGH_RISK_KEYS]
        if risky:
            return 2, f"{path}: {', '.join(risky)} changed"
        other = [key for key in keys if key not in VERSION_KEYS]
        if other:
            return 1, f"{path}: {', '.join(other)} changed"
        return 0, f"{path}: only {', '.join(keys) or 'formatting'} changed"
    if PurePosixPath(path).suffix == ".md":
        return 0, f"{path} (Markdown)"
    if path.startswith(CHECKS_ONLY_DIRS):
        return 0, f"{path} (docs or assets)"
    return 1, path


def classify(paths, manifest_before, manifest_after):
    """Return (tier, reasons): the highest tier any path reaches, and the paths that reach it.

    paths are repo-relative with forward slashes; the manifests are the parsed JSON of
    extension/manifest.json at the merge base and in the working tree (None when absent).
    """
    if not paths:
        raise ValueError("no changed paths")
    results = [classify_path(path, manifest_before, manifest_after) for path in sorted(set(paths))]
    tier = max(result_tier for result_tier, _ in results)
    return tier, [reason for result_tier, reason in results if result_tier == tier]


class GitError(Exception):
    pass


def git(*args, cwd=None):
    result = subprocess.run(["git", *args], capture_output=True, cwd=cwd)
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", "replace").strip()
        raise GitError(f"git {' '.join(args)} failed: {message}")
    return result.stdout


def parse_manifest(text, label):
    try:
        manifest = json.loads(text)
    except (json.JSONDecodeError, UnicodeError) as error:
        raise GitError(f"{label}: invalid JSON: {error}") from error
    if not isinstance(manifest, dict):
        raise GitError(f"{label}: expected a JSON object")
    return manifest


def collect(base):
    """Return (merge_base, paths, manifest_before, manifest_after) for HEAD's work against base."""
    root = git("rev-parse", "--show-toplevel").decode().strip()
    try:
        merge_base = git("merge-base", "HEAD", base, cwd=root).decode().strip()
    except GitError as error:
        raise GitError(f"cannot find the merge base of HEAD and {base!r}: {error}") from error
    tracked = git("diff", "--name-only", "--no-renames", "-z", merge_base, "--", cwd=root)
    untracked = git("ls-files", "--others", "--exclude-standard", "-z", cwd=root)
    paths = sorted({path for path in (tracked + untracked).decode("utf-8").split("\0") if path})

    before = after = None
    if MANIFEST in paths:
        listed = git("ls-tree", "--name-only", merge_base, "--", MANIFEST, cwd=root).decode().strip()
        if listed:
            text = git("show", f"{merge_base}:{MANIFEST}", cwd=root).decode("utf-8")
            before = parse_manifest(text, f"{MANIFEST} at {merge_base[:7]}")
        try:
            with open(f"{root}/{MANIFEST}", encoding="utf-8") as file:
                after = parse_manifest(file.read(), MANIFEST)
        except FileNotFoundError:
            pass
    return merge_base, paths, before, after


def main(argv):
    if len(argv) > 1 or (argv and argv[0].startswith("-")):
        print("usage: python3 scripts/review-tier.py [base]", file=sys.stderr)
        return 2
    base = argv[0] if argv else "origin/main"
    try:
        merge_base, paths, before, after = collect(base)
    except (GitError, OSError) as error:
        print(f"review-tier: {error}", file=sys.stderr)
        return 1
    if not paths:
        print(f"review-tier: no changes against {base} (merge base {merge_base[:7]})", file=sys.stderr)
        return 1
    tier, reasons = classify(paths, before, after)
    print(f"Review tier: {tier}")
    for reason in reasons:
        print(reason)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
