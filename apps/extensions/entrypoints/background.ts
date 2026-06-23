import { browser } from "wxt/browser";
import { getShelfInstanceUrl, normalizeShelfInstanceUrl } from "../lib/settings";

type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
};

type RuntimeMessage =
  | {
      type: "shelf:connect";
      instanceUrl: string;
    }
  | {
      type: "shelf:disconnect";
    }
  | {
      type: "shelf:getConnection";
    }
  | {
      type: "shelf:rpc";
      path: string;
      input: unknown;
    };

const tokensStorageKey = "oauthTokens";
const clientId = "browser-extension";
const requestedScope = "read:saved_items write:saved_items";

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (!isShelfMessage(message)) {
      return undefined;
    }

    return handleMessage(message);
  });
});

const handleMessage = async (message: RuntimeMessage) => {
  try {
    if (message.type === "shelf:connect") {
      const instanceUrl = normalizeShelfInstanceUrl(message.instanceUrl);
      await connect(instanceUrl);

      return ok(await connectionStatus());
    }

    if (message.type === "shelf:disconnect") {
      await clearTokens();

      return ok(await connectionStatus());
    }

    if (message.type === "shelf:getConnection") {
      return ok(await connectionStatus());
    }

    if (message.type === "shelf:rpc") {
      return ok(await rpcCall(message.path, message.input));
    }

    return fail("Unsupported Shelf message.");
  } catch (error) {
    return fail(errorMessage(error));
  }
};

const connect = async (instanceUrl: string) => {
  const discovery = await fetchDiscovery(instanceUrl);
  const redirectUri = browser.identity.getRedirectURL("oauth");
  const verifier = randomVerifier();
  const state = randomVerifier();
  const authorizeUrl = new URL(discovery.auth.authorization_endpoint);

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", requestedScope);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("platform", browser.runtime.getManifest().name);

  const responseUrl = await browser.identity.launchWebAuthFlow({
    interactive: true,
    url: authorizeUrl.toString()
  });

  if (!responseUrl) {
    throw new Error("Shelf connection was cancelled.");
  }

  const callbackUrl = new URL(responseUrl);

  if (callbackUrl.searchParams.get("state") !== state) {
    throw new Error("Shelf returned an invalid OAuth state.");
  }

  const code = callbackUrl.searchParams.get("code");

  if (!code) {
    throw new Error(callbackUrl.searchParams.get("error") ?? "Shelf did not return an authorization code.");
  }

  const tokens = await exchangeAuthorizationCode(discovery.auth.token_endpoint, {
    code,
    redirectUri,
    verifier
  });

  await storeTokens(tokens);
};

const rpcCall = async (path: string, input: unknown) => {
  const instanceUrl = await getShelfInstanceUrl();
  const token = await getValidAccessToken(instanceUrl);
  const response = await fetch(`${instanceUrl}/rpc/${path}`, {
    body: JSON.stringify({ json: input }),
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    method: "POST"
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readRpcError(body) ?? `Request failed with ${response.status}`);
  }

  return body?.json;
};

const getValidAccessToken = async (instanceUrl: string) => {
  const tokens = await readTokens();

  if (!tokens) {
    throw new Error("Reconnect to Shelf.");
  }

  if (Date.now() < tokens.expiresAt - 60_000) {
    return tokens.accessToken;
  }

  try {
    const discovery = await fetchDiscovery(instanceUrl);
    const refreshed = await refreshTokens(discovery.auth.token_endpoint, tokens.refreshToken);

    await storeTokens(refreshed);

    return refreshed.access_token;
  } catch (error) {
    await clearTokens();
    throw new Error("Reconnect to Shelf.");
  }
};

