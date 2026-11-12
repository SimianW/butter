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

REVIEWED = "- **Verdict:** approved at `abc1234`"
REVIEWERS = "- **Reviewers:** gpt-6.1-sol ×3 → claude-fable-5-2 ×1"


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
            "Reviewed with review-loop: 3 rounds with gpt-6.1-sol on high at 060d43c. Verdict: approved"
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
        self.assertIn("another review-loop round", result.stdout)

    def test_tier_one_change_after_the_sha_fails(self):
        self.write("extension/dev/capture.js", "export const a = 3;\n")
        self.commit("after review")
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 1, result.stdout)
        self.assertIn(f"FAIL: changes after the reviewed commit {self.reviewed} reach tier 1", result.stdout)
        self.assertIn("extension/dev/capture.js", result.stdout)
        self.assertIn("update the sha in the Verdict item", result.stdout)

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

    def test_rebased_onto_a_newer_base_passes(self):
        self.share_a_file_with_main()
        self.git("rebase", "-q", "main")
        self.assertNotEqual(self.rev("HEAD")[:7], self.reviewed)
        result = self.run_check(self.body(self.reviewed))
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: nothing changed after the reviewed commit", result.stdout)

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

    def test_tier_zero_pr_needs_no_verdict_item(self):
        self.git("checkout", "-q", "-b", "docs", "main")
        self.write("docs/guide.md", "Guide\n")
        self.commit("docs")
        result = self.run_check("## Review\n\n- **Tier:** 0")
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("PASS: tier 0 needs no Verdict item", result.stdout)


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

    def test_installs_node_packages_for_the_javascript_comparison(self):
        # review-tier.py compares JavaScript with espree through node; without `npm ci` the check
        # would error out on any PR whose post-review change touches a .js file.
        workflow = (ROOT / ".github" / "workflows" / "pr-body.yml").read_text(encoding="utf-8")
        steps = workflow.split("- name: Check the Review section\n", 1)[0]
        self.assertIn("uses: actions/setup-node@v4", steps)
        self.assertIn("run: npm ci", steps)


if __name__ == "__main__":
    unittest.main()
