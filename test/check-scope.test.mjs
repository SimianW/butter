// `npm run check` judges only the repo's own files, so a developer's local files (git-ignored
// folders, lab scratch scripts, agent worktrees under .claude/) cannot make it fail. Imports
// ESLint, so it needs `npm ci`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { globSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (file) => readFileSync(root + file, 'utf8');

test('ESLint skips every git-ignored folder and agent worktrees', async () => {
  const eslint = new ESLint({ cwd: root });
  const folders = read('.gitignore')
    .split('\n')
    .filter((line) => /^[^#!*\s][^*\s]*\/$/.test(line));
  assert.ok(folders.includes('lab/harness/scratch/'));
  for (const path of [
    ...folders.map((f) => f + 'probe.js'),
    '.claude/worktrees/w/extension/a.js',
  ]) {
    assert.equal(await eslint.isPathIgnored(path), true, `${path} is linted`);
  }
  for (const path of ['extension/probe.js', 'test/probe.test.js', 'lab/harness/probe.mjs']) {
    assert.equal(await eslint.isPathIgnored(path), false, `${path} is not linted`);
  }
});

test('npm test runs every test file in test/, and no helper or file outside test/', () => {
  const command = JSON.parse(read('package.json')).scripts.test;
  const pattern = /^node --test '([^']+)'$/.exec(command)?.[1];
  assert.ok(pattern, `npm test is node --test with one quoted pattern: ${command}`);
  const run = globSync(pattern, { cwd: root }).sort();
  const files = globSync('test/**/*.{cjs,js,mjs}', { cwd: root })
    .filter((file) => !/^test\/(helpers|fixtures)\//.test(file))
    .sort();
  assert.deepEqual(run, files);
});

test('npm run check and CI run the tests through npm test', () => {
  assert.match(JSON.parse(read('package.json')).scripts.check, /&& npm test &&/);
  const workflow = read('.github/workflows/check.yml');
  assert.match(workflow, /^\s+- run: npm test$/m);
  assert.doesNotMatch(workflow, /node --test/);
});
