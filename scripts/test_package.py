"""Run with: python3 -m unittest discover -s scripts -p 'test_*.py'."""
import json
from pathlib import Path
import posixpath
import re
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

    def write_version(self, name="0.1.0-alpha.10", numeric="0.1.0.10", base=None):
        manifest = base or {"manifest_version": 3, "name": "Butter"}
        manifest = {**manifest, "version_name": name, "version": numeric}
        (self.extension / "manifest.json").write_text(json.dumps(manifest) + "\n", encoding="utf-8")
        (self.root / "README.md").write_text(f"Current version: **{name}**\n", encoding="utf-8")
        (self.root / "README.zh-CN.md").write_text(f"当前版本：**{name}**\n", encoding="utf-8")
        (self.root / "CHANGELOG.md").write_text(
            f"# Changelog\n\n## [Unreleased]\n\n### Fixed\n\n- Fixed a thing.\n\n## [{name}] - 2026-11-04\n",
            encoding="utf-8",
        )

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

    def use_real_extension(self):
        shutil.rmtree(self.extension)
        shutil.copytree(ROOT / "extension", self.extension)
        real = json.loads((self.extension / "manifest.json").read_text(encoding="utf-8"))
        self.write_version(base=real)

    def source_commands(self):
        return json.loads((self.extension / "manifest.json").read_text(encoding="utf-8"))["commands"]

    def dev_files(self):
        return sorted(
            "butter/" + path.relative_to(self.extension).as_posix()
            for path in (self.extension / "dev").rglob("*")
            if path.is_file()
        )

    def test_dev_package_adds_dev_files_command_and_downloads_permission(self):
        self.use_real_extension()
        dev_files = self.dev_files()
        self.assertIn("butter/dev/recorder.js", dev_files)
        self.assertIn("butter/dev/allowlist.js", dev_files)
        self.assertIn("butter/dev/rail-trace.js", dev_files)
        self.assertIn("butter/dev/sources.js", dev_files)
        self.assertIn("butter/dev/toast.js", dev_files)
        before = {path: path.read_bytes() for path in self.extension.rglob("*") if path.is_file()}
        for number in (1, 2):
            path, result = self.package("--dev")
            expected_name = f"0.1.0-alpha.10+dev.{number}"
            self.assertEqual(path.name, f"butter-{expected_name}.zip")
            self.assertIn("remove the previous install", result.stdout)
            with zipfile.ZipFile(path) as archive:
                names = set(archive.namelist())
                manifest = json.loads(archive.read("butter/manifest.json"))
            self.assertTrue(set(dev_files) <= names)
            self.assertEqual(manifest["version_name"], expected_name)
            self.assertEqual(manifest["version"], "0.1.0.10")
            self.assertIn("downloads", manifest["permissions"])
            command = manifest["commands"]["save-bug"]
            self.assertEqual(command["suggested_key"]["default"], "Alt+Shift+B")
            self.assertEqual(command["suggested_key"]["mac"], "Alt+Shift+B")
            # The dev build keeps the store's bookmark shortcut beside its own.
            self.assertEqual(manifest["commands"]["bookmark"], self.source_commands()["bookmark"])
            # Every script the dev manifest names is in the zip, after the store scripts it hooks.
            isolated, main = manifest["content_scripts"]
            self.assertEqual(isolated["js"][-2:], ["dev/content.js", "dev/toast.js"])
            self.assertLess(isolated["js"].index("shared/status.js"), isolated["js"].index("dev/toast.js"))
            # The rail trace defines the hook before rail/rail.js starts, and after the modules it
            # is handed.
            self.assertEqual(
                isolated["js"].index("dev/rail-trace.js"), isolated["js"].index("rail/rail.js") - 1
            )
            self.assertLess(isolated["js"].index("rail/jump.js"), isolated["js"].index("dev/rail-trace.js"))
            self.assertEqual(
                main["js"][-4:],
                ["dev/allowlist.js", "dev/recorder.js", "dev/sources.js", "dev/recorder-main.js"],
            )
            # The recorder listens to both hook owners, so it runs after the last of them.
            for hooked in ("seek/layout-cache-main.js", "seek/preview-main.js"):
                self.assertLess(main["js"].index(hooked), main["js"].index("dev/recorder.js"))
            self.assertLess(main["js"].index("seek/preview-main.js"), main["js"].index("dev/recorder-main.js"))
            worker = manifest["background"]["service_worker"]
            self.assertEqual(worker, "dev/worker.js")
            for script in [*isolated["js"], *main["js"], worker]:
                self.assertIn(f"butter/{script}", names)
        self.assertEqual(before, {path: path.read_bytes() for path in self.extension.rglob("*") if path.is_file()})
        self.assertEqual(self.run_script("check-version.py").returncode, 0)

    def test_dev_popup_loads_the_dev_card_before_popup_js(self):
        self.use_real_extension()
        path, _ = self.package("--dev")
        with zipfile.ZipFile(path) as archive:
            names = set(archive.namelist())
            html = archive.read("butter/popup/popup.html").decode()
        self.assertIn("butter/dev/popup.js", names)
        self.assertIn("butter/dev/popup.css", names)
        # The dev stylesheet follows popup.css; the dev script defines its renderer before
        # popup.js's first render, and every popup script still loads.
        self.assertLess(html.index('href="popup.css"'), html.index('href="../dev/popup.css"'))
        scripts = re.findall(r'<script src="([^"]+)" defer></script>', html)
        self.assertEqual(scripts, ["../shared/status.js", "model.js", "../dev/popup.js", "popup.js"])
        for script in scripts:
            self.assertIn("butter/" + posixpath.normpath(posixpath.join("popup", script)), names)

    def test_store_and_test_popups_load_no_dev_script(self):
        self.use_real_extension()
        source = (self.extension / "popup" / "popup.html").read_bytes()
        self.assertNotIn(b"dev/", source)
        for args in ((), ("--test", "demo")):
            with self.subTest(args=args):
                path, _ = self.package(*args)
                with zipfile.ZipFile(path) as archive:
                    self.assertEqual(archive.read("butter/popup/popup.html"), source)

    def test_store_and_test_packages_leave_dev_build_out(self):
        self.use_real_extension()
        source = json.loads((self.extension / "manifest.json").read_text(encoding="utf-8"))
        # The store manifest's only command is the bookmark shortcut; save-bug is dev-only.
        self.assertEqual(list(source["commands"]), ["bookmark"])
        self.assertNotIn("downloads", source["permissions"])
        self.package("--dev")
        for args in ((), ("--test", "demo")):
            with self.subTest(args=args):
                path, _ = self.package(*args)
                with zipfile.ZipFile(path) as archive:
                    names = archive.namelist()
                    manifest = json.loads(archive.read("butter/manifest.json"))
                    contents = b"".join(archive.read(name) for name in names)
                self.assertEqual([name for name in names if name.startswith("butter/dev/")], [])
                # The rail only reads its trace hook; nothing defines it or relays its events.
                self.assertNotIn(b"butter-dev-rail", contents)
                self.assertNotIn(b"__butterRailTrace =", contents)
                self.assertNotIn("butter/dev/toast.js", names)
                self.assertEqual(manifest["commands"], source["commands"])
                self.assertNotIn("downloads", manifest["permissions"])
                self.assertEqual(manifest["background"], source["background"])
                self.assertEqual(manifest["content_scripts"], source["content_scripts"])
                self.assertNotIn("dev", json.dumps(manifest["content_scripts"]))

    def test_dev_package_needs_both_content_script_entries(self):
        result = self.run_script("package.py", "--dev")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected the isolated content scripts first", result.stderr)
        self.assertFalse(any((self.root / "dist").glob("*.zip")))

    def test_dev_and_test_flags_cannot_be_combined(self):
        result = self.run_script("package.py", "--dev", "--test", "demo")
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.root / "dist").exists())

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

    def test_version_check_requires_the_unreleased_heading_first(self):
        (self.root / "CHANGELOG.md").write_text("## [0.1.0-alpha.10] - 2026-11-04\n", encoding="utf-8")
        result = self.run_script("check-version.py")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected '## [Unreleased]'", result.stderr)

    def test_version_check_reads_the_version_entry_below_unreleased(self):
        for entry in ("## [0.1.0-alpha.9] - 2026-11-04", "## [0.1.0-alpha.10] - 2026-13-40", ""):
            with self.subTest(entry=entry):
                (self.root / "CHANGELOG.md").write_text(f"## [Unreleased]\n\n{entry}\n", encoding="utf-8")
                result = self.run_script("check-version.py")
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("expected '## [0.1.0-alpha.10] - YYYY-MM-DD'", result.stderr)


if __name__ == "__main__":
    unittest.main()
