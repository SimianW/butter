#!/usr/bin/env python3
"""Size label for a PR, from the lines of code it changes.

Usage:
    python3 scripts/pr-size.py [base]     # print the label of HEAD's changes; base defaults to DEFAULT_BASE
    python3 scripts/pr-size.py --labels   # print every label, one per line

Compares `git merge-base HEAD <base>` with the working tree, untracked files included. The first
line of output is the label; then come the total and one line per counted file. A file's lines
are the lines added plus the lines deleted; a renamed file counts only the lines changed in it.

Only code counts. Prose, lock files and binary files are left out (the SKIP_* settings below).

The scale is the Kubernetes one (prow's `size` plugin):

    size/XS 0-9    size/S 10-29    size/M 30-99    size/L 100-499    size/XL 500-999    size/XXL 1000+

CI runs this on every PR and sets the label: .github/workflows/pr-size.yml.
Exits 0 with the label; 1 when git fails; 2 on bad usage.
"""
import subprocess
import sys
from pathlib import Path, PurePosixPath


# --------------------------------------------------------------------------------------------
# Repo settings. Paths are repo-relative with forward slashes.
# --------------------------------------------------------------------------------------------

DEFAULT_BASE = "origin/main"

LABEL_PREFIX = "size/"
SIZES = (("XS", 0), ("S", 10), ("M", 30), ("L", 100), ("XL", 500), ("XXL", 1000))  # Name, least lines.

# Not code: prose, and output nobody writes by hand. The first seven are the folders that
# scripts/review-tier.py reviews at tier 0 (CHECKS_ONLY_DIRS); keep the two lists in step.
SKIP_PREFIXES = (
    "docs/",
    "notes/",
    "design/",
    "results/",
    "report/",
    "extension/_locales/",
    "extension/icons/",
    "lab/variants/",  # Frozen copies of the extension, one per ablation step (lab/README.md).
)
SKIP_SUFFIXES = (
    ".md",
    ".mdx",
    ".rst",
    ".txt",
    ".svg",
)
SKIP_NAMES = (
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "bun.lock",
    "Cargo.lock",
    "poetry.lock",
    "uv.lock",
    "go.sum",
    "Gemfile.lock",
    "composer.lock",
)


# --------------------------------------------------------------------------------------------
# The rest is generic.
# --------------------------------------------------------------------------------------------


class GitError(Exception):
    pass


def git(*args, cwd=None):
    result = subprocess.run(["git", *args], capture_output=True, cwd=cwd)
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", "replace").strip()
        raise GitError(f"git {' '.join(args)} failed: {message}")
    return result.stdout


def is_code(path):
    lower = path.lower()
    if path.startswith(SKIP_PREFIXES) or lower.endswith(SKIP_SUFFIXES):
        return False
    return PurePosixPath(path).name not in SKIP_NAMES


def label_for(lines):
    name = SIZES[0][0]
    for candidate, least in SIZES:
        if lines >= least:
            name = candidate
    return LABEL_PREFIX + name


def changed_lines(base_rev, root):
    """Return [(path, lines)] for every file that differs between base_rev and the working tree."""
    result = []
    fields = git("diff", "--numstat", "-z", "-M", base_rev, cwd=root).split(b"\0")
    index = 0
    while index < len(fields) and fields[index]:
        added, deleted, path = fields[index].split(b"\t", 2)
        if path:
            index += 1
        else:  # A rename: the old and the new path follow as two more fields.
            path = fields[index + 2]
            index += 3
        lines = 0 if added == b"-" else int(added) + int(deleted)  # "-" marks a binary file.
        result.append((path.decode("utf-8", "replace"), lines))
    for raw in git("ls-files", "--others", "--exclude-standard", "-z", cwd=root).split(b"\0"):
        if not raw:
            continue
        path = raw.decode("utf-8", "replace")
        try:
            data = Path(root, path).read_bytes()
        except OSError:  # A nested repo's folder or a dangling symlink: nothing to count.
            data = b""
        result.append((path, 0 if b"\0" in data else len(data.splitlines())))
    return result


def main(argv):
    if argv == ["--labels"]:
        print("\n".join(LABEL_PREFIX + name for name, _ in SIZES))
        return 0
    if len(argv) > 1 or (argv and argv[0].startswith("-")):
        print(__doc__.strip(), file=sys.stderr)
        return 2
    base = argv[0] if argv else DEFAULT_BASE
    try:
        root = git("rev-parse", "--show-toplevel").decode("utf-8").strip()
        merge_base = git("merge-base", "HEAD", base, cwd=root).decode("utf-8").strip()
        files = changed_lines(merge_base, root)
    except (GitError, OSError) as error:
        print(f"pr-size: {error}", file=sys.stderr)
        return 1
    counted = sorted(((lines, path) for path, lines in files if is_code(path) and lines), reverse=True)
    total = sum(lines for lines, _ in counted)
    print(label_for(total))
    print(f"{total} lines of code changed in {len(counted)} of {len(files)} changed files")
    for lines, path in counted:
        print(f"{lines:6}  {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
