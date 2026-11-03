import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const extension = new URL('../extension/', import.meta.url);

test('every relative asset the popup loads exists next to the popup page', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', extension), 'utf8'));
  const page = new URL(manifest.action.default_popup, extension);
  const html = await readFile(page, 'utf8');
  const script = await readFile(new URL('popup.js', page), 'utf8');
  const refs = [
    ...[...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]),
    script.match(/const ICON = '([^']+)'/)[1],
  ];
  for (const ref of refs) {
    const file = fileURLToPath(new URL(ref, page));
    assert.ok(existsSync(file), `popup asset is missing: ${ref}`);
  }
});
