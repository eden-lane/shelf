import { RPCHandler } from "@orpc/server/fetch";
import type { CurrentUserResponse } from "@bookmarks/shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { createDatabaseBookmarksStore, type BookmarksStore } from "./bookmarks";
import type { Database } from "./db";
import type { DevIdentity } from "./devIdentity";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";
import { createRpcRouter } from "./rpc";

export interface AppOptions {
  dependencies: HealthDependencies & { db?: Database };
  currentUser?: DevIdentity;
  bookmarksStore?: BookmarksStore;
}

export const createApp = (options: AppOptions) => {
  const app = new Hono();
  const bookmarksStore =
    options.bookmarksStore ??
    (options.dependencies.db ? createDatabaseBookmarksStore(options.dependencies.db) : undefined);
  const rpcHandler = new RPCHandler(
    createRpcRouter({
      bookmarksStore,
      currentUser: options.currentUser,
      dependencies: options.dependencies
    })
  );

  app.use("*", cors());

  app.get("/health", async (context) => {
    const health = await checkHealth(options.dependencies);

    return context.json(health, health.status === "ok" ? 200 : 503);
  });

  app.get("/me", (context) => {
    if (!options.currentUser) {
      return context.json({ error: "No current user is configured" }, 401);
    }

    const response: CurrentUserResponse = {
      user: {
        id: options.currentUser.userId,
        email: options.currentUser.email,
        name: options.currentUser.name
      },
      organization: {
        id: options.currentUser.organizationId,
        name: options.currentUser.organizationName,
        slug: options.currentUser.organizationSlug,
        role: "owner"
      },
      libraries: [
        {
          id: options.currentUser.personalLibraryId,
          kind: "personal",
          name: options.currentUser.personalLibraryName,
          inboxFolderId: options.currentUser.personalInboxFolderId
        },
        {
          id: options.currentUser.organizationLibraryId,
          kind: "organization",
          name: options.currentUser.organizationLibraryName,
          inboxFolderId: options.currentUser.organizationInboxFolderId,
          organizationId: options.currentUser.organizationId,
          organizationSlug: options.currentUser.organizationSlug
        }
      ]
    };

    return context.json(response);
  });

  app.all("/rpc/*", async (context) => {
    const { matched, response } = await rpcHandler.handle(context.req.raw, {
      prefix: "/rpc"
    });

    if (matched) {
      return response;
    }

    return context.notFound();
  });

  return app;
};
