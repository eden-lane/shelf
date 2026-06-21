import { type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import type { TagItem } from "@bookmarks/shared";
import { IconBookmark, IconPencil, IconTrash } from "@tabler/icons-react";
import { ContextMenuButton } from "../../components/ContextMenuButton";

export const TagContextMenu = ({
  tag,
  x,
  y,
  onAddBookmark,
  onDeleteTag,
  onEditTag
}: {
  tag: TagItem;
  x: number;
  y: number;
  onAddBookmark: () => void;
  onDeleteTag: () => void;
  onEditTag: () => void;
}) => {
  const menu = (
    <div
      className="fixed z-[100] grid w-[190px] gap-1 rounded-lg border border-[#dfe4ef] bg-white p-1.5 text-sm font-medium text-[#4b5262] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
      role="menu"
      aria-label={`Tag actions for ${tag.name}`}
      style={{ left: x, top: y }}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Escape") {
          event.currentTarget.blur();
        }
      }}
    >
      <ContextMenuButton icon={IconBookmark} label="Add a bookmark" onClick={onAddBookmark} />
      <ContextMenuButton icon={IconPencil} label="Edit tag" onClick={onEditTag} />
      <ContextMenuButton icon={IconTrash} label="Delete tag" tone="danger" onClick={onDeleteTag} />
    </div>
  );

  return typeof document === "undefined" ? menu : createPortal(menu, document.body);
};
