// Ask in branch: where the button may appear, and how ChatGPT's menus are recognised.
// Expected values come from the live page (notes/runs/2026-11-07-ask-in-branch-29/report.md).
const test = require('node:test');
const assert = require('node:assert/strict');
const branch = require('../extension/branch/logic.js');

const SAVED = '6ae40607-3240-83ea-8f5b-c8c6b15f1e78';
const LOCAL = 'local-chatgpt:0f9e2c4a-1b2c-4d3e-8f4a-5b6c7d8e9f00';
const reply = {};
const chat = { temporary: false, work: false, branchAction: true };
const selection = (page, identity = SAVED) => ({
  text: 'corpus',
  start: reply,
  end: reply,
  identity,
  excluded: false,
  page,
});

test('the button is offered in a saved Chat-mode conversation that has a branch action', () => {
  assert.equal(branch.qualifies(selection(chat)), true);
  assert.equal(branch.hiddenReason({ identity: SAVED, ...chat }), null);
});

test('no button in Temporary Chat', () => {
  assert.equal(branch.qualifies(selection({ ...chat, temporary: true })), false);
  assert.equal(branch.hiddenReason({ identity: SAVED, ...chat, temporary: true }), 'temporary');
});

test('no button in an unsaved new chat (no conversation id, or an unsaved local branch)', () => {
  assert.equal(branch.qualifies(selection(chat, null)), false);
  assert.equal(branch.qualifies(selection(chat, LOCAL)), false);
  assert.equal(branch.hiddenReason({ identity: LOCAL, ...chat }), 'unsaved');
});

test('no button in Work/Codex mode', () => {
  assert.equal(branch.qualifies(selection({ ...chat, work: true })), false);
  assert.equal(branch.hiddenReason({ identity: SAVED, ...chat, work: true }), 'work');
});

test('no button when ChatGPT shows no branch action; unknown (reply still streaming) is allowed', () => {
  assert.equal(branch.qualifies(selection({ ...chat, branchAction: false })), false);
  assert.equal(
    branch.hiddenReason({ identity: SAVED, ...chat, branchAction: false }),
    'no-branch-action',
  );
  assert.equal(branch.qualifies(selection({ ...chat, branchAction: null })), true);
});

test('page facts are required: without them the button is not offered', () => {
  assert.equal(branch.qualifies(selection(undefined)), false);
});

test('Temporary Chat is read from the URL', () => {
  assert.equal(branch.temporaryUrl('https://chatgpt.com/?temporary-chat=true'), true);
  assert.equal(branch.temporaryUrl(`https://chatgpt.com/c/${SAVED}?temporary-chat=true`), true);
  assert.equal(branch.temporaryUrl(`https://chatgpt.com/c/${SAVED}`), false);
  assert.equal(branch.temporaryUrl('https://chatgpt.com/?temporary-chat=false'), false);
  assert.equal(branch.temporaryUrl('nonsense'), false);
});

// Live, 2026-11-07: Chat mode's composer <form> has data-composer-placement and
// data-chatgpt-composer; Work mode's has only data-composer-placement. Work mode's composer is
// labelled "Work with ChatGPT" / "使用 ChatGPT Work", and its selection toolbar adds
// "Ask in side chat" / "在侧边聊天中提问" next to "Ask ChatGPT".
test('Work mode is recognised by the composer form first, then by labels', () => {
  const chatForm = { placement: true, chat: true };
  const workForm = { placement: true, chat: false };
  assert.equal(branch.isWorkMode({ composer: chatForm, label: 'Ask ChatGPT' }), false);
  assert.equal(branch.isWorkMode({ composer: chatForm, label: '询问 ChatGPT' }), false);
  // Structural: holds whatever the composer is labelled.
  assert.equal(branch.isWorkMode({ composer: workForm, label: 'Arbeiten mit ChatGPT' }), true);
  // ChatGPT renamed both attributes: fall back to the labels.
  const unknown = { placement: false, chat: false };
  assert.equal(branch.isWorkMode({ composer: unknown, label: 'Ask ChatGPT' }), false);
  assert.equal(branch.isWorkMode({ composer: unknown, label: 'Work with ChatGPT' }), true);
  assert.equal(branch.isWorkMode({ composer: unknown, label: '使用 ChatGPT Work' }), true);
  assert.equal(branch.isWorkMode({ composer: chatForm, label: 'x', sideChat: true }), true);
  assert.equal(branch.isWorkMode({ composer: null, label: null }), false);
});

