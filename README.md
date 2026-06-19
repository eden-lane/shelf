# Bookmarks

A self-hosted bookmarks app, currently bootstrapped as a runnable product shell with API health checks, local services, and a worker heartbeat.

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
- Bun background worker
- Postgres
- Redis queue backend
- Meilisearch search service
- MinIO object-storage-compatible service

The oRPC endpoint is mounted at `http://localhost:3000/rpc`.

MinIO is available at [http://localhost:9001](http://localhost:9001) using the credentials from `.env.example`.

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

Run services outside Docker when you already have dependencies available:

```sh
bun run dev:api
bun run dev:worker
bun run dev:web
```

For non-Docker local runs, create a `.env` from `.env.example` and point service URLs at your local service hosts.
