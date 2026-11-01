// Read source already loaded by Chromium; saves only public JS bundles in scratch/.
import {chromium} from 'playwright';import fs from 'node:fs';
const b=await chromium.connectOverCDP('http://127.0.0.1:9222'),ctx=b.contexts()[0],p=ctx.pages().find(x=>x.url().startsWith('https://chatgpt.com'));
const c=await ctx.newCDPSession(p),scripts=[];c.on('Debugger.scriptParsed',s=>{if(/(396705|901075|226913|767086|990054|418851|76629|502615)\.[a-f\d]+\.js/.test(s.url))scripts.push(s)});await c.send('Debugger.enable');await new Promise(r=>setTimeout(r,500));
for(const s of scripts){const x=await c.send('Debugger.getScriptSource',{scriptId:s.scriptId});const file=s.url.split('/').at(-1);fs.mkdirSync('scratch/jump-typing/bundles',{recursive:true});fs.writeFileSync('scratch/jump-typing/bundles/'+file,x.scriptSource);console.log(file,x.scriptSource.length)}await c.detach();await b.close();
