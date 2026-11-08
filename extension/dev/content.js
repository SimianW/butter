// Dev build only. Isolated world: relays the worker's snapshot request to the MAIN-world
// recorder (dev/recorder-main.js) and returns its JSON. Saves nothing outside a chat.
(() => {
  const CHAT = /\/c\/[0-9a-f-]{36}(?:\/|$)/;
  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== 'butter-dev-snapshot') return;
    if (!CHAT.test(location.pathname)) {
      respond({ error: 'not-chat' });
      return;
    }
    let snapshot = null;
    const receive = (e) => {
      if (typeof e.detail === 'string') snapshot = e.detail;
    };
    // The MAIN-world listener answers synchronously inside this dispatch.
    document.addEventListener('butter-dev-snapshot-response', receive);
    document.dispatchEvent(
      new CustomEvent('butter-dev-snapshot-request', { detail: JSON.stringify(message.request) }),
    );
    document.removeEventListener('butter-dev-snapshot-response', receive);
    respond(snapshot ? { snapshot } : { error: 'no-recorder' });
  });
})();
