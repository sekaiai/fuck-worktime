
作为一个没人权的外包，活一堆工资才几千，真没心思每天去填那工时。

如果你也是云山贵州的外包，也许你也需要这。
自用地址：https://ys.kun123.fun

# 云上工时

钉钉工时填报辅助工具：支持手机号/扫码登录钉钉、周工时填报、AI 生成填报内容、定时自动填充与 Web Push 提醒，前端为可安装的 PWA。

- 后端：`apps/api` —— NestJS 11 + TypeScript（Playwright 驱动钉钉网页端）
- 前端：`apps/web` —— Vue 3 + Vite 6 + TypeScript + PWA
- 包管理：`pnpm@10.8.1` workspace，两个应用统一放在 `apps/` 下

## 目录结构

```text
.
├─ apps/
│  ├─ api/    # NestJS 后端（全局前缀 /api，默认端口 10002）
│  └─ web/    # Vue 3 + Vite PWA 前端
├─ docker/    # 远程部署运行时（Compose、OpenResty 配置，细则见 docker/DEPLOY.md）
└─ .trae/     # 架构文档与变更日志
```

## 本地部署

### 1. 前置要求

- Node.js ≥ 20（NestJS 11 / Vite 6 要求）
- pnpm 10.8.1（可用 `corepack enable` 启用）
- 使用钉钉自动化功能时需安装 Playwright 浏览器：

```bash
cd apps/api && pnpm exec playwright install chromium
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 配置环境变量

```bash
cp apps/api/.env.example apps/api/.env
```

| 变量 | 说明 |
| --- | --- |
| `PORT` | 后端监听端口，默认 `10002` |
| `AI_API_URL` / `AI_API_KEY` / `AI_MODEL` | OpenAI 兼容 AI 服务，用于 AI 生成填报内容 |
| `VAPID_SUBJECT` / `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Web Push 推送必需；密钥对生成：`npx web-push generate-vapid-keys --json` |

钉钉凭据、推送订阅等运行时数据存放于 `apps/api/data/user-config.json`（运行时生成，不纳入版本库）。

### 4. 启动开发服务

```bash
pnpm dev      # 后端，http://localhost:10002（API 前缀 /api）
pnpm dev:web  # 前端，Vite Dev Server
```

开发模式下前端直接请求 `http://localhost:10002/api`（后端 CORS 全开），无需配置代理。

### 5. 构建产物

```bash
pnpm build:api   # 输出 apps/api/dist
pnpm build:web   # 输出 apps/web/dist（构建前执行 vue-tsc 类型检查）
```

## 远程部署

部署拓扑：Web 服务器托管前端静态文件，并将同源 `/api` 反向代理到后端容器（NestJS，容器内 `10002`）。后端镜像基于 Playwright 官方镜像（自带钉钉自动化所需浏览器）。完整细则见 [docker/DEPLOY.md](docker/DEPLOY.md)。

### 1. 构建产物

在本地或 CI 执行：

```bash
pnpm build:api
pnpm build:web
```

### 2. 上传运行时布局

仅上传运行时内容，源码与 lockfile 不上传：

```text
<部署目录>/
├─ apps/api/
│  ├─ dist/          # pnpm build:api 产物
│  ├─ node_modules/  # 生产依赖
│  ├─ data/          # user-config.json 运行时数据
│  ├─ package.json
│  └─ .env           # 由 .env.example 创建
├─ apps/web/
│  └─ dist/          # 前端静态文件
└─ docker/
   ├─ docker-compose.yaml
   ├─ .env
   └─ openresty/
      └─ conf.d/
         └─ my.conf
```

### 3. 后端运行时环境

在服务器上创建 `apps/api/.env`（至少 `PORT`，建议同时配置 AI 与 VAPID 各项）。钉钉凭据等仍存放在 `data/user-config.json`，不通过环境变量注入。

### 4. 启动后端容器

```bash
cd docker
docker compose up -d
```

- 镜像：Playwright `v1.59.1-jammy`，启动命令 `node dist/main.js`
- 固定环境：`NODE_ENV=production`、`TZ=Asia/Shanghai`
- 端口映射：宿主 `10016` → 容器 `10002`
- 注意：`docker-compose.yaml` 中的卷挂载路径需按你的部署目录调整

### 5. 前端托管

将 `apps/web/dist` 交由 Nginx / OpenResty 托管：

- SPA 回退：`location / { try_files $uri /index.html; }`
- 生产前端请求同源相对路径 `/api`，需将 `/api` 反向代理到后端容器（`10002`），配置参考 [docker/openresty/conf.d/my.conf](docker/openresty/conf.d/my.conf)

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm install` | 安装全部依赖 |
| `pnpm dev` | 后端开发模式 |
| `pnpm dev:web` | 前端开发模式 |
| `pnpm build:api` | 构建后端 |
| `pnpm build:web` | 构建前端 |
| `docker compose up -d` | 远程启动后端容器（在 `docker/` 目录下执行） |
