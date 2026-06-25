import type { SavedItemsPageResponse } from "@shelf/shared";
import { and, desc, eq, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { savedItemSelectFields, serializeSavedItem, withSavedItemTags } from "./savedItemRows";
import { encodeSavedItemCursor } from "./cursor";
import type { SavedItemsStore, ListSavedItemsInput } from "./types";

export const DEFAULT_SAVED_ITEMS_LIMIT = 20;
export const MAX_SAVED_ITEMS_LIMIT = 50;

export const listSavedItems = async (db: Database, input: ListSavedItemsInput) => {
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
    .select(savedItemSelectFields)
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

  return withSavedItemTags(db, rows.map((row) => serializeSavedItem(row)));
};

export const listSavedItemsPage = async (
  store: Pick<SavedItemsStore, "listSavedItems">,
  input: ListSavedItemsInput
): Promise<SavedItemsPageResponse> => {
  const rows = await store.listSavedItems({
    ...input,
    limit: input.limit
  });
  const items = rows.slice(0, input.limit);
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor:
      rows.length > input.limit && lastItem
        ? encodeSavedItemCursor({
            createdAt: lastItem.createdAt,
            id: lastItem.id
          })
        : null
  };
};

export const parseSavedItemsLimit = (value: string | null): number => {
  if (!value) {
    return DEFAULT_SAVED_ITEMS_LIMIT;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return DEFAULT_SAVED_ITEMS_LIMIT;
  }

  return Math.min(parsed, MAX_SAVED_ITEMS_LIMIT);
};
