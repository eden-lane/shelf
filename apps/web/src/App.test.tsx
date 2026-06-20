import { afterEach, describe, expect, test } from "bun:test";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Window } from "happy-dom";

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
setGlobal("Element", window.Element);
setGlobal("Node", window.Node);
setGlobal("MutationObserver", window.MutationObserver);
setGlobal("requestAnimationFrame", window.requestAnimationFrame.bind(window));
setGlobal("cancelAnimationFrame", window.cancelAnimationFrame.bind(window));

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
});

describe("App", () => {
  test("boots into the authenticated product shell", async () => {
    const { App } = await import("./App");

    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = new URL(input.toString());

      if (url.pathname === "/me") {
        return new Response(
          JSON.stringify({
            user: {
              id: "00000000-0000-4000-8000-000000000001",
              email: "dev@localhost",
              name: "Dev User"
            },
            organization: {
              id: "00000000-0000-4000-8000-000000000002",
              name: "Dev Workspace",
              slug: "dev",
              role: "owner"
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      return new Response(
        JSON.stringify({
          status: "ok",
          services: {
            database: "ok",
            queue: "ok",
            search: "ok"
          },
          checkedAt: "2026-06-19T12:00:00.000Z"
        }),
        {
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }) as unknown as typeof fetch;

    const screen = render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Dev User")).toHaveLength(2);
    });

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

    fireEvent.click(screen.getByRole("button", { name: "Add bookmark" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add bookmark" })).toBeTruthy();
      expect(screen.getByLabelText("Page URL")).toBeTruthy();
    });

    await waitFor(() => {
      expect(screen.getByText("Healthy")).toBeTruthy();
    });
  });
});
