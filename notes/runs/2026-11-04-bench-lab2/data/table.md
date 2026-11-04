| Scenario | Metric | none | alpha9 | latest |
|---|---|---|---|---|
| 1. Open a long chat | Navigation → first readable text (ms) | 3575 [3522–4270] n=5 | 3606 [3530–3642] n=5 | 3566 [3496–3636] n=5 |
| 1. Open a long chat | Navigation → settled (ms) | 11398 [11122–12636] n=5 | 8526 [8464–11081] n=5 | 8670 [8364–9026] n=5 |
| 2. Streaming a recorded answer | Main-thread blocked time (sum of LoAF blockingDuration) (ms) | 75176 [74775–85381] n=5 | 7977 [7454–9060] n=5 | 12907 [12751–13101] n=5 |
| 2. Streaming a recorded answer | Longest freeze (longest long animation frame) (ms) | 2622 [2547–7521] n=5 | 698 [679–729] n=5 | 1321 [1318–1428] n=5 |
| 2. Streaming a recorded answer | Frame time p95 during replay (ms) | 300 [300–317] n=5 | 33.4 [33.3–33.4] n=5 | 50.0 [50.0–50.0] n=5 |
| 2. Streaming a recorded answer | Longest main-thread task at stream completion (ms) | 1159 [1128–1228] n=5 | 578 [558–605] n=5 | 1141 [1127–1236] n=5 |
| 2. Streaming a recorded answer | Longest long animation frame at stream completion (ms) | 1462 [1425–1528] n=5 | 698 [679–729] n=5 | 1321 [1318–1428] n=5 |
| 2. Streaming a recorded answer | Final answer SHA-256 (sha256) | n=5, 1 distinct | n=5, 1 distinct | n=5, 1 distinct |
| <prompt text> | Slowest keydown → next frame (ms) | 304 [280–2215] n=5 | 192 [186–198] n=5 | 222 [220–236] n=5 |
| <prompt text> | Keydown → next frame p95 (ms) | 297 [272–1087] n=5 | 185 [179–187] n=5 | 213 [205–230] n=5 |
| <prompt text> | Input dispatch delay p95 (ms) | 11.9 [10.9–164] n=5 | 6.7 [6.1–7.3] n=5 | 8.2 [8.1–13.4] n=5 |
| <prompt text> | Slowest keydown → next frame (ms) | 5447 [2802–7418] n=5 | 422 [336–617] n=5 | 467 [460–722] n=5 |
| <prompt text> | Keydown → next frame p95 (ms) | 271 [143–2748] n=5 | 162 [156–164] n=5 | 193 [188–383] n=5 |
| <prompt text> | Input dispatch delay p95 (ms) | 19.5 [2.6–21.8] n=5 | 2.2 [2.0–4.1] n=5 | 3.0 [2.0–4.6] n=5 |
| <prompt text> | Frame time p95 (ms) | 167 [167–183] n=5 | 150 [133–183] n=5 | 150 [133–167] n=5 |
| <prompt text> | Longest frame (ms) | 3416 [3366–3483] n=5 | 2583 [2567–2617] n=5 | 2483 [1867–2716] n=5 |
| 6. Scrollbar drag (classic): never opened | Frame time p95 while thumb held (ms) | 3083 [2817–3233] n=5 | 1467 [1317–1900] n=5 | 33.4 [16.8–117] n=5 |
| 6. Scrollbar drag (classic): never opened | Turn mounts while thumb held (count) | 7.0 [7.0–7.0] n=5 | 7.0 [7.0–7.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): never opened | Release → readable (ms) | 141 [131–165] n=5 | 132 [118–395] n=5 | 4638 [4488–10523] n=5 |
| 6. Scrollbar drag (classic): seen this session | Frame time p95 while thumb held (ms) | 167 [167–183] n=5 | 1000 [1000–1200] n=5 | 16.8 [16.8–16.8] n=5 |
| 6. Scrollbar drag (classic): seen this session | Turn mounts while thumb held (count) | 5.0 [5.0–5.0] n=5 | 5.0 [5.0–5.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): seen this session | Release → readable (ms) | 54.6 [52.6–55.3] n=5 | 233 [223–261] n=5 | 1470 [1003–1752] n=5 |
| 6. Scrollbar drag (classic): seen in an earlier session | Frame time p95 while thumb held (ms) | n/a | n/a | 50.1 [33.4–83.3] n=5 |
| 6. Scrollbar drag (classic): seen in an earlier session | Turn mounts while thumb held (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): seen in an earlier session | Release → readable (ms) | n/a | n/a | 2425 [1791–2979] n=5 |
| 6. Scrollbar drag (overlay): never opened | Frame time p95 while thumb held (ms) | 33.4 [33.4–33.4] n=5 | 50.1 [50.0–66.6] n=5 | 16.8 [16.7–16.8] n=5 |
| 6. Scrollbar drag (overlay): never opened | Turn mounts while thumb held (count) | 7.0 [7.0–7.0] n=5 | 7.0 [7.0–7.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): never opened | Release → readable (ms) | 117 [114–122] n=5 | 223 [221–255] n=5 | 4828 [4562–4861] n=5 |
| 6. Scrollbar drag (overlay): seen this session | Frame time p95 while thumb held (ms) | 33.4 [33.4–33.4] n=5 | 50.1 [50.1–50.1] n=5 | 16.7 [16.7–16.8] n=5 |
| 6. Scrollbar drag (overlay): seen this session | Turn mounts while thumb held (count) | 5.0 [5.0–5.0] n=5 | 5.0 [5.0–5.0] n=5 | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): seen this session | Release → readable (ms) | 49.0 [47.2–57.9] n=5 | 130 [126–132] n=5 | 2264 [1561–2394] n=5 |
| 6. Scrollbar drag (overlay): seen in an earlier session | Frame time p95 while thumb held (ms) | n/a | n/a | 16.8 [16.8–16.8] n=5 |
| 6. Scrollbar drag (overlay): seen in an earlier session | Turn mounts while thumb held (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): seen in an earlier session | Release → readable (ms) | n/a | n/a | 4128 [2362–4406] n=5 |
| 6. Scrollbar drag (classic): cold | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–1.0] n=5 |
| 6. Scrollbar drag (classic): warm | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (classic): stored | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): cold | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): warm | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| 6. Scrollbar drag (overlay): stored | Seek hit its internal deadline (1 = yes) (count) | n/a | n/a | 0.0 [0.0–0.0] n=5 |
| <prompt text> | Click → first question readable (ms) | n/a | 3960 [3858–4008] n=5 | 2612 [1963–3263] n=5 |
| <prompt text> | Enter → new question visible (ms) | 12164 [10597–19217] n=5 | 3908 [3871–4053] n=5 | 4060 [4052–4080] n=5 |
| <prompt text> | Frame time p95 while earlier pages load (ms) | 50.1 [50.1–167] n=5 | 83.3 [66.6–117] n=5 | 117 [83.3–167] n=5 |
| <prompt text> | Longest frame while earlier pages load (ms) | 7116 [7066–7166] n=5 | 2317 [2267–2350] n=5 | 2333 [2316–2350] n=5 |