test('the side-chat button of Work mode is recognised in English and Simplified Chinese', () => {
  assert.equal(branch.labels.sideChat.test('Ask in side chat'), true);
  assert.equal(branch.labels.sideChat.test('在侧边聊天中提问'), true);
  assert.equal(branch.labels.sideChat.test('Ask ChatGPT'), false);
  for (const ask of ['Ask ChatGPT', '向 ChatGPT 提问'])
    assert.equal(branch.labels.nativeAsk.test(ask), true, ask);
});

// Menus, as page.js describes them: { popup, icons, label, testid }.
const item = (label, o = {}) => ({ popup: false, icons: [], label, ...o });
const ICON = (name) => `/cdn/assets/icons.svg#codex-icon-${name}-light-16`;
const menus = {
  en: {
    actions: [
      item('Copy message'),
      item('Share', { icons: [ICON('arrow-up-open-base')] }),
      item('More actions', { icons: [ICON('ellipsis-horizontal')] }),
    ],
    top: [
      item('Wednesday, 1:50 PM'),
      item('Regenerate response', {
        popup: true,
        icons: [ICON('arrows-clockwise-rotate-lg'), ICON('chevron-right-md')],
      }),
      item('Branch conversation', {
        popup: true,
        icons: [ICON('branch'), ICON('chevron-right-md')],
      }),
    ],
    sub: [item('Branch into Work mode'), item('Branch in new chat')],
  },
  zh: {
    actions: [
      item('共享提示', { icons: [ICON('arrow-up-open-base')] }),
      item('更多操作', { icons: [ICON('ellipsis-horizontal')] }),
    ],
    top: [
      item('星期三，13:50'),
      item('重新生成回复', {
        popup: true,
        icons: [ICON('arrows-clockwise-rotate-lg'), ICON('chevron-right-md')],
      }),
      item('创建对话分支', { popup: true, icons: [ICON('branch'), ICON('chevron-right-md')] }),
    ],
    sub: [item('在工作模式中创建分支'), item('在新聊天中创建分支')],
  },
};

for (const [lang, m] of Object.entries(menus))
  test(`menus are matched in ${lang}: More actions, Branch conversation, Branch in new chat`, () => {
    assert.equal(branch.pick(m.actions, 'more'), m.actions.at(-1));
    assert.equal(branch.pick(m.top, 'branch'), m.top[2]);
    assert.equal(branch.pick(m.sub, 'newchat'), m.sub[1]);
  });

test('structural cues win over labels: icons find More and Branch in any language', () => {
  const ja = {
    actions: [item('コピー'), item('その他の操作', { icons: [ICON('ellipsis-horizontal')] })],
    top: [
      item('再生成', { popup: true, icons: [ICON('arrows-clockwise-rotate-lg')] }),
      item('会話を分岐', { popup: true, icons: [ICON('branch')] }),
    ],
  };
  assert.equal(branch.pick(ja.actions, 'more'), ja.actions[1]);
  assert.equal(branch.pick(ja.top, 'branch'), ja.top[1]);
  // A ChatGPT test id is structural too.
  const withId = [item('?', { testid: 'message-more-button' })];
  assert.equal(branch.pick(withId, 'more'), withId[0]);
  // The icon match is preferred over a label match elsewhere in the same menu.
  const both = [
    item('Branch conversation', { popup: true }),
    item('?', { popup: true, icons: [ICON('branch')] }),
  ];
  assert.equal(branch.pick(both, 'branch'), both[1]);
});

test('labels are a fallback when ChatGPT drops the icons', () => {
  assert.equal(
    branch.pick([item('Branch conversation', { popup: true })], 'branch')?.label,
    'Branch conversation',
  );
  assert.equal(
    branch.pick([item('创建对话分支', { popup: true })], 'branch')?.label,
    '创建对话分支',
  );
  assert.equal(branch.pick([item('更多操作')], 'more')?.label, '更多操作');
});

test('"Branch in new chat" is never confused with Work mode, a submenu, or menu position', () => {
  for (const m of Object.values(menus)) {
    assert.equal(branch.pick([m.sub[0]], 'newchat'), null, 'the Work-mode leaf alone');
    assert.equal(branch.pick([...m.sub].reverse(), 'newchat'), m.sub[1]);
  }
  // Same label but opens a submenu: not the leaf.
  assert.equal(branch.pick([item('Branch in new chat', { popup: true })], 'newchat'), null);
  // A Branch item without a submenu is not "Branch conversation".
  assert.equal(
    branch.pick([item('Branch conversation', { icons: [ICON('branch')] })], 'branch'),
    null,
  );
  // Near misses.
  for (const label of ['Branch in new chat…', 'Branch in a new chat', '在新聊天中创建分支吧'])
    assert.equal(branch.pick([item(label)], 'newchat'), null, label);
  assert.equal(branch.pick([], 'more'), null);
});
