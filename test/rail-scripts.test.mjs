// The scripts lab fixtures inject for the rail (lab/harness/rail-scripts.mjs): every isolated-world
// script under rail/ in manifest order, after the rail's dependencies outside it.
import assert from 'node:assert/strict';
import test from 'node:test';
import { RAIL_SCRIPTS, railScripts } from '../lab/harness/rail-scripts.mjs';

test("the rail's scripts follow the manifest, a new rail/ script included", () => {
  assert.deepEqual(RAIL_SCRIPTS, [
    'seek/seek-meta.js',
    'bookmarks/model.js',
    'rail/conversations.js',
    'rail/wave.js',
    'rail/grid.js',
    'rail/model.js',
    'shared/leave-gesture.js',
    'rail/turns.js',
    'rail/trip.js',
    'rail/readiness.js',
    'rail/jump.js',
    'rail/pre-jump.js',
    'rail/style.js',
    'rail/card.js',
    'rail/rail.js',
  ]);
  const manifest = {
    content_scripts: [
      { js: ['shared/status.js', 'seek/seek-meta.js', 'bookmarks/model.js', 'rail/wave.js'] },
      { world: 'MAIN', js: ['rail/main-only.js', 'shared/leave-gesture-main.js'] },
      {
        js: [
          'rail/extra.js',
          'rail/model.js',
          'shared/leave-gesture.js',
          'rail/rail.js',
          'branch/ui.js',
        ],
      },
    ],
  };
  assert.deepEqual(railScripts(manifest), [
    'seek/seek-meta.js',
    'bookmarks/model.js',
    'rail/wave.js',
    'rail/extra.js',
    'rail/model.js',
    'shared/leave-gesture.js',
    'rail/rail.js',
  ]);
  // A manifest from before the leave gesture (#171) still reads, for historical baselines.
  const older = {
    content_scripts: [{ js: ['seek/seek-meta.js', 'bookmarks/model.js', 'rail/rail.js'] }],
  };
  assert.deepEqual(railScripts(older), ['seek/seek-meta.js', 'bookmarks/model.js', 'rail/rail.js']);
  assert.throws(() => railScripts({ content_scripts: [{ js: ['rail/rail.js', 'rail/x.js'] }] }));
});
