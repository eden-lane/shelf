import { useEffect, useRef, useState } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { BookmarksPageResponse } from "@bookmarks/shared";
import { IconAlertTriangle, IconBookmark, IconRefresh } from "@tabler/icons-react";
import { deleteBookmark, getBookmarks } from "../../api";
import { BookmarkRow } from "./BookmarkRow";

export const BookmarksWorkspace = ({
  folderId,
  folderName
}: {
  folderId: string | null;
  folderName: string | null;
}) => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const queryClient = useQueryClient();
  const [notification, setNotification] = useState<string | null>(null);
  const bookmarks = useInfiniteQuery({
    queryKey: ["bookmarks", folderId],
    queryFn: ({ pageParam }) => getBookmarks({ cursor: pageParam, folderId, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = bookmarks;
  const items = bookmarks.data?.pages.flatMap((page) => page.items) ?? [];
  const hasPendingMetadata = items.some((item) => item.metadataStatus === "pending");
  const deleteBookmarkMutation = useMutation({
    mutationFn: deleteBookmark,
    onMutate: async ({ bookmarkId }) => {
      const queryKey = ["bookmarks", folderId];

      await queryClient.cancelQueries({ queryKey });

      const previousBookmarks =
        queryClient.getQueryData<InfiniteData<BookmarksPageResponse, string | null>>(queryKey);

      queryClient.setQueryData<InfiniteData<BookmarksPageResponse, string | null>>(
        queryKey,
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.filter((item) => item.id !== bookmarkId)
                }))
              }
            : current
      );

      return { previousBookmarks, queryKey };
    },
    onError: (_error, _input, context) => {
      if (context?.previousBookmarks) {
        queryClient.setQueryData(context.queryKey, context.previousBookmarks);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
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

  if (bookmarks.isLoading) {
    return (
      <section
        className="grid gap-3 rounded-lg border border-[#e4e7ef] bg-white p-5 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-label="Loading items"
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="grid gap-2 rounded-lg border border-[#edf0f6] p-4" key={index}>
            <div className="h-4 w-2/5 rounded bg-[#eef1f6]" />
            <div className="h-3 w-4/5 rounded bg-[#f3f5f9]" />
          </div>
        ))}
      </section>
    );
  }

  if (bookmarks.isError) {
    return (
      <section
        className="grid gap-4 rounded-lg border border-[#f0b37e] bg-white p-5 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
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
          <div>
            <h2 id="items-error-title" className="m-0 text-lg font-extrabold">
              Items could not be loaded
            </h2>
            <p className="mt-1 mb-0 text-sm leading-6 text-[#697080]">
              The API did not return the bookmark list.
            </p>
          </div>
        </div>
        <button
          className="flex min-h-10 w-fit items-center gap-2 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          type="button"
          onClick={() => void bookmarks.refetch()}
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
        className="grid gap-3 rounded-lg border border-[#e4e7ef] bg-white p-7 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)]"
        aria-labelledby="empty-items-title"
      >
        <IconBookmark
          className="text-[#3b8df5]"
          size={24}
          stroke={1.5}
          aria-hidden="true"
          focusable="false"
        />
        <div>
          <h2 id="empty-items-title" className="mb-2 text-2xl leading-[1.2] font-bold">
            No items yet
          </h2>
          <p className="mb-0 max-w-[56ch] text-[#697080]">
            {folderName
              ? "Bookmarks added to this folder will appear here."
              : "Added bookmarks will appear here as soon as they are saved."}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className="grid gap-3"
        aria-label={folderName ? `${folderName} items` : "Saved items"}
        aria-busy={bookmarks.isFetchingNextPage}
      >
        {items.map((item) => (
          <BookmarkRow
            item={item}
            key={item.id}
            showFolderName={folderId === null}
            onDeleteBookmark={(bookmarkId) => deleteBookmarkMutation.mutate({ bookmarkId })}
            onLinkCopied={() => setNotification("Link copied")}
          />
        ))}
        <div ref={loadMoreRef} className="min-h-6" aria-hidden="true" />
        {bookmarks.isFetchingNextPage ? (
          <p className="m-0 rounded-lg border border-[#e4e7ef] bg-white px-4 py-3 text-sm font-bold text-[#697080]">
            Loading more items
          </p>
        ) : null}
        {!bookmarks.hasNextPage ? (
          <p className="m-0 px-1 py-2 text-sm font-bold text-[#858b9a]">All items loaded</p>
        ) : null}
      </section>
      {notification ? (
        <div
          className="fixed right-4 bottom-4 z-40 rounded-lg border border-[#dfe4ef] bg-white px-3 py-2 text-sm font-extrabold text-[#242833] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
          role="status"
          aria-live="polite"
        >
          {notification}
        </div>
      ) : null}
    </>
  );
};
