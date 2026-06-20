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
setGlobal("getComputedStyle", window.getComputedStyle.bind(window));
setGlobal("requestAnimationFrame", window.requestAnimationFrame.bind(window));
setGlobal("cancelAnimationFrame", window.cancelAnimationFrame.bind(window));

const originalFetch = globalThis.fetch;

afterEach(() => {
  cleanup();
  globalThis.fetch = originalFetch;
  window.localStorage.clear();
});

describe("App", () => {
  test("boots into the authenticated product shell", async () => {
    const savedItems: BookmarkItem[] = [
      {
        id: "00000000-0000-4000-8000-000000000010",
        libraryId: "00000000-0000-4000-8000-000000000003",
        folderId: null,
        folderName: null,
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
        folderId: null,
        folderName: null,
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
        name: "Research",
        iconName: "IconBook",
        iconColor: "#3b82f6",
        bookmarkCount: 0,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      },
      {
        id: "00000000-0000-4000-8000-000000000020",
        libraryId: "00000000-0000-4000-8000-000000000003",
        parentId: null,
        name: "Read later",
        iconName: null,
        iconColor: null,
        bookmarkCount: 0,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      },
      {
        id: "00000000-0000-4000-8000-000000000021",
        libraryId: "00000000-0000-4000-8000-000000000003",
        parentId: "00000000-0000-4000-8000-000000000005",
        name: "Archive",
        iconName: "IconArchive",
        iconColor: "#697080",
        bookmarkCount: 0,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      }
    ];
    let finishCreate = () => {};
    const copiedLinks: string[] = [];
    const openedLinks: string[] = [];
    const createGate = new Promise<void>((resolve) => {
      finishCreate = resolve;
    });
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          copiedLinks.push(text);
        }
      }
    });
    Object.defineProperty(window, "open", {
      configurable: true,
      value: (url: string, target: string, features: string) => {
        openedLinks.push(`${url}|${target}|${features}`);
        return null;
      }
    });

    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init);
      const url = new URL(request.url);

      if (url.pathname === "/auth/session") {
        return new Response(
          JSON.stringify({
            user: {
              user: {
                id: "00000000-0000-4000-8000-000000000001",
                email: "dev@localhost",
                emailVerifiedAt: null,
                name: "Dev User",
                username: null,
                avatarUrl: null,
                billingCustomerId: null,
                locale: null
              },
              organizations: [],
              libraries: [
                {
                  id: "00000000-0000-4000-8000-000000000003",
                  kind: "personal",
                  name: "Personal"
                }
              ]
            },
            registration: {
              mode: "first-user-only",
              available: false
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/rpc/currentUser") {
        return new Response(
          JSON.stringify({
            json: {
              user: {
                id: "00000000-0000-4000-8000-000000000001",
                email: "dev@localhost",
                emailVerifiedAt: null,
                name: "Dev User",
                username: null,
                avatarUrl: null,
                billingCustomerId: null,
                locale: null
              },
              organizations: [],
              libraries: [
                {
                  id: "00000000-0000-4000-8000-000000000003",
                  kind: "personal",
                  name: "Personal"
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
          json?: { folderId?: string | null; inbox?: boolean };
        };
        const items = body.json?.inbox
          ? savedItems.filter((item) => item.folderId === null)
          : body.json?.folderId
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
          json?: {
            iconColor?: string | null;
            iconName?: string | null;
            libraryId?: string;
            name?: string;
            parentId?: string | null;
          };
        };
        const folder = {
          id: "00000000-0000-4000-8000-000000000022",
          libraryId: body.json?.libraryId || "00000000-0000-4000-8000-000000000003",
          parentId: body.json?.parentId ?? null,
          name: body.json?.name || "Reading",
          iconName: body.json?.iconName ?? null,
          iconColor: body.json?.iconColor ?? null,
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
        const targetFolder = body.json?.folderId
          ? (folders.find((folder) => folder.id === body.json?.folderId) ?? null)
          : null;
        await createGate;

        const savedItem = {
          id: "00000000-0000-4000-8000-000000000011",
          libraryId: targetFolder?.libraryId ?? "00000000-0000-4000-8000-000000000003",
          folderId: targetFolder?.id ?? null,
          folderName: targetFolder?.name ?? null,
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
        const folderIndex = targetFolder
          ? folders.findIndex((folder) => folder.id === targetFolder.id)
          : -1;

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

      if (url.pathname === "/rpc/bookmarks/delete") {
        const body = (await request.json()) as { json?: { bookmarkId?: string } };
        const deletedBookmarkId = body.json?.bookmarkId ?? "";
        const itemIndex = savedItems.findIndex((item) => item.id === deletedBookmarkId);

        if (itemIndex >= 0) {
          const [deletedItem] = savedItems.splice(itemIndex, 1);
          const folderIndex = folders.findIndex((folder) => folder.id === deletedItem?.folderId);

          if (folderIndex >= 0) {
            folders[folderIndex] = {
              ...folders[folderIndex],
              bookmarkCount: Math.max(0, folders[folderIndex].bookmarkCount - 1),
              updatedAt: "2026-06-20T12:00:00.000Z"
            };
          }
        }

        return new Response(JSON.stringify({ json: { deletedBookmarkId } }), {
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
      expect(screen.getByRole("button", { name: "Inbox" })).toBeTruthy();
    });

    expect(screen.getByRole("searchbox", { name: "Search folders" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Inbox" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
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
      expect(screen.getByRole("button", { name: "Folder actions for Research" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
      expect(screen.queryByLabelText("Bookmark folder Inbox")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Research" }));
    expect(screen.getByRole("heading", { name: "Research" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("heading", { name: "Research / Archive" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 420 });
    fireEvent.click(screen.getByRole("button", { name: "Research" }));
    expect(screen.getByRole("heading", { name: "Research" })).toBeTruthy();
    expect(screen.queryByRole("searchbox", { name: "Search folders" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("searchbox", { name: "Search folders" })).toBeTruthy();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });

    fireEvent.click(screen.getByRole("button", { name: "Collapse folder Research" }));
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(window.localStorage.getItem("bookmarks.collapsedFolders")).toBe(
      '["00000000-0000-4000-8000-000000000005"]'
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand folder Research" }));
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse workspace Personal" }));
    expect(screen.queryByRole("button", { name: "Research" })).toBeNull();
    expect(window.localStorage.getItem("bookmarks.collapsedLibraries")).toBe(
      '["00000000-0000-4000-8000-000000000003"]'
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand workspace Personal" }));
    expect(screen.getByRole("button", { name: "Research" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Bookmark actions for Example Article" })
      ).toBeTruthy();
    });

    const exampleActionsButton = screen.getByRole("button", {
      name: "Bookmark actions for Example Article"
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 420 });
    Object.defineProperty(window, "innerHeight", { configurable: true, value: 640 });
    Object.defineProperty(exampleActionsButton, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          bottom: 120,
          height: 32,
          left: 390,
          right: 422,
          top: 88,
          width: 32,
          x: 390,
          y: 88
        }) as DOMRect
    });

    fireEvent.click(exampleActionsButton);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Open" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "Copy link" })).toBeTruthy();
      expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    });
    expect(screen.getByRole("menu", { name: "Bookmark actions for Example Article" }).style.left).toBe(
      "252px"
    );
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });

    fireEvent.click(screen.getByRole("menuitem", { name: "Open" }));
    expect(openedLinks).toEqual(["https://example.com/article|_blank|noopener,noreferrer"]);

    fireEvent.click(exampleActionsButton);

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Copy link" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Copy link" }));
    await waitFor(() => {
      expect(copiedLinks).toEqual(["https://example.com/article"]);
      expect(screen.getByRole("status").textContent).toBe("Link copied");
    });

    fireEvent.click(screen.getByRole("button", { name: "Bookmark actions for Plain Bookmark" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Plain Bookmark")).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Folder actions for Research" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Create new folder" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Create new folder" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Folder title")).toBeTruthy();
    });

    const folderTitleInput = screen.getByLabelText("Folder title");
    expect(folderTitleInput.hasAttribute("required")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => {
      expect(folderTitleInput.getAttribute("aria-invalid")).toBe("true");
    });
    fireEvent.input(folderTitleInput, { target: { value: "Github" } });
    await waitFor(() => {
      expect(folderTitleInput.getAttribute("aria-invalid")).toBe("false");
    });

    fireEvent.click(screen.getByRole("button", { name: "Choose folder icon" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Folder icon picker" })).toBeTruthy();
    });
    const iconSearchInput = screen.getByLabelText("Search icons") as HTMLInputElement;
    fireEvent.change(iconSearchInput, { target: { value: "book" } });
    fireEvent.click(screen.getByRole("button", { name: "Book" }));
    fireEvent.click(screen.getByRole("button", { name: "Select color #3b82f6" }));
    fireEvent.click(screen.getByRole("button", { name: "Okay" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Folder icon picker" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog", { name: "Add bookmark" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add bookmark" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add bookmark" })).toBeTruthy();
      expect(screen.getByLabelText("Page URL")).toBeTruthy();
    });
    expect(screen.getByLabelText("Page URL").hasAttribute("required")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add bookmark" })).toBeNull();
    });

    expect(screen.queryByText("Healthy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));

    await waitFor(() => {
      expect(screen.getByText("Example Article")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Bookmark folder Inbox")).toBeNull();

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
  }, 15000);
});
