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
    const excluded =
      !!elementOf(range.startContainer)?.closest(P.EXCLUDED) ||
      !!elementOf(range.endContainer)?.closest(P.EXCLUDED) ||
      (!!start &&
        [...start.querySelectorAll('.katex, math, img')].some((el) => range.intersectsNode(el)));
    const identity = B.identity(location.href),
      text = s.toString();
    if (!B.qualifies({ text, start, end, identity, excluded })) return null;
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
  // its right, shown and hidden with it. While the question box is open the page selection has
  // moved into the box, so ChatGPT's button goes away; Butter's then stays where it last was,
  // relative to the quote, as the box's anchor.
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
    const u = getUI();
    const area = sel.range.getBoundingClientRect();
    if (native) {
      const r = native.box.getBoundingClientRect();
      last = {
        dx: r.left - area.left,
        dy: r.top - area.bottom,
        width: r.width,
        height: r.height,
        style: P.nativeStyle(native),
      };
    } else if (!boxOpen) last = null;
    if (last) {
      const anchor = { left: area.left + last.dx, top: area.bottom + last.dy };
      anchor.right = anchor.left + last.width;
      anchor.bottom = anchor.top + last.height;
      const width = u.button.el.offsetWidth || 120;
      let left = anchor.right + 4;
      if (left + width > innerWidth - 8) left = anchor.left - 4 - width;
      u.button.show(left, anchor.top, last.style);
      if (boxOpen) placeBox(anchor, area);
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

  // Runs inside the Enter/click gesture: window.open must stay synchronous here.
  const submit = (current, question) => {
    const id = crypto.randomUUID();
    const raw = document.title.trim();
    const title =
      raw && raw !== 'ChatGPT' ? raw.replace(/\s*[|–-]\s*ChatGPT$/, '').slice(0, 200) : undefined;
    const job = { original: current.identity, title, quote: current.quote, question };
    const put = send({ type: 'butter-branch-put', id, job });
    const url = new URL(location.href);
    url.hash = `butter-branch=${id}`;
    const tab = window.open(url.href, '_blank');
    if (!tab) {
      // Pop-ups blocked: keep the box and the question. A claim from this tab deletes the job.
      put.then(() => send({ type: 'butter-branch-claim', id })).catch(() => {});
      return;
    }
    try {
      tab.opener = null;
    } catch {}
    const key = draftKey(current);
    drafts.delete(key);
    hideSelectionUI();
    put
      .then((result) => {
        if (!result?.ok) throw new Error('handoff');
      })
      .catch(() => {
        try {
          tab.close();
        } catch {}
        drafts.set(key, question); // the question is not lost
      });
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
    if (off()) hideSelectionUI();
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

  // The line above the composer stays until the user sends their own next message, or ×, or
  // leaves this conversation. ChatGPT saving the branch after its first message (unsaved
  // local-chatgpt id → saved id) is not leaving it.
  const line = (() => {
    let timer = 0,
      route = null;
    const place = () => {
      const id = B.identity(location.href);
      if (id !== route) {
        if (!(route && !B.saved(route) && B.saved(id))) return hide();
        route = id;
      }
      ui?.note.place(P.composerBox());
    };
    const stop = () => {
      clearInterval(timer);
      timer = 0;
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
      show(kind, title) {
        hide();
        route = B.identity(location.href);
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

  const runBranch = (job) => {
    const u = getUI();
    let run = null;
    const cancel = () => run?.cancel();
    u.overlay.working({ question: job.question, headerBottom: P.headerBottom(), onCancel: cancel });
    tabTitle.set(u.strings().creating);
    run = ButterBranchRun.start({
      job,
      page: P.adapter(),
      clock,
      onState(state, info) {
        if (state === 'sending') {
          u.overlay.remove();
          tabTitle.clear();
          if (info.verified) line.show('ready', job.title);
        } else if (state === 'unsure') {
          u.overlay.remove();
          tabTitle.clear();
          line.show('unsure');
        } else if (state === 'failed') {
          tabTitle.clear();
          line.hide();
          u.overlay.failure({ question: job.question });
        } else if (state === 'cancelled') {
          tabTitle.clear();
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
    runBranch(result.job);
  };

  if (incoming) claim(incoming);
  domReady().then(wireButton);
})();
