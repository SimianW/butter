"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'.

Runs the `run:` steps of .github/workflows/pr-body.yml, as a non-draft PR would, against a
throwaway head repository, so the tests judge whatever workflow is in this checkout.
"""
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
WORKFLOW = ROOT / ".github" / "workflows" / "pr-body.yml"
GATE_COPIES = (
    "scripts/check-pr-body.py",
    "scripts/review-tier.py",
    "scripts/same-code.mjs",
    "package.json",
    "package-lock.json",
    ".gitignore",
)
DRAFT_ONLY = "github.event.pull_request.draft"
NOT_DRAFT = "${{ !github.event.pull_request.draft }}"
EXPRESSION = re.compile(r"\$\{\{\s*(.*?)\s*\}\}")
KEY = re.compile(r"([A-Za-z0-9_.-]+):(?: +(.*))?")


class WorkflowYaml:
    """The subset of YAML pr-body.yml uses: block mappings, sequences of mappings, `|` block
    scalars, quoted and plain scalars, and whole-line comments. Flow values such as `[a, b]` stay
    as their text."""

    def __init__(self, text):
        self.lines = text.splitlines()
        self.i = 0

    @classmethod
    def parse(cls, text):
        parser = cls(text)
        value = parser.block(0)
        if parser.peek() is not None:
            raise ValueError(f"line {parser.i + 1}: unexpected indentation")
        return value

    def peek(self):
        """(indent, text) of the next line that is not blank or a comment, or None at the end."""
        while self.i < len(self.lines):
            line = self.lines[self.i]
            text = line.strip()
            if text and not text.startswith("#"):
                return len(line) - len(line.lstrip(" ")), text
            self.i += 1
        return None

    def block(self, indent):
        """The mapping or sequence whose lines start at indent or deeper, or None when none do."""
        line = self.peek()
        if line is None or line[0] < indent:
            return None
        if line[1].startswith("- "):
            return self.sequence(line[0])
        return self.mapping(line[0])

    def sequence(self, indent):
        items = []
        while (line := self.peek()) is not None and line[0] == indent and line[1].startswith("- "):
            raw = self.lines[self.i]
            # `- key: value` opens a mapping whose keys sit two columns in.
            self.lines[self.i] = raw[:indent] + " " + raw[indent + 1 :]
            items.append(self.mapping(indent + 2))
        return items

    def mapping(self, indent):
        result = {}
        while (line := self.peek()) is not None and line[0] >= indent:
            if line[0] > indent or line[1].startswith("- "):
                raise ValueError(f"line {self.i + 1}: unexpected {line[1]!r}")
            match = KEY.fullmatch(line[1])
            if match is None:
                raise ValueError(f"line {self.i + 1}: not a `key: value` line: {line[1]!r}")
            key, rest = match.group(1), match.group(2)
            self.i += 1
            if rest is None:
                result[key] = self.block(indent + 1)
            elif rest in ("|", "|-"):
                result[key] = self.block_scalar(indent, keep_newline=rest == "|")
            else:
                result[key] = scalar(rest)
        return result

    def block_scalar(self, indent, keep_newline):
        body = []
        while self.i < len(self.lines):
            line = self.lines[self.i]
            if line.strip() and len(line) - len(line.lstrip(" ")) <= indent:
                break
            body.append(line)
            self.i += 1
        while body and not body[-1].strip():
            body.pop()
        if not body:
            return ""
        margin = min(len(line) - len(line.lstrip(" ")) for line in body if line.strip())
        text = "\n".join(line[margin:] for line in body)
        return text + "\n" if keep_newline else text


def scalar(text):
    if len(text) >= 2 and text[0] == text[-1] == "'":
        return text[1:-1].replace("''", "'")
    if len(text) >= 2 and text[0] == text[-1] == '"':
        return text[1:-1].replace('\\"', '"').replace("\\\\", "\\")
    return text


def substitute(value, body):
    """value with the PR's ${{ }} expressions filled in; any other expression fails the test."""
    known = {"github.event.pull_request.base.ref": "main", "github.event.pull_request.body": body}

    def fill(match):
        if match.group(1) not in known:
            raise AssertionError(f"the emulation does not know ${{{{ {match.group(1)} }}}} in {value!r}")
        return known[match.group(1)]

    return EXPRESSION.sub(fill, value)


