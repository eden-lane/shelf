export type CoreServiceStatus = "ok" | "error";

export interface HealthResponse {
  status: "ok" | "degraded";
  services: {
    database: CoreServiceStatus;
    queue: CoreServiceStatus;
    search: CoreServiceStatus;
  };
  checkedAt: string;
}
