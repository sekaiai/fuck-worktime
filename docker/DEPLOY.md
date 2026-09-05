# Docker Deployment

## Upload Layout

Upload only the following content to the server:

```text
/home/fuck-working/
  apps/
    api/
      dist/
      node_modules/
      data/
      package.json
      .env
    web/
      dist/
  docker/
    docker-compose.yaml
    .env
    openresty/
      conf.d/
        my.conf
```

Do not upload `apps/api/src`, `apps/web/src`, workspace root source files, or lockfiles when deploying this runtime layout.

## Backend Runtime Env

Create `/home/fuck-working/apps/api/.env` from `apps/api/.env.example`.

Required runtime keys:

- `PORT`

Note: DingTalk credentials, push subscriptions, and LLM keys are stored in `apps/api/data/user-config.json` and are not injected via environment variables.

## Start

Run Docker Compose from `/home/fuck-working/docker`:

```bash
docker compose up -d
```
