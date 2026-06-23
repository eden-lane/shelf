import { describe, expect, test } from "bun:test";
import { RPCHandler } from "@orpc/server/fetch";
import type { CurrentIdentity } from "./currentUser";
import { createRpcRouter } from "./rpc";
import type { SavedItemsStore } from "./savedItems";

const USER_ID = "00000000-0000-4000-8000-000000000001";
const LIBRARY_ID = "00000000-0000-4000-8000-000000000003";

const currentUser: CurrentIdentity = {
  user: {
    id: USER_ID,
    email: "user@example.com",
    emailVerifiedAt: null,
    name: "User",
    username: null,
    avatarUrl: null,
    billingCustomerId: null,
    locale: null
  },
  organizations: [],
  libraries: [
    {
      id: LIBRARY_ID,
      kind: "personal",
      name: "Personal"
    }
  ]
};

const dependencies = {
  database: {
    check: async () => {}
  },
  queue: {
    check: async () => {}
  },
  search: {
    check: async () => {}
  }
};

const savedItemsStore = (calls: unknown[]): SavedItemsStore => ({
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
      metadataStatus: "fetched",
      metadataFetchedAt: "2026-06-23T12:00:00.000Z",
      faviconId: null,
      faviconUrl: null,
      createdAt: "2026-06-23T12:00:00.000Z",
      updatedAt: "2026-06-23T12:00:00.000Z"
    };
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
  }
});

describe("RPC OAuth scopes", () => {
  test("rejects bearer-authenticated writes without the write scope", async () => {
    const calls: unknown[] = [];
    const response = await rpcRequest({
      calls,
      oauthScopes: new Set(["read:saved_items"])
    });

    expect(response.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  test("allows session-authenticated writes without OAuth scope limits", async () => {
    const calls: unknown[] = [];
    const response = await rpcRequest({ calls });

    expect(response.status).toBe(200);
    expect(calls).toHaveLength(1);
  });
});

const rpcRequest = async ({
  calls,
  oauthScopes
}: {
  calls: unknown[];
  oauthScopes?: ReadonlySet<"read:saved_items" | "write:saved_items">;
}) => {
  const handler = new RPCHandler(
    createRpcRouter({
      currentUser,
      dependencies,
      oauthScopes,
      savedItemsStore: savedItemsStore(calls)
    })
  );
  const { matched, response } = await handler.handle(
    new Request("https://shelf.example/rpc/savedItems/create", {
      body: JSON.stringify({ json: { url: "https://example.com/article" } }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    }),
    { prefix: "/rpc" }
  );

  if (!matched || !response) {
    throw new Error("RPC route did not match");
  }

  return response;
};
