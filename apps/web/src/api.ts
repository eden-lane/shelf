import type {
  BookmarkItem,
  BookmarksPageResponse,
  CreateBookmarkInput,
  CurrentUserResponse,
  HealthResponse
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
}

interface BookmarksRpcClient extends Record<string, NestedClient<Record<never, never>>> {
  create: RpcProcedure<CreateBookmarkInput, BookmarkItem>;
  list: RpcProcedure<{ cursor?: string | null; limit?: number }, BookmarksPageResponse>;
}

export const getHealth = async (): Promise<HealthResponse> => rpc.health();

export const getCurrentUser = async (): Promise<CurrentUserResponse> => rpc.currentUser();

export const getBookmarks = async ({
  cursor,
  limit = 20
}: {
  cursor?: string | null;
  limit?: number;
} = {}): Promise<BookmarksPageResponse> => {
  return rpc.bookmarks.list({
    cursor,
    limit
  });
};

export const createBookmark = async (input: CreateBookmarkInput): Promise<BookmarkItem> =>
  rpc.bookmarks.create(input);
