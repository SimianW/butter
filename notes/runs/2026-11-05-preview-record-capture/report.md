# Privacy-safe preview record capture

2026-11-05. Baseline `b5229ee`, branch `t3/fix-scrollbar-preview-stuck`, Butter
`0.1.0-alpha.13`. This adds diagnostics only. The user's macOS failure is still
unreproduced; no extension implementation or version changed.

## Result

The snippet in [capture-preview-record.js](../../diagnostics/capture-preview-record.js)
runs in the page's default DevTools **top** context. Recorder, cache, codec and preview
are MAIN-world scripts in the manifest. The ISOLATED-world storage bridge forwards
geometry loads to the extension worker. The snippet snapshots the warm record before
DOM rect reads, then requests persisted variants through that bridge, without calling
measurement, hydration or persistence flush APIs. The test harness deliberately flushes
the lab's records to set up the persisted-record test; the shipped snippet does not.

[README](../../diagnostics/README.md) documents explicit zero-based turn selection,
automatic capture after holding a native drag still, privacy, provenance, storage
maintenance side effects and limits of the exposed APIs. In particular, persisted
geometry has no text, and the private frozen preview model is inaccessible. Restored
warm records are identified by `fromStorage`; remount restoration's private WeakSet
cannot be inspected.

## Lab verification

Lab 1 was acquired with its documented lock. The unchanged extension was staged in a
new snap-readable directory and loaded in the logged-in lab profile. The `math12`
fixture was opened through the lab library, with `L.sendGuard(context, lab)` on every
connection. No messages or ChatGPT writes were sent. All saved artifacts below contain
only the snippet's structural/geometry allowlist. Private fixture URLs and account
identifiers are omitted.

[verify.mjs](verify.mjs) evaluates the actual snippet using CDP
`Runtime.evaluate(includeCommandLineAPI: true)`. It does **not** stub `copy`. It checks
the real `Runtime.inspectRequested` event with `copyToClipboard: true`, which is the
JSON that the DevTools frontend would put on the clipboard. A CDP-only session has no
DevTools frontend to perform the OS clipboard write; this checks the real helper's
request and payload, not a manually pasted GUI Console or a macOS clipboard.

Three final cases pass, with no page errors:

| Case                                        | Turn index | Warm items | DOM elements | Active preview | Rendered items | Persisted records |
| ------------------------------------------- | ---------: | ---------: | -----------: | -------------- | -------------: | ----------------: |
| explicit index, storage disabled            |          0 |          2 |           77 | false          |              0 |                 0 |
| explicit index, storage enabled             |          0 |          2 |           77 | false          |              0 |                 1 |
| armed native thumb drag, capture while held |          1 |          2 |           79 | true           |             10 |                 1 |

The fixture's mounted answers in this run were short paragraphs, not display math.
Thus the live run checks the presence of math-offset fields, not a nonempty formula
offset example or the reported tall empty box. Warm sources in these cases are
`measured`; saved entries are `persisted`. The `restored` branch follows the recorder's
`fromStorage` flag but was not observed in these three samples.

Each payload passes:

- Required item-field checks for kind, geometry, text length, math offsets,
  fallback/estimate flags, provenance and height/zero-length flags.
- A recursive string-field allowlist: only fixed diagnostic enums, tags, class names
  and data-attribute names may contain strings. No serialized record text or CSS.
- No UUIDs, 64-character hashes or HTTP URLs in output string values.
- No occurrence of any live page text node of at least 16 characters (seven checked
  per capture). Shorter source text is excluded by the field allowlist as well.
- A `data-diagnostic-canary` attribute name is captured, while its private value
  `PRIVATE_ATTRIBUTE_VALUE_8302ad9c` never appears.
- Saved geometry reports text length as `null`, not zero, with the unavailable flag.

Payloads: [explicit.json](explicit.json), [saved.json](saved.json),
[armed-drag.json](armed-drag.json). Numeric checks: [checks.json](checks.json).

Completed harness invocations restore their captured extension settings in `finally`.
The lab was restored to its default extension/home tab and empty composer, then its
lock released. The staged extension uses a separate ID from the default extension.

## Commands and actual output

Initial inspection used `pwd`, `git status --short --branch`, `git log -1 --oneline`,
`cat`, `sed`, `rg`, `ls` and `head` to read AGENTS.md, CODING_STANDARDS.md, the previous
investigation report and dom-and-record.json, its surviving capture/drag/storage
scripts, lab instructions/library, the manifest and recorder/codec/preview/storage
implementation. Those commands printed the requested source files. The branch was
clean and HEAD was `b5229ee Narrow the overlay-scrollbar gap to 12 px from the edge`.
The first broad `rg` probes also named nonexistent legacy `extension/seek-main.js`,
`extension/*store*` and `extension/butter-seek*.js` paths (exit 2); subsequent reads
used the real `extension/seek/` and `extension/storage/` paths.

