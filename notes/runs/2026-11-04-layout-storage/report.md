> Archived historical report; statements about worktree/lab state describe the original run, not the current checkout. Private captures, builds and execution logs are not archived. 

# Butter extension layout storage — implementation result

Completed on t3/seek-preview in the assigned worktree. No version bump, push, release or popup UI change.

## Commits

```text
e7f5fc13ce6082ea583e102adc9bd9bfd912ff1e Refresh fingerprints before destination dispatch after a long scrollbar hold
e2360b7e9f56ac90a67739549b5b8d48e4d8bb8b Document layout storage, its runtime API and the persisted data inventory
f0b7da46d7f9ad957f4ca3eca9a1a86500b2f46b Make layout storage messages versioned and safe across worker restarts
114431fb8ff914da4cf9ca5fca1dd4ba8ff34dcf Move saved seek layouts into account-partitioned extension storage
```

## Backend and permissions

Use extension-origin IndexedDB in a service worker. The shape is about 350 KB for a long chat's
single layout after encoding, with roughly 140 such layouts / over 1,600 per-turn rows at the cap.
Indexed account/conversation reads, transactional row updates, per-record TTL/LRU deletion and
atomic eviction fit this shape. chrome.storage.local could also serve the popup with no chat tab;
that capability was not used as a reason for choosing IndexedDB. A content script's own IndexedDB
is the site's origin. All extension layout operations use version-1 runtime messages to the worker.
The content script only deletes the legacy site DB.

