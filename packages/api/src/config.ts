export interface ApiConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  meilisearchUrl: string;
  authMode: AuthMode;
}

export type AuthMode = "dev" | "none";

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Bun.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number`);
  }

  return parsed;
};

const authModeFromEnv = (): AuthMode => {
  const value = Bun.env.AUTH_MODE;

  if (!value) {
    return Bun.env.NODE_ENV === "production" ? "none" : "dev";
  }

  if (value === "dev" || value === "none") {
    return value;
  }

  throw new Error("AUTH_MODE must be either dev or none");
};

export const getConfig = (): ApiConfig => ({
  port: numberFromEnv("PORT", 3000),
  databaseUrl:
    Bun.env.DATABASE_URL ?? "postgres://bookmarks:bookmarks@localhost:5432/bookmarks",
  redisUrl: Bun.env.REDIS_URL ?? "redis://localhost:6379",
  meilisearchUrl: Bun.env.MEILISEARCH_URL ?? "http://localhost:7700",
  authMode: authModeFromEnv()
});
