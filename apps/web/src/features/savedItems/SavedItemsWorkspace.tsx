import { useEffect, useRef, useState } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { SavedItemsPageResponse } from "@shelf/shared";
import { IconAlertTriangle, IconLink, IconRefresh } from "@tabler/icons-react";
import { deleteSavedItem, getSavedItems, searchSavedItems } from "../../api";
import { savedItemQueryKey } from "./savedItemUtils";
import type { SavedItemSearchScope } from "./SearchScopeControl";
import { SavedItemRow } from "./SavedItemRow";

export const SavedItemsWorkspace = ({
  folderId,
  folderName,
  libraryId,
  searchQuery,
  searchScope,
  tagId,
  tagName
}: {
  folderId: string | null;
  folderName: string | null;
  libraryId: string | null;
  searchQuery: string;
  searchScope: SavedItemSearchScope;
  tagId: string | null;
  tagName: string | null;
}) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<string | null>(null);
  const trimmedSearchQuery = searchQuery.trim();
  const debouncedSearchQuery = useDebouncedValue(trimmedSearchQuery, 350);
  const isSearching = trimmedSearchQuery.length > 0;
  const hasDebouncedSearchQuery = debouncedSearchQuery.length > 0;
  const isWaitingForSearchDebounce = isSearching && trimmedSearchQuery !== debouncedSearchQuery;
  const currentQueryKey = isSearching
    ? [
        "savedItems",
        "search",
        {
          libraryId: searchScope === "current" ? libraryId : null,
          query: debouncedSearchQuery || "__pending__",
          scope: searchScope
        }
      ]
    : savedItemQueryKey({ folderId, libraryId, tagId });
  const savedItems = useInfiniteQuery({
    enabled:
      (!isSearching || (hasDebouncedSearchQuery && !isWaitingForSearchDebounce)) &&
      (!isSearching || searchScope === "all" || Boolean(libraryId)),
    queryKey: currentQueryKey,
    queryFn: ({ pageParam }) =>
      isSearching
        ? searchSavedItems({
            cursor: pageParam,
            libraryId: searchScope === "current" ? libraryId : undefined,
            limit: 20,
            query: debouncedSearchQuery,
            scope: searchScope
          })
        : getSavedItems({
            cursor: pageParam,
            folderId,
            inbox: folderId === null && tagId === null,
            libraryId,
            limit: 20,
            tagId
          }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = savedItems;
  const items = savedItems.data?.pages.flatMap((page) => page.items) ?? [];
  const hasPendingMetadata = items.some((item) => item.metadataStatus === "pending");
  const deleteSavedItemMutation = useMutation({
    mutationFn: deleteSavedItem,
    onMutate: async ({ savedItemId }) => {
      const queryKey = currentQueryKey;

      await queryClient.cancelQueries({ queryKey });

      const previousSavedItems =
        queryClient.getQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(queryKey);

      queryClient.setQueryData<InfiniteData<SavedItemsPageResponse, string | null>>(
        queryKey,
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== savedItemId)
                }))
              }
            : current
      );

      return { previousSavedItems, queryKey };
    },
    onError: (_error, _input, context) => {
      if (context?.previousSavedItems) {
        queryClient.setQueryData(context.queryKey, context.previousSavedItems);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["savedItems"] });
      void queryClient.invalidateQueries({ queryKey: ["folders"] });
    }
  });

  useEffect(() => {
    const node = loadMoreRef.current;

    if (
      !node ||
      !hasNextPage ||
      isFetchingNextPage ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void fetchNextPage();
        }
      },
      { rootMargin: "360px 0px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  useEffect(() => {
    if (!hasPendingMetadata) {
      return;
    }

    const interval = window.setInterval(() => {
      void refetch();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [hasPendingMetadata, refetch]);

  useEffect(() => {
    if (!notification) {
      return;
    }

    const timeout = window.setTimeout(() => setNotification(null), 2200);

    return () => window.clearTimeout(timeout);
  }, [notification]);

  if (savedItems.isLoading || isWaitingForSearchDebounce) {
    return (
      <section
        className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden rounded-lg border border-[#e4e7ef] bg-white p-5 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-label="Loading items"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="grid min-w-0 gap-2 rounded-lg border border-[#edf0f6] p-4" key={index}>
            <div className="h-4 w-2/5 rounded bg-[#eef1f6]" />
            <div className="h-3 w-4/5 rounded bg-[#f3f5f9]" />
          </div>
        ))}
      </section>
    );
  }

  if (savedItems.isError) {
    return (
      <section
        className="grid w-full min-w-0 max-w-full gap-4 overflow-hidden rounded-lg border border-[#f0b37e] bg-white p-5 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-labelledby="items-error-title"
      >
        <div className="flex items-start gap-3">
          <IconAlertTriangle
            className="mt-0.5 text-[#d97706]"
            size={20}
            stroke={1.5}
            aria-hidden="true"
            focusable="false"
          />
          <div className="min-w-0">
            <h2 id="items-error-title" className="m-0 text-lg font-medium">
              Items could not be loaded
            </h2>
            <p className="mt-1 mb-0 text-sm leading-6 text-[#697080]">
              The API did not return the saved item list.
            </p>
          </div>
        </div>
        <button
          className="flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-medium text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          type="button"
          onClick={() => void savedItems.refetch()}
        >
          <IconRefresh size={16} stroke={1.5} aria-hidden="true" focusable="false" />
          <span>Retry</span>
        </button>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section
        className="grid w-full min-w-0 max-w-full gap-3 overflow-hidden rounded-lg border border-[#e4e7ef] bg-white p-7 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-labelledby="empty-items-title"
      >
        <IconLink
          className="text-[#3b8df5]"
          size={24}
          stroke={1.5}
          aria-hidden="true"
          focusable="false"
        />
        <div className="min-w-0">
          <h2 id="empty-items-title" className="mb-2 text-2xl leading-[1.2] font-medium">
            No items yet
          </h2>
          <p className="mb-0 max-w-full text-[#697080] sm:max-w-[56ch]">
            {isSearching
              ? "No saved links match this search."
              : tagName
              ? "Saved items with this tag will appear here."
              : folderName
                ? "Saved items added to this folder will appear here."
                : "Saved items without a folder will appear here as soon as they are saved."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className="grid w-full min-w-0 max-w-full shrink-0 gap-3 overflow-hidden"
        aria-label={
          tagName ? `${tagName} tagged items` : folderName ? `${folderName} items` : "Inbox items"
        }
        aria-busy={savedItems.isFetchingNextPage}
      >
        {items.map((item) => (
          <SavedItemRow
            item={item}
            key={item.id}
            showFolderName={isSearching}
            onDeleteSavedItem={(savedItemId) => deleteSavedItemMutation.mutate({ savedItemId })}
            onLinkCopied={() => setNotification("Link copied")}
          />
        ))}
        <div ref={loadMoreRef} className="min-h-6" aria-hidden="true" />
        {savedItems.isFetchingNextPage ? (
          <p className="m-0 rounded-lg border border-[#e4e7ef] bg-white px-4 py-3 text-sm font-medium text-[#697080]">
            Loading more items
          </p>
        ) : null}
        {!savedItems.hasNextPage ? (
          <p className="m-0 px-1 py-2 text-sm font-medium text-[#858b9a]">All items loaded</p>
        ) : null}
      </section>
      {notification ? (
        <div
          className="fixed right-4 bottom-4 z-40 rounded-lg border border-[#dfe4ef] bg-white px-3 py-2 text-sm font-medium text-[#242833] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
          role="status"
          aria-live="polite"
        >
          {notification}
        </div>
      ) : null}
    </>
  );
};

const useDebouncedValue = <Value,>(value: Value, delayMs: number) => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delayMs);

    return () => window.clearTimeout(timeout);
  }, [delayMs, value]);

  return debouncedValue;
};
