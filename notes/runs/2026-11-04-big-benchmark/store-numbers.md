# Candidate store numbers

Paused/resumed benchmark; original baseline r1 captures reused by explicit authorization. Read [report.md](report.md) for fixture, readiness and instrumentation caveats.

Use only complete, valid rows below. New lab measurements; do not substitute old published numbers.

## Page frozen during an answer

Exact source: `stream-loafBlockMs` — 2. Streaming the recorded answer, Total long-animation-frame blocking duration.

- none: about 76.43 s (median of 6 runs; range 75.83–78.25 s; lab Linux Chromium, no GPU acceleration).
- alpha9: about 10.98 s (median of 6 runs; range 7.64–14.59 s; lab Linux Chromium, no GPU acceleration).
- latest: about 11.53 s (median of 6 runs; range 10.17–13.41 s; lab Linux Chromium, no GPU acceleration).

## Slowest keystroke while it answers

Exact source: `stream-keyMax` — 3. Typing while an answer streams, Slowest keydown → next painted frame.

- none: about 0.27 s (median of 6 runs; range 0.25–0.33 s; lab Linux Chromium, no GPU acceleration).
- alpha9: about 0.20 s (median of 6 runs; range 0.17–0.21 s; lab Linux Chromium, no GPU acceleration).
- latest: about 0.20 s (median of 6 runs; range 0.19–0.32 s; lab Linux Chromium, no GPU acceleration).

## Dragging back to a part read earlier this session, classic scrollbar

Exact source: `drag-classic-warm-releaseReadableMs` — 6. Scrollbar drag: Already seen this session, Release → readable.

- none: about 0.05 s (median of 5 runs; range 0.05–0.08 s; lab Linux Chromium, no GPU acceleration).
- alpha9: about 0.23 s (median of 5 runs; range 0.23–1.90 s; lab Linux Chromium, no GPU acceleration).
- latest: about 1.17 s (median of 5 runs; range 1.15–3.76 s; lab Linux Chromium, no GPU acceleration).

## Dragging back to a part read in an earlier session, after reload, classic scrollbar

Exact source: `drag-classic-stored-releaseReadableMs` — 6. Scrollbar drag: Seen in an earlier session, after reload, Release → readable.

- none: n/a — no saved-layout feature.
- alpha9: n/a — no saved-layout feature.
- latest: about 1.53 s (median of 5 runs; range 1.43–1.99 s; lab Linux Chromium, no GPU acceleration).

## Dragging back to a part read earlier this session, overlay scrollbar

Exact source: `drag-overlay-warm-releaseReadableMs` — 6. Scrollbar drag: Already seen this session, Release → readable.

- none: about 0.22 s (median of 5 runs; range 0.21–0.26 s; lab Linux Chromium, no GPU acceleration).
- alpha9: about 0.15 s (median of 5 runs; range 0.15–0.16 s; lab Linux Chromium, no GPU acceleration).
- latest: about 1.33 s (median of 5 runs; range 1.33–1.41 s; lab Linux Chromium, no GPU acceleration).

“Frozen” means the sum of long-animation-frame blocking durations over the replay measurement window, not one continuous freeze. Keystroke response is keydown-to-next-frame, including rendering. Dragging readiness uses the definitions and fixture in report.md. Do not advertise a universal speedup; the benchmark differs from typical user hardware and the original published run.
