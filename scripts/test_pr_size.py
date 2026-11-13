import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SPEC = importlib.util.spec_from_file_location("pr_size", Path(__file__).with_name("pr-size.py"))
pr_size = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(pr_size)


class ChangedLinesTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        self.git("init", "-q")
        self.git("commit", "-q", "--allow-empty", "-m", "base")

    def git(self, *args, cwd=None):
        identity = ("-c", "user.name=test", "-c", "user.email=test@example.com")
        subprocess.run(["git", *identity, *args], cwd=cwd or self.root, check=True, capture_output=True)

    def test_untracked_paths_that_cannot_be_read_count_no_lines(self):
        (self.root / "code.py").write_text("one\ntwo\n", encoding="utf-8")
        os.symlink("missing-target", self.root / "dangling.py")
        nested = self.root / "nested"
        nested.mkdir()
        self.git("init", "-q", cwd=nested)
        self.git("commit", "-q", "--allow-empty", "-m", "nested", cwd=nested)

        lines = dict(pr_size.changed_lines("HEAD", self.root))

        self.assertEqual(lines, {"code.py": 2, "dangling.py": 0, "nested/": 0})


if __name__ == "__main__":
    unittest.main()
