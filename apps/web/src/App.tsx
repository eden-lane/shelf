import { useState } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { CurrentUserResponse, HealthResponse } from "@bookmarks/shared";
import { Dialog } from "@base-ui/react/dialog";
import {
  IconAlertTriangle,
  IconBookmark,
  IconCircleCheck,
  IconDatabase,
  IconFolder,
  IconInbox,
  IconPlus,
  IconSearch,
  IconSettings,
  IconTag,
  IconTags,
  IconX
} from "@tabler/icons-react";
import { getCurrentUser, getHealth } from "./api";

const navItems = [
  { label: "Inbox", icon: IconInbox },
  { label: "Folders", icon: IconFolder },
  { label: "Search", icon: IconSearch },
  { label: "Tags", icon: IconTag },
  { label: "System labels", icon: IconTags },
  { label: "Sources", icon: IconDatabase },
  { label: "Settings", icon: IconSettings }
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

      <section
        className="flex min-w-0 flex-col gap-7 p-5 md:p-7"
        aria-label="Bookmarks workspace"
      >
        <header className="flex flex-col items-start justify-between gap-5 md:flex-row">
          <div>
            <p className="mb-1 text-[13px] font-bold text-[#858b9a]">{username}</p>
            <h1 className="m-0 text-[34px] leading-[1.1] font-bold">Inbox</h1>
          </div>
          <HealthSummary health={health.data} isLoading={health.isLoading} isError={health.isError} />
        </header>

        <section
          className="grid items-start gap-7 rounded-lg border border-[#e4e7ef] bg-white p-7 shadow-[0_20px_60px_rgb(46_54_77_/_0.06)] lg:grid-cols-[minmax(0,0.85fr)_minmax(280px,0.55fr)]"
          aria-labelledby="empty-state-title"
        >
          <div>
            <h2 id="empty-state-title" className="mb-2.5 text-2xl leading-[1.2] font-bold">
              Ready for saved links
            </h2>
            <p className="mb-0 max-w-[56ch] text-[#697080]">
              This authenticated shell is connected to the local API and waiting for the
              first bookmark workflow.
            </p>
          </div>
          <div className="grid gap-2" aria-label="Upcoming app areas">
            {navItems.slice(1, 6).map(({ label, icon: Icon }) => (
              <div
                className="flex min-h-11 items-center justify-between gap-4 rounded-lg border border-[#e7eaf1] bg-[#fbfcff] px-3.5 text-sm font-bold text-[#2d313b]"
                key={label}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className="text-[#858b9a]"
                    size={17}
                    stroke={2}
                    aria-hidden="true"
                    focusable="false"
                  />
                  {label}
                </span>
                <span className="text-xs font-bold text-[#858b9a]">Placeholder</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
};

const displayUsername = (currentUser?: CurrentUserResponse) =>
  currentUser?.user.name || currentUser?.user.email || "User";

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
