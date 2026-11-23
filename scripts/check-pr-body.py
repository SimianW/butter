#!/usr/bin/env python3
"""Check that a PR body records the review the repo's workflow requires.

Usage: PR_BODY=... python3 scripts/check-pr-body.py [base]   (base defaults to origin/main)

The body records the review in a Markdown list, conventionally under a `## Review` heading at its
end:

    ## Review

    - **Tier:** 1
    - **Verdict:** approved at `fd81ae1`
    - **Reviewers:** gpt-6.2-sol ×3 → claude-opus-5-5 ×1

The Tier item (`-` or `*` bullet, `- **Tier:** N`) must give N = 0, 1 or 2 and at least the tier
scripts/review-tier.py computes against base; the first Tier item counts. When that tier is 1 or
2, the body must also carry a Verdict item `- **Verdict:** approved at <sha>` (`-` or `*` bullet,
backticks around the sha optional, 7 to 40 hex digits), or its override form
`- **Verdict:** overridden by <user> at <sha>`, which records the user shipping a stuck
review-loop (`<user>` is a login without `@`). When several Verdict items exist, the last
one counts. The Reviewers item is for humans; the check does not read it. The sha must exist in
this checkout and be an ancestor of HEAD: a rewrite that drops the approved commit from HEAD's
history (a rebase, or an amend or force-push of that commit) fails the check, because
review-loop's After approval updates a PR only by merging the base branch in.
Nothing after the sha may reach tier 1 or 2: <sha> is replayed onto the current base with
`git merge-tree` (so a base-branch merge after the review does not count, even in files the PR
also changed), and the paths that differ between that tree and the working tree are classified
with review_tier.classify. When the replay conflicts, the tree keeps each conflicted file with its
conflict markers, so every resolution of it counts as a change after the review; a conflicted
extension/manifest.json is tier 2. Markdown or notes added after the approval pass, and
so does a .js, .mjs, .cjs or .css file whose reviewed and current versions differ only in comments
and whitespace (review-tier.py's rule, which needs node and `npm ci` for JavaScript).

Separately from the tier, every max-lines cap the PR adds or raises in eslint.config.mjs's
`maxLinesCaps` needs its own item, at any tier:

    - **Cap raised:** `extension/seek/preview-main.js` 1546 → 1583: <why the file cannot split now>

The item names the path in backticks, the cap at the merge base (`new` for an added cap), `→`
(or `->`), the cap in the working tree, and a reason after the colon. Caps are read from the
object literal in eslint.config.mjs as Prettier formats it (`'path': N,` lines); any other line in
it fails the check, so a cap cannot hide from it. A cap that drops or goes away needs no item, and
raising a cap does not change the tier.

Also at any tier, the working tree may hold no leftover conflict markers the PR adds: the lines
`git diff --check` reports as "leftover conflict marker" against the merge base fail the check,
each named by path and line; a Markdown heading underline of exactly seven `=` counts as one. Its
whitespace findings do not count.

Items inside HTML comments (`<!-- ... -->`) and fenced code blocks do not count: they never render.
Exits 0 when the body passes and 1 with one line per failure otherwise.
"""
import importlib.util
import os
from pathlib import Path
import re
import subprocess
import sys


SPEC = importlib.util.spec_from_file_location(
    "review_tier", Path(__file__).resolve().parent / "review-tier.py"
)
review_tier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(review_tier)

FENCE_OPENER = re.compile(r"(`{3,}|~{3,})(.*)")
TIER_ITEM = re.compile(r"[-*] \*\*Tier:\*\* ([0-9]+)")
ESLINT_CONFIG = "eslint.config.mjs"
CAPS_BLOCK = re.compile(r"^export const maxLinesCaps = \{\n(.*?)^\};", re.M | re.S)
CAP_ENTRY = re.compile(r"'([^'\\]+)': ([0-9]+),")
CAP_ITEM = re.compile(r"[-*] \*\*Cap raised:\*\* `([^`]+)` (new|[0-9]+) (?:→|->) ([0-9]+): \S.*")
CONFLICT_MARKER = re.compile(r"(.+):([0-9]+): leftover conflict marker")
VERDICT_ITEM = re.compile(
    r"[-*] \*\*Verdict:\*\* (approved|overridden by [^`@\s]+) at (`?)([0-9a-fA-F]{7,40})\2"
)


