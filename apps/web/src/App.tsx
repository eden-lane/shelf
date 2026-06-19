import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@bookmarks/shared";
import {
  IconAlertTriangle,
  IconBookmark,
  IconCircleCheck,
  IconDatabase,
  IconFolder,
  IconInbox,
  IconSearch,
  IconSettings,
  IconTag,
  IconTags
} from "@tabler/icons-react";
import { getHealth } from "./api";

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
          <span>Bookmarks</span>
        </div>
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
            <p className="mb-1 text-[13px] font-bold text-[#858b9a]">Dev user</p>
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
        DB {health.services.database} · Queue {health.services.queue} · Worker{" "}
        {health.services.worker} · Search {health.services.search}
      </small>
    </div>
  );
};

export default App;
