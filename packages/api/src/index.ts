import { createApp } from "./app";
import { createRuntimeClients } from "./clients";
import { getConfig } from "./config";
import { ensureDevIdentity, type DevIdentity } from "./devIdentity";

const config = getConfig();
const clients = createRuntimeClients({
  databaseUrl: config.databaseUrl,
  redisUrl: config.redisUrl,
  meilisearchUrl: config.meilisearchUrl
});

let currentUser: DevIdentity | undefined;

if (config.authMode === "dev") {
  currentUser = await ensureDevIdentity(clients.pool);
  console.log(
    `Dev identity ready: ${currentUser.email} (${currentUser.userId}) in ${currentUser.organizationSlug}`
  );
}

const app = createApp({
  dependencies: clients,
  currentUser
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
