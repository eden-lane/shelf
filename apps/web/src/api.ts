import type { CurrentUserResponse, HealthResponse } from "@bookmarks/shared";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export const getHealth = async (): Promise<HealthResponse> => {
  const response = await fetch(new URL("/health", apiBaseUrl));

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as HealthResponse | null;
    if (body) {
      return body;
    }

    throw new Error(`Health check failed with ${response.status}`);
  }

  return (await response.json()) as HealthResponse;
};

export const getCurrentUser = async (): Promise<CurrentUserResponse> => {
  const response = await fetch(new URL("/me", apiBaseUrl));

  if (!response.ok) {
    throw new Error(`Current user request failed with ${response.status}`);
  }

  return (await response.json()) as CurrentUserResponse;
};
