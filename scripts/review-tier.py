#!/usr/bin/env python3
"""Pick a change's review tier from the files it touches.

Usage: python3 scripts/review-tier.py [base]   (base defaults to origin/main)

Compares `git merge-base HEAD <base>` with the working tree, untracked files included, and prints
`Review tier: N` followed by one line per file (or manifest key set) that set the tier.
Tier 2 is high risk, tier 1 is ordinary code, tier 0 needs only the checks.

A .js, .mjs, .cjs or .css file that exists on both sides and changed only in comments and
whitespace is tier 0, wherever it lives. JavaScript is compared by scripts/same-code.mjs (espree
tokens and syntax tree), so it needs node and `npm ci`; without them the script exits with an
error rather than guess. CSS is compared here: comments outside strings are dropped and whitespace
runs collapse to one space, dropped only next to `{`, `}` and `;`.

In the manifest, a content_scripts change is tier 1 when it only edits the entries' js and css
lists (same entries in the same order, every other key unchanged, no file moved between entries);
any other content_scripts change is tier 2.
"""
import json
import os
from pathlib import Path, PurePosixPath
import shutil
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


SCRIPT_SUFFIXES = (".js", ".mjs", ".cjs")
STYLE_SUFFIXES = (".css",)
SAME_CODE = Path(__file__).resolve().parent / "same-code.mjs"
LIST_KEYS = ("js", "css")


def changed_keys(before, after):
    """Top-level manifest keys whose values differ; a missing manifest counts as {}."""
    before = before or {}
    after = after or {}
    return sorted(key for key in before.keys() | after.keys() if before.get(key) != after.get(key))


def entry_files(entries):
    """{file: set of entry indexes} over the js and css lists of content_scripts entries, or None
    when an entry or list is malformed."""
    homes = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, dict):
            return None
        for key in LIST_KEYS:
            files = entry.get(key, [])
            if not isinstance(files, list) or not all(isinstance(file, str) for file in files):
                return None
            for file in files:
                homes.setdefault(file, set()).add(index)
    return homes


def only_script_lists_changed(manifest_before, manifest_after):
    """True when content_scripts keeps its entries, in order, with every key but js and css equal,
    and no file that both sides list changes the entries it is in (such as ISOLATED to MAIN)."""
    before = (manifest_before or {}).get("content_scripts")
    after = (manifest_after or {}).get("content_scripts")
    if not isinstance(before, list) or not isinstance(after, list) or len(before) != len(after):
        return False
    homes_before, homes_after = entry_files(before), entry_files(after)
    if homes_before is None or homes_after is None:
        return False
    for old, new in zip(before, after):
        if {k: v for k, v in old.items() if k not in LIST_KEYS} != {
            k: v for k, v in new.items() if k not in LIST_KEYS
        }:
            return False
    return all(
        homes_after[file] == homes for file, homes in homes_before.items() if file in homes_after
    )


def classify_path(path, manifest_before, manifest_after, format_only=frozenset()):
    """Return (tier, reason) for one repo-relative path.

    format_only holds the paths whose two versions differ only in comments and whitespace."""
    if path in format_only:
        return 0, f"{path} (comments or formatting only)"
    if path.startswith(HIGH_RISK_DIRS):
        return 2, f"{path} (high-risk directory)"
    if path in HIGH_RISK_FILES:
        return 2, f"{path} (storage or consent)"
    if path == MANIFEST:
        keys = changed_keys(manifest_before, manifest_after)
        risky = [key for key in keys if key in HIGH_RISK_KEYS]
        lists_only = only_script_lists_changed(manifest_before, manifest_after)
        if risky == ["content_scripts"] and lists_only:
            risky = []
            keys = [key if key != "content_scripts" else "content_scripts js/css lists" for key in keys]
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


def classify(paths, manifest_before, manifest_after, format_only=frozenset()):
    """Return (tier, reasons): the highest tier any path reaches, and the paths that reach it.

    paths are repo-relative with forward slashes; the manifests are the parsed JSON of
    extension/manifest.json at the merge base and in the working tree (None when absent);
    format_only holds the paths that changed only in comments and whitespace (format_only_paths).
    """
    if not paths:
        raise ValueError("no changed paths")
    format_only = frozenset(format_only)
    results = [
        classify_path(path, manifest_before, manifest_after, format_only)
        for path in sorted(set(paths))
    ]
    tier = max(result_tier for result_tier, _ in results)
    return tier, [reason for result_tier, reason in results if result_tier == tier]


