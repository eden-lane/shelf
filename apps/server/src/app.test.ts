import { describe, expect, spyOn, test } from "bun:test";
import type { SavedItemsStore, SavedItemSearchIndex } from "@shelf/api/savedItems";
import type { HealthDependencies } from "@shelf/api/health";
import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "./app";

const DEV_USER_ID = "00000000-0000-4000-8000-000000000001";
const DEV_PERSONAL_LIBRARY_ID = "00000000-0000-4000-8000-000000000003";
const DEV_USER_EMAIL = "dev@localhost";
const DEV_USER_NAME = "Dev User";
const DEV_PERSONAL_LIBRARY_NAME = "Personal";
const DEV_ORGANIZATION_LIBRARY_ID = "00000000-0000-4000-8000-000000000004";
const DEV_ORGANIZATION_LIBRARY_NAME = "Team";
const TEST_FOLDER_ID = "00000000-0000-4000-8000-000000000005";
const TEST_CHILD_FOLDER_ID = "00000000-0000-4000-8000-000000000020";

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
  user: {
    id: DEV_USER_ID,
    email: DEV_USER_EMAIL,
    emailVerifiedAt: null,
    name: DEV_USER_NAME,
    username: null,
    avatarUrl: null,
    billingCustomerId: null,
    locale: null
  },
  organizations: [],
  libraries: [
    {
      id: DEV_PERSONAL_LIBRARY_ID,
      kind: "personal" as const,
      name: DEV_PERSONAL_LIBRARY_NAME
    }
  ]
};

