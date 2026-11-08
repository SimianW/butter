// Live: Butter's chip with ChatGPT's button at rest and hovered; quote for a text+formula selection.
// Lab1, send guard on; nothing is sent (the box is opened and closed with Esc).
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
const tag = process.argv[2];
const lab = L.getLab(1);
const { browser, context } = await L.connect(lab);
await L.sendGuard(context, lab);
const page = context.pages()[0];
await page.goto(L.fixture(lab, 'math12'), { waitUntil: 'domcontentloaded' });
await page.waitForSelector('[data-markdown-text-style="assistant-message"]', { timeout: 60000 });
for (let i = 0; i < 40; i++) {
  const k = await page.evaluate(() => { const sc = [...document.querySelectorAll('.thread-scroll-container')].at(-1) || document.scrollingElement; sc.scrollTop = 0; return document.querySelectorAll('.katex-display').length; });
  if (k >= 2) break; await page.waitForTimeout(1500);
}
await page.waitForTimeout(1500);
await page.mouse.move(5, 500);
const info = await page.evaluate((TEXT_ONLY) => { const process = { env: { TEXT_ONLY } };
  // From the end of the paragraph before the first display formula into the middle of the formula.
  const disp = [...document.querySelectorAll('[data-markdown-text-style="assistant-message"] .katex-display')][0];
  disp.scrollIntoView({ block: 'center' });
  let block = disp; while (!block.previousElementSibling) block = block.parentElement;
  const before = block.previousElementSibling;
  const w = document.createTreeWalker(before, NodeFilter.SHOW_TEXT); let n, last; while ((n = w.nextNode())) if (n.textContent.trim()) last = n;
  const glyph = disp.querySelector('.katex-html .mord, .katex-html .mord *');
  const gt = document.createTreeWalker(disp.querySelector('.katex-html'), NodeFilter.SHOW_TEXT).nextNode();
  const r = document.createRange(); r.setStart(last, Math.max(0, last.length - 4)); if (process.env.TEXT_ONLY) r.setEnd(last, last.length); else r.setEnd(gt, Math.min(1, gt.length));
  getSelection().removeAllRanges(); getSelection().addRange(r);
  return { textOnly: !!process.env.TEXT_ONLY, tex: disp.querySelector('annotation[encoding="application/x-tex"]').textContent.length };
}, process.env.TEXT_ONLY || '');
const chipState = () => page.evaluate(() => {
  const chip = document.querySelector('chatgpt-butter-branch')?.shadowRoot?.querySelector('.chip[data-on]');
  const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim().replace(/^❝\s*/, '') === 'Ask ChatGPT');
  const css = (el) => el && (({ height, borderTopLeftRadius, backgroundColor, boxShadow }) => ({ height, borderTopLeftRadius, backgroundColor, boxShadow }))(getComputedStyle(el));
  const r = btn?.getBoundingClientRect();
  return { chip: css(chip), nativeBox: css(btn?.parentElement), center: r && [r.x + r.width / 2, r.y + r.height / 2], chipBox: chip && chip.getBoundingClientRect().toJSON() };
});
let s;
for (let i = 0; i < 20 && !(s = await chipState()).chip; i++) await page.waitForTimeout(250);
const out = { tag, texLen: info.tex, rest: s.chip, nativeBoxRest: s.nativeBox };
if (s.chip) {
  await page.mouse.move(...s.center); await page.waitForTimeout(600);
  out.nativeHovered = (await chipState()).chip;
  const c = s.chipBox;
  await page.screenshot({ path: `/tmp/aib-probe/live-native-hover-${tag}${process.env.TEXT_ONLY ? '-text' : ''}.png`, clip: { x: c.x - 200, y: c.y - 30, width: c.width + 260, height: c.height + 60 } });
  await page.mouse.move(5, 500); await page.waitForTimeout(400);
  // Open the box (pointerdown on Butter's button), read the quote, close with Esc. Nothing is sent.
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2); await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(500);
  out.boxQuote = await page.evaluate(() => document.querySelector('chatgpt-butter-branch')?.shadowRoot?.querySelector('.qpop .q span')?.textContent ?? null);
  await page.keyboard.press('Escape');
}
await page.evaluate(() => getSelection().removeAllRanges());
// Only the quote's shape is reported (formula markers), not chat text.
if (out.boxQuote) out.boxQuoteShape = { startsTextThenDisplay: /^[^$]+ \$\$\\boxed\{/.test(out.boxQuote), endsWith$$: out.boxQuote.endsWith('$$'), len: out.boxQuote.length };
console.log(JSON.stringify({ ...out, boxQuote: out.boxQuote && out.boxQuote.replace(/^[^$]*/, '<text> ') }, null, 1));
await browser.close();
