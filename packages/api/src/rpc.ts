import type {
  CreateBookmarkInput,
  CreateFolderInput,
  DeleteBookmarkInput,
  DeleteFolderInput,
  UpdateFolderInput
} from "@bookmarks/shared";
import { ORPCError, os } from "@orpc/server";
import {
  decodeBookmarkCursor,
  type BookmarkEnrichmentQueue,
  listBookmarksPage,
  parseBookmarksLimit,
  type BookmarkCursor,
  type BookmarksStore
} from "./bookmarks";
import { getCurrentUserResponse } from "./currentUser";
import type { DevIdentity } from "./identity";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";

export interface RpcRouterOptions {
  dependencies: HealthDependencies;
  currentUser?: DevIdentity;
  bookmarksStore?: BookmarksStore;
  bookmarkEnrichmentQueue?: BookmarkEnrichmentQueue;
}

export const createRpcRouter = (options: RpcRouterOptions) => ({
  health: os.handler(() => checkHealth(options.dependencies)),
  currentUser: os.handler(() => {
    if (!options.currentUser) {
      throw new ORPCError("UNAUTHORIZED", {
        message: "No current user is configured"
      });
    }

    return getCurrentUserResponse(options.currentUser);
  }),
  bookmarks: {
    create: os.handler(async ({ input }) => {
      if (!options.currentUser) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "No current user is configured"
        });
      }

      if (!options.bookmarksStore) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Bookmarks storage is not configured"
        });
      }

      const bookmark = parseCreateBookmarkInput(input);

      if (!bookmark) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a valid URL"
        });
      }

      const allowedLibraryIds = currentUserLibraryIds(options.currentUser);
      const folders = bookmark.folderId
        ? await options.bookmarksStore.listFolders({ libraryIds: allowedLibraryIds })
        : [];
      const targetFolder = bookmark.folderId
        ? folders.find((folder) => folder.id === bookmark.folderId)
        : null;

      if (bookmark.folderId && !targetFolder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an available folder"
        });
      }

      const createdBookmark = await options.bookmarksStore.createBookmark({
        createdByUserId: options.currentUser.userId,
        folderId: targetFolder?.id ?? options.currentUser.personalInboxFolderId,
        libraryId: targetFolder?.libraryId ?? options.currentUser.personalLibraryId,
        url: bookmark.url
      });

      if (createdBookmark.metadataStatus !== "fetched") {
        await options.bookmarkEnrichmentQueue
          ?.enqueueSavedItem(createdBookmark.id)
          .catch((error: unknown) => {
            console.error("Unable to enqueue bookmark enrichment", error);
          });
      }

      return createdBookmark;
    }),
    delete: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const bookmark = parseDeleteBookmarkInput(input);

      if (!bookmark) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose a bookmark to delete"
        });
      }

      return options.bookmarksStore.deleteBookmark({
        ...bookmark,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    list: os.handler(async ({ input }) => {
      if (!options.currentUser) {
        throw new ORPCError("UNAUTHORIZED", {
          message: "No current user is configured"
        });
      }

      if (!options.bookmarksStore) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Bookmarks storage is not configured"
        });
      }

      const pagination = parseBookmarksInput(input);

      if (!pagination) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Invalid bookmark cursor"
        });
      }

      return listBookmarksPage(options.bookmarksStore, {
        ...pagination,
        libraryIds: currentUserLibraryIds(options.currentUser)
      });
    })
  },
  folders: {
    create: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const folder = parseCreateFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a folder title"
        });
      }

      return options.bookmarksStore.createFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    delete: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const folder = parseDeleteFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose how to delete this folder"
        });
      }

      return options.bookmarksStore.deleteFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    list: os.handler(() => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      return options.bookmarksStore.listFolders({
        libraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    update: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const folder = parseUpdateFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a folder title"
        });
      }

      return options.bookmarksStore.updateFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    })
  }
});

export type RpcRouter = ReturnType<typeof createRpcRouter>;

const parseBookmarksInput = (
  input: unknown
): { limit: number; cursor?: BookmarkCursor; folderId?: string } | null => {
  if (!isRecord(input)) {
    return {
      limit: parseBookmarksLimit(null)
    };
  }

  const cursorValue = typeof input.cursor === "string" ? input.cursor : null;
  const cursor = cursorValue ? decodeBookmarkCursor(cursorValue) : undefined;

  if (cursorValue && !cursor) {
    return null;
  }

  return {
    cursor: cursor ?? undefined,
    folderId: typeof input.folderId === "string" && input.folderId ? input.folderId : undefined,
    limit: parseBookmarksLimit(typeof input.limit === "number" ? String(input.limit) : null)
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCreateBookmarkInput = (input: unknown): CreateBookmarkInput | null => {
  if (!isRecord(input) || typeof input.url !== "string") {
    return null;
  }

  try {
    const url = new URL(input.url);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return {
      folderId: typeof input.folderId === "string" && input.folderId ? input.folderId : undefined,
      url: url.toString()
    };
  } catch {
    return null;
  }
};

const parseDeleteBookmarkInput = (input: unknown): DeleteBookmarkInput | null => {
  if (!isRecord(input) || typeof input.bookmarkId !== "string" || !input.bookmarkId) {
    return null;
  }

  return {
    bookmarkId: input.bookmarkId
  };
};

const parseCreateFolderInput = (input: unknown): CreateFolderInput | null => {
  if (!isRecord(input) || typeof input.libraryId !== "string") {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    iconColor: parseFolderIconColor(input.iconColor),
    iconName: parseFolderIconName(input.iconName),
    libraryId: input.libraryId,
    name,
    parentId: typeof input.parentId === "string" && input.parentId ? input.parentId : null
  };
};

const parseUpdateFolderInput = (input: unknown): UpdateFolderInput | null => {
  if (!isRecord(input) || typeof input.folderId !== "string") {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    folderId: input.folderId,
    iconColor: parseFolderIconColor(input.iconColor),
    iconName: parseFolderIconName(input.iconName),
    name
  };
};

const parseDeleteFolderInput = (input: unknown): DeleteFolderInput | null => {
  if (!isRecord(input) || typeof input.folderId !== "string") {
    return null;
  }

  if (input.mode !== "move" && input.mode !== "delete") {
    return null;
  }

  return {
    destinationFolderId:
      typeof input.destinationFolderId === "string" && input.destinationFolderId
        ? input.destinationFolderId
        : null,
    folderId: input.folderId,
    mode: input.mode
  };
};

const parseFolderName = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const name = value.trim();

  return name ? name : null;
};

const parseFolderIconName = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const iconName = value.trim();

  return /^Icon[A-Za-z0-9]+$/.test(iconName) ? iconName : null;
};

const parseFolderIconColor = (value: unknown) => {
  if (typeof value !== "string") {
    return null;
  }

  const color = value.trim();

  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : null;
};

const currentUserLibraryIds = (currentUser: DevIdentity) => [
  currentUser.personalLibraryId,
  currentUser.organizationLibraryId
];

function assertCurrentUser(currentUser: DevIdentity | undefined): asserts currentUser is DevIdentity {
  if (!currentUser) {
    throw new ORPCError("UNAUTHORIZED", {
      message: "No current user is configured"
    });
  }
}

function assertBookmarksStore(
  bookmarksStore: BookmarksStore | undefined
): asserts bookmarksStore is BookmarksStore {
  if (!bookmarksStore) {
    throw new ORPCError("INTERNAL_SERVER_ERROR", {
      message: "Bookmarks storage is not configured"
    });
  }
}
