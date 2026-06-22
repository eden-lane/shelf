import type { TagItem } from "@shelf/shared";
import { eq, max } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { assertAllowedLibrary } from "./folderUtils";
import type { CreateTagInput } from "./types";

export const createTag = async (db: Database, input: CreateTagInput): Promise<TagItem> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  const [maxSortOrderRow] = await db
    .select({
      value: max(schema.tags.sortOrder)
    })
    .from(schema.tags)
    .where(eq(schema.tags.libraryId, input.libraryId));
  const maxSortOrder =
    typeof maxSortOrderRow?.value === "number"
      ? maxSortOrderRow.value
      : Number(maxSortOrderRow?.value ?? -1);
  const sortOrder = Number.isFinite(maxSortOrder) ? maxSortOrder + 1 : 0;

  const [row] = await db
    .insert(schema.tags)
    .values({
      color: input.color ?? null,
      libraryId: input.libraryId,
      name: input.name,
      sortOrder
    })
    .returning({
      id: schema.tags.id,
      libraryId: schema.tags.libraryId,
      name: schema.tags.name,
      color: schema.tags.color,
      sortOrder: schema.tags.sortOrder,
      createdAt: schema.tags.createdAt,
      updatedAt: schema.tags.updatedAt
    });

  if (!row) {
    throw new Error("Unable to create tag");
  }

  return {
    id: row.id,
    libraryId: row.libraryId,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    savedItemCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};
