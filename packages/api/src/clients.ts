import Redis from "ioredis";
import pg from "pg";
import type {
  DatabaseHealthClient,
  QueueHealthClient,
  SearchHealthClient,
  WorkerHeartbeatStore
} from "./health";

const { Pool } = pg;

export const workerHeartbeatTableSql = `
  create table if not exists worker_heartbeats (
    worker_name text primary key,
    checked_at timestamptz not null default now()
  )
`;

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

export class PostgresWorkerHeartbeatStore implements WorkerHeartbeatStore {
  constructor(private readonly pool: pg.Pool) {}

  async ensureSchema(): Promise<void> {
    await this.pool.query(workerHeartbeatTableSql);
  }

  async getLastHeartbeat(workerName: string): Promise<Date | null> {
    await this.ensureSchema();
    const result = await this.pool.query<{ checked_at: Date }>(
      "select checked_at from worker_heartbeats where worker_name = $1",
      [workerName]
    );

    return result.rows[0]?.checked_at ?? null;
  }

  async writeHeartbeat(workerName: string): Promise<void> {
    await this.ensureSchema();
    await this.pool.query(
      `
        insert into worker_heartbeats (worker_name, checked_at)
        values ($1, now())
        on conflict (worker_name)
        do update set checked_at = excluded.checked_at
      `,
      [workerName]
    );
  }
}

export interface RuntimeClients {
  pool: pg.Pool;
  redis: Redis;
  database: PostgresDatabaseHealthClient;
  queue: RedisQueueHealthClient;
  search: MeilisearchHealthClient;
  worker: PostgresWorkerHeartbeatStore;
  close(): Promise<void>;
}

export const createRuntimeClients = (options: {
  databaseUrl: string;
  redisUrl: string;
  meilisearchUrl: string;
}): RuntimeClients => {
  const pool = new Pool({ connectionString: options.databaseUrl });
  const redis = new Redis(options.redisUrl, { lazyConnect: true });

  return {
    pool,
    redis,
    database: new PostgresDatabaseHealthClient(pool),
    queue: new RedisQueueHealthClient(redis),
    search: new MeilisearchHealthClient(options.meilisearchUrl),
    worker: new PostgresWorkerHeartbeatStore(pool),
    async close() {
      await Promise.allSettled([pool.end(), redis.quit()]);
    }
  };
};
