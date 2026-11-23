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
check_caps = check_pr_body.check_caps
parse_caps = check_pr_body.parse_caps

REVIEWED = "- **Verdict:** approved at `abc1234`"
REVIEWERS = "- **Reviewers:** gpt-6.2-sol ×3 → claude-opus-5-5 ×1"


def tier(n):
    return f"- **Tier:** {n}"


class TierItemTest(unittest.TestCase):
    def test_missing_tier_item_fails(self):
        failures, _ = check_body("Summary\n\nNo tier here.", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)
        self.assertIn("no `- **Tier:** N` item", failures[0])

    def test_empty_body_fails(self):
        failures, _ = check_body("", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)
        self.assertIn("no `- **Tier:** N` item", failures[0])

    def test_none_body_fails(self):
        failures, _ = check_body(None, 1, ["scripts/x.py"])
        self.assertEqual(len(failures), 2)

    def test_tier_out_of_range_fails(self):
        failures, _ = check_body(tier(3), 0, ["README.md (Markdown)"])
        self.assertIn("no `- **Tier:** N` item", failures[0])

    def test_tier_inside_sentence_does_not_count(self):
        failures, _ = check_body("The - **Tier:** 0 item is missing", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_tier_zero_matching_passes(self):
        failures, passes = check_body(f"Summary\n\n## Review\n\n{tier(0)}\n", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])
        self.assertIn("Tier: 0 is at least the computed tier 0", passes)
        self.assertIn("tier 0 needs no Verdict item", passes)

    def test_star_bullet_passes(self):
        failures, _ = check_body("* **Tier:** 0", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])

    def test_first_tier_item_counts(self):
        failures, _ = check_body(f"{tier(0)}\n{tier(1)}\n{REVIEWED}", 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)
        self.assertIn("claims Tier: 0", failures[0])

    def test_old_tier_line_fails(self):
        failures, _ = check_body("Review tier: 0", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)
        self.assertIn("no `- **Tier:** N` item", failures[0])


class TierFloorTest(unittest.TestCase):
    def test_claim_below_computed_fails_with_reasons(self):
        failures, _ = check_body(tier(0), 1, ["scripts/a.py", "scripts/b.py"])
        self.assertEqual(len(failures), 2)
        self.assertIn("claims Tier: 0", failures[0])
        self.assertIn("computes tier 1", failures[0])
        self.assertIn("scripts/a.py; scripts/b.py", failures[0])

    def test_claim_above_computed_passes(self):
        failures, passes = check_body(f"{tier(2)}\n{REVIEWED}", 1, ["scripts/a.py"])
        self.assertEqual(failures, [])
        self.assertIn("Tier: 2 is at least the computed tier 1", passes)

    def test_claim_one_below_two_fails(self):
        failures, _ = check_body(f"{tier(1)}\n{REVIEWED}", 2, ["extension/storage/x.js"])
        self.assertEqual(len(failures), 1)
        self.assertIn("computes tier 2", failures[0])