The preview tool reported:

```text
preview_status: available false; profiles Default and Incognito
preview_open(profileId: "lab 1"):
Preview automation open failed: No browser profile is named "lab 1".
Use one of: Default (id default), Incognito (id incognito).
```

The documented lab CDP connection was used instead.

```text
$ ~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab auto --owner butter-8302ad9c-diagnostic --wait 1800 --needs-fixture math12
1

$ mkdir -p /home/simon/snap/chromium/common/butter-8302ad9c
$ cp -a extension/. /home/simon/snap/chromium/common/butter-8302ad9c/
(no output; exit 0)

$ LAB_ID=1 LAB_EXTENSIONS=/home/simon/snap/chromium/common/butter-8302ad9c ~/.local/share/chatgpt-lab/bin/lab restart-browser
chromium: stopped
chromium: started (pid 2556258)

$ node notes/runs/2026-11-05-preview-record-capture/verify.mjs
{"label":"explicit","turnIndex":0,"memorySource":"measured","items":2,"domElements":77,"previewActive":false,"renderedItems":0,"persistedStatus":"disabled","persistedRecords":0,"privacyCheckedTextNodes":7,"privacy":"pass"}
{"label":"saved","turnIndex":0,"memorySource":"measured","items":2,"domElements":77,"previewActive":false,"renderedItems":0,"persistedStatus":"found","persistedRecords":1,"privacyCheckedTextNodes":7,"privacy":"pass"}
{"label":"armed-drag","turnIndex":1,"memorySource":"measured","items":2,"domElements":79,"previewActive":true,"renderedItems":10,"persistedStatus":"found","persistedRecords":1,"privacyCheckedTextNodes":7,"privacy":"pass"}
PASS: actual DevTools copy(), explicit index, native armed drag, persisted records, privacy allowlist and page-text checks.
```

Earlier verification attempts, retained here as limitations/fixes rather than passing
evidence, stopped with these actual errors:

```text
browserContext.waitForEvent: Timeout 30000ms exceeded while waiting for event "serviceworker"
SyntaxError: Unexpected end of JSON input
AssertionError: data.dom.turn.some(...data-diagnostic-canary...)
page.waitForEvent: Timeout 30000ms exceeded while waiting for event "console"
page.waitForFunction: Timeout 60000ms exceeded.
AssertionError: actual copy() requested clipboard JSON ('undefined' versus 'string')
AbortError: The operation was aborted (TimeoutError)
```

The harness now opens the known staged extension popup without waiting for a sleeping
worker, observes the real copy request instead of an OS clipboard with no DevTools
frontend, marks the selected turn immediately before capture, accepts existing saved
records when a repeat flush writes nothing, waits for both CDP and Console events and
starts the native drag away from the bottom boundary. Promise timeout handling now
keeps settings cleanup reachable; one earlier abort terminated before that cleanup,
affecting only the disposable staged extension's settings. Lab restore returns to the
separate default extension. Read-only numeric/structure probes using
`node --input-type=module` confirmed warm records and existing persisted entries, short
paragraph DOM, and a thumb press at the bottom with no active seek. No private text
was printed by those probes.

The snippet itself now retains the DevTools `copy` helper lexically across awaits and
timers. This fixes the delayed-storage/armed-capture Console binding failure caught
during verification.

```text
$ npx prettier --write notes/diagnostics notes/runs/2026-11-05-preview-record-capture
All eight added files formatted successfully (exit 0).

$ npm run format:check
> format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"
Checking formatting...
All matched files use Prettier code style!

$ npx prettier --check notes/diagnostics notes/runs/2026-11-05-preview-record-capture
Checking formatting...
All matched files use Prettier code style!

$ node --check notes/diagnostics/capture-preview-record.js
$ node --check notes/runs/2026-11-05-preview-record-capture/verify.mjs
(no output; both exit 0)

$ ~/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner butter-8302ad9c-diagnostic
chromium: stopped
chromium: started (pid 2573378)
restored: lab 1, restarted true, composer "", ok true
(Private home URL omitted; default extension restored.)

$ ~/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner butter-8302ad9c-diagnostic
{ "lab": 1, "lab_released": true, "perf_released": false }
```

The repository format script does not cover `notes/`, so the added files were checked
explicitly with Prettier too. Git checks and commit results are in the task handoff.
