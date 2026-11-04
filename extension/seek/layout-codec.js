// Geometry wire format. Explicit allowlists keep source text and credentials off disk.
((root) => {
  const hash = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  const number = (x, min = 0, max = 10_000_000) =>
    typeof x === 'number' && Number.isFinite(x) && x >= min && x <= max;
  const integer = (x, min, max) => Number.isInteger(x) && number(x, min, max);
  const array = (x, max, check) =>
    Array.isArray(x) && x.length <= max && Object.keys(x).length === x.length && x.every(check);
  const decimal = '(?:0|[1-9]\\d{0,4})(?:\\.\\d{1,6})?';
  const px = `${decimal}px`;
  // A closed family vocabulary prevents a forged font name from carrying chat text. Unknown
  // typography stays warm-only; expanding this list requires an explicit product decision.
  const families = new Set([
    'system-ui',
    'sans-serif',
    'serif',
    'monospace',
    'ui-sans-serif',
    'ui-serif',
    'ui-monospace',
    'Arial',
    'Helvetica',
    'Helvetica Neue',
    'Times New Roman',
    'Courier New',
    'Menlo',
    'Monaco',
    'Consolas',
    'SFMono-Regular',
    'SF Mono',
    'Segoe UI',
    'Apple Color Emoji',
    'Segoe UI Emoji',
    'Segoe UI Symbol',
    'Noto Color Emoji',
    'Noto Sans',
    'Söhne',
    'Söhne Mono',
    'OpenAI Sans',
    'OpenAI Sans Mono',
    'Inter',
    '-apple-system',
    '-apple-system-body',
    'BlinkMacSystemFont',
  ]);
  const font = new RegExp(
    `^(?:(?:normal|italic|oblique) )?(?:(?:normal|bold|[1-9]\\d{0,2}|1000) )?(${px})(?:/(${px}|${decimal}|normal))? (.{1,256})$`,
  );
  const color = (value) => {
    const m = /^(rgb|rgba)\((\d{1,3}), (\d{1,3}), (\d{1,3})(?:, (0|1|0?\.\d{1,6}))?\)$/.exec(value);
    return (
      !!m &&
      m.slice(2, 5).every((n) => +n <= 255) &&
      (m[1] === 'rgba' ? m[5] !== undefined && +m[5] <= 1 : m[5] === undefined)
    );
  };
  const lengths = new RegExp(`^${px}(?: ${px}){0,3}$`);
  const radius = new RegExp(`^${px}(?: ${px}){0,3}(?: / ${px}(?: ${px}){0,3})?$`);
  const css = (s) => {
    if (typeof s !== 'string' || s.length > 1024) return false;
    if (!s) return true;
    const seen = new Set();
    return s.split(';').every((p) => {
      const split = p.indexOf(':');
      const name = p.slice(0, split),
        value = p.slice(split + 1);
      if (split < 1 || !value || value.length > 512 || seen.has(name)) return false;
      seen.add(name);
      if (name === 'font') {
        const m = font.exec(value);
        return (
          !!m &&
          parseFloat(m[1]) > 0 &&
          parseFloat(m[1]) <= 512 &&
          (!m[2] || m[2] === 'normal' || parseFloat(m[2]) <= 2048) &&
          m[3].split(',').length <= 16 &&
          m[3].split(',').every((token) => {
            token = token.trim();
            if (/^(["']).*\1$/.test(token)) token = token.slice(1, -1);
            return families.has(token);
          })
        );
      }
      if (name === 'background' || name === 'color') return color(value);
      if (name === 'padding') return lengths.test(value);
      if (name === 'border-radius') return radius.test(value);
      return (
        name === 'text-align' && /^(start|end|left|right|center|justify|match-parent)$/.test(value)
      );
    });
  };
  const metrics = ['h', 'rowH', 'turnOffset', 'turnH', 'w', 'vw', 'sw'];
  function pack(x) {
    const styles = [],
      indexes = new Map();
    const style = (s = '') => {
      if (!indexes.has(s)) {
        indexes.set(s, styles.length);
        styles.push(s);
      }
      return indexes.get(s);
    };
    return {
      schema: 2,
      account: x.account,
      conv: x.conv,
      turn: x.turn,
      msg: x.msg,
      digest: x.digest,
      layout: x.layout,
      time: x.time,
      metrics: metrics.map((k) => x[k] ?? 0),
      blocks: x.blocks.slice(),
      styles,
      items: x.items.map((i) => [
        i.top,
        i.h,
        i.left,
        i.w,
        +!!i.user,
        style(i.css),
        i.source,
        (i.math || []).map((m) => [m.start, m.end, +!!m.display, m.h]),
      ]),
    };
  }
  function valid(x) {
    return (
      x?.schema === 2 &&
      ['account', 'conv', 'turn', 'msg', 'digest', 'layout'].every((k) => hash(x[k])) &&
      number(x.time, 0, Number.MAX_SAFE_INTEGER) &&
      array(x.metrics, 7, (n) => number(n)) &&
      x.metrics.length === 7 &&
      array(x.blocks, 20_000, (n) => number(n) && n > 0) &&
      x.blocks.length > 0 &&
      array(x.styles, 256, css) &&
      array(
        x.items,
        20_000,
        (i) =>
          array(i, 8, () => true) &&
          i.length === 8 &&
          number(i[0], -10_000_000) &&
          number(i[1]) &&
          number(i[2], -100_000, 100_000) &&
          number(i[3], 0, 100_000) &&
          [0, 1].includes(i[4]) &&
          integer(i[5], 0, x.styles.length - 1) &&
          integer(i[6], -2, 19_999) &&
          array(
            i[7],
            4096,
            (m) =>
              array(m, 4, () => true) &&
              m.length === 4 &&
              integer(m[0], 0, 1_000_000) &&
              integer(m[1], m[0], 1_000_000) &&
              [0, 1].includes(m[2]) &&
              number(m[3]),
          ),
      )
    );
  }
  function unpack(x) {
    return {
      schema: 1,
      account: x.account,
      conv: x.conv,
      turn: x.turn,
      msg: x.msg,
      digest: x.digest,
      layout: x.layout,
      time: x.time,
      ready: true,
      ...Object.fromEntries(metrics.map((k, i) => [k, x.metrics[i]])),
      blocks: x.blocks.slice(),
      items: x.items.map(([top, h, left, w, user, s, source, math]) => ({
        top,
        h,
        left,
        w,
        user: !!user,
        css: x.styles[s],
        source,
        math: math.map(([start, end, display, h]) => ({ start, end, display: !!display, h })),
      })),
    };
  }
  // Canonicalize by round-tripping the allowlist, never spreading page-provided properties.
  const clean = (x) => (valid(x) ? pack(unpack(x)) : null);
  const key = (x) => JSON.stringify([x.account, x.conv, x.turn, x.msg, x.digest, x.layout]);
  const bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
  const api = { pack, unpack, valid, clean, key, bytes, hash };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ButterLayoutCodec = api;
})(globalThis);
