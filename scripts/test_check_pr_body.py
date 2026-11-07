"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import importlib.util
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location("check_pr_body", ROOT / "scripts" / "check-pr-body.py")
check_pr_body = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(check_pr_body)
check_body = check_pr_body.check_body

REVIEWED = "Reviewed with review-loop: 1 round with gpt-6.1-sol on high. Verdict: approved"


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


class LineEndingTest(unittest.TestCase):
    def test_crlf_body_passes(self):
        body = f"Summary\r\n\r\nReview tier: 1\r\n{REVIEWED}\r\n"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(failures, [])


if __name__ == "__main__":
    unittest.main()
