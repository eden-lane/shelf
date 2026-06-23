import { browser } from "wxt/browser";

export const rpcCall = async <T>(path: string, input: unknown): Promise<T> => {
  const response = await browser.runtime.sendMessage({
    type: "shelf:rpc",
    path,
    input
  });

  if (!isRuntimeResponse(response)) {
    throw new Error("Shelf extension background is not available.");
  }

  if (!response.ok) {
    throw new Error(response.error ?? "Request failed");
  }

  return response.value as T;
};

const isRuntimeResponse = (
  value: unknown
): value is { ok: true; value: unknown } | { ok: false; error: string } =>
  typeof value === "object" && value !== null && "ok" in value;
