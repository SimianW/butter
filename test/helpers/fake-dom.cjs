// A small DOM stand-in for dev/sources.js tests: elements with attributes, classes, rects and a
// computed content-visibility, the selectors the diagnostics snippets use (compound simple
// selectors, comma lists, `A > B`, `A B`), and a log of every layout and style read, so a test can
// check that memory was copied before the first one.
const reads = [];
const parse = (compound) => {
  const parts = [];
  const re = /(\*)|([a-z][a-z0-9-]*)|\.([\w-]+)|\[([\w-]+)(?:([*]?=)"([^"]*)")?\]/gi;
  for (const m of compound.matchAll(re))
    parts.push(
      m[1]
        ? () => true
        : m[2]
          ? (el) => el.localName === m[2].toLowerCase()
          : m[3]
            ? (el) => el.classList.contains(m[3])
            : m[5] === '*='
              ? (el) => (el.getAttribute(m[4]) ?? '').includes(m[6])
              : m[5]
                ? (el) => el.getAttribute(m[4]) === m[6]
                : (el) => el.hasAttribute(m[4]),
    );
  return (el) => parts.every((p) => p(el));
};
// Right to left: `A > B` needs B's parent to match A, `A B` an ancestor.
function matcher(selector) {
  const alternatives = selector.split(',').map((alt) => {
    const tokens = alt
      .trim()
      .replace(/\s*>\s*/g, ' > ')
      .split(/\s+/);
    const steps = [];
    for (let i = tokens.length - 1; i >= 0; i--)
      if (tokens[i] !== '>') steps.push({ test: parse(tokens[i]), child: tokens[i - 1] === '>' });
    const from = (el, i) => {
      if (!steps[i].test(el)) return false;
      if (i === steps.length - 1) return true;
      if (steps[i].child) return !!el.parentElement && from(el.parentElement, i + 1);
      for (let a = el.parentElement; a; a = a.parentElement) if (from(a, i + 1)) return true;
      return false;
    };
    return (el) => from(el, 0);
  });
  return (el) => alternatives.some((m) => m(el));
}
class FakeElement {
  constructor(tag, options = {}, children = []) {
    this.localName = tag;
    this.tagName = tag.toUpperCase();
    this.attributes = { ...options.attrs };
    if (options.classes) this.attributes.class = options.classes.join(' ');
    this.text = options.text ?? '';
    this.rect = { top: 0, left: 0, width: 0, height: 0, ...options.rect };
    this.cv = options.cv ?? 'visible';
    this.style = { ...options.style };
    this.client = options.clientWidth;
    Object.assign(this, options.props);
    this.children = [];
    this.parentElement = null;
    for (const child of children) this.append(child);
  }
  append(child) {
    child.parentElement = this;
    this.children.push(child);
    return this;
  }
  get classList() {
    const list = (this.attributes.class || '').split(/\s+/).filter(Boolean);
    return Object.assign(list, { contains: (c) => list.includes(c) });
  }
  get dataset() {
    const out = {};
    for (const [k, v] of Object.entries(this.attributes))
      if (k.startsWith('data-')) out[k.slice(5).replace(/-(\w)/g, (_, c) => c.toUpperCase())] = v;
    return out;
  }
  get childElementCount() {
    return this.children.length;
  }
  get firstElementChild() {
    return this.children[0] ?? null;
  }
  get textContent() {
    return this.text + this.children.map((c) => c.textContent).join('');
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name) {
    return name in this.attributes;
  }
  getAttributeNames() {
    return Object.keys(this.attributes);
  }
  descendants() {
    return this.children.flatMap((c) => [c, ...c.descendants()]);
  }
  querySelectorAll(selector) {
    const match = matcher(selector);
    return this.descendants().filter(match);
  }
  querySelector(selector) {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  matches(selector) {
    return matcher(selector)(this);
  }
  closest(selector) {
    for (let node = this; node; node = node.parentElement) if (node.matches(selector)) return node;
    return null;
  }
  getBoundingClientRect() {
    reads.push(['rect', this.localName]);
    const { top, left, width, height } = this.rect;
    return { top, left, width, height, bottom: top + height, right: left + width };
  }
  get clientWidth() {
    reads.push(['rect', this.localName]);
    return this.client ?? this.rect.width;
  }
}
const el = (tag, options, children) => new FakeElement(tag, options, children);
const getComputedStyle = (node) => {
  reads.push(['style', node.localName]);
  return { contentVisibility: node.cv };
};
module.exports = { el, getComputedStyle, reads };
