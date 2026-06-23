# Auth flow

Shelf uses web-first authentication for the web app, browser extensions, Raycast, and future first-party clients. The web app owns login, signup, registration policy, and consent. External clients connect through OAuth Authorization Code with PKCE and store scoped app tokens instead of passwords, web cookies, or manually copied API keys.

## Goals

- Keep production and self-hosted onboarding simple.
- Use the same protocol for browser extensions and Raycast.
- Avoid asking users to paste tokens or enter passwords outside the web app.
- Let users revoke connected clients without signing out of the web app.
- Keep first-party setup zero-config for self-hosted admins.
- Reuse the existing `/rpc/*` API surface for authenticated clients.

## Non-goals

- Full OpenID Connect.
- Dynamic OAuth client registration.
- Third-party OAuth apps in v1.
- Device-code login in v1.
- Workspace-bound OAuth grants in v1.
- JWT access tokens in v1.

## User flows

### Production browser extension

1. The extension defaults to the production Shelf URL.
2. The user clicks `Connect to Shelf`.
3. The extension starts a PKCE authorization request against the production instance.
4. Shelf opens in the browser.
5. If the user is not signed in, Shelf shows the normal login or signup screen.
6. Shelf shows a first-time consent screen for the browser extension.
7. The user approves.
8. Shelf redirects back to the extension with an authorization code.
9. The extension exchanges the code for access and refresh tokens.
10. The extension stores tokens in extension-local storage and uses the background layer to call `/rpc/*`.

### Self-hosted browser extension

1. The user opens extension settings.
2. The user enters their Shelf instance URL.
3. The extension fetches discovery metadata from that instance.
4. The user clicks `Connect to Shelf`.
5. The same PKCE flow runs against the self-hosted instance.
6. Changing the instance URL later disconnects the current tokens or requires an explicit reconnect.

### Raycast

1. Raycast has a `Shelf URL` preference, defaulting to production.
2. The user runs a Shelf command.
3. If Raycast has no valid tokens, it starts the PKCE flow using Raycast's OAuth support.
4. Shelf handles login, signup, and consent in the web app.
5. Raycast stores the returned token set using Raycast token storage.
6. Raycast refreshes tokens silently when possible.

### Reconnect

If refresh fails because the token is revoked, invalid, expired, or reuse is detected, the client clears local tokens and shows `Reconnect to Shelf`. Clients must not ask for email or password directly.

## Discovery

Clients use a single user-facing setting: `Shelf URL`.

Shelf should expose product-specific discovery:

```http
GET /.well-known/shelf
```

Example response:

```json
{
  "name": "Shelf",
  "version": "x.y.z",
  "auth": {
    "issuer": "https://shelf.example.com",
    "authorization_endpoint": "https://shelf.example.com/oauth/authorize",
    "token_endpoint": "https://shelf.example.com/oauth/token",
    "revocation_endpoint": "https://shelf.example.com/oauth/revoke"
  },
  "clients": {
    "browser-extension": true,
    "raycast-extension": true
  }
}
```

Shelf may also expose minimal OAuth metadata:

```http
GET /.well-known/oauth-authorization-server
```

This metadata should advertise only the v1 surface:

- `response_types_supported`: `["code"]`
- `grant_types_supported`: `["authorization_code", "refresh_token"]`
- `code_challenge_methods_supported`: `["S256"]`
- `scopes_supported`: `["read:saved_items", "write:saved_items"]`

Do not add OIDC `id_token`, `userinfo`, JWKS, or dynamic client registration in v1.

## Built-in clients

Shelf ships with first-party public OAuth clients:

| Client ID | Purpose |
| --- | --- |
| `browser-extension` | Chrome, Edge, Firefox, and Safari extension builds |
| `raycast-extension` | Raycast extension |

These clients do not have secrets. They must use PKCE with `S256`.

Self-hosted admins should not need to register these clients. The server validates client IDs, redirect URIs, scopes, and PKCE using built-in configuration.

Future third-party apps can use admin-created OAuth clients, but that is outside v1.

## Redirect URI policy

Redirect URIs must be strict and predefined per built-in client.

Production:

