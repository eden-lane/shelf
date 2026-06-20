import type { FolderItem } from "@bookmarks/shared";
import type { Database } from "../db";
import { schema } from "../db";
import { assertAllowedLibrary, findFolder, serializeFolder } from "./folderUtils";
import type { CreateFolderInput } from "./types";

export const createFolder = async (
  db: Database,
  input: CreateFolderInput
): Promise<FolderItem> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  if (input.parentId) {
    const parent = await findFolder(db, input.parentId, input.allowedLibraryIds);

    if (!parent || parent.libraryId !== input.libraryId) {
      throw new Error("Parent folder does not exist in this library");
    }
  }

  const [row] = await db
    .insert(schema.folders)
    .values({
      libraryId: input.libraryId,
      parentId: input.parentId ?? null,
      name: input.name
    })
    .returning({
      id: schema.folders.id,
      libraryId: schema.folders.libraryId,
      parentId: schema.folders.parentId,
      name: schema.folders.name,
      createdAt: schema.folders.createdAt,
      updatedAt: schema.folders.updatedAt
    });

  if (!row) {
    throw new Error("Unable to create folder");
  }

  return serializeFolder({ ...row, bookmarkCount: 0 });
};
