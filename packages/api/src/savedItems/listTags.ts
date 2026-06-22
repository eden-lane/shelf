import type { TagItem } from "@shelf/shared";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import type { ListTagsInput } from "./types";

export const listTags = async (db: Database, input: ListTagsInput): Promise<TagItem[]> => {
  if (input.libraryIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: schema.tags.id,
      libraryId: schema.tags.libraryId,
      name: schema.tags.name,
      color: schema.tags.color,
      savedItemCount: sql<number>`count(${schema.savedItemTags.savedItemId})`,
      createdAt: schema.tags.createdAt,
      updatedAt: schema.tags.updatedAt
    })
    .from(schema.tags)
    .leftJoin(
      schema.savedItemTags,
      and(
        eq(schema.savedItemTags.tagId, schema.tags.id),
        eq(schema.savedItemTags.libraryId, schema.tags.libraryId)
      )
    )
    .where(inArray(schema.tags.libraryId, input.libraryIds))
    .groupBy(
      schema.tags.id,
      schema.tags.libraryId,
      schema.tags.name,
      schema.tags.color,
      schema.tags.createdAt,
      schema.tags.updatedAt
    )
    .orderBy(asc(schema.tags.name), asc(schema.tags.id));

  return rows.map((row) => ({
    id: row.id,
    libraryId: row.libraryId,
    name: row.name,
    color: row.color,
    savedItemCount: Number(row.savedItemCount),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  }));
};
