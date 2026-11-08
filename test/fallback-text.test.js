const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/seek/core-main.js');

// History markdown reaches the unseen/estimated fallback as plain text; it must read like prose.
test('fallback text drops citation tags and shows list items as bullets', () => {
  assert.equal(
    core.fallbackText('- Example <Cite refs={["a", "b/c"]}/>.\n* **Bold** item\n  + nested'),
    '• Example.\n• Bold item\n  • nested',
  );
  assert.equal(
    core.fallbackText('1. First <Cite refs={["x"]} />\n2. Second'),
    '1. First\n2. Second',
  );
  assert.equal(core.fallbackText('## Heading <Cite refs={[]}/>'), 'Heading');
  assert.equal(core.fallbackText('---\n**a** * b - c'), '---\na * b - c');
});
