import { IconSearch, IconX } from "@tabler/icons-react";

export type BookmarkSearchScope = "current" | "all";

export const SearchToolbar = ({
  query,
  scope,
  workspaceName,
  onQueryChange,
  onScopeChange
}: {
  query: string;
  scope: BookmarkSearchScope;
  workspaceName: string;
  onQueryChange: (query: string) => void;
  onScopeChange: (scope: BookmarkSearchScope) => void;
}) => (
  <section
    className="flex w-full min-w-0 flex-col gap-3 rounded-lg border border-[#e4e7ef] bg-white p-3 shadow-[0_14px_40px_rgb(46_54_77_/_0.045)] sm:flex-row sm:items-center"
    aria-label="Bookmark search"
  >
    <label className="relative min-w-0 flex-1">
      <span className="sr-only">Search bookmarks</span>
      <IconSearch
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[#858b9a]"
        size={18}
        stroke={1.5}
        aria-hidden="true"
        focusable="false"
      />
      <input
        className="min-h-11 w-full min-w-0 rounded-lg border border-[#dfe4ef] bg-[#fbfcff] pr-10 pl-10 text-sm font-semibold text-[#242833] outline-none placeholder:text-[#858b9a] focus:border-[#3b8df5] focus:bg-white focus:ring-3 focus:ring-[#3b8df5]/15"
        aria-label="Search bookmarks"
        type="search"
        value={query}
        placeholder="Search saved links"
        onInput={(event) => onQueryChange(event.currentTarget.value)}
      />
      {query ? (
        <button
          className="absolute top-1/2 right-2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg border-0 bg-transparent p-0 text-[#697080] outline-none hover:bg-[#eef1f6] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
          aria-label="Clear search"
          title="Clear search"
          type="button"
          onClick={() => onQueryChange("")}
        >
          <IconX size={16} stroke={1.5} aria-hidden="true" focusable="false" />
        </button>
      ) : null}
    </label>
    <div
      className="grid grid-cols-2 rounded-lg border border-[#dfe4ef] bg-[#f7f8fc] p-1 text-sm font-extrabold"
      aria-label="Search scope"
      role="group"
    >
      <button
        className={scopeButtonClass(scope === "current")}
        aria-pressed={scope === "current"}
        type="button"
        onClick={() => onScopeChange("current")}
      >
        {workspaceName}
      </button>
      <button
        className={scopeButtonClass(scope === "all")}
        aria-pressed={scope === "all"}
        type="button"
        onClick={() => onScopeChange("all")}
      >
        All workspaces
      </button>
    </div>
  </section>
);

const scopeButtonClass = (active: boolean) =>
  [
    "min-h-9 min-w-0 rounded-md px-3 text-center outline-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
    active
      ? "bg-white text-[#242833] shadow-[0_6px_18px_rgb(46_54_77_/_0.08)]"
      : "text-[#697080] hover:bg-white/70 hover:text-[#242833]"
  ].join(" ");
