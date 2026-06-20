import { describe, expect, test } from "bun:test";
import type { BookmarksStore } from "./bookmarks";
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

const currentUser = {
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
};

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
      currentUser
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

describe("bookmarks RPC", () => {
  test("returns cursor-paginated bookmark items through oRPC", async () => {
    const calls: Parameters<BookmarksStore["listBookmarks"]>[0][] = [];
    const bookmarksStore: BookmarksStore = {
      async listBookmarks(input) {
        calls.push(input);

        return [
          {
            id: "00000000-0000-4000-8000-000000000010",
            libraryId: DEV_PERSONAL_LIBRARY_ID,
            folderId: DEV_PERSONAL_INBOX_FOLDER_ID,
            folderName: "Inbox",
            url: "https://example.com/first",
            title: "First",
            description: null,
            createdAt: "2026-06-19T12:00:00.000Z",
            updatedAt: "2026-06-19T12:00:00.000Z"
          },
          {
            id: "00000000-0000-4000-8000-000000000009",
            libraryId: DEV_PERSONAL_LIBRARY_ID,
            folderId: DEV_PERSONAL_INBOX_FOLDER_ID,
            folderName: "Inbox",
            url: "https://example.com/second",
            title: "Second",
            description: null,
            createdAt: "2026-06-18T12:00:00.000Z",
            updatedAt: "2026-06-18T12:00:00.000Z"
          }
        ];
      }
    };
    const app = createApp({
      bookmarksStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/bookmarks/list", {
      body: JSON.stringify({ json: { limit: 1 } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.items).toHaveLength(1);
    expect(body.json.items[0].title).toBe("First");
    expect(typeof body.json.nextCursor).toBe("string");
    expect(calls[0]).toEqual({
      cursor: undefined,
      libraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID],
      limit: 1
    });
  });

  test("rejects bookmark RPC calls without a current user", async () => {
    const app = createApp({
      bookmarksStore: {
        async listBookmarks() {
          return [];
        }
      },
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/bookmarks/list", {
      body: JSON.stringify({ json: { limit: 1 } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(401);
  });
});
