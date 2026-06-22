export type SavedItemSearchScope = "current" | "all";

export const SearchScopeControl = ({
  scope,
  workspaceName,
  onScopeChange
}: {
  scope: SavedItemSearchScope;
  workspaceName: string;
  onScopeChange: (scope: SavedItemSearchScope) => void;
}) => (
  <section className="flex w-full min-w-0 justify-start" aria-label="Search filters">
    <div
      className="grid max-w-full grid-cols-2 rounded-lg border border-[#dfe4ef] bg-[#f7f8fc] p-1 text-sm font-extrabold"
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
