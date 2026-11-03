// Unit tests: thumb press classification and activation (fixtures from the lab and the user's Mac probe).
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../extension/seek/core-main.js');

// User's Mac (overlay): clientWidth 766 = offsetWidth 766, thumb press at x 761-762.
const mac = { isTrusted: true, button: 0, pointerType: 'mouse', targetIsScroller: true, offsetWidth: 766, clientWidth: 766, clientHeight: 900, scrollHeight: 313000, scrollTop: 150000, y: 450 };
// Lab Linux classic: offsetWidth 1258, gutter 15 px, clientHeight 912.
const classic = { isTrusted: true, button: 0, pointerType: 'mouse', targetIsScroller: true, offsetWidth: 1258, clientWidth: 1243, clientHeight: 912, scrollHeight: 312992, scrollTop: 1800 };
const classicThumbY = (p) => { const track = p.clientHeight - 24, thumb = Math.max(12, track * p.clientHeight / p.scrollHeight); return 12 + (track - thumb) * p.scrollTop / (p.scrollHeight - p.clientHeight) + thumb / 2; };

test('overlay: the Mac thumb presses (x 761, 762 of 766) are candidates', () => {
  assert.equal(core.classifyPress({ ...mac, x: 762 }).kind, 'overlay');
  assert.equal(core.classifyPress({ ...mac, x: 761 }).kind, 'overlay');
  assert.equal(core.classifyPress({ ...mac, x: 765.5 }).kind, 'overlay');
});
test('overlay: band is 15 px from the inline-end edge', () => {
  assert.equal(core.classifyPress({ ...mac, x: 751 }).kind, 'overlay');
  assert.equal(core.classifyPress({ ...mac, x: 750 }).reason, 'overlay-off-band');
  assert.equal(core.classifyPress({ ...mac, x: 400 }).reason, 'overlay-off-band');
});
test('overlay RTL: band is at the left edge', () => {
  assert.equal(core.classifyPress({ ...mac, rtl: true, x: 3 }).kind, 'overlay');
  assert.equal(core.classifyPress({ ...mac, rtl: true, x: 762 }).reason, 'overlay-off-band');
});
test('presses that are not on the scroller itself, not primary, not mouse, or untrusted never qualify', () => {
  assert.equal(core.classifyPress({ ...mac, x: 762, targetIsScroller: false }).reason, 'target'); // e.g. a content DIV under the edge
  assert.equal(core.classifyPress({ ...mac, x: 762, button: 2 }).reason, 'button');
  assert.equal(core.classifyPress({ ...mac, x: 762, pointerType: 'touch' }).reason, 'pointer-type');
  assert.equal(core.classifyPress({ ...mac, x: 762, pointerType: 'pen' }).reason, 'pointer-type');
  assert.equal(core.classifyPress({ ...mac, x: 762, isTrusted: false }).reason, 'untrusted');
  assert.equal(core.classifyPress({ ...mac, x: 762, scrollHeight: 900 }).reason, 'not-scrollable');
});
test('classic: only a press on the computed thumb qualifies', () => {
  const y = classicThumbY(classic);
  assert.equal(core.classifyPress({ ...classic, x: 1251, y }).kind, 'classic');
  assert.equal(core.classifyPress({ ...classic, x: 1251, y: 600 }).reason, 'classic-track');
  assert.equal(core.classifyPress({ ...classic, x: 1240, y }).reason, 'classic-off-bar'); // content column edge
  assert.equal(core.classifyPress({ ...classic, x: 1251, y: 3 }).reason, 'classic-track');  // arrow button
});
test('classic RTL gutter sits on the left', () => {
  const y = classicThumbY(classic);
  assert.equal(core.classifyPress({ ...classic, rtl: true, x: 5, y }).kind, 'classic');
  assert.equal(core.classifyPress({ ...classic, rtl: true, x: 1251, y }).reason, 'classic-off-bar');
});

const sel = ['Caret', 'nodeA', 3, 'nodeA', 3];
function pressed(kind = 'overlay', selection = sel) { const a = core.createActivation(); assert.equal(a.press({ t: 0, kind, scrollTop: 1000, selection }), 'candidate'); return a; }

