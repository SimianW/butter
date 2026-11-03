const test=require('node:test'),assert=require('node:assert/strict');
const c=require('../extension/cold-core.js');
test('cold semantic landing corrects the visible anchor rather than the obsolete row offset',()=>{
 assert.deepEqual(c.semanticTarget({scrollTop:60000,realY:3700,previewY:102,maxScroll:200000}),{to:63598,delta:3598,clamped:false});
 assert.equal(c.semanticTarget({scrollTop:60000,realY:103,previewY:102,maxScroll:200000}),null);
 assert.equal(c.semanticTarget({scrollTop:60000,realY:NaN,previewY:102,maxScroll:200000}),null);
});
test('persistent record rejects edits, regeneration, width/font/layout changes, expiry and malformed geometry',()=>{
 const ctx={conv:'c',turn:'t',msg:'m',digest:'d',layout:'width1258-font16-v1'};
 const x={schema:1,...ctx,time:100,h:500,rowH:520,w:768,vw:1600,sw:1258,blocks:[26],items:[{top:20,h:26,left:200,w:768,user:false,css:'font:16px system-ui',source:0}],ready:true};
 assert.equal(c.acceptStored(x,ctx,200),null);
 for(const k of ['conv','turn','msg','digest','layout'])assert.equal(c.acceptStored(x,{...ctx,[k]:'changed'},200),k);
 assert.equal(c.acceptStored({...x,time:-c.TTL},ctx,200),'expired');
 assert.equal(c.acceptStored({...x,blocks:[0]},ctx,200),'geometry');
 assert.equal(c.acceptStored({...x,items:[{...x.items[0],top:Infinity}]},ctx,200),'geometry');
});
test('persistent serializer contains geometry and source block indexes but never chat text',()=>{
 const text='private chat sentence';const r={h:500,rowH:520,w:768,vw:1600,sw:1258,msg:'m',blocks:[26],items:[{top:20,h:26,left:200,w:768,user:false,css:'font:16px system-ui',text}]};
 const x=c.geometryOnly(r,[{plain:text}],{conv:'c',turn:'t',msg:'m',digest:'hash',layout:'layout'},100);
 assert.equal(JSON.stringify(x).includes(text),false);assert.equal(x.items[0].source,0);
 assert.equal(c.hydrate(x,[{plain:text}]).items[0].text,text);
});
test('semantic landing clamps document boundaries and tolerates sub-pixel remeasurement',()=>{
 assert.deepEqual(c.semanticTarget({scrollTop:990,realY:300,previewY:100,maxScroll:1000}),{to:1000,delta:200,clamped:true});
 assert.equal(c.semanticTarget({scrollTop:500,realY:100.4,previewY:100,maxScroll:1000}),null);
});
test('a text run in clipped overflow is not a visible preview anchor',()=>{
 const box={top:52,bottom:84,left:400,right:1168},view={top:52,bottom:828,left:341,right:1599};
 assert.equal(c.visibleRect({top:858,bottom:878,left:400,right:600,width:200,height:20},box,view),false);
 assert.equal(c.visibleRect({top:55,bottom:75,left:400,right:600,width:200,height:20},box,view),true);
 assert.equal(c.visibleRect({top:75,bottom:95,left:400,right:600,width:200,height:20},box,view),false);
});
test('stored geometry supplies native-range weights and an opened layout without native height writes',()=>{
 const seek=require('../extension/seek-core.js');
 const records={a:{fromStorage:true,rowH:1000,sw:600,turnOffset:20,turnH:980,items:[{top:20,h:26,text:'a'}]},b:{fromStorage:true,rowH:3000,sw:600,items:[{top:0,h:26,text:'b'}]}};
 const measured={c:100};
 const model=seek.buildModel({ids:['a','b','c'],measured,records,texts:{},scrollHeight:1700,gap:0,sw:600});
 assert.deepEqual(model.map(t=>t.h),[400,1200,100]);
 assert.equal(model[0].layout,true);assert.equal(model[0].stored,true);assert.equal(model[0].litTop,20);assert.equal(model[0].litH,980);
 assert.equal(seek.landing(seek.previewQuestion(model,50,52),52,1600).offset,50);
 assert.deepEqual(measured,{c:100});
});
test('stored preview uses full row geometry without overlapping native estimated spans',()=>{
 const seek=require(process.env.GEOMETRY_SOURCE || '../extension/seek-core.js');
 const native=[{id:'a',index:0,top:0,h:200,layout:true,litTop:20,litH:1980,items:[{top:1900,h:100}]},{id:'b',index:1,top:212,h:200,layout:true,litTop:232,litH:980,items:[{top:20,h:100}]}];
 const preview=seek.buildPreviewModel?.(native,{a:{rowH:2000},b:{rowH:1000}},12) || native;
 assert.deepEqual(preview.map(t=>t.top),[0,2012]);
 const top=seek.previewScrollTop(native,preview,260,52);
 assert.equal(top,2460);assert.equal(seek.previewQuestion(preview,top,52).id,'b');
 assert.equal(seek.previewCardQuestion(seek.previewLitQuestions(preview,top,800),top,800).id,'b');
 assert.equal(seek.previewQuestion(native,260,52).id,'b');
});