def rendered_lines(body):
    """Return the body's stripped lines without the text that Markdown does not render.

    Drops HTML comments (`<!-- ... -->`, on one line or across several; the text around them on
    a line stays) and fenced code blocks (``` or ~~~, with or without an info string; all fence
    lines go). A fence closes on a line of only its own character, at least as long as the
    opener; a backtick opener's info string has no backtick, so ```x``` is inline code. An unclosed
    fence, or an unclosed comment that opens at the start of its line, hides the rest of the
    body. A `<!--` after other text that does not close on its own line is kept as text, although
    Markdown can carry it over the paragraph's next lines. Fence markers inside a comment, and
    `<!--` inside a fence, are literal. Indented code blocks are not recognised. Fences that open
    on a list-marker line, and closers indented 4 or more spaces, are not handled as CommonMark
    does.
    """
    lines = []
    fence = None  # (character, length) of the open fence
    in_comment = False
    for raw in (body or "").splitlines():
        stripped = raw.strip()
        if fence is not None:
            if stripped and set(stripped) == {fence[0]} and len(stripped) >= fence[1]:
                fence = None
            continue
        if not in_comment:
            opener = FENCE_OPENER.match(stripped)
            if opener and not (opener.group(1)[0] == "`" and "`" in opener.group(2)):
                fence = (opener.group(1)[0], len(opener.group(1)))
                continue
        kept, i = [], 0
        while i < len(raw):
            if in_comment:
                end = raw.find("-->", i)
                if end < 0:
                    break
                in_comment, i = False, end + 3
            else:
                start = raw.find("<!--", i)
                if start < 0:
                    kept.append(raw[i:])
                    break
                end = raw.find("-->", start + 2)
                if end < 0 and raw[:start].strip():
                    kept.append(raw[i:])
                    break
                kept.append(raw[i:start])
                if end < 0:
                    in_comment = True
                    break
                i = end + 3
        lines.append("".join(kept).strip())
    return lines


def tier_item(tier):
    return f"- **Tier:** {tier}"


def verdict_item(sha=None):
    return f"- **Verdict:** approved at {sha or '<sha>'}"


class CapsError(Exception):
    pass


def parse_caps(text):
    """Return {path: cap} from the maxLinesCaps literal in eslint.config.mjs's text."""
    text = text.replace("\r\n", "\n")
    if re.search(r"^export const maxLinesCaps = \{\};", text, re.M):
        return {}
    match = CAPS_BLOCK.search(text)
    if match is None:
        raise CapsError(f"no `export const maxLinesCaps = {{ ... }};` block in {ESLINT_CONFIG}")
    caps = {}
    for line in match.group(1).splitlines():
        line = line.strip()
        if not line or line.startswith("//"):
            continue
        entry = CAP_ENTRY.fullmatch(line)
        if entry is None:
            raise CapsError(f"cannot read the maxLinesCaps line {line!r} in {ESLINT_CONFIG}")
        caps[entry.group(1)] = int(entry.group(2))
    return caps


def caps_at(rev, root):
    """Return the caps in eslint.config.mjs at rev; {} when the file does not exist there."""
    try:
        text = review_tier.git("show", f"{rev}:{ESLINT_CONFIG}", cwd=root)
    except review_tier.GitError:
        return {}
    try:
        return parse_caps(text.decode("utf-8"))
    except CapsError as error:
        raise CapsError(f"{error} at the merge base {rev[:7]}; merge the base branch in") from None


def working_caps(root):
    """Return the caps in the working tree's eslint.config.mjs; {} when it does not exist."""
    path = Path(root, ESLINT_CONFIG)
    return parse_caps(path.read_text(encoding="utf-8")) if path.exists() else {}


def cap_item(path, old, new):
    return f"- **Cap raised:** `{path}` {old if old is not None else 'new'} → {new}: <reason>"


