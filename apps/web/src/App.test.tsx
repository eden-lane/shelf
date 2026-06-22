import { afterEach, describe, expect, test } from "bun:test";
import type { SavedItem, FolderItem, TagItem } from "@shelf/shared";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { Window } from "happy-dom";

const window = new Window({ url: "http://localhost:5173/" });

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
    const savedItems: SavedItem[] = [
      {
        id: "00000000-0000-4000-8000-000000000010",
        libraryId: "00000000-0000-4000-8000-000000000003",
        folderId: null,
        folderName: null,
        url: "https://example.com/article",
        title: "Example Article",
        description: "A saved item from the API.",
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
        title: "Plain Saved Item",
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
        sortOrder: 0,
        savedItemCount: 0,
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
        sortOrder: 1,
        savedItemCount: 0,
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
        sortOrder: 0,
        savedItemCount: 0,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      }
    ];
    const tags: TagItem[] = [
      {
        id: "00000000-0000-4000-8000-000000000030",
        libraryId: "00000000-0000-4000-8000-000000000003",
        name: "Important",
        color: "#16a34a",
        savedItemCount: 1,
        createdAt: "2026-06-19T12:00:00.000Z",
        updatedAt: "2026-06-19T12:00:00.000Z"
      }
    ];
    const savedItemCreateRequests: { folderId?: string; libraryId?: string; tagIds?: string[]; url?: string }[] = [];
    const savedItemSearchRequests: {
      cursor?: string | null;
      libraryId?: string | null;
      limit?: number;
      query?: string;
      scope?: "current" | "all";
    }[] = [];
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

      if (url.pathname === "/rpc/savedItems/list") {
        const body = (await request.json()) as {
          json?: {
            folderId?: string | null;
            inbox?: boolean;
            libraryId?: string | null;
            tagId?: string | null;
          };
        };
        const tagSavedItems =
          body.json?.tagId === "00000000-0000-4000-8000-000000000030"
            ? new Set(["00000000-0000-4000-8000-000000000010"])
            : null;
        const items = (
          body.json?.inbox
            ? savedItems.filter((item) => item.folderId === null)
            : body.json?.folderId
              ? savedItems.filter((item) => item.folderId === body.json?.folderId)
              : savedItems
        )
          .filter((item) => (body.json?.libraryId ? item.libraryId === body.json.libraryId : true))
          .filter((item) => (tagSavedItems ? tagSavedItems.has(item.id) : true));

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

      if (url.pathname === "/rpc/savedItems/search") {
        const body = (await request.json()) as {
          json?: {
            cursor?: string | null;
            libraryId?: string | null;
            limit?: number;
            query?: string;
            scope?: "current" | "all";
          };
        };
        savedItemSearchRequests.push(body.json ?? {});
        const query = body.json?.query?.toLowerCase() ?? "";
        const items = savedItems
          .filter((item) =>
            [
              item.title,
              item.url,
              item.description,
              item.siteName,
              item.folderName ?? "Inbox"
            ]
              .filter(Boolean)
              .some((value) => value?.toLowerCase().includes(query))
          )
          .filter((item) =>
            body.json?.scope === "current" && body.json.libraryId
              ? item.libraryId === body.json.libraryId
              : true
          )
          .map((item) => ({
            ...item,
            libraryName:
              item.libraryId === "00000000-0000-4000-8000-000000000003"
                ? "Personal"
                : "Team"
          }));

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

      if (url.pathname === "/rpc/tags/list") {
        return new Response(
          JSON.stringify({
            json: tags
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
      }

      if (url.pathname === "/rpc/tags/create") {
        const body = (await request.json()) as {
          json?: {
            color?: string | null;
            libraryId?: string;
            name?: string;
          };
        };
        const tagIndex = tags.length + 30;
        const tag = {
          id: `00000000-0000-4000-8000-${String(tagIndex).padStart(12, "0")}`,
          libraryId: body.json?.libraryId || "00000000-0000-4000-8000-000000000003",
          name: body.json?.name || "Important",
          color: body.json?.color ?? null,
          savedItemCount: 0,
          createdAt: "2026-06-20T12:00:00.000Z",
          updatedAt: "2026-06-20T12:00:00.000Z"
        } satisfies TagItem;
        tags.push(tag);

        return new Response(JSON.stringify({ json: tag }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/tags/update") {
        const body = (await request.json()) as {
          json?: {
            color?: string | null;
            name?: string;
            tagId?: string;
          };
        };
        const tagIndex = tags.findIndex((tag) => tag.id === body.json?.tagId);

        if (tagIndex >= 0) {
          tags[tagIndex] = {
            ...tags[tagIndex],
            color: body.json?.color ?? null,
            name: body.json?.name || tags[tagIndex].name,
            updatedAt: "2026-06-20T12:05:00.000Z"
          };
        }

        return new Response(JSON.stringify({ json: tags[tagIndex] }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/tags/delete") {
        const body = (await request.json()) as { json?: { tagId?: string } };
        const deletedTagId = body.json?.tagId ?? "";
        const tagIndex = tags.findIndex((tag) => tag.id === deletedTagId);

        if (tagIndex >= 0) {
          tags.splice(tagIndex, 1);
        }

        return new Response(JSON.stringify({ json: { deletedTagId } }), {
          headers: {
            "content-type": "application/json"
          }
        });
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
          sortOrder: folders.filter(
            (existingFolder) =>
              existingFolder.libraryId ===
                (body.json?.libraryId || "00000000-0000-4000-8000-000000000003") &&
              existingFolder.parentId === (body.json?.parentId ?? null)
          ).length,
          savedItemCount: 0,
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

      if (url.pathname === "/rpc/folders/move") {
        const body = (await request.json()) as {
          json?: {
            folderId?: string;
            orderedSiblingIds?: string[];
            parentId?: string | null;
          };
        };
        const folderId = body.json?.folderId ?? "";
        const parentId = body.json?.parentId ?? null;
        const orderedSiblingIds = body.json?.orderedSiblingIds ?? [];

        for (const folder of folders) {
          const nextSortOrder = orderedSiblingIds.indexOf(folder.id);

          if (folder.id === folderId) {
            folder.parentId = parentId;
          }

          if (nextSortOrder >= 0) {
            folder.sortOrder = nextSortOrder;
          }
        }

        return new Response(JSON.stringify({ json: folders }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/savedItems/create") {
        const body = (await request.json()) as {
          json?: { folderId?: string; libraryId?: string; tagIds?: string[]; url?: string };
        };
        savedItemCreateRequests.push(body.json ?? {});
        const targetFolder = body.json?.folderId
          ? (folders.find((folder) => folder.id === body.json?.folderId) ?? null)
          : null;
        await createGate;

        const savedItem = {
          id: "00000000-0000-4000-8000-000000000011",
          libraryId:
            targetFolder?.libraryId ??
            body.json?.libraryId ??
            "00000000-0000-4000-8000-000000000003",
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
        } satisfies SavedItem;
        savedItems.unshift(savedItem);
        const folderIndex = targetFolder
          ? folders.findIndex((folder) => folder.id === targetFolder.id)
          : -1;

        if (folderIndex >= 0) {
          folders[folderIndex] = {
            ...folders[folderIndex],
            savedItemCount: folders[folderIndex].savedItemCount + 1,
            updatedAt: "2026-06-20T12:00:00.000Z"
          };
        }
        for (const tagId of body.json?.tagIds ?? []) {
          const tagIndex = tags.findIndex((tag) => tag.id === tagId);

          if (tagIndex >= 0) {
            tags[tagIndex] = {
              ...tags[tagIndex],
              savedItemCount: tags[tagIndex].savedItemCount + 1,
              updatedAt: "2026-06-20T12:00:00.000Z"
            };
          }
        }

        return new Response(JSON.stringify({ json: savedItem }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/savedItems/delete") {
        const body = (await request.json()) as { json?: { savedItemId?: string } };
        const deletedSavedItemId = body.json?.savedItemId ?? "";
        const itemIndex = savedItems.findIndex((item) => item.id === deletedSavedItemId);

        if (itemIndex >= 0) {
          const [deletedItem] = savedItems.splice(itemIndex, 1);
          const folderIndex = folders.findIndex((folder) => folder.id === deletedItem?.folderId);

          if (folderIndex >= 0) {
            folders[folderIndex] = {
              ...folders[folderIndex],
              savedItemCount: Math.max(0, folders[folderIndex].savedItemCount - 1),
              updatedAt: "2026-06-20T12:00:00.000Z"
            };
          }
        }

        return new Response(JSON.stringify({ json: { deletedSavedItemId } }), {
          headers: {
            "content-type": "application/json"
          }
        });
      }

      if (url.pathname === "/rpc/savedItems/move") {
        const body = (await request.json()) as {
          json?: { savedItemIds?: string[]; destinationFolderId?: string | null };
        };
        const savedItemIds = [...new Set(body.json?.savedItemIds ?? [])];
        const destinationFolder = body.json?.destinationFolderId
          ? (folders.find((folder) => folder.id === body.json?.destinationFolderId) ?? null)
          : null;

        for (const savedItemId of savedItemIds) {
          const itemIndex = savedItems.findIndex((item) => item.id === savedItemId);

          if (itemIndex < 0) {
            continue;
          }

          const previousFolderId = savedItems[itemIndex]?.folderId ?? null;
          savedItems[itemIndex] = {
            ...savedItems[itemIndex],
            folderId: destinationFolder?.id ?? null,
            folderName: destinationFolder?.name ?? null,
            libraryId: destinationFolder?.libraryId ?? savedItems[itemIndex].libraryId,
            updatedAt: "2026-06-20T12:00:00.000Z"
          };

          const previousFolderIndex = folders.findIndex((folder) => folder.id === previousFolderId);
          const destinationFolderIndex = folders.findIndex(
            (folder) => folder.id === destinationFolder?.id
          );

          if (previousFolderIndex >= 0) {
            folders[previousFolderIndex] = {
              ...folders[previousFolderIndex],
              savedItemCount: Math.max(0, folders[previousFolderIndex].savedItemCount - 1)
            };
          }

          if (destinationFolderIndex >= 0) {
            folders[destinationFolderIndex] = {
              ...folders[destinationFolderIndex],
              savedItemCount: folders[destinationFolderIndex].savedItemCount + 1
            };
          }
        }

        return new Response(
          JSON.stringify({
            json: {
              destinationFolderId: destinationFolder?.id ?? null,
              movedSavedItemIds: savedItemIds
            }
          }),
          {
            headers: {
              "content-type": "application/json"
            }
          }
        );
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

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 420 });
    const screen = render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Show sidebar" })).toBeTruthy();
    });

    const workspaceHeader = screen.getByLabelText("Items workspace").querySelector("header");
    expect(workspaceHeader).toBeTruthy();
    expect((workspaceHeader as HTMLElement).className).toContain(
      "grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]"
    );
    expect(screen.queryByRole("searchbox", { name: "Search saved items" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
    await waitFor(() => {
      expect(window.location.pathname).toBe("/me/");
    });
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect((workspaceHeader as HTMLElement).className).toContain(
      "grid-cols-[minmax(0,1fr)_2.5rem]"
    );
    expect((workspaceHeader as HTMLElement).className).not.toContain(
      "grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]"
    );
    expect(screen.getByRole("searchbox", { name: "Search saved items" })).toBeTruthy();
    const personalSection = screen.getByLabelText("Personal folders");
    const inboxButton = screen.getByRole("button", { name: "Inbox" });
    expect(inboxButton).toBeTruthy();
    expect(personalSection.contains(inboxButton)).toBe(true);
    expect(inboxButton.getAttribute("data-workspace-inbox")).toBe(
      "00000000-0000-4000-8000-000000000003"
    );
    expect((inboxButton as HTMLElement).style.marginLeft).toBe("10px");
    expect(inboxButton.className).toContain("gap-0.5");
    expect(inboxButton.className).toContain("pr-7");
    expect(
      screen.container.querySelector(
        '[data-workspace-inbox-title="00000000-0000-4000-8000-000000000003"]'
      )
    ).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close sidebar" })).toBeNull();
    const sidebar = screen.container.querySelector('aside[aria-label="Primary"]');
    expect(sidebar).toBeTruthy();
    Object.defineProperty(sidebar as HTMLElement, "getBoundingClientRect", {
      configurable: true,
      value: () =>
        ({
          bottom: 640,
          height: 640,
          left: 0,
          right: 300,
          top: 0,
          width: 300,
          x: 0,
          y: 0
        }) as DOMRect
    });
    fireEvent.touchStart(sidebar as HTMLElement, {
      touches: [{ clientX: 260, clientY: 80 }]
    });
    fireEvent.touchMove(sidebar as HTMLElement, {
      touches: [{ clientX: 170, clientY: 88 }]
    });
    expect((sidebar as HTMLElement).style.transform).toBe("translate3d(-90px, 0, 0)");
    fireEvent.touchEnd(sidebar as HTMLElement, {
      changedTouches: [{ clientX: 160, clientY: 88 }]
    });
    expect((workspaceHeader as HTMLElement).className).toContain(
      "grid-cols-[2.5rem_minmax(0,1fr)_2.5rem]"
    );
    expect(screen.queryByRole("searchbox", { name: "Search saved items" })).toBeNull();
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    window.dispatchEvent(new window.Event("resize"));
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("searchbox", { name: "Search saved items" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Hide sidebar" }));
    expect((sidebar as HTMLElement).className).toContain(
      "transition-[transform,opacity,width,border-color]"
    );
    expect((sidebar as HTMLElement).className).toContain("md:w-0");
    expect((sidebar as HTMLElement).className).not.toContain("md:hidden");
    expect(screen.queryByRole("searchbox", { name: "Search saved items" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect((sidebar as HTMLElement).className).toContain("md:w-[340px]");
    expect((workspaceHeader as HTMLElement).className).toContain(
      "grid-cols-[minmax(0,1fr)_2.5rem]"
    );
    expect(screen.getByRole("searchbox", { name: "Search saved items" })).toBeTruthy();
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
      expect(screen.getByLabelText("Personal tags")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Important" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Tag actions for Important" })).toBeTruthy();
      expect(screen.queryByLabelText("Saved item folder Inbox")).toBeNull();
      expect(screen.queryByText("Libraries")).toBeNull();
    });
    const savedItemSearchInput = screen.getByRole("searchbox", {
      name: "Search saved items"
    }) as HTMLInputElement;
    expect(screen.getAllByRole("searchbox", { name: "Search saved items" })).toHaveLength(1);
    expect(savedItemSearchInput.getAttribute("autocomplete")).toBe("off");
    expect(savedItemSearchInput.dataset["1pIgnore"]).toBe("true");
    expect(savedItemSearchInput.dataset["opIgnore"]).toBe("true");
    savedItemSearchInput.value = "plain";
    fireEvent.input(savedItemSearchInput);
    expect(savedItemSearchRequests.some((request) => request.query === "plain")).toBe(false);
    await waitFor(() => {
      expect(savedItemSearchRequests.at(-1)?.query).toBe("plain");
      expect(screen.getByText("Plain Saved Item")).toBeTruthy();
      expect(screen.getByLabelText("Saved item location Personal / Inbox")).toBeTruthy();
    });
    expect(screen.getByRole("heading", { name: "Search" })).toBeTruthy();
    expect(window.location.pathname).toBe("/me/search");
    expect(window.location.search).toBe("?q=plain");
    expect(savedItemSearchRequests.at(-1)).toEqual({
      cursor: null,
      libraryId: "00000000-0000-4000-8000-000000000003",
      limit: 20,
      query: "plain",
      scope: "current"
    });
    fireEvent.click(screen.getByRole("button", { name: "All workspaces" }));
    await waitFor(() => {
      expect(window.location.pathname).toBe("/me/search");
      expect(window.location.search).toBe("?q=plain&scope=all");
    });
    expect(savedItemSearchRequests.at(-1)).toEqual({
      cursor: null,
      libraryId: undefined,
      limit: 20,
      query: "plain",
      scope: "all"
    });
    savedItemSearchInput.value = "";
    fireEvent.input(savedItemSearchInput);
    await waitFor(() => {
      expect(window.location.pathname).toBe("/me/");
      expect(window.location.search).toBe("");
      expect(screen.getByText("Example Article")).toBeTruthy();
    });
    const rootDropZone = screen.container.querySelector("[data-folder-root-drop-zone]");
    expect(rootDropZone).toBeTruthy();
    expect((rootDropZone as HTMLElement).className).toContain("absolute");
    expect((rootDropZone as HTMLElement).className).toContain("opacity-0");
    const workspaceButton = screen.getByRole("button", { name: "Collapse workspace Personal" });
    expect(workspaceButton.className).toContain("min-h-8");
    expect(screen.getAllByRole("button", { name: "Create folder in Personal" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Create tag in Personal" })).toHaveLength(1);
    const archiveTitle = screen.container.querySelector(
      '[data-folder-title="00000000-0000-4000-8000-000000000021"]'
    );
    expect(archiveTitle?.closest("[data-folder-drop-target]")?.className).toContain("pr-7");
    const researchRow = screen.getByRole("button", { name: "Research" }).closest("[data-folder-drop-target]");
    expect((researchRow as HTMLElement).style.marginLeft).toBe("10px");
    expect(researchRow?.className).toContain("folder-tree-row");
    const dragResearchButton = screen.getByRole("button", { name: "Drag folder Research" });
    expect(dragResearchButton.className).toContain("folder-drag-handle");
    expect(dragResearchButton.className).toContain("-left-4");
    expect(dragResearchButton.className).toContain("opacity-0");
    expect(dragResearchButton.className).toContain("group-hover:opacity-100");

    fireEvent.click(screen.getByRole("button", { name: "Research" }));
    expect(screen.getByRole("heading", { name: "Research" })).toBeTruthy();
    expect(window.location.pathname).toBe("/me/folder/00000000-0000-4000-8000-000000000005");
    fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(screen.getByRole("heading", { name: "Research / Archive" })).toBeTruthy();
    expect(window.location.pathname).toBe("/me/folder/00000000-0000-4000-8000-000000000021");
    fireEvent.click(screen.getByRole("link", { name: "Research" }));
    expect(screen.getByRole("heading", { name: "Research" })).toBeTruthy();
    expect(window.location.pathname).toBe("/me/folder/00000000-0000-4000-8000-000000000005");
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
    expect(window.location.pathname).toBe("/me/");

    fireEvent.click(screen.getByRole("button", { name: "Important" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Important" })).toBeTruthy();
      expect(screen.getByText("Example Article")).toBeTruthy();
      expect(screen.queryByText("Plain Saved Item")).toBeNull();
    });
    expect(window.location.pathname).toBe("/me/tag/00000000-0000-4000-8000-000000000030");
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
      expect(screen.getByText("Plain Saved Item")).toBeTruthy();
    });
    expect(window.location.pathname).toBe("/me/");

    fireEvent.click(screen.getByRole("button", { name: "Tag actions for Important" }));
    expect(screen.getByRole("menu", { name: "Tag actions for Important" })).toBeTruthy();
    fireEvent.click(screen.getByRole("menuitem", { name: "Add a saved item" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add saved item" })).toBeTruthy();
    });
    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { name: "Add saved item" });
      expect(dialog.querySelector('[aria-label="Important"]')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add saved item" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tag actions for Important" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Edit tag" }));
    const editTagInput = screen.getByLabelText("Tag name") as HTMLInputElement;
    expect(editTagInput.value).toBe("Important");
    fireEvent.change(editTagInput, { target: { value: "Updated tag" } });
    fireEvent.input(editTagInput, { target: { value: "Updated tag" } });
    fireEvent.click(screen.getByRole("button", { name: "Select tag color #f59e0b" }));
    fireEvent.click(screen.getByRole("button", { name: "Save tag" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Updated tag" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Tag actions for Updated tag" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete tag" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Delete Updated tag" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Delete tag" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Updated tag" })).toBeNull();
    });
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";

    Object.defineProperty(window, "innerWidth", { configurable: true, value: 420 });
    window.dispatchEvent(new window.Event("resize"));
    await waitFor(() => {
      expect(document.body.style.position).toBe("fixed");
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.overflow).toBe("hidden");
    });
    fireEvent.click(screen.getByRole("button", { name: "Research" }));
    expect(screen.getByRole("heading", { name: "Research" })).toBeTruthy();
    expect(screen.queryByRole("searchbox", { name: "Search saved items" })).toBeNull();
    await waitFor(() => {
      expect(document.body.style.position).toBe("");
      expect(document.body.style.overflow).toBe("");
      expect(document.documentElement.style.overflow).toBe("");
    });
    fireEvent.click(screen.getByRole("button", { name: "Show sidebar" }));
    expect(screen.getByRole("searchbox", { name: "Search saved items" })).toBeTruthy();
    await waitFor(() => {
      expect(document.body.style.position).toBe("fixed");
      expect(document.body.style.overflow).toBe("hidden");
      expect(document.documentElement.style.overflow).toBe("hidden");
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 1024 });
    window.dispatchEvent(new window.Event("resize"));
    await waitFor(() => {
      expect(document.body.style.position).toBe("");
      expect(document.body.style.overflow).toBe("");
      expect(document.documentElement.style.overflow).toBe("");
    });

    fireEvent.click(screen.getByRole("button", { name: "Collapse folder Research" }));
    expect(screen.queryByRole("button", { name: "Archive" })).toBeNull();
    expect(window.localStorage.getItem("savedItems.collapsedFolders")).toBe(
      '["00000000-0000-4000-8000-000000000005"]'
    );
    fireEvent.click(screen.getByRole("button", { name: "Folder actions for Research" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Create new folder" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Create new folder" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Folder title")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();
      expect(window.localStorage.getItem("savedItems.collapsedFolders")).toBe("[]");
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("button", { name: "Archive" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Collapse workspace Personal" }));
    expect(screen.queryByRole("button", { name: "Inbox" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Research" })).toBeNull();
    expect(window.localStorage.getItem("savedItems.collapsedLibraries")).toBe(
      '["00000000-0000-4000-8000-000000000003"]'
    );
    fireEvent.click(screen.getByRole("button", { name: "Expand workspace Personal" }));
    expect(screen.getByRole("button", { name: "Research" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Saved item actions for Example Article" })
      ).toBeTruthy();
    });

    const exampleActionsButton = screen.getByRole("button", {
      name: "Saved item actions for Example Article"
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
    expect(screen.getByRole("menu", { name: "Saved item actions for Example Article" }).style.left).toBe(
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
      expect(screen.getByText("Link copied")).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Saved item actions for Plain Saved Item" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.queryByText("Plain Saved Item")).toBeNull();
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
    expect(folderTitleInput.getAttribute("autocomplete")).toBe("off");
    expect(folderTitleInput.dataset["1pIgnore"]).toBe("true");
    expect(folderTitleInput.dataset["opIgnore"]).toBe("true");
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
    expect(iconSearchInput.getAttribute("autocomplete")).toBe("off");
    expect(iconSearchInput.dataset["1pIgnore"]).toBe("true");
    expect(iconSearchInput.dataset["opIgnore"]).toBe("true");
    fireEvent.change(iconSearchInput, { target: { value: "book" } });
    fireEvent.click(screen.getByRole("button", { name: "Book" }));
    fireEvent.click(screen.getByRole("button", { name: "Select color #3b82f6" }));
    fireEvent.click(screen.getByRole("button", { name: "Okay" }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Folder icon picker" })).toBeNull();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    fireEvent.click(screen.getByRole("button", { name: "Create tag in Personal" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Tag name")).toBeTruthy();
    });
    const tagNameInput = screen.getByLabelText("Tag name");
    expect(tagNameInput.getAttribute("autocomplete")).toBe("off");
    expect(tagNameInput.dataset["1pIgnore"]).toBe("true");
    expect(tagNameInput.dataset["opIgnore"]).toBe("true");
    expect(tagNameInput.hasAttribute("required")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));
    await waitFor(() => {
      expect(tagNameInput.getAttribute("aria-invalid")).toBe("true");
    });
    fireEvent.change(tagNameInput, { target: { value: "Important 2" } });
    fireEvent.input(tagNameInput, { target: { value: "Important 2" } });
    fireEvent.click(screen.getByRole("button", { name: "Select tag color #f59e0b" }));
    fireEvent.click(screen.getByRole("button", { name: "Create tag" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Important 2" })).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Important 2" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));

    expect(screen.queryByRole("dialog", { name: "Add saved item" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Add saved item" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add saved item" })).toBeTruthy();
      expect(screen.getByLabelText("Page URL")).toBeTruthy();
    });
    expect(screen.getByLabelText("Page URL").hasAttribute("required")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "Add saved item" })).toBeNull();
    });

    expect(screen.queryByText("Healthy")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Inbox" }));

    await waitFor(() => {
      expect(screen.getByText("Example Article")).toBeTruthy();
    });

    expect(screen.queryByLabelText("Saved item folder Inbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Read later" }));

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "No items yet" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("button", { name: "Folder actions for Read later" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Add a saved item" })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Add a saved item" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Add to Read later" })).toBeTruthy();
    });

    const pageUrlInput = screen.getByLabelText("Page URL") as HTMLInputElement;
    expect(pageUrlInput.getAttribute("autocomplete")).toBe("url");
    expect(pageUrlInput.dataset["1pIgnore"]).toBe("true");
    expect(pageUrlInput.dataset["opIgnore"]).toBe("true");
    pageUrlInput.value = "https://added.example/post";
    pageUrlInput.setAttribute("value", "https://added.example/post");
    fireEvent.input(pageUrlInput);
    const tagInput = screen.getByLabelText("Tags") as HTMLInputElement;
    expect(tagInput.getAttribute("autocomplete")).toBe("off");
    expect(tagInput.dataset["1pIgnore"]).toBe("true");
    expect(tagInput.dataset["opIgnore"]).toBe("true");
    fireEvent.change(tagInput, { target: { value: "Project" } });
    fireEvent.input(tagInput, { target: { value: "Project" } });
    fireEvent.keyDown(tagInput, { code: "Enter", key: "Enter" });
    await waitFor(() => {
      const dialog = screen.getByRole("dialog", { name: "Add to Read later" });
      expect(dialog.querySelector('[aria-label="Project"]')).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Saving" })).toBeTruthy();
      expect(document.body.textContent).not.toContain("No items yet");
    });

    finishCreate();

    await waitFor(() => {
      expect(document.body.textContent).toContain("https://added.example/post");
    });
    expect(savedItemCreateRequests.at(-1)?.tagIds).toContain("00000000-0000-4000-8000-000000000031");
  }, 15000);
});
