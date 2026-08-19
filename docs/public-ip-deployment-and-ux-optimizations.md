# 公网 IP 部署流程与产品优化建议

本文档用于后续复用，覆盖两件事：

- 如何把当前旅游地图网页部署到一台带公网 IP 的服务器上。
- 从真实用户角度梳理后续可优化或新增的功能。

当前网页是静态站点，核心发布目录建议使用 `public/static-site/`，里面已经包含 `index.html`、`app.js`、`styles.css`、`data/` 和 `vendor/` 等运行所需资源。

## 一、公网 IP 部署流程

### 1. 选择服务器

推荐准备一台 Linux 云服务器，例如 Ubuntu 22.04 或 24.04。

最低配置建议：

- 1 核 CPU
- 1 GB 内存
- 20 GB 磁盘
- 1 个公网 IPv4
- 安全组开放 `22`、`80`，如果绑定域名并启用 HTTPS，再开放 `443`

注意：

- 如果服务器在中国大陆，正式使用域名访问通常需要备案；只用公网 IP 访问一般不涉及域名备案，但访问体验和可信度会弱一些。
- 只通过公网 IP 访问时，浏览器无法签发常规 HTTPS 证书，通常只能用 `http://公网IP/`。如果要 HTTPS，建议绑定域名。
- 不建议直接暴露本地开发服务器或 `vinext dev`，公网部署应使用 Nginx/Caddy 这类正式 Web 服务托管静态文件。

### 2. 本地确认发布目录

在项目根目录确认静态站点文件存在：

```powershell
cd "D:\user\Project\Software\Interface Map"
Get-ChildItem public\static-site
```

至少应看到：

```text
index.html
app.js
styles.css
data/
vendor/
```

发布前建议做一次基础校验：

```powershell
node --check public\static-site\app.js
```

本地预览：

```powershell
cd "D:\user\Project\Software\Interface Map\public\static-site"
python -m http.server 4177
```

浏览器打开：

```text
http://127.0.0.1:4177/
```

确认地图、搜索、城市详情、文章数据都能正常加载。

### 3. 在服务器安装 Nginx

SSH 登录服务器：

```bash
ssh root@公网IP
```

安装 Nginx：

