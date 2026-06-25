import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { savedItemSelectFields, serializeSavedItem } from "./savedItemRows";
import type { AddSavedItemTagInput } from "./types";

export const addSavedItemTag = async (db: Database, input: AddSavedItemTagInput) => {
  return db.transaction(async (tx) => {
    const [existingItem] = await tx
      .select(savedItemSelectFields)
      .from(schema.savedItems)
      .leftJoin(
        schema.folders,
        and(
          eq(schema.savedItems.folderId, schema.folders.id),
          eq(schema.savedItems.libraryId, schema.folders.libraryId)
        )
      )
      .where(
        and(
          eq(schema.savedItems.id, input.savedItemId),
          inArray(schema.savedItems.libraryId, input.allowedLibraryIds)
        )
      )
      .limit(1);

    if (!existingItem) {
      throw new Error("Saved item does not exist");
    }

    const [tag] = await tx
      .select({ id: schema.tags.id })
      .from(schema.tags)
      .where(and(eq(schema.tags.id, input.tagId), eq(schema.tags.libraryId, existingItem.libraryId)))
      .limit(1);

    if (!tag) {
      throw new Error("Tag does not exist");
    }

    await tx
      .insert(schema.savedItemTags)
      .values({
        libraryId: existingItem.libraryId,
        savedItemId: input.savedItemId,
        tagId: input.tagId
      })
      .onConflictDoNothing();

    await tx
      .update(schema.savedItems)
      .set({ updatedAt: sql`now()` })
      .where(eq(schema.savedItems.id, input.savedItemId));

    const [row] = await tx
      .select(savedItemSelectFields)
      .from(schema.savedItems)
      .leftJoin(
        schema.folders,
        and(
          eq(schema.savedItems.folderId, schema.folders.id),
          eq(schema.savedItems.libraryId, schema.folders.libraryId)
        )
      )
      .where(eq(schema.savedItems.id, input.savedItemId))
      .limit(1);

    if (!row) {
      throw new Error("Unable to load saved item");
    }

    const tagRows = await tx
      .select({
        id: schema.tags.id,
        name: schema.tags.name,
        color: schema.tags.color
      })
      .from(schema.savedItemTags)
      .innerJoin(
        schema.tags,
        and(
          eq(schema.savedItemTags.tagId, schema.tags.id),
          eq(schema.savedItemTags.libraryId, schema.tags.libraryId)
        )
      )
      .where(eq(schema.savedItemTags.savedItemId, input.savedItemId))
      .orderBy(schema.tags.sortOrder, schema.tags.name, schema.tags.id);

    return serializeSavedItem(row, tagRows);
  });
};