def git(cwd, *args):
    return subprocess.run(
        ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
    ).stdout


class PrBodyWorkflowTest(unittest.TestCase):
    """A non-draft pr-body run on a PR whose head edits the review gate."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.workspace = Path(temporary.name) / "workspace"
        self.workspace.mkdir()
        self.job = WorkflowYaml.parse(WORKFLOW.read_text(encoding="utf-8"))["jobs"]["pr-body"]
        checkout = [step for step in self.job["steps"] if step.get("uses", "").startswith("actions/checkout@")]
        self.assertEqual(len(checkout), 1, "pr-body.yml has one checkout step")
        self.head = self.workspace / ((checkout[0].get("with") or {}).get("path") or "")
        self.head.mkdir(parents=True, exist_ok=True)

    def open_pr(self, change):
        """Commit the gate files on main, then change(head) on a `pr` branch, checked out."""
        git(self.head, "init", "-q", "-b", "main")
        for path in GATE_COPIES:
            (self.head / path).parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / path, self.head / path)
        (self.head / "README.md").write_text("Butter\n", encoding="utf-8")
        git(self.head, "add", "-A")
        git(self.head, "commit", "-q", "-m", "base")
        git(self.head, "update-ref", "refs/remotes/origin/main", "main")
        git(self.head, "checkout", "-q", "-b", "pr")
        change(self.head)
        git(self.head, "add", "-A")
        git(self.head, "commit", "-q", "-m", "pr change")
        return git(self.head, "rev-parse", "--short", "HEAD").strip()

    def run_workflow(self, body):
        """(returncode, output) of the job's run steps, stopping at the first that fails."""
        job_env = self.job.get("env") or {}
        output = []
        for step in self.job["steps"]:
            guard = step.get("if")
            if guard == DRAFT_ONLY:
                continue
            self.assertIn(guard, (None, NOT_DRAFT), f"the emulation does not know `if: {guard}`")
            if "run" not in step:
                continue
            cwd = self.workspace / substitute(step.get("working-directory", ""), body)
            run = substitute(step["run"], body)
            if run.startswith("npm ci"):
                self.assertTrue((cwd / "package-lock.json").exists(), f"`{run}` runs where no lock is")
                # The tests' PRs touch no JavaScript, so node_modules is only lent when present.
                if (ROOT / "node_modules").exists() and not (cwd / "node_modules").exists():
                    (cwd / "node_modules").symlink_to(ROOT / "node_modules")
                continue
            env = {**os.environ}
            for key, value in {**job_env, **(step.get("env") or {})}.items():
                env[key] = substitute(value, body)
            result = subprocess.run(
                ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", run],
                cwd=cwd,
                env=env,
                capture_output=True,
                text=True,
            )
            output.append(f"$ {step.get('name', run.splitlines()[0])}\n{result.stdout}{result.stderr}")
            if result.returncode != 0:
                return result.returncode, "".join(output)
        return 0, "".join(output)

    def weaken_review_tier(self, head):
        """Make head's review-tier.py classify every change as tier 0."""
        path = head / "scripts" / "review-tier.py"
        text = path.read_text(encoding="utf-8")
        marker = 'if __name__ == "__main__":'
        self.assertIn(marker, text)
        weak = "def classify(paths, manifest_before, manifest_after, format_only=frozenset()):\n"
        weak += '    return 0, ["weakened"]\n\n\n'
        path.write_text(text.replace(marker, weak + marker), encoding="utf-8")

    def test_a_pr_cannot_lower_its_tier_by_editing_review_tier(self):
        # A head review-tier.py whose classify always returns tier 0 would pass a tier 0 body if
        # the check ran the PR's own copy; the base branch's copy still computes tier 2.
        self.open_pr(self.weaken_review_tier)
        code, output = self.run_workflow("## Review\n\n- **Tier:** 0")
        self.assertNotEqual(code, 0, output)
        self.assertIn("tier 2", output)
        self.assertIn("scripts/review-tier.py (review gate)", output)

    def test_a_pr_cannot_pass_itself_by_editing_check_pr_body(self):
        # A head check-pr-body.py whose main returns 0 at once would pass any body if the check
        # ran the PR's own copy.
        def weaken(head):
            path = head / "scripts" / "check-pr-body.py"
            text = path.read_text(encoding="utf-8")
            self.assertIn("def main(argv):\n", text)
            path.write_text(text.replace("def main(argv):\n", "def main(argv):\n    return 0\n"), encoding="utf-8")

        self.open_pr(weaken)
        code, output = self.run_workflow("## Review\n\n- **Tier:** 0")
        self.assertNotEqual(code, 0, output)
        self.assertIn("scripts/check-pr-body.py (review gate)", output)

    def test_a_tag_named_like_the_base_branch_does_not_pick_the_gate(self):
        # git resolves a short `origin/main` to a tag of that name before the remote-tracking
        # branch, so a pushed tag `origin/main` on a weakened commit would supply the gate.
        def touch(head):
            path = head / "scripts" / "review-tier.py"
            path.write_text(path.read_text(encoding="utf-8") + "# A harmless comment.\n", encoding="utf-8")

        self.open_pr(touch)
        git(self.head, "checkout", "-q", "-b", "weak", "main")
        self.weaken_review_tier(self.head)
        git(self.head, "commit", "-q", "-am", "weakened gate")
        git(self.head, "tag", "origin/main")
        git(self.head, "checkout", "-q", "pr")
        code, output = self.run_workflow("## Review\n\n- **Tier:** 0")
        self.assertNotEqual(code, 0, output)
        self.assertIn("scripts/review-tier.py (review gate)", output)

    def test_a_reviewed_gate_change_still_passes(self):
        # Judging with the base branch's copy must not block a PR that legitimately changes the
        # gate: at tier 2 with a Verdict on its head, it merges.
        def touch(head):
            path = head / "scripts" / "review-tier.py"
            path.write_text(path.read_text(encoding="utf-8") + "# A harmless comment.\n", encoding="utf-8")

        sha = self.open_pr(touch)
        code, output = self.run_workflow(f"## Review\n\n- **Tier:** 2\n- **Verdict:** approved at {sha}")
        self.assertEqual(code, 0, output)


class WorkflowYamlTest(unittest.TestCase):
    def test_reads_steps_env_and_block_scalars(self):
        # The emulation is only as good as its reading of the workflow: a misread step would
        # silently drop a run or its working directory.
        job = WorkflowYaml.parse(
            "jobs:\n"
            "  j:\n"
            "    env:\n"
            "      A: origin/x\n"
            "    steps:\n"
            "      - if: cond\n"
            '        run: echo "hi"\n'
            "      # A comment.\n"
            "      - name: Two\n"
            "        uses: a/b@v1\n"
            "        with:\n"
            "          path: head\n"
            "          python-version: '3.x'\n"
            "        working-directory: head\n"
            "        run: |\n"
            "          one\n"
            "\n"
            "            two # not a comment\n"
        )["jobs"]["j"]
        self.assertEqual(job["env"], {"A": "origin/x"})
        self.assertEqual(job["steps"][0], {"if": "cond", "run": 'echo "hi"'})
        self.assertEqual(
            job["steps"][1],
            {
                "name": "Two",
                "uses": "a/b@v1",
                "with": {"path": "head", "python-version": "3.x"},
                "working-directory": "head",
                "run": "one\n\n  two # not a comment\n",
            },
        )


if __name__ == "__main__":
    unittest.main()
