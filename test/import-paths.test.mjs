// Scripts import packages by name from the root install (`npm ci`), never by a path into a
// node_modules folder: such a path breaks when that folder moves (it did: lab/harness/node_modules).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function* scripts(dir) {
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') yield* scripts(path);
    } else if (/\.(js|mjs|cjs)$/.test(entry.name)) yield path;
  }
}

test('no script imports a path into node_modules', () => {
  const bad = [];
  for (const dir of ['design', 'lab', 'scripts', 'test']) {
    for (const file of scripts(dir)) {
      const text = readFileSync(join(root, file), 'utf8');
      for (const m of text.matchAll(
        /(?:from|import\(|require\()\s*['"]([^'"]*node_modules\/[^'"]*)['"]/g,
      )) {
        bad.push(`${file}: ${m[1]}`);
      }
    }
  }
  assert.deepEqual(bad, []);
});
