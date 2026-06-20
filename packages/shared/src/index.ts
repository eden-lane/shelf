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
  createdAt: string;
  updatedAt: string;
}

export interface BookmarksPageResponse {
  items: BookmarkItem[];
  nextCursor: string | null;
}
