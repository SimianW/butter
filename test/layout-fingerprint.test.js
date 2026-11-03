const test = require('node:test');
const assert = require('node:assert/strict');
const {layoutFingerprint} = require('../extension/seek/layout-check-main.js');
// Captured field order and normalization from the checkpoint, including unavailable columns.
const cases=[
 [{sw:1258,vw:1600,dpr:1,font:'16px system-ui',column:768,theme:'["light",null,null]',build:'a|b'},
  '{"schema":1,"sw":1258,"vw":1600,"dpr":1,"font":"16px system-ui","column":768,"theme":"[\\"light\\",null,null]","build":"a|b"}'],
 [{sw:600,vw:800,dpr:2,font:'18px serif',column:0,theme:'dark',build:''},
  '{"schema":1,"sw":600,"vw":800,"dpr":2,"font":"18px serif","column":null,"theme":"dark","build":""}'],
];
test('shared layout fingerprint retains checkpoint serialization and warm width projection',()=>{
 for(const [input,bytes] of cases){
  const before=structuredClone(input),full=layoutFingerprint(input);
  assert.equal(JSON.stringify(full),bytes);assert.deepEqual(input,before);
  const warm=layoutFingerprint({vw:input.vw,sw:input.sw});
  assert.equal(warm.vw,full.vw);assert.equal(warm.sw,full.sw);
  for(const column of [null,undefined,-1,NaN])assert.equal(layoutFingerprint({...input,column}).column,null);
 }
});
