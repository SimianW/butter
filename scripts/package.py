#!/usr/bin/env python3
"""Zip extension/ into dist/butter-<version_name>.zip with a butter/ root.

--test <tag> adds +<tag>.<N> to the archive name and its manifest's version_name,
using the next number among existing archives for this base version and tag.
The source manifest is never changed.

Test builds retain the base numeric version. Chrome compares at most four
integers (each <= 65535), padding missing components with zero. There is no
version between X.Y.Z.N and the next alpha's X.Y.Z.(N+1), including the first
alpha X.Y.Z (equivalent to X.Y.Z.0). A fifth component is invalid. Consequently
tests cannot be ordered above the base and below the next alpha; remove the
previous install before loading a test build unpacked from its zip.
"""
import argparse
import json
import os
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def package(root, tag=None):
    if tag is not None and not re.fullmatch(r"[a-z0-9-]+", tag):
        raise ValueError("test tag must match [a-z0-9-]+")

    extension = root / "extension"
    manifest_path = extension / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    version = manifest.get("version_name", manifest["version"])
    if "+" in version:
        raise ValueError(
            "source manifest version_name must not contain '+' test-build metadata; "
            "use --test <tag> with the unchanged base manifest"
        )

    dist = root / "dist"
    dist.mkdir(exist_ok=True)
    if tag is not None:
        pattern = re.compile(rf"butter-{re.escape(version)}\+{re.escape(tag)}\.([0-9]+)\.zip")
        numbers = [
            int(match[1])
            for path in dist.iterdir()
            if path.is_file() and (match := pattern.fullmatch(path.name))
        ]
        version = f"{version}+{tag}.{max(numbers, default=0) + 1}"
        manifest["version_name"] = version

    out = dist / f"butter-{version}.zip"
    with zipfile.ZipFile(out, "x" if tag is not None else "w", zipfile.ZIP_DEFLATED) as archive:
        for directory, dirs, files in os.walk(extension):
            dirs[:] = sorted(name for name in dirs if not name.startswith("."))
            for name in sorted(files):
                if name.startswith("."):
                    continue
                path = Path(directory) / name
                archive_name = "butter/" + path.relative_to(extension).as_posix()
                if tag is not None and path == manifest_path:
                    archive.writestr(archive_name, json.dumps(manifest, indent=2) + "\n")
                else:
                    archive.write(path, archive_name)
    return out, manifest["version"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--test", metavar="TAG", help="build a numbered test zip without consuming an alpha")
    args = parser.parse_args()
    try:
        out, numeric_version = package(ROOT, args.test)
    except (ValueError, OSError) as error:
        parser.exit(1, f"error: {error}\n")
    print(out)
    if args.test is not None:
        print(f"Note: Chrome version remains {numeric_version}; remove the previous install before loading this test build.")


if __name__ == "__main__":
    main()
