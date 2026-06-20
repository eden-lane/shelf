import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { collectFolderSubtreeIds } from "./folderUtils";
import { listFolders } from "./listFolders";
import type { DeleteFolderInput } from "./types";

export const deleteFolder = async (
  db: Database,
  input: DeleteFolderInput
): Promise<{ deletedFolderIds: string[] }> => {
  const folders = await listFolders(db, { libraryIds: input.allowedLibraryIds });
  const target = folders.find((folder) => folder.id === input.folderId);

  if (!target) {
    throw new Error("Folder does not exist");
  }

  const deletedFolderIds = collectFolderSubtreeIds(folders, target.id);

  await db.transaction(async (tx) => {
    if (input.mode === "move") {
      const destination = input.destinationFolderId
        ? folders.find((folder) => folder.id === input.destinationFolderId)
        : null;

      if (
        !destination ||
        destination.libraryId !== target.libraryId ||
        deletedFolderIds.includes(destination.id)
      ) {
        throw new Error("Choose a destination folder outside the deleted folder");
      }

      await tx
        .update(schema.savedItems)
        .set({
          folderId: destination.id,
          updatedAt: sql`now()`
        })
        .where(
          and(
            eq(schema.savedItems.libraryId, target.libraryId),
            inArray(schema.savedItems.folderId, deletedFolderIds)
          )
        );
    } else {
      await tx
        .delete(schema.savedItems)
        .where(
          and(
            eq(schema.savedItems.libraryId, target.libraryId),
            inArray(schema.savedItems.folderId, deletedFolderIds)
          )
        );
    }

    await tx.delete(schema.folders).where(eq(schema.folders.id, target.id));
  });

  return { deletedFolderIds };
};
