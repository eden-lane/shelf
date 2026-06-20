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
- Hono/Bun server from `apps/server`
- Postgres
- Redis queue backend
- Meilisearch search service
- MinIO object-storage-compatible service

The oRPC endpoint is mounted at `http://localhost:3000/rpc`.

MinIO is available at [http://localhost:9001](http://localhost:9001) using the credentials from `.env.example`.

## Authentication

The API defaults to `AUTH_MODE=session`. Development uses the same email/password
signup, login, logout, and database-backed httpOnly sessions as production.
Registration is controlled with
`REGISTRATION_MODE=first-user-only | open | closed`; first-user-only allows signup
only while the users table is empty. Mutating cookie-authenticated requests must
come from an allowed origin configured with `APP_ORIGINS`.

Set `AUTH_MODE=none` to disable session auth.

Inbox is implicit: a saved item is in Inbox when its `folder_id` is `null`.

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
