// Agents read AGENTS.md and docs/development.md at the start of most tasks, so both stay small.
// 46,000 bytes is about the most one read_file call returns for the Gemini agents.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

const HOW_TO_SHRINK =
  'move a section that only some tasks need into docs/agents/<topic>.md and leave a one-line pointer to it';

test('docs/development.md stays within 46,000 bytes', () => {
  const limit = 46_000;
  const bytes = readFileSync(root + 'docs/development.md').length;
  assert.ok(
    bytes <= limit,
    `docs/development.md is ${bytes} bytes, over its ${limit}-byte limit: ${HOW_TO_SHRINK}`,
  );
});

test('AGENTS.md stays within 100 lines', () => {
  const limit = 100;
  const text = readFileSync(root + 'AGENTS.md', 'utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  assert.ok(
    lines <= limit,
    `AGENTS.md is ${lines} lines, over its ${limit}-line limit: ${HOW_TO_SHRINK}`,
  );
});
