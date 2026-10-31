#!/usr/bin/env python3
"""Zip extension/ into dist/chatgpt-turbo-<version>.zip. The zip holds one folder, chatgpt-turbo/,
which is what you pick in chrome://extensions > Load unpacked after unzipping (Windows, macOS, Linux)."""
import json
import os
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXT = os.path.join(ROOT, 'extension')
manifest = json.load(open(os.path.join(EXT, 'manifest.json')))
version = manifest.get('version_name', manifest['version'])   # e.g. 0.0.1-alpha
os.makedirs(os.path.join(ROOT, 'dist'), exist_ok=True)
out = os.path.join(ROOT, 'dist', f'chatgpt-turbo-{version}.zip')
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for name in sorted(os.listdir(EXT)):
        path = os.path.join(EXT, name)
        if os.path.isfile(path) and not name.startswith('.'):
            z.write(path, f'chatgpt-turbo/{name}')
print(out)
