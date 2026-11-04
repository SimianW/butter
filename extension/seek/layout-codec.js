// Geometry wire format. Explicit allowlists keep source text and credentials off disk.
((root) => {
  const hash = (s) => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
  const numeric = (x) => typeof x === 'number' && Number.isFinite(x);
  const css = (s) =>
    typeof s === 'string' &&
    s.length <= 2048 &&
    !/url\s*\(|[{}<>]|content\s*:|var\s*\(/i.test(s) &&
    s
      .split(';')
      .every(
        (p) =>
          !p ||
          /^(font|padding|border-radius|background|color|text-align):[-\w\s.,()%#"'/]+$/.test(p),
      );
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
      numeric(x.time) &&
      Array.isArray(x.metrics) &&
      x.metrics.length === 7 &&
      x.metrics.every(numeric) &&
      Array.isArray(x.blocks) &&
      x.blocks.length > 0 &&
      x.blocks.every((n) => numeric(n) && n > 0) &&
      Array.isArray(x.styles) &&
      x.styles.every(css) &&
      Array.isArray(x.items) &&
      x.items.every(
        (i) =>
          Array.isArray(i) &&
          i.length === 8 &&
          i.slice(0, 7).every(numeric) &&
          [0, 1].includes(i[4]) &&
          Number.isInteger(i[5]) &&
          i[5] >= 0 &&
          i[5] < x.styles.length &&
          Number.isInteger(i[6]) &&
          Array.isArray(i[7]) &&
          i[7].every(
            (m) => Array.isArray(m) && m.length === 4 && m.every(numeric) && [0, 1].includes(m[2]),
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
