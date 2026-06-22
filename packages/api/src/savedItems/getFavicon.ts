import { and, eq } from "drizzle-orm";
import type { Buffer } from "node:buffer";
import type { Database } from "../db";
import { schema } from "../db";

export const getFavicon = async (
  db: Database,
  id: string
): Promise<{ contentType: string; imageBytes: Buffer } | null> => {
  const [row] = await db
    .select({
      contentType: schema.favicons.contentType,
      imageBytes: schema.favicons.imageBytes
    })
    .from(schema.favicons)
    .where(and(eq(schema.favicons.id, id), eq(schema.favicons.status, "fetched")))
    .limit(1);

  if (!row?.contentType || !row.imageBytes) {
    return null;
  }

  return {
    contentType: row.contentType,
    imageBytes: row.imageBytes
  };
};
