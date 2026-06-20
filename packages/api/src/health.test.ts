import { describe, expect, test } from "bun:test";
import { createApp } from "./app";
import {
  DEV_ORGANIZATION_ID,
  DEV_ORGANIZATION_INBOX_FOLDER_ID,
  DEV_ORGANIZATION_LIBRARY_ID,
  DEV_ORGANIZATION_LIBRARY_NAME,
  DEV_ORGANIZATION_NAME,
  DEV_ORGANIZATION_SLUG,
  DEV_PERSONAL_INBOX_FOLDER_ID,
  DEV_PERSONAL_LIBRARY_ID,
  DEV_PERSONAL_LIBRARY_NAME,
  DEV_USER_EMAIL,
  DEV_USER_ID,
  DEV_USER_NAME
} from "./devIdentity";
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

describe("health endpoint", () => {
  test("returns the health response from the Hono app", async () => {
    const app = createApp({
      dependencies: dependencies()
    });

    const response = await app.request("/health");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.services.database).toBe("ok");
  });
});

describe("current user endpoint", () => {
  test("returns the configured current user", async () => {
    const app = createApp({
      dependencies: dependencies(),
      currentUser: {
        userId: DEV_USER_ID,
        organizationId: DEV_ORGANIZATION_ID,
        personalLibraryId: DEV_PERSONAL_LIBRARY_ID,
        organizationLibraryId: DEV_ORGANIZATION_LIBRARY_ID,
        personalInboxFolderId: DEV_PERSONAL_INBOX_FOLDER_ID,
        organizationInboxFolderId: DEV_ORGANIZATION_INBOX_FOLDER_ID,
        personalLibraryName: DEV_PERSONAL_LIBRARY_NAME,
        organizationLibraryName: DEV_ORGANIZATION_LIBRARY_NAME,
        email: DEV_USER_EMAIL,
        name: DEV_USER_NAME,
        organizationName: DEV_ORGANIZATION_NAME,
        organizationSlug: DEV_ORGANIZATION_SLUG
      }
    });

    const response = await app.request("/me");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      user: {
        id: DEV_USER_ID,
        email: DEV_USER_EMAIL,
        name: DEV_USER_NAME
      },
      organization: {
        id: DEV_ORGANIZATION_ID,
        name: DEV_ORGANIZATION_NAME,
        slug: DEV_ORGANIZATION_SLUG,
        role: "owner"
      },
      libraries: [
        {
          id: DEV_PERSONAL_LIBRARY_ID,
          kind: "personal",
          name: DEV_PERSONAL_LIBRARY_NAME,
          inboxFolderId: DEV_PERSONAL_INBOX_FOLDER_ID
        },
        {
          id: DEV_ORGANIZATION_LIBRARY_ID,
          kind: "organization",
          name: DEV_ORGANIZATION_LIBRARY_NAME,
          inboxFolderId: DEV_ORGANIZATION_INBOX_FOLDER_ID,
          organizationId: DEV_ORGANIZATION_ID,
          organizationSlug: DEV_ORGANIZATION_SLUG
        }
      ]
    });
  });

  test("returns unauthorized when no current user is configured", async () => {
    const app = createApp({
      dependencies: dependencies()
    });

    const response = await app.request("/me");

    expect(response.status).toBe(401);
  });
});
