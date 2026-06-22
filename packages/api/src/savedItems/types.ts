import type { SavedItem, SavedItemLocation, FolderItem, TagItem } from "@shelf/shared";
import type { Buffer } from "node:buffer";

export interface SavedItemCursor {
  createdAt: string;
  id: string;
}

export interface ListSavedItemsInput {
  libraryIds: string[];
  limit: number;
  folderId?: string;
  inbox?: boolean;
  libraryId?: string;
  tagId?: string;
  cursor?: SavedItemCursor;
}

export interface SavedItemSearchCursor {
  offset: number;
}

export interface SavedItemSearchDocument extends SavedItem {
  libraryName: string;
  tagNames: string[];
}

export interface SearchSavedItemsInput {
  cursor?: SavedItemSearchCursor;
  libraryIds: string[];
  limit: number;
  query: string;
}

export interface ListSavedItemLocationsInput {
  libraryIds: string[];
  url: string;
}

export interface CreateSavedItemInput {
  libraryId: string;
  folderId: string | null;
  createdByUserId: string;
  url: string;
  tagIds?: string[];
}

export interface DeleteSavedItemInput {
  allowedLibraryIds: string[];
  savedItemId: string;
}

export interface ListSavedItemSearchDocumentsInput {
  libraryIds?: string[];
  savedItemIds?: string[];
}

export interface MoveSavedItemsInput {
  allowedLibraryIds: string[];
  savedItemIds: string[];
  destinationFolderId?: string | null;
}

export interface ListFoldersInput {
  libraryIds: string[];
}

export interface ListTagsInput {
  libraryIds: string[];
}

export interface CreateTagInput {
  libraryId: string;
  allowedLibraryIds: string[];
  name: string;
  color?: string | null;
}

export interface UpdateTagInput {
  allowedLibraryIds: string[];
  tagId: string;
  name: string;
  color?: string | null;
}

export interface DeleteTagInput {
  allowedLibraryIds: string[];
  tagId: string;
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

export interface SavedItemsStore {
  listSavedItems(input: ListSavedItemsInput): Promise<SavedItem[]>;
  listSavedItemLocations(input: ListSavedItemLocationsInput): Promise<SavedItemLocation[]>;
  listSavedItemSearchDocuments(
    input: ListSavedItemSearchDocumentsInput
  ): Promise<SavedItemSearchDocument[]>;
  createSavedItem(input: CreateSavedItemInput): Promise<SavedItem>;
  deleteSavedItem(input: DeleteSavedItemInput): Promise<{ deletedSavedItemId: string }>;
  moveSavedItems(input: MoveSavedItemsInput): Promise<{
    destinationFolderId: string | null;
    movedSavedItemIds: string[];
  }>;
  getFavicon(id: string): Promise<{ contentType: string; imageBytes: Buffer } | null>;
  listFolders(input: ListFoldersInput): Promise<FolderItem[]>;
  listTags(input: ListTagsInput): Promise<TagItem[]>;
  createTag(input: CreateTagInput): Promise<TagItem>;
  updateTag(input: UpdateTagInput): Promise<TagItem>;
  deleteTag(input: DeleteTagInput): Promise<{ deletedTagId: string }>;
  createFolder(input: CreateFolderInput): Promise<FolderItem>;
  updateFolder(input: UpdateFolderInput): Promise<FolderItem>;
  moveFolder(input: MoveFolderInput): Promise<FolderItem[]>;
  deleteFolder(input: DeleteFolderInput): Promise<{ deletedFolderIds: string[] }>;
}
