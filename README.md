# 云上工时

pnpm workspace 单仓库，两个应用统一放在 `apps/` 下：

- `apps/api`: NestJS 后端
- `apps/web`: Vue 3 + Vite + PWA 前端

## 启动

先安装依赖：

```bash
pnpm install
```

开发模式：

```bash
pnpm dev      # 后端（apps/api）
pnpm dev:web  # 前端（apps/web）
```

构建：

```bash
pnpm build:api
pnpm build:web
```

## 运行时配置

- 环境变量仅 `PORT`（见 `apps/api/.env.example`）
- 钉钉凭据、推送订阅、LLM 密钥等存放在 `apps/api/data/user-config.json`

## 目录

```text
.
├─ apps
│  ├─ api
│  └─ web
└─ docker
```

前端部署:
https://console.tencentcloud.com/edgeone/pages/project/pages-zhgc59epo10e/index?name=auto-work
