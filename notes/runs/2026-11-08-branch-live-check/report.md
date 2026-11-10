# Ask in branch: live check at f501204

**Result: A and B passed; C passed placement and background checks but did not fully pass styling or disclaimer restoration; D passed its no-send placement check. Lab2 was restored and released.**

Tested the unmodified worktree at `f501204`, branch `t3/12bf9935`, manifest `0.1.0-alpha.16` (`0.1.0.16`), including commits `0169615` and `f501204`. No extension code was edited and nothing was committed. The remote extension directory was a new copy of this worktree's `extension/`; a subsequent checksum rsync dry run reported no differences.

The run finished on November 8 in the lab's local time, November 9 UTC. The requested November 8 artifact directory is retained; the index uses the UTC artifact date as required by `notes/runs/README.md`.

## Sends and terminal states

Every attempt started with a real selection, Butter's **Ask in branch** toolbar button, the question textarea, and Enter. No direct call to `ButterBranchRun.start` was used. All sends were on lab2, from branches of `math12` or `demo-en12` in its test project. Lab1 was untouched.

| Run | Selection/question | End state | Send evidence |
|---|---|---|---|
| A initial | Two adjacent Chinese paragraphs, three inline formulas; Chinese question | `ready` | One real conversation request, HTTP 200; outgoing 123-character formatted message exactly matched Butter's expected string |
| A capture repeat | Same selection and question | `ready` | One real conversation request, HTTP 200; exact 123-character match; response stream completed |
| B | One English paragraph, 65-character excerpt; English question | `ready` | One real conversation request, HTTP 200; exact 85-character formatted message match |
| D | Same Chinese/math selection | `unsure`, cause `send` | Zero adapter `send` calls and zero conversation requests |

Three real sends were confirmed; the incomplete first attempt below has unresolved send status. No additional seed chats were created. See [Chinese/math data](data/chinese-math.json), [initial Chinese/math data](data/chinese-math-initial.json), [English data](data/english.json), and [unsure data](data/unsure.json).

In both A runs, the composer read back 132 characters for a 123-character expected message. The old comparison was false, while the shipped `sameDraft` comparison was true. The adapter then sent from a verified branch. This directly exercises the reported paragraph/newline regression with Chinese and inline math. B's corresponding lengths were 88 and 85, with both old and new comparisons true.

The confirmation is stronger than a click alone: the complete outgoing message was compared in memory, and the real server returned HTTP 200. A's response delivered 438 SSE data events and a terminal `data: [DONE]`; the reply became written and Butter faded. A diagnostic parser looking only for old-style top-level `message.author` objects found none, so its `assistantEvents: 0` field is a schema limitation, not evidence of an empty response. No prompt, response, formula source, conversation ID, URL, or raw network body was saved in the report.

Independent server persistence lookup was not established: the extra GET based on the page pathname returned 404 in A initial and B. The A repeat stopped at the failed post-fade visibility assertion before that lookup. Therefore this report confirms exact payload dispatch, server acceptance and live reply rendering; it does not claim a separate server-history audit.

## Live placement and style

The default content viewport was 1599 by 912 CSS pixels (the lab window is nominally 1600 by 1000). The narrow viewport was 800 by 912. The sidebar remained in the lab's existing state; screenshots exclude it.

The persisted account theme was `light`. Dark checks used only temporary DOM theme attributes/classes on the destination tab, which drove ChatGPT's live dark CSS and Butter's observer. They did not use or save an account setting. Attributes were restored and `localStorage.theme` was verified unchanged for A, B and D. This verifies dark rendering with an ephemeral page override, not the account's theme-setting UI or OS theme preference handling.

All twelve shown-line samples passed the requested one-pixel tolerance with **zero measured difference** in left, top, width and height. All twelve centre hit tests returned the `CHATGPT-BUTTER-BRANCH` host. The line was opaque and matched the nearest opaque page ancestor's background in all twelve samples. [Derived checks](data/checks.json) preserve each result.

