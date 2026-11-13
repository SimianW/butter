// The branch harness's scenarios, in run order (the order of branch-qa.mjs's sections before
// they became scenarios). Each declares its start (see harness.mjs), so any of them runs alone with
// ONLY=<name> as it does in a full run. `--list` prints each one's description: that is the
// reference for what it checks, with the details in the scenario's own header.
//
// A scenario asserts as it goes, and passes one named check per part it covers (the PASS lines of
// the harness before): a failed assert throws, which the runner reports as `<name> threw`.
import button from './scenarios/button.mjs';
import cancelSending from './scenarios/cancel-sending.mjs';
import cancel from './scenarios/cancel.mjs';
import citations from './scenarios/citations.mjs';
import chineseMenus from './scenarios/chinese-menus.mjs';
import failureShots from './scenarios/failure-shots.mjs';
import failures from './scenarios/failures.mjs';
import formulas from './scenarios/formulas.mjs';
import handoverFailed from './scenarios/handover-failed.mjs';
import hidden from './scenarios/hidden.mjs';
import lateLanding from './scenarios/late-landing.mjs';
import lines from './scenarios/lines.mjs';
import newTab from './scenarios/new-tab.mjs';
import popupBlocked from './scenarios/popup-blocked.mjs';
import questionBox from './scenarios/question-box.mjs';
import reply from './scenarios/reply.mjs';
import shots from './scenarios/shots.mjs';
import streamingCancel from './scenarios/streaming-cancel.mjs';
import streamingOff from './scenarios/streaming-off.mjs';
import streaming from './scenarios/streaming.mjs';
import zh from './scenarios/zh.mjs';

export const scenarios = [
  button,
  questionBox,
  formulas,
  citations,
  newTab,
  lines,
  reply,
  streaming,
  streamingCancel,
  streamingOff,
  hidden,
  chineseMenus,
  cancel,
  cancelSending,
  failures,
  lateLanding,
  popupBlocked,
  handoverFailed,
  shots,
  failureShots,
  zh,
];