class VerdictItemTest(unittest.TestCase):
    def test_tier_one_without_verdict_item_fails(self):
        failures, _ = check_body(tier(1), 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)
        self.assertIn("needs a `- **Verdict:** approved at <sha>` item", failures[0])

    def test_full_review_section_passes(self):
        body = f"Summary\n\n## Review\n\n{tier(2)}\n{REVIEWED}\n{REVIEWERS}\n"
        failures, passes = check_body(body, 2, ["extension/stream/x.js"])
        self.assertEqual(failures, [])
        self.assertIn("tier 2 has a `- **Verdict:** approved at abc1234` item", passes)

    def test_reviewers_item_is_not_required(self):
        failures, _ = check_body(f"{tier(1)}\n{REVIEWED}", 1, ["scripts/a.py"])
        self.assertEqual(failures, [])

    def test_unapproved_verdict_fails(self):
        body = f"{tier(1)}\n- **Verdict:** changes requested at `abc1234`"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)
        self.assertIn("**Verdict:** approved", failures[0])

    def test_verdict_is_case_sensitive(self):
        body = f"{tier(1)}\n- **Verdict:** Approved at `abc1234`"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)

    def test_verdict_item_must_start_the_line(self):
        body = f"{tier(1)}\nNot - **Verdict:** approved at `abc1234`"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)

    def test_star_bullet_verdict_passes(self):
        seen = []
        body = "* **Tier:** 1\n* **Verdict:** approved at `fd81ae1`"
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: seen.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(seen, ["fd81ae1"])

    def test_sha_without_backticks_passes(self):
        seen = []
        body = f"{tier(1)}\n- **Verdict:** approved at fd81ae1"
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: seen.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(seen, ["fd81ae1"])

    def test_unbalanced_backticks_fail(self):
        body = f"{tier(1)}\n- **Verdict:** approved at `fd81ae1"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)

    def test_old_review_line_fails(self):
        body = (
            "Review tier: 1\n\n"
            "Reviewed with review-loop: 3 rounds with gpt-6.2-sol on high at 060d43c. Verdict: approved"
        )
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=self.fail)
        self.assertEqual(len(failures), 2)
        self.assertIn("no `- **Tier:** N` item", failures[0])
        self.assertIn("needs a `- **Verdict:** approved at <sha>` item", failures[1])

    def test_missing_verdict_item_prints_the_item_to_add(self):
        failures, _ = check_body(tier(1), 1, ["scripts/a.py"], head="1234abc")
        self.assertIn("add `- **Verdict:** approved at 1234abc`", failures[0])

    def test_missing_tier_item_prints_the_item_to_add(self):
        failures, _ = check_body(REVIEWED, 2, ["extension/stream/x.js"])
        self.assertIn("add `- **Tier:** 2`", failures[0])

    def test_verdict_without_sha_fails(self):
        body = f"{tier(1)}\n- **Verdict:** approved"
        failures, _ = check_body(body, 1, ["scripts/a.py"])
        self.assertEqual(len(failures), 1)
        self.assertIn("add `- **Verdict:** approved at <sha>`", failures[0])

    def test_override_verdict_passes(self):
        seen = []
        body = f"{tier(2)}\n- **Verdict:** overridden by simian at `fd81ae1`"
        failures, passes = check_body(body, 2, ["extension/stream/x.js"], review_gate=lambda sha: seen.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(seen, ["fd81ae1"])
        self.assertIn("tier 2 has a `- **Verdict:** overridden by simian at fd81ae1` item", passes)

    def test_override_verdict_needs_a_user(self):
        for who in ("overridden", "overridden by", "overridden by @simian", "overridden by two words"):
            body = f"{tier(1)}\n- **Verdict:** {who} at `fd81ae1`"
            failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=self.fail)
            self.assertEqual(len(failures), 1, who)

    def test_sha_is_read_from_the_last_verdict_item(self):
        seen = []
        body = f"{tier(1)}\n- **Verdict:** approved at `1111111`\n- **Verdict:** approved at `2222222`"
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: seen.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(seen, ["2222222"])

    def test_gate_failures_fail_the_body(self):
        body = f"{tier(1)}\n{REVIEWED}"
        failures, _ = check_body(body, 1, ["scripts/a.py"], review_gate=lambda sha: ([f"bad {sha}"], []))
        self.assertEqual(failures, ["bad abc1234"])

    def test_tier_zero_skips_the_gate(self):
        failures, _ = check_body(tier(0), 0, ["README.md (Markdown)"], review_gate=self.fail)
        self.assertEqual(failures, [])


class CapsTest(unittest.TestCase):
    BEFORE = {"extension/seek/preview-main.js": 1546, "test/a.test.js": 600}

    def test_raised_cap_without_an_item_fails_with_the_item_to_add(self):
        after = {**self.BEFORE, "extension/seek/preview-main.js": 1583}
        failures, _ = check_caps(tier(1), self.BEFORE, after)
        self.assertEqual(len(failures), 1)
        self.assertIn("raises the max-lines cap for extension/seek/preview-main.js from 1546 to 1583", failures[0])
        self.assertIn("`- **Cap raised:** `extension/seek/preview-main.js` 1546 → 1583: <reason>`", failures[0])

    def test_raised_cap_with_its_item_passes(self):
        after = {**self.BEFORE, "extension/seek/preview-main.js": 1583}
        body = "- **Cap raised:** `extension/seek/preview-main.js` 1546 → 1583: the seam lands in #140"
        failures, passes = check_caps(body, self.BEFORE, after)
        self.assertEqual(failures, [])
        self.assertEqual(len(passes), 1)

    def test_ascii_arrow_and_star_bullet_pass(self):
        after = {**self.BEFORE, "test/a.test.js": 610}
        body = "* **Cap raised:** `test/a.test.js` 600 -> 610: one more fixture"
        self.assertEqual(check_caps(body, self.BEFORE, after)[0], [])

    def test_added_cap_needs_a_new_item(self):
        after = {**self.BEFORE, "extension/x.js": 520}
        failures, _ = check_caps("", self.BEFORE, after)
        self.assertEqual(len(failures), 1)
        self.assertIn("adds a max-lines cap of 520 for extension/x.js", failures[0])
        self.assertIn("`extension/x.js` new → 520", failures[0])
        body = "- **Cap raised:** `extension/x.js` new → 520: generated table"
        self.assertEqual(check_caps(body, self.BEFORE, after)[0], [])

    def test_stale_item_fails(self):
        after = {**self.BEFORE, "extension/seek/preview-main.js": 1600}
        body = "- **Cap raised:** `extension/seek/preview-main.js` 1546 → 1583: reason"
        failures, _ = check_caps(body, self.BEFORE, after)
        self.assertEqual(len(failures), 1)
        self.assertIn("1546 → 1600", failures[0])

    def test_item_without_a_reason_fails(self):
        after = {**self.BEFORE, "test/a.test.js": 610}
        failures, _ = check_caps("- **Cap raised:** `test/a.test.js` 600 → 610:", self.BEFORE, after)
        self.assertEqual(len(failures), 1)

    def test_lowered_and_dropped_caps_need_no_item(self):
        after = {"extension/seek/preview-main.js": 1500}
        self.assertEqual(check_caps("", self.BEFORE, after), ([], []))

    def test_unchanged_caps_need_no_item(self):
        self.assertEqual(check_caps("", self.BEFORE, dict(self.BEFORE)), ([], []))


