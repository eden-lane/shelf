import type { FolderItem } from "@bookmarks/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { serializeFolder } from "./folderUtils";
import type { ListFoldersInput } from "./types";

export const listFolders = async (
  db: Database,
  input: ListFoldersInput
): Promise<FolderItem[]> => {
  if (input.libraryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: schema.folders.id,
      libraryId: schema.folders.libraryId,
      parentId: schema.folders.parentId,
      name: schema.folders.name,
      bookmarkCount: sql<number>`count(${schema.savedItems.id})`,
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
    .where(inArray(schema.folders.libraryId, input.libraryIds))
    .groupBy(
      schema.folders.id,
      schema.folders.libraryId,
      schema.folders.parentId,
      schema.folders.name,
      schema.folders.createdAt,
      schema.folders.updatedAt
    )
    .orderBy(asc(schema.folders.name), asc(schema.folders.id));

  return rows.map(serializeFolder);
};
