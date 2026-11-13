// A small fake DOM for the rail's scripts under node: elements with listeners (capture and bubble
// phases, as seen from window), children, attributes, classes and the few selectors the rail uses,
// and observers that record what they observe. test/helpers/rail-boot.mjs boots the whole rail on
// it for test/rail.test.mjs; test/pre-jump.test.mjs, test/rail-turns.test.mjs,
// test/rail-jump.test.mjs and test/rail-card-dom.test.mjs drive one module each.
export class FakeElement {
  constructor(tag = 'div') {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.listeners = new Map();
    this.style = {
      setProperty(name, value) {
        this[name] = value;
      },
      getPropertyValue(name) {
        return this[name] ?? '';
      },
    };
    const classes = new Set();
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      contains: (name) => classes.has(name),
      toggle(name, force = !classes.has(name)) {
        if (force) classes.add(name);
        else classes.delete(name);
      },
    };
    this.isConnected = true;
    this.textContent = '';
  }
  // Web Animations, recorded in `animations`: each call's keyframes and options, whether it was
  // cancelled; it finishes at once.
  animate(keyframes, options) {
    const a = {
      keyframes,
      options,
      cancelled: false,
      finished: Promise.resolve(),
      cancel() {
        a.cancelled = true;
      },
    };
    (this.animations ??= []).push(a);
    return a;
  }
  focus() {
    FakeElement.focused = this;
  }
  addEventListener(type, callback, options) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push({ callback, once: options?.once, capture: !!options?.capture });
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, callback) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter((x) => x.callback !== callback),
    );
  }
  emit(type, event = {}, phase = null) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      if (phase && listener.capture !== (phase === 'capture')) continue;
      if (!(this.listeners.get(type) ?? []).includes(listener)) continue;
      if (listener.once) this.removeEventListener(type, listener.callback);
      listener.callback({ target: this, ...event });
    }
  }
  // An event dispatched to a page element, seen from window: capture listeners, then the page's
  // own handler on the target (ChatGPT's submit), then bubble listeners, each list read afresh.
  dispatch(type, event = {}, atTarget = () => {}) {
    this.emit(type, event, 'capture');
    atTarget();
    this.emit(type, event, 'bubble');
  }
  prepend(child) {
    child.parentElement = this;
    this.children.unshift(child);
  }
  append(...children) {
    for (const child of children) {
      if (typeof child === 'string') continue; // text: no element to look up
      child.parentElement = this;
      this.children.push(child);
    }
  }
  replaceChildren(...children) {
    this.children = [];
    children.forEach((child) => this.append(child));
  }
  get firstChild() {
    return this.children[0];
  }
  remove() {
    this.parentElement.children = this.parentElement.children.filter((x) => x !== this);
  }
  setAttribute(name, value) {
    this.attributes.set(name, value);
  }
  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }
  hasAttribute(name) {
    return this.attributes.has(name);
  }
  removeAttribute(name) {
    this.attributes.delete(name);
  }
  toggleAttribute(name, force) {
    if (force) this.setAttribute(name, '');
    else this.removeAttribute(name);
  }
  contains(el) {
    return this === el || this.children.some((child) => child.contains(el));
  }
  closest(selector) {
    if (selector === '.thread-scroll-container' && this.className === 'thread-scroll-container')
      return this;
    if (selector === 'form' && this.tagName === 'form') return this;
    if (this.matchesClass(selector) || this.matchesTag(selector)) return this;
    if (selector === '.ProseMirror[contenteditable="true"]' && this.className === 'ProseMirror')
      return this;
    if (
      selector === '[data-testid="send-button"], #composer-submit-button, button[type="submit"]' &&
      (this.getAttribute('data-testid') === 'send-button' || this.getAttribute('type') === 'submit')
    )
      return this;
    return this.parentElement?.closest(selector) ?? null;
  }
  // Tag names, alone or in a list ("input, textarea, select"), and `[role="button"]` in one.
  matchesTag(selector) {
    return (
      /^([a-z]+|\[role="button"\])(, ([a-z]+|\[role="button"\]))*$/.test(selector) &&
      selector
        .split(', ')
        .some((s) =>
          s === '[role="button"]' ? this.getAttribute('role') === 'button' : s === this.tagName,
        )
    );
  }
  // Class selectors, alone or in a list (".go, .x"), on the class name the rail sets.
  matchesClass(selector) {
    return (
      /^\.[\w-]+(, \.[\w-]+)*$/.test(selector) &&
      selector.split(', ').some((c) => `${this.className ?? ''}`.split(' ').includes(c.slice(1)))
    );
  }
  querySelectorAll(selector) {
    return this.children.flatMap((child) => [
      ...((selector === '[data-turn-key]' && child.getAttribute('data-turn-key')) ||
      child.matchesClass(selector)
        ? [child]
        : []),
      ...child.querySelectorAll(selector),
    ]);
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.closest(selector) === child) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
  attachShadow() {
    // Only the rail's static template needs lookup; dynamic buttons use append/firstChild.
    const elements = new Map();
    this.shadowRoot = {
      querySelector(selector) {
        if (!elements.has(selector)) elements.set(selector, new FakeElement());
        return elements.get(selector);
      },
    };
    return this.shadowRoot;
  }
}

// ResizeObserver and IntersectionObserver stand-ins. Each instance records its callback, options
// and observed elements; `resize(target)` calls every ResizeObserver watching `target`, and
// `intersect(observer, entries)` calls one IntersectionObserver.
export function fakeObservers() {
  const resizeObservers = [],
    intersectionObservers = [];
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.observed = new Set();
      resizeObservers.push(this);
    }
    observe(el) {
      this.observed.add(el);
    }
    unobserve(el) {
      this.observed.delete(el);
    }
    disconnect() {
      this.observed.clear();
    }
  }
  class IntersectionObserver {
    constructor(callback, options) {
      this.callback = callback;
      this.options = options;
      this.observed = new Set();
      this.log = []; // ['observe' | 'unobserve', el], in order
      this.disconnected = false;
      intersectionObservers.push(this);
    }
    observe(el) {
      this.observed.add(el);
      this.log.push(['observe', el]);
    }
    unobserve(el) {
      this.observed.delete(el);
      this.log.push(['unobserve', el]);
    }
    disconnect() {
      this.observed.clear();
      this.disconnected = true;
    }
  }
  return {
    ResizeObserver,
    IntersectionObserver,
    resizeObservers,
    intersectionObservers,
    resize(target, width = 1000) {
      for (const observer of [...resizeObservers])
        if (observer.observed.has(target)) observer.callback([{ target, contentRect: { width } }]);
    },
  };
}
