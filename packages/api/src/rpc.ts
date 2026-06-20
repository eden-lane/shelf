import type { CreateBookmarkInput } from "@bookmarks/shared";
import { ORPCError, os } from "@orpc/server";
import {
  decodeBookmarkCursor,
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

      return options.bookmarksStore.createBookmark({
        createdByUserId: options.currentUser.userId,
        folderId: options.currentUser.personalInboxFolderId,
        libraryId: options.currentUser.personalLibraryId,
        url: bookmark.url
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
        libraryIds: [
          options.currentUser.personalLibraryId,
          options.currentUser.organizationLibraryId
        ]
      });
    })
  }
});

export type RpcRouter = ReturnType<typeof createRpcRouter>;

const parseBookmarksInput = (
  input: unknown
): { limit: number; cursor?: BookmarkCursor } | null => {
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
      url: url.toString()
    };
  } catch {
    return null;
  }
};
