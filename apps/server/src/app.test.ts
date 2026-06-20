import { describe, expect, test } from "bun:test";
import type { BookmarksStore } from "@bookmarks/api/bookmarks";
import type { HealthDependencies } from "@bookmarks/api/health";
import { Buffer } from "node:buffer";
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

const createBookmarksStore = (overrides: Partial<BookmarksStore>): BookmarksStore => ({
  async createBookmark() {
    throw new Error("not used");
  },
  async createFolder() {
    throw new Error("not used");
  },
  async deleteBookmark() {
    throw new Error("not used");
  },
  async deleteFolder() {
    throw new Error("not used");
  },
  async getFavicon() {
    return null;
  },
  async listBookmarks() {
    return [];
  },
  async listFolders() {
    return [];
  },
  async listTags() {
    return [];
  },
  async updateFolder() {
    throw new Error("not used");
  },
  ...overrides
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
    const bookmarksStore = createBookmarksStore({
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
            siteName: null,
            imageUrl: null,
            metadataStatus: "fetched",
            metadataFetchedAt: "2026-06-19T12:00:00.000Z",
            faviconId: null,
            faviconUrl: null,
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
            siteName: null,
            imageUrl: null,
            metadataStatus: "fetched",
            metadataFetchedAt: "2026-06-18T12:00:00.000Z",
            faviconId: null,
            faviconUrl: null,
            createdAt: "2026-06-18T12:00:00.000Z",
            updatedAt: "2026-06-18T12:00:00.000Z"
          }
        ];
      }
    });
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
      bookmarksStore: createBookmarksStore({}),
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
    const queuedIds: string[] = [];
    const bookmarksStore = createBookmarksStore({
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
          siteName: null,
          imageUrl: null,
          metadataStatus: "pending",
          metadataFetchedAt: null,
          faviconId: null,
          faviconUrl: null,
          createdAt: "2026-06-20T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z"
        };
      }
    });
    const app = createApp({
      bookmarkEnrichmentQueue: {
        async enqueueSavedItem(savedItemId) {
          queuedIds.push(savedItemId);
        }
      },
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
      tagIds: undefined,
      url: "https://example.com/article"
    });
    expect(queuedIds).toEqual(["00000000-0000-4000-8000-000000000010"]);
  });

  test("creates a bookmark with selected tags from the target folder library", async () => {
    const calls: Parameters<BookmarksStore["createBookmark"]>[0][] = [];
    const app = createApp({
      bookmarksStore: createBookmarksStore({
        async createBookmark(input) {
          calls.push(input);

          return {
            id: "00000000-0000-4000-8000-000000000010",
            libraryId: input.libraryId,
            folderId: input.folderId,
            folderName: "Reading",
            url: input.url,
            title: null,
            description: null,
            siteName: null,
            imageUrl: null,
            metadataStatus: "fetched",
            metadataFetchedAt: "2026-06-20T12:00:00.000Z",
            faviconId: null,
            faviconUrl: null,
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-20T12:00:00.000Z"
          };
        },
        async listFolders() {
          return [
            {
              id: "00000000-0000-4000-8000-000000000020",
              libraryId: DEV_ORGANIZATION_LIBRARY_ID,
              parentId: DEV_ORGANIZATION_INBOX_FOLDER_ID,
              name: "Reading",
              iconName: null,
              iconColor: null,
              bookmarkCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        },
        async listTags() {
          return [
            {
              id: "00000000-0000-4000-8000-000000000030",
              libraryId: DEV_ORGANIZATION_LIBRARY_ID,
              name: "Research",
              bookmarkCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/bookmarks/create", {
      body: JSON.stringify({
        json: {
          folderId: "00000000-0000-4000-8000-000000000020",
          tagIds: ["00000000-0000-4000-8000-000000000030"],
          url: "https://example.com/article"
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(calls[0]).toEqual({
      createdByUserId: DEV_USER_ID,
      folderId: "00000000-0000-4000-8000-000000000020",
      libraryId: DEV_ORGANIZATION_LIBRARY_ID,
      tagIds: ["00000000-0000-4000-8000-000000000030"],
      url: "https://example.com/article"
    });
  });

  test("rejects invalid bookmark URLs", async () => {
    const app = createApp({
      bookmarksStore: createBookmarksStore({}),
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

  test("deletes a bookmark through oRPC for the current user's libraries", async () => {
    const calls: Parameters<BookmarksStore["deleteBookmark"]>[0][] = [];
    const bookmarksStore = createBookmarksStore({
      async deleteBookmark(input) {
        calls.push(input);

        return { deletedBookmarkId: input.bookmarkId };
      }
    });
    const app = createApp({
      bookmarksStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/bookmarks/delete", {
      body: JSON.stringify({
        json: { bookmarkId: "00000000-0000-4000-8000-000000000010" }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.deletedBookmarkId).toBe("00000000-0000-4000-8000-000000000010");
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID],
      bookmarkId: "00000000-0000-4000-8000-000000000010"
    });
  });
});

describe("favicon endpoint", () => {
  test("streams stored favicon bytes", async () => {
    const app = createApp({
      bookmarksStore: createBookmarksStore({
        async getFavicon(id) {
          if (id !== "00000000-0000-4000-8000-000000000030") {
            return null;
          }

          return {
            contentType: "image/png",
            imageBytes: Buffer.from([1, 2, 3])
          };
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/favicons/00000000-0000-4000-8000-000000000030");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(Array.from(new Uint8Array(await response.arrayBuffer()))).toEqual([1, 2, 3]);
  });
});

describe("folders RPC", () => {
  test("lists folders for the current user's libraries", async () => {
    const calls: Parameters<BookmarksStore["listFolders"]>[0][] = [];
    const app = createApp({
      bookmarksStore: createBookmarksStore({
        async listFolders(input) {
          calls.push(input);

          return [
            {
              id: DEV_PERSONAL_INBOX_FOLDER_ID,
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              parentId: null,
              name: "Inbox",
              iconName: "IconInbox",
              iconColor: "#3b82f6",
              bookmarkCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/folders/list", {
      body: JSON.stringify({ json: null }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json[0].name).toBe("Inbox");
    expect(calls[0]).toEqual({
      libraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID]
    });
  });

  test("creates a folder with the current user's allowed libraries", async () => {
    const calls: Parameters<BookmarksStore["createFolder"]>[0][] = [];
    const app = createApp({
      bookmarksStore: createBookmarksStore({
        async createFolder(input) {
          calls.push(input);

          return {
            id: "00000000-0000-4000-8000-000000000020",
            libraryId: input.libraryId,
            parentId: input.parentId ?? null,
            name: input.name,
            iconName: input.iconName ?? null,
            iconColor: input.iconColor ?? null,
            bookmarkCount: 0,
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-20T12:00:00.000Z"
          };
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/folders/create", {
      body: JSON.stringify({
        json: {
          libraryId: DEV_PERSONAL_LIBRARY_ID,
          iconColor: "#3B82F6",
          iconName: "IconInbox",
          name: " Reading ",
          parentId: DEV_PERSONAL_INBOX_FOLDER_ID
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.name).toBe("Reading");
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID],
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      iconColor: "#3b82f6",
      iconName: "IconInbox",
      name: "Reading",
      parentId: DEV_PERSONAL_INBOX_FOLDER_ID
    });
  });

  test("deletes a folder with explicit bookmark handling", async () => {
    const calls: Parameters<BookmarksStore["deleteFolder"]>[0][] = [];
    const app = createApp({
      bookmarksStore: createBookmarksStore({
        async deleteFolder(input) {
          calls.push(input);

          return {
            deletedFolderIds: [input.folderId]
          };
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/folders/delete", {
      body: JSON.stringify({
        json: {
          destinationFolderId: DEV_ORGANIZATION_INBOX_FOLDER_ID,
          folderId: DEV_PERSONAL_INBOX_FOLDER_ID,
          mode: "move"
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.deletedFolderIds).toEqual([DEV_PERSONAL_INBOX_FOLDER_ID]);
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID],
      destinationFolderId: DEV_ORGANIZATION_INBOX_FOLDER_ID,
      folderId: DEV_PERSONAL_INBOX_FOLDER_ID,
      mode: "move"
    });
  });
});

describe("tags RPC", () => {
  test("lists tags for the current user's libraries", async () => {
    const calls: Parameters<BookmarksStore["listTags"]>[0][] = [];
    const app = createApp({
      bookmarksStore: createBookmarksStore({
        async listTags(input) {
          calls.push(input);

          return [
            {
              id: "00000000-0000-4000-8000-000000000030",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              name: "Research",
              bookmarkCount: 2,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/tags/list", {
      body: JSON.stringify({ json: null }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json[0].name).toBe("Research");
    expect(calls[0]).toEqual({
      libraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID]
    });
  });
});