class GitError(Exception):
    pass


class ToolError(Exception):
    """node or espree, needed to compare JavaScript, is missing or failed."""


CSS_SPACE = " \t\n\r\f"
SPACE, COMMENT = (" ",), ("/**/",)


def normalize_css(text):
    """CSS text as a tuple of pieces that drops what cannot change its meaning, or None when a
    string, comment or url() is not closed.

    Strings, escapes and unquoted url() stay as written. A run of whitespace and comments between
    two pieces becomes SPACE when it holds whitespace and COMMENT when it holds only comments (CSS
    reads `.a/**/.b` as `.a.b`, not `.a .b`), and is dropped at the ends and next to `{`, `}`
    and `;`.
    """
    pieces, i, n = [], 0, len(text)
    while i < n:
        char = text[i]
        if char in "\"'":
            end = i + 1
            while end < n and text[end] != char:
                if text[end] == "\\":
                    end += 1
                elif text[end] in "\n\r\f":
                    return None
                end += 1
            if end >= n:
                return None
            pieces.append(text[i : end + 1])
            i = end + 1
        elif text.startswith("/*", i):
            end = text.find("*/", i + 2)
            if end < 0:
                return None
            pieces.append(COMMENT)
            i = end + 2
        elif char == "\\":
            pieces.append(text[i : i + 2])
            i += 2
        elif text[i : i + 4].lower() == "url(" and not text[i + 4 :].lstrip(CSS_SPACE).startswith(
            ("'", '"')
        ):
            end = text.find(")", i)
            if end < 0:
                return None
            pieces.append(text[i : end + 1])
            i = end + 1
        elif char in CSS_SPACE:
            pieces.append(SPACE)
            i += 1
        else:
            pieces.append(char)
            i += 1

    out, gap = [], None
    for piece in pieces:
        if piece is SPACE or piece is COMMENT:
            gap = SPACE if SPACE in (gap, piece) else COMMENT
            continue
        if gap and out and out[-1] not in ("{", "}", ";") and piece not in ("{", "}", ";"):
            out.append(gap)
        out.append(piece)
        gap = None
    return tuple(out)


def same_scripts(pairs):
    """For each (before, after) JavaScript source pair, whether they differ only in comments and
    whitespace; one node run of scripts/same-code.mjs for all pairs."""
    if not pairs:
        return []
    node = shutil.which("node")
    if node is None:
        raise ToolError("node is not installed; install Node.js and run npm ci")
    result = subprocess.run(
        [node, str(SAME_CODE)], input=json.dumps(pairs).encode("utf-8"), capture_output=True
    )
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", "replace").strip()
        raise ToolError(message or f"{SAME_CODE.name} exited with {result.returncode}; run npm ci")
    answers = json.loads(result.stdout)
    if not isinstance(answers, list) or len(answers) != len(pairs):
        raise ToolError(f"{SAME_CODE.name} returned {len(answers)} answers for {len(pairs)} pairs")
    return answers


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


def changed_since(rev, root):
    """Paths that differ between rev and the working tree, untracked files included, sorted."""
    tracked = git("diff", "--name-only", "--no-renames", "-z", rev, "--", cwd=root)
    untracked = git("ls-files", "--others", "--exclude-standard", "-z", cwd=root)
    return sorted({path for path in (tracked + untracked).decode("utf-8").split("\0") if path})


def manifest_at(rev, root):
    """Parsed extension/manifest.json at rev, or None when rev has none."""
    listed = git("ls-tree", "--name-only", rev, "--", MANIFEST, cwd=root).decode().strip()
    if not listed:
        return None
    text = git("show", f"{rev}:{MANIFEST}", cwd=root).decode("utf-8")
    return parse_manifest(text, f"{MANIFEST} at {rev[:7]}")


def working_manifest(root):
    """Parsed extension/manifest.json in the working tree, or None when absent."""
    try:
        with open(f"{root}/{MANIFEST}", encoding="utf-8") as file:
            return parse_manifest(file.read(), MANIFEST)
    except FileNotFoundError:
        return None


