import type {
  BookmarkItem,
  BookmarksPageResponse,
  CreateBookmarkInput,
  CreateFolderInput,
  CurrentUserResponse,
  DeleteFolderInput,
  FolderItem,
  HealthResponse,
  ListBookmarksInput,
  UpdateFolderInput
} from "@bookmarks/shared";
import { createORPCClient, type Client, type NestedClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";
const rpcLink = new RPCLink({
  url: new URL("/rpc", apiBaseUrl).toString()
});
const rpc = createORPCClient<WebRpcClient>(rpcLink);

type RpcProcedure<TInput, TOutput> = Client<Record<never, never>, TInput, TOutput, unknown>;

interface WebRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  health: RpcProcedure<undefined, HealthResponse>;
  currentUser: RpcProcedure<undefined, CurrentUserResponse>;
  bookmarks: BookmarksRpcClient;
  folders: FoldersRpcClient;
}

interface BookmarksRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateBookmarkInput, BookmarkItem>;
  list: RpcProcedure<ListBookmarksInput, BookmarksPageResponse>;
}

interface FoldersRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateFolderInput, FolderItem>;
  delete: RpcProcedure<DeleteFolderInput, { deletedFolderIds: string[] }>;
  list: RpcProcedure<undefined, FolderItem[]>;
  update: RpcProcedure<UpdateFolderInput, FolderItem>;
}

export const getHealth = async (): Promise<HealthResponse> => rpc.health();

export const getCurrentUser = async (): Promise<CurrentUserResponse> => rpc.currentUser();

export const getBookmarks = async ({
  cursor,
  folderId,
  limit = 20
}: {
  cursor?: string | null;
  folderId?: string | null;
  limit?: number;
} = {}): Promise<BookmarksPageResponse> => {
  return rpc.bookmarks.list({
    cursor,
    folderId,
    limit
  });
};

export const createBookmark = async (input: CreateBookmarkInput): Promise<BookmarkItem> =>
  rpc.bookmarks.create(input);

export const getFolders = async (): Promise<FolderItem[]> => rpc.folders.list();

export const createFolder = async (input: CreateFolderInput): Promise<FolderItem> =>
  rpc.folders.create(input);

export const updateFolder = async (input: UpdateFolderInput): Promise<FolderItem> =>
  rpc.folders.update(input);

export const deleteFolder = async (
  input: DeleteFolderInput
): Promise<{ deletedFolderIds: string[] }> => rpc.folders.delete(input);
