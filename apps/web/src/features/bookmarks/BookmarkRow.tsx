import { useEffect, useState } from "react";
import type { BookmarkItem } from "@bookmarks/shared";
import {
  IconBookmark,
  IconDotsVertical,
  IconExternalLink,
  IconFolder,
  IconPhoto
} from "@tabler/icons-react";
import { apiAssetUrl } from "../../api";
import { BOOKMARK_CONTEXT_MENU_SIZE, clampContextMenuPosition } from "../../utils/contextMenu";
import { BookmarkContextMenu } from "./BookmarkContextMenu";
import { copyBookmarkLink, formatBookmarkDate, hostFromUrl } from "./bookmarkUtils";

export const BookmarkRow = ({
  item,
  showFolderName,
  onDeleteBookmark,
  onLinkCopied
}: {
  item: BookmarkItem;
  showFolderName: boolean;
  onDeleteBookmark: (bookmarkId: string) => void;
  onLinkCopied: () => void;
}) => {
  const host = hostFromUrl(item.url);
  const faviconSrc = item.faviconUrl ? apiAssetUrl(item.faviconUrl) : null;
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const title = item.title || host || item.url;

  useEffect(() => {
    if (!menu) {
      return;
    }

    const closeMenu = () => setMenu(null);

    window.addEventListener("click", closeMenu);

    return () => window.removeEventListener("click", closeMenu);
  }, [menu]);

  const openLink = () => {
    window.open(item.url, "_blank", "noopener,noreferrer");
    setMenu(null);
  };

  const copyLink = () => {
    void copyBookmarkLink(item.url).then(onLinkCopied);
    setMenu(null);
  };

  const deleteItem = () => {
    onDeleteBookmark(item.id);
    setMenu(null);
  };

  return (
    <article className="w-full min-w-0 max-w-full overflow-hidden rounded-lg border border-[#e4e7ef] bg-white p-4 shadow-[0_14px_40px_rgb(46_54_77_/_0.045)]">
      <div className="grid min-w-0 grid-cols-[88px_minmax(0,1fr)] gap-4 sm:grid-cols-[144px_minmax(0,1fr)]">
        <div className="aspect-[4/3] overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#f3f5f9] sm:aspect-[3/2]">
          {item.imageUrl ? (
            <img
              className="h-full w-full object-cover"
              src={item.imageUrl}
              alt=""
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              className="grid h-full w-full place-items-center bg-[#f7f8fc] text-[#9aa1ad]"
              role="img"
              aria-label="No thumbnail available"
            >
              <IconPhoto size={28} stroke={1.5} aria-hidden="true" focusable="false" />
            </div>
          )}
        </div>
        <div className="grid min-w-0 gap-3">
          <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg border border-[#e7eaf1] bg-[#fbfcff]">
                {faviconSrc ? (
                  <img
                    className="h-5 w-5 object-contain"
                    src={faviconSrc}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <IconBookmark size={19} stroke={1.5} aria-hidden="true" focusable="false" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="m-0 truncate text-lg leading-[1.25] font-extrabold">
                  {title}
                </h2>
                <a
                  className="mt-1 flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#2f80ed] no-underline hover:underline"
                  href={item.url}
                  rel="noreferrer"
                  target="_blank"
                >
                  <IconExternalLink size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  <span className="truncate">{item.url}</span>
                </a>
              </div>
            </div>
            <div className="flex w-fit shrink-0 items-center gap-2">
              {showFolderName ? (
                <span
                  className="flex items-center gap-1.5 rounded-lg border border-[#e7eaf1] bg-[#fbfcff] px-2.5 py-1 text-xs font-extrabold text-[#697080]"
                  aria-label={`Bookmark folder ${item.folderName}`}
                >
                  <IconFolder size={16} stroke={1.5} aria-hidden="true" focusable="false" />
                  {item.folderName}
                </span>
              ) : null}
              <button
                className="grid h-8 w-8 place-items-center rounded-lg border border-[#e7eaf1] bg-[#fbfcff] text-[#697080] outline-none hover:bg-[#f7f8fc] hover:text-[#242833] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#3b8df5]"
                aria-label={`Bookmark actions for ${title}`}
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setMenu(
                    clampContextMenuPosition(rect.left, rect.bottom + 4, BOOKMARK_CONTEXT_MENU_SIZE)
                  );
                }}
              >
                <IconDotsVertical size={16} stroke={1.5} aria-hidden="true" focusable="false" />
              </button>
            </div>
          </div>
          {item.description ? (
            <p className="m-0 max-w-[74ch] text-sm leading-6 text-[#697080]">
              {item.description}
            </p>
          ) : null}
          <time className="text-xs font-bold text-[#858b9a]" dateTime={item.createdAt}>
            Added {formatBookmarkDate(item.createdAt)}
          </time>
        </div>
      </div>
      {menu ? (
        <BookmarkContextMenu
          itemTitle={title}
          x={menu.x}
          y={menu.y}
          onOpenLink={openLink}
          onCopyLink={copyLink}
          onDelete={deleteItem}
        />
      ) : null}
    </article>
  );
};
