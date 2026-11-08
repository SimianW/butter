# Persisted data inventory

This is a factual implementation inventory, not a replacement privacy policy. No raw account id,
auth token or cookie is persisted. The only chat text persisted is a bookmark's excerpt (below):
at most the first three rendered lines, capped at 240 characters, of what the user bookmarked. All processing and storage remain on the device;
Butter has no network sender. The observer clones responses the page already requested and selects
only the appropriate user-id field; it never accesses credential fields or cookies.

## Extension-origin IndexedDB: `butter-layouts-v1`

The service worker alone opens this database. Content scripts reach it through
`chrome.runtime.sendMessage`; their own IndexedDB API refers to chatgpt.com's origin.
Each row in object store `geometry` has exactly the following fields:

| Field | Shape/example (synthetic) | Derivation |
|---|---|---|
| `schema` | `4` | Wire-format version; no content. |
| `account` | 64 lowercase hexadecimal characters | SHA-256 of the ChatGPT user id: account identity. The raw id is not forwarded. |
| `conv` | 64 lowercase hexadecimal characters | SHA-256 of conversation id: chat identity. |
| `turn` | 64 lowercase hexadecimal characters | SHA-256 of question/turn message id: chat identity. |
| `msg` | 64 lowercase hexadecimal characters | SHA-256 of assistant message id: chat identity. |
| `digest` | 64 lowercase hexadecimal characters | SHA-256 of JSON `[questionText, answerText, assistantIds, assistantMessageId]`: explicitly derived from chat content and identities. The input text is not stored. |
| `layout` | 64 lowercase hexadecimal characters | SHA-256 of the layout fingerprint: schema, scroller/viewport widths, DPR, computed font, rendered column width, theme markers and loaded app-asset URLs. No raw fingerprint or asset URL is saved. |
| `time` | `1793740000000` | Local measurement-queue time in milliseconds since Unix epoch; TTL basis. |
| `metrics` | `[500,520,8,480,768,1440,1258]` | In order: turn content height, row height, turn offset, turn height, row width, viewport width, scroller width. Numbers derived from rendered chat layout. |
| `blocks` | `[26,52,80]` | Measured block heights, derived from rendered chat layout. |
| `styles` | `["font:normal 400 16px/26px system-ui;padding:0px 0px 0px 0px;border-radius:0px;background:rgba(0, 0, 0, 0);color:rgb(0, 0, 0);text-align:start"]` | Dictionary of computed typography, padding, radius, background, color and alignment. Chat formatting can influence these styles; they contain no literal question/answer text. Only these CSS properties are accepted, with per-property patterns, numeric bounds and length caps. Font families use a closed allowlist; unknown typography is not persisted. URLs, CSS variables, arbitrary text and content declarations are rejected. |
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
| `butter` | `{enabled:true,opts:{container:true,cv:true,throttle:true,older:true,seek:true,rail:true,layout:false},lang:"en",layoutConsent:"pending"}` | Normalized settings include default-true `opts.seek`; `opts.layout` stays false until `layoutConsent: "granted"` and the saved layout option is not false. Not derived from chat text. Defaults need not be written. Retained until changed or extension data removal. |
| `butterLayoutMigrated` | `true` | Successful deletion marker for the legacy site database. No chat-derived data; retained until extension data removal. |
| `butterLayoutCleared` | Random UUID string | Change notification for open tabs, replaced on clear. No chat/account-derived data; retained until the next clear or extension data removal. |

## `chrome.storage.session`

`butterFailures` holds observed failures by feature group and failed feature. It contains no chat
or account data. Successful engagement of the failed feature removes its record; disabling a
setting or switching chats preserves it. Browser shutdown clears it.

## Consent

`butter.layoutConsent` is `pending`, `granted` or `declined`. The in-page card records the answer;
the popup layout switch can update it. Pending or declined consent prevents persisted geometry
reads/writes regardless of a saved layout option. Consent is a local setting, not derived
from chat text. Pending usage returns zero.

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

## Object store `bookmarks` (database version 2)

Written only when the user bookmarks a paragraph, and deleted only by the user or by uninstalling.
Independent of the layout setting, `layoutConsent`, TTL, the byte cap, eviction and layout Clear.
`storage/layout-worker.js` imports `bookmarks/worker.js`, which owns this store; each row is
rebuilt through the allowlist in `bookmarks/model.js` (`ButterBookmarks.clean`) before it is written
or returned.

| Field | Shape/example (synthetic) | Derivation |
|---|---|---|
| `account` | 64 lowercase hexadecimal characters | SHA-256 of the ChatGPT user id, as for layouts. Unknown accounts are rejected. |
| `conv` | 64 lowercase hexadecimal characters | SHA-256 of the conversation id. |
| `msg` | 64 lowercase hexadecimal characters | SHA-256 of the assistant message id the bookmark is in. |
| `turn` | `6` | Index of the bookmark's question in the chat when it was made (0 = first question). |
| `para` | `3` | Index of the paragraph among the answer's top-level rendered blocks. |
| `start`, `end` | `0`, `412` | Character range within the paragraph's rendered text; the whole paragraph is `0` to its length. |
| `excerpt` | `"Fixture answer 7 paragraph 3: the planner compares…"` | **Chat text the user chose**: the marked text cut to its first three rendered lines and at most 240 characters, whitespace collapsed. |
| `time` | `1793740000000` | Creation time in milliseconds since Unix epoch. |
| `key` | JSON string of `[account,conv,msg,para,start,end]` | Identity: the same paragraph and range is one bookmark. |

An index named `conversation` indexes `[account,conv]`, as for `geometry`.

