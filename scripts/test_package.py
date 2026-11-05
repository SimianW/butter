"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile


ROOT = Path(__file__).resolve().parent.parent


class PackageTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        (self.root / "scripts").mkdir()
        for name in ("package.py", "check-version.py"):
            shutil.copyfile(ROOT / "scripts" / name, self.root / "scripts" / name)
        self.extension = self.root / "extension"
        self.extension.mkdir()
        self.write_version()
        (self.extension / "nested").mkdir()
        (self.extension / "nested" / "asset.js").write_bytes(b"asset\n")
        (self.extension / ".hidden").write_bytes(b"excluded")
        (self.extension / ".private").mkdir()
        (self.extension / ".private" / "secret").write_bytes(b"excluded")

    def write_version(self, name="0.1.0-alpha.10", numeric="0.1.0.10"):
        manifest = {"manifest_version": 3, "name": "Butter", "version_name": name, "version": numeric}
        (self.extension / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
        (self.root / "README.md").write_text(f"Current version: **{name}**\n", encoding="utf-8")
        (self.root / "README.zh-CN.md").write_text(f"当前版本：**{name}**\n", encoding="utf-8")
        (self.root / "CHANGELOG.md").write_text(f"## {name} (2026-11-04)\n", encoding="utf-8")

    def run_script(self, script, *args):
        return subprocess.run(
            [sys.executable, str(self.root / "scripts" / script), *args],
            capture_output=True,
            text=True,
            cwd=self.root,
        )

    def package(self, *args):
        result = self.run_script("package.py", *args)
        self.assertEqual(result.returncode, 0, result.stderr)
        return Path(result.stdout.splitlines()[0]), result

    def archive_manifest(self, path):
        with zipfile.ZipFile(path) as archive:
            return json.loads(archive.read("butter/manifest.json"))

    def test_plain_package_preserves_manifest_and_archive_layout(self):
        path, result = self.package()
        self.assertEqual(path.name, "butter-0.1.0-alpha.10.zip")
        self.assertEqual(result.stdout, str(path) + "\n")
        with zipfile.ZipFile(path) as archive:
            self.assertEqual(sorted(archive.namelist()), ["butter/manifest.json", "butter/nested/asset.js"])
            self.assertEqual(archive.read("butter/manifest.json"), (self.extension / "manifest.json").read_bytes())
            self.assertEqual(archive.read("butter/nested/asset.js"), b"asset\n")
        self.package()  # Rebuilding the release archive still overwrites it.

    def test_test_packages_increment_and_leave_source_unchanged(self):
        before = {path: path.read_bytes() for path in self.extension.rglob("*") if path.is_file()}
        for number in (1, 2):
            path, result = self.package("--test", "demo")
            expected_name = f"0.1.0-alpha.10+demo.{number}"
            self.assertEqual(path.name, f"butter-{expected_name}.zip")
            manifest = self.archive_manifest(path)
            self.assertEqual(manifest["version_name"], expected_name)
            self.assertEqual(manifest["version"], "0.1.0.10")
            self.assertEqual(manifest["name"], "Butter")
            self.assertIn("remove the previous install", result.stdout)
        self.assertEqual(before, {path: path.read_bytes() for path in self.extension.rglob("*") if path.is_file()})
        self.assertEqual(self.run_script("check-version.py").returncode, 0)
        plain, _ = self.package()
        self.assertEqual(self.archive_manifest(plain)["version_name"], "0.1.0-alpha.10")

    def test_release_and_test_packages_include_real_locales(self):
        shutil.rmtree(self.extension)
        shutil.copytree(ROOT / "extension", self.extension)
        for args in ((), ("--test", "locales")):
            with self.subTest(args=args):
                path, _ = self.package(*args)
                with zipfile.ZipFile(path) as archive:
                    manifest = json.loads(archive.read("butter/manifest.json"))
                    self.assertEqual(manifest["default_locale"], "en")
                    self.assertEqual(manifest["name"], "__MSG_appName__")
                    self.assertEqual(manifest["description"], "__MSG_appDesc__")
                    for locale in ("en", "zh_CN"):
                        relative = f"_locales/{locale}/messages.json"
                        self.assertEqual(
                            archive.read(f"butter/{relative}"),
                            (self.extension / relative).read_bytes(),
                        )

    def test_numbering_uses_numeric_max_for_exact_base_and_tag(self):
        dist = self.root / "dist"
        dist.mkdir()
        for name in (
            "butter-0.1.0-alpha.10+demo.2.zip",
            "butter-0.1.0-alpha.10+demo.10.zip",
            "butter-0.1.0-alpha.10+demo-extra.99.zip",
            "butter-0.1.0-alpha.11+demo.99.zip",
            "butter-0.1.0-alpha.10+demo.99.zip.backup",
        ):
            (dist / name).touch()
        (dist / "butter-0.1.0-alpha.10+demo.100.zip").mkdir()
        path, _ = self.package("--test", "demo")
        self.assertEqual(path.name, "butter-0.1.0-alpha.10+demo.11.zip")
        other, _ = self.package("--test", "qa-2")
        self.assertEqual(other.name, "butter-0.1.0-alpha.10+qa-2.1.zip")

    def test_invalid_tags_fail_without_creating_archive(self):
        for tag in ("", "Demo", "two words", "demo.1", "../demo", "demo+next", "demo\n"):
            with self.subTest(tag=tag):
                result = self.run_script("package.py", "--test", tag)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("test tag must match [a-z0-9-]+", result.stderr)
                self.assertFalse((self.root / "dist").exists())

    def test_source_build_metadata_is_rejected_by_both_package_modes(self):
        self.write_version("0.1.0-alpha.10+next.3")
        for args in ((), ("--test", "demo")):
            with self.subTest(args=args):
                result = self.run_script("package.py", *args)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("must not contain '+' test-build metadata", result.stderr)
                self.assertFalse((self.root / "dist").exists())

    def test_version_check_explicitly_rejects_source_build_metadata(self):
        self.write_version("0.1.0-alpha.10+next.3")
        result = self.run_script("check-version.py")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must not contain '+' test-build metadata", result.stderr)

    def test_numeric_version_is_preserved_at_first_alpha_and_chrome_limit(self):
        for name, numeric in (("0.1.0-alpha", "0.1.0"), ("0.1.0-alpha.65535", "0.1.0.65535")):
            with self.subTest(name=name):
                self.write_version(name, numeric)
                path, _ = self.package("--test", "demo")
                self.assertEqual(self.archive_manifest(path)["version"], numeric)
                self.assertEqual(self.run_script("check-version.py").returncode, 0)


if __name__ == "__main__":
    unittest.main()
