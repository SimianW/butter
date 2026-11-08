const test = require('node:test');
const assert = require('node:assert/strict');
const branch = require('../extension/branch/logic.js');

test('message is a Markdown quote of every selected line, a blank line, then the question', () => {
  assert.equal(
    branch.formatMessage('first line\r\nsecond line\n\nfourth line', '  What does this mean?  '),
    '> first line\n> second line\n> \n> fourth line\n\nWhat does this mean?',
  );
});

test('the full quote is kept, never truncated', () => {
  const long = 'word '.repeat(2000).trim();
  assert.equal(branch.formatMessage(long, 'Why?'), `> ${long}\n\nWhy?`);
});

const SAVED = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
const LOCAL = '0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
test('identity parsing reads saved and unsaved conversation routes, and nothing else', () => {
  assert.equal(branch.identity(`https://chatgpt.com/c/${SAVED}`), SAVED);
  assert.equal(branch.identity(`https://chatgpt.com/c/${SAVED.toUpperCase()}?model=x#y`), SAVED);
  assert.equal(branch.identity(`https://chatgpt.com/g/g-p-abc123/c/${SAVED}`), SAVED);
  assert.equal(
    branch.identity(`https://chatgpt.com/c/local-chatgpt%3A${LOCAL}`),
    `local-chatgpt:${LOCAL}`,
  );
  assert.equal(
    branch.identity(`https://chatgpt.com/c/local-chatgpt:${LOCAL}`),
    `local-chatgpt:${LOCAL}`,
  );
  for (const url of [
    'https://chatgpt.com/',
    'https://chatgpt.com/c/not-a-uuid',
    `https://example.com/c/${SAVED}`,
    `https://chatgpt.com/c/other:${SAVED}`,
    'not a url',
    undefined,
  ])
    assert.equal(branch.identity(url), null, String(url));
  assert.equal(branch.saved(SAVED), true);
  assert.equal(branch.saved(`local-chatgpt:${LOCAL}`), false);
});

test('a branch is a readable identity different from the original', () => {
  assert.equal(branch.isBranch(`local-chatgpt:${LOCAL}`, SAVED), true);
  assert.equal(branch.isBranch(LOCAL, SAVED), true);
  assert.equal(branch.isBranch(SAVED, SAVED), false);
  assert.equal(branch.isBranch(null, SAVED), false);
  assert.equal(branch.isBranch(SAVED, null), false);
});

// In-memory stand-in for chrome.storage.session (same promise API).
const memory = (rows = {}) => ({
  rows,
  get: async (key) => (key === null ? { ...rows } : key in rows ? { [key]: rows[key] } : {}),
  set: async (items) => Object.assign(rows, structuredClone(items)),
  remove: async (keys) => [keys].flat().forEach((key) => delete rows[key]),
});
const ID = '11111111-2222-4333-8444-555555555555';
const origin = { tab: { id: 7, url: `https://chatgpt.com/c/${SAVED}` } };
const dest = { tab: { id: 8, url: `https://chatgpt.com/c/${SAVED}#butter-branch=${ID}` } };
const job = { original: SAVED, title: 'Explain Corpus Meaning', quote: 'a\nb', question: 'Why?' };

test('a handoff job is claimed once by a new tab of the same conversation, then deleted', async () => {
  const store = memory(),
    handoff = branch.handoff(store);
  assert.deepEqual(await handoff.put(ID, job, origin, 1000), { ok: true });
  assert.deepEqual(Object.keys(store.rows), [`butterBranch.${ID}`]);
  assert.deepEqual(await handoff.claim(ID, dest, 2000), { job, origin: 7 });
  assert.deepEqual(store.rows, {});
  assert.deepEqual(await handoff.claim(ID, dest, 2001), { missing: true });
});

