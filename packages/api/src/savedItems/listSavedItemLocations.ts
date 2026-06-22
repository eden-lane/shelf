import type { SavedItemLocation } from "@shelf/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import type { ListSavedItemLocationsInput } from "./types";

export const listSavedItemLocations = async (
  db: Database,
  input: ListSavedItemLocationsInput
): Promise<SavedItemLocation[]> => {
  if (input.libraryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: schema.savedItems.id,
      libraryId: schema.savedItems.libraryId,
      folderId: schema.savedItems.folderId,
      url: schema.savedItems.url,
      createdAt: schema.savedItems.createdAt,
      updatedAt: schema.savedItems.updatedAt
    })
    .from(schema.savedItems)
    .where(
      and(
        eq(schema.savedItems.url, input.url),
        inArray(schema.savedItems.libraryId, input.libraryIds)
      )
    )
    .orderBy(asc(schema.savedItems.libraryId), asc(schema.savedItems.folderId));

  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
};
