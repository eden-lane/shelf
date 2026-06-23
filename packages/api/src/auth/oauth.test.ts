import { describe, expect, test } from "bun:test";
import {
  getOAuthAuthorizationServerMetadata,
  getShelfDiscovery,
  parseOAuthAuthorizationRequest,
  pkceChallenge
} from "./oauth";

const validParams = () =>
  new URLSearchParams({
    response_type: "code",
    client_id: "browser-extension",
    redirect_uri: "http://localhost:7777/oauth/callback",
    scope: "read:saved_items write:saved_items",
    state: "state-token",
    code_challenge: "challenge-token",
    code_challenge_method: "S256"
  });

describe("OAuth discovery", () => {
  test("exposes the product-specific OAuth endpoints", () => {
    const discovery = getShelfDiscovery({
      issuer: "https://shelf.example",
      options: {
        clients: {
          "browser-extension": {
            redirectUris: ["https://extension.example/callback"]
          }
        }
      }
    });

    expect(discovery.auth.authorization_endpoint).toBe("https://shelf.example/oauth/authorize");
    expect(discovery.auth.token_endpoint).toBe("https://shelf.example/oauth/token");
    expect(discovery.clients["browser-extension"]).toBe(true);
    expect(discovery.clients["raycast-extension"]).toBe(false);
  });

  test("advertises only the v1 authorization-code surface", () => {
    const metadata = getOAuthAuthorizationServerMetadata({ issuer: "https://shelf.example" });

    expect(metadata.response_types_supported).toEqual(["code"]);
    expect(metadata.grant_types_supported).toEqual(["authorization_code", "refresh_token"]);
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    expect(metadata.scopes_supported).toEqual(["read:saved_items", "write:saved_items"]);
    expect("userinfo_endpoint" in metadata).toBe(false);
  });
});

describe("OAuth authorization request parsing", () => {
  test("accepts a development localhost redirect when enabled", () => {
    const request = parseOAuthAuthorizationRequest(validParams(), {
      developmentRedirects: true
    });

    expect(request.clientId).toBe("browser-extension");
    expect(request.redirectUri).toBe("http://localhost:7777/oauth/callback");
    expect(request.scopes).toEqual(["read:saved_items", "write:saved_items"]);
  });

  test("accepts the browser identity redirect pattern for the browser extension client", () => {
    const params = validParams();
    params.set("redirect_uri", "https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/oauth");

    expect(
      parseOAuthAuthorizationRequest(params, {
        developmentRedirects: false
      }).redirectUri
    ).toBe("https://abcdefghijklmnopqrstuvwxyzabcdef.chromiumapp.org/oauth");
  });

  test("accepts the Safari extension options redirect for the browser extension client", () => {
    const params = validParams();
    params.set("redirect_uri", "safari-web-extension://7ABA92F-7CEC-453B-9B64-DE5A37922EA7/options.html");

    expect(
      parseOAuthAuthorizationRequest(params, {
        developmentRedirects: false
      }).redirectUri
    ).toBe("safari-web-extension://7ABA92F-7CEC-453B-9B64-DE5A37922EA7/options.html");
  });

  test("keeps browser extension redirects scoped to the browser extension client", () => {
    const params = validParams();
    params.set("client_id", "raycast-extension");
    params.set("redirect_uri", "safari-web-extension://7ABA92F-7CEC-453B-9B64-DE5A37922EA7/options.html");

    expect(() =>
      parseOAuthAuthorizationRequest(params, {
        developmentRedirects: false
      })
    ).toThrow("invalid_redirect_uri");
  });

  test("rejects redirect URIs outside the allowlist", () => {
    expect(() =>
      parseOAuthAuthorizationRequest(validParams(), {
        developmentRedirects: false,
        clients: {
          "browser-extension": {
            redirectUris: ["https://allowed.example/callback"]
          }
        }
      })
    ).toThrow("invalid_redirect_uri");
  });

  test("rejects unsupported scopes", () => {
    const params = validParams();
    params.set("scope", "read:saved_items delete:everything");

    expect(() =>
      parseOAuthAuthorizationRequest(params, {
        developmentRedirects: true
      })
    ).toThrow("invalid_scope");
  });

  test("derives the S256 PKCE challenge", () => {
    expect(pkceChallenge("test-verifier")).toBe("JBbiqONGWPaAmwXk_8bT6UnlPfrn65D32eZlJS-zGG0");
  });
});
