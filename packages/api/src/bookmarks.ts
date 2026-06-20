import { Buffer } from "node:buffer";
import type { BookmarkItem, BookmarksPageResponse } from "@bookmarks/shared";
import { and, desc, eq, inArray, lt, or, type SQL } from "drizzle-orm";
import type { Database } from "./db";
import { schema } from "./db";

export const DEFAULT_BOOKMARKS_LIMIT = 20;
export const MAX_BOOKMARKS_LIMIT = 50;

export interface BookmarkCursor {
  createdAt: string;
  id: string;
}

export interface ListBookmarksInput {
  libraryIds: string[];
  limit: number;
  cursor?: BookmarkCursor;
}

export interface BookmarksStore {
  listBookmarks(input: ListBookmarksInput): Promise<BookmarkItem[]>;
}

export const createDatabaseBookmarksStore = (db: Database): BookmarksStore => ({
  async listBookmarks(input) {
    if (input.libraryIds.length === 0) {
      return [];
    }

    const filters: SQL[] = [inArray(schema.savedItems.libraryId, input.libraryIds)];

    if (input.cursor) {
      const cursorCreatedAt = new Date(input.cursor.createdAt);
      const cursorFilter = or(
        lt(schema.savedItems.createdAt, cursorCreatedAt),
        and(
          eq(schema.savedItems.createdAt, cursorCreatedAt),
          lt(schema.savedItems.id, input.cursor.id)
        )
      );

      if (cursorFilter) {
        filters.push(cursorFilter);
      }
    }

    const rows = await db
      .select({
        id: schema.savedItems.id,
        libraryId: schema.savedItems.libraryId,
        folderId: schema.savedItems.folderId,
        folderName: schema.folders.name,
        url: schema.savedItems.url,
        title: schema.savedItems.title,
        description: schema.savedItems.description,
        createdAt: schema.savedItems.createdAt,
        updatedAt: schema.savedItems.updatedAt
      })
      .from(schema.savedItems)
      .innerJoin(
        schema.folders,
        and(
          eq(schema.savedItems.folderId, schema.folders.id),
          eq(schema.savedItems.libraryId, schema.folders.libraryId)
        )
      )
      .where(and(...filters))
      .orderBy(desc(schema.savedItems.createdAt), desc(schema.savedItems.id))
      .limit(input.limit + 1);

    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    }));
  }
});

export const listBookmarksPage = async (
  store: BookmarksStore,
  input: ListBookmarksInput
): Promise<BookmarksPageResponse> => {
  const rows = await store.listBookmarks({
    ...input,
    limit: input.limit
  });
  const items = rows.slice(0, input.limit);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > input.limit && lastItem
        ? encodeBookmarkCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id
          })
        : null
  };
};

export const parseBookmarksLimit = (value: string | null): number => {
  if (!value) {
    return DEFAULT_BOOKMARKS_LIMIT;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_BOOKMARKS_LIMIT;
  }

  return Math.min(parsed, MAX_BOOKMARKS_LIMIT);
};

export const encodeBookmarkCursor = (cursor: BookmarkCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export const decodeBookmarkCursor = (value: string): BookmarkCursor | null => {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<
      BookmarkCursor
    >;

    if (
      typeof cursor.id !== "string" ||
      typeof cursor.createdAt !== "string" ||
      Number.isNaN(Date.parse(cursor.createdAt))
    ) {
      return null;
    }

    return {
      id: cursor.id,
      createdAt: cursor.createdAt
    };
  } catch {
    return null;
  }
};
