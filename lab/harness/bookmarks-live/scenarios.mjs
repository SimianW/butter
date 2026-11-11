// bookmarks-live's two suites, each in run order. `MODE=wash` picks the wash suite; any other MODE
// the matrix. Their lab setup differs (lab.mjs): the matrix takes the perf lock and writes the
// Alt+Shift+M shortcut into the lab profile; the wash does neither. Each scenario's description,
// which `--list` prints, and its precondition (needs.mjs) say what it checks and what it needs.
import { bookmarkParagraph, bookmarkSelection, dragBookmarked, dragEmpty, jumpAfterDrag, jumpDuringDrag, loadFixture, messageIds } from './matrix.mjs';
import { listItem } from './list-item.mjs';
import { remove, resolve, unloadedKeyboard, unloadedRow } from './reload.mjs';
import { wash } from './wash.mjs';

export const matrix = [
  loadFixture,
  dragEmpty,
  messageIds,
  bookmarkParagraph,
  bookmarkSelection,
  dragBookmarked,
  jumpAfterDrag,
  jumpDuringDrag,
  unloadedRow,
  unloadedKeyboard,
  resolve,
  remove,
  listItem,
];

export const suites = { matrix, wash };
