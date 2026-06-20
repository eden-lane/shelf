# Bookmarks

A self-hosted bookmarks app, currently bootstrapped as a runnable product shell with API health checks and local services.

## Local startup

Requirements:

- Docker with Docker Compose
- Bun 1.2+

Start the full local stack:

```sh
docker compose up --build
```

Open the web app at [http://localhost:5173](http://localhost:5173). The API listens at [http://localhost:3000](http://localhost:3000), and its health endpoint is available at:

```sh
curl http://localhost:3000/health
```

The Compose stack starts:

- React/Vite web app
- Hono/Bun API
- Postgres
- Redis queue backend
- Meilisearch search service
- MinIO object-storage-compatible service

The oRPC endpoint is mounted at `http://localhost:3000/rpc`.

MinIO is available at [http://localhost:9001](http://localhost:9001) using the credentials from `.env.example`.

## Dev identity

The API defaults to `AUTH_MODE=dev` outside production. In this mode, startup creates
one idempotent local user, organization, personal library, organization library, and
default Inbox folders so feature work can rely on real foreign keys before registration
and authorization exist:

- user: `dev@localhost`
- user id: `00000000-0000-4000-8000-000000000001`
- organization: `dev`
- organization id: `00000000-0000-4000-8000-000000000002`
- personal library id: `00000000-0000-4000-8000-000000000003`
- organization library id: `00000000-0000-4000-8000-000000000004`
- personal Inbox folder id: `00000000-0000-4000-8000-000000000005`
- organization Inbox folder id: `00000000-0000-4000-8000-000000000006`

Set `AUTH_MODE=none` to disable the bootstrap.

## Development

Install dependencies:

```sh
bun install
```

Run checks:

```sh
bun test
bun run typecheck
```

Manage database schema changes with Drizzle:

```sh
bun run db:generate
bun run db:migrate
```

Run services outside Docker when you already have dependencies available:

```sh
bun run dev:api
bun run dev:web
```

For non-Docker local runs, create a `.env` from `.env.example` and point service URLs at your local service hosts.
