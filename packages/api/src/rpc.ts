import { os } from "@orpc/server";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";

export const createRpcRouter = (
  dependencies: HealthDependencies,
  options: {
    workerName: string;
    workerHeartbeatStaleAfterMs: number;
  }
) => ({
  health: os.handler(() =>
    checkHealth(dependencies, {
      workerName: options.workerName,
      workerHeartbeatStaleAfterMs: options.workerHeartbeatStaleAfterMs
    })
  )
});

export type RpcRouter = ReturnType<typeof createRpcRouter>;
