import {
  getRegistrationStatus,
  login,
  revokeSessionToken,
  resolveSessionToken,
  signup,
  type RegistrationMode
} from "@bookmarks/api/auth";
import {
  createDatabaseBookmarksStore,
  type BookmarkEnrichmentQueue,
  type BookmarksStore,
  type SavedItemSearchIndex
} from "@bookmarks/api/bookmarks";
import { getCurrentUserResponse } from "@bookmarks/api/currentUser";
import type { CurrentIdentity } from "@bookmarks/api/currentUser";
import type { Database } from "@bookmarks/api/db";
import { checkHealth, type HealthDependencies } from "@bookmarks/api/health";
import { createRpcRouter } from "@bookmarks/api/rpc";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";

export interface AppOptions {
  dependencies: HealthDependencies & { db?: Database };
  currentUser?: CurrentIdentity;
  bookmarksStore?: BookmarksStore;
  bookmarkEnrichmentQueue?: BookmarkEnrichmentQueue;
  savedItemSearchIndex?: SavedItemSearchIndex;
  authMode?: "session" | "none";
  registrationMode?: RegistrationMode;
  allowedOrigins?: string[];
  sessionCookieSecure?: boolean;
}

const SESSION_COOKIE_NAME = "bookmarks_session";

export const createApp = (options: AppOptions) => {
  const app = new Hono();
  const authMode = options.authMode ?? "session";
  const registrationMode = options.registrationMode ?? "first-user-only";
  const allowedOrigins = options.allowedOrigins ?? [];
  const bookmarksStore =
    options.bookmarksStore ??
    (options.dependencies.db ? createDatabaseBookmarksStore(options.dependencies.db) : undefined);

  app.use(
    "*",
    allowedOrigins.length > 0
      ? cors({
          credentials: true,
          origin: allowedOrigins
        })
      : cors()
  );

  const authLimiter = rateLimiter({
    keyGenerator: (context) =>
      context.req.header("x-forwarded-for") ??
      context.req.header("cf-connecting-ip") ??
      context.req.header("x-real-ip") ??
      "anonymous",
    limit: 10,
    standardHeaders: "draft-6",
    windowMs: 60 * 1000
  });

  app.get("/health", async (context) => {
    const health = await checkHealth(options.dependencies);

    return context.json(health, health.status === "ok" ? 200 : 503);
  });

  app.get("/auth/session", async (context) => {
    const currentUser = await resolveCurrentUser(context);
    const registration = options.dependencies.db
      ? await getRegistrationStatus(options.dependencies.db, registrationMode)
      : { available: false, mode: registrationMode };

    return context.json({
      registration,
      user: currentUser ? getCurrentUserResponse(currentUser) : null
    });
  });

  app.post("/auth/signup", authLimiter, async (context) => {
    const originError = rejectDisallowedOrigin(context);

    if (originError) {
      return originError;
    }

    if (authMode !== "session" || !options.dependencies.db) {
      return context.json({ error: "Session auth is not configured" }, 404);
    }

    const body = await context.req.json().catch(() => null);

    try {
      const session = await signup(options.dependencies.db, registrationMode, {
        email: readString(body, "email"),
        locale: readOptionalString(body, "locale"),
        name: readOptionalString(body, "name"),
        password: readString(body, "password"),
        username: readOptionalString(body, "username")
      });

      writeSessionCookie(context, session.token, session.expiresAt);

      return context.json({
        user: getCurrentUserResponse(session.currentUser)
      });
    } catch (error) {
      return authErrorResponse(context, error);
    }
  });

  app.post("/auth/login", authLimiter, async (context) => {
    const originError = rejectDisallowedOrigin(context);

    if (originError) {
      return originError;
    }

    if (authMode !== "session" || !options.dependencies.db) {
      return context.json({ error: "Session auth is not configured" }, 404);
    }

    const body = await context.req.json().catch(() => null);

    try {
      const session = await login(options.dependencies.db, {
        email: readString(body, "email"),
        password: readString(body, "password")
      });

      writeSessionCookie(context, session.token, session.expiresAt);

      return context.json({
        user: getCurrentUserResponse(session.currentUser)
      });
    } catch (error) {
      return authErrorResponse(context, error);
    }
  });

  app.post("/auth/logout", async (context) => {
    const originError = rejectDisallowedOrigin(context);

    if (originError) {
      return originError;
    }

    if (options.dependencies.db) {
      await revokeSessionToken(options.dependencies.db, getCookie(context, SESSION_COOKIE_NAME));
    }

    deleteCookie(context, SESSION_COOKIE_NAME, {
      path: "/"
    });

    return context.json({ ok: true });
  });

  app.get("/me", async (context) => {
    const currentUser = await resolveCurrentUser(context);

    if (!currentUser) {
      return context.json({ error: "No current user is configured" }, 401);
    }

    return context.json(getCurrentUserResponse(currentUser));
  });

  app.get("/favicons/:id", async (context) => {
    if (!bookmarksStore) {
      return context.notFound();
    }

    const favicon = await bookmarksStore.getFavicon(context.req.param("id"));

    if (!favicon) {
      return context.notFound();
    }

    return new Response(new Uint8Array(favicon.imageBytes), {
      headers: {
        "cache-control": "public, max-age=604800, immutable",
        "content-length": String(favicon.imageBytes.byteLength),
        "content-type": favicon.contentType
      }
    });
  });

  app.all("/rpc/*", async (context) => {
    const originError = getCookie(context, SESSION_COOKIE_NAME)
      ? rejectDisallowedOrigin(context)
      : null;

    if (originError) {
      return originError;
    }

    const currentUser = await resolveCurrentUser(context);
    const rpcHandler = new RPCHandler(
      createRpcRouter({
        bookmarksStore,
        bookmarkEnrichmentQueue: options.bookmarkEnrichmentQueue,
        currentUser: currentUser ?? undefined,
        dependencies: options.dependencies,
        savedItemSearchIndex: options.savedItemSearchIndex
      })
    );
    const { matched, response } = await rpcHandler.handle(context.req.raw, {
      prefix: "/rpc"
    });

    if (matched) {
      return response;
    }

    return context.notFound();
  });

  return app;

  async function resolveCurrentUser(context: Parameters<typeof getCookie>[0]) {
    if (options.currentUser) {
      return options.currentUser;
    }

    if (authMode !== "session" || !options.dependencies.db) {
      return null;
    }

    return resolveSessionToken(options.dependencies.db, getCookie(context, SESSION_COOKIE_NAME));
  }

  function rejectDisallowedOrigin(context: Parameters<typeof getCookie>[0]) {
    const method = context.req.method.toUpperCase();

    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return null;
    }

    const origin = context.req.header("origin");

    if (!origin || !allowedOrigins.includes(origin)) {
      return context.json({ error: "Origin is not allowed" }, 403);
    }

    return null;
  }

  function writeSessionCookie(
    context: Parameters<typeof setCookie>[0],
    token: string,
    expiresAt: Date
  ) {
    setCookie(context, SESSION_COOKIE_NAME, token, {
      expires: expiresAt,
      httpOnly: true,
      path: "/",
      sameSite: "Lax",
      secure: options.sessionCookieSecure ?? false
    });
  }
};

const readString = (body: unknown, key: string) => {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return "";
  }

  const value = key in body ? body[key as keyof typeof body] : null;

  return typeof value === "string" ? value : "";
};

const readOptionalString = (body: unknown, key: string) => {
  const value = readString(body, key);

  return value ? value : null;
};

const authErrorResponse = (context: Parameters<typeof getCookie>[0], error: unknown) => {
  const code =
    error instanceof Error && "code" in error && typeof error.code === "string"
      ? error.code
      : null;

  if (code === "registration_closed") {
    return context.json({ error: "Registration is closed for this instance" }, 403);
  }

  if (code === "email_taken") {
    return context.json({ error: "Email is already registered" }, 409);
  }

  if (code === "username_taken") {
    return context.json({ error: "Username is already registered" }, 409);
  }

  if (code === "invalid_credentials") {
    return context.json({ error: "Email or password is incorrect" }, 401);
  }

  if (code === "invalid_input") {
    return context.json({ error: "Enter a valid email and password" }, 400);
  }

  console.error("Auth request failed", error);

  return context.json({ error: "Authentication failed" }, 500);
};
