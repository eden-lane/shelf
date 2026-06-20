import { type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { FolderItem } from "@bookmarks/shared";
import { IconBookmark, IconFolderPlus, IconPencil, IconTrash } from "@tabler/icons-react";
import { ContextMenuButton } from "../../components/ContextMenuButton";

export const FolderContextMenu = ({
  folder,
  x,
  y,
  onAddBookmark,
  onCreateFolder,
  onDeleteFolder,
  onEditFolder
}: {
  folder: FolderItem;
  x: number;
  y: number;
  onAddBookmark: () => void;
  onCreateFolder: () => void;
  onDeleteFolder: () => void;
  onEditFolder: () => void;
}) => {
  const menu = (
    <div
      className="fixed z-[100] grid w-[190px] gap-1 rounded-lg border border-[#dfe4ef] bg-white p-1.5 text-sm font-medium text-[#4b5262] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
      role="menu"
      aria-label={`Folder actions for ${folder.name}`}
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
          event.currentTarget.blur();
        }
      }}
    >
      <ContextMenuButton icon={IconBookmark} label="Add a bookmark" onClick={onAddBookmark} />
      <ContextMenuButton icon={IconFolderPlus} label="Create new folder" onClick={onCreateFolder} />
      <ContextMenuButton icon={IconPencil} label="Edit folder" onClick={onEditFolder} />
      <ContextMenuButton icon={IconTrash} label="Delete folder" tone="danger" onClick={onDeleteFolder} />
    </div>
  );

  return typeof document === "undefined" ? menu : createPortal(menu, document.body);
};