def blobs_at(rev, paths, root):
    """{path: bytes} for the regular files among paths at rev (a commit or tree)."""
    if not paths:
        return {}
    listing = git("ls-tree", "-z", "--full-tree", rev, "--", *paths, cwd=root).decode("utf-8")
    objects, wanted = {}, set(paths)
    for line in filter(None, listing.split("\0")):
        meta, path = line.split("\t", 1)
        mode, kind, sha = meta.split()
        if kind == "blob" and mode in ("100644", "100755") and path in wanted:
            objects[path] = sha
    if not objects:
        return {}
    result = subprocess.run(
        ["git", "cat-file", "--batch"],
        input="".join(f"{sha}\n" for sha in objects.values()).encode(),
        capture_output=True,
        cwd=root,
    )
    if result.returncode != 0:
        message = result.stderr.decode("utf-8", "replace").strip()
        raise GitError(f"git cat-file --batch failed: {message}")
    out, blobs, at = result.stdout, {}, 0
    for path in objects:
        header_end = out.index(b"\n", at)
        size = int(out[at:header_end].split()[2])
        blobs[path] = out[header_end + 1 : header_end + 1 + size]
        at = header_end + 1 + size + 1
    return blobs


def working_file(path, root):
    """The bytes of a regular file in the working tree, or None when absent or a symlink."""
    full = os.path.join(root, path)
    if os.path.islink(full) or not os.path.isfile(full):
        return None
    with open(full, "rb") as file:
        return file.read()


def format_only_paths(paths, rev, root):
    """The paths among paths whose version at rev and in the working tree are both .js, .mjs, .cjs
    or .css files that differ only in comments and whitespace. Paths that are tier 0 anyway are
    not compared. Raises ToolError when JavaScript needs comparing and node or espree is missing."""
    candidates = [
        path
        for path in paths
        if PurePosixPath(path).suffix in SCRIPT_SUFFIXES + STYLE_SUFFIXES
        and classify_path(path, None, None)[0] >= 1
    ]
    before = blobs_at(rev, candidates, root)
    same, scripts = set(), []
    for path, old in before.items():
        new = working_file(path, root)
        if new is None:
            continue
        try:
            old_text, new_text = old.decode("utf-8"), new.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if PurePosixPath(path).suffix in STYLE_SUFFIXES:
            old_css, new_css = normalize_css(old_text), normalize_css(new_text)
            if old_css is not None and old_css == new_css:
                same.add(path)
        else:
            scripts.append((path, old_text, new_text))
    answers = same_scripts([[old, new] for _, old, new in scripts])
    same.update(path for (path, _, _), answer in zip(scripts, answers) if answer is True)
    return same


def collect(base):
    """Return (merge_base, paths, manifest_before, manifest_after, format_only) for HEAD's work
    against base; format_only is format_only_paths against the merge base."""
    root = git("rev-parse", "--show-toplevel").decode().strip()
    try:
        merge_base = git("merge-base", "HEAD", base, cwd=root).decode().strip()
    except GitError as error:
        raise GitError(f"cannot find the merge base of HEAD and {base!r}: {error}") from error
    paths = changed_since(merge_base, root)

    before = after = None
    if MANIFEST in paths:
        before = manifest_at(merge_base, root)
        after = working_manifest(root)
    return merge_base, paths, before, after, format_only_paths(paths, merge_base, root)


def main(argv):
    if len(argv) > 1 or (argv and argv[0].startswith("-")):
        print("usage: python3 scripts/review-tier.py [base]", file=sys.stderr)
        return 2
    base = argv[0] if argv else "origin/main"
    try:
        merge_base, paths, before, after, format_only = collect(base)
    except (GitError, ToolError, OSError) as error:
        print(f"review-tier: {error}", file=sys.stderr)
        return 1
    if not paths:
        print(f"review-tier: no changes against {base} (merge base {merge_base[:7]})", file=sys.stderr)
        return 1
    tier, reasons = classify(paths, before, after, format_only)
    print(f"Review tier: {tier}")
    for reason in reasons:
        print(reason)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
