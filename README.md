# 云上工时

项目已初始化为两个独立目录：

- `api`: NestJS 后端
- `web`: Vue 3 + Vite + PWA 前端

## 启动

先分别安装依赖：

```bash
pnpm install
```

开发模式：

```bash
pnpm dev:api
pnpm dev:web
```

## Web Push 配置

后端需要配置以下环境变量：

- `PORT`
- `CORS_ORIGIN`
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

前端可配置：

- `VITE_API_BASE_URL`

## 目录

```text
.
├─ api
└─ web
```
