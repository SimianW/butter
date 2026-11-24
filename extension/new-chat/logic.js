// New chat (#163): the pure decision of the new chat shortcut, shared by new-chat/content.js and
// node --test. No browser APIs here.
// URL shapes, from the lab (notes/runs/2026-11-23-new-chat-project/report.md, Q1): a project page
// is /g/g-p-<id>[-<slug>]/project, a project chat /g/g-p-<id>[-<slug>]/c/<id>; ChatGPT's own links
// leave the slug out and both forms load the same page. A new chat in a project has no URL of its
// own before its first send: it is the project page. Temporary Chat is /?temporary-chat=true.
(() => {
  // A project's id: the path's first segment after /g/ is g-p-<id>, then the slug after a "-".
  // A custom GPT's segment is g-<id>, with no "p-": not a project.
  const PROJECT = /^\/g\/g-p-([0-9a-z]+)(?:-[^/]*)?(?:\/|$)/i;
  const PROJECT_PAGE = /^\/g\/g-p-[0-9a-z]+(?:-[^/]*)?\/project\/?$/i;
  const NONE = { kind: 'none' },
    FOCUS = { kind: 'focus' };
  const go = (path) => ({ kind: 'go', path });

  // What a press does, from the page's facts at the press:
  // - url: the page's URL;
  // - paused: Butter's main switch is off;
  // - work: the page is in Work mode (ButterBranch.isWorkMode);
  // - noTurns: no turns are shown (the page holds no sent message yet).
  // Returns { kind: 'none' }, { kind: 'focus' } (focus the visible message box) or
  // { kind: 'go', path } (navigate to path). The rules are checked in this order.
  const decide = ({ url, paused, work, noTurns } = {}) => {
    let page;
    try {
      page = new URL(url);
    } catch {
      return NONE;
    }
    if (page.origin !== 'https://chatgpt.com' || paused || work) return NONE;
    const path = page.pathname;
    const project = PROJECT.exec(path)?.[1];
    if (project)
      return PROJECT_PAGE.test(path) && noTurns ? FOCUS : go(`/g/g-p-${project}/project`);
    if (page.searchParams.get('temporary-chat') === 'true')
      return noTurns ? FOCUS : go('/?temporary-chat=true');
    if (path === '/' && noTurns) return FOCUS;
    return go('/');
  };

  globalThis.ButterNewChat = { decide };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterNewChat;
})();
