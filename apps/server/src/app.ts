import {
  authorizationRequiresConsent,
  createOAuthAuthorizationCode,
  exchangeOAuthAuthorizationCode,
  getOAuthAuthorizationServerMetadata,
  getShelfDiscovery,
  getRegistrationStatus,
  listConnectedApps,
  login,
  parseOAuthAuthorizationRequest,
  refreshOAuthTokens,
  resolveOAuthBearerToken,
  revokeConnectedApp,
  revokeOAuthToken,
  revokeSessionToken,
  resolveSessionToken,
  signup,
  type OAuthServerOptions,
  type OAuthScope,
  type RegistrationMode
} from "@shelf/api/auth";
import {
  createDatabaseSavedItemsStore,
  type SavedItemEnrichmentQueue,
  type SavedItemsStore,
  type SavedItemSearchIndex
} from "@shelf/api/savedItems";
import { getCurrentUserResponse } from "@shelf/api/currentUser";
import type { CurrentIdentity } from "@shelf/api/currentUser";
import type { Database } from "@shelf/api/db";
import { checkHealth, type HealthDependencies } from "@shelf/api/health";
import { createRpcRouter } from "@shelf/api/rpc";
import { RPCHandler } from "@orpc/server/fetch";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { cors } from "hono/cors";
import { rateLimiter } from "hono-rate-limiter";
import { extname, resolve, sep } from "node:path";

export interface AppOptions {
  dependencies: HealthDependencies & { db?: Database };
  currentUser?: CurrentIdentity;
  savedItemsStore?: SavedItemsStore;
  savedItemEnrichmentQueue?: SavedItemEnrichmentQueue;
  savedItemSearchIndex?: SavedItemSearchIndex;
  authMode?: "session" | "none";
  registrationMode?: RegistrationMode;
  allowedOrigins?: string[];
  oauth?: OAuthServerOptions;
  sessionCookieSecure?: boolean;
  staticDir?: string | null;
}

const SESSION_COOKIE_NAME = "shelf_session";

