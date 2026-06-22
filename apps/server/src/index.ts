import { createApp } from "./app";
import { BookmarkEnrichmentWorker, RedisBookmarkEnrichmentQueue } from "./bookmarkEnrichmentQueue";
import { createRuntimeClients } from "./clients";
import { getConfig } from "./config";

const config = getConfig();
const clients = createRuntimeClients({
  databaseUrl: config.databaseUrl,
  redisUrl: config.redisUrl,
  meilisearchUrl: config.meilisearchUrl
});

const app = createApp({
  bookmarkEnrichmentQueue: new RedisBookmarkEnrichmentQueue(clients.redis),
  dependencies: clients,
  savedItemSearchIndex: clients.savedItemSearchIndex,
  authMode: config.authMode,
  registrationMode: config.registrationMode,
  allowedOrigins: config.allowedOrigins,
  sessionCookieSecure: config.sessionCookieSecure
});
const bookmarkEnrichmentWorker = new BookmarkEnrichmentWorker({
  db: clients.db,
  redis: clients.redis,
  savedItemSearchIndex: clients.savedItemSearchIndex
});

bookmarkEnrichmentWorker.start();

Bun.serve({
  port: config.port,
  fetch: app.fetch
});

console.log(`API listening on http://localhost:${config.port}`);

const shutdown = async () => {
  await bookmarkEnrichmentWorker.stop();
  await clients.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
