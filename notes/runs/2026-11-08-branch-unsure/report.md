# Ask in branch: unsure after a multi-paragraph quote

Build: unmodified `a8d111a7c64490b079856bf234ac945c3109b574`, `0.1.0-alpha.16`.
Scope: docs/bugfix.md Control and Red only. No extension changes, fix, commit, or push.

## Finding

Reproduced on a real ChatGPT page with the released extension loaded: **`state: unsure`, `cause: composer`**. The failing check is [extension/branch/run.js](../../../extension/branch/run.js#L215), lines 215–217:

```js
const draft = page.composerText();
if (draft === null || draft.trim().replace(/\n{3,}/g, '\n\n') !== filled.text)
  return { state: 'unsure', cause: 'composer', identity: id };
```

`draft` was non-null. Butter had verified the branch, filled successfully, found an enabled `Send` submit button, and rechecked identity/rendering successfully. It did not call `send()` in the failing run. This rules out the other `unsure` paths for this reproduction.

The real adapter fills using `document.execCommand('insertText', false, text)` and reads using `innerText`, replacing nonbreaking spaces and trimming ([page.js](../../../extension/branch/page.js#L262)). ChatGPT's composer contains paragraph elements and uses `white-space: break-spaces`. Its `innerText` introduces two newline characters between adjacent paragraphs. Butter's typed quote has single newlines between its blockquote lines. The comparison collapses runs of three or more newlines, preserving the problematic doubles.

## Control: live results

Remote lab2 was locked as `branch-unsure-research`. This worktree's `extension/` was copied to a new Snap-readable directory; the other host's repo checkout was not used as the extension source. The send guard remained installed throughout. Only POST `/backend-api/conversation/new_branch` bypassed it during branch tests. No question was delivered to ChatGPT.

| Case | Result | Typed length | Read length | Length after run.js normalization | Send calls |
|---|---|---:|---:|---:|---:|
| Chinese multi-block selection with inline math, existing `math12` fixture, Chinese question | `unsure`, `composer` | 123 | 132 | 129 | 0 |
| Plain single-paragraph English selection, existing `demo-en12` fixture, short English question | `ready` | 85 | 88 | 85 | 1, guarded |
| No extensions, native composer, synthetic Chinese two-paragraph/math message | Native send reached request preparation | — | — | — | 1, guarded |

The Chinese case went through the actual Ask in branch toolbar and question box. A CDP breakpoint at the beginning of the unmodified `start()` wrapped adapter calls and `onState`; the wrapper recorded values and called the original methods. Its trace was:

```text
loading → branching → verifying → sending (verified: true)
→ unsure (cause: composer)
fill() = true
sendButton() = { label: "Send", type: "submit", disabled: false }
isRendered(branch) = true
composerText() != null
normalized composerText() !== filled.text
send() calls = 0
```

Exact sanitized values follow. Every non-whitespace character, including blockquote markers and formula source, was replaced with `x` inside the page before returning the data. Whitespace is unchanged; the difference is therefore retained exactly. These are escaped string representations, not captured conversation text.

```text
filled.text (123):
"x xxxxxxx xxxx\nx \nx xxxxxxxxx\nx xxxxxxxxxxxxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx\nx xxx\nx \nx xxxxxx xxx xxxxxxxxxxxxxxxxxxx\n\nxxxx"

composerText() (132):
"x xxxxxxx xxxx\n\nx \n\nx xxxxxxxxx\n\nx xxxxxxxxxxxxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx\n\nx xxx\n\nx \n\nx xxxxxx xxx xxxxxxxxxxxxxxxxxxx\n\n\n\n\nxxxx"

draft.trim().replace(/\n{3,}/g, '\n\n') (129):
"x xxxxxxx xxxx\n\nx \n\nx xxxxxxxxx\n\nx xxxxxxxxxxxxxxxxxxxxxxxxxx xxxxxxxxxxxxxxxx\n\nx xxx\n\nx \n\nx xxxxxx xxx xxxxxxxxxxxxxxxxxxx\n\nxxxx"
```

The first difference is at zero-based UTF-16 index 15: expected the next non-whitespace character, read an extra newline. Data: [live-chinese.json](data/live-chinese.json).

The English case invoked the shipped `ButterBranchRun.start` with the shipped DOM adapter in the live extension's isolated world, on a real plain-text excerpt from the English fixture. It followed native branching, verified the result, and clicked the real Send button. The readback's five-newline gap between quote and question collapsed to the expected two; the strings compared equal. It used the same extension code path, with a diagnostic `onState` callback instead of the toolbar's UI callback. Data: [live-english.json](data/live-english.json).

For the no-extension control, the browser was restarted with an empty extension list. A public synthetic message was inserted into the real composer. It showed the same paragraph-induced newline expansion, but the enabled native Send button still reached `/backend-api/f/conversation/prepare`. The guard blocked two preparation requests with `net::ERR_BLOCKED_BY_CLIENT.Inspector`. No Butter host was present. This is Butter's comparison bug rather than ChatGPT refusing to send a multiline message. Data: [live-control.json](data/live-control.json).

### Attempts and limits

- Initial attempts on the workspace machine failed: the configured Snap Chromium executable and authenticated profiles were absent. After the user's host clarification, SSH and the real lab worked.
- The first remote selection attempt ran before hydration completed and found no suitable selection; it created no branch. Waiting for rendered math resolved this.
- The first toolbar observer timed out waiting for its UI locator. A separate isolated-world inspection recovered the terminal state and full adapter trace. A second toolbar attempt reproduced the same trace and observed `line unsure`; its driver was terminated during cleanup. The investigative probe is not the deterministic Red command.
- A later editor snapshot was empty even though the pre-send readback contained the formatted message. The cause above is established by the captured pre-send comparison; this run does not establish that the draft remains intact indefinitely afterward.
- The live selection was similar to the supplied example, not its exact DFS answer. It spanned multiple blocks with Chinese and inline math. The live model picker was Instant; Medium was not independently tested. Language and math are not required for the fixture failure: two English paragraphs fail too.
- No screenshot or private raw prompt/answer capture is included. The Chinese trace is transcribed from sanitized observer stdout and isolated-world inspection; the English and no-extension JSON were copied directly from sanitized script output files.

### Inventory of created chats/branches

Identifiers and chat URLs are deliberately omitted. Existing fixture chats were reused; no new seed conversation was created.

| Created context | Source | Action/result |
|---|---|---|
| Branch A | Existing `math12` in lab2's test project | First toolbar Chinese/math attempt; native branch verified; `unsure/composer`; no send call |
| Branch B | Existing `math12` in the same project | Second toolbar Chinese/math attempt; same failure; no send call; later closed by browser restart |
| Branch C | Existing `demo-en12` in the same project | Direct state-machine/adapter English control; native branch verified; `ready`; send guarded |

These are the three native branch contexts created by this investigation. Their persistence in the server sidebar was not independently audited. Extra diagnostic tabs only loaded existing fixture conversations. The no-extension control reused an existing fixture and created no branch.

## Red: one command

A pure Node unit test cannot reproduce Chromium's layout-dependent `innerText` behavior. The next preferred seam is a fixture harness. [branch-unsure-composer.mjs](../../../lab/harness/branch-unsure-composer.mjs) runs the actual, unchanged `logic.js`, `run.js`, and `page.js` in Chromium against a minimal paragraph-based composer, with the live `break-spaces` style. It fulfills all requests locally and sends no ChatGPT requests. Only call observation and the clock are substituted; filling, reading, button lookup, identity/render checks and the state machine use the production implementations.

Install harness dependencies with `npm ci --prefix lab/harness`. On this workspace, the cached Chromium revision differs from the harness's pinned revision; the executable override makes the already-run command explicit:

```sh
BROWSER_EXECUTABLE="$HOME/.cache/ms-playwright/chromium-1254/chrome-linux64/chrome" node lab/harness/branch-unsure-composer.mjs
```

Actual exit status: **1**, consistently, including after matching the live composer style. A machine with Playwright's pinned Chromium installed can run `node lab/harness/branch-unsure-composer.mjs` directly.

```text
one English paragraph: ready; sendClicks: 1
two Chinese paragraphs with inline math: unsure; cause: composer; sendClicks: 0
two English paragraphs: unsure; cause: composer; sendClicks: 0
AssertionError [ERR_ASSERTION]: two Chinese paragraphs with inline math:
full formatted message should be sent in the verified branch (cause=composer)
'unsure' !== 'ready'
```

These are condensed result rows; [red-output.txt](data/red-output.txt) contains actual stdout/stderr, with the local repo path redacted. [fixture.json](data/fixture.json) contains the exact synthetic input/readback strings and editor markup. The harness asserts the user-visible desired result, `ready`, and thus stays intentionally red until a fix exists.

Existing `node --test test/branch-run.test.js`: 38 passed, 0 failed. It uses a string-valued fake composer, which does not exercise DOM paragraph readback.

The remote lab was restored to its default no-extension configuration, home page, one tab and empty composer, then released. [restore.json](data/restore.json) records success. Command history and actual output excerpts: [commands.md](commands.md).
