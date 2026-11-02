# Butter for ChatGPT

[English](README.md) | 中文

ChatGPT 网页版实在是太卡了…… 这是一个真正让它好用起来的插件。

![长回答输出时的左右对比：左边是原版 ChatGPT，右边装了 Butter](docs/media/demo-zh.gif)

左边：原版 ChatGPT。右边：装了 Butter。同一个对话、同一段回答、同样的操作。
[完整视频](docs/media/demo-zh.mp4)

## 效果对比

在一个很长的数学对话里，回答正在输出时：

| | 原版 ChatGPT | 装了 Butter |
|---|---|---|
| 页面卡住 | **75.6 秒** | **6.3 秒** |
| 滚动（p95 帧耗时） | 300 ms | 33 ms |
| 最慢的一次按键 | 3.5 秒 | 0.8 秒 |

装上即用。不用登录，插件自己不发任何请求。如果 ChatGPT 改了页面结构，插件可能会失效，但不会弄坏页面。[测试方法和完整报告 →](docs/REPORT.md)

## 在问题之间跳转

![历史导航条：悬停预览问题，点击跳转](docs/media/rail-zh.gif)

右侧一条细细的导航条，每个问题一个刻度。悬停预览，点击跳转。
[详细说明（英文）→](docs/history-rail.md)

## 安装

1. 从 [Releases](https://github.com/SimianW/butter/releases) 下载 zip，解压到一个不会删掉的位置。
2. 打开 `chrome://extensions`，打开右上角的 **开发者模式**。
3. 点 **加载已解压的扩展程序**，选 `butter` 文件夹，然后刷新 chatgpt.com。

支持 Chrome、Edge、Brave、Arc（Chromium 95 及以上）。[设置与更多细节（英文）→](docs/install.md)

当前版本：**0.1.0-alpha.8**（[更新日志](CHANGELOG.md)）。

## 更多

- [测试报告](docs/REPORT.md)：方法、全部结果、与其他插件的对比
- [工作原理](docs/how-it-works.md)（英文）：改了什么、隐私、已知取舍
- [开发](docs/development.md)（英文）：仓库结构、测试、打包

MIT 许可证。
