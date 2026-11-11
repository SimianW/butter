// The max-lines caps in eslint.config.mjs only ratchet down: a capped file may shrink, and its cap
// must follow it. Imports the config, so it needs `npm ci` (for `globals`).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { maxLines, maxLinesCaps } from '../eslint.config.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));

// Same count as ESLint's max-lines with its defaults: every line, minus the empty one after a
// final line break.
function countLines(text) {
  const lines = text.split(/\r\n|[\r\n\u2028\u2029]/);
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  return lines.length;
}

test('countLines matches ESLint max-lines counting', () => {
  assert.equal(countLines('a\nb\n'), 2);
  assert.equal(countLines('a\nb'), 2);
  assert.equal(countLines('a\r\n\nb\n'), 3);
});

for (const [file, cap] of Object.entries(maxLinesCaps)) {
  test(`max-lines cap for ${file} is still needed and tight`, () => {
    const path = root + file;
    assert.ok(existsSync(path), `${file} no longer exists: drop its cap in eslint.config.mjs`);
    const lines = countLines(readFileSync(path, 'utf8'));
    assert.ok(
      lines > maxLines,
      `${file} has ${lines} lines, within the default ${maxLines}: drop its cap in eslint.config.mjs`,
    );
    assert.ok(
      cap <= lines,
      `${file} has ${lines} lines but its cap is ${cap}: lower the cap in eslint.config.mjs to ${lines}`,
    );
  });
}
