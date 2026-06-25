import { useEffect, useRef, useState } from "react";
import {
  useDraggable,
  type DraggableAttributes,
  type DraggableSyntheticListeners
} from "@dnd-kit/core";
import type { SavedItem } from "@shelf/shared";
import {
  IconClock,
  IconDotsVertical,
  IconFolder,
  IconGripVertical,
  IconPhoto
} from "@tabler/icons-react";
import { apiAssetUrl } from "../../api";
import { BOOKMARK_CONTEXT_MENU_SIZE, clampContextMenuPosition } from "../../utils/contextMenu";
import { SavedItemContextMenu } from "./SavedItemContextMenu";
import {
  copySavedItemLink,
  fallbackFaviconUrl,
  formatSavedItemDate,
  hostFromUrl
} from "./savedItemUtils";

export type SavedItemsViewMode = "cards" | "list";

export const SavedItemRow = ({
  item,
  showFolderName,
  viewMode,
  onDeleteSavedItem,
  onEditSavedItem,
  onLinkCopied
}: {
  item: SavedItem;
  showFolderName: boolean;
  viewMode: SavedItemsViewMode;
  onDeleteSavedItem: (savedItemId: string) => void;
  onEditSavedItem: (item: SavedItem) => void;
  onLinkCopied: () => void;
}) => {
  const host = hostFromUrl(item.url);
  const faviconSrc = item.faviconUrl ? apiAssetUrl(item.faviconUrl) : fallbackFaviconUrl(item.url);
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const title = item.title || host || item.url;
  const sourceLabel = item.siteName || host || "Saved item";
  const faviconLetter = sourceLabel.trim().charAt(0).toUpperCase() || "S";
  const contextLabel = [item.libraryName, item.folderName ?? "Inbox"].filter(Boolean).join(" / ");
  const savedDateLabel = `Added ${formatSavedItemDate(item.createdAt)}`;
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    isDragging
  } = useDraggable({
    id: `savedItem:${item.id}`,
    data: {
      savedItemIds: [item.id],
      item,
      sourceFolderId: item.folderId,
      type: "savedItem"
    }
  });

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
    void copySavedItemLink(item.url).then(onLinkCopied);
    setMenu(null);
  };

  const deleteItem = () => {
    onDeleteSavedItem(item.id);
    setMenu(null);
  };

  const editItem = () => {
    onEditSavedItem(item);
    setMenu(null);
  };

  return (
    <article
      ref={setNodeRef}
      className={[
        "group relative w-full min-w-0 max-w-full shrink-0 touch-manipulation overflow-visible border border-[#cbccc9] bg-white shadow-[0_1px_3px_rgb(0_0_0_/_0.03),0_14px_32px_rgb(0_0_0_/_0.07)] transition-[border-color,opacity,box-shadow] focus-within:z-30",
        viewMode === "cards"
          ? "grid h-full gap-4 rounded-2xl p-3"
          : "flex flex-col gap-3 rounded-[14px] p-3 sm:min-h-[150px] sm:flex-row sm:items-start sm:gap-3.5",
        isDragging
          ? "border-[#ff8400] opacity-35 shadow-[0_18px_48px_rgb(255_132_0_/_0.16)]"
          : ""
      ].join(" ")}
    >
      <SavedItemPreview
        item={item}
        title={title}
        viewMode={viewMode}
        dragAttributes={attributes}
        dragListeners={listeners}
        setActivatorNodeRef={setActivatorNodeRef}
      />
      <div
        className={[
          "flex min-w-0 flex-col content-start",
          viewMode === "cards" ? "h-full gap-3" : "flex-1 gap-2 self-stretch"
        ].join(" ")}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            className={[
              "grid shrink-0 place-items-center overflow-hidden bg-[#111111] text-white",
              viewMode === "cards" ? "h-7 w-7 rounded-[7px]" : "h-6 w-6 rounded-md"
            ].join(" ")}
          >
            {faviconSrc ? (
              <img
                className={viewMode === "cards" ? "h-[18px] w-[18px] object-contain" : "h-4 w-4 object-contain"}
                src={faviconSrc}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className={viewMode === "cards" ? "text-sm font-bold" : "text-xs font-bold"}>
                {faviconLetter}
              </span>
            )}
          </div>
          <div
            className={[
              "min-w-0",
              viewMode === "cards" ? "grid flex-1 gap-px" : "flex flex-1 items-center gap-2"
            ].join(" ")}
          >
            <span
              className={[
                "min-w-0 truncate text-[#111111]",
                viewMode === "cards" ? "text-[13px] font-semibold" : "text-xs font-normal"
              ].join(" ")}
            >
              {sourceLabel}
            </span>
            <a
              className="min-w-0 truncate text-[11px] font-normal text-[#666666] no-underline hover:text-[#111111] hover:underline"
              href={item.url}
              rel="noreferrer"
              target="_blank"
            >
              <span className="sr-only">Open saved item URL</span>
              <span aria-hidden="true">{item.url}</span>
            </a>
          </div>
          <SavedItemActionsButton title={title} setMenu={setMenu} />
        </div>

        <div className={viewMode === "cards" ? "grid gap-1.5" : "grid gap-1"}>
          <h2
            className={[
              "m-0 text-[#111111]",
              viewMode === "cards"
                ? "line-clamp-2 text-lg leading-[21px] font-normal"
                : "line-clamp-1 text-base leading-[19px] font-normal"
            ].join(" ")}
          >
            <a className="text-inherit no-underline hover:underline" href={item.url} rel="noreferrer" target="_blank">
              {title}
            </a>
          </h2>
          {item.description ? (
            <p
              className={[
                "m-0 text-[#666666]",
                viewMode === "cards"
                  ? "line-clamp-2 text-[13px] leading-[18px]"
                  : "line-clamp-2 text-xs leading-4"
              ].join(" ")}
            >
              {item.description}
            </p>
          ) : null}
        </div>

        <div className="mt-auto flex min-w-0 items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <SavedItemTags tags={item.tags} viewMode={viewMode} />
            {showFolderName ? (
              <span
                className={[
                  "flex max-w-full items-center gap-1.5 truncate rounded-full bg-[#f2f3f0] text-[#666666]",
                  viewMode === "cards" ? "px-2 py-1 text-[11px]" : "px-[7px] py-1 text-[10px]"
                ].join(" ")}
                aria-label={`Saved item location ${contextLabel}`}
              >
                <IconFolder size={viewMode === "cards" ? 13 : 12} stroke={1.5} aria-hidden="true" focusable="false" />
                <span className="truncate">{contextLabel}</span>
              </span>
            ) : null}
          </div>
          <time
            className="flex shrink-0 items-center gap-1.5 text-[11px] font-normal text-[#666666]"
            dateTime={item.createdAt}
          >
            <IconClock size={13} stroke={1.5} aria-hidden="true" focusable="false" />
            {savedDateLabel}
          </time>
        </div>
      </div>
      {menu ? (
        <SavedItemContextMenu
          itemTitle={title}
          x={menu.x}
          y={menu.y}
          onOpenLink={openLink}
          onCopyLink={copyLink}
          onEdit={editItem}
          onDelete={deleteItem}
        />
      ) : null}
    </article>
  );
};

