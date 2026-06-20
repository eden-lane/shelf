import type { CurrentUserResponse } from "@bookmarks/shared";
import { ORPCError, os } from "@orpc/server";
import {
  decodeBookmarkCursor,
  listBookmarksPage,
  parseBookmarksLimit,
  type BookmarkCursor,
  type BookmarksStore
} from "./bookmarks";
import type { DevIdentity } from "./devIdentity";
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

    return currentUserResponse(options.currentUser);
  }),
  bookmarks: {
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

const currentUserResponse = (currentUser: DevIdentity): CurrentUserResponse => ({
  user: {
    id: currentUser.userId,
    email: currentUser.email,
    name: currentUser.name
  },
  organization: {
    id: currentUser.organizationId,
    name: currentUser.organizationName,
    slug: currentUser.organizationSlug,
    role: "owner"
  },
  libraries: [
    {
      id: currentUser.personalLibraryId,
      kind: "personal",
      name: currentUser.personalLibraryName,
      inboxFolderId: currentUser.personalInboxFolderId
    },
    {
      id: currentUser.organizationLibraryId,
      kind: "organization",
      name: currentUser.organizationLibraryName,
      inboxFolderId: currentUser.organizationInboxFolderId,
      organizationId: currentUser.organizationId,
      organizationSlug: currentUser.organizationSlug
    }
  ]
});

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
