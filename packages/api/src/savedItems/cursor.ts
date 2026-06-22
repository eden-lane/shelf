import { Buffer } from "node:buffer";
import type { SavedItemCursor } from "./types";

export const encodeSavedItemCursor = (cursor: SavedItemCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export const decodeSavedItemCursor = (value: string): SavedItemCursor | null => {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<
      SavedItemCursor
    >;

    if (
      typeof cursor.id !== "string" ||
      typeof cursor.createdAt !== "string" ||
      Number.isNaN(Date.parse(cursor.createdAt))
    ) {
      return null;
    }

    return {
      id: cursor.id,
      createdAt: cursor.createdAt
    };
  } catch {
    return null;
  }
};
