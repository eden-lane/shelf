import { and, desc, eq, inArray, type SQL } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { savedItemSelectFields, serializeSavedItem } from "./savedItemRows";
import type { ListSavedItemSearchDocumentsInput, SavedItemSearchDocument } from "./types";

export const listSavedItemSearchDocuments = async (
  db: Database,
  input: ListSavedItemSearchDocumentsInput
): Promise<SavedItemSearchDocument[]> => {
  if (input.libraryIds?.length === 0) {
    return [];
  }

  const filters: SQL[] = [];

  if (input.libraryIds) {
    filters.push(inArray(schema.savedItems.libraryId, input.libraryIds));
  }

  if (input.savedItemIds) {
    if (input.savedItemIds.length === 0) {
      return [];
    }

    filters.push(inArray(schema.savedItems.id, input.savedItemIds));
  }

  const rows = await db
    .select({
      ...savedItemSelectFields,
      libraryName: schema.libraries.name,
      tagName: schema.tags.name
    })
    .from(schema.savedItems)
    .innerJoin(schema.libraries, eq(schema.savedItems.libraryId, schema.libraries.id))
    .leftJoin(
      schema.folders,
      and(
        eq(schema.savedItems.folderId, schema.folders.id),
        eq(schema.savedItems.libraryId, schema.folders.libraryId)
      )
    )
    .leftJoin(
      schema.savedItemTags,
      and(
        eq(schema.savedItems.id, schema.savedItemTags.savedItemId),
        eq(schema.savedItems.libraryId, schema.savedItemTags.libraryId)
      )
    )
    .leftJoin(
      schema.tags,
      and(
        eq(schema.savedItemTags.tagId, schema.tags.id),
        eq(schema.savedItemTags.libraryId, schema.tags.libraryId)
      )
    )
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(schema.savedItems.createdAt), desc(schema.savedItems.id));

  const documents = new Map<string, SavedItemSearchDocument>();

  for (const row of rows) {
    const existing = documents.get(row.id);

    if (existing) {
      if (row.tagName && !existing.tagNames.includes(row.tagName)) {
        existing.tagNames.push(row.tagName);
      }

      continue;
    }

    documents.set(row.id, {
      ...serializeSavedItem(row as Parameters<typeof serializeSavedItem>[0]),
      libraryName: row.libraryName,
      tagNames: row.tagName ? [row.tagName] : []
    });
  }

  return [...documents.values()];
};
