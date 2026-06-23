import type { OAuthServerOptions, RegistrationMode } from "@shelf/api/auth";

export type AuthMode = "session" | "none";

export interface ServerConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  meilisearchUrl: string;
  meilisearchMasterKey: string | null;
  authMode: AuthMode;
  registrationMode: RegistrationMode;
  allowedOrigins: string[];
  oauth: OAuthServerOptions;
  sessionCookieSecure: boolean;
  staticDir: string | null;
}

const numberFromEnv = (name: string, fallback: number): number => {
  const value = Bun.env[name];
  if (!value) {
    return fallback;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  throw new Error(`${name} must be a number`);
};

const authModeFromEnv = (): AuthMode => {
  const value = Bun.env.AUTH_MODE;

  if (!value) {
    return "session";
  }

  if (value === "session" || value === "none") {
    return value;
  }

  throw new Error("AUTH_MODE must be session or none");
};

const registrationModeFromEnv = (): RegistrationMode => {
  const value = Bun.env.REGISTRATION_MODE;

  if (!value) {
    return "first-user-only";
  }

  if (value === "first-user-only" || value === "open" || value === "closed") {
    return value;
  }

  throw new Error("REGISTRATION_MODE must be first-user-only, open, or closed");
};

const allowedOriginsFromEnv = (port: number) => {
  const value = Bun.env.APP_ORIGINS ?? Bun.env.APP_ORIGIN;

  if (!value) {
    const origins = [
      `http://localhost:5173`,
      `http://127.0.0.1:5173`,
      `http://localhost:${port}`
    ];

    if (Bun.env.RAILWAY_PUBLIC_DOMAIN) {
      origins.push(`https://${Bun.env.RAILWAY_PUBLIC_DOMAIN}`);
    }

    return origins;
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const sessionCookieSecureFromEnv = () => {
  const value = Bun.env.SESSION_COOKIE_SECURE;

  if (!value) {
    return Bun.env.NODE_ENV === "production";
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error("SESSION_COOKIE_SECURE must be true or false");
};

const booleanFromEnv = (name: string, fallback: boolean) => {
  const value = Bun.env[name];

  if (!value) {
    return fallback;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new Error(`${name} must be true or false`);
};

const listFromEnv = (name: string) =>
  (Bun.env[name] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const oauthFromEnv = (): OAuthServerOptions => ({
  clients: {
    "browser-extension": {
      redirectUris: listFromEnv("OAUTH_BROWSER_EXTENSION_REDIRECT_URIS")
    },
    "raycast-extension": {
      redirectUris: listFromEnv("OAUTH_RAYCAST_EXTENSION_REDIRECT_URIS")
    }
  },
  developmentRedirects: booleanFromEnv("OAUTH_DEV_REDIRECTS", Bun.env.NODE_ENV !== "production")
});

const staticDirFromEnv = () => {
  if (Bun.env.SHELF_STATIC_DIR) {
    return Bun.env.SHELF_STATIC_DIR;
  }

  if (Bun.env.NODE_ENV === "production") {
    return "apps/web/dist";
  }

  return null;
};

const optionalStringFromEnv = (name: string) => {
  const value = Bun.env[name]?.trim();

  return value ? value : null;
};

export const getConfig = (): ServerConfig => {
  const port = numberFromEnv("PORT", 3000);
  const authMode = authModeFromEnv();

  return {
    port,
    databaseUrl:
      Bun.env.DATABASE_URL ?? "postgres://shelf:shelf@localhost:5432/shelf",
    redisUrl: Bun.env.REDIS_URL ?? "redis://localhost:6379",
    meilisearchUrl: Bun.env.MEILISEARCH_URL ?? "http://localhost:7700",
    meilisearchMasterKey: optionalStringFromEnv("MEILI_MASTER_KEY"),
    authMode,
    registrationMode: registrationModeFromEnv(),
    allowedOrigins: allowedOriginsFromEnv(port),
    oauth: oauthFromEnv(),
    sessionCookieSecure: sessionCookieSecureFromEnv(),
    staticDir: staticDirFromEnv()
  };
};
