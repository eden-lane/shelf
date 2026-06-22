import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../db";
import { schema } from "../db";
import type { DeleteSavedItemInput } from "./types";

export const deleteSavedItem = async (
  db: Database,
  input: DeleteSavedItemInput
): Promise<{ deletedSavedItemId: string }> => {
  const [deletedSavedItem] = await db
    .delete(schema.savedItems)
    .where(
      and(
        eq(schema.savedItems.id, input.savedItemId),
        inArray(schema.savedItems.libraryId, input.allowedLibraryIds)
      )
    )
    .returning({ id: schema.savedItems.id });

  if (!deletedSavedItem) {
    throw new Error("SavedItem does not exist");
  }

  return { deletedSavedItemId: deletedSavedItem.id };
};
