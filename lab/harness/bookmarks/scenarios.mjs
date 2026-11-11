// The bookmarks harness's scenarios, in run order. Each starts from its own declared start (see
// harness.mjs), so any of them runs alone with ONLY=<name>. The legacy ones still set up the
// fixture scene themselves; later PRs move them into scenarios/.
import { dotSection } from './legacy/dot.mjs';
import { earlierSection } from './legacy/earlier.mjs';
import { mainCards } from './legacy/main-cards.mjs';
import { mainSave } from './legacy/main-save.mjs';
import { oneQuestionSection } from './legacy/one.mjs';
import { pillSection } from './legacy/pill.mjs';
import { washSection } from './legacy/wash.mjs';
import card from './scenarios/card.mjs';
import stale from './scenarios/stale.mjs';
import streamed from './scenarios/streamed.mjs';
import upgrade from './scenarios/upgrade.mjs';

const legacy = (name, description, run) => ({ name, description: `(legacy) ${description}`, run });

export const scenarios = [
  upgrade,
  legacy(
    'main',
    'Save with the pill, its card and dot, jumps, reload, selection and shortcut (#54), list items, rail off and paused, the hover card (#53), the first bookmark ever (#56)',
    async (qa) => mainCards(qa, await mainSave(qa)),
  ),
  stale,
  streamed,
  legacy('pill', 'The pill and the notification (#77): triple-click, keyboard, Undo, replacement, motion, Ask in branch off, Chinese, the mockup states', pillSection),
  card,
  legacy('dot', "The dot (#71) as the #69 mockup draws it: the strips, hover wave, new dot, dense chat, earlier history's dot, reduced motion", dotSection),
  legacy('one', 'A one-question chat: no rail, but the Bookmark cell saves; a second question shows the dot', oneQuestionSection),
  legacy('earlier', 'Earlier history (#51, #72): its dots and card, loading pages to a row, ×, keyboard, narrow widths, screenshots', earlierSection),
  legacy('wash', 'The landing wash (#73, #74): sweep, hold and fade, scroll, cancels, stale, blocks, unloaded history; the #69 panels when given', washSection),
];
