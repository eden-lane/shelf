import { os } from "@orpc/server";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";

export const createRpcRouter = (dependencies: HealthDependencies) => ({
  health: os.handler(() => checkHealth(dependencies))
});

export type RpcRouter = ReturnType<typeof createRpcRouter>;
