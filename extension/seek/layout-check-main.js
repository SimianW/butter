// Pure source-block reconstruction, persisted geometry identity and semantic landing.
(function(root){'use strict';
const TTL=30*24*60*60*1000;
function visibleRect(r,box,view,tolerance=.5){
 return !!r&&[r.top,r.bottom,r.left,r.right,r.width,r.height,box.top,box.bottom,box.left,box.right,view.top,view.bottom,view.left,view.right].every(Number.isFinite)&&r.width>0&&r.height>0&&r.top>=Math.max(box.top,view.top)-tolerance&&r.bottom<=Math.min(box.bottom,view.bottom)+tolerance&&r.left>=Math.max(box.left,view.left)-tolerance&&r.right<=Math.min(box.right,view.right)+tolerance;
}
function semanticTarget({scrollTop,realY,previewY,maxScroll,tolerance=2}){
 if(![scrollTop,realY,previewY,maxScroll].every(Number.isFinite)||maxScroll<0)return null;
 const delta=realY-previewY;if(Math.abs(delta)<=tolerance)return null;
 const to=Math.max(0,Math.min(maxScroll,scrollTop+delta));
 if(Math.abs(to-scrollTop)<=tolerance)return null;
 return{to,delta,clamped:Math.abs(to-scrollTop-delta)>tolerance};
}
function inline(s){
 const math=[];s=s.replace(/\\\(([\s\S]*?)\\\)|\$([^$\n]+)\$/g,(_,a,b)=>'\u0000'+(math.push(a??b)-1)+'\u0000');
 s=s.replace(/!\[([^\]]*)\]\([^)]*\)/g,'$1').replace(/\[([^\]]+)\]\([^)]*\)/g,'$1').replace(/\*\*([\s\S]+?)\*\*|__([\s\S]+?)__/g,(_,a,b)=>a??b).replace(/\*([^*\n]+)\*|_([^_\n]+)_|`([^`]+)`/g,(_,a,b,c)=>a??b??c).replace(/\\([*_`~[\]#])/g,'$1');
 return s.replace(/\u0000(\d+)\u0000/g,(_,i)=>math[+i]);
}
function segments(markdown){
 const lines=(markdown||'').replace(/\r\n/g,'\n').split('\n'),out=[];let i=0;
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue;}
  const start=i,line=lines[i];let kind='paragraph',level=0;
  if(/^\s*(```|~~~)/.test(line)){kind='code';const fence=line.match(/^\s*(```|~~~)/)[1];i++;while(i<lines.length&&!lines[i].trimStart().startsWith(fence))i++;i=Math.min(lines.length,i+1);}
  else if(/^\s*(\\\[|\$\$)/.test(line)){kind='math';const end=line.includes('\\[')?'\\]':'$$';i++;if(!(line.trim().endsWith(end)&&line.trim().length>end.length))while(i<lines.length){if(lines[i++].includes(end))break;}}
  else if(/^\s{0,3}#{1,6}\s/.test(line)){kind='heading';level=line.trimStart().match(/^#+/)[0].length;i++;}
  else if(/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)){kind='rule';i++;}
  else if(/^\s*!\[/.test(line)){kind='image';i++;}
  else if(line.includes('|')&&/^\s*\|?\s*:?-{3}/.test(lines[i+1]||'')){kind='table';i+=2;while(i<lines.length&&lines[i].includes('|')&&lines[i].trim())i++;}
  else if(/^\s*(?:[-+*]|\d+[.)])\s/.test(line)){kind='list';i++;while(i<lines.length&&lines[i].trim()&&!/^\s*(?:#{1,6}\s|\\\[|\$\$|```)/.test(lines[i]))i++;}
  else {i++;while(i<lines.length&&lines[i].trim()&&!/^\s*(?:#{1,6}\s|\\\[|\$\$|```|~~~|[-+*]\s|(?:[-*_])(?:\s*[-*_]){2,}\s*$)/.test(lines[i]))i++;}
  const raw=lines.slice(start,i).join('\n');let plain=inline(raw);
  if(kind==='heading')plain=inline(raw.replace(/^\s*#+\s+/,''));
  if(kind==='rule')plain='';
  if(kind==='code')plain=raw.split('\n').slice(1,-1).join('\n');
  if(kind==='math')plain=raw.replace(/^\s*(\\\[|\$\$)\s*/,'').replace(/\s*(\\\]|\$\$)\s*$/,'');
  if(kind==='table')plain=raw.split('\n').filter((_,i)=>i!==1).map(row=>row.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(cell=>inline(cell.trim())).join('  ')+'  ').join('\n').trim();
  if(kind==='list')plain=inline(raw.replace(/^\s*(?:[-+*]|\d+[.)])\s+/gm,'• '));
  out.push({kind,level,raw,plain:plain.trim()});
 }
 return out;
}
function geometryOnly(r,parts,ctx,time=Date.now()){
 const byText=new Map(parts.map((p,i)=>[p.plain,i]));
 return {schema:1,...ctx,time,h:r.h,rowH:r.rowH,turnOffset:r.turnOffset,turnH:r.turnH,w:r.w,vw:r.vw,sw:r.sw,blocks:r.blocks.slice(),ready:true,
 items:r.items.map(it=>({top:it.top,h:it.h,left:it.left,w:it.w,user:!!it.user,css:it.css,math:it.math?.map(({start,end,display,h})=>({start,end,display,h})),source:it.user?-2:(byText.get(it.text)??-1)}))};
}
function acceptStored(x,ctx,now=Date.now()){
 if(!x||x.schema!==1)return 'schema';for(const k of ['conv','turn','msg','digest','layout'])if(x[k]!==ctx[k])return k;
 if(!Number.isFinite(x.time)||now-x.time>TTL||x.time>now+60000)return 'expired';
 if(![x.h,x.rowH,x.w,x.vw,x.sw].every(n=>Number.isFinite(n)&&n>0)||!Array.isArray(x.blocks)||!x.blocks.length||x.blocks.some(n=>!Number.isFinite(n)||n<=0)||!Array.isArray(x.items)||x.items.some(it=>![it.top,it.h,it.left,it.w].every(Number.isFinite)||it.h<0||it.w<0||!Number.isInteger(it.source)))return 'geometry';
 return null;
}
function hydrate(x,parts,q=''){
 return {...x,removed:true,recordedAt:0,records:0,fromStorage:true,items:x.items.map(it=>({...it,text:it.source===-2?q:parts[it.source]?.plain||''})),missingText:x.items.filter(it=>it.source===-1&&it.h>1).length};
}
const api={TTL,visibleRect,semanticTarget,segments,inline,geometryOnly,acceptStored,hydrate};
if(typeof module==='object'&&module.exports)module.exports=api;else root.__butterLayoutCheck=api;
})(globalThis);
