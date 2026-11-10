# Ask in branch handoff diagnosis

2026-11-08 UTC. Diagnosis only; no extension edits, fix, commit, or PR.

## Result

The reported error reproduces after navigating between saved conversations through ChatGPT's
sidebar without reloading the document. This takes failure path **(a)**: the worker rejects
`butter-branch-put` with `{error: 'invalid'}`, and the original content script closes the new tab
and displays “Couldn’t hand your question to the new tab. Try again.”

The worker's `sender.url` still identifies the conversation on which the document was loaded.
After ChatGPT's client-side navigation, `location.href`, the selected quote's identity, and
`sender.tab.url` identify the new conversation. `senderIdentity` in `extension/branch/logic.js`
prefers the nonempty `sender.url` over `sender.tab.url`. Consequently, `handoff.put` compares the
previous conversation against `job.original` for the current conversation and rejects it.

Reloading the same destination conversation makes the identities agree and the put/claim pass.
The failure also reproduces when the destination is a normal conversation, and between two
Project conversations. Project prefixes, slugs, Chinese text, and the handoff hash are not needed
to trigger this mismatch.

This establishes a live root cause for the same symptom, consistent with the user's navigation
through Projects. The user's original tab state was not captured, so it does not establish that
this was the only cause of that particular occurrence.

## Build and method

- Worktree HEAD: `933c2e15ae761f93f440a7ff43d327ace4aec8d8`, branch `t3/9d5b9df2`.
- Loaded an unchanged, snap-readable copy of this worktree's `extension/`:
  manifest `0.1.0-alpha.16`, Chrome version field `0.1.0.16`.
- `git diff v0.1.0-alpha.15 HEAD -- extension/branch/logic.js extension/branch/worker.js
  extension/branch/content.js` produced no output; [the saved diff](source-equivalence.diff) is
  zero bytes. The affected code is identical to the alpha.15 release tag. The exact reported
  `0.1.0-alpha.15+dev.1` package was not loaded.
- Live lab1 was locked under owner `branch-handoff-9d5b9df2`. The lab send guard remained on,
  blocking all non-GET/HEAD/OPTIONS ChatGPT requests, including branch creation and message sends.
  Passing here means successful **handoff**, not an end-to-end server-created branch or sent reply.
- ChatGPT UI was English (`en-US`). A real mouse drag selected assistant text, Butter's actual
  question box was opened, and the supplied Chinese test question was entered. The selected
  fixture passage differed from the user's exact quoted passage; no captured passage was saved.
- The lab's `math12` fixture now redirects to a Project conversation. A separate saved normal
  conversation was located in the sidebar. One Work-mode candidate was excluded because Butter
  intentionally hides Ask in branch there.
- CDP attached to Butter's isolated world and service worker. A non-pausing debugger condition
  accessed the existing worker closure and wrapped its real `handoff.put`/`claim` methods to
  capture their results. The page probe recorded the actual `sendMessage` outcome, notifications,
  and `window.open` URL. No extension file was instrumented on disk.

## Evidence

Aliases below stand for conversation identities; they are consistent within each JSON file.

| Case | Put and claim | Original question box |
|---|---|---|
| Project conversation, fresh document | Put OK; child claims job | No handoff reason |
| Normal conversation, fresh document | Put OK; child claims job | No handoff reason |
| Normal → Project via sidebar, repeated twice | Put `invalid`; no child claim recorded | Exact reported error |
| Same Project destination after page reload, repeated twice | Put OK; child claims job | No handoff reason |
| Project → normal via sidebar | Put `invalid`; no child claim recorded | Exact reported error |
| Project → another Project conversation via sidebar | Put `invalid`; no child claim recorded | Exact reported error |

From [spa.json](spa.json), failing put:

```text
sender.url       /c/<chat-2>
sender.tab.url   /g/g-p-<project>/c/<chat-1>
job.original    chat-1
sender identity chat-2
put result      {error: "invalid"}
window.open     /g/g-p-<project>/c/<chat-1>#butter-branch=<job>
remaining child tabs: none
original URL and composer unchanged: true
```

The immediately following reload control changes `sender.url` to the same Project route as
`sender.tab.url`; put returns `{ok:true}` and the original receives `butter-branch-claimed`.
The original URL and composer remain unchanged in every recorded attempt.

The failed puts occur before storage succeeds, so these attempts do not enter the claim rejection
path **(b)** or the TTL-plus-five-seconds path **(c)**. No claim was recorded for the failed jobs.
The new tab was opened with the correct current conversation and a valid handoff hash, then
closed by the put failure. Network navigation request URLs omit fragments, as normal.

