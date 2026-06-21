import type { TagItem } from "@bookmarks/shared";
import { eq, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { listTags } from "./listTags";
import type { UpdateTagInput } from "./types";

export const updateTag = async (db: Database, input: UpdateTagInput): Promise<TagItem> => {
  const existing = (await listTags(db, { libraryIds: input.allowedLibraryIds })).find(
    (tag) => tag.id === input.tagId
  );

  if (!existing) {
    throw new Error("Tag does not exist");
  }

  const [row] = await db
    .update(schema.tags)
    .set({
      color: input.color ?? null,
      name: input.name,
      updatedAt: sql`now()`
    })
    .where(eq(schema.tags.id, input.tagId))
    .returning({
      id: schema.tags.id,
      libraryId: schema.tags.libraryId,
      name: schema.tags.name,
      color: schema.tags.color,
      createdAt: schema.tags.createdAt,
      updatedAt: schema.tags.updatedAt
    });

  if (!row) {
    throw new Error("Unable to update tag");
  }

  return {
    id: row.id,
    libraryId: row.libraryId,
    name: row.name,
    color: row.color,
    bookmarkCount: existing.bookmarkCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
};
