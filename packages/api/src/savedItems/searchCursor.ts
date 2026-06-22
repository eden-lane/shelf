import { Buffer } from "node:buffer";
import type { SavedItemSearchCursor } from "./types";

export const encodeSavedItemSearchCursor = (cursor: SavedItemSearchCursor): string =>
  Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");

export const decodeSavedItemSearchCursor = (value: string): SavedItemSearchCursor | null => {
  try {
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<
      SavedItemSearchCursor
    >;

    const offset = cursor.offset;

    if (!Number.isInteger(offset) || offset === undefined || offset < 0) {
      return null;
    }

    return {
      offset
    };
  } catch {
    return null;
  }
};
