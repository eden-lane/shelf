import { Buffer } from "node:buffer";
import type { BookmarkCursor } from "./types";

export const encodeBookmarkCursor = (cursor: BookmarkCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export const decodeBookmarkCursor = (value: string): BookmarkCursor | null => {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<
      BookmarkCursor
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
