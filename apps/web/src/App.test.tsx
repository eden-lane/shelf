import { afterEach, describe, expect, test } from "bun:test";
import type { BookmarkItem, FolderItem } from "@bookmarks/shared";
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
    const savedItems: BookmarkItem[] = [
      {
        id: "00000000-0000-4000-8000-000000000010",
        libraryId: "00000000-0000-4000-8000-000000000003",
        folderId: "00000000-0000-4000-8000-000000000005",
        folderName: "Inbox",
        url: "https://example.com/article",
        title: "Example Article",
        description: "A saved bookmark from the API.",
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      }
    ];
    const folders: FolderItem[] = [
      {
        id: "00000000-0000-4000-8000-000000000005",
        libraryId: "00000000-0000-4000-8000-000000000003",
        parentId: null,
        name: "Inbox",
        bookmarkCount: 1,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      }
    ];

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);

      if (url.pathname === "/rpc/currentUser") {
        return new Response(
          JSON.stringify({
            json: {
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
              },
              libraries: [
                {
                  id: "00000000-0000-4000-8000-000000000003",
                  kind: "personal",
                  name: "Personal",
                  inboxFolderId: "00000000-0000-4000-8000-000000000005"
                }
              ]
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/rpc/bookmarks/list") {
        return new Response(
          JSON.stringify({
            json: {
              items: savedItems,
              nextCursor: null
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/rpc/folders/list") {
        return new Response(
          JSON.stringify({
            json: folders
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/rpc/folders/create") {
        const body = (await request.json()) as {
          json?: { libraryId?: string; name?: string; parentId?: string | null };
        };
        const folder = {
          id: "00000000-0000-4000-8000-000000000020",
          libraryId: body.json?.libraryId || "00000000-0000-4000-8000-000000000003",
          parentId: body.json?.parentId ?? null,
          name: body.json?.name || "Reading",
          bookmarkCount: 0,
          createdAt: "2026-06-20T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z"
        };
        folders.push(folder);

        return new Response(JSON.stringify({ json: folder }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/bookmarks/create") {
        const body = (await request.json()) as { json?: { url?: string } };
        const savedItem = {
          id: "00000000-0000-4000-8000-000000000011",
          libraryId: "00000000-0000-4000-8000-000000000003",
          folderId: "00000000-0000-4000-8000-000000000005",
          folderName: "Inbox",
          url: body.json?.url || "https://added.example/post",
          title: null,
          description: null,
          createdAt: "2026-06-20T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z"
        };
        savedItems.unshift(savedItem);

        return new Response(JSON.stringify({ json: savedItem }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/health") {
        return new Response(
          JSON.stringify({
            json: {
              status: "ok",
              services: {
                database: "ok",
                queue: "ok",
                search: "ok"
              },
              checkedAt: "2026-06-19T12:00:00.000Z"
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
          error: `Unhandled test request: ${url.pathname}`
        }),
        {
          status: 404,
          headers: {
            "content-type": "application/json"
          }
        }
      );
    }) as unknown as typeof fetch;
    const { App } = await import("./App");

    const screen = render(<App />);

    await waitFor(() => {
      expect(screen.getAllByText("Dev User")).toHaveLength(1);
    });

    expect(screen.getByRole("searchbox", { name: "Search folders" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Items" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Folders" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Search" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Tags" })).toBeNull();
    expect(screen.queryByRole("link", { name: "System labels" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sources" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();

    await waitFor(() => {
      expect(screen.getByText("Example Article")).toBeTruthy();
      expect(screen.getByText("https://example.com/article")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Folder actions for Inbox" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Folder actions for Inbox" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Create new folder" })).toBeTruthy();
    });

    expect(screen.queryByRole("dialog", { name: "Add bookmark" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add bookmark" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add bookmark" })).toBeTruthy();
      expect(screen.getByLabelText("Page URL")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add bookmark" })).toBeNull();
    });

    expect(screen.queryByText("Healthy")).toBeNull();
  });
});