const SavedItemPreview = ({
  dragAttributes,
  dragListeners,
  item,
  setActivatorNodeRef,
  title,
  viewMode
}: {
  dragAttributes: DraggableAttributes;
  dragListeners: DraggableSyntheticListeners;
  item: SavedItem;
  setActivatorNodeRef: (element: HTMLElement | null) => void;
  title: string;
  viewMode: SavedItemsViewMode;
}) => (
  <div
    className={[
      "relative shrink-0 overflow-hidden bg-[#f2f3f0]",
      viewMode === "cards"
        ? "aspect-[396/207] w-full rounded-xl"
        : "aspect-[229/120] w-full rounded-[10px] sm:w-[229px]"
    ].join(" ")}
  >
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
        className="grid h-full w-full place-items-center bg-[#f2f3f0] text-[#666666]"
        role="img"
        aria-label="No thumbnail available"
      >
        <IconPhoto size={viewMode === "cards" ? 30 : 24} stroke={1.5} aria-hidden="true" focusable="false" />
      </div>
    )}
    <div className="absolute inset-x-0 bottom-0 h-[38%] bg-gradient-to-b from-black/0 to-black/55" />
    <button
      className="absolute top-2 left-2 z-10 grid h-8 w-6 cursor-grab place-items-center rounded-lg border border-white/60 bg-white/85 p-0 text-[#666666] opacity-0 outline-none backdrop-blur-sm transition-[background-color,color,opacity] hover:bg-white hover:text-[#111111] active:cursor-grabbing group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8400]"
      aria-label={`Drag saved item ${title}`}
      type="button"
      ref={setActivatorNodeRef}
      {...dragAttributes}
      {...dragListeners}
    >
      <IconGripVertical size={17} stroke={1.5} aria-hidden="true" focusable="false" />
    </button>
  </div>
);

