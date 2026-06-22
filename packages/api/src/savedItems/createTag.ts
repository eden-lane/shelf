import type { TagItem } from "@shelf/shared";
import type { Database } from "../db";
import { schema } from "../db";
import { assertAllowedLibrary } from "./folderUtils";
import type { CreateTagInput } from "./types";

export const createTag = async (db: Database, input: CreateTagInput): Promise<TagItem> => {
  assertAllowedLibrary(input.libraryId, input.allowedLibraryIds);

  const [row] = await db
    .insert(schema.tags)
    .values({
      color: input.color ?? null,
      libraryId: input.libraryId,
      name: input.name
    })
    .returning({
      id: schema.tags.id,
      libraryId: schema.tags.libraryId,
      name: schema.tags.name,
      color: schema.tags.color,
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
    savedItemCount: 0,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};
