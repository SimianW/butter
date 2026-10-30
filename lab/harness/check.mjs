import { chromium } from 'playwright';
const b = await chromium.connectOverCDP('http://127.0.0.1:9222');
const ctx = b.contexts()[0];
const p = ctx.pages().find(x => x.url().includes('chatgpt.com')) ?? await ctx.newPage();
if (!p.url().includes('chatgpt.com')) await p.goto('https://chatgpt.com/');
await p.waitForTimeout(3000);
console.log('title:', await p.title());
console.log('probe:', await p.evaluate(() => document.documentElement.dataset.labProbe));
console.log('webdriver:', await p.evaluate(() => navigator.webdriver));
await p.screenshot({ path: process.argv[2] });
const s = await ctx.newPage(); await s.goto('chrome://sandbox');
console.log((await s.innerText('body')).split('\n').filter(l => /Seccomp|Namespace|sandboxed/i.test(l)).slice(0,4).join(' | '));
await s.close(); await b.close();   // close = disconnect only, browser keeps running
