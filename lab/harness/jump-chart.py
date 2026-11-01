"""Small self-contained chart for T3 inline rendering; only redacted aggregate data."""
import json
from pathlib import Path
base=Path(__file__).resolve().parent/'scratch/jump-typing'
data=json.loads((base/'summary.json').read_text())['rows']
labels={'stock':'Stock + rail','current':'Current Butter','page2':'Older page 2','page3':'Older page 3','page5':'Older page 5','initial100':'All at open','blocks-only':'Blocks only'}
rows=[{'mode':labels[r['mode']],'wait':r['T'],'p95':round(r['delay'][1]/1000,3) if r['delay'][1] is not None else None,'runs':r['valid']} for r in data]
html='''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{background:transparent;margin:0;color:var(--foreground);font-family:var(--font-sans,system-ui)}
figure{margin:0}figcaption{font-weight:600;margin-bottom:12px}.legend{display:flex;gap:20px;margin:0 0 12px 0;font-size:12px}.legend span{display:flex;align-items:center;gap:6px}.swatch{width:18px;height:8px;display:inline-block}.s2{background:var(--chart-1)}.s10{background:var(--chart-2)}svg{display:block;width:100%;height:440px;overflow:visible}svg text{fill:var(--foreground);font:12px var(--font-sans,system-ui)}.note{font-size:12px;color:var(--muted-foreground);margin:8px 0 0}
</style></head><body><figure id="jump-comparison"><figcaption>Key input delay · p95</figcaption><div class="legend"><span><i class="swatch s2"></i>2 s wait</span><span><i class="swatch s10"></i>10 s wait</span></div><svg role="img" aria-label="Reported keydown input delay p95, in seconds, across seven modes and two wait times"></svg><p class="note">Three attempts per mode and wait; current 2 s has two usable runs. Waits start at the usable rail. Stock includes a rail-only driver. “All at open” jumps to an older destination. Full methods and throttling limitations are in the report.</p></figure><script>
const data=__DATA__;
const root=document.getElementById('jump-comparison'),svg=root.querySelector('svg'),ns='http://www.w3.org/2000/svg';
function draw(){svg.replaceChildren();const width=root.clientWidth,height=440,left=105,right=52,top=8,bottom=42,plot=width-left-right,modes=[...new Set(data.map(d=>d.mode))],max=Math.ceil(Math.max(...data.map(d=>d.p95??0))*1.08),row=(height-top-bottom)/modes.length;
svg.setAttribute('viewBox',`0 0 ${width} ${height}`);const add=(tag,attrs,text)=>{const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,v);if(text!==undefined)e.textContent=text;svg.append(e);return e};
for(let t=0;t<=max;t++){const x=left+plot*t/max;add('line',{x1:x,x2:x,y1:top,y2:height-bottom,stroke:'var(--border)','stroke-width':1});if(width>500||t%2===0)add('text',{x,y:height-bottom+18,'text-anchor':'middle'},String(t))}add('text',{x:left+plot/2,y:height-3,'text-anchor':'middle'},'Input delay (seconds)');
modes.forEach((mode,i)=>{const cy=top+i*row;add('text',{x:0,y:cy+row/2+4},mode);for(const d of data.filter(d=>d.mode===mode)){const y=cy+(d.wait===2?9:29),w=plot*(d.p95??0)/max,e=add('rect',{x:left,y,width:Math.max(.5,w),height:12,fill:d.wait===2?'var(--chart-1)':'var(--chart-2)'}),title=document.createElementNS(ns,'title');title.textContent=`${mode}, ${d.wait} s wait: p95 ${d.p95} s (${d.runs} runs)`;e.append(title);add('text',{x:left+w+5,y:y+10},d.p95===null?'N/A':d.p95.toFixed(2))}})}
new ResizeObserver(draw).observe(root);draw();
</script></body></html>'''.replace('__DATA__',json.dumps(rows))
(base/'comparison.html').write_text(html)
print(base/'comparison.html')