class ParseCapsTest(unittest.TestCase):
    def test_reads_the_repo_config(self):
        caps = parse_caps((ROOT / "eslint.config.mjs").read_text(encoding="utf-8"))
        self.assertTrue(caps)
        self.assertTrue(all(isinstance(cap, int) for cap in caps.values()))

    def test_reads_entries_and_skips_comments(self):
        text = "export const maxLinesCaps = {\r\n  // Why.\r\n  'a/b.js': 510,\r\n\r\n  'c.js': 600,\r\n};\r\n"
        self.assertEqual(parse_caps(text), {"a/b.js": 510, "c.js": 600})

    def test_empty_literal_is_no_caps(self):
        self.assertEqual(parse_caps("export const maxLinesCaps = {};\n"), {})

    def test_unreadable_line_fails(self):
        for line in ["  ...extra,", "  'a.js': 500 + 10,", "  [key]: 510,", '  "a.js": 510,']:
            with self.subTest(line=line), self.assertRaises(check_pr_body.CapsError):
                parse_caps(f"export const maxLinesCaps = {{\n{line}\n}};\n")

    def test_missing_block_fails(self):
        with self.assertRaises(check_pr_body.CapsError):
            parse_caps("const maxLinesCaps = makeCaps();\n")


class HiddenTextTest(unittest.TestCase):
    """Items inside HTML comments and fenced code blocks never render, so they do not count."""

    ITEMS = f"{tier(2)}\n{REVIEWED}\n- **Cap raised:** `test/a.test.js` 600 → 610: more fixtures"
    CAPS_BEFORE = {"test/a.test.js": 600}
    CAPS_AFTER = {"test/a.test.js": 610}

    def assert_hidden(self, body):
        failures, _ = check_body(body, 2, ["scripts/a.py"])
        self.assertEqual(len(failures), 2, failures)
        self.assertIn("no `- **Tier:** N` item", failures[0])
        self.assertIn("needs a `- **Verdict:** approved at <sha>` item", failures[1])
        caps, _ = check_caps(body, self.CAPS_BEFORE, self.CAPS_AFTER)
        self.assertEqual(len(caps), 1, caps)

    def test_items_in_a_multi_line_comment_and_a_fence_do_not_count(self):
        body = (
            "## Review\n\n<!--\nTemplate:\n"
            f"{self.ITEMS}\n-->\n\n```\n{REVIEWED}\n```\n"
        )
        self.assert_hidden(body)

    def test_items_in_a_fence_with_an_info_string_do_not_count(self):
        self.assert_hidden(f"```markdown\n{self.ITEMS}\n```\n")

    def test_items_in_a_long_tilde_fence_do_not_count(self):
        self.assert_hidden(f"~~~~text\n{self.ITEMS}\n~~~~\n")

    def test_indented_fence_markers_still_open_a_fence(self):
        self.assert_hidden(f"  ```\n{self.ITEMS}\n  ```\n")

    def test_real_items_win_over_example_items_in_a_fence(self):
        body = f"```markdown\n{tier(0)}\n- **Verdict:** approved at `1111111`\n```\n\n{tier(2)}\n{REVIEWED}\n"
        shas = []
        failures, _ = check_body(body, 2, ["scripts/a.py"], review_gate=lambda sha: shas.append(sha) or ([], []))
        self.assertEqual(failures, [])
        self.assertEqual(shas, ["abc1234"])

    def test_real_cap_item_passes_next_to_an_example_in_a_fence(self):
        body = f"~~~\n- **Cap raised:** `x.js` 1 → 2: example\n~~~\n{self.ITEMS}"
        failures, passes = check_caps(body, self.CAPS_BEFORE, self.CAPS_AFTER)
        self.assertEqual(failures, [])
        self.assertEqual(len(passes), 1)

    def test_a_one_line_comment_next_to_the_item_is_removed(self):
        body = f"- **Tier:** 2 <!-- old: - **Tier:** 0 -->\n{REVIEWED}"
        failures, _ = check_body(body, 2, ["scripts/a.py"])
        self.assertEqual(failures, [])

    def test_text_after_a_comment_on_the_same_line_stays(self):
        failures, _ = check_body(f"<!-- x --> {tier(0)} <!-- y --><!-- z -->", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])

    def test_a_one_line_comment_holding_the_only_item_fails(self):
        failures, _ = check_body(f"<!-- {tier(0)} -->", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)
        self.assertIn("no `- **Tier:** N` item", failures[0])

    def test_a_comment_marker_inside_a_fence_is_literal(self):
        body = f"```\n<!--\n```\n{tier(0)}\n"
        failures, _ = check_body(body, 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])

    def test_a_fence_marker_inside_a_comment_has_no_effect(self):
        body = f"<!--\n```\n-->\n{tier(0)}\n"
        failures, _ = check_body(body, 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])

    def test_a_backtick_run_closing_on_its_own_line_inside_a_tilde_fence_does_not_close_it(self):
        failures, _ = check_body(f"~~~\n```\n{tier(0)}\n~~~\n", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_a_shorter_closer_does_not_close_the_fence(self):
        failures, _ = check_body(f"````\n```\n{tier(0)}\n````\n", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_a_longer_closer_closes_the_fence(self):
        failures, _ = check_body(f"```\nexample\n`````\n{tier(0)}\n", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])

    def test_a_closer_with_an_info_string_does_not_close_the_fence(self):
        failures, _ = check_body(f"```\n```text\n{tier(0)}\n```\n", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_inline_code_with_three_backticks_is_not_a_fence(self):
        failures, _ = check_body(f"```x```\n{tier(0)}\n", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])

    def test_an_unclosed_fence_hides_the_rest_of_the_body(self):
        failures, _ = check_body(f"```\n{tier(0)}\n", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_an_unclosed_comment_hides_the_rest_of_the_body(self):
        failures, _ = check_body(f"<!-- never closed\n{tier(0)}\n", 0, ["README.md (Markdown)"])
        self.assertEqual(len(failures), 1)

    def test_an_unclosed_comment_opener_after_text_is_literal(self):
        body = f"Skip comments that start with `<!--` and fenced code.\n\n## Review\n\n{tier(2)}\n{REVIEWED}\n"
        failures, _ = check_body(body, 2, ["scripts/a.py"], review_gate=lambda sha: ([], []))
        self.assertEqual(failures, [])

    def test_an_abrupt_empty_comment_closes(self):
        failures, _ = check_body(f"<!-->\n{tier(0)}\n", 0, ["README.md (Markdown)"])
        self.assertEqual(failures, [])


class LineEndingTest(unittest.TestCase):
    def test_crlf_body_passes(self):
        body = f"Summary\r\n\r\n## Review\r\n\r\n{tier(1)}\r\n{REVIEWED}\r\n{REVIEWERS}\r\n"
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
        verdict = f"- **Verdict:** approved at `{sha}`" if sha else "- **Verdict:** approved"
        return f"## Review\n\n- **Tier:** {tier}\n{verdict}\n{REVIEWERS}"

    def test_nothing_changed_after_the_sha_passes(self):
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"PASS: nothing changed after the reviewed commit {self.reviewed}", result.stdout)

    def test_full_sha_passes(self):
        result = self.run_check(self.body(self.rev("HEAD")))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_verdict_without_sha_fails(self):
        result = self.run_check(self.body())
        self.assertEqual(result.returncode, 1)
        head = self.rev("HEAD")[:7]
        self.assertIn(f"add `- **Verdict:** approved at {head}`", result.stdout)

    def test_unknown_sha_fails(self):
        result = self.run_check(self.body("deadbeef"))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("FAIL: reviewed commit deadbeef is not in this checkout", result.stdout)
        self.assertIn("rebase, amend or force-push", result.stdout)
        self.assertIn("review-loop's After approval", result.stdout)
        self.assertIn("never rebase", result.stdout)
        self.assertNotIn("another review-loop round", result.stdout)

    def test_tier_one_change_after_the_sha_fails(self):
        self.write("extension/dev/capture.js", "export const a = 3;\n")
        self.commit("after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 1", result.stdout)
        self.assertIn("extension/dev/capture.js", result.stdout)
        self.assertIn(
            "follow review-loop's After approval: if every flagged change comes from resolving a "
            "base-branch merge conflict, an approved Verdict gets one merge round on that "
            "resolution and an override goes back to the user; otherwise run a new review-loop "
            "round",
            result.stdout,
        )

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

    def share_a_file_with_main(self):
        """PR edits the first line of a tier 1 file main also has; review at that commit."""
        lines = [f"line {n}" for n in range(1, 11)]
        self.git("checkout", "-q", "main")
        self.write("scripts/tool.py", "\n".join(lines) + "\n")
        self.commit("main adds tool")
        self.git("checkout", "-q", "pr")
        self.git("merge", "-q", "--no-edit", "main")
        lines[0] = "line 1 by pr"
        self.write("scripts/tool.py", "\n".join(lines) + "\n")
        self.commit("pr edits tool")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        lines[0], lines[9] = "line 1", "line 10 by main"
        self.write("scripts/tool.py", "\n".join(lines) + "\n")
        self.commit("main edits tool")
        self.git("checkout", "-q", "pr")
        return lines

    def test_base_merged_into_a_shared_file_after_the_sha_passes(self):
        self.share_a_file_with_main()
        self.git("merge", "-q", "--no-edit", "main")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: nothing changed after the reviewed commit", result.stdout)

    def test_base_merged_into_a_shared_file_then_pr_change_fails(self):
        lines = self.share_a_file_with_main()
        self.git("merge", "-q", "--no-edit", "main")
        lines[0], lines[4] = "line 1 by pr", "line 5 by pr after review"
        self.write("scripts/tool.py", "\n".join(lines) + "\n")
        self.commit("after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("reach tier 1", result.stdout)
        self.assertIn("scripts/tool.py", result.stdout)

    def test_rebased_onto_a_newer_base_with_the_old_sha_fails(self):
        self.share_a_file_with_main()
        self.git("rebase", "-q", "main")
        self.assertNotEqual(self.rev("HEAD")[:7], self.reviewed)
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(f"FAIL: reviewed commit {self.reviewed} is not an ancestor of HEAD", result.stdout)
        self.assertIn("rebase, amend or force-push", result.stdout)
        self.assertIn("review-loop's After approval", result.stdout)

    def test_base_merge_with_a_resolved_conflict_stays_strict(self):
        self.git("checkout", "-q", "main")
        self.write("extension/dev/capture.js", "export const a = 5;\n")
        self.commit("main edits the same line")
        self.git("checkout", "-q", "pr")
        merge = subprocess.run(["git", "merge", "-q", "--no-edit", "main"], cwd=self.root, capture_output=True)
        self.assertNotEqual(merge.returncode, 0)
        self.write("extension/dev/capture.js", "export const a = 2 + 5;\n")
        self.commit("resolve by combining both sides")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("reach tier 1", result.stdout)
        self.assertIn("extension/dev/capture.js", result.stdout)

    def merge_main_with_a_readme_conflict(self):
        """PR and main edit README.md's first line; review the PR, then merge main in. Returns
        with the merge stopped on the conflict, its markers in the working tree."""
        self.write("README.md", "Butter by pr\n")
        self.commit("pr edits the readme")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        self.write("README.md", "Butter by main\n")
        self.commit("main edits the readme")
        self.git("checkout", "-q", "pr")
        merge = subprocess.run(["git", "merge", "-q", "--no-edit", "main"], cwd=self.root, capture_output=True)
        self.assertNotEqual(merge.returncode, 0)

    def test_base_merge_with_a_resolved_markdown_conflict_passes(self):
        self.merge_main_with_a_readme_conflict()
        self.write("README.md", "Butter by pr and main\n")
        self.commit("resolve the readme")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"PASS: changes after the reviewed commit {self.reviewed} are tier 0", result.stdout)
        self.assertIn("PASS: no leftover conflict markers", result.stdout)

    def test_base_merge_with_conflict_markers_left_in_markdown_fails(self):
        self.merge_main_with_a_readme_conflict()
        self.commit("commit the merge with its markers")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("FAIL: leftover conflict markers at README.md:1, README.md:3, README.md:5", result.stdout)
        self.assertIn("resolve the conflict", result.stdout)
        self.assertIn("a heading underline of exactly seven `=` counts too; lengthen it", result.stdout)

    def merge(self, branch):
        """Merge branch into the current one; returns whether git stopped on a conflict."""
        merge = subprocess.run(["git", "merge", "-q", "--no-edit", branch], cwd=self.root, capture_output=True)
        return merge.returncode != 0

    def test_base_merge_resolved_by_keeping_the_pr_side_of_a_code_conflict_fails(self):
        # A keep-ours resolution drops main's change and leaves the file as the reviewed commit
        # had it; the reviewers never saw main's change dropped.
        self.write("extension/storage/layout-bridge.js", "export const mode = 'pr';\n")
        self.commit("pr edits the bridge")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        self.write("extension/storage/layout-bridge.js", "export const mode = 'main';\n")
        self.commit("main edits the same line")
        self.git("checkout", "-q", "pr")
        self.assertTrue(self.merge("main"))
        self.git("checkout", "--ours", "--", "extension/storage/layout-bridge.js")
        self.commit("resolve by keeping the pr side")
        result = self.run_check(self.body(self.reviewed, tier=2))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 2: "
            "extension/storage/layout-bridge.js (high-risk directory)",
            result.stdout,
        )

    def test_base_merge_that_reverts_mains_change_to_another_file_fails(self):
        # A Markdown conflict makes the replay conflict; main's change to a file the PR never
        # touched is undone in the merge, and that must not hide behind the Markdown conflict.
        self.git("checkout", "-q", "main")
        self.write("extension/shared/util.js", "export const u = 9;\n")
        self.commit("main edits util")
        self.git("checkout", "-q", "pr")
        self.merge_main_with_a_readme_conflict()
        self.write("README.md", "Butter by pr and main\n")
        self.write("extension/shared/util.js", "export const u = 1;\n")
        self.commit("resolve the readme, revert main's util")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("reach tier 1: extension/shared/util.js", result.stdout)
        self.assertNotIn("README.md", result.stdout)

    def test_base_merge_resolved_by_keeping_the_pr_side_of_a_manifest_conflict_fails(self):
        # The replayed manifest holds conflict markers, so it cannot be compared key by key;
        # the check counts it as tier 2 instead of stopping on its invalid JSON.
        self.git("checkout", "-q", "main")
        self.write("extension/manifest.json", '{"version": "1.0", "permissions": []}\n')
        self.commit("main adds a manifest")
        self.git("checkout", "-q", "pr")
        self.assertFalse(self.merge("main"))
        self.write("extension/manifest.json", '{"version": "1.1", "permissions": []}\n')
        self.commit("pr bumps the version")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        self.write("extension/manifest.json", '{"version": "1.2", "permissions": []}\n')
        self.commit("main bumps the version")
        self.git("checkout", "-q", "pr")
        self.assertTrue(self.merge("main"))
        self.git("checkout", "--ours", "--", "extension/manifest.json")
        self.commit("resolve by keeping the pr side")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 2: "
            "extension/manifest.json (conflicted when the reviewed commit is replayed onto the base)",
            result.stdout,
        )

    def review_an_edit_that_main_deletes(self, path, text):
        """The PR edits path (which main has) and is reviewed; main then deletes path, and the
        merge of main into the PR stops on the modify/delete conflict."""
        self.git("checkout", "-q", "main")
        self.write(path, text)
        self.commit("main adds the file")
        self.git("checkout", "-q", "pr")
        self.assertFalse(self.merge("main"))
        self.write(path, "// PR edit.\n" + text)
        self.commit("pr edits the file")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        self.git("rm", "-q", path)
        self.commit("main deletes the file")
        self.git("checkout", "-q", "pr")
        self.assertTrue(self.merge("main"))

    def test_base_merge_keeping_the_pr_copy_of_a_file_main_deleted_fails(self):
        # A modify/delete conflict leaves the PR's copy, with no markers, in the replayed tree;
        # keeping that copy drops main's deletion, which no reviewer saw.
        self.review_an_edit_that_main_deletes("scripts/tool.py", "print(1)\n")
        self.git("add", "scripts/tool.py")
        self.commit("resolve by keeping the pr copy")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 1: scripts/tool.py",
            result.stdout,
        )

    def test_base_merge_keeping_the_pr_copy_of_a_markdown_file_main_deleted_passes(self):
        self.review_an_edit_that_main_deletes("docs/guide.md", "Guide\n")
        self.git("add", "docs/guide.md")
        self.commit("resolve by keeping the pr copy")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(
            f"PASS: changes after the reviewed commit {self.reviewed} are tier 0: docs/guide.md",
            result.stdout,
        )

    def test_base_merge_keeping_the_pr_copy_of_a_manifest_main_deleted_fails(self):
        # The replayed manifest is the PR's copy, so a key-by-key comparison sees nothing; a
        # conflicted manifest is tier 2 whatever the tree holds.
        self.git("checkout", "-q", "main")
        self.write("extension/manifest.json", '{"version": "1.0", "permissions": []}\n')
        self.commit("main adds a manifest")
        self.git("checkout", "-q", "pr")
        self.assertFalse(self.merge("main"))
        self.write("extension/manifest.json", '{"version": "1.1", "permissions": []}\n')
        self.commit("pr bumps the version")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        self.git("rm", "-q", "extension/manifest.json")
        self.commit("main deletes the manifest")
        self.git("checkout", "-q", "pr")
        self.assertTrue(self.merge("main"))
        self.git("add", "extension/manifest.json")
        self.commit("resolve by keeping the pr copy")
        result = self.run_check(self.body(self.reviewed, tier=2))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 2: "
            "extension/manifest.json (conflicted when the reviewed commit is replayed onto the base)",
            result.stdout,
        )

    def test_base_merge_restoring_a_file_the_pr_deleted_fails(self):
        # A delete/modify conflict leaves main's copy in the replayed tree; `git add -A` after
        # the merge keeps it, so the file the reviewers saw deleted comes back.
        self.git("rm", "-q", "extension/shared/util.js")
        self.commit("pr deletes util")
        self.reviewed = self.rev("HEAD")[:7]
        self.git("checkout", "-q", "main")
        self.write("extension/shared/util.js", "export const u = 9;\n")
        self.commit("main edits util")
        self.git("checkout", "-q", "pr")
        self.assertTrue(self.merge("main"))
        self.commit("resolve with add -A")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn(
            f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 1: "
            "extension/shared/util.js",
            result.stdout,
        )
        self.assertNotIn("comments or formatting only", result.stdout)

    def test_conflict_markers_fail_a_tier_zero_pr(self):
        self.git("checkout", "-q", "-b", "docs", "main")
        self.write("docs/guide.md", "Guide\n<<<<<<< HEAD\nA\n=======\nB\n>>>>>>> main\n")
        self.commit("docs with markers")
        result = self.run_check("## Review\n\n- **Tier:** 0")
        self.assertEqual(result.returncode, 1, result.stdout + result.stderr)
        self.assertIn("FAIL: leftover conflict markers at docs/guide.md:2, docs/guide.md:4", result.stdout)

    def test_trailing_whitespace_is_not_a_conflict_marker(self):
        self.write("README.md", "Butter \n\tand \t space before tab\n")
        self.commit("whitespace after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: no leftover conflict markers", result.stdout)

    def review_a_stream_file(self):
        """The PR adds a tier 2 script and stylesheet; review at that commit."""
        self.write("extension/stream/x.js", "// Note.\nexport const s = 1;\n")
        self.write("extension/stream/x.css", ".a { color: red; }\n")
        self.commit("pr adds stream files")
        self.reviewed = self.rev("HEAD")[:7]

    def test_comment_only_change_in_a_tier_two_file_after_the_sha_passes(self):
        self.review_a_stream_file()
        self.write("extension/stream/x.js", "// A clearer note,\n// on two lines.\nexport const s = 1; // why\n")
        self.write("extension/stream/x.css", "/* Why red. */\n.a {\n  color: red;\n}\n")
        self.commit("comments after review")
        result = self.run_check(self.body(self.reviewed, tier=2))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn(f"PASS: changes after the reviewed commit {self.reviewed} are tier 0", result.stdout)
        self.assertIn("extension/stream/x.js (comments or formatting only)", result.stdout)
        self.assertIn("extension/stream/x.css (comments or formatting only)", result.stdout)

    def test_code_change_in_a_tier_two_file_after_the_sha_fails(self):
        self.review_a_stream_file()
        self.write("extension/stream/x.js", "// A clearer note.\nexport const s = 2;\n")
        self.commit("code after review")
        result = self.run_check(self.body(self.reviewed, tier=2))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("reach tier 2: extension/stream/x.js (high-risk directory)", result.stdout)

    def test_css_escape_change_after_the_sha_fails(self):
        self.review_a_stream_file()
        self.write("extension/stream/x.css", ".\\61  b { color: red; }\n")
        self.commit("escape after review")
        self.reviewed = self.rev("HEAD")[:7]
        self.write("extension/stream/x.css", ".\\61 b { color: red; }\n")
        self.commit("one space fewer after the escape")
        result = self.run_check(self.body(self.reviewed, tier=2))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("reach tier 2: extension/stream/x.css (high-risk directory)", result.stdout)

    def test_tier_zero_pr_needs_no_verdict_item(self):
        self.git("checkout", "-q", "-b", "docs", "main")
        self.write("docs/guide.md", "Guide\n")
        self.commit("docs")
        result = self.run_check("## Review\n\n- **Tier:** 0")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: tier 0 needs no Verdict item", result.stdout)

    def test_comment_only_pr_to_a_tier_two_file_needs_no_verdict_item(self):
        self.git("checkout", "-q", "main")
        self.write("extension/stream/x.js", "export const s = 1;\n")
        self.commit("main adds a stream file")
        self.git("checkout", "-q", "-b", "comments")
        self.write("extension/stream/x.js", "// Why s is 1.\nexport const s = 1;\n")
        self.commit("comment only")
        result = self.run_check("## Review\n\n- **Tier:** 0")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: Tier: 0 is at least the computed tier 0", result.stdout)
        self.assertIn("PASS: tier 0 needs no Verdict item", result.stdout)

    def caps_config(self, caps):
        rows = "".join(f"  '{path}': {cap},\n" for path, cap in caps.items())
        return f"export const maxLines = 500;\n\nexport const maxLinesCaps = {{\n{rows}}};\n"

    def test_raised_cap_without_an_item_fails_and_stays_tier_one(self):
        self.git("checkout", "-q", "main")
        self.write("eslint.config.mjs", self.caps_config({"extension/big.js": 600}))
        self.commit("main caps a file")
        self.git("checkout", "-q", "-b", "raise")
        self.write("eslint.config.mjs", self.caps_config({"extension/big.js": 640}))
        self.commit("raise the cap")
        body = "## Review\n\n- **Tier:** 1\n" + REVIEWED.replace("abc1234", self.rev("HEAD")[:7])
        result = self.run_check(body)
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("FAIL: the PR raises the max-lines cap for extension/big.js from 600 to 640", result.stdout)
        body += "\n- **Cap raised:** `extension/big.js` 600 → 640: the split waits on #1"
        result = self.run_check(body)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: Tier: 1 is at least the computed tier 1", result.stdout)
        self.assertIn("PASS: the PR raises the max-lines cap for extension/big.js from 600 to 640, with its reason", result.stdout)

    def test_cap_added_in_a_new_config_needs_an_item(self):
        self.write("eslint.config.mjs", self.caps_config({"extension/dev/capture.js": 510}))
        self.commit("add a config with a cap")
        result = self.run_check(self.body(self.rev("HEAD")[:7], tier=2))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("adds a max-lines cap of 510 for extension/dev/capture.js", result.stdout)

    def test_merge_base_without_a_caps_literal_asks_to_merge_the_base_in(self):
        self.git("checkout", "-q", "main")
        self.write("eslint.config.mjs", "export default [];\n")
        self.commit("main config before the ratchet")
        self.git("checkout", "-q", "-b", "old")
        self.write("extension/dev/capture.js", "export const a = 3;\n")
        self.commit("work on the old base")
        result = self.run_check(self.body(self.rev("HEAD")[:7]))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("merge the base branch in", result.stderr)
        self.assertNotIn("rebase", result.stderr)

    def test_unreadable_caps_fail_the_check(self):
        self.write("eslint.config.mjs", "export const maxLinesCaps = {\n  ...more,\n};\n")
        self.commit("config the check cannot read")
        result = self.run_check(self.body(self.rev("HEAD")[:7], tier=2))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn("cannot read the maxLinesCaps line", result.stderr)


