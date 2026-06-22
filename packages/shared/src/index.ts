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
    emailVerifiedAt: string | null;
    name: string | null;
    username: string | null;
    avatarUrl: string | null;
    billingCustomerId: string | null;
    locale: string | null;
  };
  organizations: Array<{
    id: string;
    name: string;
    slug: string;
    role: "owner" | "member";
  }>;
  libraries: Array<{
    id: string;
    kind: "personal" | "organization";
    name: string;
    organizationId?: string;
    organizationSlug?: string;
  }>;
}

export interface RegistrationStatus {
  mode: "first-user-only" | "open" | "closed";
  available: boolean;
}

export interface AuthSessionResponse {
  user: CurrentUserResponse | null;
  registration: RegistrationStatus;
}

export interface AuthCredentials {
  email: string;
  password: string;
  name?: string | null;
  username?: string | null;
  locale?: string | null;
}

export interface SavedItem {
  id: string;
  libraryId: string;
  libraryName?: string | null;
  folderId: string | null;
  folderName: string | null;
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

export interface SavedItemLocation {
  id: string;
  libraryId: string;
  folderId: string | null;
  url: string;
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
  sortOrder: number;
  savedItemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TagItem {
  id: string;
  libraryId: string;
  name: string;
  color: string | null;
  sortOrder: number;
  savedItemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SavedItemsPageResponse {
  items: SavedItem[];
  nextCursor: string | null;
}

export interface CreateSavedItemInput {
  url: string;
  description?: string | null;
  folderId?: string;
  libraryId?: string;
  tagIds?: string[];
}

export interface SavedItemPreviewInput {
  url: string;
}

export interface SavedItemPreviewResponse {
  description: string | null;
}

export interface DeleteSavedItemInput {
  savedItemId: string;
}

export interface MoveSavedItemsInput {
  savedItemIds: string[];
  destinationFolderId?: string | null;
}

export interface ListSavedItemsInput {
  cursor?: string | null;
  folderId?: string | null;
  inbox?: boolean;
  libraryId?: string | null;
  limit?: number;
  tagId?: string | null;
}

export interface SearchSavedItemsInput {
  cursor?: string | null;
  libraryId?: string | null;
  limit?: number;
  query: string;
  scope: "current" | "all";
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

export interface MoveFolderInput {
  folderId: string;
  parentId?: string | null;
  orderedSiblingIds: string[];
}

export interface DeleteFolderInput {
  folderId: string;
  mode: "move" | "delete";
  destinationFolderId?: string | null;
}

export interface CreateTagInput {
  libraryId: string;
  name: string;
  color?: string | null;
}

export interface UpdateTagInput {
  tagId: string;
  name: string;
  color?: string | null;
}

export interface MoveTagInput {
  tagId: string;
  orderedTagIds: string[];
}

export interface DeleteTagInput {
  tagId: string;
}
