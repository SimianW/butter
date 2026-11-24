// Isolated world. New chat (#163): the `new-chat` command's key (Alt+Shift+O) starts a new chat
// where the reader is: in the project of a project page or project chat, in Temporary Chat, or a
// normal new chat; on a new chat already, it only focuses the message box. The rules are
// ButterNewChat.decide (new-chat/logic.js); this file reads the page's facts at the press and
// carries out the action. No visible UI, no switch of its own: it follows Butter's main switch.
(() => {
  const N = ButterNewChat,
    // Turns and visibility: page/reader.js. The visible composer and the Work-mode read: Ask in
    // branch's page adapter (branch/page.js), shared rather than copied.
    R = ButterPageReader,
    P = ButterBranchPage,
    K = ButterCommandKeys; // the `new-chat` command's relay: commands/keys.js

  // Focus the visible composer with the caret at the end of its text, which stays as it is.
  const focus = () => {
    const editor = P.composer();
    if (!editor) return;
    editor.focus({ preventScroll: true });
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const s = document.getSelection();
    s?.removeAllRanges();
    s?.addRange(range);
  };

  K.on('new-chat', () => {
    const action = N.decide({
      url: location.href,
      paused: document.documentElement.hasAttribute('data-butter-disabled'),
      work: P.work(),
      // A client-side navigation leaves the old chat's turns in the DOM, hidden: only shown ones count.
      noTurns: !R.turns().some(R.visible),
    });
    if (action.kind === 'focus') focus();
    // ChatGPT's router lives in the main world: new-chat/go-main.js navigates there. ChatGPT
    // focuses the new chat's composer itself on arrival.
    else if (action.kind === 'go')
      document.dispatchEvent(new CustomEvent('butter-new-chat-go', { detail: action.path }));
  });
})();
