import { IconCopy, IconExternalLink, IconTrash } from "@tabler/icons-react";
import { ContextMenuButton } from "../../components/ContextMenuButton";

export const BookmarkContextMenu = ({
  itemTitle,
  x,
  y,
  onOpenLink,
  onCopyLink,
  onDelete
}: {
  itemTitle: string;
  x: number;
  y: number;
  onOpenLink: () => void;
  onCopyLink: () => void;
  onDelete: () => void;
}) => (
  <div
    className="fixed z-30 grid w-[160px] gap-1 rounded-lg border border-[#dfe4ef] bg-white p-1.5 text-sm font-medium text-[#4b5262] shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
    role="menu"
    aria-label={`Bookmark actions for ${itemTitle}`}
    style={{ left: x, top: y }}
    onClick={(event) => event.stopPropagation()}
  >
    <ContextMenuButton icon={IconExternalLink} label="Open" onClick={onOpenLink} />
    <ContextMenuButton icon={IconCopy} label="Copy link" onClick={onCopyLink} />
    <ContextMenuButton icon={IconTrash} label="Delete" tone="danger" onClick={onDelete} />
  </div>
);