| Case/state | Width | Line and disclaimer rectangle: left, top, width, height (CSS px) | Themes |
|---|---:|---|---|
| A ready | 1599 | 367, 813, 1206, 16 | light, dark |
| A ready | 800 | 367, 813, 407, 16 | light, dark |
| B ready | 1599 | 367, 813, 1206, 16 | light, dark |
| B ready | 800 | 367, 813, 407, 16 | light, dark |
| D unsure | 1599 | 367, 598, 1206, 16 | light, dark |
| D unsure | 800 | 367, 598, 407, 16 | light, dark |

Font size, line height and weight matched in every sample: 12 px, 16 px, 400. A CDP `CSS.getPlatformFontsForNode` check in D showed **Noto Sans / NotoSans-Regular** for both Butter's line text and ChatGPT's disclaimer. However, exact styling does not match:

| Property | Butter line | Disclaimer |
|---|---|---|
| Light text colour | `rgb(93, 93, 93)` | `rgb(143, 143, 143)` |
| Dark text colour | `rgb(180, 180, 180)` | `rgb(175, 175, 175)` |
| Light background | `rgb(252, 252, 252)` | Page ancestor: same |
| Dark background | `rgb(0, 0, 0)` | Page ancestor: same |
| CSS font stack | Begins `ui-sans-serif, -apple-system, system-ui` | Begins `-apple-system-body, ui-sans-serif, -apple-system, system-ui` |

Thus rendered typeface, size, leading and weight match on this Linux lab, but the foreground colour and declared font stack differ. Exact disclaimer typography is not a full pass. The raw computed styles and platform-font result are in the case data.

## Fade and disclaimer restoration

A repeat recorded `.line.ready.row` gaining `out` while there were 17 written replies, then being removed about 340 ms later. The CSS transition duration was 0.2 s. This is functional lifecycle evidence, not a timing benchmark. B's line also disappeared after the real reply was released.

**The post-fade disclaimer visibility check failed.** In A repeat, no matching disclaimer was inside the viewport after fade. The remaining disclaimer node was below the page viewport; a subsequent read found its top at 109988 px with a viewport height of 912 px. In B, the post-reply node was at 3017 px. The composer remained near the bottom of the viewport. The first B selector mistakenly labelled a positive-size offscreen node as visible; its data is explicitly annotated as invalid for visibility and its screenshot was excluded. The corrected A assertion failed with `AssertionError: visible disclaimer`.

This run does not establish whether ChatGPT's reflow, another part of Butter, the retained sidebar state, or the response-buffering intervention causes the displaced disclaimer. It does establish that the required visible restoration was not observed. No code was changed to investigate it further. [After-reply data](data/after-reply.json) and [privacy-masked screenshot](screenshots/A-after-reply.png) preserve the observed state.

D's close button **did** reveal the disclaimer at its original location. The centre hit then landed on a native `DIV`, `disclaimerVisible` was true, and the Butter line was absent. [Dismissed screenshot](screenshots/D-dismissed.png).

## Unsure intervention and observation method

The prior `branch-unsure` report and its `live-probe.mjs` / `live-adapter-probe.mjs` supplied the approach. A CDP breakpoint at the start of the shipped `start()` wrapped adapter calls and `onState`, called their originals, and retained only boolean checks, lengths and state names. The original toolbar callback still rendered the actual line. The extension files on disk stayed unchanged.

For D only, the probe set native submit/send buttons' DOM `disabled` and `aria-disabled` state before each real `sendButton()` lookup. The shipped three-second wait reached `unsure/send`. An additional route aborted any unexpected real conversation send. None occurred. The formatted draft was then cleared without submitting, the line was dismissed, and the destination tab closed.

