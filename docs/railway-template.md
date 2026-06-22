# Railway template

Railway templates are created in the Railway dashboard from an existing project or from the template composer. This repo includes the production config needed by the app service:

- `Dockerfile` builds the React app and starts the Bun/Hono server.
- `railway.json` selects the Dockerfile builder, runs Drizzle migrations before boot, and health-checks `/health`.
- The server serves `apps/web/dist` and the API from one public origin.

## Services

Create these services in the Railway project before generating the template:

| Service | Source |
| --- | --- |
| Shelf | GitHub repo, `main` branch |
| Postgres | Railway PostgreSQL |
| Redis | Railway Redis |
| Meilisearch | Docker image `getmeili/meilisearch:v1.14` |

Enable public HTTP networking only on the `Shelf` service. Keep Postgres, Redis, and Meilisearch on Railway private networking.

## Shelf variables

Set these variables on the `Shelf` service:

```sh
AUTH_MODE=session
REGISTRATION_MODE=first-user-only
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
MEILISEARCH_URL=http://${{Meilisearch.RAILWAY_PRIVATE_DOMAIN}}:7700
MEILI_MASTER_KEY=${{Meilisearch.MEILI_MASTER_KEY}}
NODE_ENV=production
```

`APP_ORIGINS` is optional for the default single-service deployment because the server accepts same-origin mutating requests. Set it only when using a separate frontend origin or custom domains that are not forwarded as the request host:

```sh
APP_ORIGINS=https://your-domain.example
```

## Meilisearch storage

Attach a volume to the `Meilisearch` service at `/meili_data` so search indexes survive restarts.

Set these variables on the `Meilisearch` service:

```sh
MEILI_ENV=production
MEILI_MASTER_KEY=<generate a long random secret>
MEILI_MAX_INDEXING_MEMORY=512Mb
MEILI_MAX_INDEXING_THREADS=1
```

Use the same `MEILI_MASTER_KEY` value on the `Shelf` service so it can authenticate search and indexing requests.

## Template settings

In the Railway template composer:

1. Set the `Shelf` root directory to the repository root.
2. Use the `main` branch source URL for the `Shelf` service.
3. Confirm the `Shelf` service uses public HTTP networking.
4. Confirm the `Shelf` health check path is `/health`.
5. Add descriptions for every variable before publishing.
6. Use a 1:1 transparent icon for the template and each service.

The current Railway template is `shelf-template`. The deploy button is:

```md
[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/deploy/shelf-template?utm_medium=integration&utm_source=template&utm_campaign=shelf)
```