const createSavedItemsStore = (overrides: Partial<SavedItemsStore>): SavedItemsStore => ({
  async createSavedItem() {
    throw new Error("not used");
  },
  async createFolder() {
    throw new Error("not used");
  },
  async createTag() {
    throw new Error("not used");
  },
  async deleteSavedItem() {
    throw new Error("not used");
  },
  async deleteFolder() {
    throw new Error("not used");
  },
  async deleteTag() {
    throw new Error("not used");
  },
  async getFavicon() {
    return null;
  },
  async listSavedItems() {
    return [];
  },
  async listSavedItemLocations() {
    return [];
  },
  async listSavedItemSearchDocuments() {
    return [];
  },
  async listFolders() {
    return [];
  },
  async listTags() {
    return [];
  },
  async moveFolder() {
    throw new Error("not used");
  },
  async moveSavedItems() {
    throw new Error("not used");
  },
  async moveTag() {
    throw new Error("not used");
  },
  async updateFolder() {
    throw new Error("not used");
  },
  async updateTag() {
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

describe("production web serving", () => {
  test("serves static assets and falls back to the app shell for client routes", async () => {
    const staticDir = await mkdtemp(join(tmpdir(), "shelf-static-"));

    try {
      await writeFile(join(staticDir, "index.html"), "<div id=\"root\"></div>");
      await writeFile(join(staticDir, "app.css"), "body { color: black; }");

      const app = createApp({
        dependencies: dependencies(),
        staticDir
      });

      const assetResponse = await app.request("/app.css");
      const routeResponse = await app.request("/me/personal/folder/123");

      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("cache-control")).toBe("no-cache");
      expect(await assetResponse.text()).toBe("body { color: black; }");
      expect(routeResponse.status).toBe(200);
      expect(await routeResponse.text()).toBe("<div id=\"root\"></div>");
    } finally {
      await rm(staticDir, { force: true, recursive: true });
    }
  });
});

describe("origin checks", () => {
  test("allows same-origin mutating requests without an explicit allow-list entry", async () => {
    const app = createApp({
      allowedOrigins: [],
      dependencies: dependencies()
    });

    const response = await app.request(
      new Request("https://shelf.example/auth/signup", {
        body: JSON.stringify({ email: "user@example.com", password: "password" }),
        headers: {
          "content-type": "application/json",
          origin: "https://shelf.example"
        },
        method: "POST"
      })
    );

    expect(response.status).not.toBe(403);
  });

  test("rejects cross-origin mutating requests outside the allow-list", async () => {
    const app = createApp({
      allowedOrigins: [],
      dependencies: dependencies()
    });

    const response = await app.request(
      new Request("https://shelf.example/auth/signup", {
        body: JSON.stringify({ email: "user@example.com", password: "password" }),
        headers: {
          "content-type": "application/json",
          origin: "https://other.example"
        },
        method: "POST"
      })
    );

    expect(response.status).toBe(403);
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
        emailVerifiedAt: null,
        avatarUrl: null,
        billingCustomerId: null,
        locale: null,
        username: null,
        name: DEV_USER_NAME
      },
      organizations: [],
      libraries: [
        {
          id: DEV_PERSONAL_LIBRARY_ID,
          kind: "personal",
          name: DEV_PERSONAL_LIBRARY_NAME
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

describe("savedItems RPC", () => {
  test("returns cursor-paginated savedItem items through oRPC", async () => {
    const calls: Parameters<SavedItemsStore["listSavedItems"]>[0][] = [];
    const savedItemsStore = createSavedItemsStore({
      async listSavedItems(input) {
        calls.push(input);

        return [
          {
            id: "00000000-0000-4000-8000-000000000010",
            libraryId: DEV_PERSONAL_LIBRARY_ID,
            folderId: TEST_FOLDER_ID,
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
            folderId: TEST_FOLDER_ID,
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
      savedItemsStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/list", {
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
      folderId: undefined,
      inbox: false,
      libraryIds: [DEV_PERSONAL_LIBRARY_ID],
      limit: 1,
      tagId: undefined
    });
  });

  test("rejects savedItem RPC calls without a current user", async () => {
    const app = createApp({
      savedItemsStore: createSavedItemsStore({}),
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/list", {
      body: JSON.stringify({ json: { limit: 1 } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(401);
  });

  test("lists existing savedItem locations for the current URL", async () => {
    const calls: Parameters<SavedItemsStore["listSavedItemLocations"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async listSavedItemLocations(input) {
          calls.push(input);

          return [
            {
              id: "00000000-0000-4000-8000-000000000010",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              folderId: TEST_FOLDER_ID,
              url: input.url,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            },
            {
              id: "00000000-0000-4000-8000-000000000011",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              folderId: TEST_CHILD_FOLDER_ID,
              url: input.url,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/locations", {
      body: JSON.stringify({ json: { url: "https://example.com/article" } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json).toHaveLength(2);
    expect(calls[0]).toEqual({
      libraryIds: [DEV_PERSONAL_LIBRARY_ID],
      url: "https://example.com/article"
    });
  });

  test("creates a savedItem through oRPC in the personal inbox", async () => {
    const calls: Parameters<SavedItemsStore["createSavedItem"]>[0][] = [];
    const queuedIds: string[] = [];
    const savedItemsStore = createSavedItemsStore({
      async createSavedItem(input) {
        calls.push(input);

        return {
          id: "00000000-0000-4000-8000-000000000010",
          libraryId: input.libraryId,
          folderId: input.folderId,
          folderName: null,
          url: input.url,
          title: null,
          description: input.description,
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
      savedItemEnrichmentQueue: {
        async enqueueSavedItem(savedItemId) {
          queuedIds.push(savedItemId);
        }
      },
      savedItemsStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/create", {
      body: JSON.stringify({
        json: {
          description: "User edited description",
          url: "https://example.com/article"
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.url).toBe("https://example.com/article");
    expect(body.json.description).toBe("User edited description");
    expect(calls[0]).toEqual({
      createdByUserId: DEV_USER_ID,
      description: "User edited description",
      folderId: null,
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      tagIds: undefined,
      url: "https://example.com/article"
    });
    expect(queuedIds).toEqual(["00000000-0000-4000-8000-000000000010"]);
  });

  test("indexes a created savedItem without blocking creation on search failures", async () => {
    const consoleError = spyOn(console, "error").mockImplementation(() => {});
    const indexedDocuments: unknown[] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async createSavedItem(input) {
          return {
            id: "00000000-0000-4000-8000-000000000010",
            libraryId: input.libraryId,
            libraryName: DEV_PERSONAL_LIBRARY_NAME,
            folderId: input.folderId,
            folderName: null,
            url: input.url,
            title: "Searchable savedItem",
            description: null,
            siteName: "Example",
            imageUrl: null,
            metadataStatus: "fetched",
            metadataFetchedAt: "2026-06-20T12:00:00.000Z",
            faviconId: null,
            faviconUrl: null,
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-20T12:00:00.000Z"
          };
        },
        async listSavedItemSearchDocuments(input) {
          expect(input).toEqual({
            libraryIds: [DEV_PERSONAL_LIBRARY_ID],
            savedItemIds: ["00000000-0000-4000-8000-000000000010"]
          });

          return [
            {
              id: "00000000-0000-4000-8000-000000000010",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              libraryName: DEV_PERSONAL_LIBRARY_NAME,
              folderId: null,
              folderName: null,
              url: "https://example.com/article",
              title: "Searchable savedItem",
              description: null,
              siteName: "Example",
              imageUrl: null,
              metadataStatus: "fetched",
              metadataFetchedAt: "2026-06-20T12:00:00.000Z",
              faviconId: null,
              faviconUrl: null,
              tagNames: ["Research"],
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies(),
      savedItemSearchIndex: {
        async delete() {},
        async search() {
          return { items: [], nextCursor: null };
        },
        async upsert(documents) {
          indexedDocuments.push(...documents);
          throw new Error("search offline");
        }
      }
    });

    const response = await app.request("/rpc/savedItems/create", {
      body: JSON.stringify({ json: { url: "https://example.com/article" } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.title).toBe("Searchable savedItem");
    expect(indexedDocuments).toHaveLength(1);
    consoleError.mockRestore();
  });

  test("creates a savedItem with selected tags from the target folder library", async () => {
    const calls: Parameters<SavedItemsStore["createSavedItem"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async createSavedItem(input) {
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
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              parentId: TEST_CHILD_FOLDER_ID,
              name: "Reading",
              iconName: null,
              iconColor: null,
              sortOrder: 0,
              savedItemCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        },
        async listTags() {
          return [
            {
              id: "00000000-0000-4000-8000-000000000030",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              name: "Research",
              color: "#3b82f6",
              sortOrder: 0,
              savedItemCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/create", {
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
      description: null,
      folderId: "00000000-0000-4000-8000-000000000020",
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      tagIds: ["00000000-0000-4000-8000-000000000030"],
      url: "https://example.com/article"
    });
  });

  test("rejects invalid savedItem URLs", async () => {
    const app = createApp({
      savedItemsStore: createSavedItemsStore({}),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/create", {
      body: JSON.stringify({ json: { url: "not-a-url" } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(400);
  });

  test("deletes a savedItem through oRPC for the current user's libraries", async () => {
    const calls: Parameters<SavedItemsStore["deleteSavedItem"]>[0][] = [];
    const savedItemsStore = createSavedItemsStore({
      async deleteSavedItem(input) {
        calls.push(input);

        return { deletedSavedItemId: input.savedItemId };
      }
    });
    const app = createApp({
      savedItemsStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/delete", {
      body: JSON.stringify({
        json: { savedItemId: "00000000-0000-4000-8000-000000000010" }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.deletedSavedItemId).toBe("00000000-0000-4000-8000-000000000010");
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      savedItemId: "00000000-0000-4000-8000-000000000010"
    });
  });

  test("removes deleted savedItems from the search index", async () => {
    const deletedIds: string[][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async deleteSavedItem(input) {
          return { deletedSavedItemId: input.savedItemId };
        }
      }),
      currentUser,
      dependencies: dependencies(),
      savedItemSearchIndex: {
        async delete(savedItemIds) {
          deletedIds.push(savedItemIds);
        },
        async search() {
          return { items: [], nextCursor: null };
        },
        async upsert() {}
      }
    });

    const response = await app.request("/rpc/savedItems/delete", {
      body: JSON.stringify({
        json: { savedItemId: "00000000-0000-4000-8000-000000000010" }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(deletedIds).toEqual([["00000000-0000-4000-8000-000000000010"]]);
  });

  test("moves multiple savedItems through oRPC for the current user's libraries", async () => {
    const calls: Parameters<SavedItemsStore["moveSavedItems"]>[0][] = [];
    const savedItemsStore = createSavedItemsStore({
      async moveSavedItems(input) {
        calls.push(input);

        return {
          destinationFolderId: input.destinationFolderId ?? null,
          movedSavedItemIds: input.savedItemIds
        };
      }
    });
    const app = createApp({
      savedItemsStore,
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/savedItems/move", {
      body: JSON.stringify({
        json: {
          savedItemIds: [
            "00000000-0000-4000-8000-000000000010",
            "00000000-0000-4000-8000-000000000011",
            "00000000-0000-4000-8000-000000000010"
          ],
          destinationFolderId: TEST_FOLDER_ID
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json).toEqual({
      destinationFolderId: TEST_FOLDER_ID,
      movedSavedItemIds: [
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-000000000011"
      ]
    });
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      savedItemIds: [
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-000000000011"
      ],
      destinationFolderId: TEST_FOLDER_ID
    });
  });

  test("reindexes moved savedItems with their updated folder context", async () => {
    const indexedDocuments: unknown[] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async moveSavedItems(input) {
          return {
            destinationFolderId: input.destinationFolderId ?? null,
            movedSavedItemIds: input.savedItemIds
          };
        },
        async listSavedItemSearchDocuments(input) {
          expect(input).toEqual({
            libraryIds: [DEV_PERSONAL_LIBRARY_ID],
            savedItemIds: ["00000000-0000-4000-8000-000000000010"]
          });

          return [
            {
              id: "00000000-0000-4000-8000-000000000010",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              libraryName: DEV_PERSONAL_LIBRARY_NAME,
              folderId: TEST_FOLDER_ID,
              folderName: "Research",
              url: "https://example.com/article",
              title: "Moved savedItem",
              description: null,
              siteName: "Example",
              imageUrl: null,
              metadataStatus: "fetched",
              metadataFetchedAt: "2026-06-20T12:00:00.000Z",
              faviconId: null,
              faviconUrl: null,
              tagNames: [],
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:05:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies(),
      savedItemSearchIndex: {
        async delete() {},
        async search() {
          return { items: [], nextCursor: null };
        },
        async upsert(documents) {
          indexedDocuments.push(...documents);
        }
      }
    });

    const response = await app.request("/rpc/savedItems/move", {
      body: JSON.stringify({
        json: {
          savedItemIds: ["00000000-0000-4000-8000-000000000010"],
          destinationFolderId: TEST_FOLDER_ID
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(indexedDocuments).toHaveLength(1);
    expect(indexedDocuments[0]).toMatchObject({
      folderName: "Research",
      title: "Moved savedItem"
    });
  });

  test("searches savedItems in the current workspace through oRPC", async () => {
    const calls: Parameters<SavedItemSearchIndex["search"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({}),
      currentUser: {
        ...currentUser,
        libraries: [
          ...currentUser.libraries,
          {
            id: DEV_ORGANIZATION_LIBRARY_ID,
            kind: "organization" as const,
            name: DEV_ORGANIZATION_LIBRARY_NAME,
            organizationId: "00000000-0000-4000-8000-000000000100",
            organizationSlug: "team"
          }
        ]
      },
      dependencies: dependencies(),
      savedItemSearchIndex: {
        async delete() {},
        async search(input) {
          calls.push(input);

          return {
            items: [
              {
                id: "00000000-0000-4000-8000-000000000010",
                libraryId: DEV_PERSONAL_LIBRARY_ID,
                libraryName: DEV_PERSONAL_LIBRARY_NAME,
                folderId: TEST_FOLDER_ID,
                folderName: "Research",
                url: "https://example.com/search",
                title: "Search result",
                description: null,
                siteName: "Example",
                imageUrl: null,
                metadataStatus: "fetched",
                metadataFetchedAt: "2026-06-20T12:00:00.000Z",
                faviconId: null,
                faviconUrl: null,
                createdAt: "2026-06-20T12:00:00.000Z",
                updatedAt: "2026-06-20T12:00:00.000Z"
              }
            ],
            nextCursor: null
          };
        },
        async upsert() {}
      }
    });

    const response = await app.request("/rpc/savedItems/search", {
      body: JSON.stringify({
        json: {
          libraryId: DEV_PERSONAL_LIBRARY_ID,
          limit: 10,
          query: " search ",
          scope: "current"
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json.items[0].title).toBe("Search result");
    expect(calls[0]).toEqual({
      cursor: undefined,
      libraryIds: [DEV_PERSONAL_LIBRARY_ID],
      limit: 10,
      query: "search"
    });
  });

  test("searches all current user workspaces through oRPC", async () => {
    const calls: Parameters<SavedItemSearchIndex["search"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({}),
      currentUser: {
        ...currentUser,
        libraries: [
          ...currentUser.libraries,
          {
            id: DEV_ORGANIZATION_LIBRARY_ID,
            kind: "organization" as const,
            name: DEV_ORGANIZATION_LIBRARY_NAME,
            organizationId: "00000000-0000-4000-8000-000000000100",
            organizationSlug: "team"
          }
        ]
      },
      dependencies: dependencies(),
      savedItemSearchIndex: {
        async delete() {},
        async search(input) {
          calls.push(input);

          return {
            items: [],
            nextCursor: null
          };
        },
        async upsert() {}
      }
    });

    const response = await app.request("/rpc/savedItems/search", {
      body: JSON.stringify({
        json: {
          libraryId: DEV_PERSONAL_LIBRARY_ID,
          query: "postgres",
          scope: "all"
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });

    expect(response.status).toBe(200);
    expect(calls[0]).toEqual({
      cursor: undefined,
      libraryIds: [DEV_PERSONAL_LIBRARY_ID, DEV_ORGANIZATION_LIBRARY_ID],
      limit: 20,
      query: "postgres"
    });
  });
});

describe("favicon endpoint", () => {
  test("streams stored favicon bytes", async () => {
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
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
    const calls: Parameters<SavedItemsStore["listFolders"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async listFolders(input) {
          calls.push(input);

          return [
            {
              id: TEST_FOLDER_ID,
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              parentId: null,
              name: "Inbox",
              iconName: "IconInbox",
              iconColor: "#3b82f6",
              sortOrder: 0,
              savedItemCount: 0,
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
      libraryIds: [DEV_PERSONAL_LIBRARY_ID]
    });
  });

  test("creates a folder with the current user's allowed libraries", async () => {
    const calls: Parameters<SavedItemsStore["createFolder"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async createFolder(input) {
          calls.push(input);

          return {
            id: "00000000-0000-4000-8000-000000000020",
            libraryId: input.libraryId,
            parentId: input.parentId ?? null,
            name: input.name,
            iconName: input.iconName ?? null,
            iconColor: input.iconColor ?? null,
            sortOrder: 0,
            savedItemCount: 0,
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
          parentId: TEST_FOLDER_ID
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
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      iconColor: "#3b82f6",
      iconName: "IconInbox",
      name: "Reading",
      parentId: TEST_FOLDER_ID
    });
  });

  test("moves a folder with explicit sibling order", async () => {
    const calls: Parameters<SavedItemsStore["moveFolder"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async moveFolder(input) {
          calls.push(input);

          return [
            {
              id: input.folderId,
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              parentId: input.parentId ?? null,
              name: "Archive",
              iconName: null,
              iconColor: null,
              sortOrder: input.orderedSiblingIds.indexOf(input.folderId),
              savedItemCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:00:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/folders/move", {
      body: JSON.stringify({
        json: {
          folderId: TEST_CHILD_FOLDER_ID,
          orderedSiblingIds: [TEST_FOLDER_ID, TEST_CHILD_FOLDER_ID],
          parentId: null
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json[0].parentId).toBeNull();
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      folderId: TEST_CHILD_FOLDER_ID,
      orderedSiblingIds: [TEST_FOLDER_ID, TEST_CHILD_FOLDER_ID],
      parentId: null
    });
  });

  test("deletes a folder with explicit savedItem handling", async () => {
    const calls: Parameters<SavedItemsStore["deleteFolder"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
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
          destinationFolderId: TEST_CHILD_FOLDER_ID,
          folderId: TEST_FOLDER_ID,
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
    expect(body.json.deletedFolderIds).toEqual([TEST_FOLDER_ID]);
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      destinationFolderId: TEST_CHILD_FOLDER_ID,
      folderId: TEST_FOLDER_ID,
      mode: "move"
    });
  });
});

describe("tags RPC", () => {
  test("lists tags for the current user's libraries", async () => {
    const calls: Parameters<SavedItemsStore["listTags"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async listTags(input) {
          calls.push(input);

          return [
            {
              id: "00000000-0000-4000-8000-000000000030",
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              name: "Research",
              color: "#16a34a",
              sortOrder: 0,
              savedItemCount: 2,
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
      libraryIds: [DEV_PERSONAL_LIBRARY_ID]
    });
  });

  test("creates a tag with the current user's allowed libraries", async () => {
    const calls: Parameters<SavedItemsStore["createTag"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async createTag(input) {
          calls.push(input);

          return {
            id: "00000000-0000-4000-8000-000000000031",
            libraryId: input.libraryId,
            name: input.name,
            color: input.color ?? null,
            sortOrder: 0,
            savedItemCount: 0,
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-20T12:00:00.000Z"
          };
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/tags/create", {
      body: JSON.stringify({
        json: {
          libraryId: DEV_PERSONAL_LIBRARY_ID,
          color: "#3B82F6",
          name: " Research "
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json).toMatchObject({
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      name: "Research",
      color: "#3b82f6",
      savedItemCount: 0
    });
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      libraryId: DEV_PERSONAL_LIBRARY_ID,
      color: "#3b82f6",
      name: "Research"
    });
  });

  test("updates a tag with the current user's allowed libraries", async () => {
    const calls: Parameters<SavedItemsStore["updateTag"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async updateTag(input) {
          calls.push(input);

          return {
            id: input.tagId,
            libraryId: DEV_PERSONAL_LIBRARY_ID,
            name: input.name,
            color: input.color ?? null,
            sortOrder: 0,
            savedItemCount: 2,
            createdAt: "2026-06-20T12:00:00.000Z",
            updatedAt: "2026-06-20T12:05:00.000Z"
          };
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/tags/update", {
      body: JSON.stringify({
        json: {
          tagId: "00000000-0000-4000-8000-000000000030",
          color: "#F59E0B",
          name: " Updated "
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json).toMatchObject({
      id: "00000000-0000-4000-8000-000000000030",
      name: "Updated",
      color: "#f59e0b"
    });
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      tagId: "00000000-0000-4000-8000-000000000030",
      color: "#f59e0b",
      name: "Updated"
    });
  });

  test("moves a tag with explicit sibling order", async () => {
    const calls: Parameters<SavedItemsStore["moveTag"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async moveTag(input) {
          calls.push(input);

          return [
            {
              id: input.tagId,
              libraryId: DEV_PERSONAL_LIBRARY_ID,
              name: "Research",
              color: "#16a34a",
              sortOrder: input.orderedTagIds.indexOf(input.tagId),
              savedItemCount: 0,
              createdAt: "2026-06-20T12:00:00.000Z",
              updatedAt: "2026-06-20T12:05:00.000Z"
            }
          ];
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/tags/move", {
      body: JSON.stringify({
        json: {
          tagId: "00000000-0000-4000-8000-000000000031",
          orderedTagIds: [
            "00000000-0000-4000-8000-000000000030",
            "00000000-0000-4000-8000-000000000031"
          ]
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json[0].sortOrder).toBe(1);
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      tagId: "00000000-0000-4000-8000-000000000031",
      orderedTagIds: [
        "00000000-0000-4000-8000-000000000030",
        "00000000-0000-4000-8000-000000000031"
      ]
    });
  });

  test("deletes a tag with the current user's allowed libraries", async () => {
    const calls: Parameters<SavedItemsStore["deleteTag"]>[0][] = [];
    const app = createApp({
      savedItemsStore: createSavedItemsStore({
        async deleteTag(input) {
          calls.push(input);

          return { deletedTagId: input.tagId };
        }
      }),
      currentUser,
      dependencies: dependencies()
    });

    const response = await app.request("/rpc/tags/delete", {
      body: JSON.stringify({
        json: {
          tagId: "00000000-0000-4000-8000-000000000030"
        }
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.json).toEqual({
      deletedTagId: "00000000-0000-4000-8000-000000000030"
    });
    expect(calls[0]).toEqual({
      allowedLibraryIds: [DEV_PERSONAL_LIBRARY_ID],
      tagId: "00000000-0000-4000-8000-000000000030"
    });
  });
});
