import { IconBookmark } from "@tabler/icons-react";

export const ContextMenuButton = ({
  icon: Icon,
  label,
  tone = "default",
  onClick
}: {
  icon: typeof IconBookmark;
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
}) => (
  <button
    className={[
      "flex min-h-9 items-center gap-2 rounded-md px-2.5 text-left outline-none hover:bg-[#f7f8fc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]",
      tone === "danger" ? "text-[#b42318]" : "text-[#4b5262]"
    ].join(" ")}
    role="menuitem"
    type="button"
    onClick={onClick}
  >
    <Icon size={16} stroke={1.5} aria-hidden="true" focusable="false" />
    <span>{label}</span>
  </button>
);
