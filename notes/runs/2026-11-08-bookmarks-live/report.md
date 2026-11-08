# #57 bookmarks live lab — 2026-11-08

**FAIL: the live-lab acceptance criterion is unmet.** On the real long-chat fixture,
Butter cannot create a paragraph or selection bookmark. This blocks the requested bookmark
jumps and the comparison of drags with and without bookmarks. No extension code was changed.

Tested `t3/57-bookmark-lab` at `338bf362dfd955cf7357f18916451f7a84bfdb98` (contains `origin/t3/51-bookmarks`),
version `0.1.0-alpha.15`, Linux headed Chromium `156.0.8078.47`. The task's `extension/`
was copied byte-for-byte to a fresh Snap-readable unpacked install; the tree SHA-256 is
`11c86c110afd296681d77edf8f5571feb52d7f4ed7a1e172cd1d9250f7bfe03d`. The named `math12` fixture was read under both the lab and perf locks.
The guard remained on: **0 send attempts**; 44 unrelated non-read requests were blocked.
No composer input or new prompt was used. The test install temporarily received Alt+Shift+M;
the original shortcut preferences were restored afterwards.

## Results

| Check | Result | Evidence |
|---|---|---|
| Existing long chat / older history | PASS | 5 initial questions, 16 after 11 successful earlier-page reads. |
| Hover and bookmark a paragraph | FAIL | Paragraph in view and pointer hit a paragraph; 0 hover buttons, 0 stored bookmarks, 0 rail segments. |
| Select text and press real Alt+Shift+M | FAIL | 30 characters selected; Chrome's bookmark command listener recorded 1 command; 0 stored bookmarks and 0 segments. |
| Jump during a native scrollbar drag | BLOCKED | No bookmark could be created. |
| Jump after a native scrollbar drag | BLOCKED | No bookmark could be created. |
| Reload and jump to an unloaded earlier bookmark | BLOCKED | No bookmark could be created; the required landing was not exercised. |
| No extra drag mounts / storage reads / bookmark work versus empty | BLOCKED | Only the empty-bookmark baseline could be measured; no comparative claim. |
| Delete created bookmarks / clean up | PASS (empty) | 0 created, 0 remaining before and after fallback cleanup. Card deletion was not exercised. |
| Restore lab / release locks | PASS | Default extensions, one home tab, empty composer, shortcuts restored; lab and perf locks verified free. |

Three empty-bookmark baseline drags (native thumb held throughout):

| Run | Seek updates | Sampled frames | Turn mounts | Added elements | Storage reads | Bookmark runtime requests | Frame p95 ms | Frame max ms |
|---|---|---|---|---|---|---|---|---|
| 1 | 31 | 84 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| 2 | 32 | 86 | 0 | 0 | 0 | 0 | 16.7 | 16.8 |
| 3 | 32 | 85 | 0 | 0 | 0 | 0 | 16.8 | 16.8 |

A thread-subtree MutationObserver counted added turn nodes and elements. Worker probes counted
IndexedDB object-store/index read methods and local-settings reads; a runtime listener counted
bookmark requests. CDP precise coverage saw the actual bookmark content script in every run:
`refresh`, `paragraphs`, `measure`, `selection`, `topBlock`, `locate`, `create`, `remove`, `show`
and `place` each executed **0 times** in each measured interval. Cheap event/guard functions
still executed (62, 64, 64 aggregate function calls); this is not a claim of zero bookmark JavaScript.
The interval starts after the initial press/seek and ends before pointer release; press and release
costs are not measured. These short baseline runs alone do not establish performance with bookmarks.

## Bug: bookmark creation requires markup absent from the live chat

Reproduce with the tested extension and the existing named long fixture, send guard on:

1. Open the existing chat and use the rail's earlier-history control to read older messages.
2. Scroll to an assistant answer paragraph, place the pointer over its text and wait over 120 ms
   (the harness waited 800 ms). Expected: Bookmark paragraph button. Actual: no button.
3. Select 30 characters inside another answer paragraph and press Alt+Shift+M as real X11 input.
   Expected: another bookmark and one rail segment for the question. Actual: Chrome receives the
   command, but storage and rail remain empty.
4. Inspect attribute presence only: all 11 mounted turns have **0**
   `[data-message-author-role="assistant"]`, **0** `[data-message-id]`, and **0** matches for
   `[data-message-author-role="assistant"][data-message-id]`. All 11 have answer-style markdown
   roots. The answer ancestor instead carries `data-chatgpt-selection-message-id` and
   `data-chatgpt-selection-conversation-id` (values deliberately omitted).

`extension/bookmarks/content.js:11` defines `MESSAGE` as the absent combined selector. The hover
handler requires `closest(MESSAGE)` (lines 594 and 610), selection filtering requires it (line 286),
and `create` returns without it (line 375 onward). This explains both observed input failures.
The fixture harness supplies the older role/message-ID wrappers, so it does not cover this live
markup. No fix or DOM workaround was applied, and bookmarks were not injected into storage.

## Artifacts and rerun

- [Reusable harness](../../../lab/harness/bookmarks-live.mjs): `EXT="$PWD/extension" node lab/harness/bookmarks-live.mjs`.
  It exits 1 for failed or blocked acceptance checks, retains a success-path jump/drag/reload matrix,
  and restores/releases the owned lab in `finally`, including after harness failures.
- [Numeric evidence](summary.json) and [commands with actual output excerpts](commands.md).
- No screenshots, captured prompts/answers, conversation/message/account identifiers, fixture URLs,
  private endpoints or raw CDP data are included. Temporary raw harness errors remain local.

This report does not qualify bookmarks for release. Rerun the full matrix after the live markup
compatibility problem is fixed; the jump checks and the comparison with bookmarks remain open.
