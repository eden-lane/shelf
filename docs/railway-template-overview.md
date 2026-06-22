# Deploy and Host Shelf

Shelf is a self-hosted saved-link manager with email/password session auth, nested folders, tags, full-text search, favicon storage, and a browser-extension-friendly API.

## About Hosting Shelf

This template deploys Shelf as a single public web/API service backed by Postgres, Redis, and Meilisearch. The app service serves the React frontend and API from the same origin, runs Drizzle migrations before startup, and exposes `/health` for Railway health checks.

After deployment, open the Shelf service URL and create the first account. Registration defaults to `first-user-only`, so signup closes automatically after the first user exists.

## Why Deploy Shelf

Shelf is designed for users who want a self-hosted place to save, organize, and search links without relying on a proprietary bookmark service.

## Common Use Cases

- Save links into folders and tags.
- Search saved links through Meilisearch.
- Use a private self-hosted bookmark manager for personal workflows.
- Connect browser-extension clients to the same API.

## Dependencies for Shelf

Shelf needs a relational database, a Redis-compatible queue backend, and a search index.

### Deployment Dependencies

- Postgres for app data and sessions.
- Redis for background enrichment jobs.
- Meilisearch for saved-link search.
