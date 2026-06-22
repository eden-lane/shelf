import type { TagItem } from "@shelf/shared";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { listTags } from "./listTags";
import type { MoveTagInput } from "./types";

export const moveTag = async (db: Database, input: MoveTagInput): Promise<TagItem[]> => {
  const tags = await listTags(db, { libraryIds: input.allowedLibraryIds });
  const target = tags.find((tag) => tag.id === input.tagId);

  if (!target) {
    throw new Error("Tag does not exist");
  }

  const orderedTagIds = [...new Set(input.orderedTagIds)];

  if (!orderedTagIds.includes(target.id)) {
    throw new Error("Moved tag must be included in tag order");
  }

  const expectedTagIds = new Set(
    tags.filter((tag) => tag.libraryId === target.libraryId).map((tag) => tag.id)
  );

  if (
    expectedTagIds.size !== orderedTagIds.length ||
    orderedTagIds.some((tagId) => !expectedTagIds.has(tagId))
  ) {
    throw new Error("Tag order is incomplete");
  }

  await db.transaction(async (tx) => {
    for (const [sortOrder, tagId] of orderedTagIds.entries()) {
      await tx
        .update(schema.tags)
        .set({
          sortOrder,
          updatedAt: sql`now()`
        })
        .where(
          and(
            eq(schema.tags.id, tagId),
            eq(schema.tags.libraryId, target.libraryId),
            inArray(schema.tags.libraryId, input.allowedLibraryIds)
          )
        );
    }
  });

  return listTags(db, { libraryIds: input.allowedLibraryIds });
};
