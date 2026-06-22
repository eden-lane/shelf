import type { BookmarksPageResponse } from "@bookmarks/shared";
import {
  decodeSavedItemSearchCursor,
  encodeSavedItemSearchCursor
} from "./searchCursor";
import type { SavedItemSearchDocument, SearchBookmarksInput } from "./types";

export interface SavedItemSearchIndex {
  delete(savedItemIds: string[]): Promise<void>;
  search(input: SearchBookmarksInput): Promise<BookmarksPageResponse>;
  upsert(documents: SavedItemSearchDocument[]): Promise<void>;
}

export const searchSavedItemsPage = async (
  index: SavedItemSearchIndex,
  input: Omit<SearchBookmarksInput, "cursor"> & { cursor?: string | null }
): Promise<BookmarksPageResponse | null> => {
  const decodedCursor = input.cursor ? decodeSavedItemSearchCursor(input.cursor) : undefined;

  if (input.cursor && !decodedCursor) {
    return null;
  }

  const { cursor: _cursor, ...searchInput } = input;

  return index.search({
    ...searchInput,
    cursor: decodedCursor ?? undefined
  });
};

export const nextSavedItemSearchCursor = (
  offset: number,
  limit: number,
  returnedCount: number
): string | null =>
  returnedCount > limit
    ? encodeSavedItemSearchCursor({
        offset: offset + limit
      })
    : null;
