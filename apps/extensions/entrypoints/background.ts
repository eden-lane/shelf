import { browser } from "wxt/browser";
import { getShelfInstanceUrl, normalizeShelfInstanceUrl } from "../lib/settings";

type OAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
};

type OAuthPendingAuthorization = {
  instanceUrl: string;
  redirectUri: string;
  state: string;
  tokenEndpoint: string;
  verifier: string;
};

type ConnectionStatus = {
  authorizationUrl?: string;
  connected: boolean;
  instanceUrl: string;
};

type RuntimeMessage =
  | {
      type: "shelf:open-options";
    }
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
      type: "shelf:oauthCallback";
      callbackUrl: string;
    }
  | {
      type: "shelf:rpc";
      path: string;
      input: unknown;
    };

const instanceUrlStorageKey = "shelfInstanceUrl";
const tokensStorageKey = "oauthTokens";
const pendingAuthorizationStorageKey = "oauthPendingAuthorization";
const clientId = "browser-extension";
const requestedScope = "read:saved_items write:saved_items";

export default defineBackground(() => {
  const toolbarAction = browser.action ?? browser.browserAction;

  toolbarAction.onClicked.addListener((tab) => {
    if (!tab.id || !tab.url || !/^https?:\/\//.test(tab.url)) {
      void browser.runtime.openOptionsPage();
      return;
    }

    void togglePanelInTab(tab.id, tab.windowId);
  });

  browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (!isShelfMessage(message)) {
      return undefined;
    }

    if (message.type === "shelf:open-options") {
      void browser.runtime.openOptionsPage();
      return undefined;
    }

    return handleMessage(message);
  });
});

