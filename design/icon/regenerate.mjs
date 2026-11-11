// Run after `npm ci` at the repository root; uses its local, headless Chromium.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
const browser = await chromium.launch({ headless: true });
try {
  for (const size of [16, 32, 48, 128]) {
    const source = new URL(size === 16 ? './butter-icon-final-16.svg' : size === 32 ? './butter-icon-toolbar.svg' : './butter-icon-final.svg', import.meta.url);
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${await readFile(source, 'utf8')}`);
    await page.screenshot({ path: new URL(`../../extension/icons/icon-${size}.png`, import.meta.url).pathname, omitBackground: true });
    await page.close();
    console.log(`icon-${size}.png (${size}×${size}, transparent)`);
  }
} finally { await browser.close(); }
