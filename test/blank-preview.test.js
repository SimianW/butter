const test=require('node:test'),assert=require('node:assert/strict');
const core=require(process.env.SEEK_CORE_SOURCE||'../extension/seek-core.js');

test('a recorded tall block retains a text fallback throughout its geometry',()=>{
 // The recorder caps lean text at 4000 characters, while preserving the full block height.
 // At this offset the real paragraph exists but the lean text has already scrolled above the clip.
 const turns=[{id:'q5',index:0,top:72522.953125,h:23582,layout:true,
  q:'question',answer:'known source '.repeat(4500),items:[{top:138,h:23400,text:'x'.repeat(4000)}]}];
 const flat=core.flatten(turns),rows=core.windowAt(flat,77547,848).map(i=>flat[i]);
 assert.ok(rows.some(f=>f.estimate&&f.turn===0),'A layout record is not proof of visible text: retain a row-height fallback');
});

test('window lookup retains a long block overlapping later short blocks',()=>{
 const turns=[{id:'a',index:0,top:0,h:10000,layout:true,items:[{top:0,h:10000,text:'long'},...Array.from({length:20},(_,i)=>({top:100+i*100,h:20,text:'short'}))]}];
 const flat=core.flatten(turns),visible=core.windowAt(flat,8000,500).map(i=>flat[i]);
 assert.ok(visible.some(f=>f.index===0&&!f.estimate),'Binary search needs monotonic prefix bottoms when fallback spans overlap blocks');
});

test('fallback uses current source text near the bottom instead of the clipped lean prefix',()=>{
 const t={h:23582,q:'question',answer:'prefix '.repeat(1000)+'known bottom text '.repeat(3000)};
 const result=core.previewExcerpt(t,20000);
 assert.ok(result.from>4000);assert.ok(result.text.includes('known bottom text'));assert.ok(result.text.trim());
});

test('missing, whitespace-only, question-only and shifted beyond-end source never gives empty text',()=>{
 for(const t of [{h:100,q:'question',answer:''},{h:100,q:'',answer:''},{h:100,q:' ',answer:'\n\t'}, {h:100,q:'',answer:'answer'}]){
  for(const offset of [-100,0,99,100,10000])assert.ok(core.previewExcerpt(t,offset).text.trim());
 }
});
