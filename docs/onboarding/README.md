# Interface Map：从零理解项目

这套文档面向从未学过 JavaScript 的读者。它从“浏览器到底打开哪个文件”开始，逐步进入数据、地图、行程、存档、工具、测试和历史代码；第一方源码的 2,500 个函数节点都能从目录追到对应解释或台账。

## 第一次阅读

如果你现在只想建立整体认识：

1. 读[第 0 章](./00-zero-to-project.md)，先分清当前入口；
2. 读[第 17 章](./17-project-atlas.md)，看完整架构图和覆盖矩阵；
3. 回到下表，按你关心的功能进入具体章节。

最重要的入口提醒：

```text
当前 Web 权威源码：public/static-site/
根目录 app.js：历史快照
miniprogram/：独立小程序
```

## 完整目录

| 章节 | 主题 | 你会理解什么 |
| --- | --- | --- |
| [第 0 章](./00-zero-to-project.md) | 从零看项目 | 浏览器、JavaScript、模块、入口和目录 |
| [第 1 章](./01-data-and-place-index.md) | 数据与地点索引 | 城市/区县怎样变成可搜索地点 |
| [第 2 章](./02-map-core.md) | 地图核心 | Leaflet、图层、marker、路线和视图 |
| [第 3 章](./03-click-to-trip.md) | 点击到行程 | 一次地点点击怎样穿过模块边界 |
| [第 4 章](./04-city-detail.md) | 城市详情 | 全国、城市、区县三层状态怎样切换 |
| [第 5 章](./05-food-content.md) | 食行记 | 美食数据生成、懒加载、合并和渲染 |
| [第 6 章](./06-trip-plan.md) | 行程领域 | 行程事实、命令、校验、排期和迁移 |
| [第 7 章](./07-trip-editor.md) | 行程编辑器 | HTML、表单、事件委托、焦点和拖放 |
| [第 8 章](./08-trip-archive.md) | 行程存档 | 保存、恢复、分享、备份、导入和回滚 |
| [第 9 章](./09-guide-export.md) | 攻略导出 | 同一模型怎样生成 Markdown 和 HTML |
| [第 10 章](./10-app-bootstrap-data-search.md) | 启动、数据、搜索 | `app.js` 前段总调度 |
| [第 11 章](./11-app-trip-rendering.md) | 行程渲染 | `app.js` 中段行程与推荐接线 |
| [第 12 章](./12-app-archive-events.md) | 存档与事件 | `app.js` 后段恢复、下载和启动 |
| [第 13 章](./13-mini-program.md) | 微信小程序 | 57 个函数和 Web 分叉边界 |
| [第 14 章](./14-tooling-and-deployment.md) | 工具与部署 | Python、TypeScript、Vite、Worker、Nginx |
| [第 15 章](./15-root-legacy-snapshot.md) | 根目录旧站 | 738 个历史节点与当前源码的漂移 |
| [第 16 章](./16-test-architecture.md) | 测试架构 | 203 个用例、665 个函数和覆盖盲区 |
| [第 17 章](./17-project-atlas.md) | 项目总地图 | 2,500 节点总账、查阅路线和改进顺序 |

## 按目标选择路线

- 想最快看懂 Web 主链：0 → 1 → 2 → 3 → 6 → 10 → 11 → 12 → 17。
- 想修改行程功能：6 → 7 → 8 → 9 → 11 → 12 → 16。
- 想更新地图或美食数据：1 → 2 → 4 → 5 → 14 → 16。
- 想理解发布和线上入口：0 → 14 → 15 → 16 → 17。
- 想理解小程序：13，再用 1–3 章对照 Web。

## 验证项目

```powershell
npm test
npm run build
npm run test:browser
```

当前 `npm test` 不包含 Playwright，`npm run build` 也不等于完整 TypeScript 类型检查；具体边界见第 14、16 章。

## 文档使用原则

- 先看图和“为什么”，再看代码语法；
- 遇到函数名时，先确认它属于哪个模块和哪条调用链；
- 台账用于定位，不要求背诵；
- 每次修改同时检查事实模块、界面适配器和测试证据；
- 不确定自己打开的是哪套 Web 时，先回第 15 章核对路径。
