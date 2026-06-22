import { createDatabaseSavedItemsStore } from "@shelf/api/savedItems";
import { createDatabase } from "@shelf/api/db";
import { existsSync } from "node:fs";
import pg from "pg";
import { getConfig } from "./config";
import { MeilisearchSavedItemSearchIndex as ServerMeilisearchSavedItemSearchIndex } from "./savedItemSearchIndex";

const { Pool } = pg;

const config = getConfig();
const pool = new Pool({
  connectionString: hostReachableComposeUrl(config.databaseUrl, {
    postgres: "127.0.0.1"
  })
});
const db = createDatabase(pool);
const savedItemSearchIndex = new ServerMeilisearchSavedItemSearchIndex(
  hostReachableComposeUrl(config.meilisearchUrl, {
    meilisearch: "127.0.0.1"
  }),
  config.meilisearchMasterKey
);

try {
  const store = createDatabaseSavedItemsStore(db);
  const documents = await store.listSavedItemSearchDocuments({});

  await savedItemSearchIndex.replaceAll(documents);
  console.log(`Reindexed ${documents.length} saved items into Meilisearch`);
} finally {
  await pool.end();
}

function hostReachableComposeUrl(value: string, hostnames: Record<string, string>) {
  if (existsSync("/.dockerenv")) {
    return value;
  }

  const url = new URL(value);
  const hostname = hostnames[url.hostname];

  if (hostname) {
    url.hostname = hostname;
  }

  return url.toString();
}
