# Ask in branch: hover look and formula quotes (live + fixture)

Questions: why does Butter's button turn into a flat square while ChatGPT's "Ask ChatGPT" is
hovered, and how does ChatGPT keep a formula's LaTeX source on the page?

Build: branch `t3/aib-formula` on `t3/ask-in-branch` (manifest 0.1.0-alpha.14, no version bump).
Live: lab1, `math12` fixture chat, send guard on, nothing sent (the question box was opened and
closed with Esc). No chat text is recorded here; the probe prints only styles, lengths and the
formula markers of the quote.

## Hover: root cause

`ButterBranchPage.nativeAsk` took as ChatGPT's "box" the first element, from the button up, with a
background, and Butter copied that element's height, radius, background and shadow every frame.
Live, ChatGPT's button and its toolbar box:

| element | at rest | ChatGPT's button hovered |
|---|---|---|
| `button` | background `rgba(0, 0, 0, 0)`, radius 0, no shadow, 28 px | background `rgba(255, 255, 255, 0.1)`, radius 0, no shadow, 28 px |
| `div.rounded-lg…shadow-lg` (toolbar box) | `rgb(48, 48, 48)`, radius 8 px, `shadow-lg`, 30 px | unchanged |

At rest the button is transparent, so the box was the toolbar div. While hovered the button itself
has a background, so it became the box: Butter's chip took a 28 px height, radius 0, no shadow and
the 10% white tint. That is the flat grey rectangle in the user's screenshot.

Butter's chip, live (`live-probe.mjs`, text-only selection, `TEXT_ONLY=1`):

| build | at rest | ChatGPT's button hovered |
|---|---|---|
| before (`3f451e0`) | 30 px, 8 px, `rgb(48, 48, 48)`, toolbar shadow | 28 px, 0 px, `rgba(255, 255, 255, 0.1)`, `none` |
| after | 30 px, 8 px, `rgb(48, 48, 48)`, toolbar shadow | 30 px, 8 px, `rgb(48, 48, 48)`, toolbar shadow |

Fix: a hovered, pressed or focused button is skipped when looking for the box, and while ChatGPT's
button is in one of those states Butter keeps the style it copied at rest.

## KaTeX on the live page

174 formulas in the chat (108 display); every one has `annotation[encoding="application/x-tex"]`
with its source, and a wrapper whose `data-math-source` holds the same text (174/174 equal):

- inline: `p > span[data-math-display="false"][data-math-source] > span.katex`
- display: `div.MarkdownRoot > span.Display-…[data-math-display="true"][data-math-source] > span.katex-display > span.katex`
- inside `.katex`: `span.katex-mathml > math > semantics > (mrow…, annotation)` and
  `span.katex-html[aria-hidden]` (the glyphs). Display math has `math[display="block"]`.
- Multi-line sources exist (`\boxed{\n\begin{aligned}…\end{aligned}\n}`).
- `Selection.toString()` over a formula gives both the MathML glyphs, one per line, and the HTML
  glyphs, so the old quote would have been unreadable.

With the change, the live box quote for a selection from the end of a paragraph into the middle of
the first display formula was `<text> $$\boxed{ \begin{aligned} … \end{aligned} }$$` (one line in
the box; the whole 155-character source although the selection ended on the formula's first glyph).

## Commands

```
B=~/.local/share/chatgpt-lab/bin; LAB=$($B/lab-lock acquire --lab 1 --owner aib-formula --wait 900)
LAB_ID=1 LAB_EXTENSIONS=<snap copy of extension/ at 3f451e0 or this branch> ~/.local/share/chatgpt-lab/bin/lab restart-browser
[TEXT_ONLY=1] LAB_ID=1 node notes/runs/2026-11-07-ask-in-branch-formula/live-probe.mjs before|after
$B/lab-restore --lab 1 --owner aib-formula; $B/lab-lock release --lab 1 --owner aib-formula
```

Fixture: `SHOTS=/tmp/aib-formula-shots node lab/harness/branch-qa.mjs` covers both (ChatGPT's button
hovered, Butter's own hover; a text + partial formula selection quoted as LaTeX and sent).
