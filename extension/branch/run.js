// Ask in branch: the run in the new tab, as a state machine over an injected page adapter.
// No browser APIs here; extension/branch/page.js is the real adapter, tests use a fake page.
//
// States: loading → waiting-for-reply → branching → verifying → sending → ready,
// plus the end states unsure (filled, not sent), failed and cancelled.
//
// Rules:
// - Success is decided by identity: the tab shows a readable conversation other than the
//   original, and that conversation has rendered. Menu-step timeouts never decide it.
// - Before reporting a failure, the run re-checks whether the tab already landed on a branch.
// - It sends only from a verified branch. Any doubt ends in unsure: filled, not sent.
// - It never types into or sends in the original conversation.
// - "Branch in new chat" is pressed at most once per run, so a slow branch is never made twice.
// - cancel() stops all further page calls at once.
(() => {
  const B = globalThis.ButterBranch || require('./logic.js');
  const TIMING = {
    poll: 100,
    load: 15_000, // original conversation and its latest reply rendered
    stream: 15 * 60_000, // latest reply still being written
    step: 4_000, // one menu item to appear
    verify: 15_000, // route change and render after "Branch in new chat"
    recheck: 3_000, // last look for a branch before reporting failure
    send: 3_000, // send button enabled after filling
  };
  const END = new Set(['ready', 'unsure', 'failed', 'cancelled']);
  class Cancelled extends Error {}
  class Timeout extends Error {}

  function start({ job, page: rawPage, clock, onState = () => {} }) {
    let cancelled = false,
      state = null;
    // Every adapter call goes through here, so nothing reaches the page after cancel().
    const page = new Proxy(rawPage, {
      get: (target, key) => {
        const value = target[key];
        if (typeof value !== 'function') return value;
        return (...args) => {
          if (cancelled) throw new Cancelled();
          return value.apply(target, args);
        };
      },
    });
    const enter = (next, info = {}) => {
      if (cancelled && next !== 'cancelled') throw new Cancelled();
      state = next;
      onState(next, info);
      if (cancelled && next !== 'cancelled') throw new Cancelled();
    };
    const sleep = async (ms) => {
      if (cancelled) throw new Cancelled();
      await clock.sleep(ms);
      if (cancelled) throw new Cancelled();
    };
    // Poll a predicate until it returns something truthy or the window closes.
    const waitFor = async (predicate, ms) => {
      const end = clock.now() + ms;
      for (;;) {
        const value = predicate();
        if (value) return value;
        if (clock.now() >= end) throw new Timeout();
        await sleep(TIMING.poll);
      }
    };
    const verified = () => {
      const id = page.identity();
      return B.isBranch(id, job.original) && page.isRendered(id) ? id : null;
    };
    const step = async (cause, find) => {
      try {
        page.press(await waitFor(find, TIMING.step));
      } catch (error) {
        if (error instanceof Timeout) error.cause = cause;
        throw error;
      }
    };

    async function branch() {
      let cause = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          await step('more', () => page.latestReplyMenu());
          await step('branch', () => page.branchItem());
          await step('newchat', () => page.newChatItem());
          return { pressed: true };
        } catch (error) {
          if (error instanceof Cancelled) throw error;
          // Pressing "Branch in new chat" threw after the press was dispatched: treat as pressed.
          if (!(error instanceof Timeout)) return { pressed: true };
          cause = error.cause;
          page.dismissMenus();
          if (B.isBranch(page.identity(), job.original)) return { pressed: false };
        }
      }
      return { pressed: false, cause };
    }

    async function verify(attempt) {
      try {
        return await waitFor(verified, attempt.pressed ? TIMING.verify : TIMING.poll);
      } catch (error) {
        if (!(error instanceof Timeout)) throw error;
      }
      // Re-check before reporting a failure: a slow page may still have made the branch.
      page.dismissMenus();
      try {
        return await waitFor(verified, TIMING.recheck);
      } catch (error) {
        if (!(error instanceof Timeout)) throw error;
      }
      return null;
    }

    async function fill(id) {
      const current = page.identity();
      // Typing is allowed only away from the original, and in the conversation verified (if any).
      if (current === job.original || (id && current !== id)) return { cause: 'identity' };
      const text = B.formatMessage(job.quote, job.question);
      const draft = page.composerText();
      if (draft === null) return { cause: 'composer' };
      const normalized = draft.trim().replace(/\n{3,}/g, '\n\n');
      if (normalized && normalized !== text) return { cause: 'composer', kept: true };
      if (!normalized && !page.fill(text)) return { cause: 'composer' };
      return { text };
    }

    async function run() {
      await Promise.resolve();
      enter('loading');
      let id = null;
      const already = () => B.isBranch(page.identity(), job.original);
      try {
        await waitFor(
          () => already() || (page.identity() === job.original && page.isLoaded()),
          TIMING.load,
        );
      } catch (error) {
        if (!(error instanceof Timeout)) throw error;
        return { state: 'failed', cause: 'load' };
      }
      let attempt = { pressed: false };
      if (!already()) {
        if (page.isStreaming()) {
          enter('waiting-for-reply');
          try {
            await waitFor(() => !page.isStreaming(), TIMING.stream);
          } catch (error) {
            if (!(error instanceof Timeout)) throw error;
            return { state: 'failed', cause: 'stream' };
          }
        }
        enter('branching');
        attempt = await branch();
      }
      enter('verifying');
      id = await verify(attempt);
      if (!id) {
        const current = page.identity();
        const maybeBranch =
          attempt.pressed &&
          current !== job.original &&
          (current === null || B.isBranch(current, job.original));
        if (!maybeBranch) return { state: 'failed', cause: attempt.cause || 'identity' };
        // Something changed, but Butter can't be sure it is a branch: fill, never send.
        enter('sending', { verified: false });
        const filled = await fill(null);
        if (filled.cause === 'identity') return { state: 'failed', cause: 'identity' };
        return { state: 'unsure', cause: filled.cause || 'unverified', identity: current };
      }
      enter('sending', { verified: true, identity: id });
      const filled = await fill(id);
      if (filled.cause === 'identity') return { state: 'failed', cause: 'identity' };
      if (filled.cause) return { state: 'unsure', cause: filled.cause, identity: id };
      // ChatGPT enables its send button a moment after the text arrives.
      let button;
      try {
        button = await waitFor(() => page.sendButton(), TIMING.send);
      } catch (error) {
        if (!(error instanceof Timeout)) throw error;
        return { state: 'unsure', cause: 'send', identity: id };
      }
      // Send only while the tab still shows the verified branch.
      if (page.identity() !== id || !page.isRendered(id))
        return { state: 'unsure', cause: 'unverified', identity: id };
      if (!page.send(button)) return { state: 'unsure', cause: 'send', identity: id };
      return { state: 'ready', identity: id };
    }

    const done = run()
      .catch((error) => {
        if (error instanceof Cancelled || cancelled) return { state: 'cancelled' };
        return { state: 'failed', cause: 'error', error };
      })
      .then((result) => {
        if (cancelled) result = { state: 'cancelled' };
        state = result.state;
        onState(result.state, result);
        return result;
      });
    return {
      done,
      get state() {
        return state;
      },
      cancel() {
        if (state && END.has(state)) return false;
        cancelled = true;
        return true;
      },
    };
  }

  globalThis.ButterBranchRun = { start, TIMING };
  if (typeof module !== 'undefined') module.exports = globalThis.ButterBranchRun;
})();
