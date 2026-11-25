// A fake of ChatGPT's end pin, written from the behaviour read from ChatGPT's scroll code on
// 2026-11-23 (notes/runs/2026-11-23-seek-pin-cause/report.md, section (a)) and confirmed on
// 2026-11-24 (notes/runs/2026-11-24-rail-jump-gesture/report.md). It proves Butter against that
// model, not against the page.
//
// While the end pin is set and the transcript grows, ChatGPT scrolls the chat to its end (the end
// pull). A script's scrollTop write never changes the pin. The pin changes only on what ChatGPT
// takes for the reader's own scroll gesture:
// - a scrollbar press (a mouse pointerdown whose target is the scroller), then the first scroll
//   event with the chat moved and its height unchanged: a gesture away from the end or toward it;
// - a wheel notch: away from the end (up) clears the pin; toward the end, made at the end while
//   unpinned, scrolls to the end and sets it.
// A gesture's later scroll events in its direction decide the pin: a move away from the end clears
// it, a move toward the end that ends within 24 px of it sets it.
//
// The listeners go on the scroller itself (target phase), as ChatGPT's do. `now()`: the page's
// clock. `pinned`: the pin's first state. `move(top)`: ChatGPT moves the chat (its pull).
export const AT_END = 24;
const GESTURE_MS = 1000; // a gesture with no scroll in its direction for this long is over

export function chatgptEndPin(
  scroller,
  { now, pinned = false, move = (top) => (scroller.scrollTop = top) },
) {
  const dist = () => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
  const end = () => scroller.scrollHeight - scroller.clientHeight;
  let stored = dist(), // the distance from the end at the last scroll event
    press = null, // the scrollbar press: the chat's height and scrollTop when it went down
    gesture = null; // the reader's scroll gesture: { direction: 'away' | 'toward', at }
  const pin = {
    pinned,
    pulls: 0, // how many times ChatGPT pulled the chat to its end
    // ChatGPT's resize observer after the transcript grew (a turn's measured height replaced its
    // estimate, or an answer streamed): pinned, it scrolls to the end; otherwise it keeps the
    // chat's distance from the end, which here leaves the chat where it is.
    grew() {
      if (!pin.pinned || scroller.scrollTop === end()) return;
      pin.pulls++;
      move(end());
      stored = dist();
    },
  };

  scroller.addEventListener('pointerdown', (e) => {
    press = null;
    gesture = null;
    if (e.pointerType === 'mouse' && e.target === scroller)
      press = { height: scroller.scrollHeight, top: scroller.scrollTop };
  });
  for (const type of ['pointerup', 'pointercancel'])
    scroller.addEventListener(type, () => (press = null));

  scroller.addEventListener('scroll', () => {
    const prev = stored,
      d = dist();
    if (press) {
      const p = press;
      press = null;
      if (scroller.scrollHeight === p.height && scroller.scrollTop !== p.top && d !== prev)
        gesture = { direction: d > prev ? 'away' : 'toward', at: now() };
    }
    stored = d;
    if (!gesture) return; // not the reader's scroll: the pin is untouched
    if (now() - gesture.at > GESTURE_MS) {
      gesture = null;
      return;
    }
    const direction = d > prev ? 'away' : d < prev ? 'toward' : null;
    if (direction !== gesture.direction) return;
    gesture.at = now();
    pin.pinned = d < prev && d <= AT_END;
    if (Math.abs(d) < 3) gesture = null;
  });

  scroller.addEventListener('wheel', (e) => {
    if (!e.deltaY) return;
    const direction = e.deltaY < 0 ? 'away' : 'toward';
    if (direction === 'toward' && dist() <= AT_END && !pin.pinned) {
      move(end());
      pin.pinned = true;
      stored = dist();
      return;
    }
    const moved = direction === 'away' ? scroller.scrollTop > 0 : dist() > 0;
    if (direction === 'away' && moved && pin.pinned) pin.pinned = false;
    gesture = moved ? { direction, at: now() } : null;
  });
  return pin;
}
