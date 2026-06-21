import { eq } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import { listTags } from "./listTags";
import type { DeleteTagInput } from "./types";

export const deleteTag = async (
  db: Database,
  input: DeleteTagInput
): Promise<{ deletedTagId: string }> => {
  const existing = (await listTags(db, { libraryIds: input.allowedLibraryIds })).find(
    (tag) => tag.id === input.tagId
  );

  if (!existing) {
    throw new Error("Tag does not exist");
  }

  await db.delete(schema.tags).where(eq(schema.tags.id, input.tagId));

  return { deletedTagId: input.tagId };
};
