import type { FolderItem } from "@shelf/shared";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { collectFolderSubtreeIds } from "./folderUtils";
import { listFolders } from "./listFolders";
import type { MoveFolderInput } from "./types";

export const moveFolder = async (
  db: Database,
  input: MoveFolderInput
): Promise<FolderItem[]> => {
  const folders = await listFolders(db, { libraryIds: input.allowedLibraryIds });
  const target = folders.find((folder) => folder.id === input.folderId);

  if (!target) {
    throw new Error("Folder does not exist");
  }

  const parentId = input.parentId ?? null;
  const parent = parentId ? folders.find((folder) => folder.id === parentId) : null;

  if (parentId && (!parent || parent.libraryId !== target.libraryId)) {
    throw new Error("Destination folder does not exist in this library");
  }

  if (parentId && collectFolderSubtreeIds(folders, target.id).includes(parentId)) {
    throw new Error("Folder cannot be moved into itself");
  }

  const orderedSiblingIds = [...new Set(input.orderedSiblingIds)];

  if (!orderedSiblingIds.includes(target.id)) {
    throw new Error("Moved folder must be included in sibling order");
  }

  const expectedSiblingIds = new Set(
    folders
      .filter((folder) =>
        folder.id === target.id
          ? true
          : folder.libraryId === target.libraryId && folder.parentId === parentId
      )
      .map((folder) => folder.id)
  );

  if (
    expectedSiblingIds.size !== orderedSiblingIds.length ||
    orderedSiblingIds.some((folderId) => !expectedSiblingIds.has(folderId))
  ) {
    throw new Error("Sibling order is incomplete");
  }

  await db.transaction(async (tx) => {
    await tx
      .update(schema.folders)
      .set({
        parentId,
        updatedAt: sql`now()`
      })
      .where(
        and(eq(schema.folders.id, target.id), inArray(schema.folders.libraryId, input.allowedLibraryIds))
      );

    for (const [sortOrder, folderId] of orderedSiblingIds.entries()) {
      await tx
        .update(schema.folders)
        .set({
          sortOrder,
          updatedAt: sql`now()`
        })
        .where(
          and(
            eq(schema.folders.id, folderId),
            eq(schema.folders.libraryId, target.libraryId),
            parentId ? eq(schema.folders.parentId, parentId) : isNull(schema.folders.parentId)
          )
        );
    }
  });

  return listFolders(db, { libraryIds: input.allowedLibraryIds });
};