- Use published browser extension redirect URIs tied to stable extension IDs.
- Use Raycast's documented redirect URI.
- Do not allow wildcard extension redirect URIs.
- Do not allow arbitrary caller-provided redirect URIs.

Development:

- Allow localhost and known dev redirect URIs only when development mode or an explicit dev auth flag is enabled.

Safari support may require a separate redirect pattern depending on packaging constraints. Treat that as a client-specific allowlist entry, not a wildcard.

## HTTP and HTTPS

Clients should require HTTPS for normal remote instances.

Allowed HTTP cases:

- `http://localhost`
- `http://127.0.0.1`
- private LAN hosts for local self-hosting and development

Remote plain HTTP should be rejected by default because access and refresh tokens are bearer secrets.

## OAuth endpoints

### Authorize

```http
GET /oauth/authorize
```

Required parameters:

- `response_type=code`
- `client_id`
- `redirect_uri`
- `scope`
- `state`
- `code_challenge`
- `code_challenge_method=S256`

Optional display metadata:

- `device_name`
- `platform`
- `browser`
- `extension_version`

Behavior:

1. Validate client, redirect URI, scopes, and PKCE challenge.
2. If the user is not signed in, show the normal web auth screen.
3. If this is the first grant for this user/client/scope set, show consent.
4. If an active grant already exists for the same user, client, and same or narrower scopes, consent may be skipped.
5. Create a short-lived authorization code.
6. Redirect to `redirect_uri` with `code` and `state`.

If requested scopes expand later, consent must be shown again.

### Token

```http
POST /oauth/token
```

Supported grants:

- `authorization_code`
- `refresh_token`

Authorization code exchange parameters:

- `grant_type=authorization_code`
- `client_id`
- `code`
- `redirect_uri`
- `code_verifier`

Refresh exchange parameters:

- `grant_type=refresh_token`
- `client_id`
- `refresh_token`

Token response:

```json
{
  "access_token": "opaque-access-token",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "opaque-refresh-token",
  "scope": "read:saved_items write:saved_items"
}
```

### Revoke

```http
POST /oauth/revoke
```

Revokes a refresh token, access token, or the whole grant depending on the request and UI action. Connected-app revocation should revoke the grant and all associated tokens.

## Token model

Use opaque database-backed tokens, not JWTs.

Access tokens:

- Opaque random value.
- Stored hashed in the database.
- Short TTL, preferably 15 to 60 minutes.
- Bearer token for `/rpc/*`.
- Scoped to a client grant.

Refresh tokens:

- Opaque random value.
- Stored hashed in the database.
- Long-lived.
- Rotated on every refresh.
- Scoped to a client grant.
- Revocable independently of web sessions.

Refresh-token reuse detection:

1. If a rotated refresh token is presented again, mark the grant as compromised.
2. Revoke the grant and all associated refresh/access tokens.
3. Require the client to reconnect through OAuth.

## Data model

Suggested tables:

### `oauth_grants`

- `id`
- `user_id`
- `client_id`
- `client_name`
- `device_name`
- `platform`
- `browser`
- `scopes`
- `created_at`
- `last_used_at`
- `revoked_at`

### `oauth_authorization_codes`

- `id`
- `grant_id`
- `client_id`
- `redirect_uri`
- `code_hash`
- `code_challenge`
- `code_challenge_method`
- `scopes`
- `expires_at`
- `used_at`
- `created_at`

### `oauth_access_tokens`

- `id`
- `grant_id`
- `token_hash`
- `scopes`
- `expires_at`
- `last_used_at`
- `revoked_at`
- `created_at`

### `oauth_refresh_tokens`

- `id`
- `grant_id`
- `token_hash`
- `rotated_from_id`
- `expires_at`
- `last_used_at`
- `revoked_at`
- `replaced_at`
- `created_at`

## Scopes

V1 scopes:

- `read:saved_items`
- `write:saved_items`

Browser extension and Raycast can request both in v1.

Suggested enforcement:

| Operation | Scope |
| --- | --- |
| `currentUser` | `read:saved_items` |
| List saved items, folders, tags, locations, search | `read:saved_items` |
| Create saved items | `write:saved_items` |
| Update, delete, move saved items | `write:saved_items` |
| Create, update, delete, move folders and tags | `write:saved_items` |

