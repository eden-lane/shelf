import { createApp } from "./app";
import { SavedItemEnrichmentWorker, RedisSavedItemEnrichmentQueue } from "./savedItemEnrichmentQueue";
import { createRuntimeClients } from "./clients";
import { getConfig } from "./config";

const config = getConfig();
const clients = createRuntimeClients({
  databaseUrl: config.databaseUrl,
  redisUrl: config.redisUrl,
  meilisearchUrl: config.meilisearchUrl,
  meilisearchMasterKey: config.meilisearchMasterKey
});

const app = createApp({
  savedItemEnrichmentQueue: new RedisSavedItemEnrichmentQueue(clients.redis),
  dependencies: clients,
  savedItemSearchIndex: clients.savedItemSearchIndex,
  authMode: config.authMode,
  registrationMode: config.registrationMode,
  allowedOrigins: config.allowedOrigins,
  sessionCookieSecure: config.sessionCookieSecure,
  staticDir: config.staticDir
});
const savedItemEnrichmentWorker = new SavedItemEnrichmentWorker({
  db: clients.db,
  redis: clients.redis,
  savedItemSearchIndex: clients.savedItemSearchIndex
});

savedItemEnrichmentWorker.start();

Bun.serve({
  port: config.port,
  fetch: app.fetch
});

console.log(`API listening on http://localhost:${config.port}`);

const shutdown = async () => {
  await savedItemEnrichmentWorker.stop();
  await clients.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