const fetchDiscovery = async (instanceUrl: string): Promise<{
  auth: {
    authorization_endpoint: string;
    token_endpoint: string;
    revocation_endpoint: string;
  };
}> => {
  const response = await fetch(`${normalizeShelfInstanceUrl(instanceUrl)}/.well-known/shelf`);
  const body = await response.json().catch(() => null);

  if (!response.ok || !body || typeof body !== "object" || !("auth" in body)) {
    throw new Error("Shelf discovery failed.");
  }

  return body as {
    auth: {
      authorization_endpoint: string;
      token_endpoint: string;
      revocation_endpoint: string;
    };
  };
};

const exchangeAuthorizationCode = async (
  tokenEndpoint: string,
  input: { code: string; redirectUri: string; verifier: string }
) =>
  tokenRequest(tokenEndpoint, {
    grant_type: "authorization_code",
    client_id: clientId,
    code: input.code,
    redirect_uri: input.redirectUri,
    code_verifier: input.verifier
  });

const refreshTokens = async (tokenEndpoint: string, refreshToken: string) =>
  tokenRequest(tokenEndpoint, {
    grant_type: "refresh_token",
    client_id: clientId,
    refresh_token: refreshToken
  });

const tokenRequest = async (tokenEndpoint: string, body: Record<string, string>) => {
  const response = await fetch(tokenEndpoint, {
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded"
    },
    method: "POST"
  });
  const responseBody = await response.json().catch(() => null);

  if (!response.ok || !isTokenResponse(responseBody)) {
    throw new Error(readOAuthError(responseBody) ?? "Shelf token request failed.");
  }

  return responseBody;
};

const connectionStatus = async () => ({
  instanceUrl: await getShelfInstanceUrl(),
  connected: Boolean(await readTokens())
});

const readTokens = async (): Promise<OAuthTokens | null> => {
  const stored = await browser.storage.local.get(tokensStorageKey);
  const value = stored[tokensStorageKey];

  return isStoredTokens(value) ? value : null;
};

const storeTokens = async (tokens: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
}) => {
  await browser.storage.local.set({
    [tokensStorageKey]: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
      scope: tokens.scope
    } satisfies OAuthTokens
  });
};

const clearTokens = async () => {
  await browser.storage.local.remove(tokensStorageKey);
};

const isStoredTokens = (value: unknown): value is OAuthTokens =>
  typeof value === "object" &&
  value !== null &&
  "accessToken" in value &&
  "refreshToken" in value &&
  "expiresAt" in value &&
  "scope" in value &&
  typeof value.accessToken === "string" &&
  typeof value.refreshToken === "string" &&
  typeof value.expiresAt === "number" &&
  typeof value.scope === "string";

const isTokenResponse = (
  value: unknown
): value is {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
} =>
  typeof value === "object" &&
  value !== null &&
  "access_token" in value &&
  "refresh_token" in value &&
  "expires_in" in value &&
  "scope" in value &&
  typeof value.access_token === "string" &&
  typeof value.refresh_token === "string" &&
  typeof value.expires_in === "number" &&
  typeof value.scope === "string";

const readRpcError = (body: unknown) => {
  if (!body || typeof body !== "object") {
    return null;
  }

  const error = "error" in body ? body.error : null;

  if (!error || typeof error !== "object") {
    return null;
  }

  const message = "message" in error ? error.message : null;

  return typeof message === "string" ? message : null;
};

const readOAuthError = (body: unknown) => {
  if (!body || typeof body !== "object" || !("error" in body)) {
    return null;
  }

  return typeof body.error === "string" ? body.error : null;
};

const isShelfMessage = (value: unknown): value is RuntimeMessage =>
  typeof value === "object" &&
  value !== null &&
  "type" in value &&
  typeof value.type === "string" &&
  value.type.startsWith("shelf:");

const ok = <T>(value: T) => ({ ok: true as const, value });
const fail = (error: string) => ({ ok: false as const, error });

const randomVerifier = () => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return base64Url(bytes);
};

const pkceChallenge = async (verifier: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));

  return base64Url(new Uint8Array(digest));
};

const base64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Shelf request failed.";