const SavedItemActionsButton = ({
  setMenu,
  title
}: {
  setMenu: (menu: { x: number; y: number } | null) => void;
  title: string;
}) => (
  <button
    className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent bg-transparent text-[#666666] outline-none hover:border-[#cbccc9] hover:bg-[#f2f3f0] hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8400]"
    aria-label={`Saved item actions for ${title}`}
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      const rect = event.currentTarget.getBoundingClientRect();
      setMenu(clampContextMenuPosition(rect.left, rect.bottom + 4, BOOKMARK_CONTEXT_MENU_SIZE));
    }}
  >
    <IconDotsVertical size={18} stroke={1.5} aria-hidden="true" focusable="false" />
  </button>
);

const SavedItemTags = ({
  tags,
  viewMode
}: {
  tags?: SavedItem["tags"];
  viewMode: SavedItemsViewMode;
}) => {
  const [isOverflowOpen, setIsOverflowOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(tags?.length ?? 0);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setIsOverflowOpen(false);
    setVisibleCount(tags?.length ?? 0);
  }, [tags]);

  useEffect(() => {
    if (!isOverflowOpen) {
      return;
    }

    const closeOverflow = () => setIsOverflowOpen(false);

    window.addEventListener("click", closeOverflow);

    return () => window.removeEventListener("click", closeOverflow);
  }, [isOverflowOpen]);

  useEffect(() => {
    if (!tags || tags.length === 0) {
      return;
    }

    const calculateVisibleTags = () => {
      const container = containerRef.current;
      const measure = measureRef.current;

      if (!container || !measure) {
        return;
      }

      const tagWidths = Array.from(measure.querySelectorAll<HTMLElement>("[data-tag-measure]")).map(
        (node) => node.getBoundingClientRect().width
      );
      const availableWidth = container.getBoundingClientRect().width;

      if (availableWidth <= 0 || tagWidths.length === 0) {
        return;
      }

      const gap = 6;
      const allTagsWidth =
        tagWidths.reduce((total, width) => total + width, 0) + gap * Math.max(0, tagWidths.length - 1);

      if (allTagsWidth <= availableWidth) {
        setVisibleCount(tags.length);
        return;
      }

      let nextVisibleCount = 0;

      for (let count = 0; count < tags.length; count += 1) {
        const hiddenCount = tags.length - count;
        const moreWidth = 30 + String(hiddenCount).length * 7;
        const visibleWidth =
          tagWidths.slice(0, count).reduce((total, width) => total + width, 0) +
          gap * Math.max(0, count - 1);
        const totalWidth = visibleWidth + (count > 0 ? gap : 0) + moreWidth;

        if (totalWidth <= availableWidth) {
          nextVisibleCount = count;
        }
      }

      setVisibleCount(Math.min(nextVisibleCount, tags.length - 1));
    };

    calculateVisibleTags();

    const raf = window.requestAnimationFrame(calculateVisibleTags);
    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(() => calculateVisibleTags());

    if (resizeObserver && containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", calculateVisibleTags);

    return () => {
      window.cancelAnimationFrame(raf);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", calculateVisibleTags);
    };
  }, [tags]);

  if (!tags || tags.length === 0) {
    return null;
  }

  const safeVisibleCount = Math.min(visibleCount, tags.length);
  const visibleTags = tags.slice(0, safeVisibleCount);
  const hiddenTags = tags.slice(safeVisibleCount);

  return (
    <div className="relative min-w-0 max-w-full" ref={containerRef}>
      <div className="flex min-w-0 max-w-full items-center gap-1.5 overflow-visible" aria-label="Saved item tags">
        {visibleTags.map((tag) => (
          <SavedItemTagChip tag={tag} viewMode={viewMode} key={tag.id} />
        ))}
        {hiddenTags.length > 0 ? (
          <button
            className={[
              "shrink-0 rounded-full bg-[#f2f3f0] font-semibold text-[#111111] outline-none hover:bg-[#e7e8e5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff8400]",
              viewMode === "cards" ? "px-2 py-1 text-[11px]" : "px-[7px] py-1 text-[10px]"
            ].join(" ")}
            aria-expanded={isOverflowOpen}
            aria-label={`${hiddenTags.length} more saved item tags`}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setIsOverflowOpen((current) => !current);
            }}
          >
            +{hiddenTags.length}
          </button>
        ) : null}
      </div>
      <div
        className="pointer-events-none absolute top-0 left-0 -z-10 flex max-w-none gap-1.5 opacity-0"
        aria-hidden="true"
        ref={measureRef}
      >
        {tags.map((tag) => (
          <SavedItemTagChip tag={tag} viewMode={viewMode} key={tag.id} measure />
        ))}
      </div>
      {isOverflowOpen && hiddenTags.length > 0 ? (
        <div
          className="absolute top-[calc(100%+6px)] left-0 z-[90] flex min-w-32 max-w-[min(280px,calc(100vw-32px))] flex-wrap gap-1.5 rounded-lg border border-[#cbccc9] bg-white p-2 shadow-[0_18px_55px_rgb(22_28_43_/_0.16)]"
          role="menu"
          aria-label="Hidden saved item tags"
          onClick={(event) => event.stopPropagation()}
        >
          {hiddenTags.map((tag) => (
            <SavedItemTagChip tag={tag} viewMode={viewMode} key={tag.id} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

const SavedItemTagChip = ({
  measure = false,
  tag,
  viewMode
}: {
  measure?: boolean;
  tag: NonNullable<SavedItem["tags"]>[number];
  viewMode: SavedItemsViewMode;
}) => {
  const color = tag.color ?? DEFAULT_TAG_LABEL_COLOR;

  return (
    <span
      className={[
        "max-w-full shrink-0 truncate rounded-full font-semibold",
        viewMode === "cards" ? "px-2 py-1 text-[11px]" : "px-[7px] py-1 text-[10px]"
      ].join(" ")}
      data-tag-measure={measure ? "" : undefined}
      style={{
        backgroundColor: color,
        color: readableTextColor(color)
      }}
      title={tag.name}
    >
      {tag.name}
    </span>
  );
};

const DEFAULT_TAG_LABEL_COLOR = "#697080";

const readableTextColor = (backgroundColor: string) => {
  const hex = backgroundColor.trim().replace(/^#/, "");
  const normalized =
    hex.length === 3
      ? hex
          .split("")
          .map((character) => `${character}${character}`)
          .join("")
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return "#ffffff";
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? "#242833" : "#ffffff";
};
