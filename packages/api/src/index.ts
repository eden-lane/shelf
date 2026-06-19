import { createApp } from "./app";
import { createRuntimeClients } from "./clients";
import { getConfig } from "./config";

const config = getConfig();
const clients = createRuntimeClients({
  databaseUrl: config.databaseUrl,
  redisUrl: config.redisUrl,
  meilisearchUrl: config.meilisearchUrl
});

const app = createApp({
  dependencies: clients
});

Bun.serve({
  port: config.port,
  fetch: app.fetch
});

console.log(`API listening on http://localhost:${config.port}`);

const shutdown = async () => {
  await clients.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
