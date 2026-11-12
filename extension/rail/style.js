// Isolated world. The rail's look (`ButterRailStyle`): the CSS text of the rail's shadow root, with
// the trip's fragment (`ButterRailTrip.CSS`) in it. A constant; rail/rail.js puts it in the
// `<style>` it builds. Loads after rail/model.js (the rail's sizes) and rail/trip.js.
(() => {
  const { RAIL_W, PAD, MORE_H, REST } = globalThis.ButterRailModel || require('./model.js');
  const ButterRailTrip = globalThis.ButterRailTrip || require('./trip.js');
  const CSS = `
    :host { all: initial; position: fixed; top: 0; right: 0; width: 0; height: 0; z-index: 20; display: block;
      color: #0d0d0d; font: 13px/1.45 ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, Arial, sans-serif;
      --surface: #fff; --line: rgb(0 0 0 / .08); --muted: #8f8f8f; --streak: rgb(0 0 0 / .09);
      --shadow: 0 10px 30px rgb(0 0 0 / .12), 0 1px 3px rgb(0 0 0 / .08);
      --hoverbg: rgb(0 0 0 / .06); --dot: #d39e10; }
    :host([data-dark]) { color: #ececec; --surface: #2f2f2f; --line: rgb(255 255 255 / .1); --muted: #a3a3a3; --streak: rgb(255 255 255 / .1);
      --shadow: 0 10px 30px rgb(0 0 0 / .5), 0 1px 3px rgb(0 0 0 / .3);
      --hoverbg: rgb(255 255 255 / .08); --dot: #e3c766; }
    .rail { position: absolute; top: 0; right: 0; width: ${RAIL_W}px; box-sizing: border-box; padding: ${PAD}px 6px;
      transform: translate(calc(-1 * var(--r)), var(--y)); opacity: 0; pointer-events: none; will-change: transform;
      transition: opacity .3s; }
    :host([data-on]) .rail { opacity: 1; pointer-events: auto; }
    .pill { position: absolute; inset: 0; border-radius: 14px; background: var(--surface); box-shadow: var(--shadow);
      opacity: 0; transform: scaleX(.4); transform-origin: right center;
      transition: opacity .2s, transform .35s cubic-bezier(.2, .9, .25, 1.15); }
    .rail.hot .pill { opacity: .94; transform: none; }
    button { all: unset; position: relative; display: flex; align-items: center; justify-content: flex-end;
      width: 100%; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    .more { box-sizing: border-box; height: ${MORE_H}px; gap: 3px; padding-right: 2px; }
    .more i { width: 3px; height: 3px; border-radius: 50%; background: currentColor; opacity: .35; transition: opacity .2s; }
    .more:hover i, .more:focus-visible i { opacity: 1; }
    .more.busy i { animation: dots .7s ease-in-out infinite alternate; }
    .more.busy i:nth-child(2) { animation-delay: .15s; }
    .more.busy i:nth-child(3) { animation-delay: .3s; }
    .more[hidden] { display: none; }
    .tick { height: var(--pitch); }
    .tick.busy .bar { animation: busy .7s ease-in-out infinite alternate; }
    @keyframes busy { to { opacity: .25; } }
    @keyframes dots { from { opacity: 1; } to { opacity: .2; } }
    .bar { width: 12px; height: 2px; border-radius: 2px; background: currentColor; opacity: ${REST.o};
      transform-origin: right center; }
    button:focus-visible { outline: 2px solid #10a37f; outline-offset: -1px; border-radius: 4px; }
    .marks { position: absolute; inset: 0; pointer-events: none; }
    .bdot { position: absolute; top: 0; right: 6px; border-radius: 50%; background: var(--dot); pointer-events: none; }
    .bdot.stale { background: transparent; box-shadow: inset 0 0 0 1px var(--dot); }
    .bdot.faint { opacity: .45; }
    .bdot.gone { opacity: 0; transition: opacity .16s; }
    .bdot.new { animation: dot-in .18s cubic-bezier(.2, .8, .2, 1), dot-halo .6s .18s; }
    @keyframes dot-in { from { scale: 0; } }
    @keyframes dot-halo { 50% { box-shadow: 0 0 0 4px color-mix(in srgb, var(--dot) 35%, transparent); } }
    .cardpos { position: absolute; top: 0; right: 0; pointer-events: none;
      transform: translate(calc(-1 * var(--r) - ${RAIL_W + 8}px), var(--cy));
      transition: transform .18s cubic-bezier(.2, .8, .2, 1); }
    .cardpos.instant { transition: none; }
    .card { position: absolute; top: 0; right: 0; box-sizing: border-box; width: max-content; max-width: 320px;
      padding: 9px 12px 10px; border-radius: 12px; background: var(--surface); border: 1px solid var(--line);
      box-shadow: var(--shadow); opacity: 0; transform: translate(10px, -50%) scale(.97); transform-origin: right center;
      transition: opacity .16s, transform .22s cubic-bezier(.2, .8, .2, 1); }
    .card.show { opacity: 1; transform: translate(0, -50%); }
    .meta { font-size: 11px; color: var(--muted); margin-bottom: 2px; font-variant-numeric: tabular-nums; }
    .card:not(.qb) > .bmc, .card.bare > .text { display: none; }
    .card.qb { width: 280px; max-width: 280px; }
    .card.qb.show { pointer-events: auto; }
    .card.qb > .text { -webkit-line-clamp: 2; }
    .bmc { margin-top: 7px; padding-top: 5px; border-top: 1px solid var(--line); }
    .bare .bmc { margin-top: 2px; padding-top: 0; border-top: 0; }
    .rows { margin: 0 -6px; max-height: calc(var(--rows) * (8px + 1.45em)); overflow-y: auto; overscroll-behavior: contain; }
    .it { display: flex; align-items: center; border-radius: 6px; }
    .it:hover, .it:focus-within { background: var(--hoverbg); }
    .it .go { flex: 1; min-width: 0; justify-content: flex-start; gap: 7px; padding: 4px 6px; }
    .tx { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .bmc .it .x { display: none; width: 18px; height: 18px; margin: 0 6px 0 1px; border-radius: 6px; place-items: center;
      justify-content: center;
      color: var(--muted); flex: none; }
    .bmc .it:hover .x, .bmc .it:focus-within .x { display: grid; }
    .bmc .it .x:hover, .bmc .it .x:focus-visible { background: var(--hoverbg); color: inherit; }
    .x svg { width: 10px; height: 10px; }
    .it.stale .go, .it.wait .go { color: var(--muted); }
    .why { font-size: 11px; color: var(--muted); flex: none; }
    .wspin { box-sizing: content-box; width: 10px; height: 10px; margin: 0 10px 0 7px; border-radius: 50%; flex: none;
      border: 1.5px solid var(--muted); border-right-color: transparent; animation: spin .8s linear infinite; }
    .warn { font-size: 11px; color: var(--muted); margin-top: 6px; padding-top: 6px; border-top: 1px solid var(--line); }
    .dot { width: 5px; height: 5px; border-radius: 50%; background: var(--dot); flex: none; }
    .it.stale .dot { background: transparent; box-shadow: inset 0 0 0 1px var(--dot); }
    .it.solo { margin: 0 -6px; align-items: flex-start; }
    .solo .go { align-items: flex-start; }
    .solo .tx { white-space: normal; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical;
      overflow-wrap: anywhere; }
    .solo .dot { margin-top: 7px; }
    .bmc .solo .x { margin-top: 4px; }
    .solo .wspin { margin-top: 7px; }
    .seek-card { max-width: 260px; }
    .seek-card .text { -webkit-line-clamp: 3; }
    .spin { display: inline-block; width: 9px; height: 9px; margin-right: 5px; vertical-align: -1px; border-radius: 50%;
      border: 1.5px solid #c4c4c4; border-top-color: #5d5d5d; animation: spin .8s linear infinite; }
    @keyframes spin { to { transform: rotate(1turn); } }
    .text { display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden;
      white-space: pre-wrap; overflow-wrap: anywhere; }
    ${ButterRailTrip.CSS}
    @media (prefers-reduced-motion: reduce) { .rail, .pill, .cardpos, .card { transition: none; } .spin, .wspin, .tick.busy .bar, .more.busy i, .bdot.new { animation: none; }
      .bdot.gone { transition: none; } }`;
  globalThis.ButterRailStyle = CSS;
  if (typeof module !== 'undefined') module.exports = CSS;
})();
