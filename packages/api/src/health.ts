import type { HealthResponse } from "@bookmarks/shared";

export interface DatabaseHealthClient {
  check(): Promise<void>;
}

export interface QueueHealthClient {
  check(): Promise<void>;
}

export interface SearchHealthClient {
  check(): Promise<void>;
}

export interface WorkerHeartbeatStore {
  getLastHeartbeat(workerName: string): Promise<Date | null>;
}

export interface HealthDependencies {
  database: DatabaseHealthClient;
  queue: QueueHealthClient;
  search: SearchHealthClient;
  worker: WorkerHeartbeatStore;
}

export interface HealthOptions {
  workerName: string;
  workerHeartbeatStaleAfterMs: number;
  now?: () => Date;
}

export const checkHealth = async (
  dependencies: HealthDependencies,
  options: HealthOptions
): Promise<HealthResponse> => {
  const checkedAt = options.now?.() ?? new Date();
  const [database, queue, search, worker] = await Promise.all([
    statusFromCheck(() => dependencies.database.check()),
    statusFromCheck(() => dependencies.queue.check()),
    statusFromCheck(() => dependencies.search.check()),
    statusFromWorkerCheck(dependencies.worker, options.workerName, checkedAt, options.workerHeartbeatStaleAfterMs)
  ]);

  const degraded =
    database !== "ok" || queue !== "ok" || search !== "ok" || worker !== "ok";

  return {
    status: degraded ? "degraded" : "ok",
    services: {
      database,
      queue,
      worker,
      search
    },
    checkedAt: checkedAt.toISOString()
  };
};

const statusFromCheck = async (check: () => Promise<void>): Promise<"ok" | "error"> => {
  try {
    await check();
    return "ok";
  } catch {
    return "error";
  }
};

const statusFromWorkerCheck = async (
  store: WorkerHeartbeatStore,
  workerName: string,
  checkedAt: Date,
  staleAfterMs: number
): Promise<"ok" | "stale" | "missing" | "error"> => {
  try {
    const lastHeartbeat = await store.getLastHeartbeat(workerName);

    if (!lastHeartbeat) {
      return "missing";
    }

    const ageMs = checkedAt.getTime() - lastHeartbeat.getTime();
    return ageMs <= staleAfterMs ? "ok" : "stale";
  } catch {
    return "error";
  }
};
