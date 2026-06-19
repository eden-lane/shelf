import { createRuntimeClients } from "./clients";
import { getConfig } from "./config";

const config = getConfig();
const clients = createRuntimeClients({
  databaseUrl: config.databaseUrl,
  redisUrl: config.redisUrl,
  meilisearchUrl: config.meilisearchUrl
});

const writeHeartbeat = async () => {
  await clients.worker.writeHeartbeat(config.workerName);
  console.log(`Worker heartbeat written for ${config.workerName}`);
};

await writeHeartbeat();

const interval = setInterval(writeHeartbeat, config.workerHeartbeatIntervalMs);

const shutdown = async () => {
  clearInterval(interval);
  await clients.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