def check_caps(body, before, after):
    """Return (failures, passes): every cap added or raised from before to after needs its item."""
    items = set()
    for line in rendered_lines(body):
        match = CAP_ITEM.fullmatch(line)
        if match:
            items.add((match.group(1), match.group(2), int(match.group(3))))
    failures, passes = [], []
    for path, new in sorted(after.items()):
        old = before.get(path)
        if old is not None and new <= old:
            continue
        change = (
            f"adds a max-lines cap of {new} for {path}"
            if old is None
            else f"raises the max-lines cap for {path} from {old} to {new}"
        )
        if (path, "new" if old is None else str(old), new) in items:
            passes.append(f"the PR {change}, with its reason")
        else:
            failures.append(
                f"the PR {change} in {ESLINT_CONFIG}; split the file along a seam, "
                f"or add `{cap_item(path, old, new)}`"
            )
    return failures, passes


def conflict_markers(merge_base, root):
    """Return the `path:line` of each leftover conflict marker between merge_base and the working
    tree, from `git diff --check`; its whitespace findings do not count."""
    args = ("diff", "--check", merge_base, "--")
    result = subprocess.run(["git", *args], capture_output=True, cwd=root)
    if result.returncode not in (0, 1, 2):  # 2: --check found something, markers or whitespace
        message = result.stderr.decode("utf-8", "replace").strip()
        raise review_tier.GitError(f"git {' '.join(args)} failed: {message}")
    found = map(CONFLICT_MARKER.fullmatch, result.stdout.decode("utf-8", "replace").splitlines())
    return [f"{match.group(1)}:{match.group(2)}" for match in found if match]


def check_conflict_markers(markers):
    """Return (failures, passes): leftover conflict markers fail the PR at any tier."""
    if markers:
        return [
            f"leftover conflict markers at {', '.join(markers)}; resolve the conflict and commit "
            "(a heading underline of exactly seven `=` counts too; lengthen it)"
        ], []
    return [], ["no leftover conflict markers"]


def check_body(body, tier, reasons, review_gate=None, head=None):
    """Return (failures, passes): message lists for a body against the computed tier and reasons.

    review_gate(sha) checks the approved commit against the checkout and returns its own
    (failures, passes); main passes one, and without it only the body's lines are checked.
    head, when given, fills the sha in the Verdict item the failure messages suggest.
    """
    lines = rendered_lines(body)
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

    verdicts = [match for match in map(VERDICT_ITEM.fullmatch, lines) if match]
    if not verdicts:
        failures.append(
            f"tier {tier} needs a `- **Verdict:** approved at <sha>` item; add `{verdict_item(head)}`"
        )
        return failures, passes
    verdict, sha = verdicts[-1].group(1), verdicts[-1].group(3)
    passes.append(f"tier {tier} has a `- **Verdict:** {verdict} at {sha}` item")
    if review_gate is not None:
        gate_failures, gate_passes = review_gate(sha)
        failures.extend(gate_failures)
        passes.extend(gate_passes)
    return failures, passes


def git_status(*args, ok, root):
    """Return (status, stdout bytes) for a git command whose exit status is an answer; a status
    outside ok is an error."""
    result = subprocess.run(["git", *args], capture_output=True, cwd=root)
    if result.returncode not in ok:
        message = result.stderr.decode("utf-8", "replace").strip()
        raise review_tier.GitError(f"git {' '.join(args)} failed: {message}")
    return result.returncode, result.stdout


def replayed_tree(sha, base, root):
    """The tree of sha's PR changes replayed onto the current base. When the replay conflicts,
    the tree holds the conflicted files with their conflict markers, so any resolution of them
    differs from it."""
    old_base = review_tier.git("merge-base", sha, base, cwd=root).decode().strip()
    new_base = review_tier.git("merge-base", "HEAD", base, cwd=root).decode().strip()
    args = ("merge-tree", "--write-tree", f"--merge-base={old_base}", sha, new_base)
    _, out = git_status(*args, ok=(0, 1), root=root)  # 1: the replay conflicts
    return out.decode().splitlines()[0].strip()


def is_ancestor(sha, root):
    """Return whether sha is an ancestor of HEAD (or HEAD itself)."""
    status, _ = git_status("merge-base", "--is-ancestor", sha, "HEAD", ok=(0, 1), root=root)
    return status == 0


