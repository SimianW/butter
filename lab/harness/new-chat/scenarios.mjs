// The new chat harness's scenarios (#163), in run order: the spec's fixture cases. Each starts on a
// fresh page at its `route` (harness.mjs) and states what the reader sees after the key: the URL,
// whether the page reloaded, the visible message box (label, text, focus) and whether the page
// itself saw the key (it must not: the Chrome command takes it).
import { PROJECT, CHAT, GPT } from './fixture.mjs';

const PROJECT_PAGE = `/g/g-p-${PROJECT}/project`;
const DRAFT = 'draft that stays'; // no "o": a stray key would show

// The page saw no Alt+Shift+O keydown, so ChatGPT's type-to-focus handler typed nothing.
const unseen = (t, s, name) => t.check(`${name}: the page never saw the key`, s.keys.length === 0, { keys: s.keys });

// The key from a page with turns lands on `to`, client-side, on an empty new chat whose composer
// has focus; `label` is the composer's label there.
const goes = (name, route, to, { scene, label = 'Ask ChatGPT' } = {}) => ({
  name,
  description: `${route} (with turns) → ${to}, client-side, composer "${label}" focused`,
  route,
  scene,
  async run(t) {
    const before = await t.state();
    t.check(`${name}: starts with turns shown`, before.turns > 0, { turns: before.turns });
    await t.blur();
    await t.press();
    const s = await t.state();
    t.check(`${name}: lands on ${to}`, s.route === to, { route: s.route });
    t.check(`${name}: no reload`, !s.reloaded);
    t.check(`${name}: no turns shown`, s.turns === 0, { turns: s.turns, hidden: s.hiddenTurns });
    t.check(`${name}: composer "${label}" has focus`, s.label === label && s.focused, { label: s.label, focused: s.focused });
    t.check(`${name}: new composer is empty`, s.text === '', { text: s.text });
    unseen(t, s, name);
  },
});

// On a new chat already, the key only focuses the composer: URL and typed text stay, caret at
// the end of the text.
const focuses = (name, route) => ({
  name,
  description: `fresh ${route} with typed text → URL and text unchanged, composer focused`,
  route,
  async run(t) {
    await t.type(DRAFT);
    await t.blur();
    const before = await t.state();
    t.check(`${name}: starts fresh, composer not focused`, before.turns === 0 && !before.focused, before);
    await t.press();
    const s = await t.state();
    t.check(`${name}: URL unchanged`, s.route === route, { route: s.route });
    t.check(`${name}: no reload`, !s.reloaded);
    t.check(`${name}: composer focused`, s.focused, { active: s.active });
    t.check(`${name}: text intact`, s.text === DRAFT, { text: s.text });
    t.check(`${name}: caret at the end`, s.caretAtEnd);
    unseen(t, s, name);
  },
});

// The key does nothing at all: URL, focus and text as they were.
const nothing = (name, route, { scene, settings }) => ({
  name,
  description: `${route}, ${name} → URL unchanged, nothing focused or typed`,
  route,
  scene,
  settings,
  async run(t) {
    await t.type(DRAFT);
    await t.blur();
    await t.press();
    const s = await t.state();
    t.check(`${name}: URL unchanged`, s.route === route, { route: s.route });
    t.check(`${name}: no reload`, !s.reloaded);
    t.check(`${name}: turns still shown`, s.turns > 0, { turns: s.turns });
    t.check(`${name}: nothing focused`, !s.focused && s.active === 'body', { active: s.active });
    t.check(`${name}: text unchanged`, s.text === DRAFT, { text: s.text });
    unseen(t, s, name);
  },
});

export const scenarios = [
  goes('project-chat', `/g/g-p-${PROJECT}-fixture-project/c/${CHAT}`, PROJECT_PAGE, { label: 'New chat in Fixture project' }),
  {
    name: 'project-chat-twice',
    description: 'a second press on the project page it led to only focuses: the old turns stay hidden',
    route: `/g/g-p-${PROJECT}/c/${CHAT}`,
    async run(t) {
      await t.press();
      await t.type(DRAFT);
      await t.blur();
      await t.press();
      const s = await t.state();
      t.check('project-chat-twice: still on the project page', s.route === PROJECT_PAGE, { route: s.route });
      t.check('project-chat-twice: old turns hidden, not counted', s.hiddenTurns > 0 && s.turns === 0, s);
      t.check('project-chat-twice: composer focused, text intact', s.focused && s.text === DRAFT, s);
      unseen(t, s, 'project-chat-twice');
    },
  },
  goes('normal-chat', `/c/${CHAT}`, '/'),
  goes('temporary', '/?temporary-chat=true', '/?temporary-chat=true', { scene: 'turns=2' }),
  goes('custom-gpt', `/g/g-${GPT}/c/${CHAT}`, '/'),
  focuses('project-page', PROJECT_PAGE),
  focuses('home', '/'),
  focuses('temporary-fresh', '/?temporary-chat=true'),
  nothing('work', `/g/g-p-${PROJECT}/c/${CHAT}`, { scene: 'work' }),
  nothing('paused', `/g/g-p-${PROJECT}/c/${CHAT}`, { settings: { enabled: false } }),
];
