import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import { checkHealth, type HealthDependencies } from "./health";

const now = new Date("2026-06-19T12:00:00.000Z");

const dependencies = (overrides: Partial<HealthDependencies> = {}): HealthDependencies => ({
  database: {
    check: async () => {}
  },
  queue: {
    check: async () => {}
  },
  search: {
    check: async () => {}
  },
  worker: {
    getLastHeartbeat: async () => new Date()
  },
  ...overrides
});

describe("checkHealth", () => {
  test("reports ok when all dependencies are available", async () => {
    const health = await checkHealth(dependencies(), {
      workerName: "default",
      workerHeartbeatStaleAfterMs: 30_000,
      now: () => now
    });

    expect(health).toEqual({
      status: "ok",
      services: {
        database: "ok",
        queue: "ok",
        worker: "ok",
        search: "ok"
      },
      checkedAt: "2026-06-19T12:00:00.000Z"
    });
  });

  test("reports degraded when the worker heartbeat is missing", async () => {
    const health = await checkHealth(
      dependencies({
        worker: {
          getLastHeartbeat: async () => null
        }
      }),
      {
        workerName: "default",
        workerHeartbeatStaleAfterMs: 30_000,
        now: () => now
      }
    );

    expect(health.status).toBe("degraded");
    expect(health.services.worker).toBe("missing");
  });

  test("reports degraded when the worker heartbeat is stale", async () => {
    const health = await checkHealth(
      dependencies({
        worker: {
          getLastHeartbeat: async () => new Date(now.getTime() - 31_000)
        }
      }),
      {
        workerName: "default",
        workerHeartbeatStaleAfterMs: 30_000,
        now: () => now
      }
    );

    expect(health.status).toBe("degraded");
    expect(health.services.worker).toBe("stale");
  });

  test("reports individual dependency failures", async () => {
    const health = await checkHealth(
      dependencies({
        queue: {
          check: async () => {
            throw new Error("redis offline");
          }
        }
      }),
      {
        workerName: "default",
        workerHeartbeatStaleAfterMs: 30_000,
        now: () => now
      }
    );

    expect(health.status).toBe("degraded");
    expect(health.services.queue).toBe("error");
  });
});

describe("health endpoint", () => {
  test("returns the health response from the Hono app", async () => {
    const app = createApp({
      dependencies: dependencies(),
      workerName: "default",
      workerHeartbeatStaleAfterMs: 30_000
    });

    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.services.database).toBe("ok");
  });
});
