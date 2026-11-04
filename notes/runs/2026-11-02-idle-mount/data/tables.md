## Measured results

All time values are milliseconds unless stated. Entries show the median of run-level values and observed range. Ranges are not confidence intervals. “Pruned” means unmeasured after failure, never zero. Hidden/shrink share idle growth and pre-stream drag behavior; their difference is tested during streaming.

### Background preparation

| Arm | Runs | Max task | Max LoAF | LoAF blocking | Scheduled full-growth time, s | Final-mount time, s | Decision |
|---|---:|---:|---:|---:|---:|---:|---|
| normal | 1 | 1525 [1525–1525] | 1609 [1609–1609] | 7938 [7938–7938] | 14.3 [14.3–14.3] | 12.3 [12.3–12.3] | fails absolute task gate if above 100 |
| transition | 3 | 1353 [1351–1366] | 1433 [1425–1446] | 7394 [6768–7409] | 14.4 [14.3–16.1] | 12.9 [12.9–14.7] | fails absolute task gate if above 100 |
| auto-transition | 3 | 918 [912–951] | 974 [972–997] | 5669 [5550–5933] | 28.3 [28.2–28.3] | 27.1 [27.1–27.2] | fails absolute task gate if above 100 |
| cache-transition | 1 | 253 [253–253] | 888 [888–888] | 766 [766–766] | 12.7 [12.7–12.7] | 10.2 [10.2–10.2] | fails absolute task gate if above 100 |
| staged v1 | stopped screen | 276 | 1148 | 951 | incomplete | incomplete | pruned: task/frame target failure |
| staged v2 | stopped screen | 229 | 851 | 494 | incomplete | incomplete | pruned: task/frame target failure |

Control has no background expansion. Cold growth begins with estimated heights; see each raw run for initial/end geometry. The task gate is `node gate.mjs <growth-json>`, which fails nonzero on the recorded task limit.

### Typing and scrolling during the real idle gate

| Arm | Runs | Worst key-to-paint | Key p95 | Max task | Max frame | Worst wheel command acknowledgment | New growth steps per run |
|---|---:|---:|---:|---:|---:|---:|---|
| control | 3 | 62 [39–148] | 32 [30–57] | 54 [0–138] | 100 [83–117] | 21 [19–23] | 0, 0, 0 |
| best | 3 | 612 [584–998] | 40 [28–44] | 637 [612–949] | 667 [633–1033] | 23 [23–26] | 3, 2, 2 |

Key-to-paint is the recorded rAF-plus-task approximation. Wheel acknowledgment is driver latency, not a claim of pixel presentation. Both arms include visible typing and small wheel inputs; the prototype additionally grows during pauses.

### Actual native scrollbar input after calibration

| Arm/state | Input | Runs | Worst frame | LoAF blocking | Blank hold | New mounts per run | Height range px |
|---|---|---:|---:|---:|---:|---|---|
| control | fast | 3 | 4216 [2383–4433] | 5702 [3635–5715] | 2033 [1750–4216] | 6, 6, 5 | 312992–312992 |
| control | slow | 3 | 3183 [3183–3350] | 8729 [8632–8856] | 11300 [9600–11666] | 8, 8, 8 | 312992–312992 |
| all retained | fast | 3 | 250 [183–333] | 215 [31–309] | 1183 [1067–1217] | 0, 0, 0 | 312992–312992 |
| all retained | slow | 3 | 100 [83–467] | 118 [34–1311] | 5050 [4983–6333] | 0, 0, 0 | 312992–312992 |
| all + hold paint | fast screen | 1 | 983 [983–983] | 1170 [1170–1170] | 0 [0–0] | 0 | 312992–312992 |
| incomplete growth | fast screen | 1 | 2983 [2983–2983] | 4659 [4659–4659] | 5433 [5433–5433] | 4 | 312992–312992 |

The hold-paint and incomplete-growth screens are pruned after the observed near/above-second failure; they are not promoted by a small or zero blank-time number. Controls with uncalibrated start position are excluded.

### Same original streaming replay

