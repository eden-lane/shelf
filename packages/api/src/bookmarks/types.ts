import type { BookmarkItem, FolderItem } from "@bookmarks/shared";

export interface BookmarkCursor {
  createdAt: string;
  id: string;
}

export interface ListBookmarksInput {
  libraryIds: string[];
  limit: number;
  folderId?: string;
  cursor?: BookmarkCursor;
}

export interface CreateBookmarkInput {
  libraryId: string;
  folderId: string;
  createdByUserId: string;
  url: string;
}

export interface ListFoldersInput {
  libraryIds: string[];
}

export interface CreateFolderInput {
  libraryId: string;
  allowedLibraryIds: string[];
  parentId?: string | null;
  name: string;
}

export interface UpdateFolderInput {
  allowedLibraryIds: string[];
  folderId: string;
  name: string;
}

export interface DeleteFolderInput {
  allowedLibraryIds: string[];
  folderId: string;
  mode: "move" | "delete";
  destinationFolderId?: string | null;
}

export interface BookmarksStore {
  listBookmarks(input: ListBookmarksInput): Promise<BookmarkItem[]>;
  createBookmark(input: CreateBookmarkInput): Promise<BookmarkItem>;
  listFolders(input: ListFoldersInput): Promise<FolderItem[]>;
  createFolder(input: CreateFolderInput): Promise<FolderItem>;
  updateFolder(input: UpdateFolderInput): Promise<FolderItem>;
  deleteFolder(input: DeleteFolderInput): Promise<{ deletedFolderIds: string[] }>;
}
