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
        siteName: "Example",
        imageUrl: "https://example.com/cover.png",
        metadataStatus: "fetched",
        metadataFetchedAt: "2026-06-19T12:00:01.000Z",
        faviconId: "00000000-0000-4000-8000-000000000030",
        faviconUrl: "/favicons/00000000-0000-4000-8000-000000000030",
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      },
      {
        id: "00000000-0000-4000-8000-000000000012",
        libraryId: "00000000-0000-4000-8000-000000000003",
        folderId: "00000000-0000-4000-8000-000000000005",
        folderName: "Inbox",
        url: "https://plain.example/post",
        title: "Plain Bookmark",
        description: null,
        siteName: "Plain",
        imageUrl: null,
        metadataStatus: "fetched",
        metadataFetchedAt: "2026-06-19T12:00:01.000Z",
        faviconId: null,
        faviconUrl: null,
        createdAt: "2026-06-19T11:00:00.000Z",
        updatedAt: "2026-06-19T11:00:00.000Z"
      }
    ];
    const folders: FolderItem[] = [
      {
        id: "00000000-0000-4000-8000-000000000005",
        libraryId: "00000000-0000-4000-8000-000000000003",
        parentId: null,
        name: "Inbox",
        bookmarkCount: 2,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      },
      {
        id: "00000000-0000-4000-8000-000000000020",
        libraryId: "00000000-0000-4000-8000-000000000003",
        parentId: null,
        name: "Read later",
        bookmarkCount: 0,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      }
    ];
    let finishCreate = () => {};
    const createGate = new Promise<void>((resolve) => {
      finishCreate = resolve;
    });

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
        const body = (await request.json()) as {
          json?: { folderId?: string | null };
        };
        const items = body.json?.folderId
          ? savedItems.filter((item) => item.folderId === body.json?.folderId)
          : savedItems;

        return new Response(
          JSON.stringify({
            json: {
              items,
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
        const body = (await request.json()) as { json?: { folderId?: string; url?: string } };
        const targetFolderId = body.json?.folderId || "00000000-0000-4000-8000-000000000005";
        const targetFolder = folders.find((folder) => folder.id === targetFolderId) ?? folders[0]!;
        await createGate;

        const savedItem = {
          id: "00000000-0000-4000-8000-000000000011",
          libraryId: targetFolder.libraryId,
          folderId: targetFolder.id,
          folderName: targetFolder.name,
          url: body.json?.url || "https://added.example/post",
          title: null,
          description: null,
          siteName: null,
          imageUrl: null,
          metadataStatus: "pending",
          metadataFetchedAt: null,
          faviconId: null,
          faviconUrl: null,
          createdAt: "2026-06-20T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z"
        } satisfies BookmarkItem;
        savedItems.unshift(savedItem);
        const folderIndex = folders.findIndex((folder) => folder.id === targetFolder.id);

        if (folderIndex >= 0) {
          folders[folderIndex] = {
            ...folders[folderIndex],
            bookmarkCount: folders[folderIndex].bookmarkCount + 1,
            updatedAt: "2026-06-20T12:00:00.000Z"
          };
        }

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
    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect(screen.queryByRole("searchbox", { name: "Search folders" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("searchbox", { name: "Search folders" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Folders" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Search" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Tags" })).toBeNull();
    expect(screen.queryByRole("link", { name: "System labels" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Sources" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Settings" })).toBeNull();

    await waitFor(() => {
      expect(screen.getByText("Example Article")).toBeTruthy();
      expect(screen.getByText("https://example.com/article")).toBeTruthy();
      expect(document.querySelector('img[src="https://example.com/cover.png"]')).toBeTruthy();
      expect(
        document.querySelector(
          'img[src="http://localhost:3000/favicons/00000000-0000-4000-8000-000000000030"]'
        )
      ).toBeTruthy();
      expect(screen.getByRole("img", { name: "No thumbnail available" })).toBeTruthy();
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

    fireEvent.click(screen.getByRole("button", { name: "Read later" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "No items yet" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Folder actions for Read later" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Add a bookmark" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Add a bookmark" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add to Read later" })).toBeTruthy();
    });

    const pageUrlInput = screen.getByLabelText("Page URL") as HTMLInputElement;
    pageUrlInput.value = "https://added.example/post";
    pageUrlInput.setAttribute("value", "https://added.example/post");
    fireEvent.input(pageUrlInput);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving" })).toBeTruthy();
      expect(document.body.textContent).not.toContain("No items yet");
    });

    finishCreate();

    await waitFor(() => {
      expect(document.body.textContent).toContain("https://added.example/post");
    });
  });
});
