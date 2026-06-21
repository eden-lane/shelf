import { IconChevronDown, IconChevronRight } from "@tabler/icons-react";

export const FolderDisclosurePlaceholder = () => <span className="h-7 w-5 shrink-0" aria-hidden="true" />;

export const FolderDisclosureControl = ({
  folderName,
  hasChildren,
  isCollapsed,
  onToggle
}: {
  folderName: string;
  hasChildren: boolean;
  isCollapsed: boolean;
  onToggle: () => void;
}) => {
  if (!hasChildren) {
    return <FolderDisclosurePlaceholder />;
  }

  return (
    <button
      className="grid h-7 w-5 shrink-0 place-items-center rounded-lg text-gray-500 outline-none hover:bg-gray-100 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
      aria-expanded={!isCollapsed}
      aria-label={`${isCollapsed ? "Expand" : "Collapse"} folder ${folderName}`}
      type="button"
      onClick={onToggle}
    >
      {isCollapsed ? (
        <IconChevronRight size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      ) : (
        <IconChevronDown size={16} stroke={1.5} aria-hidden="true" focusable="false" />
      )}
    </button>
  );
};
