// Diagnostic only. Installed before page scripts in MAIN and before clicks in Butter's world.
export function installScrollProbe(world) {
  if (globalThis.__railScrollProbe) return;
  globalThis.__railScrollProbe = true;
  let active = false, smooth = false;
  const visible = () => [...document.querySelectorAll('.thread-scroll-container')].find(s => s.clientHeight);
  const relevant = el => el === window || el?.matches?.('.thread-scroll-container') || el?.closest?.('.thread-scroll-container');
  const emit = (kind, el, extra = {}) => {
    if (!active || !relevant(el)) return;
    const s = el?.matches?.('.thread-scroll-container') ? el : visible();
    if (!s) return;
    const detail = JSON.stringify({ at: performance.now(), world, kind, y: s.scrollTop, h: s.scrollHeight,
      vh: s.clientHeight, connected: s.isConnected, smoothPending: smooth, ...extra });
    s.dispatchEvent(new CustomEvent('rail-scroll-probe', { bubbles: true, detail }));
  };
  const stack = () => new Error().stack.replace(/https:\/\/chatgpt.com/g, 'page:').replace(/chrome-extension:\/\/[a-p]+/g, 'extension:');
  document.addEventListener('rail-probe-start', () => { active = true; smooth = false; emit('armed', visible()); });
  document.addEventListener('rail-probe-stop', () => { active = false; });
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
  Object.defineProperty(Element.prototype, 'scrollTop', { ...descriptor, set(value) {
    emit('scrollTop:before', this, { value, stack: stack() });
    descriptor.set.call(this, value);
    emit('scrollTop:after', this, { value });
  } });
  for (const proto of [Element.prototype, Window.prototype, window]) for (const method of ['scroll', 'scrollTo', 'scrollBy', 'scrollIntoView']) {
    const original = Object.hasOwn(proto, method) ? proto[method] : null;
    if (!original) continue;
    proto[method] = function (...args) {
      const opts = args[0];
      if (relevant(this) && method !== 'scrollIntoView') smooth = opts?.behavior === 'smooth';
      emit(`${method}:before`, this, { args: args.map(a => typeof a === 'object' ? { top: a?.top, left: a?.left, behavior: a?.behavior, block: a?.block } : a), stack: stack() });
      const result = original.apply(this, args);
      emit(`${method}:after`, this);
      return result;
    };
  }
  for (const kind of ['scroll', 'scrollend', 'contentvisibilityautostatechange']) document.addEventListener(kind, event => {
    if (kind === 'scrollend') smooth = false;
    emit(kind, event.target, { skipped: event.skipped, subjectTurn: event.target?.closest?.('[data-turn-key]')?.dataset.turnKey, subject: event.target?.matches?.('[data-turn-key]') ? 'turn' : kind === 'contentvisibilityautostatechange' ? 'answer-block' : 'scroller' });
  }, true);
  // WAAPI exposes opacity/placeholder animations, but native smooth scrolling has no Animation object.
  // smoothPending is request-to-scrollend state, not a claim that the compositor is still moving.
}
