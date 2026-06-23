import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { getCurrentUserResponse, type CurrentIdentity } from "../currentUser";
import type { Database } from "../db";
import { schema } from "../db";
import { loadCurrentIdentity } from "./service";

export const OAUTH_SCOPES = ["read:saved_items", "write:saved_items"] as const;

export type OAuthScope = (typeof OAUTH_SCOPES)[number];
export type OAuthClientId = "browser-extension" | "raycast-extension";

export interface OAuthClientDefinition {
  id: OAuthClientId;
  name: string;
  redirectUris: string[];
  scopes: OAuthScope[];
}

export interface OAuthServerOptions {
  clients?: Partial<Record<OAuthClientId, { redirectUris?: string[] }>>;
  developmentRedirects?: boolean;
}

export interface OAuthAuthorizationRequest {
  responseType: "code";
  clientId: OAuthClientId;
  redirectUri: string;
  scopes: OAuthScope[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  deviceName?: string | null;
  platform?: string | null;
  browser?: string | null;
  extensionVersion?: string | null;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface OAuthBearerIdentity {
  currentUser: CurrentIdentity;
  scopes: OAuthScope[];
  grantId: string;
}

export interface ConnectedApp {
  id: string;
  clientId: string;
  clientName: string;
  deviceName: string | null;
  platform: string | null;
  browser: string | null;
  scopes: OAuthScope[];
  createdAt: string;
  lastUsedAt: string | null;
}

const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const LAST_USED_REFRESH_AFTER_MS = 5 * 60 * 1000;

export class OAuthError extends Error {
  constructor(
    public readonly code:
      | "access_denied"
      | "consent_required"
      | "invalid_client"
      | "invalid_grant"
      | "invalid_redirect_uri"
      | "invalid_request"
      | "invalid_scope"
      | "unsupported_grant_type"
      | "unsupported_response_type"
  ) {
    super(code);
  }
}

export const getOAuthClientDefinitions = (
  options: OAuthServerOptions = {}
): Record<OAuthClientId, OAuthClientDefinition> => {
  const clients: Record<OAuthClientId, OAuthClientDefinition> = {
    "browser-extension": {
      id: "browser-extension",
      name: "Shelf Browser Extension",
      redirectUris: [],
      scopes: [...OAUTH_SCOPES]
    },
    "raycast-extension": {
      id: "raycast-extension",
      name: "Raycast",
      redirectUris: [],
      scopes: [...OAUTH_SCOPES]
    }
  };

  for (const clientId of Object.keys(clients) as OAuthClientId[]) {
    clients[clientId] = {
      ...clients[clientId],
      redirectUris: options.clients?.[clientId]?.redirectUris ?? clients[clientId].redirectUris
    };
  }

  return clients;
};

export const getShelfDiscovery = ({
  issuer,
  version = "0.1.0",
  options
}: {
  issuer: string;
  version?: string;
  options?: OAuthServerOptions;
}) => {
  const clients = getOAuthClientDefinitions(options);

  return {
    name: "Shelf",
    version,
    auth: {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      revocation_endpoint: `${issuer}/oauth/revoke`
    },
    clients: {
      "browser-extension": clients["browser-extension"].redirectUris.length > 0,
      "raycast-extension": clients["raycast-extension"].redirectUris.length > 0
    }
  };
};

export const getOAuthAuthorizationServerMetadata = ({
  issuer
}: {
  issuer: string;
}) => ({
  issuer,
  authorization_endpoint: `${issuer}/oauth/authorize`,
  token_endpoint: `${issuer}/oauth/token`,
  revocation_endpoint: `${issuer}/oauth/revoke`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  scopes_supported: [...OAUTH_SCOPES]
});

export const parseOAuthAuthorizationRequest = (
  params: URLSearchParams,
  options: OAuthServerOptions = {}
): OAuthAuthorizationRequest => {
  const responseType = params.get("response_type");

  if (responseType !== "code") {
    throw new OAuthError("unsupported_response_type");
  }

  const clientId = parseOAuthClientId(params.get("client_id"));
  const clients = getOAuthClientDefinitions(options);
  const client = clientId ? clients[clientId] : null;

  if (!clientId || !client) {
    throw new OAuthError("invalid_client");
  }

  const redirectUri = params.get("redirect_uri");

  if (!redirectUri || !isAllowedRedirectUri(redirectUri, client, options)) {
    throw new OAuthError("invalid_redirect_uri");
  }

  const scopes = parseRequestedScopes(params.get("scope"));

  if (scopes.length === 0 || scopes.some((scope) => !client.scopes.includes(scope))) {
    throw new OAuthError("invalid_scope");
  }

  const state = params.get("state");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");

  if (!state || !codeChallenge || codeChallengeMethod !== "S256") {
    throw new OAuthError("invalid_request");
  }

  return {
    responseType,
    clientId,
    redirectUri,
    scopes,
    state,
    codeChallenge,
    codeChallengeMethod,
    deviceName: optionalParam(params, "device_name"),
    platform: optionalParam(params, "platform"),
    browser: optionalParam(params, "browser"),
    extensionVersion: optionalParam(params, "extension_version")
  };
};

export const authorizationRequiresConsent = async (
  db: Database,
  userId: string,
  request: OAuthAuthorizationRequest
) => {
  const grant = await findCoveringGrant(db, userId, request.clientId, request.scopes);

  return !grant;
};

export const createOAuthAuthorizationCode = async (
  db: Database,
  currentUser: CurrentIdentity,
  request: OAuthAuthorizationRequest,
  { approved }: { approved: boolean }
) => {
  const clients = getOAuthClientDefinitions();
  const client = clients[request.clientId];
  const existingGrant = await findCoveringGrant(db, currentUser.user.id, request.clientId, request.scopes);

  if (!existingGrant && !approved) {
    throw new OAuthError("consent_required");
  }

  const code = randomToken();
  const codeHash = hashOpaqueToken(code);
  const expiresAt = new Date(Date.now() + AUTHORIZATION_CODE_TTL_MS);
  const scopes = serializeScopes(request.scopes);
  const grantId =
    existingGrant?.id ??
    (await createGrant(db, {
      userId: currentUser.user.id,
      clientId: request.clientId,
      clientName: client.name,
      deviceName: request.deviceName,
      platform: request.platform,
      browser: request.browser,
      scopes
    }));

  await db.insert(schema.oauthAuthorizationCodes).values({
    clientId: request.clientId,
    codeChallenge: request.codeChallenge,
    codeChallengeMethod: request.codeChallengeMethod,
    codeHash,
    expiresAt,
    grantId,
    redirectUri: request.redirectUri,
    scopes
  });

  const redirectUrl = new URL(request.redirectUri);
  redirectUrl.searchParams.set("code", code);
  redirectUrl.searchParams.set("state", request.state);

  return redirectUrl.toString();
};

export const exchangeOAuthAuthorizationCode = async (
  db: Database,
  input: {
    clientId: string;
    code: string;
    redirectUri: string;
    codeVerifier: string;
  }
): Promise<OAuthTokenResponse> => {
  const now = new Date();
  const [row] = await db
    .select({
      id: schema.oauthAuthorizationCodes.id,
      grantId: schema.oauthAuthorizationCodes.grantId,
      clientId: schema.oauthAuthorizationCodes.clientId,
      redirectUri: schema.oauthAuthorizationCodes.redirectUri,
      codeChallenge: schema.oauthAuthorizationCodes.codeChallenge,
      codeChallengeMethod: schema.oauthAuthorizationCodes.codeChallengeMethod,
      scopes: schema.oauthAuthorizationCodes.scopes,
      grantRevokedAt: schema.oauthGrants.revokedAt,
      grantCompromisedAt: schema.oauthGrants.compromisedAt
    })
    .from(schema.oauthAuthorizationCodes)
    .innerJoin(schema.oauthGrants, eq(schema.oauthAuthorizationCodes.grantId, schema.oauthGrants.id))
    .where(
      and(
        eq(schema.oauthAuthorizationCodes.codeHash, hashOpaqueToken(input.code)),
        isNull(schema.oauthAuthorizationCodes.usedAt),
        gt(schema.oauthAuthorizationCodes.expiresAt, now)
      )
    )
    .limit(1);

  if (
    !row ||
    row.clientId !== input.clientId ||
    row.redirectUri !== input.redirectUri ||
    row.codeChallengeMethod !== "S256" ||
    row.grantRevokedAt ||
    row.grantCompromisedAt ||
    pkceChallenge(input.codeVerifier) !== row.codeChallenge
  ) {
    throw new OAuthError("invalid_grant");
  }

  await db
    .update(schema.oauthAuthorizationCodes)
    .set({ usedAt: now, updatedAt: sql`now()` })
    .where(eq(schema.oauthAuthorizationCodes.id, row.id));

  return issueTokenPair(db, row.grantId, parseScopes(row.scopes));
};

export const refreshOAuthTokens = async (
  db: Database,
  input: {
    clientId: string;
    refreshToken: string;
  }
): Promise<OAuthTokenResponse> => {
  const now = new Date();
  const [row] = await db
    .select({
      id: schema.oauthRefreshTokens.id,
      grantId: schema.oauthRefreshTokens.grantId,
      expiresAt: schema.oauthRefreshTokens.expiresAt,
      revokedAt: schema.oauthRefreshTokens.revokedAt,
      replacedAt: schema.oauthRefreshTokens.replacedAt,
      scopes: schema.oauthGrants.scopes,
      clientId: schema.oauthGrants.clientId,
      grantRevokedAt: schema.oauthGrants.revokedAt,
      grantCompromisedAt: schema.oauthGrants.compromisedAt
    })
    .from(schema.oauthRefreshTokens)
    .innerJoin(schema.oauthGrants, eq(schema.oauthRefreshTokens.grantId, schema.oauthGrants.id))
    .where(eq(schema.oauthRefreshTokens.tokenHash, hashOpaqueToken(input.refreshToken)))
    .limit(1);

  if (!row || row.clientId !== input.clientId || row.grantRevokedAt || row.grantCompromisedAt) {
    throw new OAuthError("invalid_grant");
  }

  if (row.revokedAt || row.replacedAt) {
    await revokeGrant(db, row.grantId, { compromised: true });
    throw new OAuthError("invalid_grant");
  }

  if (row.expiresAt <= now) {
    await revokeGrant(db, row.grantId);
    throw new OAuthError("invalid_grant");
  }

  await db
    .update(schema.oauthRefreshTokens)
    .set({
      lastUsedAt: now,
      replacedAt: now,
      revokedAt: now,
      updatedAt: sql`now()`
    })
    .where(eq(schema.oauthRefreshTokens.id, row.id));

  return issueTokenPair(db, row.grantId, parseScopes(row.scopes), row.id);
};

export const revokeOAuthToken = async (
  db: Database,
  input: {
    token: string;
    clientId?: string | null;
  }
) => {
  const tokenHash = hashOpaqueToken(input.token);
  const accessGrantId = await grantIdForToken(db, schema.oauthAccessTokens, tokenHash, input.clientId);
  const refreshGrantId =
    accessGrantId ?? (await grantIdForToken(db, schema.oauthRefreshTokens, tokenHash, input.clientId));

  if (refreshGrantId) {
    await revokeGrant(db, refreshGrantId);
  }
};

export const resolveOAuthBearerToken = async (
  db: Database,
  token: string | undefined
): Promise<OAuthBearerIdentity | null> => {
  if (!token) {
    return null;
  }

  const now = new Date();
  const [row] = await db
    .select({
      id: schema.oauthAccessTokens.id,
      grantId: schema.oauthAccessTokens.grantId,
      scopes: schema.oauthAccessTokens.scopes,
      lastUsedAt: schema.oauthAccessTokens.lastUsedAt,
      userId: schema.oauthGrants.userId,
      grantLastUsedAt: schema.oauthGrants.lastUsedAt
    })
    .from(schema.oauthAccessTokens)
    .innerJoin(schema.oauthGrants, eq(schema.oauthAccessTokens.grantId, schema.oauthGrants.id))
    .where(
      and(
        eq(schema.oauthAccessTokens.tokenHash, hashOpaqueToken(token)),
        isNull(schema.oauthAccessTokens.revokedAt),
        gt(schema.oauthAccessTokens.expiresAt, now),
        isNull(schema.oauthGrants.revokedAt),
        isNull(schema.oauthGrants.compromisedAt)
      )
    )
    .limit(1);

  if (!row) {
    return null;
  }

  const refreshAfter = new Date(now.getTime() - LAST_USED_REFRESH_AFTER_MS);

  if (!row.lastUsedAt || row.lastUsedAt < refreshAfter) {
    await db
      .update(schema.oauthAccessTokens)
      .set({ lastUsedAt: now, updatedAt: sql`now()` })
      .where(eq(schema.oauthAccessTokens.id, row.id));
  }

  if (!row.grantLastUsedAt || row.grantLastUsedAt < refreshAfter) {
    await db
      .update(schema.oauthGrants)
      .set({ lastUsedAt: now, updatedAt: sql`now()` })
      .where(eq(schema.oauthGrants.id, row.grantId));
  }

  const currentUser = await loadCurrentIdentity(db, row.userId);

  if (!currentUser) {
    return null;
  }

  return {
    currentUser,
    grantId: row.grantId,
    scopes: parseScopes(row.scopes)
  };
};

export const listConnectedApps = async (
  db: Database,
  currentUser: CurrentIdentity
): Promise<ConnectedApp[]> => {
  const rows = await db
    .select({
      id: schema.oauthGrants.id,
      clientId: schema.oauthGrants.clientId,
      clientName: schema.oauthGrants.clientName,
      deviceName: schema.oauthGrants.deviceName,
      platform: schema.oauthGrants.platform,
      browser: schema.oauthGrants.browser,
      scopes: schema.oauthGrants.scopes,
      createdAt: schema.oauthGrants.createdAt,
      lastUsedAt: schema.oauthGrants.lastUsedAt
    })
    .from(schema.oauthGrants)
    .where(
      and(
        eq(schema.oauthGrants.userId, currentUser.user.id),
        isNull(schema.oauthGrants.revokedAt),
        isNull(schema.oauthGrants.compromisedAt)
      )
    )
    .orderBy(sql`${schema.oauthGrants.createdAt} desc`);

  return rows.map((row) => ({
    id: row.id,
    clientId: row.clientId,
    clientName: row.clientName,
    deviceName: row.deviceName,
    platform: row.platform,
    browser: row.browser,
    scopes: parseScopes(row.scopes),
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null
  }));
};

export const revokeConnectedApp = async (
  db: Database,
  currentUser: CurrentIdentity,
  grantId: string
) => {
  const [grant] = await db
    .select({ id: schema.oauthGrants.id })
    .from(schema.oauthGrants)
    .where(and(eq(schema.oauthGrants.id, grantId), eq(schema.oauthGrants.userId, currentUser.user.id)))
    .limit(1);

  if (grant) {
    await revokeGrant(db, grant.id);
  }
};

export const connectedAppDisplayName = (app: {
  clientName: string;
  browser?: string | null;
  platform?: string | null;
  deviceName?: string | null;
}) => {
  const details = [app.browser, app.platform, app.deviceName].filter(Boolean);

  return details.length > 0 ? `${app.clientName} on ${details.join(" / ")}` : app.clientName;
};

export const currentUserResponseFromOAuthIdentity = (identity: OAuthBearerIdentity) =>
  getCurrentUserResponse(identity.currentUser);

const findCoveringGrant = async (
  db: Database,
  userId: string,
  clientId: OAuthClientId,
  requestedScopes: OAuthScope[]
) => {
  const rows = await db
    .select({
      id: schema.oauthGrants.id,
      scopes: schema.oauthGrants.scopes
    })
    .from(schema.oauthGrants)
    .where(
      and(
        eq(schema.oauthGrants.userId, userId),
        eq(schema.oauthGrants.clientId, clientId),
        isNull(schema.oauthGrants.revokedAt),
        isNull(schema.oauthGrants.compromisedAt)
      )
    );

  return rows.find((row) => scopeSetCovers(parseScopes(row.scopes), requestedScopes)) ?? null;
};

const createGrant = async (
  db: Database,
  input: {
    userId: string;
    clientId: OAuthClientId;
    clientName: string;
    deviceName?: string | null;
    platform?: string | null;
    browser?: string | null;
    scopes: string;
  }
) => {
  const [grant] = await db
    .insert(schema.oauthGrants)
    .values({
      userId: input.userId,
      clientId: input.clientId,
      clientName: input.clientName,
      deviceName: input.deviceName,
      platform: input.platform,
      browser: input.browser,
      scopes: input.scopes
    })
    .returning({ id: schema.oauthGrants.id });

  if (!grant) {
    throw new Error("Unable to create OAuth grant");
  }

  return grant.id;
};

const issueTokenPair = async (
  db: Database,
  grantId: string,
  scopes: OAuthScope[],
  rotatedFromId?: string
): Promise<OAuthTokenResponse> => {
  const now = new Date();
  const accessToken = randomToken();
  const refreshToken = randomToken();
  const serializedScopes = serializeScopes(scopes);

  await db.insert(schema.oauthAccessTokens).values({
    grantId,
    tokenHash: hashOpaqueToken(accessToken),
    scopes: serializedScopes,
    expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
    lastUsedAt: now
  });

  await db.insert(schema.oauthRefreshTokens).values({
    grantId,
    tokenHash: hashOpaqueToken(refreshToken),
    rotatedFromId,
    expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
    lastUsedAt: now
  });

  await db
    .update(schema.oauthGrants)
    .set({ lastUsedAt: now, updatedAt: sql`now()` })
    .where(eq(schema.oauthGrants.id, grantId));

  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refreshToken,
    scope: serializedScopes
  };
};

const revokeGrant = async (
  db: Database,
  grantId: string,
  options: { compromised?: boolean } = {}
) => {
  const now = new Date();

  await db
    .update(schema.oauthGrants)
    .set({
      compromisedAt: options.compromised ? now : undefined,
      revokedAt: now,
      updatedAt: sql`now()`
    })
    .where(eq(schema.oauthGrants.id, grantId));

  await db
    .update(schema.oauthAccessTokens)
    .set({ revokedAt: now, updatedAt: sql`now()` })
    .where(eq(schema.oauthAccessTokens.grantId, grantId));

  await db
    .update(schema.oauthRefreshTokens)
    .set({ revokedAt: now, updatedAt: sql`now()` })
    .where(eq(schema.oauthRefreshTokens.grantId, grantId));
};

const grantIdForToken = async (
  db: Database,
  table: typeof schema.oauthAccessTokens | typeof schema.oauthRefreshTokens,
  tokenHash: string,
  clientId?: string | null
) => {
  const [row] = await db
    .select({
      grantId: table.grantId,
      clientId: schema.oauthGrants.clientId
    })
    .from(table)
    .innerJoin(schema.oauthGrants, eq(table.grantId, schema.oauthGrants.id))
    .where(eq(table.tokenHash, tokenHash))
    .limit(1);

  if (!row || (clientId && row.clientId !== clientId)) {
    return null;
  }

  return row.grantId;
};

export const parseScopes = (value: string | null): OAuthScope[] => {
  if (!value) {
    return [];
  }

  const scopes = new Set<OAuthScope>();

  for (const part of value.split(/\s+/)) {
    if (isOAuthScope(part)) {
      scopes.add(part);
    }
  }

  return [...scopes].sort(scopeSort);
};

const parseRequestedScopes = (value: string | null): OAuthScope[] => {
  if (!value) {
    return [];
  }

  const scopes = new Set<OAuthScope>();

  for (const part of value.split(/\s+/).filter(Boolean)) {
    if (!isOAuthScope(part)) {
      return [];
    }

    scopes.add(part);
  }

  return [...scopes].sort(scopeSort);
};

export const serializeScopes = (scopes: Iterable<OAuthScope>) =>
  [...new Set(scopes)].sort(scopeSort).join(" ");

export const hasOAuthScope = (
  availableScopes: ReadonlySet<OAuthScope> | undefined,
  requiredScope: OAuthScope
) => !availableScopes || availableScopes.has(requiredScope);

export const pkceChallenge = (codeVerifier: string) =>
  createHash("sha256").update(codeVerifier).digest("base64url");

const parseOAuthClientId = (value: string | null): OAuthClientId | null => {
  if (value === "browser-extension" || value === "raycast-extension") {
    return value;
  }

  return null;
};

const isOAuthScope = (value: string): value is OAuthScope =>
  OAUTH_SCOPES.includes(value as OAuthScope);

const scopeSort = (left: OAuthScope, right: OAuthScope) =>
  OAUTH_SCOPES.indexOf(left) - OAUTH_SCOPES.indexOf(right);

const scopeSetCovers = (available: OAuthScope[], requested: OAuthScope[]) => {
  const availableScopes = new Set(available);

  return requested.every((scope) => availableScopes.has(scope));
};

const isAllowedRedirectUri = (
  redirectUri: string,
  client: OAuthClientDefinition,
  options: OAuthServerOptions
) => {
  if (client.redirectUris.includes(redirectUri)) {
    return true;
  }

  return options.developmentRedirects === true && isLocalDevelopmentRedirectUri(redirectUri);
};

const isLocalDevelopmentRedirectUri = (value: string) => {
  try {
    const url = new URL(value);

    if (/^[a-z]{32}\.chromiumapp\.org$/.test(url.hostname) && url.pathname === "/oauth") {
      return url.protocol === "https:";
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }

    return ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  } catch {
    return false;
  }
};

const optionalParam = (params: URLSearchParams, key: string) => {
  const value = params.get(key)?.trim();

  return value ? value.slice(0, 120) : null;
};

const randomToken = () => randomBytes(32).toString("base64url");

const hashOpaqueToken = (token: string) =>
  createHash("sha256").update(token).digest("base64url");