test('expired, foreign or malformed jobs are refused and deleted', async () => {
  const store = memory(),
    handoff = branch.handoff(store);
  await handoff.put(ID, job, origin, 1000);
  assert.deepEqual(await handoff.claim(ID, dest, 1000 + branch.TTL), {
    error: 'expired',
    origin: 7,
  });
  assert.deepEqual(store.rows, {});
  // Claimed from the original tab itself: never run the branch where the user is reading.
  await handoff.put(ID, job, origin, 1000);
  assert.deepEqual(await handoff.claim(ID, { tab: { ...origin.tab } }, 1001), {
    error: 'sender',
    origin: 7,
  });
  // Claimed from a tab showing a different conversation.
  await handoff.put(ID, job, origin, 1000);
  const other = { tab: { id: 9, url: `https://chatgpt.com/c/${LOCAL}` } };
  assert.deepEqual(await handoff.claim(ID, other, 1001), { error: 'sender', origin: 7 });
  assert.deepEqual(store.rows, {});
  // Put from a tab that isn't the job's conversation, or with missing text, is refused.
  assert.deepEqual(await handoff.put(ID, job, other, 1000), { error: 'invalid' });
  assert.deepEqual(await handoff.put(ID, { ...job, question: '  ' }, origin, 1000), {
    error: 'invalid',
  });
  assert.deepEqual(await handoff.put('nope', job, origin, 1000), { error: 'invalid' });
  assert.deepEqual(store.rows, {});
});

test('pruning deletes only expired branch jobs', async () => {
  const store = memory({ other: 1 }),
    handoff = branch.handoff(store);
  await handoff.put(ID, job, origin, 1000);
  const fresh = '11111111-2222-4333-8444-666666666666';
  await handoff.put(fresh, job, origin, 1000 + branch.TTL);
  await handoff.prune(1000 + branch.TTL + 1);
  assert.deepEqual(Object.keys(store.rows).sort(), ['butterBranch.' + fresh, 'other']);
});

test('a selection qualifies only as non-empty text inside one reply of a saved conversation', () => {
  const reply = {},
    other = {};
  const page = { temporary: false, work: false, branchAction: true }; // Chat mode, see branch-rules
  const ok = { text: ' corpus ', start: reply, end: reply, identity: SAVED, excluded: false, page };
  assert.equal(branch.qualifies(ok), true);
  assert.equal(branch.qualifies({ ...ok, text: '  \n ' }), false);
  assert.equal(branch.qualifies({ ...ok, end: other }), false);
  assert.equal(branch.qualifies({ ...ok, start: null, end: null }), false);
  assert.equal(branch.qualifies({ ...ok, excluded: true }), false);
  assert.equal(branch.qualifies({ ...ok, identity: null }), false);
  assert.equal(branch.qualifies({ ...ok, identity: `local-chatgpt:${LOCAL}` }), false);
});

test('settings add an Ask in branch key that defaults to on and can be turned off', () => {
  const status = require('../extension/shared/status.js');
  assert.ok(status.keys.includes('branch'));
  assert.equal(status.normalize().opts.branch, true);
  assert.equal(status.normalize({ opts: { rail: false } }).opts.branch, true);
  assert.equal(status.normalize({ opts: { branch: false } }).opts.branch, false);
  assert.equal(status.classify({}, { opts: { branch: false } }).branch, 'off');
});

test('status: menu, identity, load and page-error failures count against the feature; a long reply does not', () => {
  for (const cause of ['more', 'branch', 'newchat', 'identity', 'load', 'error'])
    assert.equal(branch.confirmedFailure(cause), true, cause);
  for (const cause of ['stream', undefined, 'cancelled'])
    assert.equal(branch.confirmedFailure(cause), false);
});

test('ready line: the reply has started once the last reply on the page is one that was not there at send', () => {
  // Keys of the page's replies, in page order, when Butter sent (known) and now.
  const known = ['turn-a', 'turn-b'];
  assert.equal(branch.replyStarted(known, ['turn-a', 'turn-b']), false, 'no reply yet');
  assert.equal(branch.replyStarted(known, []), false, 'replies not mounted');
  assert.equal(
    branch.replyStarted(known, ['turn-0', 'turn-a', 'turn-b']),
    false,
    'older turns loaded above',
  );
  assert.equal(branch.replyStarted(known, ['turn-b']), false, 'earlier turns unmounted');
  assert.equal(
    branch.replyStarted(known, ['turn-a', 'turn-b', 'turn-c']),
    true,
    'a new reply below',
  );
  assert.equal(branch.replyStarted([], ['turn-c']), true, 'first reply of the page');
});

