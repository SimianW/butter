# History rail

![Question rail and current hover card](media/store/screenshot-3-1280x800.png)

A column of ticks at the right edge of the chat, one per question you asked. The lit band marks the
questions in view. The hover card shows the question number and text.

| Action | What happens |
|---|---|
| **Hover** | The ticks around the pointer swell like a wave and a card shows the question. |
| **Click** | The chat jumps to that question and briefly rings it. |
| **Three dots** at the top | Click (or press Enter) to travel to the earliest question, loading older batches behind the moving placeholders. The dots disappear when all history is loaded. One trip loads up to 50 batches (100 older turns) or runs for 60 s; if a limit or a stalled request stops it, it lands on the oldest loaded question and the dots let you continue. |
| **Keyboard** | Tab to the rail, then ↑/↓ and Enter. |

Jumps also work when ChatGPT has unloaded that part of the chat (it keeps only about five turns on
the page). A far jump plays as one continuous fast scroll: the chat scrolls off, placeholder lines
stream past while ChatGPT renders the target, and the chat scrolls in and stops on it.

In the latest lab benchmark, an early-question click took a median 3.3 s with alpha.11 on Linux
Chromium without GPU acceleration. Real timing depends on the destination and what ChatGPT must
load; placeholders keep moving and the clicked tick pulses meanwhile.
[Benchmark method and ranges →](benchmarks.md)

During a scrollbar preview, the rail follows the previewed questions and its card shows loading
progress after release. Turn **Question rail** off in the popup to hide it; scrollbar preview and
the send shortcut continue independently.

The questions come from the conversation data ChatGPT downloads anyway; the rail sends no requests.
