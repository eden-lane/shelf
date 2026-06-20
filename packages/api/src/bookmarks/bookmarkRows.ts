import type { BookmarkItem } from "@bookmarks/shared";
import { schema } from "../db";

export const bookmarkSelectFields = {
  id: schema.savedItems.id,
  libraryId: schema.savedItems.libraryId,
  folderId: schema.savedItems.folderId,
  folderName: schema.folders.name,
  url: schema.savedItems.url,
  title: schema.savedItems.title,
  description: schema.savedItems.description,
  siteName: schema.savedItems.siteName,
  imageUrl: schema.savedItems.imageUrl,
  metadataStatus: schema.savedItems.metadataStatus,
  metadataFetchedAt: schema.savedItems.metadataFetchedAt,
  faviconId: schema.savedItems.faviconId,
  createdAt: schema.savedItems.createdAt,
  updatedAt: schema.savedItems.updatedAt
};

export interface BookmarkRow {
  id: string;
  libraryId: string;
  folderId: string | null;
  folderName: string | null;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  metadataStatus: BookmarkItem["metadataStatus"];
  metadataFetchedAt: Date | null;
  faviconId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const serializeBookmark = (row: BookmarkRow): BookmarkItem => ({
  id: row.id,
  libraryId: row.libraryId,
  folderId: row.folderId,
  folderName: row.folderName,
  url: row.url,
  title: row.title,
  description: row.description,
  siteName: row.siteName,
  imageUrl: row.imageUrl,
  metadataStatus: row.metadataStatus,
  metadataFetchedAt: row.metadataFetchedAt?.toISOString() ?? null,
  faviconId: row.faviconId,
  faviconUrl: row.faviconId ? `/favicons/${row.faviconId}` : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString()
});
