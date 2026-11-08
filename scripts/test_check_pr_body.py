"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("check_pr_body", ROOT / "scripts" / "check-pr-body.py")
check_pr_body = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_pr_body)
check_body = check_pr_body.check_body

REVIEWED = "Reviewed with review-loop: 1 round with gpt-6.1-sol on high at abc1234. Verdict: approved"


class TierLineTest(unittest.TestCase):
    def test_missing_tier_line_fails(self):
        failures, _ = check_body("Summary\n\nNo tier here.", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)
        self.assertIn("no `Review tier: N` line", failures[0])

    def test_empty_body_fails(self):
        failures, _ = check_body("", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)
        self.assertIn("no `Review tier: N` line", failures[0])

    def test_none_body_fails(self):
        failures, _ = check_body(None, 1, ["scripts/x.py"])
        self.assertEqual(len(failures), 2)

    def test_tier_out_of_range_fails(self):
        failures, _ = check_body("Review tier: 3", 0, ["README.md (Markdown)"])
        self.assertIn("no `Review tier: N` line", failures[0])

    def test_tier_inside_sentence_does_not_count(self):
        failures, _ = check_body("The Review tier: 0 line is missing", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_tier_zero_matching_passes(self):
        failures, passes = check_body("Summary\n\nReview tier: 0\n", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])
        self.assertIn("Review tier: 0 is at least the computed tier 0", passes)
        self.assertIn("tier 0 needs no review-loop line", passes)


class TierFloorTest(unittest.TestCase):
    def test_claim_below_computed_fails_with_reasons(self):
        failures, _ = check_body("Review tier: 0", 1, ["scripts/a.py", "scripts/b.py"])
        self.assertEqual(len(failures), 2)
        self.assertIn("claims Review tier: 0", failures[0])
        self.assertIn("computes tier 1", failures[0])
        self.assertIn("scripts/a.py; scripts/b.py", failures[0])

    def test_claim_above_computed_passes(self):
        failures, passes = check_body(f"Review tier: 2\n{REVIEWED}", 1, ["scripts/a.py"])
        self.assertEqual(failures, [])
        self.assertIn("Review tier: 2 is at least the computed tier 1", passes)

    def test_claim_one_below_two_fails(self):
        failures, _ = check_body(f"Review tier: 1\n{REVIEWED}", 2, ["extension/storage/x.js"])
        self.assertEqual(len(failures), 1)
        self.assertIn("computes tier 2", failures[0])


class ReviewLineTest(unittest.TestCase):
    def test_tier_one_without_review_line_fails(self):
        failures, _ = check_body("Review tier: 1", 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)
        self.assertIn("starting `Reviewed with review-loop:`", failures[0])

    def test_tier_two_with_review_line_passes(self):
        failures, passes = check_body(f"Review tier: 2\n\n{REVIEWED}\n", 2, ["extension/stream/x.js"])
        self.assertEqual(failures, [])
        self.assertTrue(any("review-loop" in message for message in passes))

    def test_unapproved_verdict_fails(self):
        body = "Review tier: 1\nReviewed with review-loop: 2 rounds. Verdict: changes requested"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)

    def test_verdict_is_case_sensitive(self):
        body = "Review tier: 1\nReviewed with review-loop: 1 round. Verdict: Approved"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)

    def test_review_line_must_start_the_line(self):
        body = "Review tier: 1\nNot Reviewed with review-loop: 1 round. Verdict: approved"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)

    def test_missing_review_line_prints_the_line_to_add(self):
        failures, _ = check_body("Review tier: 1", 1, ["scripts/a.py"], head="1234abc")
        self.assertIn(
            "add `Reviewed with review-loop: <N> rounds with <model> at 1234abc. Verdict: approved`",
            failures[0],
        )

    def test_missing_tier_line_prints_the_line_to_add(self):
        failures, _ = check_body(REVIEWED, 2, ["extension/stream/x.js"])
        self.assertIn("add `Review tier: 2`", failures[0])

    def test_review_line_without_sha_fails(self):
        body = "Review tier: 1\nReviewed with review-loop: 1 round with gpt-6.1-sol on high. Verdict: approved"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)
        self.assertIn("`at <sha>`", failures[0])
        self.assertIn("rounds with <model> at <sha>. Verdict: approved", failures[0])

    def test_sha_is_read_from_the_last_review_line(self):
        seen = []
        body = (
            "Review tier: 1\n"
            "Reviewed with review-loop: 1 round with m at 1111111. Verdict: approved\n"
            "Reviewed with review-loop: 2 rounds with m at 2222222. Verdict: approved"
        )
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: seen.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(seen, ["2222222"])

    def test_effort_is_optional(self):
        seen = []
        body = "Review tier: 1\nReviewed with review-loop: 2 rounds with gpt-6.1-sol at fd81ae1. Verdict: approved"
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: seen.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(seen, ["fd81ae1"])

    def test_gate_failures_fail_the_body(self):
        body = f"Review tier: 1\n{REVIEWED}"
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: ([f"bad {sha}"], []))
        self.assertEqual(failures, ["bad abc1234"])

    def test_tier_zero_skips_the_gate(self):
        failures, _ = check_body("Review tier: 0", 0, ["README.md (Markdown)"], review_gate=self.fail)
        self.assertEqual(failures, [])


class LineEndingTest(unittest.TestCase):
    def test_crlf_body_passes(self):
        body = f"Summary\r\n\r\nReview tier: 1\r\n{REVIEWED}\r\n"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(failures, [])


