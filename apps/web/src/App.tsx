import { useEffect, useRef, useState } from "react";
import {
  QueryClient,
  QueryClientProvider,
  useInfiniteQuery,
  useQuery
} from "@tanstack/react-query";
import type { BookmarkItem, CurrentUserResponse, HealthResponse } from "@bookmarks/shared";
import { Dialog } from "@base-ui/react/dialog";
import {
  IconAlertTriangle,
  IconBookmark,
  IconCircleCheck,
  IconExternalLink,
  IconFolder,
  IconPlus,
  IconRefresh,
  IconX
} from "@tabler/icons-react";
import { getBookmarks, getCurrentUser, getHealth } from "./api";

const navItems = [
  { label: "Items", icon: IconBookmark }
];

const queryClient = new QueryClient();

export const App = () => (
  <QueryClientProvider client={queryClient}>
    <ProductShell />
  </QueryClientProvider>
);

const ProductShell = () => {
  const health = useQuery({
    queryKey: ["health"],
    queryFn: getHealth,
    refetchInterval: 15_000
  });
  const currentUser = useQuery({
    queryKey: ["current-user"],
    queryFn: getCurrentUser
  });
  const username = displayUsername(currentUser.data);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-[#f7f8fc] font-sans text-[#242833] md:grid-cols-[260px_minmax(0,1fr)]">
      <aside
        className="flex flex-col gap-[18px] border-b border-[#e6e8ef] bg-[#f7f8fc] px-[18px] py-6 text-[#242833] md:gap-8 md:border-r md:border-b-0"
        aria-label="Primary"
      >
        <div className="flex items-center gap-3 text-lg font-bold">
          <span
            className="grid h-[34px] w-[34px] place-items-center rounded-lg bg-[#e4efff] font-extrabold text-[#3b8df5]"
            aria-hidden="true"
          >
            <IconBookmark size={18} stroke={2.4} aria-hidden="true" focusable="false" />
          </span>
          <span>{username}</span>
        </div>
        <AddBookmarkDialog />
        <nav className="grid grid-cols-2 gap-1 md:grid-cols-1">
          {navItems.map(({ label, icon: Icon }, index) => (
            <a
              className={[
                "flex items-center gap-2 rounded-lg border px-3 py-[11px] text-sm font-semibold no-underline outline-none hover:border-[#dfe4ef] hover:bg-white hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
                index === 0
                  ? "border-[#d8e7ff] bg-[#eef5ff] text-[#2f80ed]"
                  : "border-transparent text-[#697080]"
              ].join(" ")}
              href={`#${label.toLowerCase().replaceAll(" ", "-")}`}
              key={label}
            >
              <Icon size={17} stroke={2} aria-hidden="true" focusable="false" />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <section className="flex min-w-0 flex-col gap-7 p-5 md:p-7" aria-label="Items workspace">
        <header className="flex flex-col items-start justify-between gap-5 md:flex-row">
          <div>
            <p className="mb-1 text-[13px] font-bold text-[#858b9a]">{username}</p>
            <h1 className="m-0 text-[34px] leading-[1.1] font-bold">Items</h1>
          </div>
          <HealthSummary health={health.data} isLoading={health.isLoading} isError={health.isError} />
        </header>

        <BookmarksWorkspace />
      </section>
    </main>
  );
};

const displayUsername = (currentUser?: CurrentUserResponse) =>
  currentUser?.user.name || currentUser?.user.email || "User";

const BookmarksWorkspace = () => {
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const bookmarks = useInfiniteQuery({
    queryKey: ["bookmarks"],
    queryFn: ({ pageParam }) => getBookmarks({ cursor: pageParam, limit: 20 }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor
  });
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = bookmarks;
  const items = bookmarks.data?.pages.flatMap((page) => page.items) ?? [];

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
            stroke={2.2}
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
          <IconRefresh size={17} stroke={2.2} aria-hidden="true" focusable="false" />
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
          stroke={2.2}
          aria-hidden="true"
          focusable="false"
        />
        <div>
          <h2 id="empty-items-title" className="mb-2 text-2xl leading-[1.2] font-bold">
            No items yet
          </h2>
          <p className="mb-0 max-w-[56ch] text-[#697080]">
            Added bookmarks will appear here as soon as they are saved.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section
      className="grid gap-3"
      aria-label="Saved items"
      aria-busy={bookmarks.isFetchingNextPage}
    >
      {items.map((item) => (
        <BookmarkRow item={item} key={item.id} />
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
  );
};

const BookmarkRow = ({ item }: { item: BookmarkItem }) => {
  const host = hostFromUrl(item.url);

  return (
    <article className="grid gap-3 rounded-lg border border-[#e4e7ef] bg-white p-4 shadow-[0_14px_40px_rgb(46_54_77_/_0.045)]">
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-lg leading-[1.25] font-extrabold">
            {item.title || host || item.url}
          </h2>
          <a
            className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#2f80ed] no-underline hover:underline"
            href={item.url}
            rel="noreferrer"
            target="_blank"
          >
            <IconExternalLink size={15} stroke={2.2} aria-hidden="true" focusable="false" />
            <span className="truncate">{item.url}</span>
          </a>
        </div>
        <span className="flex w-fit items-center gap-1.5 rounded-lg border border-[#e7eaf1] bg-[#fbfcff] px-2.5 py-1 text-xs font-extrabold text-[#697080]">
          <IconFolder size={14} stroke={2.1} aria-hidden="true" focusable="false" />
          {item.folderName}
        </span>
      </div>
      {item.description ? (
        <p className="m-0 max-w-[74ch] text-sm leading-6 text-[#697080]">{item.description}</p>
      ) : null}
      <time className="text-xs font-bold text-[#858b9a]" dateTime={item.createdAt}>
        Added {formatBookmarkDate(item.createdAt)}
      </time>
    </article>
  );
};

const hostFromUrl = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

const formatBookmarkDate = (date: string) =>
  new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(date));

const AddBookmarkDialog = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => setIsOpen(open)}>
      <Dialog.Trigger
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-3 py-[11px] text-sm font-extrabold text-white shadow-[0_12px_28px_rgb(59_141_245_/_0.22)] outline-none hover:bg-[#2f80ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
        type="button"
      >
        <IconPlus size={18} stroke={2.4} aria-hidden="true" focusable="false" />
        <span>Add bookmark</span>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-[#101522]/45" />
        <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 grid w-[min(calc(100vw-32px),420px)] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-lg border border-[#e4e7ef] bg-white p-5 text-[#242833] shadow-[0_24px_80px_rgb(22_28_43_/_0.22)] outline-none">
          <div className="grid gap-1 pr-9">
            <Dialog.Title className="text-lg leading-[1.25] font-extrabold">
              Add bookmark
            </Dialog.Title>
            <Dialog.Description className="text-sm leading-6 text-[#697080]">
              Paste the page link you want to save.
            </Dialog.Description>
          </div>
          <Dialog.Close
            className="absolute top-4 right-4 grid h-8 w-8 place-items-center rounded-lg border border-transparent text-[#697080] outline-none hover:border-[#e4e7ef] hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
            aria-label="Close add bookmark dialog"
            type="button"
          >
            <IconX size={17} stroke={2.2} aria-hidden="true" focusable="false" />
          </Dialog.Close>
          <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
            <label className="grid gap-2 text-sm font-bold" htmlFor="bookmark-url">
              Page URL
              <input
                className="min-h-11 rounded-lg border border-[#dfe4ef] bg-white px-3 text-base font-medium text-[#242833] outline-none placeholder:text-[#9aa1ad] focus:border-[#3b8df5] focus:ring-3 focus:ring-[#d9eaff]"
                id="bookmark-url"
                name="url"
                placeholder="https://example.com/article"
                type="url"
              />
            </label>
            <div className="flex justify-end gap-2">
              <Dialog.Close
                className="min-h-10 rounded-lg border border-[#dfe4ef] bg-white px-3 text-sm font-extrabold text-[#4b5262] outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                type="button"
              >
                Cancel
              </Dialog.Close>
              <button
                className="min-h-10 rounded-lg border border-[#3b8df5] bg-[#3b8df5] px-3 text-sm font-extrabold text-white outline-none hover:bg-[#2f80ed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                type="submit"
              >
                Save
              </button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const HealthSummary = ({
  health,
  isLoading,
  isError
}: {
  health?: HealthResponse;
  isLoading: boolean;
  isError: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-[#e4e7ef] bg-white px-3 py-2.5 text-[#858b9a] shadow-[0_10px_30px_rgb(46_54_77_/_0.06)] md:min-w-[260px]">
        <IconCircleCheck size={18} stroke={2} aria-hidden="true" focusable="false" />
        <span>Checking services</span>
      </div>
    );
  }

  if (isError || !health) {
    return (
      <div className="flex w-full min-w-0 items-center gap-2 rounded-lg border border-[#f0b37e] bg-white px-3 py-2.5 shadow-[0_10px_30px_rgb(46_54_77_/_0.06)] md:min-w-[260px]">
        <IconAlertTriangle
          className="text-[#d97706]"
          size={18}
          stroke={2}
          aria-hidden="true"
          focusable="false"
        />
        <span>API unavailable</span>
      </div>
    );
  }

  return (
    <div
      className={[
        "grid w-full min-w-0 gap-0.5 rounded-lg border bg-white px-3 py-2.5 shadow-[0_10px_30px_rgb(46_54_77_/_0.06)] md:min-w-[260px]",
        health.status === "ok" ? "border-[#3b8df5]" : "border-[#f0b37e]"
      ].join(" ")}
    >
      <span className="flex items-center gap-2 text-sm font-extrabold">
        {health.status === "ok" ? (
          <IconCircleCheck
            className="text-[#3b8df5]"
            size={18}
            stroke={2}
            aria-hidden="true"
            focusable="false"
          />
        ) : (
          <IconAlertTriangle
            className="text-[#d97706]"
            size={18}
            stroke={2}
            aria-hidden="true"
            focusable="false"
          />
        )}
        {health.status === "ok" ? "Healthy" : "Degraded"}
      </span>
      <small className="text-xs text-[#858b9a]">
        DB {health.services.database} · Queue {health.services.queue} · Search{" "}
        {health.services.search}
      </small>
    </div>
  );
};

export default App;
