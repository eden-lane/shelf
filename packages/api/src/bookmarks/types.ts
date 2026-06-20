import type { BookmarkItem } from "@bookmarks/shared";

export interface BookmarkCursor {
  createdAt: string;
  id: string;
}

export interface ListBookmarksInput {
  libraryIds: string[];
  limit: number;
  cursor?: BookmarkCursor;
}

export interface CreateBookmarkInput {
  libraryId: string;
  folderId: string;
  createdByUserId: string;
  url: string;
}

export interface BookmarksStore {
  listBookmarks(input: ListBookmarksInput): Promise<BookmarkItem[]>;
  createBookmark(input: CreateBookmarkInput): Promise<BookmarkItem>;
}
