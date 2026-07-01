# Travel Map

一个面向中国城市旅行路线规划的交互式地图项目。当前仓库同时保留了网页版和微信小程序版：

- 网页版：基于 `index.html`、`app.js`、`styles.css` 和本地 Leaflet 资源运行。
- 微信小程序版：位于 `miniprogram/`，使用小程序原生 `map` 组件运行。

## 目录结构

```text
.
├── index.html                 # 网页版入口
├── app.js                     # 网页版主逻辑
├── styles.css                 # 网页版样式
├── data/                      # 城市、区县、地铁、火车站等数据
├── vendor/leaflet/            # 本地 Leaflet 静态资源
├── miniprogram/               # 微信小程序源码
└── project.config.json        # 微信开发者工具项目配置
```

## 启动网页版

因为页面会通过 `fetch` 读取 `data/*.json`，建议使用本地静态服务器启动，不建议直接双击 `index.html`。

在项目根目录执行：

```powershell
cd "D:\user\Project\Software\Interface Map"
python -m http.server 4177
```

然后在浏览器打开：

```text
http://127.0.0.1:4177/?v=passenger-stations-1
```

如果本机没有 Python，也可以使用 Node.js：

```powershell
npx serve . -l 4177
```

再打开同一个地址：

```text
http://127.0.0.1:4177/?v=passenger-stations-1
```

## 启动微信小程序版

1. 打开微信开发者工具。
2. 选择“导入项目”。
3. 项目目录选择本仓库根目录：

```text
D:\user\Project\Software\Interface Map
```

4. AppID 可以先使用测试号，正式发布时再替换为自己的小程序 AppID。
5. 导入后点击“编译”。

微信开发者工具会读取 `project.config.json`，其中已经配置：

```json
{
  "miniprogramRoot": "miniprogram/"
}
```

## 主要功能

- 中国城市地图点位展示
- 城市、区县搜索
- 旅游景点简介展示
- 行程链路规划
- 高铁/火车路线估算
- 城市详情视图
- 火车站、地铁线路与地铁站点展示
- 微信小程序原生地图版本

## 常见问题

### 页面打不开或数据没有加载

请确认是通过本地静态服务器访问，而不是直接打开 `index.html`。

推荐地址：

```text
http://127.0.0.1:4177/?v=passenger-stations-1
```

### 端口 4177 被占用

可以换一个端口，例如：

```powershell
python -m http.server 4180
```

然后打开：

```text
http://127.0.0.1:4180/?v=passenger-stations-1
```

### 小程序导入后没有显示

请检查：

- 是否从仓库根目录导入，而不是从 `miniprogram/` 子目录导入。
- 微信开发者工具是否正确读取了 `project.config.json`。
- 是否点击了“编译”。

## 开发说明

网页版是纯静态项目，没有构建步骤；修改后刷新浏览器即可查看效果。

小程序版主要文件：

```text
miniprogram/app.json
miniprogram/pages/index/index.wxml
miniprogram/pages/index/index.js
miniprogram/pages/index/index.wxss
```
