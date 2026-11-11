// A long synthetic ChatGPT chat for dev-capture-qa.mjs, close enough to the live page for
// Butter's layout cache to record it. No ChatGPT requests: the harness serves it for chatgpt.com.
//
// - 140 turns in the virtualizer: the first 20 are older history, not mounted (a spacer holds
//   their height, as ChatGPT's virtualizer does), the other 120 are mounted.
// - Turns carry data-turn-key and data-talvt-turn-state="complete"; answers sit under
//   data-message-author-role="assistant" with a data-message-id, in a
//   data-markdown-text-style="assistant-message" column, as on the live page.
// - Answers mix paragraphs, headings, lists, code blocks, inline and display formulas in KaTeX
//   markup (as branch/fixture.mjs, live 2026-11-07). Every 17th turn holds a formula ChatGPT has
//   not typeset yet (raw TeX in data-math-source), which the cache rejects as math-pending.
// - The first mounted turn carries a stand-in React fiber with the virtualizer's entries
//   (turn order) and its measured row heights: the read-only shape the seek code and the
//   diagnostics snippets look up.
// Every question, answer, formula, ID and URL is a planted marker that a bug file must not hold.
export const CONV = '0f3c6a2e-5b1d-4e7a-9c3b-2a6d8e1f4b70';
export const QUESTION = 'Fixture question about the binomial theorem';
export const ANSWER = 'Fixture answer paragraph with enough words to wrap across the column.';
export const TEX = {
  inline: '\\binom{n}{k}',
  display: '(x+y)^n=\\sum_{k=0}^{n}\\binom{n}{k}x^{n-k}y^k',
  pending: '\\int_0^1 x^2\\,dx=\\tfrac13',
};
export const LINK = 'https://example.org/fixture-source';
export const TURNS = 140,
  UNMOUNTED = 20,
  UNMOUNTED_HEIGHT = 900;
const hex = (prefix, i) => `${prefix}-0000-4000-8000-${String(i).padStart(12, '0')}`;
export const turnKey = (i) => hex('5d0c7a19', i);
export const messageId = (i) => hex('9e2b4f60', i);
const pending = (i) => i % 17 === 5;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const katex = (tex, display) => {
  const glyphs = [...tex.replace(/\\[a-z]+|[{}^_\\]/g, '')].slice(0, 16);
  const inner = `<span class="katex"><span class="katex-mathml"><math xmlns="http://www.w3.org/1998/Math/MathML"${display ? ' display="block"' : ''}><semantics><mrow>${glyphs.map((c) => `<mi>${esc(c)}</mi>`).join('')}</mrow><annotation encoding="application/x-tex">${esc(tex)}</annotation></semantics></math></span><span class="katex-html" aria-hidden="true"><span class="base"><span class="strut"></span>${glyphs.map((c) => `<span class="mord">${esc(c)}</span>`).join('')}</span></span></span>`;
  return display
    ? `<span class="math-display" data-math-display="true" data-math-source="${esc(tex)}"><span class="katex-display">${inner}</span></span>`
    : `<span data-math-display="false" data-math-source="${esc(tex)}">${inner}</span>`;
};
const question = (i) => `${QUESTION} ${i + 1}`;
// The answer's blocks; markdown() is the same answer as the conversation data carries it.
function blocks(i) {
  const out = [`<p>${ANSWER} ${katex(TEX.inline)} ${ANSWER}</p>`];
  if (i % 3 === 0) out.push(`<h3>${ANSWER.slice(0, 24)}</h3>`, `<p>${katex(TEX.display, true)}</p>`);
  for (let p = 0; p < 2 + (i % 4); p++) out.push(`<p>${ANSWER} ${ANSWER} <a href="${LINK}">${LINK}</a></p>`);
  if (i % 4 === 1) out.push(`<pre><code>const fixture = ${i};\n// ${ANSWER}</code></pre>`);
  if (i % 5 === 2) out.push(`<ul><li>${ANSWER}</li><li>${ANSWER}</li><li>${ANSWER}</li></ul>`);
  if (pending(i)) out.push(`<p><span data-math-display="false" data-math-source="${esc(TEX.pending)}">${esc(TEX.pending)}</span></p>`);
  return out.join('');
}
const markdown = (i) =>
  [
    `${ANSWER} $${TEX.inline}$ ${ANSWER}`,
    ...(i % 3 === 0 ? [`### ${ANSWER.slice(0, 24)}`, `$$${TEX.display}$$`] : []),
    ...Array.from({ length: 2 + (i % 4) }, () => `${ANSWER} ${ANSWER} ${LINK}`),
    ...(pending(i) ? [`$${TEX.pending}$`] : []),
  ].join('\n\n');

