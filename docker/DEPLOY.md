# Docker Deployment

## Upload Layout

Upload only the following content to the server:

```text
/home/fuck-working/
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
    api.env.example
    openresty/
      conf.d/
        my.conf
```

Do not upload `api/src`, `web/src`, workspace root source files, or lockfiles when deploying this runtime layout.

## Backend Runtime Env

Create `/home/fuck-working/api/.env` from `docker/api.env.example`.

Required runtime keys:

- `PORT`
- `CORS_ORIGIN`
- `VAPID_SUBJECT`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `DEEPSEEK_API_KEY`
- `DEEPSEEK_MODEL`

## Start

Run Docker Compose from `/home/fuck-working/docker`:

```bash
docker compose up -d
```
