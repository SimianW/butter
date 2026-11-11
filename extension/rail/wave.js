// Isolated world, no DOM, no frames: the hover wave's progress (`ButterRailWave`), which
// rail/model.js holds. Per tick, keyed by its question: the bar's current scaleX, opacity and
// scaleY, eased each frame toward the targets the model gives (the lit policy and the pointer's
// swell), and whether a frame is still due. test/rail-model.test.mjs covers it through the model.
(() => {
  function ButterRailWave() {
    let ids = [],
      cs = [],
      co = [],
      ct = [],
      last = 0,
      moving = false; // a frame is scheduled
    // A bar's style: `[transform, opacity]`.
    const style = (j) => [`scale(${cs[j].toFixed(3)}, ${ct[j].toFixed(3)})`, co[j].toFixed(3)];
    return {
      // Re-keys the bars to the question ids `next`. A bar's state follows its question, not its
      // slot: an older page adds questions at the top and shifts every slot, which made the lit look
      // slide onto the wrong tick and back. `start(j, kept)` gives bar j's state from its question's
      // kept one (undefined for a new question). Every bar's style.
      carry(next, start) {
        const was = new Map(ids.map((id, j) => [id, [cs[j], co[j], ct[j]]]));
        ids = next;
        cs.length = co.length = ct.length = next.length;
        const out = [];
        for (let j = 0; j < next.length; j++) {
          [cs[j], co[j], ct[j]] = start(j, was.get(ids[j]));
          out.push(style(j));
        }
        return out;
      },
      // A frame must be scheduled from time `now` (true), or one already is (false).
      start(now) {
        if (moving) return false;
        last = now;
        moving = true;
        return true;
      },
      stop() {
        moving = false;
      },
      get moving() {
        return moving;
      },
      // One frame at time `now` toward `target(j)` (`[s, o, t]`): the changed bars' styles
      // (`[j, transform, opacity]`) and whether another frame is due.
      frame(now, target) {
        // A frame's timestamp is when Chrome began it, which can be earlier than the time start()
        // stored while the page was busy. A negative interval made k hugely negative and threw the
        // bars far past their targets: one tick swelled over the whole screen for a few frames.
        const k = 1 - Math.exp(-Math.max(0, Math.min(64, now - last)) / 60);
        last = Math.max(last, now);
        let still = true;
        const bars = [];
        for (let j = 0; j < cs.length; j++) {
          const [s, o, t] = target(j);
          if (
            Math.abs(s - cs[j]) < 0.003 &&
            Math.abs(o - co[j]) < 0.003 &&
            Math.abs(t - ct[j]) < 0.003
          ) {
            if (cs[j] === s && co[j] === o && ct[j] === t) continue;
            cs[j] = s;
            co[j] = o;
            ct[j] = t;
          } else {
            cs[j] += (s - cs[j]) * k;
            co[j] += (o - co[j]) * k;
            ct[j] += (t - ct[j]) * k;
            still = false;
          }
          bars.push([j, ...style(j)]);
        }
        moving = !still;
        return { bars, moving };
      },
      // Bar j's current scaleX (undefined past the bars).
      scale: (j) => cs[j],
    };
  }
  globalThis.ButterRailWave = ButterRailWave;
  if (typeof module !== 'undefined') module.exports = ButterRailWave;
})();
