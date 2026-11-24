// Ask in branch's shortcut (#126): what a press of the `branch` command does, from four facts about
// the tab. Rows are checked in order: off, paused or overlay up; question box open; selection
// qualifies; otherwise nothing.
const test = require('node:test');
const assert = require('node:assert/strict');
const { shortcutAction } = require('../extension/branch/logic.js');

const tab = { off: false, overlay: false, boxOpen: false, qualifies: false };

test('a qualifying selection opens the question box', () => {
  assert.equal(shortcutAction({ ...tab, qualifies: true }), 'open');
});

test('with no qualifying selection the key does nothing', () => {
  assert.equal(shortcutAction(tab), 'nothing');
});

test('with the question box open the key puts focus back in its input', () => {
  assert.equal(shortcutAction({ ...tab, boxOpen: true }), 'focus');
});

test('Ask in branch off or Butter paused: nothing, whatever else holds', () => {
  assert.equal(shortcutAction({ ...tab, off: true, qualifies: true }), 'nothing');
  assert.equal(shortcutAction({ ...tab, off: true, boxOpen: true }), 'nothing');
});

test('with the overlay up the key does nothing, whatever else holds', () => {
  assert.equal(shortcutAction({ ...tab, overlay: true, qualifies: true }), 'nothing');
  assert.equal(shortcutAction({ ...tab, overlay: true, boxOpen: true }), 'nothing');
});

test('an open box beats a qualifying selection', () => {
  assert.equal(shortcutAction({ ...tab, boxOpen: true, qualifies: true }), 'focus');
});

test('missing facts read as false', () => {
  assert.equal(shortcutAction(), 'nothing');
  assert.equal(shortcutAction({ qualifies: true }), 'open');
});
