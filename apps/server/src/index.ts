import { createDatabaseIntegrationsStore, OAuthGitHubClient } from "@shelf/api/integrations";
import { createDatabaseSavedItemsStore } from "@shelf/api/savedItems";
import { createApp } from "./app";
import { createRuntimeClients } from "./clients";
import { getConfig } from "./config";
import {
  RedisSavedItemEnrichmentQueue,
  SavedItemEnrichmentWorker,
} from "./savedItemEnrichmentQueue";

const config = getConfig();
const clients = createRuntimeClients({
  databaseUrl: config.databaseUrl,
  redisUrl: config.redisUrl,
  meilisearchUrl: config.meilisearchUrl,
  meilisearchMasterKey: config.meilisearchMasterKey,
});

const app = createApp({
  savedItemEnrichmentQueue: new RedisSavedItemEnrichmentQueue(clients.redis),
  dependencies: clients,
  savedItemSearchIndex: clients.savedItemSearchIndex,
  authMode: config.authMode,
  registrationMode: config.registrationMode,
  appOrigin: config.appOrigin,
  allowedOrigins: config.allowedOrigins,
  oauth: config.oauth,
  githubOAuth: config.githubOAuth,
  sessionCookieSecure: config.sessionCookieSecure,
  staticDir: config.staticDir,
});
const githubClient = new OAuthGitHubClient(config.githubOAuth);
const integrationsStore = createDatabaseIntegrationsStore(clients.db, githubClient);
const savedItemsStore = createDatabaseSavedItemsStore(clients.db);
const savedItemEnrichmentWorker = new SavedItemEnrichmentWorker({
  db: clients.db,
  redis: clients.redis,
  savedItemSearchIndex: clients.savedItemSearchIndex,
});
const integrationsSyncInterval = setInterval(
  () => {
    void integrationsStore
      .syncDueGitHubStars()
      .then(async (results) => {
        const savedItemIds = results.flatMap((result) => result.savedItemIds);

        if (savedItemIds.length > 0) {
          const documents = await savedItemsStore.listSavedItemSearchDocuments({ savedItemIds });
          await clients.savedItemSearchIndex.upsert(documents);
        }
      })
      .catch((error: unknown) => {
        console.error("Scheduled integration sync failed", error);
      });
  },
  30 * 60 * 1000,
);

savedItemEnrichmentWorker.start();

Bun.serve({
  port: config.port,
  fetch: app.fetch,
});

console.log(`API listening on http://localhost:${config.port}`);

const shutdown = async () => {
  clearInterval(integrationsSyncInterval);
  await savedItemEnrichmentWorker.stop();
  await clients.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
