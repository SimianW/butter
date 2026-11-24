// MAIN world. New chat (#163): the shortcut's `go`, run where ChatGPT's router sees it as its own.
// new-chat/content.js asks with `butter-new-chat-go` on document, its detail the path to go to.
// A client-side navigation, history.pushState and then popstate, lands on the same ready state as
// ChatGPT's own link to a project page, without a reload (notes/runs/2026-11-23-new-chat-project,
// Q3). The same client-side navigation gives an empty Temporary Chat from one with turns (live lab
// 2026-11-24, `PASS temporary`, no reload; notes/runs/2026-11-24-new-chat-shortcut/report.md).
(() => {
  document.addEventListener('butter-new-chat-go', (e) => {
    const path = e.detail;
    // A path on this origin only.
    if (typeof path !== 'string' || !path.startsWith('/') || path.startsWith('//')) return;
    history.pushState(null, '', path);
    dispatchEvent(new PopStateEvent('popstate', { state: null }));
  });
})();
