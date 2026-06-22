import type { FolderItem } from "@shelf/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";

export const findFolder = async (
  db: Database,
  folderId: string,
  allowedLibraryIds: string[]
): Promise<FolderItem | null> => {
  if (allowedLibraryIds.length === 0) {
    return null;
  }

  const [row] = await db
    .select({
      id: schema.folders.id,
      libraryId: schema.folders.libraryId,
      parentId: schema.folders.parentId,
      name: schema.folders.name,
      iconName: schema.folders.iconName,
      iconColor: schema.folders.iconColor,
      sortOrder: schema.folders.sortOrder,
      savedItemCount: sql<number>`count(${schema.savedItems.id})`,
      createdAt: schema.folders.createdAt,
      updatedAt: schema.folders.updatedAt
    })
    .from(schema.folders)
    .leftJoin(
      schema.savedItems,
      and(
        eq(schema.savedItems.folderId, schema.folders.id),
        eq(schema.savedItems.libraryId, schema.folders.libraryId)
      )
    )
    .where(and(eq(schema.folders.id, folderId), inArray(schema.folders.libraryId, allowedLibraryIds)))
    .groupBy(
      schema.folders.id,
      schema.folders.libraryId,
      schema.folders.parentId,
      schema.folders.name,
      schema.folders.iconName,
      schema.folders.iconColor,
      schema.folders.sortOrder,
      schema.folders.createdAt,
      schema.folders.updatedAt
    )
    .limit(1);

  return row ? serializeFolder(row) : null;
};

export const collectFolderSubtreeIds = (folders: FolderItem[], folderId: string): string[] => {
  const ids = [folderId];

  for (const child of folders.filter((folder) => folder.parentId === folderId)) {
    ids.push(...collectFolderSubtreeIds(folders, child.id));
  }

  return ids;
};

export const assertAllowedLibrary = (libraryId: string, allowedLibraryIds: string[]) => {
  if (!allowedLibraryIds.includes(libraryId)) {
    throw new Error("Library is not available");
  }
};

export const serializeFolder = (row: {
  id: string;
  libraryId: string;
  parentId: string | null;
  name: string;
  iconName: string | null;
  iconColor: string | null;
  sortOrder: number;
  savedItemCount: number | string;
  createdAt: Date;
  updatedAt: Date;
}): FolderItem => ({
  ...row,
  sortOrder: Number(row.sortOrder),
  savedItemCount: Number(row.savedItemCount),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});