def check_after_review(sha, base, root):
    """Return (failures, passes) for the changes made after the approved commit sha."""
    try:
        full = review_tier.git("rev-parse", "--verify", "--quiet", f"{sha}^{{commit}}", cwd=root)
    except review_tier.GitError:
        return [
            f"reviewed commit {sha} is not in this checkout: the approved history was likely "
            "rewritten (rebase, amend or force-push); follow review-loop's After approval: merge "
            "the base branch in, never rebase"
        ], []
    full = full.decode().strip()
    if not is_ancestor(full, root):
        return [
            f"reviewed commit {sha} is not an ancestor of HEAD: the approved history was rewritten "
            "(rebase, amend or force-push); follow review-loop's After approval and merge the base "
            "branch in instead of rebasing"
        ], []
    reviewed = replayed_tree(full, base, root)
    changed = review_tier.changed_since(reviewed, root)
    if not changed:
        return [], [f"nothing changed after the reviewed commit {sha}"]
    tier, reasons = classify_after_review(changed, reviewed, root)
    if tier >= 1:
        return [
            f"changes after the reviewed commit {sha} reach tier {tier}: {'; '.join(reasons)}; "
            "follow review-loop's After approval: after a base-branch merge, an approved Verdict "
            "gets one merge round on the conflict resolution and an override goes back to the "
            "user; otherwise run a new review-loop round"
        ], []
    return [], [f"changes after the reviewed commit {sha} are tier 0: {'; '.join(reasons)}"]


def classify_after_review(changed, reviewed, root):
    """Return (tier, reasons) for the paths changed since the reviewed tree. A file that
    conflicted in the replay holds conflict markers there: JavaScript with markers does not
    parse, so it is never format-only, and a manifest with markers, which cannot be compared key
    by key, is tier 2."""
    before = after = None
    conflicted_manifest = False
    if review_tier.MANIFEST in changed:
        after = review_tier.working_manifest(root)
        try:
            before = review_tier.manifest_at(reviewed, root)
        except (review_tier.GitError, UnicodeDecodeError):
            conflicted_manifest = True
    format_only = review_tier.format_only_paths(changed, reviewed, root)
    tier, reasons = review_tier.classify(changed, before, after, format_only)
    if not conflicted_manifest:
        return tier, reasons
    manifest = (
        f"{review_tier.MANIFEST} (conflicted when the reviewed commit is replayed onto the base)"
    )
    others = [reason for reason in reasons if not reason.startswith(review_tier.MANIFEST)]
    return 2, (others if tier == 2 else []) + [manifest]


def main(argv):
    if len(argv) > 1 or (argv and argv[0].startswith("-")):
        print("usage: PR_BODY=... python3 scripts/check-pr-body.py [base]", file=sys.stderr)
        return 2
    base = argv[0] if argv else "origin/main"
    try:
        root = review_tier.git("rev-parse", "--show-toplevel").decode().strip()
        merge_base, paths, before, after, format_only = review_tier.collect(base)
        head = review_tier.git("rev-parse", "--short", "HEAD", cwd=root).decode().strip()
        caps_before, caps_after = caps_at(merge_base, root), working_caps(root)
        markers = conflict_markers(merge_base, root)
    except (review_tier.GitError, review_tier.ToolError, CapsError, OSError) as error:
        print(f"check-pr-body: {error}", file=sys.stderr)
        return 1
    if not paths:
        print(f"check-pr-body: no changes against {base} (merge base {merge_base[:7]})", file=sys.stderr)
        return 1
    tier, reasons = review_tier.classify(paths, before, after, format_only)
    try:
        failures, passes = check_body(
            os.environ.get("PR_BODY", ""),
            tier,
            reasons,
            review_gate=lambda sha: check_after_review(sha, base, root),
            head=head,
        )
    except (review_tier.GitError, review_tier.ToolError, OSError) as error:
        print(f"check-pr-body: {error}", file=sys.stderr)
        return 1
    cap_failures, cap_passes = check_caps(os.environ.get("PR_BODY", ""), caps_before, caps_after)
    marker_failures, marker_passes = check_conflict_markers(markers)
    failures = failures + cap_failures + marker_failures
    passes = passes + cap_passes + marker_passes
    for message in failures:
        print(f"FAIL: {message}")
    if failures:
        return 1
    for message in passes:
        print(f"PASS: {message}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