Official sources:
- [chrome.storage quotas](https://developer.chrome.com/docs/extensions/reference/api/storage): local is 10 MB without unlimitedStorage.
- [Storage/worker access and quota exemptions](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies): extension IndexedDB is available in workers; unlimitedStorage exempts it from quota restrictions and eviction.
- [Permission/warning list](https://developer.chrome.com/docs/extensions/reference/permissions-list#unlimitedStorage): unlimitedStorage has no warning.
- [Update warnings](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings): adding a warning-bearing permission disables an extension until acceptance; unlimitedStorage alone does not trigger that condition.

Web Store justification: “Butter uses unlimitedStorage to cache up to 50 MB of local,
account-partitioned layout geometry for smooth seeking in long ChatGPT conversations; it stores
no chat text and enforces its own 30-day expiry and 50 MB limit.”

The cap uses exact UTF-8 serialized geometry-row sizes, including each row's metadata and bytes
field, summed from the database on operations and after worker restart. It uses no estimate().
Physical IndexedDB/index overhead and bounded non-content control metadata are outside the
logical payload count. TTL is 30 days from measurement, with pruning on cache operations.

## Restart handling and API

Requests carry version: 1. Load/usage are idempotent; puts use stable identity keys and fixed
measurement timestamps, and old retries cannot replace newer records. Clear takes a random UUID
requestId and durably deduplicates the latest 64 clear operations. A database generation fences
pre-clear writes across restarts. Transactions are all-or-nothing. The bridge retries a closed
port/storage error up to three times; exhausted writes stay pending for later retry. Worker globals
hold only replaceable connection/queue/settings state, with no authoritative byte total or account
identity. Unit tests cover termination before/after commit and state loss.

A real Chrome worker was terminated with Target.closeTarget; a popup runtime usage request woke
it with no ChatGPT tab open and returned the same data:

```json
{
  "stopped": true,
  "before": {
    "conversations": 1,
    "bytes": 101997
  },
  "after": {
    "conversations": 1,
    "bytes": 101997
  },
  "chatTabsOpen": 0
}
```

Public API:

```js
await chrome.runtime.sendMessage({version: 1, type: 'butter-layout-usage'});
const request = {version: 1, type: 'butter-layout-clear', requestId: crypto.randomUUID()};
await chrome.runtime.sendMessage(request); // reuse request when retrying
```

The MAIN cache prefetches current-conversation records once the passive account hash is known;
prepare is synchronous and tested to make no storage calls. One layout-cache module and one
acceptStored path cover hydration, adoption and restore. S1/S2/S5, write epochs and warm preparation
without fetched source remain covered. A long hold could retire an unchanged fingerprint and skip
stored restoration; release now refreshes it before destination dispatch, outside the native hook.
The final stored runs assert both restored heights and a release time below 2.5 seconds.

## Encoding

Same 1440-light classic, twelve-turn layout fixture: expanded JSON rows with repeated typography
are 2,557,851 bytes; positional arrays plus per-row typography dictionaries are
354,936 bytes (86.12% smaller). Both include the same identity/recency/byte metadata,
with each format's exact serialized size. The compact wire geometry bodies alone are 349,430 bytes.
No geometry quantization is used. The seed also contains five rows for another fingerprint, so total seeded usage
is larger than the single-layout payload. These compare expanded and compact encodings of the
same measured geometry, not an assumed historical 2.35 MB estimate.

## Verification

node --test: 138 passed, 0 failed. The targeted long-hold regression was observed red before the
fix and green afterwards (the real release dispatcher plus native width hook). npm run format:check: OK.
python3 scripts/check-version.py: OK, 0.1.0-alpha.10 / 0.1.0.10 unchanged.

## Lab — 1440 light, three runs per cell

Classic used fast native drags; overlay used slow native drags. Times are release-to-readable.

| Mode | Destination | Times (ms) | Median (ms) | Held mounts | Empty / held frames | Timeout |
|---|---|---|---:|---:|---:|---|
| classic | stored | 2089.3, 1303.6, 1506.2 | 1506.2 | 0 | 0 / 364 | False |
| classic | warm | 1083.6, 1100.0, 1114.1 | 1100.0 | 0 | 0 / 362 | False |
| classic | cold | 4710.0, 6716.3, 4106.6 | 4710.0 | 0 | 0 / 360 | False |
| overlay | stored | 1404.8, 1660.0, 1725.3 | 1660.0 | 0 | 0 / 2487 | False |
| overlay | warm | 1258.0, 1259.0, 1225.6 | 1258.0 | 0 | 0 / 2499 | False |
| overlay | cold | 4560.4, 4364.8, 4191.2 | 4364.8 | 0 | 0 / 2486 | False |

All 18 releases had zero held mounts and zero empty frames. Stored means adopted after a fresh
reload, with the selected target never mounted in that document. Cold means never opened.

Streaming: 189/189 chunks, 21448 characters,
420 math nodes; zero completed network conversation writes.
SHA-256: `043dc8afaf8d1e05e984597494a403589e3f38448954c6343e33689c4ff82e68` — exact checkpoint match.
Every attempted send was a fail-closed local replay; no real ChatGPT message was sent.

Usage after seed: classic 1 conversation / 460,361 bytes; overlay 1 / 460,360 bytes.
Clear returned zero conversations and bytes. The old site database was explicitly seeded and
then confirmed deleted, with the one-time success marker set. Final cleanup results:

```json
{
  "beforeClear": {
    "conversations": 1,
    "bytes": 700461
  },
  "clearResult": {
    "conversations": 0,
    "bytes": 0
  },
  "afterClear": {
    "conversations": 0,
    "bytes": 0
  },
  "usage": {
    "conversations": 0,
    "bytes": 0
  },
  "local": {},
  "databases": []
}
```

Server audit (passively observed real GET responses; no token fields read and no extra authenticated
snapshot request):

```json
{
  "beforeUserMessages": 13,
  "afterUserMessages": 13,
  "addedUserIds": [],
  "removedUserIds": [],
  "pages": 10,
  "passive": true,
  "credentialFieldsRead": false,
  "apiWrites": 0
}
```

Restored lab:

```json
{
  "lockAbsent": true,
  "extensionFile": "~/snap/chromium/common/butter-blank-head",
  "browsers": [
    {
      "loaded": true,
      "normalFlags": true
    }
  ],
  "originalTab": true
}
```

The requested original conversation is open, its composer is empty, normal flags and butter-blank-head
are restored, all experimental extension storage/site Butter databases are deleted, and lock.d is absent.

## Documentation and privacy

PRIVACY.md changes only its storage paragraph and date. Both READMEs add short consistent English /
Chinese storage/clear notes. how-it-works describes the single cache, passive account observation,
extension bridge, TTL/cap and invalidation. development documents the versioned runtime protocol,
usage/clear and the layout setting. layout-storage-design contains backend/permission reasoning;
layout-storage-data gives the exact factual policy inventory (also reproduced below).
Nothing leaves the device. Content digests and hashed message/conversation/account identities ARE
derived from content or identity; they are explicitly listed, not described as anonymous data.

## Deviations and recovered tooling issues

- No requested behavior was omitted; no popup UI, version bump, push or release was made.
- The cap is the specified serialized-record sum, not physical database file size. Clear keeps
  bounded, non-content fencing/deduplication metadata and settings; usage counts geometry only.
- Clear deduplication retains the latest 64 operation ids; clients retry immediately using the same UUID.
- The server audit was adapted to passive app GETs so the old token-reading snapshot helper was not run.
  It verifies all 13 user ids unchanged; it does not claim a fresh comparison of every archived node.
- An early lab helper sent runtime messages from the worker to itself and got “Receiving end does not
  exist.” It was corrected to send from an extension popup context. Preliminary matrix runs were
  stopped and restored while the consumer/protocol requirements were finalized; the table uses only
  the complete release-fix runs. These are three-run fixture checks, not a statistical equivalence claim. A subsequent long-hold timing failure was reproduced at the actual
  release/native-hook seam and fixed before these final runs. A hash test's timing wait was made deterministic. Tooling errors and
  successful commands are recorded in commands-and-output.md. Raw captures remain private under /tmp.

## Exact persisted-field inventory for the lead

# Persisted data inventory for the privacy-policy rewrite

This is a factual implementation inventory, not a replacement privacy policy. No chat text,
raw account id, auth token or cookie is persisted. All processing and storage remain on the device;
Butter has no network sender. The observer clones responses the page already requested and selects
only the appropriate user-id field; it never accesses credential fields or cookies.

## Extension-origin IndexedDB: `butter-layouts-v1`

The service worker alone opens this database. Content scripts reach it through
`chrome.runtime.sendMessage`; their own IndexedDB API refers to chatgpt.com's origin.
Each row in object store `geometry` has exactly the following fields:

| Field | Shape/example (synthetic) | Derivation |
|---|---|---|
| `schema` | `2` | Wire-format version; no content. |
| `account` | 64 lowercase hexadecimal characters | SHA-256 of the ChatGPT user id: account identity. The raw id is not forwarded. |
| `conv` | 64 lowercase hexadecimal characters | SHA-256 of conversation id: chat identity. |
| `turn` | 64 lowercase hexadecimal characters | SHA-256 of question/turn message id: chat identity. |
| `msg` | 64 lowercase hexadecimal characters | SHA-256 of assistant message id: chat identity. |
| `digest` | 64 lowercase hexadecimal characters | SHA-256 of JSON `[questionText, answerText, assistantIds, assistantMessageId]`: explicitly derived from chat content and identities. The input text is not stored. |
| `layout` | 64 lowercase hexadecimal characters | SHA-256 of the layout fingerprint: schema, scroller/viewport widths, DPR, computed font, rendered column width, theme markers and loaded app-asset URLs. No raw fingerprint or asset URL is saved. |
| `time` | `1793740000000` | Local measurement-queue time in milliseconds since Unix epoch; TTL basis. |
| `metrics` | `[500,520,8,480,768,1440,1258]` | In order: turn content height, row height, turn offset, turn height, row width, viewport width, scroller width. Numbers derived from rendered chat layout. |
| `blocks` | `[26,52,80]` | Measured block heights, derived from rendered chat layout. |
| `styles` | `["font:normal 400 16px/26px system-ui;padding:0px 0px 0px 0px;border-radius:0px;background:rgba(0, 0, 0, 0);color:rgb(0, 0, 0);text-align:start"]` | Dictionary of computed typography, padding, radius, background, color and alignment. Chat formatting can influence these styles; they contain no literal question/answer text. Only these CSS properties are accepted; URLs, CSS variables and content declarations are rejected. |
| `items` | `[[20,26,200,768,0,0,3,[[2,5,0,0]]]]` | Each item: top, height, left, width, user flag, style dictionary index, source-block index, math spans. Each math span: start/end character offsets, display flag, measured height. These numbers/flags/indexes derive from chat formatting and content structure; TeX/text is never stored. Source index `-2` means question, `-1` unmatched source. |
| `key` | JSON string of `[account,conv,turn,msg,digest,layout]` | Compound identity key, containing only the six hashes above. |
| `used` | `1793740001000` | Last successful load/write time, used for LRU eviction; does not extend TTL. |
| `bytes` | `29481` | Exact UTF-8 length of the JSON-serialized stored row, including this field and metadata. |

An index named `conversation` indexes `[account,conv]`; its values are the same hashes already
listed. No text is stored in the index.

The `state` object store contains two non-content control values:

| Key | Shape | Purpose/retention |
|---|---|---|
| `generation` | Integer, initially absent/zero | Incremented on a new clear; rejects delayed pre-clear puts. Retained through clear, layout-off and worker restarts, until uninstall/removing extension storage. |
| `clears` | `[{"id":"a random UUID","time":1793740001000}]` | Most recent 64 public clear request ids and local timestamps, for durable retry deduplication. Contains no account or chat identity. Kept until displaced by newer clear requests or extension storage removal. |

Geometry expires 30 days after `time`, even if recently used. Expired rows are physically pruned
on geometry operations (usage/load/write); an idle extension does not run an alarm solely to delete
them. MAIN also rejects expired prefetched/adopted rows. The global cap is 50,000,000 serialized
geometry-row bytes across all accounts, with least recently used rows evicted first. IndexedDB
file/index overhead and the bounded control values above are outside that logical payload cap.

## `chrome.storage.local`

| Key | Shape | Derivation/retention |
|---|---|---|
| `butter` | `{enabled:true,opts:{container:true,cv:true,throttle:true,older:true,rail:true,layout:true},lang:"en"}` | Existing user settings plus default-true `opts.layout`; not derived from chat text. Defaults need not be written. Retained until changed or extension data removal. |
| `butterLayoutMigrated` | `true` | Successful deletion marker for the legacy site database. No chat-derived data; retained until extension data removal. |
| `butterLayoutCleared` | Random UUID string | Change notification for open tabs, replaced on clear. No chat/account-derived data; retained until the next clear or extension data removal. |

## Clearing and other storage

- Public clear deletes all `geometry` rows for all accounts and retires disk-backed MAIN memory.
  It preserves user settings, migration/notification markers and bounded `state` control values.
  While saving remains enabled, newly measured layouts can save again.
- Setting `butter.opts.layout` false deletes all accounts' geometry and prevents persisted layout
  reads/writes. Clear/fencing metadata may still be maintained; the warm cache remains in memory.
- Account switches retire the prior account's warm entries, source contexts, pending writes and
  prefetched geometry. They do not delete that account's on-disk rows, which remain partitioned.
- The old site-origin `butter-seek-cold-geometry-v1` database is deleted once without reading/importing
  it; blocked or failed deletion is retried on a subsequent visit. There is no new site-origin DB.
- Uninstalling Butter removes extension-owned data. Clearing chatgpt.com's site data does not remove
  extension-owned layouts. The lab removes all extension keys and its experimental database at end.
- Preview/source text lives only in page memory and is not included in runtime geometry messages.
  Raw lab captures remain under `/tmp`; they are not part of the extension or committed docs.
