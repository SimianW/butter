# Store-listing numbers (latest = Butter 0.1.0-alpha.10+next.2, commit 6e83623)

All from `results.json`: 5 interleaved runs per build, lab machine (i5-10400, software rendering via llvmpipe, Chromium 156, headed Xvfb). Format is median [min–max], n. Each number compares Butter with **no extension** on the same machine, the same frozen long-chat fixture and the same recorded answer. These are not measurements of user hardware.

1. **Streaming a long answer: about 83% less main-thread blocking.**
   - Metric: sum of long-animation-frame `blockingDuration`, from Enter until 5 s after a 189-chunk recorded answer finishes streaming into a long (9-question, math-heavy) chat.
   - No extension 75.2 s [74.8–85.4] n=5 → Butter 12.9 s [12.8–13.1] n=5.

2. **Smoother frames while it streams: p95 frame time 300 ms → 50 ms.**
   - Metric: p95 of requestAnimationFrame intervals over the same window.
   - No extension 300 [300–317] n=5 → Butter 50.0 [50.0–50.0] n=5.

3. **Typing stays responsive in a long chat: slowest keystroke 5.4 s → 0.47 s.**
   - Metric: slowest keydown → next painted frame while typing 54 characters (80 ms apart) in the settled chat, with no stream.
   - No extension 5447 ms [2802–7418] n=5 → Butter 467 ms [460–722] n=5.

4. **Sending from far up a long chat: new question visible in 4.1 s instead of 12.2 s.**
   - Metric: Enter → the new question inside the readable viewport, starting from the earlier half of the chat. Locally replayed response; nothing was sent to the server.
   - No extension 12164 ms [10597–19217] n=5 → Butter 4060 ms [4052–4080] n=5.

5. **Dragging the scrollbar through unread history: no hitching while held.**
   - Metric: p95 frame time while the classic scrollbar thumb is held and dragged into never-opened history (12-question chat).
   - No extension 3083 ms [2817–3233] n=5 → Butter 33.4 ms [16.8–117] n=5. Turns mounted while held: 7 → 0.

Optional, Butter-only feature: **history rail jump to the first question in 2.6 s** (click → `[t01]` readable). 2612 ms [1963–3263] n=5. There is no no-extension equivalent.

## Do not claim

- **Anything "faster than the previous version" for streaming or typing.** Compared with alpha.9, latest is slower: stream blocked time 12.9 s vs 8.0 s, longest freeze 1.32 s vs 0.70 s, typing p95 during a stream 213 vs 185 ms, and the longest task at stream completion 1141 vs 578 ms.
- **That Butter removes the hitch at the end of an answer.** The longest task at completion is 1141 ms [1127–1236], no better than no extension (1159 ms [1128–1228]).
- **That a scrollbar drag "arrives" or becomes readable faster.** After release, latest needs 4.6 s [4.5–10.5] (never opened) and 1.5 s [1.0–1.8] (seen). Native scrolling shows text sooner but at a different question, and the readiness signals differ. Claim only the while-held smoothness. 2 of 5 classic never-opened drags hit the seek deadline.
- **Faster opening of a chat.** First text appears at the same time (~3.6 s for all builds). Only "settled" differs (11.4 → 8.7 s), and that is a harness-defined state.
- **Smoother wheel scrolling as a headline.** The p95 frame is 167 → 150 ms, a small change. The longest frame is 3.4 → 2.5 s.
- **Smoother loading of earlier history.** latest's frame p95 is worse than no extension (117 vs 50 ms). Only the longest frame is better.
- **Any absolute figure as typical user experience.** This is a software-rendered lab machine.
- **Any "×-times faster" figure built from release→readable or from different destinations.**
