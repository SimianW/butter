# Extension layout storage

Decision date: 2026-11-03. Use extension-origin IndexedDB in an MV3 service worker,
with a small ISOLATED-world event/runtime bridge. Keep one MAIN-world layout cache module.

## Backend and permissions

- [`chrome.storage.local`](https://developer.chrome.com/docs/extensions/reference/api/storage#storage_areas)
  has a 10 MB quota (5 MB through Chrome 113), measured by JSON values plus keys. A guaranteed
  50 MB cache therefore needs `unlimitedStorage` if that backend is used.
- [Storage and cookies](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies#persistence)
  says extension web storage otherwise has normal quotas and can be evicted. `unlimitedStorage`
  exempts both extension and web storage from quota restrictions and eviction. IndexedDB is
  [available in service workers](https://developer.chrome.com/docs/extensions/develop/concepts/storage-and-cookies#access_in_service_workers),
  so no offscreen document or additional host permission is needed.
- Chrome's official [permissions and warning list](https://developer.chrome.com/docs/extensions/reference/permissions-list#unlimitedStorage)
  lists `unlimitedStorage` without a warning. Entries that produce warnings explicitly show
  “Warning displayed”; this one does not. It grants quota exemptions for `chrome.storage.local`,
  IndexedDB, Cache Storage and OPFS. It adds no install/update permission warning.
- [Permission warning guidelines](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)
  says adding a permission **that triggers a warning** disables an extension until accepted.
  Since `unlimitedStorage` has no warning, adding it alone does not trigger that disablement.
  This conclusion follows the current MV3 reference and warning list, not the obsolete Chrome Apps
  offline-storage article. Unpacked lab validation does not simulate a Web Store update.

The choice is about the data shape. The measured 12-turn fixture contains roughly 350 KB per
layout after compact encoding; 50 MB holds roughly 140 such layouts and over 1,600
per-turn rows, or more shorter conversations. IndexedDB gives an account/conversation index and transactional per-record updates,
TTL deletion and LRU eviction. A `chrome.storage.local` design would also work, including direct
content-script access and popup `getBytesInUse()`, but needs either a separately synchronized row
index or an all-keys scan and coordinated non-transactional deletes/puts to enforce a global cap.
The indexed, transactional row model is a better fit here. Popup access without a chat tab is
available with both backends and is not a reason for choosing IndexedDB.

A content script's `indexedDB` is the site's origin, including from the ISOLATED world. Every
extension-origin layout read/write goes through the versioned runtime protocol to the service
worker; only the one-time deletion of the legacy site DB runs in a content script.
`unlimitedStorage` avoids browser quota/eviction heuristics. Butter independently enforces the
50,000,000-byte sum of serialized geometry rows, including their metadata and `bytes` field.
IndexedDB file/index overhead and the bounded non-content control metadata are outside this count.
No `navigator.storage.estimate()` value is used.

The worker recomputes each row's exact UTF-8 JSON size and sums the durable store on every geometry
operation, including the first request that starts/restarts a worker. Writes, deletion and eviction
commit together in a readwrite transaction. Unknown-account requests are rejected before opening
the database. There is no byte total or account authority in a worker global. Globals cache a DB
connection, a promise queue, and settings reloaded from `chrome.storage.local`; losing them cannot
lose layout data or clear fencing. OS disk exhaustion can still reject writes; warm preview works.

Web Store review justification: “Butter uses unlimitedStorage to cache up to 50 MB of local,
account-partitioned layout geometry for smooth seeking in long ChatGPT conversations; it stores
no chat text and enforces its own 30-day expiry and 50 MB limit.”

## Data and loading

The account observer reads only `user.id` (session) or `id` (`me`) from a response the page already
requested. It never accesses token/cookie fields or starts a network request. Only the SHA-256
account hash is forwarded. Conversation, turn and message ids and layout fingerprints are hashed
before crossing the storage bridge. Source digests stay SHA-256. Geometry uses a versioned numeric
array encoding with a per-row typography dictionary and explicit field allowlists. Keeping each
row self-contained permits independent TTL/LRU eviction and updates; no heights or positions are
quantized, so encoding does not change landing geometry. Question/answer
text stays in the merged cache's page memory and is hydrated against the current source only.

Current-conversation prefetch starts on known account / chat source arrival. It finishes in memory
before drag preparation; no disk request is made by `prepare`. Records are checked on hydration and
again on use against the same source/layout/expiry validator. Queued measurements retain their
original identities. The width restore hook only consults cached fingerprints. Write epochs,
account switches, clear generations, and stale prefetch responses are fenced separately.

The worker refreshes LRU on load without extending the 30-day TTL, prunes on usage/load/write,
and evicts the least recently used rows globally. Usage counts distinct account/conversation
pairs. Clear and layout-off cover all accounts. Migration deletes the old trial database without
reading it. See [development](development.md#layout-storage-api) for the runtime contract.

## Protocol and worker termination

Runtime protocol version 1 uses `{ version: 1, type, ... }`; unsupported versions return
`{ error: 'layout-protocol' }`. The public usage and clear calls and internal load/put shapes are
listed in [development](development.md#layout-storage-api). Clear includes a random UUID
`requestId`; retry the exact same request. The last 64 clear ids are durably deduplicated in the
same transaction as clear and generation advancement, so a lost response followed by a retry
does not delete layouts written after the original clear. This bounded window covers immediate
client retries; older ids eventually leave the deduplication window.

Loads and usage are idempotent reads with pruning/LRU maintenance. Puts use stable identity keys
and a measurement timestamp captured at queue time; repeating a put does not duplicate bytes,
and an older retry cannot overwrite newer geometry. IndexedDB either commits the full operation
or rolls it back when the worker dies. The ISOLATED bridge retries a closed message port or storage
failure up to three times with the same payload; exhausted writes are kept pending in MAIN and
retried later. If clear/settings/account scope changed meanwhile, those pending writes are retired.
A durable generation fences pre-clear writes across worker restarts. Popup callers should retry
usage/clear up to three times on a closed port, keeping the same clear `requestId`.

The exact persisted fields and retention are documented in [the factual data inventory](layout-storage-data.md).
