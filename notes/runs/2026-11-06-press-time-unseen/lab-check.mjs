// Read-only lab1 discovery; never prints links, titles, identifiers or chat content.
import * as L from '/home/simon/.local/share/chatgpt-lab/lib/lab.mjs';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
const lab = L.acquire('1', { owner: 'press-time-unseen', wait: 45 });
const root = new URL('../../../', import.meta.url);
const extensionDir = '/home/simon/snap/chromium/common/butter-press-time-unseen';
let stage = 'copy';
try {
  await fs.cp(new URL('extension/', root), extensionDir, { recursive: true });
  stage = 'restart';
  execFileSync('/home/simon/.local/share/chatgpt-lab/bin/lab', ['restart-browser'], {
    env: { ...process.env, LAB_ID: '1', LAB_EXTENSIONS: extensionDir },
    stdio: 'ignore',
  });
  stage = 'cdp';
  for (let i = 0; i < 40; i++) {
    if (await L.cdpVersion(lab)) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  stage = 'connect';
  const { browser, context } = await L.connect(lab);
  await L.sendGuard(context, lab);
  const page = context.pages()[0];
  stage = 'home';
  await page.goto(lab.homeUrl);
  await page.waitForSelector('[data-turn-key]', { timeout: 20000 });
  await page.waitForTimeout(1800);
  const links = await page
    .locator('a[href*="/c/"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.href))]);
  const projects = await page
    .locator('a[href*="/g/g-p-"]')
    .evaluateAll((as) => [...new Set(as.map((a) => a.href))]);
  console.log(JSON.stringify({ conversationLinks: links.length, projectLinks: projects.length }));
  // Include a project listing, if exposed, so any existing nested conversation is discovered.
  for (const url of projects.slice(0, 2)) {
    await page.goto(url);
    await page.waitForTimeout(800);
    for (const u of await page
      .locator('a[href*="/g/g-p-"][href*="/c/"]')
      .evaluateAll((as) => as.map((a) => a.href)))
      if (!links.includes(u)) links.unshift(u);
  }
  if (!links.includes(lab.homeUrl)) links.push(lab.homeUrl);
  let checked = 0,
    singleFound = false,
    projectSingleFound = false;
  for (const url of links.slice(0, 20)) {
    await page.goto(url);
    await page.waitForSelector('[data-turn-key]', { timeout: 12000 }).catch(() => {});
    await page.waitForTimeout(400);
    const state = await page.evaluate(() => {
      const t = document.querySelector('[data-turn-key]');
      let f = t?.[Object.keys(t).find((k) => k.startsWith('__reactFiber$'))];
      for (let d = 0; f && d < 80; d++, f = f.return)
        if (Array.isArray(f.memoizedProps?.entries) && f.memoizedProps.RowComponent)
          return {
            turns: f.memoizedProps.entries.length,
            dil: !!document.querySelector('[class*="DilResponseRoot"]'),
            project: /\/g\/g-p-/.test(location.pathname),
          };
      return { turns: null, project: /\/g\/g-p-/.test(location.pathname) };
    });
    checked++;
    console.log(JSON.stringify(state));
    if (state.turns !== 1) continue;
    singleFound = true;
    projectSingleFound ||= state.project;
    await page.evaluate(async () => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find(
        (s) => s.clientHeight > 0,
      );
      for (let y = 0; y < s.scrollHeight; y += 400) {
        s.scrollTop = y;
        await new Promise((r) => setTimeout(r, 40));
      }
    });
    await page.waitForTimeout(1000);
    await page.evaluate(() => {
      globalThis.copy = (json) => (globalThis.fixtureReadiness = JSON.parse(json));
    });
    stage = 'readiness';
    console.log(
      JSON.stringify({
        globals: await page.evaluate(() => ({
          cache: !!globalThis.__butterLayoutCache,
          core: !!globalThis.__butterSeekCore,
          press: !!globalThis.__seekDump,
        })),
      }),
    );
    await page.evaluate(
      await fs.readFile(new URL('notes/diagnostics/capture-record-readiness.js', root), 'utf8'),
    );
    const readiness = await page.evaluate(() => fixtureReadiness);
    console.log(JSON.stringify({ readiness }));
    stage = 'press';
    const point = await page.evaluate(() => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find(
          (s) => s.clientHeight > 0,
        ),
        r = s.getBoundingClientRect();
      const gutter = s.offsetWidth - s.clientWidth,
        track = s.clientHeight - 24,
        thumb = Math.max(12, (track * s.clientHeight) / s.scrollHeight);
      return {
        x: r.left + s.offsetWidth - Math.max(2, gutter / 2),
        y:
          r.top +
          12 +
          ((track - thumb) * s.scrollTop) / (s.scrollHeight - s.clientHeight) +
          thumb / 2,
      };
    });
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await page.evaluate(() => {
      const s = [...document.querySelectorAll('.thread-scroll-container')].find(
        (s) => s.clientHeight > 0,
      );
      s.scrollTop = Math.max(0, s.scrollTop - 200);
    });
    const activated = await page
      .waitForFunction(() => __butterSeeking(), null, { timeout: 1500 })
      .then(
        () => true,
        () => false,
      );
    console.log(
      JSON.stringify({
        livePress: {
          activated,
          ...(await page.evaluate(() => ({
            decision: __seekDump.pressDecision,
            notice:
              document.querySelector('butter-seek-preview')?.shadowRoot?.querySelector('.notice')
                ?.hidden === false,
            press: __seekDump().presses.at(-1),
          }))),
        },
      }),
    );
    await page.mouse.up();
    await page.waitForTimeout(300);
    if (activated) {
      await page.evaluate(() => {
        globalThis.copy = (json) => (globalThis.fixturePressCapture = JSON.parse(json));
      });
      await page.evaluate(
        await fs.readFile(new URL('notes/diagnostics/capture-press-decision.js', root), 'utf8'),
      );
      console.log(
        JSON.stringify({ releasedCapture: await page.evaluate(() => fixturePressCapture) }),
      );
    }
    if (state.project && readiness.turns[0].layout && activated) break;
  }
  console.log(JSON.stringify({ checked, singleFound, projectSingleFound }));
  await browser.close();
} catch (e) {
  console.log(
    JSON.stringify({
      error: e.name,
      stage,
      exit: e.status,
      code: e.code,
      reason: /Virtualizer shape unavailable/.test(e.message)
        ? 'virtualizer-shape'
        : /Use the ChatGPT page Console/.test(e.message)
          ? 'globals-unavailable'
          : /TrustedScript/.test(e.message)
            ? 'trusted-types'
            : /Timeout/.test(e.message)
              ? 'timeout'
              : 'other',
    }),
  );
  process.exitCode = 1;
} finally {
  await L.restore(lab, { log: () => {} });
  L.release(lab);
  await fs.rm(extensionDir, { recursive: true, force: true });
  console.log(JSON.stringify({ restored: true, released: true }));
}
