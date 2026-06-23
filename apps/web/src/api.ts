import type {
  AuthCredentials,
  AuthSessionResponse,
  SavedItem,
  SavedItemPreviewInput,
  SavedItemPreviewResponse,
  SavedItemsPageResponse,
  CreateSavedItemInput,
  CreateFolderInput,
  CreateTagInput,
  ConnectedApp,
  DeleteSavedItemInput,
  CurrentUserResponse,
  DeleteFolderInput,
  DeleteTagInput,
  FolderItem,
  HealthResponse,
  ListSavedItemsInput,
  MoveFolderInput,
  MoveSavedItemsInput,
  MoveTagInput,
  SearchSavedItemsInput,
  TagItem,
  UpdateFolderInput,
  UpdateTagInput
} from "@shelf/shared";
import { createORPCClient, type Client, type NestedClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const apiBaseUrlFromWindow = () => {
  if (typeof window === "undefined" || !["http:", "https:"].includes(window.location.protocol)) {
    return "http://localhost:3000";
  }

  if (window.location.port === "5173") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  return window.location.origin;
};
const runtimeApiBaseUrl =
  apiBaseUrlFromWindow();
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
  savedItems: SavedItemsRpcClient;
  folders: FoldersRpcClient;
  tags: TagsRpcClient;
}

interface SavedItemsRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateSavedItemInput, SavedItem>;
  delete: RpcProcedure<DeleteSavedItemInput, { deletedSavedItemId: string }>;
  list: RpcProcedure<ListSavedItemsInput, SavedItemsPageResponse>;
  move: RpcProcedure<
    MoveSavedItemsInput,
    { destinationFolderId: string | null; movedSavedItemIds: string[] }
  >;
  preview: RpcProcedure<SavedItemPreviewInput, SavedItemPreviewResponse>;
  search: RpcProcedure<SearchSavedItemsInput, SavedItemsPageResponse>;
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
  move: RpcProcedure<MoveTagInput, TagItem[]>;
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

export const getConnectedApps = async (): Promise<ConnectedApp[]> => {
  const response = await fetch(new URL("/auth/connected-apps", apiBaseUrl), {
    credentials: "include"
  });
  const body = await readJsonResponse<{ apps: ConnectedApp[] }>(response);

  return body.apps;
};

export const revokeConnectedApp = async (grantId: string): Promise<void> => {
  const response = await fetch(new URL(`/auth/connected-apps/${grantId}/revoke`, apiBaseUrl), {
    credentials: "include",
    method: "POST"
  });

  await readJsonResponse(response);
};

export const getSavedItems = async ({
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
} = {}): Promise<SavedItemsPageResponse> => {
  return rpc.savedItems.list({
    cursor,
    folderId,
    inbox,
    libraryId,
    limit,
    tagId
  });
};

export const searchSavedItems = async (
  input: SearchSavedItemsInput
): Promise<SavedItemsPageResponse> => rpc.savedItems.search(input);

export const createSavedItem = async (input: CreateSavedItemInput): Promise<SavedItem> =>
  rpc.savedItems.create(input);

export const getSavedItemPreview = async (
  input: SavedItemPreviewInput
): Promise<SavedItemPreviewResponse> => rpc.savedItems.preview(input);

export const deleteSavedItem = async (
  input: DeleteSavedItemInput
): Promise<{ deletedSavedItemId: string }> => rpc.savedItems.delete(input);

export const moveSavedItems = async (
  input: MoveSavedItemsInput
): Promise<{ destinationFolderId: string | null; movedSavedItemIds: string[] }> =>
  rpc.savedItems.move(input);

export const getFolders = async (): Promise<FolderItem[]> => rpc.folders.list();

export const getTags = async (): Promise<TagItem[]> => rpc.tags.list();

export const createFolder = async (input: CreateFolderInput): Promise<FolderItem> =>
  rpc.folders.create(input);

export const createTag = async (input: CreateTagInput): Promise<TagItem> => rpc.tags.create(input);

export const updateTag = async (input: UpdateTagInput): Promise<TagItem> => rpc.tags.update(input);

export const moveTag = async (input: MoveTagInput): Promise<TagItem[]> => rpc.tags.move(input);

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