class ReviewedCommitTest(unittest.TestCase):
    """Run the script against a throwaway repository with a PR branch reviewed at self.reviewed."""

    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.git("init", "-q", "-b", "main")
        self.write("README.md", "Butter\n")
        self.write("extension/dev/capture.js", "export const a = 1;\n")
        self.write("extension/shared/util.js", "export const u = 1;\n")
        self.commit("base")
        self.git("checkout", "-q", "-b", "pr")
        self.write("extension/dev/capture.js", "export const a = 2;\n")
        self.commit("pr change")
        self.reviewed = self.rev("HEAD")[:7]

    def git(self, *args):
        return subprocess.run(
            ["git", "-c", "user.name=t", "-c", "user.email=t@example.com", *args],
            cwd=self.root,
            check=True,
            capture_output=True,
            text=True,
        ).stdout

    def rev(self, ref):
        return self.git("rev-parse", ref).strip()

    def write(self, path, text):
        target = self.root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding="utf-8")

    def commit(self, message):
        self.git("add", "-A")
        self.git("commit", "-q", "-m", message)

    def run_check(self, body, base="main"):
        return subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "check-pr-body.py"), base],
            capture_output=True,
            text=True,
            cwd=self.root,
            env={**os.environ, "PR_BODY": body},
        )

    def body(self, sha=None, tier=1):
        at = f" at {sha}" if sha else ""
        return f"Review tier: {tier}\nReviewed with review-loop: 2 rounds with gpt-6.1-sol on high{at}. Verdict: approved"

    def test_nothing_changed_after_the_sha_passes(self):
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"PASS: nothing changed after the reviewed commit {self.reviewed}", result.stdout)

    def test_full_sha_passes(self):
        result = self.run_check(self.body(self.rev("HEAD")))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_review_line_without_sha_fails(self):
        result = self.run_check(self.body())
        self.assertEqual(result.returncode, 1)
        head = self.rev("HEAD")[:7]
        self.assertIn(f"rounds with <model> at {head}. Verdict: approved", result.stdout)

    def test_unknown_sha_fails(self):
        result = self.run_check(self.body("deadbeef"))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("FAIL: reviewed commit deadbeef is not in this checkout", result.stdout)
        self.assertIn("another review-loop round", result.stdout)

    def test_tier_one_change_after_the_sha_fails(self):
        self.write("extension/dev/capture.js", "export const a = 3;\n")
        self.commit("after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 1", result.stdout)
        self.assertIn("extension/dev/capture.js", result.stdout)
        self.assertIn("update `at <sha>`", result.stdout)

    def test_tier_two_change_after_the_sha_fails(self):
        self.write("extension/storage/store.js", "export const s = 1;\n")
        self.commit("after review")
        result = self.run_check(self.body(self.reviewed, tier=2))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("reach tier 2: extension/storage/store.js (high-risk directory)", result.stdout)

    def test_uncommitted_tier_one_file_after_the_sha_fails(self):
        self.write("scripts/new.py", "print()\n")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("scripts/new.py", result.stdout)

    def test_reverting_a_pr_file_after_the_sha_fails(self):
        self.write("extension/shared/util.js", "export const u = 2;\n")
        self.commit("pr change 2")
        reviewed = self.rev("HEAD")[:7]
        self.write("extension/shared/util.js", "export const u = 1;\n")
        self.commit("revert after review")
        result = self.run_check(self.body(reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("extension/shared/util.js", result.stdout)

    def test_only_notes_and_markdown_after_the_sha_pass(self):
        self.write("notes/runs/2026-11-08-check/report.md", "Run\n")
        self.write("notes/runs/2026-11-08-check/data.json", "{}\n")
        self.write("CHANGELOG.md", "Log\n")
        self.commit("notes after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"PASS: changes after the reviewed commit {self.reviewed} are tier 0", result.stdout)

    def test_base_merged_after_the_sha_passes(self):
        self.git("checkout", "-q", "main")
        self.write("extension/shared/util.js", "export const u = 9;\n")
        self.write("scripts/main_only.py", "print()\n")
        self.commit("main moves")
        self.git("checkout", "-q", "pr")
        self.git("merge", "-q", "--no-edit", "main")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: nothing changed after the reviewed commit", result.stdout)

    def test_base_merged_then_pr_change_fails(self):
        self.git("checkout", "-q", "main")
        self.write("scripts/main_only.py", "print()\n")
        self.commit("main moves")
        self.git("checkout", "-q", "pr")
        self.git("merge", "-q", "--no-edit", "main")
        self.write("extension/dev/capture.js", "export const a = 4;\n")
        self.commit("after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("extension/dev/capture.js", result.stdout)
        self.assertNotIn("scripts/main_only.py", result.stdout)

    def test_tier_zero_pr_needs_no_review_line(self):
        self.git("checkout", "-q", "-b", "docs", "main")
        self.write("docs/guide.md", "Guide\n")
        self.commit("docs")
        result = self.run_check("Review tier: 0")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: tier 0 needs no review-loop line", result.stdout)


class WorkflowTest(unittest.TestCase):
    def test_checks_out_the_pr_head_not_the_merge_ref(self):
        # A PR that adds a manifest permission main also added independently is tier 2 on its
        # head but tier 0 on the merge ref, which would waive review.
        workflow = (ROOT / ".github" / "workflows" / "pr-body.yml").read_text(encoding="utf-8")
        self.assertIn("ref: ${{ github.event.pull_request.head.sha }}", workflow)
        self.assertIn("fetch-depth: 0", workflow)


if __name__ == "__main__":
    unittest.main()