class WorkflowTest(unittest.TestCase):
    def test_checks_out_the_pr_head_not_the_merge_ref(self):
        # A PR that adds a manifest permission main also added independently is tier 2 on its
        # head but tier 0 on the merge ref, which would waive review.
        workflow = (ROOT / ".github" / "workflows" / "pr-body.yml").read_text(encoding="utf-8")
        self.assertIn("ref: ${{ github.event.pull_request.head.sha }}", workflow)
        self.assertIn("fetch-depth: 0", workflow)

    def test_draft_runs_under_another_name_and_ready_runs_the_check(self):
        # Branch protection counts a skipped required check as passed, so a draft must not
        # skip `pr-body`: it runs under another name, and marking it ready runs the real check.
        workflow = (ROOT / ".github" / "workflows" / "pr-body.yml").read_text(encoding="utf-8")
        self.assertIn("types: [opened, edited, synchronize, reopened, ready_for_review]", workflow)
        self.assertIn(
            "name: ${{ github.event.pull_request.draft && 'pr-body (draft, runs when ready)' || 'pr-body' }}",
            workflow,
        )
        job = workflow.split("  pr-body:\n", 1)[1].split("    steps:\n", 1)[0]
        self.assertNotIn("    if:", job)
        check_step = workflow.split("- name: Check the Review section\n", 1)[1]
        self.assertIn("if: ${{ !github.event.pull_request.draft }}", check_step.splitlines()[0])

    def test_every_step_after_the_first_is_skipped_on_a_draft(self):
        # A draft runs only the echo step; any other unguarded step would run (npm ci, the
        # check) under the draft's name.
        workflow = (ROOT / ".github" / "workflows" / "pr-body.yml").read_text(encoding="utf-8")
        steps = ("\n" + workflow.split("    steps:\n", 1)[1]).split("\n      - ")[1:]
        self.assertGreater(len(steps), 1)
        self.assertIn("if: github.event.pull_request.draft", steps[0].splitlines()[0])
        for step in steps[1:]:
            with self.subTest(step=step.splitlines()[0]):
                guards = [line.strip() for line in step.splitlines() if line.strip().startswith("if:")]
                self.assertEqual(guards, ["if: ${{ !github.event.pull_request.draft }}"])

    def test_installs_node_packages_for_the_javascript_comparison(self):
        # review-tier.py compares JavaScript with espree through node; without `npm ci` the check
        # would error out on any PR whose post-review change touches a .js file.
        workflow = (ROOT / ".github" / "workflows" / "pr-body.yml").read_text(encoding="utf-8")
        steps = workflow.split("- name: Check the Review section\n", 1)[0]
        self.assertIn("uses: actions/setup-node@v4", steps)
        self.assertIn("run: npm ci", steps)


if __name__ == "__main__":
    unittest.main()
