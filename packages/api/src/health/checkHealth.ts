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

export interface HealthDependencies {
  database: DatabaseHealthClient;
  queue: QueueHealthClient;
  search: SearchHealthClient;
}

export interface HealthOptions {
  now?: () => Date;
}

export const checkHealth = async (
  dependencies: HealthDependencies,
  options: HealthOptions = {}
): Promise<HealthResponse> => {
  const checkedAt = options.now?.() ?? new Date();
  const [database, queue, search] = await Promise.all([
    statusFromCheck(() => dependencies.database.check()),
    statusFromCheck(() => dependencies.queue.check()),
    statusFromCheck(() => dependencies.search.check())
  ]);

  const degraded = database !== "ok" || queue !== "ok" || search !== "ok";

  return {
    status: degraded ? "degraded" : "ok",
    services: {
      database,
      queue,
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
