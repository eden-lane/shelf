import type {
  AuthCredentials,
  AuthSessionResponse,
  BookmarkItem,
  BookmarksPageResponse,
  CreateBookmarkInput,
  CreateFolderInput,
  CreateTagInput,
  DeleteBookmarkInput,
  CurrentUserResponse,
  DeleteFolderInput,
  DeleteTagInput,
  FolderItem,
  HealthResponse,
  ListBookmarksInput,
  MoveFolderInput,
  MoveBookmarksInput,
  TagItem,
  UpdateFolderInput,
  UpdateTagInput
} from "@bookmarks/shared";
import { createORPCClient, type Client, type NestedClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const runtimeApiBaseUrl =
  typeof window === "undefined" || !["http:", "https:"].includes(window.location.protocol)
    ? "http://localhost:3000"
    : `${window.location.protocol}//${window.location.hostname}:3000`;
const apiBaseUrl = configuredApiBaseUrl || runtimeApiBaseUrl;
const rpcLink = new RPCLink({
  fetch: (request, init) => fetch(request, { ...init, credentials: "include" }),
  url: new URL("/rpc", apiBaseUrl).toString()
});
const rpc = createORPCClient<WebRpcClient>(rpcLink);

type RpcProcedure<TInput, TOutput> = Client<Record<never, never>, TInput, TOutput, unknown>;

interface WebRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  health: RpcProcedure<undefined, HealthResponse>;
  currentUser: RpcProcedure<undefined, CurrentUserResponse>;
  bookmarks: BookmarksRpcClient;
  folders: FoldersRpcClient;
  tags: TagsRpcClient;
}

interface BookmarksRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateBookmarkInput, BookmarkItem>;
  delete: RpcProcedure<DeleteBookmarkInput, { deletedBookmarkId: string }>;
  list: RpcProcedure<ListBookmarksInput, BookmarksPageResponse>;
  move: RpcProcedure<
    MoveBookmarksInput,
    { destinationFolderId: string | null; movedBookmarkIds: string[] }
  >;
}

interface FoldersRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateFolderInput, FolderItem>;
  delete: RpcProcedure<DeleteFolderInput, { deletedFolderIds: string[] }>;
  list: RpcProcedure<undefined, FolderItem[]>;
  move: RpcProcedure<MoveFolderInput, FolderItem[]>;
  update: RpcProcedure<UpdateFolderInput, FolderItem>;
}

interface TagsRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateTagInput, TagItem>;
  delete: RpcProcedure<DeleteTagInput, { deletedTagId: string }>;
  list: RpcProcedure<undefined, TagItem[]>;
  update: RpcProcedure<UpdateTagInput, TagItem>;
}

export const getHealth = async (): Promise<HealthResponse> => rpc.health();

export const getCurrentUser = async (): Promise<CurrentUserResponse> => rpc.currentUser();

export const getAuthSession = async (): Promise<AuthSessionResponse> => {
  const response = await fetch(new URL("/auth/session", apiBaseUrl), {
    credentials: "include"
  });

  return readJsonResponse<AuthSessionResponse>(response);
};

export const signup = async (input: AuthCredentials): Promise<{ user: CurrentUserResponse }> => {
  const response = await fetch(new URL("/auth/signup", apiBaseUrl), {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  return readJsonResponse<{ user: CurrentUserResponse }>(response);
};

export const login = async (
  input: Pick<AuthCredentials, "email" | "password">
): Promise<{ user: CurrentUserResponse }> => {
  const response = await fetch(new URL("/auth/login", apiBaseUrl), {
    body: JSON.stringify(input),
    credentials: "include",
    headers: {
      "content-type": "application/json"
    },
    method: "POST"
  });

  return readJsonResponse<{ user: CurrentUserResponse }>(response);
};

export const logout = async (): Promise<void> => {
  const response = await fetch(new URL("/auth/logout", apiBaseUrl), {
    credentials: "include",
    method: "POST"
  });

  await readJsonResponse(response);
};

export const getBookmarks = async ({
  cursor,
  folderId,
  inbox,
  libraryId,
  limit = 20,
  tagId
}: {
  cursor?: string | null;
  folderId?: string | null;
  inbox?: boolean;
  libraryId?: string | null;
  limit?: number;
  tagId?: string | null;
} = {}): Promise<BookmarksPageResponse> => {
  return rpc.bookmarks.list({
    cursor,
    folderId,
    inbox,
    libraryId,
    limit,
    tagId
  });
};

export const createBookmark = async (input: CreateBookmarkInput): Promise<BookmarkItem> =>
  rpc.bookmarks.create(input);

export const deleteBookmark = async (
  input: DeleteBookmarkInput
): Promise<{ deletedBookmarkId: string }> => rpc.bookmarks.delete(input);

export const moveBookmarks = async (
  input: MoveBookmarksInput
): Promise<{ destinationFolderId: string | null; movedBookmarkIds: string[] }> =>
  rpc.bookmarks.move(input);

export const getFolders = async (): Promise<FolderItem[]> => rpc.folders.list();

export const getTags = async (): Promise<TagItem[]> => rpc.tags.list();

export const createFolder = async (input: CreateFolderInput): Promise<FolderItem> =>
  rpc.folders.create(input);

export const createTag = async (input: CreateTagInput): Promise<TagItem> => rpc.tags.create(input);

export const updateTag = async (input: UpdateTagInput): Promise<TagItem> => rpc.tags.update(input);

export const deleteTag = async (
  input: DeleteTagInput
): Promise<{ deletedTagId: string }> => rpc.tags.delete(input);

export const moveFolder = async (input: MoveFolderInput): Promise<FolderItem[]> =>
  rpc.folders.move(input);

export const updateFolder = async (input: UpdateFolderInput): Promise<FolderItem> =>
  rpc.folders.update(input);

export const deleteFolder = async (
  input: DeleteFolderInput
): Promise<{ deletedFolderIds: string[] }> => rpc.folders.delete(input);

export const apiAssetUrl = (path: string): string => new URL(path, apiBaseUrl).toString();

const readJsonResponse = async <T = unknown>(response: Response): Promise<T> => {
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `Request failed with ${response.status}`;

    throw new Error(message);
  }

  return body as T;
};