export function chatHtml() {
  const turns = [];
  for (let i = UNMOUNTED; i < TURNS; i++)
    turns.push(
      `<div class="row"><article data-turn-key="${turnKey(i)}" data-testid="conversation-turn-${i + 1}" data-talvt-turn-state="complete">` +
        `<div class="user"><div data-user-message-bubble>${question(i)}</div></div>` +
        `<div data-message-author-role="assistant" data-message-id="${messageId(i)}"><div data-markdown-text-style="assistant-message" class="markdown prose">${blocks(i)}</div></div>` +
        `</article></div>`,
    );
  const spacer = UNMOUNTED * (UNMOUNTED_HEIGHT + 12) - 12;
  return `<!doctype html><html><head><title>Fixture chat</title><style>
body { margin:0; overflow:hidden; font:16px/26px sans-serif; background:#fff; color:#111 }
.thread-scroll-container { height:100vh; overflow-y:scroll; overflow-anchor:none }
.content { padding:48px 0 400px }
.spacer { height:${spacer}px; margin-bottom:12px }
.row { margin-bottom:12px }
article { display:block; width:768px; margin:0 auto }
.user { display:flex; justify-content:flex-end }
[data-user-message-bubble] { margin:14px 0; padding:8px 14px; max-width:72%; background:#f4f4f4; border-radius:18px }
[data-markdown-text-style] p, [data-markdown-text-style] ul, [data-markdown-text-style] pre { margin:0 0 16px }
pre { background:#f6f6f6; padding:12px; white-space:pre-wrap }
.katex { position:relative; font:1.15em/1.2 "Times New Roman",serif; white-space:nowrap }
.katex-mathml { position:absolute; clip:rect(1px,1px,1px,1px); padding:0; border:0; height:1px; width:1px; overflow:hidden }
.math-display { display:block; margin:0 0 14px } .katex-display { display:block; text-align:center }
/* ChatGPT's dark theme, for the toast's dark check (#45). */
.dark body { background:#212121; color:#ececec }
.dark [data-user-message-bubble] { background:#303030 }
</style></head><body><div class="thread-scroll-container"><div class="content"><div class="spacer"></div>${turns.join('')}</div></div><script>
(() => {
  const TURNS = ${TURNS}, UNMOUNTED = ${UNMOUNTED};
  const key = (i) => ${JSON.stringify(turnKey(0))}.slice(0, -12) + String(i).padStart(12, '0');
  const msg = (i) => ${JSON.stringify(messageId(0))}.slice(0, -12) + String(i).padStart(12, '0');
  const markdown = ${JSON.stringify(Array.from({ length: TURNS }, (_, i) => markdown(i)))};
  // The conversation data the history hook would deliver: turn order and text for the seek model.
  const messages = [];
  for (let i = 0; i < TURNS; i++)
    messages.push(
      { id: key(i), author: { role: 'user' }, content: { parts: [${JSON.stringify(QUESTION)} + ' ' + (i + 1)] } },
      { id: msg(i), author: { role: 'assistant' }, content: { parts: [markdown[i]] } },
    );
  document.dispatchEvent(new CustomEvent('butter-seek-data', {
    detail: { conv: ${JSON.stringify(CONV)}, before: false, j: { messages } },
  }));
  // The virtualizer's fiber: entries in turn order, and measured heights for every row it has
  // laid out (the unmounted history keeps the height it had when it was last mounted).
  const heights = {};
  for (let i = 0; i < UNMOUNTED; i++) heights[key(i)] = ${UNMOUNTED_HEIGHT};
  const first = document.querySelector('[data-turn-key]');
  first.__reactFiber$fixture = {
    memoizedProps: {},
    return: {
      memoizedProps: { entries: Array.from({ length: TURNS }, (_, i) => ({ turnKey: key(i) })), RowComponent() {} },
      memoizedState: { memoizedState: null, next: { memoizedState: heights, next: null } },
    },
  };
  const measure = () => {
    for (const t of document.querySelectorAll('[data-turn-key]'))
      heights[t.dataset.turnKey] = t.parentElement.getBoundingClientRect().height;
  };
  measure();
  new ResizeObserver(measure).observe(document.querySelector('.content'));
})();
</script></body></html>`;
}
