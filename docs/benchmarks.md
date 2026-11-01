# Benchmarks

## Setup

The same recorded ChatGPT answer is replayed into a 9-turn math chat (~90k DOM nodes) while the
harness scrolls and types. Both runs get identical keyboard and mouse-wheel input.

Lab Chromium 156 on Linux without GPU, so absolute numbers are worse than on a typical laptop;
compare the ratios. Not yet measured on Windows or macOS:
[`lab/measure-console.js`](../lab/measure-console.js) measures it on your own machine.

## Results

| Metric | ChatGPT as is | With Butter |
|---|---|---|
| Main thread blocked during the answer | 75.6 s | 6.3 s |
| Frame time p95 while scrolling | 300 ms | 33 ms |
| Slowest keystroke while typing | 3.5 s | 0.8 s |
| Longest single freeze | 2.1 s | 0.6 s |
| Longest frame scrolling the whole chat | 3.6 s | 0.7 s |

The fully streamed answer is byte-identical with and without the extension.

In the recorded [demo video](media/demo-en.mp4) the page without the extension was frozen for
75.8 s in total during the answer, with Butter for 8.0 s.

## More

- [REPORT.md](REPORT.md): full test report in Chinese, with comparison against other extensions,
  ablations, method and risks. Chinese demo video: [media/demo-zh.mp4](media/demo-zh.mp4).
- [oss-survey.md](oss-survey.md): survey of existing long-chat extensions.
- [`results/`](../results): result tables from every benchmark run.
