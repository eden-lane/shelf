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

export interface CurrentUserResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    role: "owner";
  };
}
