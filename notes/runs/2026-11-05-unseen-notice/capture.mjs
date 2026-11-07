// Synthetic content only. Run from the repository root; shared lab protected by its lock.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const out = new URL('./', import.meta.url);
const source = await fs.readFile('extension/seek/preview-main.js', 'utf8');
const core = await fs.readFile('extension/seek/core-main.js', 'utf8');
const lab = L.acquire('auto', { owner: 'unseen-notice', wait: 30 });
let browser, context;
const results = [];
try {
  ({ browser } = await L.connect(lab));
  context = await browser.newContext();
  await L.sendGuard(context, lab);
  await context.route('http://butter.test/**', r => r.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><title>Synthetic preview fixture</title><style>
body{margin:0;background:white;color:#222;font:16px system-ui,sans-serif}
.thread-scroll-container{position:relative;width:100%;height:480px;overflow:auto;background:white}
header{height:52px;box-sizing:border-box;padding:16px 24px;border-bottom:1px solid #eee}
form{position:absolute;top:340px;height:140px;width:100%;background:white}
.assistant{font:16px/26px system-ui,sans-serif}
html.dark body,html.dark .thread-scroll-container,html.dark form{background:#212121;color:#ececec}
</style></head><body><div class="thread-scroll-container"><header>Question 2 of 16 · not opened yet</header><div class="assistant" data-markdown-text-style="assistant-message"></div><form></form></div></body></html>` }));
  const page = await context.newPage();
  for (const width of [840, 390]) {
    await page.setViewportSize({ width, height: 480 });
    for (const dark of [false, true]) for (const lang of ['en', 'zh']) {
      await page.goto('http://butter.test/c/00000000-0000-0000-0000-000000000000');
      await page.evaluate(({dark,lang}) => {
        document.documentElement.classList.toggle('dark', dark);
        document.documentElement.setAttribute('data-butter-lang', lang);
        document.querySelector('header').textContent = lang === 'zh' ? '第 2 / 16 个问题 · 还没打开过' : 'Question 2 of 16 · not opened yet';
      }, { dark, lang });
      await page.addScriptTag({ content: core });
      await page.addScriptTag({ content: source.replace(/\}\)\(\);\s*$/, 'globalThis.previewFixture={surface,place,render};})();') });
      await page.evaluate(() => {
        const core = __butterSeekCore;
        const records={first:{rowH:500,items:[{top:60,h:50,left:24,w:700,text:'An opened answer keeps its normal preview.',css:'font:16px/26px system-ui,sans-serif',user:false}]}};
        const model=core.buildModel({ids:['first','unseen'],measured:{first:500,unseen:10000},records,texts:{unseen:{q:'Explain positive definite and positive semidefinite matrices.',answer:'Positive definite (PD) and positive semidefinite (PSD) matrices\n\nIn the previous section on convex functions, we reached an important result:\n\nA twice differentiable function is convex when its Hessian is positive semidefinite.\n\nThe Hessian describes curvature along every direction.\n\n'+('Further explanation belongs to the uncached rest of this answer. '.repeat(120))}},scrollHeight:10512,gap:12});
        const previewModel=core.buildPreviewModel(model,records,12);
        window.fixtureActive={sc:document.querySelector('.thread-scroll-container'),prep:{model,previewModel,flat:core.flatten(previewModel),colLeft:24,colWidth:Math.min(768,innerWidth-48)},rendered:new Map()};
        previewFixture.surface();previewFixture.place(fixtureActive);
        document.querySelector('butter-seek-preview').style.opacity=1;
      });
      const checks = await page.evaluate(() => {
        const a=fixtureActive, root=document.querySelector('butter-seek-preview').shadowRoot;
        const notice=root.querySelector('.notice'), est=root.querySelector('.est');
        const excerpts=[0,.25,.75,.95].map(progress => {
          previewFixture.render(a,a.prep.model[1].top+a.prep.model[1].h*progress-52);
          return {text:est.textContent,top:est.style.top,notice:!notice.hidden};
        });
        const box=notice.getBoundingClientRect(), style=getComputedStyle(notice);
        return {sameStart:excerpts.every(e=>e.text===excerpts[0].text && e.top==='0px' && e.notice),text:notice.textContent,border:style.borderStyle,background:style.backgroundColor,bottom:box.bottom,top:box.top,inside:box.left>=0 && box.right<=innerWidth && box.top>=52 && box.bottom<=340};
      });
      assert.ok(checks.sameStart); assert.ok(checks.inside); assert.equal(checks.border,'dashed');
      assert.ok(checks.text.includes(lang === 'zh' ? '只能预览这个回答的开头' : 'Only the start of this answer can be previewed'));
      const name=`${width}-${dark?'dark':'light'}-${lang}.png`;
      await page.screenshot({ path:new URL(name,out).pathname });
      const measured=await page.evaluate(() => {
        previewFixture.render(fixtureActive,0);
        const root=document.querySelector('butter-seek-preview').shadowRoot;
        return {noticeHidden:root.querySelector('.notice').hidden,text:root.querySelector('.layer').textContent};
      });
      assert.ok(measured.noticeHidden); assert.match(measured.text,/An opened answer/);
      if (!dark && lang==='en') await page.screenshot({ path:new URL(`${width}-measured.png`,out).pathname });
      results.push({width,dark,lang,...checks,measured});
    }
  }
  await fs.writeFile(new URL('checks.json',out),JSON.stringify(results,null,2)+'\n');
  console.log(`PASS: ${results.length} viewport/theme/language combinations; four pointer positions each; measured notices hidden; 10 screenshots.`);
} finally {
  await context?.close(); await browser?.close();
  try { const restored=await L.restore(lab); console.log(`Lab restored: ${restored.ok}`); }
  finally { console.log(JSON.stringify(L.release(lab))); }
}
