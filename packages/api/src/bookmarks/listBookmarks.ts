import type { BookmarksPageResponse } from "@bookmarks/shared";
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { bookmarkSelectFields, serializeBookmark } from "./bookmarkRows";
import { encodeBookmarkCursor } from "./cursor";
import type { BookmarksStore, ListBookmarksInput } from "./types";

export const DEFAULT_BOOKMARKS_LIMIT = 20;
export const MAX_BOOKMARKS_LIMIT = 50;

export const listBookmarks = async (db: Database, input: ListBookmarksInput) => {
  if (input.libraryIds.length === 0) {
    return [];
  }

  const filters: SQL[] = [inArray(schema.savedItems.libraryId, input.libraryIds)];

  if (input.libraryId) {
    filters.push(eq(schema.savedItems.libraryId, input.libraryId));
  }

  if (input.folderId) {
    filters.push(eq(schema.savedItems.folderId, input.folderId));
  } else if (input.inbox) {
    filters.push(isNull(schema.savedItems.folderId));
  }

  if (input.tagId) {
    filters.push(sql`exists (
      select 1
      from ${schema.savedItemTags}
      where ${schema.savedItemTags.savedItemId} = ${schema.savedItems.id}
        and ${schema.savedItemTags.libraryId} = ${schema.savedItems.libraryId}
        and ${schema.savedItemTags.tagId} = ${input.tagId}
    )`);
  }

  if (input.cursor) {
    const cursorCreatedAt = new Date(input.cursor.createdAt);
    const cursorFilter = or(
      lt(schema.savedItems.createdAt, cursorCreatedAt),
      and(eq(schema.savedItems.createdAt, cursorCreatedAt), lt(schema.savedItems.id, input.cursor.id))
    );

    if (cursorFilter) {
      filters.push(cursorFilter);
    }
  }

  const rows = await db
    .select(bookmarkSelectFields)
    .from(schema.savedItems)
    .leftJoin(
      schema.folders,
      and(
        eq(schema.savedItems.folderId, schema.folders.id),
        eq(schema.savedItems.libraryId, schema.folders.libraryId)
      )
    )
    .where(and(...filters))
    .orderBy(desc(schema.savedItems.createdAt), desc(schema.savedItems.id))
    .limit(input.limit + 1);

  return rows.map(serializeBookmark);
};

export const listBookmarksPage = async (
  store: Pick<BookmarksStore, "listBookmarks">,
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
