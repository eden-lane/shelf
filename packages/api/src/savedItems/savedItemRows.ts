import type { SavedItem, SavedItemTag } from "@shelf/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";

export const savedItemSelectFields = {
  id: schema.savedItems.id,
  libraryId: schema.savedItems.libraryId,
  folderId: schema.savedItems.folderId,
  folderName: schema.folders.name,
  url: schema.savedItems.url,
  title: schema.savedItems.title,
  description: schema.savedItems.description,
  siteName: schema.savedItems.siteName,
  imageUrl: schema.savedItems.imageUrl,
  metadataStatus: schema.savedItems.metadataStatus,
  metadataFetchedAt: schema.savedItems.metadataFetchedAt,
  faviconId: schema.savedItems.faviconId,
  createdAt: schema.savedItems.createdAt,
  updatedAt: schema.savedItems.updatedAt
};

export interface SavedItemRow {
  id: string;
  libraryId: string;
  folderId: string | null;
  folderName: string | null;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  metadataStatus: SavedItem["metadataStatus"];
  metadataFetchedAt: Date | null;
  faviconId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const serializeSavedItem = (row: SavedItemRow, tags: SavedItemTag[] = []): SavedItem => ({
  id: row.id,
  libraryId: row.libraryId,
  folderId: row.folderId,
  folderName: row.folderName,
  url: row.url,
  title: row.title,
  description: row.description,
  siteName: row.siteName,
  imageUrl: row.imageUrl,
  metadataStatus: row.metadataStatus,
  metadataFetchedAt: row.metadataFetchedAt?.toISOString() ?? null,
  faviconId: row.faviconId,
  faviconUrl: row.faviconId ? `/favicons/${row.faviconId}` : null,
  tags,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});

export const withSavedItemTags = async <T extends SavedItem>(
  db: Database,
  items: T[]
): Promise<T[]> => {
  const savedItemIds = items.map((item) => item.id);

  if (savedItemIds.length === 0) {
    return items;
  }

  const rows = await db
    .select({
      savedItemId: schema.savedItemTags.savedItemId,
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
    .where(inArray(schema.savedItemTags.savedItemId, savedItemIds))
    .orderBy(asc(schema.tags.sortOrder), asc(schema.tags.name), asc(schema.tags.id));

  const tagsBySavedItemId = new Map<string, SavedItemTag[]>();

  for (const row of rows) {
    const tags = tagsBySavedItemId.get(row.savedItemId) ?? [];
    tags.push({
      id: row.id,
      name: row.name,
      color: row.color
    });
    tagsBySavedItemId.set(row.savedItemId, tags);
  }

  return items.map((item) => ({
    ...item,
    tags: tagsBySavedItemId.get(item.id) ?? []
  }));
};
