#!/usr/bin/env python3
"""Zip extension/ into dist/butter-<version>.zip. The zip holds one folder, butter/,
which is what you pick in chrome://extensions > Load unpacked after unzipping (Windows, macOS, Linux)."""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(ROOT, 'extension')
manifest = json.load(open(os.path.join(EXT, 'manifest.json')))
version = manifest.get('version_name', manifest['version'])   # e.g. 0.0.1-alpha
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', f'butter-{version}.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for d, dirs, files in os.walk(EXT):
        dirs[:] = sorted(x for x in dirs if not x.startswith('.'))
        for name in sorted(files):
            if not name.startswith('.'):
                path = os.path.join(d, name)
                z.write(path, 'butter/' + os.path.relpath(path, EXT).replace(os.sep, '/'))
print(out)
