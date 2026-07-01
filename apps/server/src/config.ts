import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { OAuthServerOptions, RegistrationMode } from "@shelf/api/auth";
import type { GitHubOAuthOptions } from "@shelf/api/integrations";

export type AuthMode = "session" | "none";

export interface ServerConfig {
  port: number;
  databaseUrl: string;
  redisUrl: string;
  meilisearchUrl: string;
  meilisearchMasterKey: string | null;
  authMode: AuthMode;
  registrationMode: RegistrationMode;
  appOrigin: string;
  allowedOrigins: string[];
  oauth: OAuthServerOptions;
  githubOAuth: GitHubOAuthOptions;
  sessionCookieSecure: boolean;
  staticDir: string | null;
}

const serverSourceDir = dirname(fileURLToPath(import.meta.url));

const loadDotEnvFile = (path: string) => {
  if (!existsSync(path)) {
    return;
  }

  const contents = readFileSync(path, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    const value =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;

    if (Bun.env[key] === undefined) {
      Bun.env[key] = value;
    }
  }
};

loadDotEnvFile(resolve(serverSourceDir, "../../../.env"));
loadDotEnvFile(resolve(serverSourceDir, "../.env"));
loadDotEnvFile(resolve(process.cwd(), ".env"));

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
    const origins = [`http://localhost:5173`, `http://127.0.0.1:5173`, `http://localhost:${port}`];

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

const appOriginFromEnv = () => {
  const configuredOrigin =
    optionalStringFromEnv("SHELF_APP_ORIGIN") ??
    optionalStringFromEnv("WEB_ORIGIN") ??
    optionalStringFromEnv("APP_ORIGIN");

  if (configuredOrigin && !configuredOrigin.includes(",")) {
    return configuredOrigin;
  }

  if (Bun.env.RAILWAY_PUBLIC_DOMAIN) {
    return `https://${Bun.env.RAILWAY_PUBLIC_DOMAIN}`;
  }

  return "http://localhost:5173";
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

const optionalBooleanFromEnv = (name: string) => {
  const value = Bun.env[name];

  if (!value) {
    return undefined;
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
      redirectUris: listFromEnv("OAUTH_BROWSER_EXTENSION_REDIRECT_URIS"),
    },
    "raycast-extension": {
      redirectUris: listFromEnv("OAUTH_RAYCAST_EXTENSION_REDIRECT_URIS"),
    },
  },
  developmentRedirects: optionalBooleanFromEnv("OAUTH_DEV_REDIRECTS"),
});

const githubOAuthFromEnv = (): GitHubOAuthOptions => ({
  clientId:
    optionalStringFromEnv("GITHUB_OAUTH_CLIENT_ID") ?? optionalStringFromEnv("GITHUB_CLIENT_ID"),
  clientSecret:
    optionalStringFromEnv("GITHUB_OAUTH_CLIENT_SECRET") ??
    optionalStringFromEnv("GITHUB_CLIENT_SECRET"),
  redirectUri: optionalStringFromEnv("GITHUB_OAUTH_REDIRECT_URI"),
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
    databaseUrl: Bun.env.DATABASE_URL ?? "postgres://shelf:shelf@localhost:5432/shelf",
    redisUrl: Bun.env.REDIS_URL ?? "redis://localhost:6379",
    meilisearchUrl: Bun.env.MEILISEARCH_URL ?? "http://localhost:7700",
    meilisearchMasterKey: optionalStringFromEnv("MEILI_MASTER_KEY"),
    authMode,
    registrationMode: registrationModeFromEnv(),
    appOrigin: appOriginFromEnv(),
    allowedOrigins: allowedOriginsFromEnv(port),
    oauth: oauthFromEnv(),
    githubOAuth: githubOAuthFromEnv(),
    sessionCookieSecure: sessionCookieSecureFromEnv(),
    staticDir: staticDirFromEnv(),
  };
};
