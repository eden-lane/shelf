import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import type { CreateBookmarkInput } from "./types";

export const createBookmark = async (db: Database, input: CreateBookmarkInput) => {
  const [savedItem] = await db
    .insert(schema.savedItems)
    .values({
      createdByUserId: input.createdByUserId,
      folderId: input.folderId,
      libraryId: input.libraryId,
      url: input.url
    })
    .onConflictDoUpdate({
      target: [schema.savedItems.libraryId, schema.savedItems.url],
      set: {
        folderId: input.folderId,
        updatedAt: sql`now()`
      }
    })
    .returning({
      id: schema.savedItems.id
    });

  if (!savedItem) {
    throw new Error("Unable to save bookmark");
  }

  const [row] = await db
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
    .where(eq(schema.savedItems.id, savedItem.id))
    .limit(1);

  if (!row) {
    throw new Error("Unable to load saved bookmark");
  }

  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};
