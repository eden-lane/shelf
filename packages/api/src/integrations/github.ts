import { Buffer } from "node:buffer";
import type { GitHubClient, GitHubIdentity, GitHubRepository } from "./types";

export interface GitHubOAuthOptions {
  clientId: string | null;
  clientSecret: string | null;
  redirectUri: string | null;
}

export class OAuthGitHubClient implements GitHubClient {
  constructor(private readonly options: GitHubOAuthOptions) {}

  createAuthorizationUrl(input: {
    libraryId: string;
    userId: string;
    redirectUri?: string | null;
  }): string {
    if (!this.options.clientId) {
      throw new GitHubConfigurationError("GitHub OAuth is not configured");
    }

    const redirectUri = input.redirectUri ?? this.options.redirectUri;
    const state = encodeGitHubState({
      libraryId: input.libraryId,
      redirectUri,
      userId: input.userId,
    });
    const url = new URL("https://github.com/login/oauth/authorize");

    url.searchParams.set("client_id", this.options.clientId);
    url.searchParams.set("scope", "read:user");
    url.searchParams.set("state", state);

    if (redirectUri) {
      url.searchParams.set("redirect_uri", redirectUri);
    }

    return url.toString();
  }

  async exchangeCode(input: { code: string; state: string }): Promise<{
    accessToken: string;
    externalAccount: GitHubIdentity;
    libraryId: string;
    userId: string;
  }> {
    if (!this.options.clientId || !this.options.clientSecret) {
      throw new GitHubConfigurationError("GitHub OAuth is not configured");
    }

    const state = decodeGitHubState(input.state);
    const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
      body: JSON.stringify({
        client_id: this.options.clientId,
        client_secret: this.options.clientSecret,
        code: input.code,
        redirect_uri: state.redirectUri ?? this.options.redirectUri,
      }),
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      method: "POST",
    });
    const tokenBody = (await tokenResponse.json().catch(() => null)) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    } | null;

    if (!tokenResponse.ok || !tokenBody?.access_token) {
      throw new Error(
        tokenBody?.error_description ?? tokenBody?.error ?? "GitHub token exchange failed",
      );
    }

    const externalAccount = await this.fetchIdentity(tokenBody.access_token);

    return {
      accessToken: tokenBody.access_token,
      externalAccount,
      libraryId: state.libraryId,
      userId: state.userId,
    };
  }

  async listStars(
    accessToken: string,
    cursor?: string | null,
  ): Promise<{
    repositories: GitHubRepository[];
    nextCursor: string | null;
  }> {
    const url = new URL("https://api.github.com/user/starred");
    url.searchParams.set("per_page", "100");

    if (cursor) {
      url.searchParams.set("page", cursor);
    }

    const response = await fetch(url, {
      headers: githubHeaders(accessToken),
    });

    if (response.status === 401 || response.status === 403) {
      throw new GitHubCredentialError("GitHub credentials need reconnect");
    }

    if (!response.ok) {
      throw new Error(`GitHub stars request failed with ${response.status}`);
    }

    const repositories = (await response.json()) as GitHubRepository[];
    const nextCursor = nextPageCursor(response.headers.get("link"));

    return {
      repositories,
      nextCursor,
    };
  }

  private async fetchIdentity(accessToken: string): Promise<GitHubIdentity> {
    const response = await fetch("https://api.github.com/user", {
      headers: githubHeaders(accessToken),
    });

    if (!response.ok) {
      throw new Error(`GitHub user request failed with ${response.status}`);
    }

    const body = (await response.json()) as GitHubIdentity;

    return {
      id: body.id,
      login: body.login,
    };
  }
}

export class GitHubCredentialError extends Error {}

export class GitHubConfigurationError extends Error {}

const githubHeaders = (accessToken: string) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${accessToken}`,
  "user-agent": "shelf-integrations",
});

const encodeGitHubState = (state: {
  libraryId: string;
  redirectUri?: string | null;
  userId: string;
}) => Buffer.from(JSON.stringify(state), "utf8").toString("base64url");

const decodeGitHubState = (
  state: string,
): {
  libraryId: string;
  redirectUri?: string | null;
  userId: string;
} => {
  const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as unknown;

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("libraryId" in parsed) ||
    typeof parsed.libraryId !== "string" ||
    !("userId" in parsed) ||
    typeof parsed.userId !== "string"
  ) {
    throw new Error("Invalid GitHub OAuth state");
  }

  return {
    libraryId: parsed.libraryId,
    redirectUri:
      "redirectUri" in parsed && typeof parsed.redirectUri === "string" ? parsed.redirectUri : null,
    userId: parsed.userId,
  };
};

const nextPageCursor = (linkHeader: string | null) => {
  if (!linkHeader) {
    return null;
  }

  for (const part of linkHeader.split(",")) {
    const [rawUrl, rawRel] = part.split(";").map((value) => value.trim());

    if (rawRel !== 'rel="next"' || !rawUrl?.startsWith("<") || !rawUrl.endsWith(">")) {
      continue;
    }

    const url = new URL(rawUrl.slice(1, -1));

    return url.searchParams.get("page");
  }

  return null;
};
