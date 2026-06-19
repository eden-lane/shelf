export type CoreServiceStatus = "ok" | "error";
export type WorkerServiceStatus = "ok" | "stale" | "missing" | "error";

export interface HealthResponse {
  status: "ok" | "degraded";
  services: {
    database: CoreServiceStatus;
    queue: CoreServiceStatus;
    worker: WorkerServiceStatus;
    search: CoreServiceStatus;
  };
  checkedAt: string;
}
