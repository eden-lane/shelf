export const rpcCall = async <T>(apiUrl: string, path: string, input: unknown): Promise<T> => {
  const response = await fetch(`${apiUrl}/rpc/${path}`, {
    body: JSON.stringify({ json: input }),
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(readRpcError(body) ?? `Request failed with ${response.status}`);
  }

  return body?.json as T;
};

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