export const createApp = (options: AppOptions) => {
  const app = new Hono();
  const authMode = options.authMode ?? "session";
  const registrationMode = options.registrationMode ?? "first-user-only";
  const allowedOrigins = options.allowedOrigins ?? [];
  const savedItemsStore =
    options.savedItemsStore ??
    (options.dependencies.db ? createDatabaseSavedItemsStore(options.dependencies.db) : undefined);

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

  app.get("/.well-known/shelf", (context) =>
    context.json(getShelfDiscovery({ issuer: requestOrigin(context), options: options.oauth }))
  );

  app.get("/.well-known/oauth-authorization-server", (context) =>
    context.json(getOAuthAuthorizationServerMetadata({ issuer: requestOrigin(context) }))
  );

  app.get("/oauth/authorize", async (context) => {
    if (!options.dependencies.db) {
      return oauthErrorResponse(context, "invalid_request", 404);
    }

    let authorizationRequest: ReturnType<typeof parseOAuthAuthorizationRequest>;

    try {
      authorizationRequest = parseOAuthAuthorizationRequest(
        new URL(context.req.url).searchParams,
        oauthOptionsForRequest(context, options.oauth)
      );
    } catch (error) {
      return oauthErrorResponse(context, oauthErrorCode(error), 400);
    }

    const authContext = await resolveAuthContext(context);

    if (!authContext.currentUser) {
      const loginUrl = new URL("/", requestOrigin(context));
      loginUrl.searchParams.set("oauth_return", `${context.req.path}?${new URL(context.req.url).searchParams}`);

      return context.redirect(loginUrl.toString(), 302);
    }

    try {
      if (
        await authorizationRequiresConsent(
          options.dependencies.db,
          authContext.currentUser.user.id,
          authorizationRequest
        )
      ) {
        return context.html(consentPageHtml(authorizationRequest), 200);
      }

      const redirectUrl = await createOAuthAuthorizationCode(
        options.dependencies.db,
        authContext.currentUser,
        authorizationRequest,
        { approved: false }
      );

      return context.redirect(redirectUrl, 302);
    } catch (error) {
      return oauthErrorResponse(context, oauthErrorCode(error), 400);
    }
  });

  app.post("/oauth/authorize/consent", async (context) => {
    const originError = rejectDisallowedOrigin(context);

    if (originError) {
      return originError;
    }

    if (!options.dependencies.db) {
      return oauthErrorResponse(context, "invalid_request", 404);
    }

    const authContext = await resolveAuthContext(context);

    if (!authContext.currentUser) {
      return context.json({ error: "Authentication is required" }, 401);
    }

    const body = await readRequestBody(context.req.raw);
    const authorizationParams = new URLSearchParams();

    for (const [key, value] of Object.entries(body)) {
      authorizationParams.set(key, value);
    }

    let authorizationRequest: ReturnType<typeof parseOAuthAuthorizationRequest>;

    try {
      authorizationRequest = parseOAuthAuthorizationRequest(
        authorizationParams,
        oauthOptionsForRequest(context, options.oauth)
      );
    } catch (error) {
      return oauthErrorResponse(context, oauthErrorCode(error), 400);
    }

    if (body.decision !== "approve") {
      const redirectUrl = new URL(authorizationRequest.redirectUri);
      redirectUrl.searchParams.set("error", "access_denied");
      redirectUrl.searchParams.set("state", authorizationRequest.state);

      return context.redirect(redirectUrl.toString(), 302);
    }

    try {
      const redirectUrl = await createOAuthAuthorizationCode(
        options.dependencies.db,
        authContext.currentUser,
        authorizationRequest,
        { approved: true }
      );

      return context.redirect(redirectUrl, 302);
    } catch (error) {
      return oauthErrorResponse(context, oauthErrorCode(error), 400);
    }
  });

  app.post("/oauth/token", async (context) => {
    if (!options.dependencies.db) {
      return oauthErrorResponse(context, "invalid_request", 404);
    }

    const body = await readRequestBody(context.req.raw);

    try {
      const grantType = body.grant_type;
      const response =
        grantType === "authorization_code"
          ? await exchangeOAuthAuthorizationCode(options.dependencies.db, {
              clientId: body.client_id,
              code: body.code,
              redirectUri: body.redirect_uri,
              codeVerifier: body.code_verifier
            })
          : grantType === "refresh_token"
            ? await refreshOAuthTokens(options.dependencies.db, {
                clientId: body.client_id,
                refreshToken: body.refresh_token
              })
            : null;

      if (!response) {
        return oauthErrorResponse(context, "unsupported_grant_type", 400);
      }

      context.header("cache-control", "no-store");
      context.header("pragma", "no-cache");

      return context.json(response);
    } catch (error) {
      return oauthErrorResponse(context, oauthErrorCode(error), 400);
    }
  });

  app.post("/oauth/revoke", async (context) => {
    if (!options.dependencies.db) {
      return context.body(null, 200);
    }

    const body = await readRequestBody(context.req.raw);

    if (body.token) {
      await revokeOAuthToken(options.dependencies.db, {
        clientId: body.client_id || null,
        token: body.token
      });
    }

    return context.body(null, 200);
  });

  app.get("/auth/session", async (context) => {
    const { currentUser } = await resolveAuthContext(context);
    const registration = options.dependencies.db
      ? await getRegistrationStatus(options.dependencies.db, registrationMode)
      : { available: false, mode: registrationMode };

    return context.json({
      registration,
      user: currentUser ? getCurrentUserResponse(currentUser) : null
    });
  });

  app.get("/auth/connected-apps", async (context) => {
    const { currentUser } = await resolveAuthContext(context);

    if (!currentUser || !options.dependencies.db) {
      return context.json({ error: "Authentication is required" }, 401);
    }

    return context.json({ apps: await listConnectedApps(options.dependencies.db, currentUser) });
  });

  app.post("/auth/connected-apps/:grantId/revoke", async (context) => {
    const originError = rejectDisallowedOrigin(context);

    if (originError) {
      return originError;
    }

    const { currentUser } = await resolveAuthContext(context);

    if (!currentUser || !options.dependencies.db) {
      return context.json({ error: "Authentication is required" }, 401);
    }

    await revokeConnectedApp(options.dependencies.db, currentUser, context.req.param("grantId"));

    return context.json({ ok: true });
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
    const { currentUser } = await resolveAuthContext(context);

    if (!currentUser) {
      return context.json({ error: "No current user is configured" }, 401);
    }

    return context.json(getCurrentUserResponse(currentUser));
  });

  app.get("/favicons/:id", async (context) => {
    if (!savedItemsStore) {
      return context.notFound();
    }

    const favicon = await savedItemsStore.getFavicon(context.req.param("id"));

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

    const { currentUser, oauthScopes } = await resolveAuthContext(context);
    const rpcHandler = new RPCHandler(
      createRpcRouter({
        savedItemsStore,
        savedItemEnrichmentQueue: options.savedItemEnrichmentQueue,
        currentUser: currentUser ?? undefined,
        oauthScopes,
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

  if (options.staticDir) {
    const staticRoot = resolve(options.staticDir);

    app.get("*", async (context) => {
      const response = await readStaticResponse(staticRoot, context.req.path);

      return response ?? context.notFound();
    });
  }

  return app;

  async function resolveAuthContext(context: Parameters<typeof getCookie>[0]): Promise<{
    currentUser: CurrentIdentity | null;
    oauthScopes?: ReadonlySet<OAuthScope>;
  }> {
    if (options.currentUser) {
      return { currentUser: options.currentUser };
    }

    if (authMode !== "session" || !options.dependencies.db) {
      return { currentUser: null };
    }

    const bearerToken = readBearerToken(context.req.header("authorization"));

    if (bearerToken) {
      const identity = await resolveOAuthBearerToken(options.dependencies.db, bearerToken);

      if (identity) {
        return {
          currentUser: identity.currentUser,
          oauthScopes: new Set(identity.scopes)
        };
      }
    }

    return {
      currentUser: await resolveSessionToken(
        options.dependencies.db,
        getCookie(context, SESSION_COOKIE_NAME)
      )
    };
  }

  function rejectDisallowedOrigin(context: Parameters<typeof getCookie>[0]) {
    const method = context.req.method.toUpperCase();

    if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
      return null;
    }

    const origin = context.req.header("origin");

    if (!origin || (!allowedOrigins.includes(origin) && origin !== requestOrigin(context))) {
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

const requestOrigin = (context: Parameters<typeof getCookie>[0]) => {
  const forwardedHost = context.req.header("x-forwarded-host");
  const requestUrl = new URL(context.req.url);
  const host = forwardedHost ?? context.req.header("host") ?? requestUrl.host;

  if (!host) {
    return requestUrl.origin;
  }

  const forwardedProto = context.req.header("x-forwarded-proto");
  const protocol = forwardedProto ?? requestUrl.protocol.replace(/:$/, "");

  return `${protocol}://${host}`;
};

const oauthOptionsForRequest = (
  context: Parameters<typeof getCookie>[0],
  configuredOptions: OAuthServerOptions | undefined
): OAuthServerOptions => {
  if (typeof configuredOptions?.developmentRedirects === "boolean") {
    return configuredOptions;
  }

  return {
    ...configuredOptions,
    developmentRedirects: isLocalDevelopmentOrigin(requestOrigin(context))
  };
};

const isLocalDevelopmentOrigin = (origin: string) => {
  try {
    const url = new URL(origin);

    if (url.protocol !== "http:") {
      return false;
    }

    return (
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname === "[::1]" ||
      url.hostname === "::1"
    );
  } catch {
    return false;
  }
};

const readBearerToken = (authorization: string | undefined) => {
  if (!authorization) {
    return null;
  }

  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());

  return match?.[1] ?? null;
};

const readRequestBody = async (request: Request): Promise<Record<string, string>> => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(body).flatMap(([key, value]) =>
        typeof value === "string" ? [[key, value]] : []
      )
    );
  }

  const formData = await request.formData().catch(() => null);

  if (!formData) {
    return {};
  }

  const body: Record<string, string> = {};

  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") {
      body[key] = value;
    }
  }

  return body;
};

const consentPageHtml = (request: ReturnType<typeof parseOAuthAuthorizationRequest>) => {
  const fields = {
    response_type: request.responseType,
    client_id: request.clientId,
    redirect_uri: request.redirectUri,
    scope: request.scopes.join(" "),
    state: request.state,
    code_challenge: request.codeChallenge,
    code_challenge_method: request.codeChallengeMethod,
    device_name: request.deviceName ?? "",
    platform: request.platform ?? "",
    browser: request.browser ?? "",
    extension_version: request.extensionVersion ?? ""
  };
  const hiddenFields = Object.entries(fields)
    .map(
      ([key, value]) =>
        `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(value)}">`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Connect Shelf</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      main { width: min(420px, calc(100vw - 32px)); border: 1px solid #e5e7eb; border-radius: 8px; background: #fff; padding: 20px; box-shadow: 0 1px 2px rgb(15 23 42 / 8%); }
      h1 { margin: 0 0 8px; font-size: 18px; line-height: 1.4; }
      p { margin: 0 0 14px; color: #475569; font-size: 14px; line-height: 1.5; }
      ul { margin: 0 0 18px; padding-left: 18px; color: #334155; font-size: 14px; line-height: 1.5; }
      .actions { display: flex; gap: 10px; }
      button { height: 40px; border-radius: 8px; border: 1px solid #d1d5db; padding: 0 14px; font: inherit; font-size: 14px; font-weight: 600; background: white; color: #111827; cursor: pointer; }
      button.primary { border-color: #0f172a; background: #0f172a; color: white; }
    </style>
  </head>
  <body>
    <main>
      <h1>Connect ${escapeHtml(clientLabel(request.clientId))}</h1>
      <p>This app wants access to your Shelf account.</p>
      <ul>${request.scopes.map((scope) => `<li>${escapeHtml(scopeLabel(scope))}</li>`).join("")}</ul>
      <form method="post" action="/oauth/authorize/consent">
        ${hiddenFields}
        <div class="actions">
          <button class="primary" type="submit" name="decision" value="approve">Allow</button>
          <button type="submit" name="decision" value="deny">Deny</button>
        </div>
      </form>
    </main>
  </body>
</html>`;
};

const clientLabel = (clientId: string) =>
  clientId === "browser-extension"
    ? "Shelf Browser Extension"
    : clientId === "raycast-extension"
      ? "Raycast"
      : "Shelf client";

const scopeLabel = (scope: string) =>
  scope === "read:saved_items"
    ? "Read saved items, folders, and tags"
    : scope === "write:saved_items"
      ? "Create and change saved items, folders, and tags"
      : scope;

const escapeHtml = (value: string) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");

const oauthErrorCode = (error: unknown) =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : "invalid_request";

const oauthErrorResponse = (
  context: Parameters<typeof getCookie>[0],
  error: string,
  status: 400 | 404
) => context.json({ error }, status);

const readStaticResponse = async (staticRoot: string, requestPath: string) => {
  const pathname = safeDecodePath(requestPath);

  if (!pathname) {
    return null;
  }

  const assetPath = pathname === "/" ? "/index.html" : pathname;
  const requestedFile = resolve(staticRoot, `.${assetPath}`);
  const fileResponse = await responseFromFile(staticRoot, requestedFile, assetPath);

  if (fileResponse) {
    return fileResponse;
  }

  if (extname(pathname)) {
    return null;
  }

  return responseFromFile(staticRoot, resolve(staticRoot, "index.html"), "/index.html");
};

const safeDecodePath = (requestPath: string) => {
  try {
    return decodeURIComponent(requestPath.split("?")[0] ?? "/");
  } catch {
    return null;
  }
};

const responseFromFile = async (staticRoot: string, filePath: string, requestPath: string) => {
  if (!isInsideRoot(staticRoot, filePath)) {
    return null;
  }

  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    return null;
  }

  const headers = new Headers();

  if (file.type) {
    headers.set("content-type", file.type);
  }

  headers.set(
    "cache-control",
    requestPath.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : "no-cache"
  );

  return new Response(file, { headers });
};

const isInsideRoot = (staticRoot: string, filePath: string) =>
  filePath === staticRoot || filePath.startsWith(`${staticRoot}${sep}`);

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
