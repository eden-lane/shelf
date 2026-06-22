import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import type { MoveSavedItemsInput } from "./types";

export const moveSavedItems = async (
  db: Database,
  input: MoveSavedItemsInput
): Promise<{ destinationFolderId: string | null; movedSavedItemIds: string[] }> => {
  const savedItemIds = [...new Set(input.savedItemIds)];

  if (savedItemIds.length === 0 || input.allowedLibraryIds.length === 0) {
    return {
      destinationFolderId: input.destinationFolderId ?? null,
      movedSavedItemIds: []
    };
  }

  const destinationFolderId = input.destinationFolderId ?? null;
  const [destinationFolder] = destinationFolderId
    ? await db
        .select({
          id: schema.folders.id,
          libraryId: schema.folders.libraryId
        })
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.id, destinationFolderId),
            inArray(schema.folders.libraryId, input.allowedLibraryIds)
          )
        )
        .limit(1)
    : [];

  if (destinationFolderId && !destinationFolder) {
    throw new Error("Destination folder does not exist");
  }

  const savedItems = await db
    .select({
      id: schema.savedItems.id,
      libraryId: schema.savedItems.libraryId
    })
    .from(schema.savedItems)
    .where(
      and(
        inArray(schema.savedItems.id, savedItemIds),
        inArray(schema.savedItems.libraryId, input.allowedLibraryIds)
      )
    );

  if (savedItems.length !== savedItemIds.length) {
    throw new Error("Choose available saved items");
  }

  if (
    destinationFolder &&
    savedItems.some((savedItem) => savedItem.libraryId !== destinationFolder.libraryId)
  ) {
    throw new Error("Choose a destination folder in the saved item library");
  }

  const rows = await db
    .update(schema.savedItems)
    .set({
      folderId: destinationFolder?.id ?? null,
      updatedAt: sql`now()`
    })
    .where(
      and(
        inArray(schema.savedItems.id, savedItemIds),
        inArray(schema.savedItems.libraryId, input.allowedLibraryIds)
      )
    )
    .returning({ id: schema.savedItems.id });

  return {
    destinationFolderId,
    movedSavedItemIds: rows.map((row) => row.id)
  };
};
