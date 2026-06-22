import type { SavedItemsPageResponse } from "@shelf/shared";
import {
  decodeSavedItemSearchCursor,
  encodeSavedItemSearchCursor
} from "./searchCursor";
import type { SavedItemSearchDocument, SearchSavedItemsInput } from "./types";

export interface SavedItemSearchIndex {
  delete(savedItemIds: string[]): Promise<void>;
  search(input: SearchSavedItemsInput): Promise<SavedItemsPageResponse>;
  upsert(documents: SavedItemSearchDocument[]): Promise<void>;
}

export const searchSavedItemsPage = async (
  index: SavedItemSearchIndex,
  input: Omit<SearchSavedItemsInput, "cursor"> & { cursor?: string | null }
): Promise<SavedItemsPageResponse | null> => {
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
