// Fixed user-facing verdict examples; no synthetic page stands in for the live cause tests.
import assert from 'node:assert/strict';
import { classify } from './rail-jump-live-page.mjs';
const row = (t, y, targetTop = 64, placeholder = false) => ({ t, y, h: 10000, vh: 900, targetTop, targetHeight: 100, placeholder });
const verdict = frames => classify({ frames, events: [], endMs: 1000, timedOut: false });
assert.equal(verdict([row(0,0,null), row(200,5000,64,true), row(300,4800,264,true), row(1000,5000), row(3000,5000)]).class, 'clean', 'masked readiness reversal is informational');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(1100,0,5064), row(1200,5000), row(3000,5000)]).detour, true, 'visible excursion over one viewport');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(1200,5000,null), row(3000,5000)]).detour, true, 'visible loss still counts if target remounts');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(3000,0,null)]).failed, true, 'endpoint target absent');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(3000,5000,96)]).failed, false, '32 px remains within tolerance');
assert.equal(verdict([row(0,0,null), row(1000,5000), row(3000,5000,97)]).failed, true, '33 px fails');
const gradual = [0,5000,6000,7000,8000,7000,6000,5000].map((y,i) => row(i*500, y, 5064-y));
assert.equal(verdict(gradual).detour, true, 'gradual multi-frame overshoot');
console.log('PASS 7 verdict assertions; raw reversals do not set the exit code; 32 px and one viewport thresholds unchanged');
