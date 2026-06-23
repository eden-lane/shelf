import { browser } from "wxt/browser";

const instanceUrlStorageKey = "shelfInstanceUrl";
const legacyApiUrlStorageKey = "apiBaseUrl";

export const defaultShelfInstanceUrl = "http://localhost:3000";

export const getShelfInstanceUrl = async () => {
  const savedValues = await browser.storage.local.get([
    instanceUrlStorageKey,
    legacyApiUrlStorageKey
  ]);
  const value = savedValues[instanceUrlStorageKey] ?? savedValues[legacyApiUrlStorageKey];

  return normalizeShelfInstanceUrl(typeof value === "string" ? value : defaultShelfInstanceUrl);
};

export const saveShelfInstanceUrl = async (value: string) => {
  const instanceUrl = normalizeShelfInstanceUrl(value);
  assertAllowedInstanceUrl(instanceUrl);
  await requestShelfInstancePermission(instanceUrl);
  await browser.storage.local.set({ [instanceUrlStorageKey]: instanceUrl });

  return instanceUrl;
};

export const hasShelfInstancePermission = async (value: string) => {
  const origin = shelfInstanceOriginPermissionPattern(value);

  return browser.permissions.contains({ origins: [origin] });
};

export const requestShelfInstancePermission = async (value: string) => {
  const origin = shelfInstanceOriginPermissionPattern(value);
  const wasGranted = await browser.permissions.request({ origins: [origin] });

  if (!wasGranted) {
    throw new Error("Shelf needs permission to connect to this instance.");
  }
};

export const normalizeShelfInstanceUrl = (value: string) => {
  const url = new URL(value || defaultShelfInstanceUrl);
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";

  return url.toString().replace(/\/$/, "");
};

export const assertAllowedInstanceUrl = (value: string) => {
  const url = new URL(normalizeShelfInstanceUrl(value));

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Shelf instance must use http or https.");
  }

  if (url.protocol === "http:" && !isAllowedHttpHost(url.hostname)) {
    throw new Error("Plain HTTP is only allowed for localhost and private network instances.");
  }
};

const shelfInstanceOriginPermissionPattern = (value: string) => {
  const url = new URL(normalizeShelfInstanceUrl(value));

  assertAllowedInstanceUrl(url.toString());

  return `${url.protocol}//${url.hostname}/*`;
};

const isAllowedHttpHost = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "[::1]" ||
  hostname === "::1" ||
  hostname.startsWith("10.") ||
  hostname.startsWith("192.168.") ||
  /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);
