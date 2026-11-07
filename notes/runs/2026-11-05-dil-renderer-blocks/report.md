# Dil renderer block recording

Baseline: `fec083e` on `t3/fix-scrollbar-preview-stuck`. Evidence: the user's sanitized
[capture](user-capture.json), copied byte-for-byte from the supplied attachment. No chat text,
attribute values, credentials or account identifiers were added. The existing server on port
8781 was left alone. No extension version bump, push, PR, ChatGPT send or further delegation.

## Verified cause

The capture has one measured block, height 2195.484375 px. Answer item 1 has 1279 text
characters and a display span at offsets 916–957 whose saved height is 2169.484375 px.
Both persisted variants have the same wrapper-level block shape and inflated span height.

DOM nodes 41–46 show the markdown root, the Dil source wrapper, an inset wrapper, the portal
renderer and finally `DilResponseRoot`. Node 43 also has an empty sibling (44) beside the portal
(45), so blindly following single-child chains would stop too early. Node 46 owns 22 real blocks.
The actual formula wrapper (353) is 70.484375 px; its `.katex-display` child (354) is 38.484375 px.

Three interacting causes were verified:

1. At baseline, `extension/seek/layout-cache-main.js:30` and `:31` selected only direct
   markdown children. That recorded the Dil source wrapper as the whole answer.
2. At baseline, `layout-cache-main.js:591` assigned `blockHeight` to every display span.
   `:850` supplied the containing block's height and cached it with the lean text. The differing
   current item and span heights are consistent with a later resize retaining that cached height.
3. At baseline, `extension/seek/core-main.js:182` classified only formula-only text as display
   math; `:189` returned Infinity for mixed prose. The bad span therefore bypassed validation.
   `extension/seek/preview-main.js:347` then drew nested display spans at their unbounded height.
   The formula-only clamp at `:445` never applied to this mixed answer item. The capture's outer
   preview item has class `it`; the huge grey box is its nested `.math.display` span.

## Fix and scope audit

- `extension/seek/core-main.js:12` supplies shared selectors for direct markdown roots and
  nested `DilResponseRoot` containers, recognizing the stable class prefix instead of a hash.
  `extension/seek/layout-cache-main.js:31` uses them throughout observing, recording, adopting,
  lean-cache invalidation, restore and unrestore. Items retain hr/wide blocks while intrinsic
  block sizes keep their existing exclusions.
- `extension/seek/layout-cache-main.js:592` caches math elements with text offsets.
  `:857` avoids descendant layout reads in skipped blocks, reusing measured geometry only when
  text and the containing box agree. Unmeasured skipped math makes the snapshot non-authoritative;
  visible formulas elsewhere are still collected so later scrolls can complete coverage.
  `:869` measures each display element's own box on recording, including after text-free resize.
- `extension/seek/core-main.js:181` validates display spans inside mixed prose as well as
  formula-only item heights. `:203` applies the existing TeX-row allowance to that span's source.
  `extension/seek/preview-main.js:347` also clamps nested display spans defensively.
- `extension/seek/anchor-main.js` and `preview-main.js` use the same preview item selector, so
  same-index landing/swap checks refer to the real blocks. Font/width selection and generating
  state checks still appropriately use the outer markdown column.
- `extension/stream/offscreen.js:19`, `containment.css:15` and `shared/settings.js:75` use
  the same container distinction for seen marks, streaming/held containment and status probes.
  The Dil wrappers no longer get block-level containment; wide-block exclusions remain.
- `extension/seek/layout-check-main.js` and `layout-codec.js` consume ordered recorded items;
  neither discovers DOM blocks independently. Source indexing/hydration fields are unchanged.
  `layout-codec.js:104` writes wire schema 3, and `:129` refuses older schemas. The worker's
  existing validation prunes old rows during disk operations and rejects old-tab writes. This
  deliberately retires all schema-2 geometry, including otherwise good records, for remeasurement.
  Protocol 1, IndexedDB version and the internal hydrated schema are unchanged. The storage design
  and data inventory document the new wire schema.

## Commands and actual results

Dependencies:

