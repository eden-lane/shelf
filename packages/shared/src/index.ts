export type CoreServiceStatus = "ok" | "error";

export interface HealthResponse {
  status: "ok" | "degraded";
  services: {
    database: CoreServiceStatus;
    queue: CoreServiceStatus;
    search: CoreServiceStatus;
  };
  checkedAt: string;
}

export interface CurrentUserResponse {
  user: {
    id: string;
    email: string;
    name: string;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    role: "owner";
  };
  libraries: Array<{
    id: string;
    kind: "personal" | "organization";
    name: string;
    inboxFolderId: string;
    organizationId?: string;
    organizationSlug?: string;
  }>;
}

export interface BookmarkItem {
  id: string;
  libraryId: string;
  folderId: string;
  folderName: string;
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  imageUrl: string | null;
  metadataStatus: "pending" | "fetched" | "failed";
  metadataFetchedAt: string | null;
  faviconId: string | null;
  faviconUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FolderItem {
  id: string;
  libraryId: string;
  parentId: string | null;
  name: string;
  iconName: string | null;
  iconColor: string | null;
  bookmarkCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface BookmarksPageResponse {
  items: BookmarkItem[];
  nextCursor: string | null;
}

export interface CreateBookmarkInput {
  url: string;
  folderId?: string;
}

export interface DeleteBookmarkInput {
  bookmarkId: string;
}

export interface ListBookmarksInput {
  cursor?: string | null;
  folderId?: string | null;
  limit?: number;
}

export interface CreateFolderInput {
  libraryId: string;
  parentId?: string | null;
  name: string;
  iconName?: string | null;
  iconColor?: string | null;
}

export interface UpdateFolderInput {
  folderId: string;
  name: string;
  iconName?: string | null;
  iconColor?: string | null;
}

export interface DeleteFolderInput {
  folderId: string;
  mode: "move" | "delete";
  destinationFolderId?: string | null;
}
