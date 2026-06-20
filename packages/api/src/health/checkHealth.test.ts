import { describe, expect, test } from "bun:test";
import { checkHealth, type HealthDependencies } from "./checkHealth";

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
  ...overrides
});

describe("checkHealth", () => {
  test("reports ok when all dependencies are available", async () => {
    const health = await checkHealth(dependencies(), {
      now: () => now
    });

    expect(health).toEqual({
      status: "ok",
      services: {
        database: "ok",
        queue: "ok",
        search: "ok"
      },
      checkedAt: "2026-06-19T12:00:00.000Z"
    });
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
        now: () => now
      }
    );

    expect(health.status).toBe("degraded");
    expect(health.services.queue).toBe("error");
  });
});
