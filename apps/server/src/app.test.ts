import { describe, expect, test } from "bun:test";
import type { BookmarksStore } from "@bookmarks/api/bookmarks";
import type { HealthDependencies } from "@bookmarks/api/health";
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
} from "@bookmarks/api/identity";
import { createApp } from "./app";

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
      async createBookmark() {
        throw new Error("not used");
      },
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
        async createBookmark() {
          throw new Error("not used");
        },
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

  test("creates a bookmark through oRPC in the personal inbox", async () => {
    const calls: Parameters<BookmarksStore["createBookmark"]>[0][] = [];
    const bookmarksStore: BookmarksStore = {
      async createBookmark(input) {
        calls.push(input);

        return {
          id: "00000000-0000-4000-8000-000000000010",
          libraryId: input.libraryId,
          folderId: input.folderId,
          folderName: "Inbox",
          url: input.url,
          title: null,
          description: null,
          createdAt: "2026-06-20T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z"
        };
      },
      async listBookmarks() {
        return [];
      }
    };
    const app = createApp({
      bookmarksStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/bookmarks/create", {
      body: JSON.stringify({ json: { url: "https://example.com/article" } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.url).toBe("https://example.com/article");
    expect(calls[0]).toEqual({
      createdByUserId: DEV_USER_ID,
      folderId: DEV_PERSONAL_INBOX_FOLDER_ID,
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      url: "https://example.com/article"
    });
  });

  test("rejects invalid bookmark URLs", async () => {
    const app = createApp({
      bookmarksStore: {
        async createBookmark() {
          throw new Error("not used");
        },
        async listBookmarks() {
          return [];
        }
      },
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/bookmarks/create", {
      body: JSON.stringify({ json: { url: "not-a-url" } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
  });
});
