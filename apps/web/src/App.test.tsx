import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Window } from "happy-dom";
import { App } from "./App";

const window = new Window();

const setGlobal = (name: string, value: unknown) => {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true
  });
};

setGlobal("window", window);
setGlobal("document", window.document);
setGlobal("navigator", window.navigator);
setGlobal("HTMLElement", window.HTMLElement);
setGlobal("MutationObserver", window.MutationObserver);

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("App", () => {
  test("boots into the authenticated product shell", async () => {
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          status: "ok",
          services: {
            database: "ok",
            queue: "ok",
            worker: "ok",
            search: "ok"
          },
          checkedAt: "2026-06-19T12:00:00.000Z"
        }),
        {
          headers: {
            "content-type": "application/json"
          }
        }
      )) as unknown as typeof fetch;

    const screen = render(<App />);

    expect(screen.getByText("Bookmarks")).toBeTruthy();
    expect(screen.getByText("Dev user")).toBeTruthy();

    for (const item of [
      "Inbox",
      "Folders",
      "Search",
      "Tags",
      "System labels",
      "Sources",
      "Settings"
    ]) {
      expect(screen.getByRole("link", { name: item })).toBeTruthy();
    }

    await waitFor(() => {
      expect(screen.getByText("Healthy")).toBeTruthy();
    });
  });
});
