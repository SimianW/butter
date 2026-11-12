// Tell whether pairs of JavaScript sources differ only in comments and whitespace.
//
// Usage: node scripts/same-code.mjs < pairs.json
//
// Reads a JSON array of [before, after] source strings on stdin and prints a JSON array with one
// boolean per pair. A pair is the same code when, under every source type (module, script) that
// parses either side, both sides parse and give the same tokens (type and raw value, comments
// left out) and the same syntax tree (positions left out). The tree catches line breaks that
// change meaning through automatic semicolon insertion, such as `return\nx` against `return x`.
// A side that fails to parse makes the pair differ, and so does a changed `#!` first line, which
// espree reads as a comment. scripts/review-tier.py runs this; exits 2 with a message when espree
// is missing.
import { readFileSync } from 'node:fs';

let espree;
try {
  espree = await import('espree');
} catch (error) {
  process.stderr.write(`same-code: cannot load espree (${error.message}); run npm ci\n`);
  process.exit(2);
}

const SOURCE_TYPES = ['module', 'script'];
const POSITION_KEYS = new Set(['start', 'end', 'loc', 'range']);

// The tokens and tree of code as one string, or null when it does not parse as sourceType.
function shape(code, sourceType) {
  let ast;
  try {
    ast = espree.parse(code, { ecmaVersion: 'latest', sourceType, tokens: true });
  } catch {
    return null;
  }
  const tokens = ast.tokens.map((token) => [token.type, token.value]);
  delete ast.tokens;
  const tree = JSON.stringify(ast, (key, value) => {
    if (POSITION_KEYS.has(key)) return undefined;
    if (typeof value === 'bigint') return `${value}n`;
    return value;
  });
  return JSON.stringify(tokens) + '\n' + tree;
}

// The first line when code starts with a shebang (`#!`), which espree reads as a comment, else ''.
function shebang(code) {
  return code.startsWith('#!') ? code.split(/[\r\n\u2028\u2029]/, 1)[0] : '';
}

function sameCode(before, after) {
  if (shebang(before) !== shebang(after)) return false;
  let parsed = false;
  for (const sourceType of SOURCE_TYPES) {
    const a = shape(before, sourceType);
    const b = shape(after, sourceType);
    if (a === null && b === null) continue;
    if (a !== b) return false;
    parsed = true;
  }
  return parsed;
}

const pairs = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(
  JSON.stringify(pairs.map(([before, after]) => sameCode(before, after))) + '\n',
);
