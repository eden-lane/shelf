import type { BookmarkItem, BookmarkLocationItem, FolderItem, TagItem } from "@bookmarks/shared";
import type { Buffer } from "node:buffer";

export interface BookmarkCursor {
  createdAt: string;
  id: string;
}

export interface ListBookmarksInput {
  libraryIds: string[];
  limit: number;
  folderId?: string;
  inbox?: boolean;
  cursor?: BookmarkCursor;
}

export interface ListBookmarkLocationsInput {
  libraryIds: string[];
  url: string;
}

export interface CreateBookmarkInput {
  libraryId: string;
  folderId: string | null;
  createdByUserId: string;
  url: string;
  tagIds?: string[];
}

export interface DeleteBookmarkInput {
  allowedLibraryIds: string[];
  bookmarkId: string;
}

export interface MoveBookmarksInput {
  allowedLibraryIds: string[];
  bookmarkIds: string[];
  destinationFolderId?: string | null;
}

export interface ListFoldersInput {
  libraryIds: string[];
}

export interface ListTagsInput {
  libraryIds: string[];
}

export interface CreateFolderInput {
  libraryId: string;
  allowedLibraryIds: string[];
  parentId?: string | null;
  name: string;
  iconName?: string | null;
  iconColor?: string | null;
}

export interface UpdateFolderInput {
  allowedLibraryIds: string[];
  folderId: string;
  name: string;
  iconName?: string | null;
  iconColor?: string | null;
}

export interface MoveFolderInput {
  allowedLibraryIds: string[];
  folderId: string;
  parentId?: string | null;
  orderedSiblingIds: string[];
}

export interface DeleteFolderInput {
  allowedLibraryIds: string[];
  folderId: string;
  mode: "move" | "delete";
  destinationFolderId?: string | null;
}

export interface BookmarksStore {
  listBookmarks(input: ListBookmarksInput): Promise<BookmarkItem[]>;
  listBookmarkLocations(input: ListBookmarkLocationsInput): Promise<BookmarkLocationItem[]>;
  createBookmark(input: CreateBookmarkInput): Promise<BookmarkItem>;
  deleteBookmark(input: DeleteBookmarkInput): Promise<{ deletedBookmarkId: string }>;
  moveBookmarks(input: MoveBookmarksInput): Promise<{
    destinationFolderId: string | null;
    movedBookmarkIds: string[];
  }>;
  getFavicon(id: string): Promise<{ contentType: string; imageBytes: Buffer } | null>;
  listFolders(input: ListFoldersInput): Promise<FolderItem[]>;
  listTags(input: ListTagsInput): Promise<TagItem[]>;
  createFolder(input: CreateFolderInput): Promise<FolderItem>;
  updateFolder(input: UpdateFolderInput): Promise<FolderItem>;
  moveFolder(input: MoveFolderInput): Promise<FolderItem[]>;
  deleteFolder(input: DeleteFolderInput): Promise<{ deletedFolderIds: string[] }>;
}