For A and B, Playwright forwarded the real conversation request with `route.fetch()`, buffered its real response and withheld delivery to the page while the four placement screenshots were taken. It then fulfilled the original request with that response. This made the short-lived ready line measurable without resending at every width/theme; it changes response-delivery timing and is a limitation for natural-stream fade timing. It does not change the toolbar flow, adapter comparison, payload, or server response. A very slow renderer meant the nominal state-machine waits were not reliable wall-clock durations; no performance claim is made.

The first A destination became unresponsive before a terminal state was collected; recovery connections also timed out. It was terminated and the browser restarted under the same lock. Native branch creation and sending during that incomplete attempt could not be confirmed; no send was observed. The completed A initial then required a capture repeat because the first selectors chose hidden composer/disclaimer copies and produced unusable 24-pixel-wide crops. Those images were excluded. The corrected shown-line selectors measure visible DOM elements. Total confirmed sends remain three, with the incomplete first attempt explicitly unresolved rather than counted as a pass.

## Screenshot inventory and privacy

Every included PNG is a bottom-only crop. Editor contents are masked before capture; the title substring in ready text is masked separately, leaving the public state wording visible. Sidebar, chat titles, IDs and URLs are excluded. The after-reply shot also masks message regions because their unexpected position could put answer text inside the crop. It consequently shows a large grey privacy mask, not usable visual proof of a restored disclaimer. JSON stores only geometry/styles, state names, lengths, booleans and generic method labels. Raw bodies and private navigation recovery data stayed outside the repository.

| State/case | Default light | Default dark | 800 light | 800 dark |
|---|---|---|---|---|
| A ready | [PNG](screenshots/A-1599-light.png) | [PNG](screenshots/A-1599-dark.png) | [PNG](screenshots/A-800-light.png) | [PNG](screenshots/A-800-dark.png) |
| B ready | [PNG](screenshots/B-1599-light.png) | [PNG](screenshots/B-1599-dark.png) | [PNG](screenshots/B-800-light.png) | [PNG](screenshots/B-800-dark.png) |
| D unsure | [PNG](screenshots/D-1599-light.png) | [PNG](screenshots/D-1599-dark.png) | [PNG](screenshots/D-800-light.png) | [PNG](screenshots/D-800-dark.png) |

Additional states: [A after reply](screenshots/A-after-reply.png), [D after dismissal](screenshots/D-dismissed.png).

## Created contexts

Aliases below intentionally replace all real titles and identifiers. No new seed conversation was created; the two existing fixtures were reused.

| Context | Source | Action/result |
|---|---|---|
| Destination 0 | `math12`, test project | Initial toolbar attempt; destination opened, then renderer became unresponsive. Branch creation, persistence and send unconfirmed. Closed by restart. |
| Branch 1 | `math12`, test project | Completed A initial: verified native branch, ready, one confirmed real send. Closed after run. |
| Branch 2 | `demo-en12`, test project | B: verified native branch, ready, one confirmed real send. Closed after run. |
| Branch 3 | `math12`, test project | A capture repeat: verified native branch, ready, one confirmed real send. Remaining tab closed during restore after failed post-fade assertion. |
| Branch 4 | `math12`, test project | D: verified native branch, unsure/send, zero sends. Draft cleared, line dismissed, tab closed. |

Four native branches were confirmed, plus one incomplete destination whose branch creation is unknown. Browser cleanup closed tabs; it did not delete server-side branches. Their saved titles/sidebar persistence were not separately audited. Diagnostic connections only inspected existing tabs. The temporary workspace preview tab was blank, not an authenticated lab chat, and was closed before testing.

## Restore and release

`L.restore()` restarted lab2 with its defaults: no extensions, no extra flags, one home tab, empty composer, send guard on. It returned `ok: true`. `L.release()` then returned `lab_released: true`; no performance lock had been taken. [Restore evidence](data/restore.json), [release evidence](data/release.json).

Commands and actual output excerpts, including failed attempts and tooling limits: [commands.md](commands.md).