```bash
apt update
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

确认 Nginx 正常：

```bash
systemctl status nginx
```

浏览器访问：

```text
http://公网IP/
```

如果能看到 Nginx 默认页，说明服务器、80 端口和安全组基本正常。

### 4. 上传静态站点文件

在服务器创建站点目录：

```bash
mkdir -p /var/www/travel-map
```

在本地 PowerShell 中上传文件。推荐使用 `scp`：

```powershell
cd "D:\user\Project\Software\Interface Map"
scp -r public\static-site\* root@公网IP:/var/www/travel-map/
```

如果服务器禁止 root 登录，可改用自己的用户名：

```powershell
scp -r public\static-site\* 用户名@公网IP:/tmp/travel-map/
```

然后在服务器上移动文件：

```bash
sudo mkdir -p /var/www/travel-map
sudo cp -r /tmp/travel-map/* /var/www/travel-map/
sudo chown -R www-data:www-data /var/www/travel-map
```

### 5. 配置 Nginx 静态站点

创建配置文件：

```bash
nano /etc/nginx/sites-available/travel-map
```

写入以下内容，把 `server_name` 改成你的公网 IP：

```nginx
server {
    listen 80;
    server_name 公网IP;

    root /var/www/travel-map;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|json|png|jpg|jpeg|gif|svg|ico|webp)$ {
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
        try_files $uri =404;
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/travel-map /etc/nginx/sites-enabled/travel-map
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

访问：

```text
http://公网IP/
```

### 6. 防火墙与安全组检查

云厂商控制台安全组需要放行：

```text
TCP 80
TCP 443
TCP 22
```

如果服务器启用了 UFW：

```bash
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
ufw status
```

### 7. 绑定域名与 HTTPS

如果后续需要更稳定、更可信的访问体验，建议绑定域名。

DNS 解析：

```text
A 记录
主机记录: @ 或 www
记录值: 公网IP
```

Nginx 的 `server_name` 改成域名：

```nginx
server_name example.com www.example.com;
```

使用 Certbot 签发 HTTPS 证书：

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d example.com -d www.example.com
```

验证自动续期：

```bash
certbot renew --dry-run
```

### 8. 更新发布流程

后续每次改完网页后，按这个顺序发布：

```powershell
cd "D:\user\Project\Software\Interface Map"
node --check public\static-site\app.js
scp -r public\static-site\* root@公网IP:/var/www/travel-map/
```

服务器上重载 Nginx：

```bash
nginx -t
systemctl reload nginx
```

如果只是静态文件更新，通常不需要重启 Nginx。

### 9. 验证清单

发布完成后至少验证：

- `http://公网IP/` 返回 200。
- `http://公网IP/app.js` 返回 200。
- `http://公网IP/data/china-cities.json` 返回 200。
- 手机浏览器、微信内置浏览器、抖音内置浏览器都能打开。
- 地图可以加载，城市点位可以点击。
- 搜索、城市详情、路线规划、文章卡片可以正常使用。
- 开发者工具 Network 面板没有大量 404 或 CORS 报错。

可以用命令快速检查：

```bash
curl -I http://公网IP/
curl -I http://公网IP/app.js
curl -I http://公网IP/data/china-cities.json
```

### 10. Cloudflare 拦截问题说明

之前 `chatgpt.site` 链接在部分移动网络或 App 内置浏览器中出现 Cloudflare `Sorry, you have been blocked`，这是边缘安全策略触发，发生在网页代码加载之前，不是当前网页业务逻辑导致。

规避建议：

- 公网 IP 自建 Nginx 部署可以绕开 `chatgpt.site` 的 Cloudflare 访问路径。
- 如果使用自己的域名并接入 Cloudflare，需要降低 WAF/Bot Fight Mode 对移动 App 内置浏览器的误伤。
- 面向国内用户分发时，建议优先测试微信、抖音、QQ、系统浏览器、移动 5G、联通 5G、电信 5G 等真实环境。

## 二、真实用户视角的优化建议

### P0：最影响核心体验

#### 1. 导出旅游指南

当前导出如果只是数据或路线记录，用户阅读成本偏高。建议把导出内容加工成“可直接使用的旅游指南”。

建议内容结构：

- 封面：路线名称、总天数、城市数量、适合人群。
- 行程总览：每天去哪些城市，主要交通方式，总里程或预计时间。
- 每日安排：上午、下午、晚上分别推荐去哪、吃什么、怎么移动。
- 城市页：城市简介、必吃美食、推荐文章、交通提醒。
- 地图页：路线图、城市点位、关键交通节点。
- 清单页：出发前准备、当地注意事项、预算预估。

导出格式建议：

- `PDF`：适合分享和手机阅读。
- `Markdown`：适合二次编辑。
- `HTML`：适合保留地图和图文样式。

#### 2. 增加时间规划

用户不仅想知道“去哪些地方”，更想知道“第几天去哪、每天怎么排”。

建议新增“按天规划”能力：

- 第 1 天：城市 A、B、C。
- 第 2 天：城市 D、E、F。
- 第 3 天：城市 G，返程或休整。

规划逻辑建议考虑：

- 城市之间距离和交通耗时。
- 每天最多城市数。
- 是否需要同城停留。
- 是否允许夜间交通。
- 是否偏美食、景点、交通效率或轻松游。

交互上可以做成：

- 用户先选择总天数。
- 系统自动把路线拆成每天。
- 用户可以拖拽城市调整天数。
- 每天显示预计交通耗时和游玩余量。

#### 3. 手机端分享体验

真实用户大概率会在手机上打开链接，并转发给朋友。

建议增加：

- 分享标题、描述和封面图。
- 一键复制路线链接。
- 长图分享，包含路线概览和每日安排。
- 微信/抖音内置浏览器兼容测试。
- 链接打不开时给出备用入口或提示。

### P1：增强决策与信任

#### 4. 城市详情内容升级

城市详情可以从“信息展示”升级为“旅行决策卡”。

建议增加：

- 推荐停留时长。
- 最适合季节。
- 交通便利度。
- 美食密度。
- 适合人群：亲子、情侣、独行、美食、摄影、自驾。
- 避坑提醒：节假日拥堵、景点预约、天气风险。

#### 5. 路线质量评分

用户需要知道当前路线好不好。

建议增加路线评分：

- 顺路程度。
- 交通可行性。
- 每日强度。
- 美食覆盖度。
- 城市多样性。
- 预算友好度。

评分不需要复杂，先用 `A/B/C` 或 5 星即可。

#### 6. 预算估算

建议按人均估算：

- 城际交通。
- 市内交通。
- 餐饮。
- 住宿。
- 门票。
- 机动费用。

可以先做粗略档位：

- 节省型。
- 均衡型。
- 舒适型。

#### 7. 收藏与继续编辑

用户规划路线往往不是一次完成。

建议增加：

- 本地保存路线。
- 最近打开的路线。
- 收藏城市。
- 收藏文章。
- 导入上次路线继续编辑。

### P2：提升效率和专业感

#### 8. 多路线对比

让用户同时比较两到三条路线：

- 总天数。
- 总距离。
- 城市数量。
- 交通强度。
- 预算。
- 亮点城市。

适合做路线选择和多人讨论。

#### 9. 主题路线模板

建议预置一些路线模板：

- 西北美食线。
- 江南古城线。
- 高铁周末线。
- 亲子轻松线。
- 小众城市线。
- 555 天食行记精选线。

模板能降低新用户的启动成本。

#### 10. 内容来源与可信度

如果城市推荐来自公众号文章或本地数据，建议展示来源和更新时间。

建议增加：

- 文章来源入口。
- 数据更新时间。
- 推荐理由。
- 用户可反馈“信息过期”。

#### 11. 离线与弱网体验

旅游场景经常遇到弱网。

建议增加：

- 加载骨架屏。
- 数据加载失败重试。
- 已打开城市缓存。
- 导出 PDF 后离线查看。

#### 12. 管理后台或数据维护工具

当城市、文章、路线模板越来越多，手工维护会变慢。

建议后续做一个轻量后台：

- 城市信息编辑。
- 文章匹配校正。
- 路线模板维护。
- 推荐标签管理。
- 数据质量检查。

## 三、建议实施顺序

第一阶段先解决“能稳定访问、能读懂、能分享”：

1. 公网 IP 或自有域名稳定部署。
2. 导出旅游指南 PDF/Markdown。
3. 按天拆分行程。
4. 手机端分享信息优化。

第二阶段解决“路线是否好、用户能否决策”：

1. 城市详情旅行决策卡。
2. 路线评分。
3. 预算估算。
4. 收藏与继续编辑。

第三阶段解决“规模化内容和专业体验”：

1. 多路线对比。
2. 主题路线模板。
3. 内容来源与更新时间。
4. 数据维护后台。

## 四、下一步任务拆分建议

可以把近期开发拆成以下任务：

- `deploy-public-ip`: 使用 Nginx 将 `public/static-site/` 部署到公网 IP。
- `export-travel-guide`: 把当前导出改造成旅游指南格式，支持 PDF/Markdown。
- `daily-itinerary-planner`: 增加按天规划和每日城市分组。
- `mobile-share-preview`: 优化分享标题、描述、封面和长图分享。
- `route-quality-score`: 增加路线评分和强度提示。
- `city-decision-card`: 升级城市详情页的信息结构。