const handleMessage = async (message: RuntimeMessage) => {
  try {
    if (message.type === "shelf:connect") {
      const instanceUrl = normalizeShelfInstanceUrl(message.instanceUrl);
      const authorizationUrl = await connect(instanceUrl);

      return ok({ ...(await connectionStatus()), authorizationUrl });
    }

    if (message.type === "shelf:disconnect") {
      await clearTokens();

      return ok(await connectionStatus());
    }

    if (message.type === "shelf:getConnection") {
      return ok(await connectionStatus());
    }

    if (message.type === "shelf:oauthCallback") {
      await completeOAuthCallback(message.callbackUrl);

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
  const { discovery, instanceUrl: discoveredInstanceUrl } = await fetchDiscovery(instanceUrl);
  const identity = browser.identity;

  if (identity?.getRedirectURL && identity.launchWebAuthFlow) {
    const redirectUri = identity.getRedirectURL("oauth");
    const { authorizeUrl, pendingAuthorization } = await createAuthorizationRequest({
      discovery,
      instanceUrl: discoveredInstanceUrl,
      redirectUri
    });
    const responseUrl = await identity.launchWebAuthFlow({
      interactive: true,
      url: authorizeUrl
    });

    if (!responseUrl) {
      throw new Error("Shelf connection was cancelled.");
    }

    await completeOAuthCallback(responseUrl, pendingAuthorization);

    return undefined;
  }

  const redirectUri = browser.runtime.getURL("/options.html");
  const { authorizeUrl, pendingAuthorization } = await createAuthorizationRequest({
    discovery,
    instanceUrl: discoveredInstanceUrl,
    redirectUri
  });

  await storePendingAuthorization(pendingAuthorization);

  return authorizeUrl;
};

const createAuthorizationRequest = async ({
  discovery,
  instanceUrl,
  redirectUri
}: {
  discovery: ShelfDiscovery;
  instanceUrl: string;
  redirectUri: string;
}) => {
  const verifier = randomVerifier();
  const state = randomVerifier();
  const authorizeUrl = new URL(discovery.auth.authorization_endpoint);

  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", clientId);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorizeUrl.searchParams.set("code_challenge_method", "S256");
  authorizeUrl.searchParams.set("scope", requestedScope);
  authorizeUrl.searchParams.set("platform", browser.runtime.getManifest().name);

  return {
    authorizeUrl: authorizeUrl.toString(),
    pendingAuthorization: {
      instanceUrl,
      redirectUri,
      state,
      tokenEndpoint: discovery.auth.token_endpoint,
      verifier
    } satisfies OAuthPendingAuthorization
  };
};

const completeOAuthCallback = async (
  responseUrl: string,
  providedPendingAuthorization?: OAuthPendingAuthorization
) => {
  const pendingAuthorization = providedPendingAuthorization ?? (await readPendingAuthorization());

  if (!pendingAuthorization) {
    throw new Error("Shelf connection was not started from this extension.");
  }

  const callbackUrl = new URL(responseUrl);

  if (callbackUrl.searchParams.get("state") !== pendingAuthorization.state) {
    throw new Error("Shelf returned an invalid OAuth state.");
  }

  const code = callbackUrl.searchParams.get("code");

  if (!code) {
    throw new Error(callbackUrl.searchParams.get("error") ?? "Shelf did not return an authorization code.");
  }

  const tokens = await exchangeAuthorizationCode(pendingAuthorization.tokenEndpoint, {
    code,
    redirectUri: pendingAuthorization.redirectUri,
    verifier: pendingAuthorization.verifier
  });

  await storeInstanceUrl(pendingAuthorization.instanceUrl);
  await storeTokens(tokens);
  await clearPendingAuthorization();
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
    const { discovery } = await fetchDiscovery(instanceUrl);
    const refreshed = await refreshTokens(discovery.auth.token_endpoint, tokens.refreshToken);

    await storeTokens(refreshed);

    return refreshed.access_token;
  } catch (error) {
    await clearTokens();
    throw new Error("Reconnect to Shelf.");
  }
};

type ShelfDiscovery = {
  auth: {
    authorization_endpoint: string;
    token_endpoint: string;
    revocation_endpoint: string;
  };
};

const fetchDiscovery = async (
  instanceUrl: string
): Promise<{ discovery: ShelfDiscovery; instanceUrl: string }> => {
  const candidateUrls = discoveryInstanceUrlCandidates(instanceUrl);

  for (const candidateUrl of candidateUrls) {
    const response = await fetch(`${candidateUrl}/.well-known/shelf`).catch(() => null);
    const body = await response?.json().catch(() => null);

    if (response?.ok && body && typeof body === "object" && "auth" in body) {
      return {
        discovery: body as ShelfDiscovery,
        instanceUrl: candidateUrl
      };
    }
  }

  throw new Error("Shelf discovery failed.");
};

const discoveryInstanceUrlCandidates = (instanceUrl: string) => {
  const normalizedInstanceUrl = normalizeShelfInstanceUrl(instanceUrl);
  const url = new URL(normalizedInstanceUrl);

  if (
    url.protocol === "http:" &&
    url.port === "5173" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1")
  ) {
    url.port = "3000";

    return [normalizedInstanceUrl, normalizeShelfInstanceUrl(url.toString())];
  }

  return [normalizedInstanceUrl];
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

const connectionStatus = async (): Promise<ConnectionStatus> => ({
  instanceUrl: await getShelfInstanceUrl(),
  connected: Boolean(await readTokens())
});

const readPendingAuthorization = async (): Promise<OAuthPendingAuthorization | null> => {
  const stored = await browser.storage.local.get(pendingAuthorizationStorageKey);
  const value = stored[pendingAuthorizationStorageKey];

  return isPendingAuthorization(value) ? value : null;
};

const storePendingAuthorization = async (pendingAuthorization: OAuthPendingAuthorization) => {
  await browser.storage.local.set({
    [pendingAuthorizationStorageKey]: pendingAuthorization
  });
};

const clearPendingAuthorization = async () => {
  await browser.storage.local.remove(pendingAuthorizationStorageKey);
};

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

const storeInstanceUrl = async (instanceUrl: string) => {
  await browser.storage.local.set({ [instanceUrlStorageKey]: instanceUrl });
};

const isPendingAuthorization = (value: unknown): value is OAuthPendingAuthorization =>
  typeof value === "object" &&
  value !== null &&
  "instanceUrl" in value &&
  "redirectUri" in value &&
  "state" in value &&
  "tokenEndpoint" in value &&
  "verifier" in value &&
  typeof value.instanceUrl === "string" &&
  typeof value.redirectUri === "string" &&
  typeof value.state === "string" &&
  typeof value.tokenEndpoint === "string" &&
  typeof value.verifier === "string";

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

const togglePanelInTab = async (tabId: number, windowId: number) => {
  const previewImageUrl = await browser.tabs
    .captureVisibleTab(windowId, { format: "jpeg", quality: 45 })
    .catch(() => null);

  await browser.tabs
    .sendMessage(tabId, {
      previewImageUrl,
      type: "shelf:toggle-save-panel"
    })
    .catch(() => {
      // Restricted pages can fail to receive content-script messages.
    });
};