// Quotes with formulas. A small DOM-like tree: text nodes, elements laid out inline, as a line or
// as a paragraph, and KaTeX formulas as ChatGPT renders them (live, 2026-11-07): the selectable
// glyphs, with the LaTeX source kept aside (annotation[encoding="application/x-tex"]).
const tree = (node, parent = null) => {
  node.parentNode = parent;
  for (const child of node.childNodes || []) tree(child, node);
  return node;
};
const t = (data) => ({ nodeType: 3, nodeName: '#text', data });
const el = (layout, ...childNodes) => ({ nodeType: 1, nodeName: 'DIV', layout, childNodes });
const para = (...children) => el('paragraph', ...children);
const formula = (tex, glyphs, display = false) => ({
  nodeType: 1,
  nodeName: 'SPAN',
  layout: display ? 'line' : 'inline',
  formula: { tex, display },
  childNodes: [t(glyphs)],
});
// ChatGPT wraps a display formula in its own line box.
const displayBlock = (tex, glyphs) => el('line', formula(tex, glyphs, true));
const dom = {
  formula: (node) => node.formula || null,
  layout: (node) => node.layout || 'inline',
  pre: () => false,
};
const range = (startContainer, startOffset, endContainer, endOffset) => ({
  startContainer,
  startOffset,
  endContainer,
  endOffset,
});
const STEP = 'x_{k+1}=x_k-\\frac1L\\nabla f(x_k)';

test('quote: an inline formula alone is its LaTeX source between single dollars', () => {
  const p = tree(para(t('The rate is '), formula('O(1/k)', 'O(1/k)'), t(' here.')));
  assert.equal(branch.quoteOf(range(p, 1, p, 2), dom), '$O(1/k)$');
});

test('quote: a display formula alone is its LaTeX source between double dollars', () => {
  const reply = tree(
    el('line', para(t('Gradient descent:')), displayBlock(STEP, 'xk+1=xk−L1∇f(xk)')),
  );
  assert.equal(branch.quoteOf(range(reply, 1, reply, 2), dom), `$$${STEP}$$`);
});

test('quote: text and formulas in document order, display math on its own line', () => {
  const before = t('Gradient descent with step '),
    last = t('.');
  tree(
    el(
      'line',
      para(before, formula('1/L', '1/L'), t(':')),
      displayBlock(STEP, 'xk+1=xk−L1∇f(xk)'),
      para(t('converges at rate '), formula('O(1/k)', 'O(1/k)'), last),
    ),
  );
  assert.equal(
    branch.quoteOf(range(before, 9, last, 1), dom),
    `descent with step $1/L$:\n\n$$${STEP}$$\n\nconverges at rate $O(1/k)$.`,
  );
});

test('quote: a selection that covers only part of a formula quotes the whole formula', () => {
  const lead = t('The rate is '),
    tail = t(' here.');
  const f = formula('O(1/k)', 'O(1/k)');
  const glyphs = f.childNodes[0];
  tree(para(lead, f, tail));
  // From text into the middle of the formula's glyphs.
  assert.equal(branch.quoteOf(range(lead, 4, glyphs, 2), dom), 'rate is $O(1/k)$');
  // From the middle of the formula's glyphs into the text after it.
  assert.equal(branch.quoteOf(range(glyphs, 3, tail, 5), dom), '$O(1/k)$ here');
  // Entirely inside the formula.
  assert.equal(branch.quoteOf(range(glyphs, 1, glyphs, 3), dom), '$O(1/k)$');
});

test('quote: a multi-line display formula keeps its lines, each quoted with "> "', () => {
  const tex = '\\begin{aligned}\n  a &= b \\\\  \n\n  c &= d\n\\end{aligned}';
  const reply = tree(el('line', para(t('So:')), displayBlock(tex, 'a=bc=d')));
  const quote = branch.quoteOf(range(reply, 0, reply, 2), dom);
  // A blank line would end the quoted math block, so blank lines go; trailing spaces too.
  assert.equal(quote, 'So:\n\n$$\\begin{aligned}\n  a &= b \\\\\n  c &= d\n\\end{aligned}$$');
  assert.equal(
    branch.formatMessage(quote, 'Why?'),
    '> So:\n> \n> $$\\begin{aligned}\n>   a &= b \\\\\n>   c &= d\n> \\end{aligned}$$\n\nWhy?',
  );
});

test('quote: a formula without its LaTeX source makes the selection unquotable', () => {
  const p = tree(para(t('See '), formula(null, 'x'), t('.')));
  assert.equal(branch.quoteOf(range(p, 0, p, 3), dom), null);
});
