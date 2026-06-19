import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";
import { createRpcRouter } from "./rpc";

export interface AppOptions {
  dependencies: HealthDependencies;
}

export const createApp = (options: AppOptions) => {
  const app = new Hono();
  const rpcHandler = new RPCHandler(createRpcRouter(options.dependencies));

  app.use("*", cors());

  app.get("/health", async (context) => {
    const health = await checkHealth(options.dependencies);

    return context.json(health, health.status === "ok" ? 200 : 503);
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
