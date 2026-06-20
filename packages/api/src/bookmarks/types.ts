import type { BookmarkItem, FolderItem, TagItem } from "@bookmarks/shared";
import type { Buffer } from "node:buffer";

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
  tagIds?: string[];
}

export interface DeleteBookmarkInput {
  allowedLibraryIds: string[];
  bookmarkId: string;
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

export interface DeleteFolderInput {
  allowedLibraryIds: string[];
  folderId: string;
  mode: "move" | "delete";
  destinationFolderId?: string | null;
}

export interface BookmarksStore {
  listBookmarks(input: ListBookmarksInput): Promise<BookmarkItem[]>;
  createBookmark(input: CreateBookmarkInput): Promise<BookmarkItem>;
  deleteBookmark(input: DeleteBookmarkInput): Promise<{ deletedBookmarkId: string }>;
  getFavicon(id: string): Promise<{ contentType: string; imageBytes: Buffer } | null>;
  listFolders(input: ListFoldersInput): Promise<FolderItem[]>;
  listTags(input: ListTagsInput): Promise<TagItem[]>;
  createFolder(input: CreateFolderInput): Promise<FolderItem>;
  updateFolder(input: UpdateFolderInput): Promise<FolderItem>;
  deleteFolder(input: DeleteFolderInput): Promise<{ deletedFolderIds: string[] }>;
}
