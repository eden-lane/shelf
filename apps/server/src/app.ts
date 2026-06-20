import { createDatabaseBookmarksStore, type BookmarksStore } from "@bookmarks/api/bookmarks";
import { getCurrentUserResponse } from "@bookmarks/api/currentUser";
import type { Database } from "@bookmarks/api/db";
import type { DevIdentity } from "@bookmarks/api/identity";
import { checkHealth, type HealthDependencies } from "@bookmarks/api/health";
import { createRpcRouter } from "@bookmarks/api/rpc";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";

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

    return context.json(getCurrentUserResponse(options.currentUser));
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
