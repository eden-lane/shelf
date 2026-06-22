import { afterEach, expect, test } from "bun:test";
import { MeilisearchSavedItemSearchIndex } from "./savedItemSearchIndex";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("sends the configured master key to Meilisearch requests", async () => {
  const requests: Array<{ init?: RequestInit; url: string }> = [];
  const responses = [
    Response.json({ uid: "saved_items" }),
    Response.json({ taskUid: 1 }, { status: 202 }),
    Response.json({ status: "succeeded" }),
    Response.json({ hits: [] })
  ];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push({ init, url: input.toString() });

    const response = responses.shift();
    if (!response) {
      throw new Error("Unexpected fetch call");
    }

    return response;
  }) as typeof fetch;

  const index = new MeilisearchSavedItemSearchIndex("http://meilisearch.test", "test-master-key");

  await index.search({
    libraryIds: ["library-1"],
    limit: 10,
    query: "example"
  });

  expect(requests.map((request) => request.url)).toEqual([
    "http://meilisearch.test/indexes/saved_items",
    "http://meilisearch.test/indexes/saved_items/settings",
    "http://meilisearch.test/tasks/1",
    "http://meilisearch.test/indexes/saved_items/search"
  ]);

  expect(
    requests.every(
      (request) => new Headers(request.init?.headers).get("authorization") === "Bearer test-master-key"
    )
  ).toBe(true);
});