OAuth grants are account-wide in v1. Workspace access still comes from normal server-side authorization on every request.

## RPC authentication

`/rpc/*` should accept both web sessions and OAuth bearer tokens.

Identity resolution order:

1. Resolve `Authorization: Bearer <token>`.
2. If no bearer token exists, resolve the `shelf_session` cookie.
3. If neither resolves, return unauthenticated.

Cookie-authenticated unsafe requests keep the current origin/CSRF checks.

Bearer-authenticated requests do not need CSRF checks, but they must:

- Validate token hash, expiry, revocation, grant status, and scopes.
- Update grant/token `last_used_at` with reasonable throttling.
- Use deliberate CORS rules.

## Connected apps

The web app should include a Connected Apps page under account settings.

Each row should show:

- App name.
- Device/install name.
- Browser/platform.
- Instance/issuer.
- Scopes.
- Created date.
- Last used date.
- Revoke action.

Examples:

- `Shelf Browser Extension on Chrome`
- `Shelf Browser Extension on Safari`
- `Raycast on Eden's MacBook`

Revoking a connected app revokes the grant and all associated refresh/access tokens. It should not revoke the user's web session or other connected clients.

Client-provided metadata is display-only. Security decisions must rely on client ID, redirect URI, PKCE, scopes, token validity, and user identity.

## Browser extension token boundary

The browser extension background/service worker owns tokens and attaches `Authorization: Bearer ...`.

Popup and options pages can request authenticated Shelf actions through extension messaging. Content scripts should only collect page metadata or send messages. Content scripts must not receive access or refresh tokens.

## Migration from current extension settings

The current extension setting is an API URL. OAuth should turn this into a user-facing `Shelf instance` setting.

Migration behavior:

1. Keep the existing saved URL as the initial instance URL.
2. Show disconnected state after upgrade.
3. Prompt the user to connect through OAuth.
4. Remove `Test API URL` as the primary path.
5. Replace it with `Connect`, `Reconnect`, and connected-account status.

## Implementation phases

### Phase 1: Server OAuth foundation

- Add built-in client definitions.
- Add discovery endpoints.
- Add OAuth data tables and migrations.
- Add authorization-code generation and PKCE validation.
- Add token exchange with opaque access/refresh tokens.
- Add refresh-token rotation and reuse detection.
- Add tests for code expiry, one-time code use, PKCE mismatch, redirect URI rejection, refresh rotation, and reuse revocation.

### Phase 2: RPC bearer authentication

- Add bearer-token identity resolution.
- Add scope checks to RPC procedures.
- Keep cookie-session behavior unchanged for the web app.
- Add tests for cookie auth, bearer auth, missing scopes, expired tokens, and revoked grants.

### Phase 3: Web consent and connected apps

- Add OAuth login continuation through the existing auth screen.
- Add first-time consent screen.
- Add silent approval for same or narrower scopes on an existing grant.
- Add Connected Apps UI and revoke action.
- Add tests for consent requirements, scope expansion, and grant revocation.

### Phase 4: Browser extension OAuth

- Rename API URL settings to Shelf instance settings.
- Add discovery fetch and HTTPS/HTTP validation.
- Add PKCE authorization flow using browser extension auth APIs.
- Move token storage and refresh into the background layer.
- Attach bearer tokens to `/rpc/*` calls.
- Clear tokens and reconnect on invalid refresh.
- Verify Chrome/Edge/Firefox behavior with stable published extension IDs before production.
- Verify Safari redirect behavior separately.

### Phase 5: Raycast OAuth

- Add Shelf URL preference.
- Use Raycast PKCE OAuth support.
- Store token sets using Raycast token storage.
- Refresh tokens before API calls.
- Reconnect through OAuth when refresh fails.

## Open implementation details

- Final production Shelf domain.
- Published Chrome, Edge, Firefox, and Safari extension IDs.
- Exact Raycast package name and redirect URI.
- Whether private LAN HTTP should require an explicit advanced toggle in clients.
- Exact access-token TTL.
- Exact refresh-token lifetime.
