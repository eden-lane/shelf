import { and, eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { savedItemSelectFields, serializeSavedItem } from "./savedItemRows";
import type { CreateSavedItemInput } from "./types";

export const createSavedItem = async (db: Database, input: CreateSavedItemInput) => {
  const hasClientMetadata = Boolean(input.title || input.siteName || input.imageUrl);

  return db.transaction(async (tx) => {
    const [savedItem] = await tx
      .insert(schema.savedItems)
      .values({
        createdByUserId: input.createdByUserId,
        description: input.description,
        folderId: input.folderId,
        imageUrl: input.imageUrl,
        libraryId: input.libraryId,
        metadataFetchedAt: hasClientMetadata ? new Date() : null,
        metadataStatus: hasClientMetadata ? "fetched" : "pending",
        siteName: input.siteName,
        title: input.title,
        url: input.url
      })
      .onConflictDoUpdate({
        target: [schema.savedItems.libraryId, schema.savedItems.url],
        set: {
          description: input.description,
          folderId: input.folderId,
          imageUrl: input.imageUrl ?? sql`${schema.savedItems.imageUrl}`,
          metadataFetchedAt: hasClientMetadata ? new Date() : sql`${schema.savedItems.metadataFetchedAt}`,
          metadataStatus: hasClientMetadata ? "fetched" : sql`${schema.savedItems.metadataStatus}`,
          siteName: input.siteName ?? sql`${schema.savedItems.siteName}`,
          title: input.title ?? sql`${schema.savedItems.title}`,
          updatedAt: sql`now()`
        }
      })
      .returning({
        id: schema.savedItems.id
      });

    if (!savedItem) {
      throw new Error("Unable to save saved item");
    }

    if (input.tagIds) {
      await tx.delete(schema.savedItemTags).where(eq(schema.savedItemTags.savedItemId, savedItem.id));

      if (input.tagIds.length > 0) {
        await tx
          .insert(schema.savedItemTags)
          .values(
            input.tagIds.map((tagId) => ({
              libraryId: input.libraryId,
              savedItemId: savedItem.id,
              tagId
            }))
          )
          .onConflictDoNothing();
      }
    }

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
      .where(eq(schema.savedItems.id, savedItem.id))
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
      .where(eq(schema.savedItemTags.savedItemId, savedItem.id))
      .orderBy(schema.tags.sortOrder, schema.tags.name, schema.tags.id);

    return serializeSavedItem(row, tagRows);
  });
};
