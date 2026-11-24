// MAIN world. New chat (#163): the shortcut's `go`, run where ChatGPT's router sees it as its own.
// new-chat/content.js asks with `butter-new-chat-go` on document, its detail the path to go to.
// A client-side navigation, history.pushState and then popstate, lands on the same ready state as
// ChatGPT's own link to a project page, without a reload (notes/runs/2026-11-23-new-chat-project,
// Q3). A path in RELOAD takes a full location.assign instead: the live lab decides whether a
// Temporary Chat with turns needs that ('/?temporary-chat=true'), the one route the lab hasn't seen.
(() => {
  const RELOAD = [];
  document.addEventListener('butter-new-chat-go', (e) => {
    const path = e.detail;
    // A path on this origin only.
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return;
    if (RELOAD.includes(path)) return location.assign(path);
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
})();