test('thumb drag: activates on the first moving scroll while held, then continues and releases', () => {
  const a = pressed();
  assert.equal(a.scroll({ t: 10, scrollTop: 1000, selection: [...sel], held: true }), null); // no movement yet
  assert.equal(a.state, 'candidate');
  assert.equal(a.scroll({ t: 20, scrollTop: 4500, selection: [...sel], held: true }), 'activate');
  assert.equal(a.scroll({ t: 30, scrollTop: 9000, selection: [...sel], held: true }), 'continue');
  assert.equal(a.up(), 'release');
  assert.equal(a.state, 'idle');
});
test('false positive: a click near the edge never scrolls, so it never activates', () => {
  const a = pressed();
  assert.equal(a.up(), 'reset');
  assert.equal(a.scroll({ t: 50, scrollTop: 1200, selection: sel, held: false }), null);
});
test('false positive: a text-selection drag near the edge (selection moved) is rejected even when autoscroll scrolls', () => {
  const a = pressed('overlay', ['None', null, 0, null, 0]);
  assert.equal(a.scroll({ t: 30, scrollTop: 1300, selection: ['Range', 'p1', 0, 'p2', 5], held: true }), 'reject');
  assert.equal(a.detail.reason, 'selection');
  assert.equal(a.scroll({ t: 40, scrollTop: 1600, selection: ['Range', 'p1', 0, 'p2', 9], held: true }), null);
});
test('false positive: trackpad/wheel scroll while a button is down never activates', () => {
  const a = pressed();
  assert.equal(a.wheel(), 'reject');
  assert.equal(a.scroll({ t: 30, scrollTop: 1500, selection: sel, held: true }), null);
  assert.equal(a.state, 'rejected');
});
test('a key press while held (e.g. PageDown) rejects the candidate', () => {
  const a = pressed();
  assert.equal(a.key(), 'reject');
  assert.equal(a.scroll({ t: 30, scrollTop: 1900, selection: sel, held: true }), null);
});
test('a scroll after the button is up is not thumb evidence', () => {
  const a = pressed();
  assert.equal(a.scroll({ t: 30, scrollTop: 1900, selection: sel, held: false }), 'reject');
  assert.equal(a.detail.reason, 'not-held');
});
test('wheel during an active drag ends the session (handed back to ChatGPT)', () => {
  const a = pressed();
  a.scroll({ t: 20, scrollTop: 4500, selection: sel, held: true });
  assert.equal(a.wheel(), 'end');
});
test('a move without the button during an active drag means the release was lost', () => {
  const a = pressed();
  a.scroll({ t: 20, scrollTop: 4500, selection: sel, held: true });
  assert.equal(a.move({ buttons: 1 }), null);
  assert.equal(a.move({ buttons: 0 }), 'end');
});
test('no candidate when the press is not a thumb candidate', () => {
  const a = core.createActivation();
  assert.equal(a.press({ t: 0, kind: null }), null);
  assert.equal(a.scroll({ t: 1, scrollTop: 5000, selection: sel, held: true }), null);
});
test('sameSelection compares node identity and offsets', () => {
  const n = {}, m = {};
  assert.ok(core.sameSelection(['Caret', n, 1, n, 1], ['Caret', n, 1, n, 1]));
  assert.ok(!core.sameSelection(['Caret', n, 1, n, 1], ['Caret', m, 1, m, 1]));
  assert.ok(!core.sameSelection(['Caret', n, 1, n, 1], ['Range', n, 1, n, 4]));
  assert.ok(!core.sameSelection(null, ['None', null, 0, null, 0]));
});

test('classic stable both-edges: the reserved start gutter is not the native bar',()=>{
 const p={...classic,clientWidth:1238,clientLeft:10};const y=classicThumbY(p);
 assert.equal(core.classifyPress({...p,x:1252,y}).kind,'classic');
 assert.equal(core.classifyPress({...p,x:1242,y}).reason,'classic-off-bar');
});
test('release coalescer keeps the final native update and freezes when height/history changes',()=>{
 const r=core.createRelease({top:3464,height:90266});
 assert.equal(r.sample({top:2038,height:90266}).accept,true);
 const shifted=r.sample({top:179550,height:180462});assert.equal(shifted.accept,false);assert.equal(shifted.top,2038);
 assert.equal(r.sample({top:180000,height:180462}).top,2038);
 const h=core.createRelease({top:47,height:92770});h.invalidate('history-data');
 assert.equal(h.sample({top:29332,height:121905}).accept,false);assert.equal(h.dump().top,47);
});

test('late native motion remains valid after sizing changes; an opposite application adjustment does not',()=>{
 const r=core.createRelease({top:3464,height:180462,maxTop:89354,direction:-1});
 assert.equal(r.sample({top:2038,height:180462}).accept,true);
 assert.equal(r.sample({top:89000,height:180462}).accept,false);
 assert.equal(r.dump().top,2038);
});
