// The bookmarks harness's scenarios, in run order. Each declares its start (see harness.mjs) and
// changes the fixture only through the harness, so any of them runs alone with ONLY=<name> as it
// does in a full run. `--list` prints each one's description: that is the reference for what it
// checks, with the details in the scenario's own header.
import cardList from './scenarios/card-list.mjs';
import card from './scenarios/card.mjs';
import dotCloseups from './scenarios/dot-closeups.mjs';
import dotDense from './scenarios/dot-dense.mjs';
import dotEarlier from './scenarios/dot-earlier.mjs';
import dot from './scenarios/dot.mjs';
import earlierDots from './scenarios/earlier-dots.mjs';
import earlierGone from './scenarios/earlier-gone.mjs';
import earlierKeys from './scenarios/earlier-keys.mjs';
import earlierList from './scenarios/earlier-list.mjs';
import earlierShots from './scenarios/earlier-shots.mjs';
import earlier from './scenarios/earlier.mjs';
import firstBookmark from './scenarios/first-bookmark.mjs';
import listItems from './scenarios/list-items.mjs';
import notice from './scenarios/notice.mjs';
import one from './scenarios/one.mjs';
import pillStates from './scenarios/pill-states.mjs';
import railIdle from './scenarios/rail-idle.mjs';
import railOff from './scenarios/rail-off.mjs';
import save from './scenarios/save.mjs';
import selection from './scenarios/selection.mjs';
import shortcutCleared from './scenarios/shortcut-cleared.mjs';
import stale from './scenarios/stale.mjs';
import streamed from './scenarios/streamed.mjs';
import upgrade from './scenarios/upgrade.mjs';
import washAtOnce from './scenarios/wash-at-once.mjs';
import washBlocks from './scenarios/wash-blocks.mjs';
import washEarlier from './scenarios/wash-earlier.mjs';
import washHeader from './scenarios/wash-header.mjs';
import washMockup from './scenarios/wash-mockup.mjs';
import wash from './scenarios/wash.mjs';

export const scenarios = [
  upgrade,
  save,
  selection,
  // Before list-items, whose shortcut needs the key that `start` sets back.
  shortcutCleared,
  listItems,
  railOff,
  cardList,
  firstBookmark,
  stale,
  streamed,
  pillStates,
  notice,
  card,
  dot,
  dotCloseups,
  dotDense,
  dotEarlier,
  one,
  earlier,
  earlierList,
  earlierKeys,
  earlierDots,
  earlierGone,
  earlierShots,
  wash,
  washHeader,
  washBlocks,
  washAtOnce,
  washEarlier,
  washMockup,
  railIdle,
];
