// Copies of Butter's real stream/offscreen.js and stream/containment.css with one of the veil's
// covers taken out, for the tests that show each cover alone keeps a rendered block unveiled and
// that the check fails without any (test/stream-veil-hr-chromium.test.mjs). Each cut throws when
// the code it removes is not found, so a variant can never silently be the real build.
import { readFileSync } from 'node:fs';

const cut = (source, from, to, what) => {
  const out = source.replace(from, to);
  if (out === source) throw new Error(`variant: ${what} not found`);
  return out;
};

// The marker's covers (stream/offscreen.js).
export const marker = {
  // The completion sweep: every veiled block of a turn that leaves in_progress, not held.
  completionSweep: (js) =>
    cut(
      js,
      /\n\s*for \(const el of t\.querySelectorAll\(`\[\$\{VEIL\}\]`\)\)\n\s*if \(!el\.hasAttribute\('data-butter-unrendered'\)\) unveil\(el\);/,
      '',
      'the completion sweep',
    ),
  // The cv-off sweep: every veiled block in the page when cv goes off.
  cvSweep: (js) =>
    cut(
      js,
      /\n\s*for \(const el of document\.querySelectorAll\(`\[\$\{VEIL\}\]`\)\) \(unveil\(el\), drawn\.add\(el\)\);/,
      '',
      'the cv-off sweep',
    ),
  // The re-entry unveil (watch()): a veiled block that comes back outside a streaming turn.
  reentry: (js) =>
    cut(
      js,
      /\n\s*if \(el\.hasAttribute\(VEIL\) && !el\.hasAttribute\('data-butter-unrendered'\) && !el\.closest\(BUSY\)\)\n\s*unveil\(el\);/,
      '',
      'the re-entry unveil',
    ),
};

// Not covers: pre-layout (offscreen.js's prelayout()), whole or without its pass after web fonts
// load, for the tests that compare a find or a jump with and without it.
marker.prelayout = (js) =>
  cut(js, /\n\s*if \(r\.oldValue === 'in_progress'\)\n\s*setTimeout\([^\n]*\n/, '\n', 'pre-layout');
marker.prelayoutFonts = (js) =>
  cut(js, /\n\s*document\.fonts\?\.addEventListener\('loadingdone'[^\n]*/, '', 'the font pass');

// Not a cover: the first prototype's "rendered once" test, a mark (shown or seen) instead of the
// `drawn` set that the state-change event fills. A block no mark records, such as an <hr>, is then
// veiled again when it is skipped after it rendered.
marker.drawn = (js) =>
  cut(js, '!off() && !drawn.has(el) &&', '!off() && !shown.has(el) &&', 'the rendered-once test');

// The stylesheet's covers (stream/containment.css), on the veil's opacity rule.
const RULE = /@media screen \{[\s\S]*?\{\s*opacity: 0;\s*\}\s*\}/;
export const stylesheet = {
  // The second guard: the rule applies only where the `content-visibility: auto` rules for unmarked
  // blocks do. Without it, as in the first prototype, the rule is every veiled answer block.
  ruleGuard: (css) =>
    cut(
      css,
      RULE,
      `@media screen {
  html:not([data-butter-off~='cv']) [data-markdown-text-style='assistant-message'] > [data-butter-veil]:not([data-dil-source-message-id]):not([data-wide-block]):not([class*='TableFrame-']),
  html:not([data-butter-off~='cv']) [data-markdown-text-style='assistant-message'] [class*='DilResponseRoot'] > [data-butter-veil]:not([data-wide-block]):not([class*='TableFrame-']) {
    opacity: 0;
  }
}`,
      "the veil rule's selectors",
    ),
  // The `cv` guard on <html>: the rule applies only while cv is on.
  cvGuard: (css) =>
    cut(
      css,
      RULE,
      css.match(RULE)[0].replaceAll(`html:not([data-butter-off~='cv'])`, 'html'),
      "the veil rule's cv guard",
    ),
};

// Butter's sources from `extension` (a directory path ending in /) with the named covers cut, as
// openChat() takes them: `cuts` lists `marker.<name>` and `stylesheet.<name>` functions.
export function variant(extension, cuts = []) {
  let js = readFileSync(`${extension}stream/offscreen.js`, 'utf8');
  let css = readFileSync(`${extension}stream/containment.css`, 'utf8');
  for (const c of cuts)
    if (Object.values(marker).includes(c)) js = c(js);
    else css = c(css);
  return { js, css };
}
