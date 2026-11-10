#!/usr/bin/env python3
"""Check the manifest's version mapping and the version sites documented in AGENTS.md."""
import datetime
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent.parent
NUMBER = r"(?:0|[1-9][0-9]*)"
VERSION_NAME = re.compile(
    rf"(?P<base>{NUMBER}\.{NUMBER}\.{NUMBER})(?:-alpha(?:\.(?P<alpha>{NUMBER}))?)?"
)
CHROME_VERSION = re.compile(rf"{NUMBER}(?:\.{NUMBER}){{0,3}}")


def check(root):
    errors = []

    def read(relative):
        try:
            return (root / relative).read_text(encoding="utf-8")
        except (OSError, UnicodeError) as error:
            errors.append(f"{relative}: {error}")
            return None

    manifest_text = read("extension/manifest.json")
    manifest = {}
    if manifest_text is not None:
        try:
            manifest = json.loads(manifest_text)
            if not isinstance(manifest, dict):
                errors.append("extension/manifest.json: expected a JSON object")
                manifest = {}
        except json.JSONDecodeError as error:
            errors.append(f"extension/manifest.json: invalid JSON: {error}")

    name = manifest.get("version_name")
    version = manifest.get("version")
    match = VERSION_NAME.fullmatch(name) if isinstance(name, str) else None
    if isinstance(name, str) and "+" in name:
        errors.append(
            "extension/manifest.json: version_name must not contain '+' test-build metadata; "
            "keep the base version in source and use scripts/package.py --test <tag>"
        )
    elif not match:
        errors.append(
            f"extension/manifest.json: version_name {name!r} must be X.Y.Z, X.Y.Z-alpha, or X.Y.Z-alpha.N (SemVer)"
        )
    valid_chrome = isinstance(version, str) and CHROME_VERSION.fullmatch(version)
    if not valid_chrome:
        errors.append(f"extension/manifest.json: version {version!r} must contain 1–4 dot-separated integers")
    if match:
        base = match["base"]
        if "-alpha" in name:
            expected = base if match["alpha"] is None else f"{base}.{match['alpha']}"
            if version != expected:
                errors.append(f"extension/manifest.json: version {version!r} must be {expected!r} for {name}")
        elif valid_chrome:
            parts = version.split(".")
            if len(parts) != 4 or ".".join(parts[:3]) != base or int(parts[3]) < 1:
                errors.append(f"extension/manifest.json: stable {name} requires version {base}.M with integer M >= 1")

    for relative, label in (("README.md", "Current version: "), ("README.zh-CN.md", "当前版本：")):
        content = read(relative)
        if content is not None and isinstance(name, str):
            expected = f"{label}**{name}**"
            if expected not in content:
                errors.append(f"{relative}: missing {expected!r}")

    changelog = read("CHANGELOG.md")
    if changelog is not None:
        first = next((line for line in changelog.splitlines() if line.startswith("## ")), None)
        heading = re.fullmatch(r"## \[(.+)\] - ([0-9]{4}-[0-9]{2}-[0-9]{2})", first or "")
        valid_date = False
        if heading:
            try:
                datetime.date.fromisoformat(heading[2])
                valid_date = True
            except ValueError:
                pass
        if not heading or heading[1] != name or not valid_date:
            errors.append(f"CHANGELOG.md: first ## heading is {first!r}; expected '## [{name}] - YYYY-MM-DD' with a valid date")

    return name, version, errors


def main():
    name, version, errors = check(ROOT)
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"OK: {name} / {version}; manifest, READMEs, and changelog agree.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
