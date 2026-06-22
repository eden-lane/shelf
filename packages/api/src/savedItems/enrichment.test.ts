import { describe, expect, test } from "bun:test";
import {
  assertSafeHttpUrl,
  isPotentiallySafeHttpUrl,
  mapLinkPreviewMetadata
} from "./enrichment";

describe("savedItem enrichment metadata", () => {
  test("maps link-preview-js results to savedItem metadata", () => {
    const metadata = mapLinkPreviewMetadata({
      author: undefined,
      charset: "utf-8",
      contentType: "text/html",
      description: " An article description ",
      favicons: ["", "https://example.com/favicon.ico"],
      images: ["https://example.com/cover.png"],
      mediaType: "website",
      siteName: "Example",
      title: " Example Article ",
      url: "https://example.com/post",
      videos: []
    });

    expect(metadata).toEqual({
      description: "An article description",
      faviconCandidates: ["https://example.com/favicon.ico"],
      imageUrl: "https://example.com/cover.png",
      siteName: "Example",
      title: "Example Article"
    });
  });
});

describe("savedItem enrichment URL safety", () => {
  test("rejects obviously unsafe URL shapes before DNS lookup", () => {
    expect(isPotentiallySafeHttpUrl("file:///etc/passwd")).toBe(false);
    expect(isPotentiallySafeHttpUrl("http://localhost:3000")).toBe(false);
    expect(isPotentiallySafeHttpUrl("https://example.com")).toBe(true);
  });

  test("rejects direct private or loopback IP targets", async () => {
    await expect(assertSafeHttpUrl("http://127.0.0.1")).rejects.toThrow();
    await expect(assertSafeHttpUrl("http://192.168.1.10")).rejects.toThrow();
  });
});
