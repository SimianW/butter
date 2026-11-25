// Fixed user-facing verdict examples; no synthetic page stands in for the live cause tests.
import assert from 'node:assert/strict';
import { classify } from './rail-jump-live-page.mjs';
import { startName, pulledAt, endWriters } from './rail-jump-start.mjs';
const row = (t, y, targetTop = 64, placeholder = false) => ({ t, y, h: 10000, vh: 900, targetTop, targetHeight: 100, placeholder });
const verdict = frames => classify({ frames, events: [], endMs: 1000, timedOut: false });
assert.equal(verdict([row(0,0,null), row(200,5000,64,true), row(300,4800,264,true), row(1000,5000), row(3000,5000)]).class, 'clean', 'masked readiness reversal is informational');
const revealed = [row(0,0,5064), row(100,20000,-14936,true), row(200,20000,-14936), row(300,5000), row(3000,5000)];
assert.equal(verdict(revealed).detour, true, 'masked turning point still on screen after the placeholder goes');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(1100,0,5064), row(1200,5000), row(3000,5000)]).detour, true, 'visible excursion over one viewport');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(1200,5000,null), row(3000,5000)]).detour, true, 'visible loss still counts if target remounts');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(3000,0,null)]).failed, true, 'endpoint target absent');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(3000,5000,96)]).failed, false, '32 px remains within tolerance');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(3000,5000,97)]).failed, true, '33 px fails');
const gradual = [0,5000,6000,7000,8000,7000,6000,5000].map((y,i) => row(i*500, y, 5064-y));
assert.equal(verdict(gradual).detour, true, 'gradual multi-frame overshoot');
console.log('PASS 8 verdict assertions; raw reversals do not set the exit code; 32 px and one viewport thresholds unchanged');

// Start names, the control's pull and the writers to the chat's end (rail-jump-start.mjs, #171).
assert.deepEqual(['top', 'bottom', 'top-unpinned', 'end-pinned', 'previous'].map(startName), ['top-unpinned', 'end-pinned', 'top-unpinned', 'end-pinned', 'previous'], 'old labels are aliases');
const end = 10000 - 900;
assert.equal(pulledAt([[0, end, 10000, 900], [100, 0, 10000, 900], [1900, end, 10000, 900]]), 1900, 'left the end, then back within a viewport');
assert.equal(pulledAt([[0, end, 10000, 900], [100, 0, 10000, 900], [6000, 136, 10000, 900]]), null, 'held away from the end');
assert.equal(pulledAt([[0, end, 10000, 900], [100, end - 500, 10000, 900]]), 'never-left', 'within a viewport of the end throughout');
const call = (kind, extra) => ({ t: 5, world: 'MAIN', kind, y: 20, h: 10000, vh: 900, stack: 'Error\n    at stack (x)\n    at Element.set (x)\n    at ah (page:/a.js:1:2)\n    at aj (page:/a.js:1:3)\n    at page:/a.js:1:4', ...extra });
assert.deepEqual(endWriters([call('scrollTo:before', { args: [{ top: end }] }), call('scrollTop:before', { value: 385 }), call('scrollTo:before', { args: [0, end - 10] }), call('scrollTop:before', { value: end, y: end - 5 })]),
  [{ t: 5, world: 'MAIN', kind: 'scrollTo', callers: ['ah', 'aj', '<anonymous>'] }, { t: 5, world: 'MAIN', kind: 'scrollTo', callers: ['ah', 'aj', '<anonymous>'] }],
  'writes from away to within 24 px of the end, with function names only');
console.log('PASS 6 start assertions; top and bottom alias the named starts; a control is pulled when it leaves the end and comes back within a viewport');
