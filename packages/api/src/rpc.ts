import type {
  CreateBookmarkInput,
  CreateFolderInput,
  CreateTagInput,
  DeleteBookmarkInput,
  DeleteFolderInput,
  DeleteTagInput,
  MoveFolderInput,
  MoveBookmarksInput,
  UpdateFolderInput,
  UpdateTagInput
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
import { getCurrentUserResponse, type CurrentIdentity } from "./currentUser";
import type { HealthDependencies } from "./health";
import { checkHealth } from "./health";

export interface RpcRouterOptions {
  dependencies: HealthDependencies;
  currentUser?: CurrentIdentity;
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
      const personalLibrary = options.currentUser.libraries.find(
        (library) => library.kind === "personal"
      );

      if (bookmark.folderId && !targetFolder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose an available folder"
        });
      }

      if (!targetFolder && !personalLibrary) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Personal library is not configured"
        });
      }

      const targetFolderId = targetFolder?.id ?? null;
      const requestedLibraryId =
        !targetFolder && bookmark.libraryId && allowedLibraryIds.includes(bookmark.libraryId)
          ? bookmark.libraryId
          : null;
      const targetLibraryId = targetFolder?.libraryId ?? requestedLibraryId ?? personalLibrary?.id;
      const selectedTagIds = bookmark.tagIds;

      if (!targetLibraryId) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Target library is not configured"
        });
      }

      if (selectedTagIds && selectedTagIds.length > 0) {
        const tags = await options.bookmarksStore.listTags({ libraryIds: [targetLibraryId] });
        const availableTagIds = new Set(tags.map((tag) => tag.id));

        if (selectedTagIds.some((tagId) => !availableTagIds.has(tagId))) {
          throw new ORPCError("BAD_REQUEST", {
            message: "Choose available tags"
          });
        }
      }

      const createdBookmark = await options.bookmarksStore.createBookmark({
        createdByUserId: options.currentUser.user.id,
        folderId: targetFolderId,
        libraryId: targetLibraryId,
        tagIds: selectedTagIds,
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
    }),
    locations: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const lookup = parseBookmarkLocationsInput(input);

      if (!lookup) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a valid URL"
        });
      }

      return options.bookmarksStore.listBookmarkLocations({
        libraryIds: currentUserLibraryIds(options.currentUser),
        url: lookup.url
      });
    }),
    move: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const move = parseMoveBookmarksInput(input);

      if (!move) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose bookmarks to move"
        });
      }

      return options.bookmarksStore.moveBookmarks({
        ...move,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    })
  },
  tags: {
    create: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const tag = parseCreateTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a tag name"
        });
      }

      return options.bookmarksStore.createTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    delete: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const tag = parseDeleteTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose a tag to delete"
        });
      }

      return options.bookmarksStore.deleteTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    list: os.handler(() => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      return options.bookmarksStore.listTags({
        libraryIds: currentUserLibraryIds(options.currentUser)
      });
    }),
    update: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const tag = parseUpdateTagInput(input);

      if (!tag) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Enter a tag name"
        });
      }

      return options.bookmarksStore.updateTag({
        ...tag,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
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
    move: os.handler(async ({ input }) => {
      assertCurrentUser(options.currentUser);
      assertBookmarksStore(options.bookmarksStore);

      const folder = parseMoveFolderInput(input);

      if (!folder) {
        throw new ORPCError("BAD_REQUEST", {
          message: "Choose where to move this folder"
        });
      }

      return options.bookmarksStore.moveFolder({
        ...folder,
        allowedLibraryIds: currentUserLibraryIds(options.currentUser)
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
): {
  limit: number;
  cursor?: BookmarkCursor;
  folderId?: string;
  inbox?: boolean;
  tagId?: string;
} | null => {
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
    inbox: input.inbox === true,
    limit: parseBookmarksLimit(typeof input.limit === "number" ? String(input.limit) : null),
    tagId: typeof input.tagId === "string" && input.tagId ? input.tagId : undefined
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseCreateBookmarkInput = (input: unknown): CreateBookmarkInput | null => {
  if (!isRecord(input) || typeof input.url !== "string") {
    return null;
  }

  const url = parseHttpUrl(input.url);

  if (!url) {
    return null;
  }

  return {
    folderId: typeof input.folderId === "string" && input.folderId ? input.folderId : undefined,
    libraryId: typeof input.libraryId === "string" && input.libraryId ? input.libraryId : undefined,
    tagIds: parseSelectedTagIds(input.tagIds),
    url
  };
};

const parseBookmarkLocationsInput = (input: unknown): { url: string } | null => {
  if (!isRecord(input) || typeof input.url !== "string") {
    return null;
  }

  const url = parseHttpUrl(input.url);

  return url ? { url } : null;
};

const parseHttpUrl = (value: string) => {
  try {
    const url = new URL(value);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
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

const parseMoveBookmarksInput = (input: unknown): MoveBookmarksInput | null => {
  if (!isRecord(input) || !Array.isArray(input.bookmarkIds)) {
    return null;
  }

  const bookmarkIds = new Set<string>();

  for (const bookmarkId of input.bookmarkIds) {
    if (typeof bookmarkId !== "string" || !bookmarkId) {
      return null;
    }

    bookmarkIds.add(bookmarkId);
  }

  if (bookmarkIds.size === 0) {
    return null;
  }

  return {
    bookmarkIds: [...bookmarkIds].slice(0, 100),
    destinationFolderId:
      typeof input.destinationFolderId === "string" && input.destinationFolderId
        ? input.destinationFolderId
        : null
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

const parseCreateTagInput = (input: unknown): CreateTagInput | null => {
  if (!isRecord(input) || typeof input.libraryId !== "string") {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    color: parseFolderIconColor(input.color),
    libraryId: input.libraryId,
    name
  };
};

const parseUpdateTagInput = (input: unknown): UpdateTagInput | null => {
  if (!isRecord(input) || typeof input.tagId !== "string" || !input.tagId) {
    return null;
  }

  const name = parseFolderName(input.name);

  if (!name) {
    return null;
  }

  return {
    color: parseFolderIconColor(input.color),
    name,
    tagId: input.tagId
  };
};

const parseDeleteTagInput = (input: unknown): DeleteTagInput | null => {
  if (!isRecord(input) || typeof input.tagId !== "string" || !input.tagId) {
    return null;
  }

  return {
    tagId: input.tagId
  };
};

const parseMoveFolderInput = (input: unknown): MoveFolderInput | null => {
  if (!isRecord(input) || typeof input.folderId !== "string" || !input.folderId) {
    return null;
  }

  if (!Array.isArray(input.orderedSiblingIds)) {
    return null;
  }

  const orderedSiblingIds = new Set<string>();

  for (const folderId of input.orderedSiblingIds) {
    if (typeof folderId !== "string" || !folderId) {
      return null;
    }

    orderedSiblingIds.add(folderId);
  }

  if (orderedSiblingIds.size === 0) {
    return null;
  }

  return {
    folderId: input.folderId,
    orderedSiblingIds: [...orderedSiblingIds].slice(0, 200),
    parentId: typeof input.parentId === "string" && input.parentId ? input.parentId : null
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

const parseSelectedTagIds = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const tagIds = new Set<string>();

  for (const tagId of value) {
    if (typeof tagId !== "string" || !tagId) {
      return undefined;
    }

    tagIds.add(tagId);
  }

  return [...tagIds].slice(0, 50);
};

const currentUserLibraryIds = (currentUser: CurrentIdentity) =>
  currentUser.libraries.map((library) => library.id);

function assertCurrentUser(
  currentUser: CurrentIdentity | undefined
): asserts currentUser is CurrentIdentity {
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
