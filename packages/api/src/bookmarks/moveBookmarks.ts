import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import type { MoveBookmarksInput } from "./types";

export const moveBookmarks = async (
  db: Database,
  input: MoveBookmarksInput
): Promise<{ destinationFolderId: string | null; movedBookmarkIds: string[] }> => {
  const bookmarkIds = [...new Set(input.bookmarkIds)];

  if (bookmarkIds.length === 0 || input.allowedLibraryIds.length === 0) {
    return {
      destinationFolderId: input.destinationFolderId ?? null,
      movedBookmarkIds: []
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

  const bookmarks = await db
    .select({
      id: schema.savedItems.id,
      libraryId: schema.savedItems.libraryId
    })
    .from(schema.savedItems)
    .where(
      and(
        inArray(schema.savedItems.id, bookmarkIds),
        inArray(schema.savedItems.libraryId, input.allowedLibraryIds)
      )
    );

  if (bookmarks.length !== bookmarkIds.length) {
    throw new Error("Choose available bookmarks");
  }

  if (
    destinationFolder &&
    bookmarks.some((bookmark) => bookmark.libraryId !== destinationFolder.libraryId)
  ) {
    throw new Error("Choose a destination folder in the bookmark library");
  }

  const rows = await db
    .update(schema.savedItems)
    .set({
      folderId: destinationFolder?.id ?? null,
      updatedAt: sql`now()`
    })
    .where(
      and(
        inArray(schema.savedItems.id, bookmarkIds),
        inArray(schema.savedItems.libraryId, input.allowedLibraryIds)
      )
    )
    .returning({ id: schema.savedItems.id });

  return {
    destinationFolderId,
    movedBookmarkIds: rows.map((row) => row.id)
  };
};
