import type { FolderItem } from "@shelf/shared";
import { and, eq, isNull, max } from "drizzle-orm";
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

  const [maxSortOrderRow] = await db
    .select({
      value: max(schema.folders.sortOrder)
    })
    .from(schema.folders)
    .where(
      and(
        eq(schema.folders.libraryId, input.libraryId),
        input.parentId
          ? eq(schema.folders.parentId, input.parentId)
          : isNull(schema.folders.parentId)
      )
    );
  const maxSortOrder =
    typeof maxSortOrderRow?.value === "number"
      ? maxSortOrderRow.value
      : Number(maxSortOrderRow?.value ?? -1);
  const sortOrder = Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : 0;

  const [row] = await db
    .insert(schema.folders)
    .values({
      libraryId: input.libraryId,
      parentId: input.parentId ?? null,
      name: input.name,
      iconName: input.iconName ?? null,
      iconColor: input.iconColor ?? null,
      sortOrder
    })
    .returning({
      id: schema.folders.id,
      libraryId: schema.folders.libraryId,
      parentId: schema.folders.parentId,
      name: schema.folders.name,
      iconName: schema.folders.iconName,
      iconColor: schema.folders.iconColor,
      sortOrder: schema.folders.sortOrder,
      createdAt: schema.folders.createdAt,
      updatedAt: schema.folders.updatedAt
    });

  if (!row) {
    throw new Error("Unable to create folder");
  }

  return serializeFolder({ ...row, savedItemCount: 0 });
};