| Arm | Runs | LoAF blocking | Worst key across repeats | Worst frame | Answer/chunks | Actual retained state |
|---|---:|---:|---:|---:|---|---|
| control | 3 | 5804 [5748–5912] | 476.3 | 600 [583–617] | 043dc8afaf8d/189 | see sampled node/range/hidden counts in results.json |
| hidden | 1 | 43993 [43993–43993] | 935.8 | 1183 [1183–1183] | 043dc8afaf8d/189 | see sampled node/range/hidden counts in results.json |
| shrink | 3 | 6973 [6504–7013] | 844.5 | 750 [650–816] | 043dc8afaf8d/189 | see sampled node/range/hidden counts in results.json |
| quiet-shrink | 3 | 6520 [6438–6925] | 671.5 | 600 [583–650] | 043dc8afaf8d/189 | see sampled node/range/hidden counts in results.json |
| display | 1 | 17797 [17797–17797] | 939.7 | 767 [767–767] | 043dc8afaf8d/189 | see sampled node/range/hidden counts in results.json |

### Stream boundary windows

These two-second windows can include initial/final answer work as well as the mode transition. The separate lifecycle probe below isolates eviction/hide/unhide without an answer.

| Arm | Start-window maximum LoAF | Start-window blocking | End-window maximum LoAF | End-window blocking |
|---|---:|---:|---:|---:|
| hidden | 914 [914–914] | 1291 [1291–1291] | 67 [67–67] | 17 [17–17] |
| shrink | 761 [660–823] | 795 [641–804] | 52 [0–66] | 2 [0–4] |
| quiet-shrink | 644 [640–658] | 648 [647–697] | 57 [53–64] | 2 [0–2] |
| display | 924 [924–924] | 1148 [1148–1148] | 53 [53–53] | 3 [3–3] |

### Automatic regrowth after the stream

| Arm | Runs | Full mount after stream end, s | Max frame | Max LoAF | LoAF blocking during regrowth | Final mounted turns / active elements |
|---|---:|---:|---:|---:|---:|---|
| quiet shrink | 3 | 18.8 [17.8–19.2] | 1450 [1400–1683] | 1454 [1417–1702] | 6397 [5991–7328] | 13/234449, 13/234449, 13/234449 |

### Paired retained memory after forced GC

| Preparation arm | Runs | Active elements before / after | JS heap delta MiB | Embedder heap delta MiB |
|---|---:|---|---:|---:|
| normal | 1 | 62387–62387 / 207410–207410 | 39.4 [39.4–39.4] | 247.1 [247.1–247.1] |
| transition | 3 | 44221–62387 / 207410–207410 | 39.5 [39.4–44.4] | 248.3 [244.6–277.8] |
| auto-transition | 3 | 62387–62387 / 207410–207410 | 39.6 [39.5–39.7] | 245.5 [245.4–245.6] |
| cache-transition | 1 | 127351–127351 / 207410–207410 | 22.2 [22.2–22.2] | 9.8 [9.8–9.8] |

Memory includes renderer allocations and caches; it is not an allocator-only estimate. The cold comparison starts at the same bottom anchor, so its five-turn baseline differs from the earlier reports' near-top five-turn baseline.

### Send landing and first-question rail

| Arm | Local sends / visible landings | Send landing time | New question top px | First rail alignment |
|---|---|---:|---|---|
| control | 3 / 3 | 2706 [2613–2941] | 315, 272, 292 | 3/3 pass; wrapper tops 64, 64, 64 |
| best | 3 / 3 | 1163 [1161–1185] | 272, 272, 272 | 3/3 pass; wrapper tops 64, 64, 64 |

### Isolated lifecycle transitions

| Action | Max task | Max LoAF | Max frame | Active turns after |
|---|---:|---:|---:|---:|
| shrink | 179 | 259 | 250 | 3 |
| hidden | 0 | 0 | 17 | 12 |
| unhide | 0 | 0 | 17 | 12 |
| settings-off-cv | 5350 | 5588 | 5583 | 3 |
| settings-off-older | 261 | 272 | 250 | 3 |

Chat switch route: SPA-router. Scrollers after switch: `[]`.

