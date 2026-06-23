import { browser } from "wxt/browser";

const storageKey = "apiBaseUrl";

export const defaultApiUrl = "http://localhost:3000";

export const getApiBaseUrl = async () => {
  const savedApiUrl = await browser.storage.local.get(storageKey);
  const value = savedApiUrl[storageKey];

  return normalizeApiUrl(typeof value === "string" ? value : defaultApiUrl);
};

export const saveApiBaseUrl = async (value: string) => {
  const apiUrl = normalizeApiUrl(value);
  await requestApiBaseUrlPermission(apiUrl);
  await browser.storage.local.set({ [storageKey]: apiUrl });

  return apiUrl;
};

export const hasApiBaseUrlPermission = async (value: string) => {
  const origin = apiOriginPermissionPattern(value);

  return browser.permissions.contains({ origins: [origin] });
};

export const requestApiBaseUrlPermission = async (value: string) => {
  const origin = apiOriginPermissionPattern(value);
  const wasGranted = await browser.permissions.request({ origins: [origin] });

  if (!wasGranted) {
    throw new Error("Shelf needs permission to connect to this API URL.");
  }
};

export const normalizeApiUrl = (value: string) => {
  const url = new URL(value || defaultApiUrl);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
};

const apiOriginPermissionPattern = (value: string) => {
  const url = new URL(normalizeApiUrl(value));

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Shelf API URL must use http or https.");
  }

  return `${url.protocol}//${url.hostname}/*`;
};
