import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { HealthResponse } from "@bookmarks/shared";
import { getHealth } from "./api";
import "./styles.css";

const navItems = [
  "Inbox",
  "Folders",
  "Search",
  "Tags",
  "System labels",
  "Sources",
  "Settings"
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
    <main className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            B
          </span>
          <span>Bookmarks</span>
        </div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <a href={`#${item.toLowerCase().replaceAll(" ", "-")}`} key={item}>
              {item}
            </a>
          ))}
        </nav>
      </aside>

      <section className="workspace" aria-label="Bookmarks workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Dev user</p>
            <h1>Inbox</h1>
          </div>
          <HealthSummary health={health.data} isLoading={health.isLoading} isError={health.isError} />
        </header>

        <section className="empty-state" aria-labelledby="empty-state-title">
          <div>
            <h2 id="empty-state-title">Ready for saved links</h2>
            <p>
              This authenticated shell is connected to the local API and waiting for the
              first bookmark workflow.
            </p>
          </div>
          <div className="placeholder-list" aria-label="Upcoming app areas">
            {navItems.slice(1, 6).map((item) => (
              <div className="placeholder-row" key={item}>
                <span>{item}</span>
                <span>Placeholder</span>
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
    return <div className="health health-loading">Checking services</div>;
  }

  if (isError || !health) {
    return <div className="health health-error">API unavailable</div>;
  }

  return (
    <div className={`health ${health.status === "ok" ? "health-ok" : "health-warn"}`}>
      <span>{health.status === "ok" ? "Healthy" : "Degraded"}</span>
      <small>
        DB {health.services.database} · Queue {health.services.queue} · Worker{" "}
        {health.services.worker} · Search {health.services.search}
      </small>
    </div>
  );
};

export default App;
