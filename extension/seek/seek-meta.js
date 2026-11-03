// Pure seek-card text, loaded only in the isolated world.
(function (root) {
  'use strict';
  function seekMeta(zh, n, total, state, unseen = false) {
    if (state === 'loading') return zh ? `正在加载第 ${n} 个问题…` : `Loading question ${n}…`;
    const base = zh ? `第 ${n} / ${total} 个问题` : `Question ${n} of ${total}`;
    return base + (unseen ? (zh ? ' · 还没打开过' : ' · not opened yet') : '');
  }
  if (typeof module === 'object' && module.exports) module.exports = seekMeta;
  else root.ButterSeekMeta = seekMeta;
})(typeof globalThis !== 'undefined' ? globalThis : this);
