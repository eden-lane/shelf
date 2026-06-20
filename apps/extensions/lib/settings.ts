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
  await browser.storage.local.set({ [storageKey]: apiUrl });

  return apiUrl;
};

export const normalizeApiUrl = (value: string) => {
  const url = new URL(value || defaultApiUrl);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
};
