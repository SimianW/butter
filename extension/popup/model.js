// Pure popup formatting and confirmation state. No browser APIs.
(() => {
  const formatUsage = ({ conversations = 0, bytes = 0 } = {}, lang = 'en') => {
    const size =
      bytes < 100_000 ? `${Math.round(bytes / 1000)} KB` : `${(bytes / 1_000_000).toFixed(1)} MB`;
    return lang === 'zh'
      ? `${conversations} 个对话，约 ${size}`
      : `${conversations} ${conversations === 1 ? 'chat' : 'chats'}, about ${size}`;
  };
  const usageFill = (bytes) => Math.min(100, Math.max(0, (bytes / 50_000_000) * 100));
  // The manifest's version_name as written, for example 0.1.0-alpha.15.
  const versionLabel = (version) => version;
  const clearFlow = (state, event) =>
    ({
      idle: { ask: 'confirm' },
      confirm: { cancel: 'idle', confirm: 'clearing' },
      clearing: { success: 'done', error: 'error' },
      done: { timeout: 'idle' },
      error: { ask: 'confirm' },
    })[state]?.[event] ?? state;
  // Retry the identical clear request: a new id on retry would clear newly saved measurements.
  async function layoutRequest(send, request) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await send(request);
        if (!result || result.error) throw new Error(result?.error || 'layout-storage');
        return result;
      } catch (error) {
        if (attempt === 2) throw error;
      }
    }
  }
  globalThis.ButterPopup = { formatUsage, usageFill, versionLabel, clearFlow, layoutRequest };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterPopup;
})();