```text
$ npm ci --prefix lab/harness
added 2 packages, and audited 3 packages in 351ms
found 0 vulnerabilities
$ npm ci
added 1 package, and audited 2 packages in 326ms
found 0 vulnerabilities
```

Before the production fix (exit 1 for each regression command):

```text
$ node lab/harness/dil-renderer.mjs
AssertionError [ERR_ASSERTION]: Dil: one size per real block except hr/wide
1 !== 20

$ node --test --test-name-pattern='inflated display span|old wrapper-level' test/seek-fallback.test.js test/layout-storage.test.js
tests 2
pass 0
fail 2
```

The failures were wrong block count, codec accepting schema 2, and mixed-prose validation returning
null instead of `math-height`. See [browser failure](red-fixture.txt) and [unit failures](red-unit.txt).
The production files were still at HEAD when these commands ran. No forced production mutation
was used to manufacture the failures.

After the fix (exit 0):

```text
$ node --test
tests 218
pass 218
fail 0
cancelled 0
skipped 0
todo 0

$ npm run format:check
> prettier --check "extension/**/*.{js,css,html,json}" "test/**"
Checking formatting...
All matched files use Prettier code style!

$ node lab/harness/dil-renderer.mjs
Dil: 20 block sizes, 23 items, math heights 38, 38, 38
anchors: 23 matching block indexes, zero geometry error
resize: display height refreshed to 62
preview: legacy mixed-prose display height clamped to 184px
containment: real blocks marked and skipped, wrapper left visible
streaming containment: real blocks skipped before marking, wide block left visible
direct: 20 block sizes, 23 items, math heights 38, 38, 38
anchors: 23 matching block indexes, zero geometry error
resize: display height refreshed to 62
preview: legacy mixed-prose display height clamped to 184px
containment: real blocks marked and skipped, wrapper left visible
streaming containment: real blocks skipped before marking, wide block left visible

$ python3 scripts/check-version.py
OK: 0.1.0-alpha.13 / 0.1.0.13; manifest, READMEs, and changelog agree.

$ git diff --check
(no output)

$ cmp <supplied-attachment> notes/runs/2026-11-05-dil-renderer-blocks/user-capture.json
(no output; identical)
```

Full outputs: [unit suite](node-test.txt), [formatter](format.txt), [renderer fixture](fixture.txt).
The fixture uses a separate headless browser and intercepted synthetic navigation, with no
network requests reaching ChatGPT. It contains the captured class/nesting shape plus synthetic
paragraphs, formula-only and mixed-prose formulas, hr and a wide block. Existing direct-root
and HTML-only KaTeX fixtures still pass. The additional recorder unit test verifies that skipped
math descendants are never measured and unchanged measured math can be reused safely.

Lab smoke, using the documented lock (no performance timing):

```text
$ ~/.local/share/chatgpt-lab/bin/lab-lock acquire --lab 1 --owner butter-dil-renderer --wait 1800
1
$ node lab/harness/check.mjs /tmp/butter-dil-lab-smoke.png
title: <REDACTED>
probe: undefined
webdriver: false
Layer 1 Sandbox Namespace | PID namespaces Yes | Network namespaces Yes | Seccomp-BPF sandbox Yes
exit: 0
$ ~/.local/share/chatgpt-lab/bin/lab-restore --lab 1 --owner butter-dil-renderer
restored: lab 1, restarted false, composer "", ok true
(private URL and browser details omitted)
$ ~/.local/share/chatgpt-lab/bin/lab-lock release --lab 1 --owner butter-dil-renderer
{"lab": 1, "lab_released": true, "perf_released": false}
```

The [smoke output](lab-smoke.txt) confirms browser/sandbox health only; the account does not expose
the Dil rollout. Its private screenshot stays outside the committed evidence. The synthetic
regressions establish the fix; real Mac visual confirmation remains for the user's test build.

Packaging is performed after committing, without changing source versions:

```sh
python3 scripts/package.py --test unseen-notice
```

Expected next artifact: `dist/butter-0.1.0-alpha.13+unseen-notice.5.zip`.
