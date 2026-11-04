# Working investigation

Authoritative code: saved first attempt copied to `first-source/`; HEAD `9d6cad4` (verify final report).

Deterministic red command: `node (not archived)`.
Actual output:
```
width-race pending before: 1 width: 768
width-race cache after returning: [["a",[[0,{"height":1000,"tag":"div","className":""}]]]]
hidden-copy same scroller split across caches: true states: 2
eviction before delayed mark watched: false RO: false
eviction after delayed mark/removal watched: false RO: true
flush after streaming/untypeset replacement cached: true
detached new-chat cleanup watched: 0 columns: 0 conversations retains scroller: true
```

Production DOM identity: `[data-chatgpt-selection-conversation-id][data-chatgpt-selection-message-id]` is the main markdown root's parent. Read-only capture: `message-dom.json`. Unknown identities must bypass caching. Do not use current URL or hold scroller keys.

Working candidate: keep HEAD seen marking; cache direct blocks under a stable message/conversation owner; no whole-turn fallback, no :has; width applicability guarded in CSS. Unknown or replacement answer identity takes HEAD path.
