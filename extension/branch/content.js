// Isolated world, document_start. Ask in branch, both halves:
// - original tab: a button next to ChatGPT's "Ask ChatGPT" for a selection in a reply, the
//   question box, and the handoff (new tab opened inside the gesture, job through the worker);
// - new tab: claims the job once, covers the page while run.js makes and verifies the branch,
//   then shows the line above the composer.
// Nothing here types into or sends in the original tab.
(() => {
  const B = ButterBranch,
    P = ButterBranchPage;
  // Read before ChatGPT's router can touch the URL.
  const incoming = B.jobId(location.hash);
  let ui;
  const getUI = () => (ui ||= ButterBranchUI.create());
  const off = () => {
    const html = document.documentElement;
    return (
      html.hasAttribute('data-butter-disabled') ||
      (html.getAttribute('data-butter-off') || '').split(' ').includes('branch')
    );
  };
  const send = (message) => {
    try {
      return chrome.runtime.sendMessage(message);
    } catch (error) {
      return Promise.reject(error); // extension reloaded under this page
    }
  };

  // ---------------------------------------------------------------- original tab
  const drafts = new Map(); // per tab, per conversation and quote: unsent questions
  let sel = null,
    boxOpen = false,
    frame = 0,
    native = null,
    nativeAt = 0,
    last = null,
    selectionTimer;
  const draftKey = (s) => `${s.identity}\n${s.quote}`;
  const elementOf = (node) => (node?.nodeType === 1 ? node : node?.parentElement);

  const readSelection = () => {
    const s = document.getSelection();
    if (!s || s.rangeCount !== 1 || s.isCollapsed) return null;
    const range = s.getRangeAt(0);
    const start = P.replyOf(range.startContainer),
      end = P.replyOf(range.endContainer);
    // Formulas are fine (quoted as LaTeX); editable controls, images and other non-text regions
    // are not.
    const inside = (node, selector) => {
      const el = elementOf(node)?.closest(selector);
      return !!el && !el.closest(P.FORMULA);
    };
    const touching = (selector) =>
      !!start && [...start.querySelectorAll(selector)].some((el) => range.intersectsNode(el));
    const excluded =
      inside(range.startContainer, P.EXCLUDED) ||
      inside(range.endContainer, P.EXCLUDED) ||
      (!!start &&
        [...start.querySelectorAll(P.NON_TEXT)].some(
          (el) => !el.closest(P.FORMULA) && range.intersectsNode(el),
        ));
    const identity = B.identity(location.href),
      text = touching(P.FORMULA) ? B.quoteOf(range, P.quoteDom) || '' : s.toString();
    if (!B.qualifies({ text, start, end, identity, excluded, page: P.facts() })) return null;
    return { range: range.cloneRange(), quote: text.trim(), identity };
  };

  const hideSelectionUI = () => {
    cancelAnimationFrame(frame);
    frame = 0;
    sel = null;
    boxOpen = false;
    native = null;
    last = null;
    highlight(null);
    ui?.button.hide();
    ui?.question.close();
  };

  // Follow ChatGPT's button every frame while a selection is active: same top edge, 4 px to
  // its right, shown and hidden with it. While the question box is open, Butter's button is hidden.
  // The page selection has moved into the box, so ChatGPT's button goes away too; the box stays
  // anchored where ChatGPT's button last was, relative to the quote. Once the box closes, Butter's
  // button comes back with ChatGPT's if the selection is still there.
  const tick = () => {
    frame = 0;
    if (!sel || off()) return hideSelectionUI();
    if (!sel.range.startContainer.isConnected || B.identity(location.href) !== sel.identity)
      return hideSelectionUI();
    const now = performance.now();
    if (!native || !P.visible(native.box) || now - nativeAt > 250) {
      native = P.nativeAsk();
      nativeAt = now;
    }
    // ChatGPT's toolbar offers "Ask in side chat": Work mode, where Butter has no button.
    if (native?.sideChat) return hideSelectionUI();
    const u = getUI();
    const area = sel.range.getBoundingClientRect();
    if (native) {
      const r = native.box.getBoundingClientRect();
      // While ChatGPT's button is hovered, pressed or focused, keep the look it had at rest.
      const busy = P.nativeBusy(native);
      last = {
        dx: r.left - area.left,
        dy: r.top - area.bottom,
        width: r.width,
        height: r.height,
        style: busy && last?.style ? last.style : P.nativeStyle(native),
      };
    } else if (!boxOpen) last = null;
    if (last) {
      const anchor = { left: area.left + last.dx, top: area.bottom + last.dy };
      anchor.right = anchor.left + last.width;
      anchor.bottom = anchor.top + last.height;
      if (boxOpen) {
        u.button.hide();
        placeBox(anchor, area);
      } else {
        const width = u.button.el.offsetWidth || 120;
        let left = anchor.right + 4;
        if (left + width > innerWidth - 8) left = anchor.left - 4 - width;
        u.button.show(left, anchor.top, last.style);
      }
    } else {
      u.button.hide();
      if (boxOpen) placeBox({ left: area.left, top: area.bottom, bottom: area.bottom }, area);
    }
    frame = requestAnimationFrame(tick);
  };
  const follow = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  // Under the buttons, left-aligned with them; above the selection when there is no room below.
  const placeBox = (anchor, area) => {
    const size = ui.question.size();
    if (!size) return;
    const left = Math.max(16, Math.min(anchor.left, innerWidth - size.width - 16));
    let top = Math.max(anchor.bottom, area.bottom) + 8;
    if (top + size.height > innerHeight - 16)
      top = Math.max(16, Math.min(anchor.top, area.top) - 8 - size.height);
    ui.question.place(left, top);
  };

  // The quote stays visibly highlighted while the page selection is in the question box.
  const highlight = (range) => {
    if (!globalThis.CSS?.highlights) return;
    if (!range) return CSS.highlights.delete('butter-branch-quote');
    let style = document.getElementById('butter-branch-highlight');
    if (!style) {
      style = document.createElement('style');
      style.id = 'butter-branch-highlight';
      (document.head || document.documentElement).append(style);
    }
    style.textContent = `::highlight(butter-branch-quote) { background-color: ${
      ButterBranchUI.isDark() ? 'rgb(80 150 255 / .35)' : 'rgb(0 102 255 / .22)'
    }; }`;
    CSS.highlights.set('butter-branch-quote', new Highlight(range));
  };

  // Esc gives the selection back, so the user is where they were; a click outside makes its
  // own selection.
  const closeBox = (restore = false) => {
    if (!boxOpen) return;
    boxOpen = false;
    ui.question.close();
    highlight(null);
    if (restore && sel?.range.startContainer.isConnected) {
      const s = document.getSelection();
      s.removeAllRanges();
      s.addRange(sel.range);
    }
    onSelection();
  };
  const openBox = () => {
    if (!sel || boxOpen) return;
    boxOpen = true;
    const current = sel;
    const { input } = getUI().question.open({
      quote: current.quote,
      draft: drafts.get(draftKey(current)),
      onInput: (value) => drafts.set(draftKey(current), value),
      onSubmit: (question) => submit(current, question),
      onClose: () => closeBox(true),
    });
    highlight(current.range);
    tick();
    input.focus({ preventScroll: true });
    input.setSelectionRange(input.value.length, input.value.length);
  };

  // Hand-overs waiting to be claimed by their new tab, by job id. Until then the question box
  // stays open (the new tab is in front, so it isn't seen), so a failed hand-over leaves the
  // question where it was, with the reason.
  const pending = new Map();
  const handoffFailed = (id, { closeTab = true } = {}) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    if (closeTab)
      try {
        p.tab.close();
      } catch {}
    drafts.set(draftKey(p.current), p.question); // the question is not lost
    showReason(p.current, 'handoff');
  };
  const handedOver = (id) => {
    const p = pending.get(id);
    if (!p) return;
    pending.delete(id);
    clearTimeout(p.timer);
    drafts.delete(draftKey(p.current));
    if (sel === p.current) hideSelectionUI();
  };
  // Keep (or reopen) the box for this selection and say why it didn't go through. A selection
  // the user has moved on to is left alone; the draft still waits for the old one.
  const showReason = (current, reason) => {
    if (!sel && !boxOpen && current.range.startContainer.isConnected) {
      sel = current;
      follow();
    }
    if (sel === current && !boxOpen) openBox();
    if (sel === current) ui.question.reason(ui.strings()[reason]);
  };
  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === 'butter-branch-claimed') handedOver(message.id);
    else if (message?.type === 'butter-branch-unclaimed') handoffFailed(message.id);
  });

  // Runs inside the Enter/click gesture: window.open must stay synchronous here.
  const submit = (current, question) => {
    const id = crypto.randomUUID();
    const raw = document.title.trim();
    const title =
      raw && raw !== 'ChatGPT' ? raw.replace(/\s*[|–-]\s*ChatGPT$/, '').slice(0, 200) : undefined;
    const job = { original: current.identity, title, quote: current.quote, question };
    ui.question.reason(null);
    const put = send({ type: 'butter-branch-put', id, job });
    const url = new URL(location.href);
    url.hash = `butter-branch=${id}`;
    const tab = window.open(url.href, '_blank');
    if (!tab) {
      // Pop-ups blocked: keep the box and the question. A claim from this tab deletes the job.
      put.then(() => send({ type: 'butter-branch-claim', id })).catch(() => {});
      drafts.set(draftKey(current), question);
      ui.question.reason(ui.strings().blocked);
      return;
    }
    try {
      tab.opener = null;
    } catch {}
    // No word within the job's lifetime: the new tab never claimed it. Leave that tab alone.
    const timer = setTimeout(() => handoffFailed(id, { closeTab: false }), B.TTL + 5_000);
    pending.set(id, { current, question, tab, timer });
    put
      .then((result) => {
        if (!result?.ok) throw new Error('handoff');
      })
      .catch(() => handoffFailed(id));
  };

  const onSelection = () => {
    if (boxOpen) return;
    if (off()) return hideSelectionUI();
    sel = readSelection();
    if (sel) follow();
    else hideSelectionUI();
  };
  document.addEventListener('selectionchange', () => {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(onSelection, 40);
  });
  document.addEventListener('butter-settings', () => {
    if (!off()) return;
    hideSelectionUI();
    stopRun?.();
  });
  // Esc or a click outside closes the box; the draft stays for this selection.
  document.addEventListener(
    'pointerdown',
    (e) => {
      if (boxOpen && !e.composedPath().includes(ui.host)) closeBox();
    },
    true,
  );
  document.addEventListener(
    'keydown',
    (e) => {
      if (boxOpen && e.key === 'Escape' && !e.composedPath().includes(ui.host)) closeBox(true);
    },
    true,
  );
  const wireButton = () => {
    const chip = getUI().button.el;
    // Open on pointerdown: keeps the page selection, and ChatGPT may hide its own button
    // (and so Butter's) before a click would land.
    chip.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      openBox();
    });
    chip.addEventListener('mousedown', (e) => e.preventDefault());
    chip.addEventListener('click', (e) => {
      if (e.detail === 0) openBox(); // keyboard
    });
  };

  // ---------------------------------------------------------------- new tab
  const clock = {
    now: () => performance.now(),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  };
  const domReady = () =>
    document.body
      ? Promise.resolve()
      : new Promise((resolve) =>
          document.addEventListener('DOMContentLoaded', resolve, { once: true }),
        );

  // The tab title says what is happening while the overlay is up.
  const tabTitle = (() => {
    let observer = null,
      saved = null,
      text = null;
    // ChatGPT retitles the tab as it routes; remember its latest title for afterwards.
    const keep = () => {
      if (!text || document.title === text) return;
      saved = document.title;
      document.title = text;
    };
    return {
      set(value) {
        saved ??= document.title;
        // Switching between Butter's own titles (creating ↔ waiting) is not a ChatGPT retitle.
        if (text && document.title === text) document.title = value;
        text = value;
        keep();
        observer ||= new MutationObserver(keep);
        observer.observe(document.head || document.documentElement, {
          subtree: true,
          childList: true,
          characterData: true,
        });
      },
      clear() {
        observer?.disconnect();
        if (text && document.title === text && saved) document.title = saved;
        text = saved = null;
      },
    };
  })();

  // The line above the composer, clear of ChatGPT's disclaimer. The ready line fades out once
  // ChatGPT's reply to the sent question starts to show. Any line goes at once when the user sends
  // their own next message, presses ×, or leaves this conversation. ChatGPT saving the branch
  // after its first message (unsaved local-chatgpt id → saved id) is not leaving it.
  const line = (() => {
    let timer = 0,
      route = null,
      replies = null; // reply keys just before Butter's send click, for the ready line
    const place = () => {
      const id = B.identity(location.href);
      if (id !== route) {
        if (!(route && !B.saved(route) && B.saved(id))) return hide();
        route = id;
      }
      if (replies && B.replyStarted(replies, P.replyKeys({ written: true }))) {
        stop();
        return ui?.note.fade();
      }
      const box = P.composerBox();
      if (box) ui?.note.place({ ...box.toJSON(), top: P.clearTop(box, ui.note.height() + 8) });
    };
    const stop = () => {
      clearInterval(timer);
      timer = 0;
      replies = null;
      removeEventListener('resize', place);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    };
    const hide = () => {
      stop();
      ui?.note.remove();
    };
    const onClick = (e) => {
      if (!e.isTrusted) return;
      const button = P.adapter().sendButton();
      if (button && e.composedPath().includes(button)) hide();
    };
    const onKey = (e) => {
      const editor = P.composer();
      if (
        e.isTrusted &&
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.isComposing &&
        editor &&
        e.composedPath().includes(editor) &&
        editor.innerText.trim()
      )
        hide();
    };
    return {
      // before: every reply key just before Butter's send click. Taken after it, they would hold
      // the empty reply ChatGPT mounts at the click, and its text would never count; that empty
      // reply is not the reply starting either, so place() counts only replies with text.
      show(kind, title, before) {
        hide();
        route = B.identity(location.href);
        if (kind === 'ready') replies = before;
        getUI().note.show({ kind, title, onClose: stop });
        place();
        timer = setInterval(place, 200);
        addEventListener('resize', place);
        document.addEventListener('click', onClick, true);
        document.addEventListener('keydown', onKey, true);
      },
      hide,
    };
  })();

  // Copy the message Butter would have sent. The clipboard API needs focus; fall back to a
  // selected textarea for pages where it refuses.
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
      document.documentElement.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  };
  const closeTab = () =>
    send({ type: 'butter-branch-close' })
      .then((result) => {
        if (!result?.ok) throw new Error('close');
      })
      .catch(() => window.close());

  // Esc on the card: cancel while working, close the failure card. Only the user's own key:
  // the run closes ChatGPT's menus with a synthetic Escape of its own.
  let onEscape = null;
  // Cancels the run in progress, if any: turning Butter or Ask in branch off stops it.
  let stopRun = null;
  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.isTrusted || e.key !== 'Escape' || e.isComposing || !onEscape) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      onEscape();
    },
    true,
  );

  const runBranch = (job) => {
    const u = getUI();
    let run = null;
    const end = () => {
      onEscape = null;
      stopRun = null;
      tabTitle.clear();
    };
    // ×, Cancel and Esc: stop at once. The run makes no further page call, and the overlay goes
    // now rather than at the run's next step.
    const cancel = () => {
      if (!run?.cancel()) return;
      end();
      line.hide();
      u.overlay.remove();
    };
    onEscape = cancel;
    stopRun = cancel;
    u.overlay.working({ question: job.question, onCancel: cancel });
    tabTitle.set(u.strings().creating);
    const page = P.adapter();
    let before = null;
    run = ButterBranchRun.start({
      job,
      page: {
        ...page,
        send(button) {
          before = P.replyKeys();
          return page.send(button);
        },
      },
      clock,
      onState(state, info) {
        if (state === 'waiting-for-reply' || state === 'branching') {
          // The same working card, so ×, Cancel and Esc cancel here too.
          const waiting = state === 'waiting-for-reply';
          u.overlay.waiting(waiting);
          tabTitle.set(u.strings()[waiting ? 'waiting' : 'creating']);
        } else if (state === 'ready') {
          // The card and its cancel stay through sending: until the click, cancel still stops it.
          end();
          u.overlay.remove();
          line.show('ready', job.title, before);
          globalThis.ButterSettings?.report('branch', { exercised: true, engaged: true });
        } else if (state === 'unsure') {
          end();
          u.overlay.remove();
          line.show('unsure');
        } else if (state === 'failed') {
          // Reached only after the run's re-check found no branch.
          end();
          line.hide();
          if (B.confirmedFailure(info.cause))
            globalThis.ButterSettings?.report('branch', { exercised: true, failed: true });
          onEscape = () => u.overlay.close();
          u.overlay.failure({
            question: job.question,
            cause: info.cause,
            onRetry: () => runBranch(job),
            onCopy: () => copy(B.formatMessage(job.quote, job.question)),
            onCloseTab: closeTab,
            onClose: () => (onEscape = null),
          });
        } else if (state === 'cancelled') {
          end();
          line.hide();
          u.overlay.remove();
        }
      },
    });
  };

  const claim = async (id) => {
    // Drop the job id from the URL at once; the job itself is fetched from the worker.
    history.replaceState(history.state, '', location.pathname + location.search);
    let result = null;
    // The worker may still be starting, or still storing the job: retry briefly.
    for (let i = 0; i < 30; i++) {
      result = await send({ type: 'butter-branch-claim', id }).catch(() => null);
      if (result?.job || result?.error) break;
      await clock.sleep(100);
    }
    if (!result?.job) return;
    await domReady();
    if (!off()) runBranch(result.job);
  };

  if (incoming) claim(incoming);
  domReady().then(wireButton);
})();
