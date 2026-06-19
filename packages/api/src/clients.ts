import Redis from "ioredis";
import pg from "pg";
import { createDatabase, type Database } from "./db";
import type {
  DatabaseHealthClient,
  QueueHealthClient,
  SearchHealthClient
} from "./health";

const { Pool } = pg;

export class PostgresDatabaseHealthClient implements DatabaseHealthClient {
  constructor(private readonly pool: pg.Pool) {}

  async check(): Promise<void> {
    await this.pool.query("select 1");
  }
}

export class RedisQueueHealthClient implements QueueHealthClient {
  constructor(private readonly redis: Redis) {}

  async check(): Promise<void> {
    const response = await this.redis.ping();
    if (response !== "PONG") {
      throw new Error(`Unexpected Redis ping response: ${response}`);
    }
  }
}

export class MeilisearchHealthClient implements SearchHealthClient {
  constructor(private readonly baseUrl: string) {}

  async check(): Promise<void> {
    const response = await fetch(new URL("/health", this.baseUrl));
    if (!response.ok) {
      throw new Error(`Meilisearch health returned ${response.status}`);
    }

    const body = (await response.json()) as { status?: string };
    if (body.status !== "available") {
      throw new Error("Meilisearch is not available");
    }
  }
}

export interface RuntimeClients {
  pool: pg.Pool;
  db: Database;
  redis: Redis;
  database: PostgresDatabaseHealthClient;
  queue: RedisQueueHealthClient;
  search: MeilisearchHealthClient;
  close(): Promise<void>;
}

export const createRuntimeClients = (options: {
  databaseUrl: string;
  redisUrl: string;
  meilisearchUrl: string;
}): RuntimeClients => {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const db = createDatabase(pool);
  const redis = new Redis(options.redisUrl, { lazyConnect: true });

  return {
    pool,
    db,
    redis,
    database: new PostgresDatabaseHealthClient(pool),
    queue: new RedisQueueHealthClient(redis),
    search: new MeilisearchHealthClient(options.meilisearchUrl),
    async close() {
      await Promise.allSettled([pool.end(), redis.quit()]);
    }
  };
};
