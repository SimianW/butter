## Input-window frames and recovery

| Variant / input | Input wall ms | p50 ms | p95 ms | max ms | max incl. recovery ms | LoAF count / blocking ms | Mount / unmount |
|---|---:|---:|---:|---:|---:|---:|---:|
| control-fast | 2605 | 33.3 | 1983.3 | 1983.3 | 2233.2 | 9 / 4251.5 | 6/7 |
| control-slow | 14219 | 16.7 | 166.7 | 2599.9 | 2599.9 | 31 / 10348.0 | 11/12 |
| control-wheel | 14513 | 16.7 | 133.3 | 2099.8 | 2099.8 | 50 / 9179.1 | 7/7 |
| control-pagedown | 4869 | 16.7 | 33.4 | 100.0 | 100.0 | 1 / 33.5 | 0/0 |
| control-pagefull | 68517 | 16.7 | 33.4 | 1483.2 | 1483.2 | 21 / 7137.2 | 7/6 |
| control-loading | 1351 | 50.0 | 116.7 | 183.3 | 1500.0 | 14 / 1908.9 | 1/1 |
| all-fast | 1657 | 50.0 | 200.0 | 216.7 | 216.7 | 14 / 662.7 | 0/0 |
| all-warm-fast | 1552 | 33.3 | 66.6 | 166.7 | 166.7 | 3 / 162.6 | 0/0 |
| pause-fast | 1297 | 16.7 | 83.3 | 100.0 | 2383.3 | 9 / 2487.7 | 4/5 |
| all-visible-fast | 1652 | 50.0 | 133.4 | 200.0 | 200.0 | 3 / 213.4 | 0/0 |
| cache-warm-fast | 1551 | 33.3 | 50.0 | 883.3 | 2149.9 | 5 / 3094.3 | 5/7 |

## One-time expansion after history is loaded

| Expansion | New mounted turns | Mount commits | Max LoAF ms | LoAF blocking ms | Max rAF interval ms | Height before / after px |
|---|---:|---:|---:|---:|---:|---:|
| once | 7 | 1 | 4171.7 | 4121.4 | 4183.3 | 312992 / 312992 |
| idle | 7 | 7 | 1224.1 | 4504.4 | 1900.0 | 312992 / 312992 |

## Streaming replay

| Variant | Run | Blocked ms | Frame p95 ms | Max frame ms | Max LoAF ms | Max key ms | Style % | SHA |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| control | 1 | 5748 | 33.3 | 599.9 | 614 | 390.1 | 13.1 | 043dc8afaf8d |
| control | 2 | 5440 | 33.3 | 566.6 | 581 | 384.5 | 13 | 043dc8afaf8d |
| control | 3 | 5675 | 33.3 | 566.6 | 587 | 367.3 | 13.2 | 043dc8afaf8d |
| all | 1 | 54095 | 183.3 | 1366.6 | 1365 | 971.7 | 46.1 | 043dc8afaf8d |
| all | 2 | 43527 | 150 | 1200 | 1202 | 837.5 | 38.6 | 043dc8afaf8d |
| all | 3 | 40431 | 133.3 | 1099.9 | 1111 | 793.7 | 36.8 | 043dc8afaf8d |

control: median blocking 5675 ms; range 5440–5748 ms.


all: median blocking 43527 ms; range 40431–54095 ms.


## Retained memory after forced GC

| Variant | Visible mounted elements | CDP documents / nodes / listeners | JS used MiB | Embedder used MiB | Largest renderer RSS KiB |
|---|---:|---:|---:|---:|---:|
| control | 112153 | 4 / 373412 / 3194 | 182.4 | 190.3 | 997404 |
| all | 207410 | 4 / 366700 / 3072 | 209.1 | 283.7 | 1093836 |

## Simulated far-up send placement

| Variant | Start top px | Trigger to last scroll ms | New question top px | Max forced style/layout ms | Local conversation POSTs |
|---|---:|---:|---:|---:|---:|
| control | 1900 | 3311.3 | 292 | 1699.5 | 1 |
| all | 1900 | 1588.1 | 272 | 560.7 | 1 |

## Content drawn in fast-drag screencasts

| Variant | Captured samples | Blank / partial samples | Blank hold ms | Partial hold ms | Blank overlap with LoAF ms |
|---|---:|---:|---:|---:|---:|
| control-fast | 48 | 20 / 0 | 4749.8 | 0.0 | 4553.6 |
| all-fast | 53 | 33 / 1 | 1333.3 | 266.7 | 1042.2 |
| all-warm-fast | 86 | 54 / 4 | 1283.3 | 83.3 | 226.5 |
| pause-fast | 79 | 48 / 2 | 3516.5 | 83.3 | 2712.8 |
| all-visible-fast | 63 | 0 / 0 | 0.0 | 0.0 | 0.0 |
| cache-warm-fast | 61 | 25 / 3 | 1333.3 | 2183.2 | 875.4 |
