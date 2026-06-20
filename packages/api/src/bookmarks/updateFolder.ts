import type { FolderItem } from "@bookmarks/shared";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { findFolder, serializeFolder } from "./folderUtils";
import type { UpdateFolderInput } from "./types";

export const updateFolder = async (
  db: Database,
  input: UpdateFolderInput
): Promise<FolderItem> => {
  const existing = await findFolder(db, input.folderId, input.allowedLibraryIds);

  if (!existing) {
    throw new Error("Folder does not exist");
  }

  const [row] = await db
    .update(schema.folders)
    .set({
      name: input.name,
      iconName: input.iconName ?? null,
      iconColor: input.iconColor ?? null,
      updatedAt: sql`now()`
    })
    .where(eq(schema.folders.id, input.folderId))
    .returning({
      id: schema.folders.id,
      libraryId: schema.folders.libraryId,
      parentId: schema.folders.parentId,
      name: schema.folders.name,
      iconName: schema.folders.iconName,
      iconColor: schema.folders.iconColor,
      createdAt: schema.folders.createdAt,
      updatedAt: schema.folders.updatedAt
    });

  if (!row) {
    throw new Error("Unable to update folder");
  }

  return serializeFolder({ ...row, bookmarkCount: existing.bookmarkCount });
};