On successful claims in this Chromium build, `sender.url` was absent in the captured sender;
the existing fallback to `sender.tab.url` identified the correct conversation and claim succeeded.
The init-script marker in the child read `about:blank` (saved as `blank`), so it is **not** evidence
of the final document's document-start URL. The actual open URL and worker claim are the useful
handoff boundary observations.

The handoff-failure path calls `showReason`, without reaching `runBranch` or its branch-status
reporting. Missing Branch information in the user's bug file is therefore compatible with this
failure, but does not distinguish it from the other handoff failures.

## Additional controls

Results are recorded in the accompanying per-mode JSON and stdout files. See
[commands.md](commands.md) for invocations, actual outputs, and setup failures.

- **Sleeping worker:** With CDP disconnected for 36 seconds, the worker target disappeared
  (`workerTargets: 0`) before reconnect/submission. Put succeeded and the original received
  `butter-branch-claimed`. A prior idle check with CDP attached kept the worker alive
  (`workerTargets: 1`); that preliminary result is retained separately as `idle-attached.*`.
- **Slow first load:** delaying the child tab's conversation navigation by 15 seconds still
  passed. The worker recorded put and successful claim about 15.3 seconds apart. This was within
  the real 60-second TTL; no timer or TTL was patched. No handoff reason appeared.
- **Extension reloaded under an open tab:** `chrome.runtime.reload()` followed by submitting in
  the already-open page reproduced the exact same handoff reason. The page probe captured
  `butter-branch-put` throwing `Extension context invalidated.` synchronously; no worker result
  was involved and the child was closed. This is a separate cause, not the cause observed in
  the repeated sidebar cases, which received real worker `invalid` replies. The attempted
  subsequent page-reload control could not run: no Butter isolated world was found after the
  reload. The probe exited 1 at that setup assertion. This variation therefore establishes the
  orphaned-context failure, but does not establish page-reload recovery for that variation.
  The subsequent no-extension control uses a full browser restart.
- **No Butter (`EXT=`):** both the Project and normal conversations loaded normally, with
  respectively 5 and 3 assistant reply elements and one visible composer each. Both had zero
  Butter branch hosts and zero worker targets. This confirms normal page loading, not a native
  Ask in branch equivalent (the feature belongs to Butter). See [control.json](control.json).

## Reproduction command

With the same lab lock held, Butter loaded, and the excluded local discovery state available:

```sh
node notes/runs/2026-11-08-branch-handoff/probe.mjs spa
```

This drives real sidebar navigation, records the failure and the page-reload control, then exits
1 on the actual symptom:

```text
AssertionError [ERR_ASSERTION]: Ask in branch should hand over after sidebar navigation
+ 'Couldn’t hand your question to the new tab. Try again.'
- null
```

`probe.mjs baseline` discovers eligible fixture links first and writes the excluded local state
file. This is a live diagnostic harness, not a committed regression test. No fix was attempted.

## Artifacts and privacy

- [probe.mjs](probe.mjs): diagnostic harness, loading lab settings from the local lab library.
- [baseline.json](baseline.json), [spa.json](spa.json), [navigation.json](navigation.json):
  sanitized live outcomes and identity comparisons.
- [idle.json](idle.json), [slow.json](slow.json), [reload.json](reload.json),
  [control.json](control.json): additional controls and their stated limitations.
- `*-output.txt`: sanitized stdout/stderr, including the deliberate red assertion.
- Conversation IDs and full Project path segments/slugs are replaced with aliases/placeholders.
  Conversation titles, selected passages, page captures, account data, cookies, auth headers, and
  private machine endpoints are excluded. Numeric Chrome tab IDs are ephemeral browser handles.
- Local discovery state with fixture URLs is excluded from the report directory. Raw URLs used
  by instrumentation remain in process memory only. Screenshots, HAR files, and full worker
  payloads were not saved. Early exploratory console output is not included as an artifact.
- Early probes were adjusted after finding a sleeping worker, an unsupported Work-mode chat,
  and sidebar links that load later than the composer. Some early baseline/navigation logs have
  duplicate observer records from stacked probe wrappers; a single content-script put and
  identical timestamps distinguish these from extra submissions. The probe now installs each
  wrapper only once per worker/content-script context.

Lab restoration and the final privacy/worktree checks are recorded with the control results.

## Cleanup

The lab was restored successfully to its default extensions and home conversation, with one tab
and an empty composer. Its lock was released. The temporary staged extension and excluded local
URL discovery file were removed after the privacy check. The only worktree additions are this
report directory; tracked files and `extension/` are unchanged.

The privacy check found zero matches for the 15 private URL tokens collected for checking,
zero literal conversation UUIDs, and zero private machine endpoints. See [privacy.json](privacy.json)
and [data/archive.json](data/archive.json) for the final artifact inventory.
