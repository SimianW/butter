# Butter for ChatGPT

English | [中文](README.zh-CN.md)

ChatGPT on the web is painfully laggy… This is the extension that finally makes it actually work.

![Side by side while a long answer streams: ChatGPT without the extension (left) and with Butter (right)](docs/media/demo-en.gif)

Left: ChatGPT as is. Right: with Butter. Same chat, same answer, same input.
[Full video](docs/media/demo-en.mp4)

## The difference

In a long math chat, while an answer streams in:

| | ChatGPT as is | With Butter |
|---|---|---|
| Page frozen | **75.6 s** | **6.3 s** |
| Scrolling (p95 frame) | 300 ms | 33 ms |
| Slowest keystroke | 3.5 s | 0.8 s |

Works out of the box. No account, no requests of its own. If ChatGPT changes its page, the
extension may stop helping, but it won't break anything. [How it was measured →](docs/benchmarks.md)

## Jump between your questions

![History rail: hovering previews a question, clicking jumps to it](docs/media/rail-en.gif)

A thin rail on the right, one tick per question. Hover to preview, click to jump.
[More →](docs/history-rail.md)

## Install

1. Download the zip from [Releases](https://github.com/SimianW/butter/releases) and unzip it
   somewhere permanent.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → pick the `butter` folder, then reload chatgpt.com.

Chrome, Edge, Brave, Arc (Chromium 95+). [Settings and details →](docs/install.md)

Current version: **0.1.0-alpha.10** ([changelog](CHANGELOG.md)).

## Local storage and privacy

Butter stores settings, layout numbers and typography, hashed message/conversation ids, and content/layout
digests locally in the extension, partitioned by a SHA-256 account hash. No chat text, auth tokens or
cookies are saved; unknown accounts cannot access saved layouts. Layouts expire after 30 days with
a 50 MB cap across accounts. Turning `butter.opts.layout` off clears all saved layouts and stops
persisted reads/writes. [Clear instructions →](docs/development.md#layout-storage-api)

## More

- [How it works](docs/how-it-works.md): what it changes, privacy, known trade-offs
- [Benchmarks](docs/benchmarks.md): full results and method
- [Development](docs/development.md): repo layout, tests, packaging
- [Privacy policy](PRIVACY.md): what it reads, stores and sends

MIT license.
